import type { Device } from '../models/Device';
import type {
  PhysicalConnector,
  Port,
  PortConnector,
  PortDomain,
  PortSignal
} from '../models/Port';

export interface PortReference {
  instanceId: string;
  deviceId: string;
  portId: string;
  deviceName?: string;
  portLabel?: string;
}

export type ConnectionStatus = 'pending' | 'valid' | 'invalid';

export interface Connection {
  id: string;
  from: PortReference;
  to: PortReference;
  status: ConnectionStatus;
  issues?: string[];
}

export interface CableSuggestion {
  id: string;
  description: string;
  connector: PortConnector;
  ports: [PortReference, PortReference];
  requiresAdapter?: string;
  adapters?: string[];
}

export interface InferenceResult {
  connections: Connection[];
  warnings: string[];
  requiredCables: CableSuggestion[];
  summaries: string[];
}

export interface DeviceInstance {
  instanceId: string;
  device: Device;
}

const LEGACY_CONNECTOR_MAP: Record<PortConnector, PhysicalConnector | undefined> = {
  din_5: 'din5',
  'trs_3.5mm': '3.5mm-trs',
  'ts_6.35mm': '6.35mm-ts',
  'trs_6.35mm': '6.35mm-trs',
  'combo_xlr_trs': '6.35mm-trs',
  xlr: 'xlr',
  rca: 'rca' as PhysicalConnector,
  '6.35mm-ts': '6.35mm-ts' as PhysicalConnector,
  '6.35mm-trs': '6.35mm-trs' as PhysicalConnector,
  '3.5mm-trs': '3.5mm-trs' as PhysicalConnector,
  din5: 'din5' as PhysicalConnector,
  'trs-midi': 'trs-midi' as PhysicalConnector,
  usb_c: undefined,
  usb_b: undefined,
  usb_a: undefined,
  sync_out: undefined,
  sync_in: undefined,
  cv_gate: undefined
};

const ADAPTER_MATRIX: Record<string, string[]> = {
  '3.5mm-trs:6.35mm-trs': ['stereo-breakout-cable'],
  '3.5mm-trs:6.35mm-ts': ['stereo-breakout-cable'],
  'trs-midi:din5': ['trs-midi-to-din5']
};

const ADAPTER_LABELS: Record<string, string> = {
  'stereo-breakout-cable': 'TRS stereo breakout cable',
  'trs-midi-to-din5': 'TRS-A to DIN-5 MIDI cable'
};

const PHYSICAL_CONNECTORS: PhysicalConnector[] = [
  '6.35mm-ts',
  '6.35mm-trs',
  'xlr',
  'rca',
  '3.5mm-trs',
  'din5',
  'trs-midi'
];

interface ConnectorCompatibility {
  compatible: boolean;
  resultingConnector?: PortConnector;
  adapterCodes?: string[];
}

function isPhysicalConnector(value: PortConnector): value is PhysicalConnector {
  return PHYSICAL_CONNECTORS.includes(value as PhysicalConnector);
}

function getPhysicalConnector(port: Port): PhysicalConnector | undefined {
  if (port.physicalConnector) {
    return port.physicalConnector;
  }

  if (isPhysicalConnector(port.connector)) {
    return port.connector;
  }

  return LEGACY_CONNECTOR_MAP[port.connector];
}

function getPortDomain(port: Port): PortDomain | undefined {
  if (port.domain) {
    return port.domain;
  }

  if (port.signals.includes('audio')) {
    return 'audio';
  }

  if (port.signals.includes('midi')) {
    return 'midi';
  }

  return undefined;
}

function getAudioWiring(port: Port): Port['audioWiring'] | undefined {
  if (!port.signals.includes('audio')) {
    return undefined;
  }
  return port.audioWiring;
}

function resolveAdapterChain(from: PhysicalConnector, to: PhysicalConnector): string[] | undefined {
  const forward = ADAPTER_MATRIX[`${from}:${to}`];
  if (forward) {
    return forward;
  }
  const reverse = ADAPTER_MATRIX[`${to}:${from}`];
  if (reverse) {
    return reverse;
  }
  return undefined;
}

