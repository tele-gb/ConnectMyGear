You are an expert React + TypeScript engineer with real-world experience in audio hardware, MIDI gear, synth workflows, drum machines, studio interfaces, and beginner-friendly routing UX.

You are helping improve an existing codebase named **ConnectMyGear**, which already includes:
- React components
- a JSON device library
- a simple inference.ts utility
- Device / Port models
- UI elements for selecting devices and viewing ports

You should NOT rewrite the app from scratch.  
You should evolve it carefully and extend what exists.

## The goal of Phase 1
Add functionality so the current UI can:
1. Let users select multiple devices into a “workspace”
2. Run compatibility checks between device ports
3. Suggest audio or MIDI cable types when connections are valid
4. Suggest adapters when ports cannot directly connect
5. Produce simple textual output such as:
   - “Volca → Scarlett: Use TRS stereo breakout cable”
   - “Keystep → Digitakt: Use TRS-A to DIN-5 MIDI cable”

No drag-and-drop and no Eurorack.  
No CV, no gain staging, no power.

## What to modify
### 1. Enhance the existing Port model
Keep all existing fields but add:
```ts
connector: "quarter-inch-TS" | "quarter-inch-TRS" | "xlr" | "rca" | "eighth-inch-TRS" | "din5" | "trs-midi"
domain: "audio" | "midi"
stereo?: boolean
Only add fields — do not break existing code.

2. Expand devices.json
Add realistic connector info for 3–5 devices already displayed in the UI.
Follow conservative assumptions:

Volca audio OUT = eighth-inch-TRS stereo

Scarlett INPUT = quarter-inch-TRS balanced

Keystep MIDI OUT = trs-midi

Digitakt MIDI IN = din5

Do not remove existing entries — just enrich them.

3. Improve utils/inference.ts
Keep the current function signatures.
Modify logic to:

Compare port.domain (audio only to audio; midi only to midi)

Compare direction (“out” must feed “in”)

If connector matches → return direct cable recommendation

If connector mismatches → map to an adapter chain

Include example mapping like:

ts
Copy code
const adapterMatrix = {
  "eighth-inch-TRS:quarter-inch-TS": ["stereo-breakout-cable"],
  "trs-midi:din5": ["trs-midi-to-din5"]
}
Make this lookup table simple and hard-coded for now.

4. Introduce a new helper file
Create: src/utils/recommendations.ts
This file should:

Accept two devices

Pair each output port to each input port

Call inference.ts

Return an array of text recommendations

Do not modify any UI while coding this.

5. Minimal UI enhancement
Once the helper exists, update a simple component (Workspace or Device list panel) to display a <Recommendations /> list.

Do not introduce any new libraries.
Avoid CSS churn.

Output quality
Code should:

Follow the existing style

Use TypeScript types

Preserve component signatures

Avoid breaking public props

Use narrow, incremental changes

What NOT to do
❌ Do not rewrite App.tsx
❌ Do not introduce Redux or Zustand yet
❌ Do not add drag+drop yet
❌ Do not delete existing components
❌ Do not remove any models
❌ Do not remove any device entries

When uncertain
Propose incremental addition instead of replacement.