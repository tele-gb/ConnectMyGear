# Connect My Gear

Connect My Gear is a React + TypeScript prototype that helps musicians plan how to connect synths, drum machines, and audio interfaces. The app focuses on a clean, interactive workspace where users can place devices, review their ports, and sketch connection ideas while receiving cable suggestions and warnings.

## Getting Started

1. Install dependencies:
   ```powershell
   npm install
   ```
2. Start the development server:
   ```powershell
   npm run dev
   ```
3. Open the provided local URL to explore the app.

## Project Structure

```
connect-my-gear/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── DeviceCard.tsx
│   │   ├── PortIcon.tsx
│   │   ├── WiringGraph.tsx
│   │   └── WorkflowPanel.tsx
│   ├── data/
│   │   └── devices.json
│   ├── models/
│   │   ├── Device.ts
│   │   └── Port.ts
│   ├── utils/
│   │   └── inference.ts
│   ├── App.tsx
│   ├── index.tsx
│   └── styles.css
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## Key Features

- **Device Library**: Browse example gear (Digitakt, Circuit Tracks, Yamaha MU50, Volca Keys, Tascam Model 12, Tapco S5 monitors) and drag them into the workspace.
- **Workspace Canvas**: Arrange devices on a responsive grid background and preview placeholder connection lines.
- **Port Awareness**: Ports are grouped by input/output, labelled with connector type, and colour-coded by signal.
- **Connection Inference (Stubbed)**: Selecting two ports creates a connection that is evaluated for basic compatibility, emitting warnings and cable suggestions.
- **Connection Inference (Stubbed)**: Selecting two ports creates a connection that is evaluated for basic compatibility, emitting warnings for cabling plus monitor coverage (e.g. MIDI-only chains with no audio routed to monitors) and cable suggestions.
- **Workflow Panel**: Summarises current connections, required cables, warnings, and high-level workflow notes.

## Future Enhancements

- Persist device placements and connections.
- Support bidirectional USB audio routing and latency notes.
- Add drag handles for repositioning devices inside the workspace.
- Replace placeholder graph with a full wiring diagram editor (SVG or Canvas based).
- Expand inference logic to account for balanced vs. unbalanced audio, MIDI TRS standards, and power requirements.

## Scripts

- `npm run dev` – start the Vite dev server.
- `npm run build` – create a production build.
- `npm run preview` – serve the production build locally.
- `npm run lint` – run ESLint with TypeScript rules.
- `npm run deploy` – publish the latest build to the `gh-pages` branch (requires repo write access).

## Deployment

The project is configured to deploy to GitHub Pages using the `main` branch source and a GitHub Actions workflow located at [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

1. Push changes to `main`; the workflow installs dependencies, builds the site, and uploads the `dist` artifact.
2. A follow-up job publishes the artifact to the GitHub Pages environment. The published URL is surfaced in the workflow summary under `Deploy to GitHub Pages`.
3. To deploy manually, run `npm run deploy` locally. This uses the `gh-pages` package to push the `dist` folder to the `gh-pages` branch.

Before the first deployment, open the repository settings on GitHub and set **Pages → Build and deployment** to **GitHub Actions** so the workflow can publish successfully.

## License

This project is provided as an educational example. Adapt it to your needs.