function getConnectorCompatibility(fromPort: Port, toPort: Port): ConnectorCompatibility {
  const fromPhysical = getPhysicalConnector(fromPort);
  const toPhysical = getPhysicalConnector(toPort);

  if (fromPhysical && toPhysical) {
    if (fromPhysical === toPhysical) {
      return { compatible: true, resultingConnector: fromPhysical };
    }

    const adapterCodes = resolveAdapterChain(fromPhysical, toPhysical);
    if (adapterCodes) {
      return { compatible: true, resultingConnector: toPhysical, adapterCodes };
    }

    const sixPointThreeFivePairs = new Set<PhysicalConnector>(['6.35mm-ts', '6.35mm-trs']);
    if (sixPointThreeFivePairs.has(fromPhysical) && sixPointThreeFivePairs.has(toPhysical)) {
      return { compatible: true, resultingConnector: '6.35mm-ts' };
    }
  }

  if (fromPort.connector === toPort.connector) {
    return { compatible: true, resultingConnector: fromPort.connector };
  }

  if (
    (fromPort.connector === 'combo_xlr_trs' && toPort.connector === 'trs_6.35mm') ||
    (toPort.connector === 'combo_xlr_trs' && fromPort.connector === 'trs_6.35mm')
  ) {
    return { compatible: true, resultingConnector: '6.35mm-trs' };
  }

  if (
    (fromPort.connector === 'combo_xlr_trs' && toPort.connector === 'ts_6.35mm') ||
    (toPort.connector === 'combo_xlr_trs' && fromPort.connector === 'ts_6.35mm')
  ) {
    return { compatible: true, resultingConnector: '6.35mm-ts' };
  }

  return { compatible: false };
}

function describeAdapterCode(code: string): string {
  return ADAPTER_LABELS[code] ?? code;
}

function formatAdapterChain(codes: string[]): string {
  if (codes.length === 0) {
    return '';
  }
  if (codes.length === 1) {
    return describeAdapterCode(codes[0]);
  }
  return codes.map(describeAdapterCode).join(' + ');
}

export interface InferenceOptions {
  clockMasterIds?: Set<string>;
}

