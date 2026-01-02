import type { Device } from '../models/Device';
import type { Port } from '../models/Port';
import {
  inferConnections,
  type Connection,
  type DeviceInstance
} from './inference';

const OUTPUT_DIRECTIONS = new Set<Port['direction']>(['out', 'in_out']);
const INPUT_DIRECTIONS = new Set<Port['direction']>(['in', 'in_out']);

function isOutput(port: Port): boolean {
  return OUTPUT_DIRECTIONS.has(port.direction);
}

function isInput(port: Port): boolean {
  return INPUT_DIRECTIONS.has(port.direction);
}

function buildConnections(
  source: Device,
  target: Device,
  sourceInstanceId: string,
  targetInstanceId: string
): Connection[] {
  const connections: Connection[] = [];

  source.ports.forEach((fromPort) => {
    if (!isOutput(fromPort)) {
      return;
    }

    target.ports.forEach((toPort) => {
      if (!isInput(toPort)) {
        return;
      }

      connections.push({
        id: `${sourceInstanceId}:${fromPort.id}->${targetInstanceId}:${toPort.id}`,
        from: {
          instanceId: sourceInstanceId,
          deviceId: source.id,
          portId: fromPort.id,
          deviceName: source.name,
          portLabel: fromPort.label
        },
        to: {
          instanceId: targetInstanceId,
          deviceId: target.id,
          portId: toPort.id,
          deviceName: target.name,
          portLabel: toPort.label
        },
        status: 'pending'
      });
    });
  });

  return connections;
}

// Scan both directions between two devices to suggest usable cable or adapter pairings.
export function recommendBetweenDevices(deviceA: Device, deviceB: Device): string[] {
  const instanceA: DeviceInstance = { instanceId: `device-${deviceA.id}`, device: deviceA };
  const instanceB: DeviceInstance = { instanceId: `device-${deviceB.id}`, device: deviceB };

  const connections: Connection[] = [
    ...buildConnections(deviceA, deviceB, instanceA.instanceId, instanceB.instanceId),
    ...buildConnections(deviceB, deviceA, instanceB.instanceId, instanceA.instanceId)
  ];

  if (connections.length === 0) {
    return [];
  }

  const inference = inferConnections([instanceA, instanceB], connections);
  const recommendations = new Set<string>();

  inference.requiredCables.forEach((cable) => {
    const [fromRef, toRef] = cable.ports;
    const fromLabel = fromRef.deviceName ?? fromRef.deviceId;
    const toLabel = toRef.deviceName ?? toRef.deviceId;
    recommendations.add(`${fromLabel} → ${toLabel}: Use ${cable.description}`);
  });

  if (!recommendations.size) {
    inference.summaries.forEach((summary) => {
      if (summary) {
        recommendations.add(summary);
      }
    });
  }

  return Array.from(recommendations).sort((a, b) => a.localeCompare(b));
}
