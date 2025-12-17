import { useCallback, useMemo, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Connection, PortReference } from '../utils/inference';
import type { Port, PortSignal } from '../models/Port';

interface PositionedPort extends PortReference {
  direction: Port['direction'];
  position: { x: number; y: number };
  signals: PortSignal[];
}

interface CableLayerProps {
  connections: Connection[];
  portPositions: Record<string, Record<string, { x: number; y: number }>>;
  workspaceSize: { width: number; height: number };
  ports: PositionedPort[];
  onReassignConnection: (connectionId: string, end: 'from' | 'to', port: PortReference) => void;
  screenToWorkspace: (clientX: number, clientY: number) => { x: number; y: number } | null;
  highlightedConnections?: Set<string>;
}

interface DragState {
  connectionId: string;
  end: 'from' | 'to';
  pointerId: number;
  pointer: { x: number; y: number };
  origin: PortReference;
  hoverPort?: PositionedPort | null;
}

const DRAG_SNAP_DISTANCE = 28; // pixels in workspace coordinates

function buildCablePath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const deltaX = Math.abs(to.x - from.x);
  const controlOffset = Math.max(deltaX * 0.45, 60);
  const controlFromX = from.x + (to.x >= from.x ? controlOffset : -controlOffset);
  const controlToX = to.x + (to.x >= from.x ? -controlOffset : controlOffset);

  return `M ${from.x} ${from.y} C ${controlFromX} ${from.y}, ${controlToX} ${to.y}, ${to.x} ${to.y}`;
}

function sameEndpoint(a: PortReference, b: PortReference): boolean {
  return a.instanceId === b.instanceId && a.portId === b.portId;
}

function isOutputDirection(direction: Port['direction']): boolean {
  return direction === 'out' || direction === 'in_out';
}

function isInputDirection(direction: Port['direction']): boolean {
  return direction === 'in' || direction === 'in_out';
}