export function inferConnections(
  deviceInstances: DeviceInstance[],
  connections: Connection[],
  options: InferenceOptions = {}
): InferenceResult {
  const deviceMap = new Map<string, Device>(
    deviceInstances.map((instance) => [instance.instanceId, instance.device])
  );

  const updatedConnections: Connection[] = [];
  const warnings: Set<string> = new Set();
  const requiredCables: CableSuggestion[] = [];
  const summaries: string[] = [];

  const monitorInstances = new Set<string>();
  const audioCapableInstances = new Set<string>();
  const midiCapableInstances = new Set<string>();

  deviceInstances.forEach((instance) => {
    if (isMonitorDevice(instance.device)) {
      monitorInstances.add(instance.instanceId);
    }
    const hasAudioOutput = instance.device.ports.some(
      (port) => (port.direction === 'out' || port.direction === 'in_out') && port.signals.includes('audio')
    );
    if (hasAudioOutput) {
      audioCapableInstances.add(instance.instanceId);
    }

    const hasMidi = instance.device.ports.some((port) => port.signals.includes('midi') || port.signals.includes('usb_midi'));
    if (hasMidi) {
      midiCapableInstances.add(instance.instanceId);
    }
  });

  const midiChainInstances = new Set<string>();
  const audioLinkedInstances = new Set<string>();
  const audioToMonitorInstances = new Set<string>();

  connections.forEach((connection) => {
    const fromDevice = deviceMap.get(connection.from.instanceId);
    const toDevice = deviceMap.get(connection.to.instanceId);

    const blockingIssues: string[] = [];
    const advisoryMessages: string[] = [];

    if (!fromDevice) {
      blockingIssues.push('Source device is no longer available.');
    }

    if (!toDevice) {
      blockingIssues.push('Destination device is no longer available.');
    }

    const fromPort = fromDevice?.ports.find((port) => port.id === connection.from.portId);
    const toPort = toDevice?.ports.find((port) => port.id === connection.to.portId);

    if (!fromPort) {
      blockingIssues.push('Source port not found on device.');
    }

    if (!toPort) {
      blockingIssues.push('Destination port not found on device.');
    }

    if (fromPort && fromPort.direction === 'in') {
      blockingIssues.push(`${fromPort.label} cannot send signals (input-only).`);
    }

    if (toPort && toPort.direction === 'out') {
      blockingIssues.push(`${toPort.label} cannot receive signals (output-only).`);
    }

    if (fromPort && toPort) {
      const fromDomain = getPortDomain(fromPort);
      const toDomain = getPortDomain(toPort);

      if (fromDomain && toDomain && fromDomain !== toDomain) {
        blockingIssues.push(
          `${fromPort.label} (${fromDomain.toUpperCase()}) cannot connect to ${toPort.label} (${toDomain.toUpperCase()}).`
        );
      }

      const signalOverlap = intersection(fromPort.signals, toPort.signals);
      const signalsUsed = new Set<PortSignal>(signalOverlap);

      const connectorCompatibility = getConnectorCompatibility(fromPort, toPort);

      if (signalOverlap.length === 0) {
        blockingIssues.push(
          `${fromPort.label} (${formatSignals(fromPort.signals)}) does not share signals with ${toPort.label} (${formatSignals(
            toPort.signals
          )}).`
        );
      }

      if (!connectorCompatibility.compatible) {
        blockingIssues.push(
          `${fromPort.label} (${describeConnector(fromPort.connector)}) is not compatible with ${toPort.label} (${describeConnector(
            toPort.connector
          )}).`
        );
      }

      const isValidConnection =
        signalOverlap.length > 0 && connectorCompatibility.compatible && blockingIssues.length === 0;

      if (isValidConnection) {
        const cableConnector = connectorCompatibility.resultingConnector ?? fromPort.connector;
        const adapterDescription = connectorCompatibility.adapterCodes?.length
          ? formatAdapterChain(connectorCompatibility.adapterCodes)
          : undefined;
        const cableSuggestion: CableSuggestion = {
          id: `${connection.id}-cable`,
          description: adapterDescription ?? buildCableDescription(cableConnector, signalOverlap),
          connector: cableConnector,
          ports: [connection.from, connection.to],
          adapters: connectorCompatibility.adapterCodes
        };

        if (adapterDescription) {
          const adapterMessage = `Use ${adapterDescription}`;
          cableSuggestion.requiresAdapter = adapterMessage;
          warnings.add(adapterMessage);
          advisoryMessages.push(adapterMessage);
        }

        requiredCables.push(cableSuggestion);

        const fromAudioWiring = getAudioWiring(fromPort);
        const toAudioWiring = getAudioWiring(toPort);

        if (fromAudioWiring && toAudioWiring) {
          const wiringPair = new Set([fromAudioWiring, toAudioWiring]);

          if (wiringPair.has('balanced_mono') && wiringPair.has('unbalanced_mono')) {
            advisoryMessages.push(
              'Balanced/unbalanced audio mismatch: connection will work but becomes unbalanced (possible noise/level change).'
            );
          }

          if (
            wiringPair.has('unbalanced_stereo') &&
            (wiringPair.has('balanced_mono') || wiringPair.has('unbalanced_mono'))
          ) {
            advisoryMessages.push(
              'Stereo-to-mono audio mismatch: one channel may be lost, or the mono result may sound wrong.'
            );
          }
        }

        const fromDeviceLabel =
          connection.from.deviceName ?? fromDevice?.name ?? connection.from.deviceId;
        const toDeviceLabel = connection.to.deviceName ?? toDevice?.name ?? connection.to.deviceId;

        const summaryLabel = adapterDescription ?? cableSuggestion.description;
        const formattedSummaryLabel = summaryLabel.endsWith('.') ? summaryLabel : `${summaryLabel}.`;
        summaries.push(`${fromDeviceLabel} → ${toDeviceLabel}: Use ${formattedSummaryLabel}`);
      }

      if (isValidConnection) {
        if (signalsUsed.has('midi')) {
          midiChainInstances.add(connection.from.instanceId);
          midiChainInstances.add(connection.to.instanceId);
        }

        if (signalsUsed.has('audio')) {
          if (fromPort.direction !== 'in') {
            audioLinkedInstances.add(connection.from.instanceId);
          }
          if (toPort.direction !== 'out') {
            audioLinkedInstances.add(connection.to.instanceId);
          }

          if (monitorInstances.has(connection.to.instanceId)) {
            audioToMonitorInstances.add(connection.from.instanceId);
          }
          if (monitorInstances.has(connection.from.instanceId)) {
            audioToMonitorInstances.add(connection.to.instanceId);
          }
        }
      }
    }

    const combinedIssues = [...blockingIssues, ...advisoryMessages];
    combinedIssues.forEach((issue) => warnings.add(issue));

    let status: ConnectionStatus = 'valid';
    if (blockingIssues.length > 0) {
      status = 'invalid';
    } else if (advisoryMessages.length > 0) {
      status = 'pending';
    }

    updatedConnections.push({
      ...connection,
      status,
      issues: combinedIssues.length ? combinedIssues : undefined
    });
  });

  if (midiChainInstances.size > 1) {
    const unroutedMidiAudio = Array.from(midiChainInstances).filter(
      (instanceId) =>
        audioCapableInstances.has(instanceId) && !audioLinkedInstances.has(instanceId) && !monitorInstances.has(instanceId)
    );

    if (unroutedMidiAudio.length > 0) {
      if (monitorInstances.size > 0 && audioToMonitorInstances.size <= 1 && audioCapableInstances.size > 1) {
        warnings.add(
          'Multiple MIDI-linked devices detected, but only one audio feed reaches monitors. Route additional outputs (e.g., into a mixer) so every device can be heard.'
        );
      }

      warnings.add(
        `Audio from ${formatDeviceList(unroutedMidiAudio, deviceMap)} is not routed to any destination. Connect these devices to a mixer, audio interface, or monitors.`
      );
    }
  }

  const midiMasters = options.clockMasterIds ?? new Set<string>();

  const unclockedMidiDevices = Array.from(midiCapableInstances).filter((instanceId) => !midiChainInstances.has(instanceId));
  unclockedMidiDevices.forEach((instanceId) => {
    const device = deviceMap.get(instanceId);
    if (device) {
      warnings.add(`${device.name} has MIDI ports but is not connected to the MIDI clock network.`);
    }
  });

  if (midiCapableInstances.size > 0 && midiMasters.size === 0) {
    warnings.add('Set a clock master so your MIDI devices stay in sync.');
  }

  if (midiMasters.size > 1) {
    warnings.add('Multiple MIDI clock masters selected. Choose only one master clock device.');
  }

  midiMasters.forEach((instanceId) => {
    if (!midiCapableInstances.has(instanceId)) {
      const device = deviceMap.get(instanceId);
      if (device) {
        warnings.add(`${device.name} is marked as clock master but has no MIDI clock outputs.`);
      }
      return;
    }
    if (!midiChainInstances.has(instanceId)) {
      const device = deviceMap.get(instanceId);
      if (device) {
        warnings.add(`${device.name} is the clock master but is not connected to any MIDI devices.`);
      }
    }
  });

  return {
    connections: updatedConnections,
    warnings: Array.from(warnings),
    requiredCables,
    summaries
  };
}

