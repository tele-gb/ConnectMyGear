Instruction to Copilot:

Generate a React + TypeScript web app called Connect My Gear.
The app helps users visualize and connect music gear (synths, drum machines, audio interfaces) and shows required cables, adapters, and warnings.

The focus is interactive, responsive UI with a modern look. Include a clean project structure, type-safe models, and placeholder components for wiring visualization.

Project Requirements:

Project Structure:

connect-my-gear/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── DeviceCard.tsx      # Displays a device and its ports
│   │   ├── PortIcon.tsx        # Shows a port type (MIDI, Audio, USB)
│   │   ├── WiringGraph.tsx     # Visualizes connections
│   │   └── WorkflowPanel.tsx   # Shows inferred workflows and warnings
│   ├── models/
│   │   ├── Device.ts           # Device class with ports
│   │   └── Port.ts             # Port class with type, direction, signals
│   ├── data/
│   │   └── devices.json        # Example devices (Digitakt, Circuit, MU50, Volca)
│   ├── utils/
│   │   └── inference.ts        # Logic to calculate connections, cables, warnings
│   ├── App.tsx                 # Main app container
│   ├── index.tsx               # React entry point
│   └── styles.css              # Global styles
├── package.json
└── tsconfig.json


Data Model:

Device has id, name, ports: Port[]

Port has id, direction (in/out/in_out), connector (din_5, trs_3.5mm, ts_6.35mm, usb_c, etc.), signals (audio, midi, sync, usb_audio, usb_midi), optional notes

Include example devices in devices.json

UI Requirements:

Users can drag devices into a workspace

Ports display as icons with signal type

User can draw connections (click or drag from port to port)

Connections trigger inference logic to show:

Valid/invalid connections

Required cables / adapters

Warnings (e.g., incompatible clock, TRS MIDI type mismatch)

WorkflowPanel displays textual summary of suggested wiring

Coding Notes:

Use TypeScript and React functional components

Add placeholder SVG/Canvas in WiringGraph.tsx for connections

Inference logic should be stubbed but clearly typed

Include basic responsive CSS, mobile-friendly layout

Comment code where logic is non-trivial

Output:

Working skeleton React app with example devices loaded

Components are modular and ready for wiring visualization and inference logic

Include README with project overview, running instructions, and future steps