# Connector standard (draft)

This doc defines the *canonical* way this codebase represents connectors, and when the app should warn users about TS/TRS differences.

## Goals

- Stop mixing equivalent size labels (e.g. `1/4"` vs `6.35mm`).
- Treat TS/TRS as *usually physically compatible*.
- Warn users only when TS/TRS implies a meaningful electrical behavior change (balanced vs unbalanced, stereo vs mono).
- Avoid hardware shopping guidance (warnings only, no adapter recommendations unless strictly required for fit).

## Guiding principle

We separate:

1. **Mechanical compatibility**: does the plug physically fit the jack?
2. **Electrical intent**: does the wiring/signaling match what each side expects?

The app should default to allowing mechanical fits, and use *advisory warnings* when electrical intent is likely mismatched.

## Canonical representation

### A) Canonical connector (mechanical)

Use a canonical representation that does **not** rely on informal strings like `quarter-inch` or `1/4`.

For phone ("jack") connectors, the canonical attributes are:

- `family`: `phone`
- `sizeMm`: `6.35` | `3.5` | `2.5` (extend as needed)
- `contacts`: `2` | `3` | `4`

Mapping:

- TS  = contacts=2
- TRS = contacts=3
- TRRS = contacts=4

For non-phone connectors, use enumerated families (examples):

- `xlr`
- `rca`
- `din5`
- `usb-a` / `usb-b` / `usb-c`

### B) Audio wiring intent (electrical)

When `domain` includes audio, add an optional intent field:

- `audioWiring`: `balanced_mono` | `unbalanced_mono` | `unbalanced_stereo`

Notes:

- TRS can mean *balanced mono* **or** *unbalanced stereo*. The port must say which.
- TS is typically *unbalanced mono*.

## Standard UI naming

We use **metric** sizes in the UI and throughout the codebase:

- 6.35 mm (instead of 1/4\")
- 3.5 mm (instead of 1/8\")

Example labels:

- `6.35 mm TS`
- `6.35 mm TRS`
- `3.5 mm TRS`

## Warning rules (advisory)

The app should mark these as **allowed but warn** (advisory/pending), not invalid.

### 1) Balanced → unbalanced

If one side is `balanced_mono` and the other is `unbalanced_mono`:

- Allow connection (mechanically fits)
- Warn: balanced signal will be treated as unbalanced (possible noise/level change)

### 2) Stereo → mono (headphone into mono input)

If one side is `unbalanced_stereo` and the other side is mono (`balanced_mono` or `unbalanced_mono`):

- Allow connection (mechanically fits)
- Warn: one channel may be lost, or the resulting mono sum may sound wrong (possible cancellation depending on destination)
- Do **not** recommend specific hardware in the warning text

### 3) Fit-only adapters (existing behavior)

If connectors do not physically match, the app may suggest adapters/cables (existing adapter matrix behavior).

Warnings about balanced/unbalanced/stereo/mono are separate from adapter suggestions.

## Data migration notes (devices.json)

- Replace any free-text size labels with canonical fields.
- Avoid encoding size twice (e.g. both `connector` and `physicalConnector`).
- Backfill `audioWiring` only where it matters:
  - monitor/interface line I/O (often `balanced_mono`)
  - headphone outs (often `unbalanced_stereo`)

## Open decisions

- None (metric display is the standard).
