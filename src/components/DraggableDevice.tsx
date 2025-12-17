import React, { useCallback, useEffect, useRef } from 'react';
import DeviceCard from './DeviceCard';
import type { Device } from '../models/Device';
import type { Port } from '../models/Port';
import type { WorkspaceDevice } from '../models/WorkspaceDevice';
import type { PortReference } from '../utils/inference';

interface DraggableDeviceProps {
  instance: WorkspaceDevice;
  zIndex: number;
  onPortClick: (instanceId: string, device: Device, port: Port) => void;
  selectedPort: PortReference | null;
  onRemove: (instanceId: string) => void;
  updatePosition: (pos: { x: number; y: number }) => void;
  workspaceRef: React.RefObject<HTMLDivElement>;
  zoom: number;
  pan: { x: number; y: number };
  onPortPositionChange: (
    instanceId: string,
    portId: string,
    position: { x: number; y: number } | null
  ) => void;
  onTestSound?: (instanceId: string) => void;
  testSoundAvailable?: boolean;
  onToggleClockMaster?: (instanceId: string) => void;
  canBeClockMaster?: boolean;
  isHighlighted?: boolean;
}

const interactiveSelector = 'button, a, input, textarea, select, [data-draggable-ignore="true"]';

const DraggableDevice: React.FC<DraggableDeviceProps> = ({
  instance,
  zIndex,
  onPortClick,
  selectedPort,
  onRemove,
  updatePosition,
  workspaceRef,
  zoom,
  pan,
  onPortPositionChange,
  onTestSound,
  testSoundAvailable,
  onToggleClockMaster,
  canBeClockMaster,
  isHighlighted
}) => {
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const portElements = useRef(new Map<string, HTMLElement>());

  const screenToWorkspace = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const workspace = workspaceRef.current;
      if (!workspace) {
        return null;
      }
      const rect = workspace.getBoundingClientRect();
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom
      };
    },
    [workspaceRef, pan.x, pan.y, zoom]
  );

  const reportPortPositions = useCallback(() => {
    portElements.current.forEach((element, portId) => {
      if (!element) {
        onPortPositionChange(instance.instanceId, portId, null);
        return;
      }
      const rect = element.getBoundingClientRect();
      const point = screenToWorkspace(rect.left + rect.width / 2, rect.top + rect.height / 2);
      if (point) {
        onPortPositionChange(instance.instanceId, portId, point);
      }
    });
  }, [instance.instanceId, onPortPositionChange, screenToWorkspace]);

  const registerPortElement = useCallback(
    (portId: string, element: HTMLElement | null) => {
      if (element) {
        portElements.current.set(portId, element);
      } else {
        portElements.current.delete(portId);
        onPortPositionChange(instance.instanceId, portId, null);
      }
      reportPortPositions();
    },
    [instance.instanceId, onPortPositionChange, reportPortPositions]
  );

  const shouldIgnoreDrag = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    return Boolean(target.closest(interactiveSelector));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (shouldIgnoreDrag(event.target)) {
      return;
    }

    const basePoint = screenToWorkspace(event.clientX, event.clientY);
    if (!basePoint) {
      return;
    }

    dragging.current = true;
    dragOffset.current = {
      x: basePoint.x - instance.position.x,
      y: basePoint.y - instance.position.y
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) {
      return;
    }

    const basePoint = screenToWorkspace(event.clientX, event.clientY);
    if (!basePoint) {
      return;
    }

    updatePosition({
      x: basePoint.x - dragOffset.current.x,
      y: basePoint.y - dragOffset.current.y
    });
    requestAnimationFrame(reportPortPositions);
  };

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) {
      return;
    }
    dragging.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    reportPortPositions();
  };

  useEffect(() => {
    reportPortPositions();
  }, [instance.position.x, instance.position.y, zoom, pan.x, pan.y, reportPortPositions]);

  return (
    <div
      className="workspace__device"
      style={{
        left: `${instance.position.x}px`,
        top: `${instance.position.y}px`,
        zIndex,
        cursor: dragging.current ? 'grabbing' : 'grab',
        userSelect: 'none'
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
    >
      <DeviceCard
        device={instance.device}
        variant="workspace"
        onPortClick={(port) => onPortClick(instance.instanceId, instance.device, port)}
        selectedPortId={selectedPort?.instanceId === instance.instanceId ? selectedPort.portId : null}
        onRemove={() => onRemove(instance.instanceId)}
        registerPortElement={registerPortElement}
        onTestSound={onTestSound ? () => onTestSound(instance.instanceId) : undefined}
        testSoundAvailable={testSoundAvailable}
        onToggleClockMaster={
          onToggleClockMaster && canBeClockMaster
            ? () => onToggleClockMaster(instance.instanceId)
            : undefined
        }
        canToggleClockMaster={Boolean(canBeClockMaster)}
        isClockMaster={Boolean(instance.isClockMaster)}
        isHighlighted={isHighlighted}
      />
    </div>
  );
};

export default DraggableDevice;