const CableLayer = ({
  connections,
  portPositions,
  workspaceSize,
  ports,
  onReassignConnection,
  screenToWorkspace,
  highlightedConnections
}: CableLayerProps) => {
  const [dragState, setDragState] = useState<DragState | null>(null);

  const connectionEndpoints = useMemo(() => {
    return connections.map((connection) => {
      const fromPos = portPositions[connection.from.instanceId]?.[connection.from.portId];
      const toPos = portPositions[connection.to.instanceId]?.[connection.to.portId];

      return {
        connection,
        fromPos,
        toPos
      };
    });
  }, [connections, portPositions]);

  const portMetadata = useMemo(() => {
    const map = new Map<string, PositionedPort>();
    ports.forEach((port) => {
      map.set(`${port.instanceId}:${port.portId}`, port);
    });
    return map;
  }, [ports]);

  const classifyConnection = useCallback(
    (connection: Connection): 'audio' | 'midi' | 'default' => {
      const fromMeta = portMetadata.get(`${connection.from.instanceId}:${connection.from.portId}`);
      const toMeta = portMetadata.get(`${connection.to.instanceId}:${connection.to.portId}`);
      if (!fromMeta || !toMeta) {
        return 'default';
      }

      const hasSignalFrom = (signals: PortSignal[], target: PortSignal[]) =>
        signals.some((signal) => target.includes(signal));

      const audioSignals: PortSignal[] = ['audio', 'usb_audio'];
      const midiSignals: PortSignal[] = ['midi', 'usb_midi'];

      const sharesAudio =
        hasSignalFrom(fromMeta.signals, audioSignals) && hasSignalFrom(toMeta.signals, audioSignals);
      if (sharesAudio) {
        return 'audio';
      }

      const sharesMidi =
        hasSignalFrom(fromMeta.signals, midiSignals) && hasSignalFrom(toMeta.signals, midiSignals);
      if (sharesMidi) {
        return 'midi';
      }

      return 'default';
    },
    [portMetadata]
  );

  const getEligiblePort = (point: { x: number; y: number }, end: 'from' | 'to', connection: Connection) => {
    let closest: PositionedPort | null = null;
    let closestDist = Number.POSITIVE_INFINITY;

    const otherEndpoint = end === 'from' ? connection.to : connection.from;

    ports.forEach((port) => {
      const dx = port.position.x - point.x;
      const dy = port.position.y - point.y;
      const dist = Math.hypot(dx, dy);
      if (dist > DRAG_SNAP_DISTANCE) {
        return;
      }
      if (sameEndpoint(otherEndpoint, port)) {
        return;
      }
      if (end === 'from' && !isOutputDirection(port.direction)) {
        return;
      }
      if (end === 'to' && !isInputDirection(port.direction)) {
        return;
      }
      if (dist < closestDist) {
        closest = port;
        closestDist = dist;
      }
    });

    return closest;
  };

  const updatePointer = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (!dragState) {
      return;
    }
    if (event.pointerId !== dragState.pointerId) {
      return;
    }
    const workspacePoint = screenToWorkspace(event.clientX, event.clientY);
    if (!workspacePoint) {
      return;
    }
    const { connectionId, end } = dragState;
    const connection = connections.find((item) => item.id === connectionId);
    if (!connection) {
      return;
    }
    const hoverPort = getEligiblePort(workspacePoint, end, connection);
    setDragState((prev) => (prev ? { ...prev, pointer: workspacePoint, hoverPort } : prev));
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGCircleElement>, connection: Connection, end: 'from' | 'to') => {
    event.preventDefault();
    event.stopPropagation();
    const workspacePoint = screenToWorkspace(event.clientX, event.clientY);
    if (!workspacePoint) {
      return;
    }

    const origin = end === 'from' ? connection.from : connection.to;

    setDragState({
      connectionId: connection.id,
      end,
      pointerId: event.pointerId,
      pointer: workspacePoint,
      origin
    });

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGCircleElement>) => {
    updatePointer(event);
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (!dragState) {
      return;
    }
    if (event.pointerId !== dragState.pointerId) {
      return;
    }

    const connection = connections.find((item) => item.id === dragState.connectionId);
    if (!connection) {
      setDragState(null);
      return;
    }

    const workspacePoint = screenToWorkspace(event.clientX, event.clientY);
    const candidate = workspacePoint ? getEligiblePort(workspacePoint, dragState.end, connection) : null;

    if (candidate) {
      onReassignConnection(dragState.connectionId, dragState.end, candidate);
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragState(null);
  };

  const handlePointerCancel = (event: ReactPointerEvent<SVGCircleElement>) => {
    if (dragState && event.pointerId === dragState.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      setDragState(null);
    }
  };

  return (
    <svg
      className="workspace__cables"
      width={workspaceSize.width || 0}
      height={workspaceSize.height || 0}
      viewBox={`0 0 ${workspaceSize.width || 0} ${workspaceSize.height || 0}`}
      style={{ position: 'absolute', inset: 0 }}
    >
      <defs>
        <radialGradient id="cable-end-hover" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="0.4" />
        </radialGradient>
      </defs>
      {connectionEndpoints.map(({ connection, fromPos, toPos }) => {
        if (!fromPos || !toPos) {
          return null;
        }

        const isDraggingThisConnection = dragState?.connectionId === connection.id;
        const effectiveFrom =
          isDraggingThisConnection && dragState?.end === 'from'
            ? dragState.pointer
            : fromPos;
        const effectiveTo =
          isDraggingThisConnection && dragState?.end === 'to'
            ? dragState.pointer
            : toPos;

        const path = buildCablePath(effectiveFrom, effectiveTo);
        const connectionVariant = classifyConnection(connection);
        const isInvalid = connection.status === 'invalid';
        const isHighlighted = highlightedConnections?.has(connection.id) ?? false;
        const pathClasses = ['cable'];
        if (isInvalid) {
          pathClasses.push('cable--invalid');
        } else {
          pathClasses.push(`cable--${connectionVariant}`);
        }
        if (isHighlighted) {
          pathClasses.push('cable--highlighted');
        }
        const hoverPortId = dragState?.hoverPort ? `${dragState.hoverPort.instanceId}:${dragState.hoverPort.portId}` : null;
        const fromPortId = `${connection.from.instanceId}:${connection.from.portId}`;
        const toPortId = `${connection.to.instanceId}:${connection.to.portId}`;
        const handleColor = isInvalid
          ? '#ef4444'
          : connectionVariant === 'audio'
          ? '#1d4ed8'
          : connectionVariant === 'midi'
          ? '#9333ea'
          : '#1e293b';
        const highlightedHandleColor = isHighlighted ? '#facc15' : handleColor;

        return (
          <g key={connection.id} className="workspace__cable">
            <path d={path} className={pathClasses.join(' ')} />
            <circle
              cx={effectiveFrom.x}
              cy={effectiveFrom.y}
              r={9}
              className="cable__handle"
              data-draggable-ignore="true"
              style={{ pointerEvents: 'auto' }}
              onPointerDown={(event) => handlePointerDown(event, connection, 'from')}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              fill={hoverPortId && hoverPortId === fromPortId ? 'url(#cable-end-hover)' : highlightedHandleColor}
            />
            <circle
              cx={effectiveTo.x}
              cy={effectiveTo.y}
              r={9}
              className="cable__handle"
              data-draggable-ignore="true"
              style={{ pointerEvents: 'auto' }}
              onPointerDown={(event) => handlePointerDown(event, connection, 'to')}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              fill={hoverPortId && hoverPortId === toPortId ? 'url(#cable-end-hover)' : highlightedHandleColor}
            />
          </g>
        );
      })}
    </svg>
  );
};

export default CableLayer;
