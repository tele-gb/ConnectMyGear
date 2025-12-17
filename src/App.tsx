import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent, PointerEvent as ReactPointerEvent, WheelEvent } from 'react';
import DeviceCard from './components/DeviceCard';
import DraggableDevice from './components/DraggableDevice';
import CableLayer from './components/CableLayer';
import WorkflowPanel from './components/WorkflowPanel';
import CustomDeviceModal from './components/CustomDeviceModal';
import devicesData from './data/devices.json';
import type { Device } from './models/Device';
import type { Port } from './models/Port';
import type { WorkspaceDevice } from './models/WorkspaceDevice';
import {
  inferConnections,
  type Connection,
  type PortReference
} from './utils/inference';
import { recommendBetweenDevices } from './utils/recommendations';

const deviceCatalog = devicesData as Device[];

const MAX_GRID_COLUMNS = 3;
const GRID_COLUMN_SPACING = 360;
const GRID_ROW_SPACING = 240;
const GRID_MARGIN_X = 32;
const GRID_MARGIN_Y = 32;
const CARD_WIDTH = 280;
const CARD_HEIGHT = 200;
const CANVAS_PADDING = 16;
const VIRTUAL_CANVAS_WIDTH = 2400;
const VIRTUAL_CANVAS_HEIGHT = 1600;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.4;
const ZOOM_STEP = 0.15;
const PAN_STEP = 160;
const TEST_SOUND_DURATION_MS = 600;
const AUDIO_HIGHLIGHT_DURATION_MS = 900;

const computeFallbackPosition = (index: number, columns: number): { x: number; y: number } => {
  const safeColumns = Math.max(1, Math.min(MAX_GRID_COLUMNS, columns));
  const column = index % safeColumns;
  const row = Math.floor(index / safeColumns);

  return {
    x: GRID_MARGIN_X + column * GRID_COLUMN_SPACING,
    y: GRID_MARGIN_Y + row * GRID_ROW_SPACING
  };
};

const isMonitorDevice = (device?: Device | null): boolean => {
  if (!device) {
    return false;
  }
  if (device.tags?.some((tag) => tag.toLowerCase() === 'monitor')) {
    return true;
  }
  if (device.category && device.category.toLowerCase().includes('monitor')) {
    return true;
  }
  return false;
};

const deviceSupportsClockMaster = (device?: Device | null): boolean => {
  if (!device) {
    return false;
  }
  return device.ports.some(
    (port) => (port.direction === 'out' || port.direction === 'in_out') && port.signals.includes('midi')
  );
};

