import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const devicesPath = path.join(repoRoot, 'src', 'data', 'devices.json');

const PHYSICAL_CONNECTOR_MAP = {
  'quarter-inch-TS': '6.35mm-ts',
  'quarter-inch-TRS': '6.35mm-trs',
  'eighth-inch-TRS': '3.5mm-trs'
};

function normalizePhysicalConnector(value) {
  if (typeof value !== 'string') {
    return value;
  }
  return PHYSICAL_CONNECTOR_MAP[value] ?? value;
}

function main() {
  const raw = fs.readFileSync(devicesPath, 'utf8');
  const devices = JSON.parse(raw);

  let changed = 0;

  for (const device of devices) {
    if (!device?.ports || !Array.isArray(device.ports)) {
      continue;
    }

    for (const port of device.ports) {
      if (!port || typeof port !== 'object') {
        continue;
      }

      if ('physicalConnector' in port) {
        const next = normalizePhysicalConnector(port.physicalConnector);
        if (next !== port.physicalConnector) {
          port.physicalConnector = next;
          changed += 1;
        }
      }
    }
  }

  if (changed === 0) {
    console.log('No physicalConnector values needed normalization.');
    return;
  }

  fs.writeFileSync(devicesPath, JSON.stringify(devices, null, 2) + '\n', 'utf8');
  console.log(`Normalized ${changed} physicalConnector value(s) in ${path.relative(repoRoot, devicesPath)}.`);
}

main();