function intersection<T>(a: T[], b: T[]): T[] {
  return a.filter((item) => b.includes(item));
}

function buildCableDescription(connector: PortConnector, signals: PortSignal[]): string {
  const signalLabel =
    signals.length === 1
      ? describeSignal(signals[0])
      : `${signals.slice(0, -1).map(describeSignal).join(', ')} and ${describeSignal(
          signals[signals.length - 1]
        )}`;

  return `${signalLabel} ${describeConnector(connector)} cable`;
}

function describeConnector(connector: PortConnector): string {
  switch (connector) {
    case 'din_5':
      return '5-pin DIN MIDI';
    case 'din5':
      return 'DIN-5 MIDI';
    case 'trs_3.5mm':
      return '3.5 mm TRS';
    case '3.5mm-trs':
      return '3.5 mm TRS';
    case 'ts_6.35mm':
      return '6.35 mm TS';
    case '6.35mm-ts':
      return '6.35 mm TS';
    case 'trs_6.35mm':
      return '6.35 mm TRS';
    case '6.35mm-trs':
      return '6.35 mm TRS';
    case 'rca':
      return 'RCA';
    case 'usb_c':
      return 'USB-C';
    case 'usb_b':
      return 'USB-B';
    case 'usb_a':
      return 'USB-A';
    case 'xlr':
      return 'XLR';
    case 'combo_xlr_trs':
      return 'combo XLR/TRS';
    case 'trs-midi':
      return 'TRS MIDI';
    case 'sync_out':
      return 'sync pulse';
    case 'sync_in':
      return 'sync pulse';
    case 'cv_gate':
      return 'CV/Gate';
    default:
      return connector;
  }
}

function describeSignal(signal: PortSignal): string {
  switch (signal) {
    case 'audio':
      return 'audio';
    case 'midi':
      return 'MIDI';
    case 'sync':
      return 'clock';
    case 'usb_audio':
      return 'USB audio';
    case 'usb_midi':
      return 'USB MIDI';
    case 'cv':
      return 'CV';
    default:
      return signal;
  }
}

function formatSignals(signals: PortSignal[]): string {
  if (signals.length === 0) {
    return 'no signals';
  }
  if (signals.length === 1) {
    return describeSignal(signals[0]);
  }
  const initial = signals.slice(0, -1).map(describeSignal).join(', ');
  return `${initial} and ${describeSignal(signals[signals.length - 1])}`;
}

function isMonitorDevice(device: Device): boolean {
  if (device.tags?.some((tag) => tag.toLowerCase() === 'monitor')) {
    return true;
  }
  if (device.category && device.category.toLowerCase().includes('monitor')) {
    return true;
  }
  return false;
}

function formatDeviceList(instanceIds: string[], deviceLookup: Map<string, Device>): string {
  return instanceIds
    .map((instanceId) => deviceLookup.get(instanceId)?.name ?? instanceId)
    .join(', ');
}