export const App = () => {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const [workspaceDevices, setWorkspaceDevices] = useState<WorkspaceDevice[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedPort, setSelectedPort] = useState<PortReference | null>(null);
  const [portPositions, setPortPositions] = useState<
    Record<string, Record<string, { x: number; y: number }>>
  >({});
  const [workspaceZoom, setWorkspaceZoom] = useState(1);
  const [workspacePan, setWorkspacePan] = useState({ x: 0, y: 0 });
  const [customDevices, setCustomDevices] = useState<Device[]>([]);
  const [isDeviceCreatorOpen, setDeviceCreatorOpen] = useState(false);
  const [selectedLibraryDeviceId, setSelectedLibraryDeviceId] = useState<string>('');
  const [highlightedDevices, setHighlightedDevices] = useState<Set<string>>(new Set());
  const [highlightedConnections, setHighlightedConnections] = useState<Set<string>>(new Set());
  const highlightTimeoutRef = useRef<number | null>(null);

  const libraryDevices = useMemo(() => [...customDevices, ...deviceCatalog], [customDevices]);

  const customDeviceIds = useMemo(
    () => new Set(customDevices.map((device) => device.id)),
    [customDevices]
  );

  const existingDeviceIds = useMemo(
    () => new Set(libraryDevices.map((device) => device.id)),
    [libraryDevices]
  );

  const groupedLibraryDevices = useMemo(() => {
    const groups = new Map<string, Device[]>();
    libraryDevices.forEach((device) => {
      let category = device.category?.trim() ?? '';
      if (!category) {
        category = customDeviceIds.has(device.id) ? 'Custom Devices' : 'Other';
      }
      if (customDeviceIds.has(device.id) && device.category?.trim()) {
        category = `${device.category.trim()} (Custom)`;
      }
      const bucket = groups.get(category);
      if (bucket) {
        bucket.push(device);
      } else {
        groups.set(category, [device]);
      }
    });

    return Array.from(groups.entries())
      .map(([category, devices]) => [category, devices.slice().sort((a, b) => a.name.localeCompare(b.name))] as const)
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }));
  }, [customDeviceIds, libraryDevices]);

  const selectedLibraryDevice = useMemo(
    () => libraryDevices.find((device) => device.id === selectedLibraryDeviceId) ?? null,
    [libraryDevices, selectedLibraryDeviceId]
  );

  useEffect(() => {
    if (libraryDevices.length === 0) {
      setSelectedLibraryDeviceId('');
      return;
    }

    if (!selectedLibraryDeviceId) {
      setSelectedLibraryDeviceId(libraryDevices[0].id);
      return;
    }

    const stillExists = libraryDevices.some((device) => device.id === selectedLibraryDeviceId);
    if (!stillExists) {
      setSelectedLibraryDeviceId(libraryDevices[0].id);
    }
  }, [libraryDevices, selectedLibraryDeviceId]);

  const inference = useMemo(() => {
    const clockMasterIds = new Set<string>();
    workspaceDevices.forEach((instance) => {
      if (instance.isClockMaster) {
        clockMasterIds.add(instance.instanceId);
      }
    });

    return inferConnections(workspaceDevices, connections, { clockMasterIds });
  }, [workspaceDevices, connections]);

  const workspaceRecommendations = useMemo(() => {
    if (workspaceDevices.length < 2) {
      return [];
    }

    const suggestions = new Set<string>();
    for (let i = 0; i < workspaceDevices.length; i += 1) {
      for (let j = i + 1; j < workspaceDevices.length; j += 1) {
        const deviceA = workspaceDevices[i]?.device;
        const deviceB = workspaceDevices[j]?.device;
        if (!deviceA || !deviceB) {
          continue;
        }

        recommendBetweenDevices(deviceA, deviceB).forEach((item) => {
          if (item) {
            suggestions.add(item);
          }
        });
      }
    }

    return Array.from(suggestions).sort((a, b) => a.localeCompare(b));
  }, [workspaceDevices]);

  const workspaceDeviceMap = useMemo(
    () =>
      new Map<string, WorkspaceDevice>(
        workspaceDevices.map((instance) => [instance.instanceId, instance])
      ),
    [workspaceDevices]
  );

  const workspaceSize = useMemo(
    () => ({ width: VIRTUAL_CANVAS_WIDTH, height: VIRTUAL_CANVAS_HEIGHT }),
    []
  );

  const monitorInstanceIds = useMemo(() => {
    const ids = new Set<string>();
    workspaceDevices.forEach((instance) => {
      if (isMonitorDevice(instance.device)) {
        ids.add(instance.instanceId);
      }
    });
    return ids;
  }, [workspaceDevices]);

  const audioGraph = useMemo(() => {
    const adjacency = new Map<string, Array<{ neighbor: string; connectionId: string }>>();

    const addEdge = (from: string, to: string, connectionId: string) => {
      const entries = adjacency.get(from);
      if (entries) {
        entries.push({ neighbor: to, connectionId });
        return;
      }
      adjacency.set(from, [{ neighbor: to, connectionId }]);
    };

    inference.connections.forEach((connection) => {
      if (connection.status === 'invalid') {
        return;
      }

      const fromInstance = workspaceDeviceMap.get(connection.from.instanceId);
      const toInstance = workspaceDeviceMap.get(connection.to.instanceId);
      if (!fromInstance || !toInstance) {
        return;
      }

      const fromPort = fromInstance.device.ports.find((port) => port.id === connection.from.portId);
      const toPort = toInstance.device.ports.find((port) => port.id === connection.to.portId);

      if (!fromPort || !toPort) {
        return;
      }

      const fromHasAudio = fromPort.signals.some((signal) => signal === 'audio' || signal === 'usb_audio');
      const toHasAudio = toPort.signals.some((signal) => signal === 'audio' || signal === 'usb_audio');

      if (!fromHasAudio || !toHasAudio) {
        return;
      }

      const fromIsOutput = fromPort.direction === 'out' || fromPort.direction === 'in_out';
      const fromIsInput = fromPort.direction === 'in' || fromPort.direction === 'in_out';
      const toIsOutput = toPort.direction === 'out' || toPort.direction === 'in_out';
      const toIsInput = toPort.direction === 'in' || toPort.direction === 'in_out';

      if (fromIsOutput && toIsInput) {
        addEdge(connection.from.instanceId, connection.to.instanceId, connection.id);
      }

      if (toIsOutput && fromIsInput) {
        addEdge(connection.to.instanceId, connection.from.instanceId, connection.id);
      }
    });

    return adjacency;
  }, [inference.connections, workspaceDeviceMap]);

  const updatePortPosition = useCallback(
    (instanceId: string, portId: string, position: { x: number; y: number } | null) => {
      setPortPositions((prev) => {
        const next = { ...prev };
        const existingPorts = next[instanceId] ? { ...next[instanceId] } : {};

        if (position) {
          existingPorts[portId] = position;
          next[instanceId] = existingPorts;
          return next;
        }

        if (portId in existingPorts) {
          delete existingPorts[portId];
        }

        if (Object.keys(existingPorts).length === 0) {
          delete next[instanceId];
        } else {
          next[instanceId] = existingPorts;
        }

        return next;
      });
    },
    []
  );

  const canPlayTestSound = useCallback(
    (instanceId: string): boolean => {
      const instance = workspaceDeviceMap.get(instanceId);
      if (!instance) {
        return false;
      }

      if (instance.device.tags?.some((tag) => tag === 'no_test_sound')) {
        return false;
      }

      const hasAudioOutput = instance.device.ports.some(
        (port) =>
          (port.direction === 'out' || port.direction === 'in_out') &&
          (port.signals.includes('audio') || port.signals.includes('usb_audio'))
      );

      if (!hasAudioOutput) {
        return false;
      }

      if (monitorInstanceIds.size === 0) {
        return false;
      }

      if (monitorInstanceIds.has(instanceId)) {
        return false;
      }

      const visited = new Set<string>([instanceId]);
      const queue: string[] = [instanceId];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current !== instanceId && monitorInstanceIds.has(current)) {
          return true;
        }

        const neighbors = audioGraph.get(current);
        if (!neighbors) {
          continue;
        }

        neighbors.forEach(({ neighbor }) => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        });
      }

      return false;
    },
    [audioGraph, monitorInstanceIds, workspaceDeviceMap]
  );

  const audioContextRef = useRef<AudioContext | null>(null);
  const activeOscillators = useRef<Map<string, OscillatorNode>>(new Map());

  const handleTestSound = useCallback(
    (instanceId: string) => {
      if (!canPlayTestSound(instanceId)) {
        return;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const context = audioContextRef.current;
      if (context.state === 'suspended') {
        void context.resume();
      }
      const previous = activeOscillators.current.get(instanceId);
      previous?.stop();
      previous?.disconnect();
      activeOscillators.current.delete(instanceId);

      const oscillator = context.createOscillator();
      oscillator.type = 'sawtooth';
      oscillator.frequency.value = 440;

      const gain = context.createGain();
      gain.gain.value = 0.05;

      oscillator.connect(gain).connect(context.destination);
      oscillator.start();

      activeOscillators.current.set(instanceId, oscillator);

      const visitedDevices = new Set<string>();
      const highlightedEdges = new Set<string>();
      const queue: string[] = [];
      visitedDevices.add(instanceId);
      queue.push(instanceId);

      while (queue.length > 0) {
        const current = queue.shift()!;
        const neighbors = audioGraph.get(current);
        if (!neighbors) {
          continue;
        }

        neighbors.forEach(({ neighbor, connectionId }) => {
          highlightedEdges.add(connectionId);
          if (!visitedDevices.has(neighbor)) {
            visitedDevices.add(neighbor);
            queue.push(neighbor);
          }
        });
      }

      setHighlightedDevices(visitedDevices);
      setHighlightedConnections(highlightedEdges);

      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
      highlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedDevices(new Set());
        setHighlightedConnections(new Set());
        highlightTimeoutRef.current = null;
      }, AUDIO_HIGHLIGHT_DURATION_MS);

      window.setTimeout(() => {
        oscillator.stop();
        oscillator.disconnect();
        activeOscillators.current.delete(instanceId);
      }, TEST_SOUND_DURATION_MS);
    },
    [audioGraph, canPlayTestSound]
  );

  useEffect(() => {
    const context = audioContextRef.current;
    const oscillators = activeOscillators.current;
    return () => {
      oscillators.forEach((oscillator) => {
        oscillator.stop();
        oscillator.disconnect();
      });
      oscillators.clear();
      activeOscillators.current = new Map();
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
      if (context && context.state !== 'closed') {
        context.close().catch(() => undefined);
      }
    };
  }, []);

  const screenToWorkspace = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const workspace = workspaceRef.current;
      if (!workspace) {
        return null;
      }
      const rect = workspace.getBoundingClientRect();
      return {
        x: (clientX - rect.left - workspacePan.x) / workspaceZoom,
        y: (clientY - rect.top - workspacePan.y) / workspaceZoom
      };
    },
    [workspacePan.x, workspacePan.y, workspaceZoom]
  );

  const clampPan = useCallback(
    (candidate: { x: number; y: number }, zoomValue: number) => {
      const workspace = workspaceRef.current;
      if (!workspace) {
        return candidate;
      }
      const rect = workspace.getBoundingClientRect();
      const viewportWidth = rect.width;
      const viewportHeight = rect.height;

      const contentWidth = VIRTUAL_CANVAS_WIDTH * zoomValue;
      const contentHeight = VIRTUAL_CANVAS_HEIGHT * zoomValue;

      const maxX = CANVAS_PADDING * zoomValue;
      const minX = viewportWidth - contentWidth - CANVAS_PADDING * zoomValue;
      const maxY = CANVAS_PADDING * zoomValue;
      const minY = viewportHeight - contentHeight - CANVAS_PADDING * zoomValue;

      return {
        x: Math.min(maxX, Math.max(minX, candidate.x)),
        y: Math.min(maxY, Math.max(minY, candidate.y))
      };
    },
    []
  );

  const commitPan = useCallback(
    (candidate: { x: number; y: number }, zoomValue?: number) => {
      setWorkspacePan(clampPan(candidate, zoomValue ?? workspaceZoom));
    },
    [clampPan, workspaceZoom]
  );

  const applyZoom = useCallback(
    (nextZoomRaw: number, anchor?: { clientX: number; clientY: number }) => {
      const targetZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nextZoomRaw));
      if (targetZoom === workspaceZoom) {
        return;
      }

      const workspace = workspaceRef.current;
      if (!workspace) {
        setWorkspaceZoom(targetZoom);
        return;
      }

      const rect = workspace.getBoundingClientRect();
      const clientX = anchor?.clientX ?? rect.left + rect.width / 2;
      const clientY = anchor?.clientY ?? rect.top + rect.height / 2;

      const workspacePoint = {
        x: (clientX - rect.left - workspacePan.x) / workspaceZoom,
        y: (clientY - rect.top - workspacePan.y) / workspaceZoom
      };

      setWorkspaceZoom(targetZoom);
      const candidatePan = {
        x: clientX - rect.left - workspacePoint.x * targetZoom,
        y: clientY - rect.top - workspacePoint.y * targetZoom
      };
      commitPan(candidatePan, targetZoom);
    },
    [commitPan, workspacePan.x, workspacePan.y, workspaceZoom]
  );

  const nudgePan = useCallback(
    (deltaX: number, deltaY: number) => {
      commitPan({ x: workspacePan.x + deltaX, y: workspacePan.y + deltaY });
    },
    [commitPan, workspacePan.x, workspacePan.y]
  );

  const zoomIn = useCallback(() => {
    applyZoom(workspaceZoom + ZOOM_STEP);
  }, [applyZoom, workspaceZoom]);

  const zoomOut = useCallback(() => {
    applyZoom(workspaceZoom - ZOOM_STEP);
  }, [applyZoom, workspaceZoom]);

  const resetView = useCallback(() => {
    setWorkspaceZoom(1);
    commitPan({ x: 0, y: 0 }, 1);
  }, [commitPan]);

  const handleCanvasWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!workspaceRef.current) {
      return;
    }

    event.preventDefault();

    if (event.ctrlKey || event.metaKey) {
      const zoomFactor = Math.exp(-event.deltaY * 0.0015);
      applyZoom(workspaceZoom * zoomFactor, {
        clientX: event.clientX,
        clientY: event.clientY
      });
      return;
    }

    commitPan({
      x: workspacePan.x - event.deltaX,
      y: workspacePan.y - event.deltaY
    });
  };

  const panStateRef = useRef({
    active: false,
    pointerId: -1,
    origin: { x: 0, y: 0 },
    start: { x: 0, y: 0 }
  });

  const beginPan = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      panStateRef.current = {
        active: true,
        pointerId: event.pointerId,
        origin: { ...workspacePan },
        start: { x: event.clientX, y: event.clientY }
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [workspacePan]
  );

  const handleCanvasPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const isBackgroundTarget = event.target === event.currentTarget;
      const shouldStartPan = event.button === 1 || event.button === 2 || event.altKey;

      if (isBackgroundTarget && shouldStartPan) {
        event.preventDefault();
        beginPan(event);
      }
    },
    [beginPan]
  );

  const handleCanvasPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = panStateRef.current;
      if (!state.active || state.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - state.start.x;
      const deltaY = event.clientY - state.start.y;

      commitPan({
        x: state.origin.x + deltaX,
        y: state.origin.y + deltaY
      });
    },
    [commitPan]
  );

  const stopPan = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = panStateRef.current;
    if (!state.active || state.pointerId !== event.pointerId) {
      return;
    }
    panStateRef.current = {
      active: false,
      pointerId: -1,
      origin: { x: 0, y: 0 },
      start: { x: 0, y: 0 }
    };
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const clampWithinCanvas = (candidate: { x: number; y: number }): { x: number; y: number } => {
    const minX = CANVAS_PADDING;
    const minY = CANVAS_PADDING;
    const maxX = Math.max(minX, VIRTUAL_CANVAS_WIDTH - CARD_WIDTH - CANVAS_PADDING);
    const maxY = Math.max(minY, VIRTUAL_CANVAS_HEIGHT - CARD_HEIGHT - CANVAS_PADDING);

    return {
      x: Math.min(Math.max(candidate.x, minX), maxX),
      y: Math.min(Math.max(candidate.y, minY), maxY)
    };
  };

  // Adds a device instance to the canvas with either drop coordinates or a spaced fallback layout.
  const addDeviceToWorkspace = (device: Device, position?: { x: number; y: number }) => {
    setWorkspaceDevices((prev: WorkspaceDevice[]) => {
      const nextIndex = prev.length;
      const canvasWidth = workspaceRef.current?.clientWidth ?? MAX_GRID_COLUMNS * GRID_COLUMN_SPACING;
      const estimatedColumns = Math.max(1, Math.floor(canvasWidth / GRID_COLUMN_SPACING));
      const columns = Math.min(MAX_GRID_COLUMNS, estimatedColumns);
      const candidatePosition = position ?? computeFallbackPosition(nextIndex, columns);
      const resolvedPosition = clampWithinCanvas(candidatePosition);

      const instance: WorkspaceDevice = {
        instanceId: `${device.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        device,
        position: resolvedPosition
      };

      return [...prev, instance];
    });
  };

  const handleWorkspaceDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleWorkspaceDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const deviceId = event.dataTransfer.getData('application/connect-my-gear-device');
    if (!deviceId) {
      return;
    }
    const device = libraryDevices.find((item) => item.id === deviceId);
    if (!device) {
      return;
    }

    const workspacePoint = screenToWorkspace(event.clientX, event.clientY);
    const fallbackPosition = clampWithinCanvas({
      x: CANVAS_PADDING,
      y: CANVAS_PADDING
    });

    const candidatePosition = workspacePoint
      ? {
          x: workspacePoint.x - CARD_WIDTH / 2,
          y: workspacePoint.y - CARD_HEIGHT / 2
        }
      : fallbackPosition;

    addDeviceToWorkspace(device, clampWithinCanvas(candidatePosition));
  };

  // Handles the two-click gesture to build a connection between ports.
  const handlePortSelection = (
    instanceId: string,
    device: Device,
    port: Port
  ) => {
    const portReference: PortReference = {
      instanceId,
      deviceId: device.id,
      deviceName: device.name,
      portId: port.id,
      portLabel: port.label
    };

    if (!selectedPort) {
      setSelectedPort(portReference);
      return;
    }

    if (selectedPort.instanceId === instanceId && selectedPort.portId === port.id) {
      setSelectedPort(null);
      return;
    }

    const connectionId = `${selectedPort.instanceId}-${selectedPort.portId}::${instanceId}-${port.id}`;

    const alreadyConnected = connections.some(
      (connection: Connection) =>
        (connection.from.instanceId === selectedPort.instanceId &&
          connection.from.portId === selectedPort.portId &&
          connection.to.instanceId === instanceId &&
          connection.to.portId === port.id) ||
        (connection.to.instanceId === selectedPort.instanceId &&
          connection.to.portId === selectedPort.portId &&
          connection.from.instanceId === instanceId &&
          connection.from.portId === port.id)
    );

    if (alreadyConnected) {
      setSelectedPort(null);
      return;
    }

    const newConnection: Connection = {
      id: connectionId,
      from: selectedPort,
      to: portReference,
      status: 'pending'
    };

    setConnections((prev: Connection[]) => [...prev, newConnection]);
    setSelectedPort(null);
  };

  const handleToggleClockMaster = useCallback((instanceId: string) => {
    setWorkspaceDevices((prev: WorkspaceDevice[]) => {
      const target = prev.find((item) => item.instanceId === instanceId);
      if (!target) {
        return prev;
      }

      if (!deviceSupportsClockMaster(target.device)) {
        return prev;
      }

      const nextIsMaster = !target.isClockMaster;

      return prev.map((item) => {
        if (item.instanceId === instanceId) {
          return { ...item, isClockMaster: nextIsMaster };
        }
        if (nextIsMaster && item.isClockMaster) {
          return { ...item, isClockMaster: false };
        }
        return item;
      });
    });
  }, []);

  const isSameConnection = (a: Connection, b: Connection) => {
    const directMatch =
      a.from.instanceId === b.from.instanceId &&
      a.from.portId === b.from.portId &&
      a.to.instanceId === b.to.instanceId &&
      a.to.portId === b.to.portId;

    const reverseMatch =
      a.from.instanceId === b.to.instanceId &&
      a.from.portId === b.to.portId &&
      a.to.instanceId === b.from.instanceId &&
      a.to.portId === b.from.portId;

    return directMatch || reverseMatch;
  };

  const handleReassignConnection = (
    connectionId: string,
    end: 'from' | 'to',
    port: PortReference
  ) => {
    setConnections((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === connectionId);
      if (existingIndex === -1) {
        return prev;
      }

      const existing = prev[existingIndex];
      const updated: Connection = {
        ...existing,
        [end]: port
      };

      const newId = `${updated.from.instanceId}-${updated.from.portId}::${updated.to.instanceId}-${updated.to.portId}`;
      updated.id = newId;

      const hasDuplicate = prev.some((connection, index) => {
        if (index === existingIndex) {
          return false;
        }
        return isSameConnection(connection, updated);
      });

      if (hasDuplicate) {
        return prev;
      }

      const next = [...prev];
      next[existingIndex] = updated;
      return next;
    });
  };

  const handleRemoveConnection = useCallback((connectionId: string) => {
    setConnections((prev) => prev.filter((connection) => connection.id !== connectionId));
  }, []);

  const handleRemoveDevice = (instanceId: string) => {
    setWorkspaceDevices((prev: WorkspaceDevice[]) =>
      prev.filter((item) => item.instanceId !== instanceId)
    );
    setConnections((prev: Connection[]) =>
      prev.filter(
        (connection: Connection) =>
          connection.from.instanceId !== instanceId && connection.to.instanceId !== instanceId
      )
    );

    if (selectedPort?.instanceId === instanceId) {
      setSelectedPort(null);
    }

    setHighlightedDevices(new Set());
    setHighlightedConnections(new Set());
    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
  };

  const positionedPorts = useMemo(() => {
    return workspaceDevices.flatMap((instance) => {
      const positionsForInstance = portPositions[instance.instanceId];
      if (!positionsForInstance) {
        return [];
      }
      return instance.device.ports
        .filter((port) => Boolean(positionsForInstance[port.id]))
        .map((port) => ({
          instanceId: instance.instanceId,
          deviceId: instance.device.id,
          deviceName: instance.device.name,
          portId: port.id,
          portLabel: port.label,
          direction: port.direction,
          position: positionsForInstance[port.id]!,
          signals: port.signals
        }));
    });
  }, [portPositions, workspaceDevices]);

  const handleSaveCustomDevice = useCallback((device: Device) => {
    setCustomDevices((prev) => [...prev, device]);
  }, []);

  return (
    <div className="app-shell">
      {isDeviceCreatorOpen ? (
        <CustomDeviceModal
          onClose={() => setDeviceCreatorOpen(false)}
          onSave={handleSaveCustomDevice}
          existingDeviceIds={existingDeviceIds}
        />
      ) : null}
      <header className="app-shell__header">
        <h1>Connect My Gear</h1>
        <p>Drag gear into the workspace, connect ports, and review the suggested wiring workflow.</p>
      </header>

      <main className="app-shell__main">
        <section className="device-library" aria-label="Device library">
          <h2>Device Library</h2>
          <div className="device-library__actions">
            <button
              type="button"
              className="device-library__create"
              onClick={() => setDeviceCreatorOpen(true)}
            >
              Create custom device
            </button>
          </div>
          <div className="device-library__selector">
            <label htmlFor="device-library-select">Device</label>
            <select
              id="device-library-select"
              className="device-library__select"
              value={selectedLibraryDeviceId}
              onChange={(event) => setSelectedLibraryDeviceId(event.target.value)}
            >
              {groupedLibraryDevices.map(([category, devices]) => (
                <optgroup key={category} label={category}>
                  {devices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              type="button"
              className="device-library__add"
              onClick={() => {
                if (selectedLibraryDevice) {
                  addDeviceToWorkspace(selectedLibraryDevice);
                }
              }}
              disabled={!selectedLibraryDevice}
            >
              Add to workspace
            </button>
          </div>
          {selectedLibraryDevice ? (
            <div className="device-library__preview">
              <DeviceCard device={selectedLibraryDevice} variant="library" draggable={false} />
            </div>
          ) : null}
        </section>

        <div className="workspace-area">
          <WorkflowPanel
            inference={inference}
            recommendations={workspaceRecommendations}
            onRemoveConnection={handleRemoveConnection}
          />

          <section className="workspace" aria-label="Workspace">
            <div
              ref={workspaceRef}
              className="workspace__canvas"
              onDrop={handleWorkspaceDrop}
              onDragOver={handleWorkspaceDragOver}
              onWheel={handleCanvasWheel}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={stopPan}
              onPointerCancel={stopPan}
            >
              <div className="workspace__controls" aria-label="Workspace view controls">
                <div className="workspace__controls-row">
                  <button
                    type="button"
                    className="workspace__control-btn"
                    onClick={zoomIn}
                    aria-label="Zoom in"
                  >
                    +
                  </button>
                  <span className="workspace__zoom-display">{Math.round(workspaceZoom * 100)}%</span>
                  <button
                    type="button"
                    className="workspace__control-btn"
                    onClick={zoomOut}
                    aria-label="Zoom out"
                  >
                    -
                  </button>
                </div>
                <div className="workspace__controls-grid" role="group" aria-label="Pan controls">
                  <span aria-hidden="true" />
                  <button
                    type="button"
                    className="workspace__control-btn"
                    onClick={() => nudgePan(0, PAN_STEP)}
                    aria-label="Pan up"
                  >
                    Up
                  </button>
                  <span aria-hidden="true" />
                  <button
                    type="button"
                    className="workspace__control-btn"
                    onClick={() => nudgePan(PAN_STEP, 0)}
                    aria-label="Pan left"
                  >
                    Left
                  </button>
                  <span className="workspace__controls-grid-center" aria-hidden="true">
                    Pan
                  </span>
                  <button
                    type="button"
                    className="workspace__control-btn"
                    onClick={() => nudgePan(-PAN_STEP, 0)}
                    aria-label="Pan right"
                  >
                    Right
                  </button>
                  <span aria-hidden="true" />
                  <button
                    type="button"
                    className="workspace__control-btn"
                    onClick={() => nudgePan(0, -PAN_STEP)}
                    aria-label="Pan down"
                  >
                    Down
                  </button>
                  <span aria-hidden="true" />
                </div>
                <button
                  type="button"
                  className="workspace__control-btn workspace__control-btn--wide"
                  onClick={resetView}
                >
                  Reset view
                </button>
              </div>
              <div
                className="workspace__content"
                style={{
                  width: `${VIRTUAL_CANVAS_WIDTH}px`,
                  height: `${VIRTUAL_CANVAS_HEIGHT}px`,
                  transform: `translate(${workspacePan.x}px, ${workspacePan.y}px) scale(${workspaceZoom})`
                }}
              >
                <CableLayer
                  connections={connections}
                  portPositions={portPositions}
                  workspaceSize={workspaceSize}
                  ports={positionedPorts}
                  screenToWorkspace={screenToWorkspace}
                  onReassignConnection={handleReassignConnection}
                  highlightedConnections={highlightedConnections}
                />
                {workspaceDevices.length === 0 ? (
                  <p className="workspace__hint">Drag devices here to begin building your setup.</p>
                ) : null}
                {workspaceDevices.map((instance: WorkspaceDevice, index) => (
                  <DraggableDevice
                    key={instance.instanceId}
                    instance={instance}
                    zIndex={index + 1}
                    onPortClick={handlePortSelection}
                    selectedPort={selectedPort}
                    onRemove={handleRemoveDevice}
                    updatePosition={(newPos: { x: number; y: number }) => {
                      setWorkspaceDevices((prev) =>
                        prev.map((dev) =>
                          dev.instanceId === instance.instanceId
                            ? { ...dev, position: clampWithinCanvas(newPos) }
                            : dev
                        )
                      );
                    }}
                    workspaceRef={workspaceRef}
                    zoom={workspaceZoom}
                    pan={workspacePan}
                    onPortPositionChange={updatePortPosition}
                    onTestSound={handleTestSound}
                    testSoundAvailable={canPlayTestSound(instance.instanceId)}
                    onToggleClockMaster={handleToggleClockMaster}
                    canBeClockMaster={deviceSupportsClockMaster(instance.device)}
                    isHighlighted={highlightedDevices.has(instance.instanceId)}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default App;
