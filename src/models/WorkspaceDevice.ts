import type { DeviceInstance } from '../utils/inference';

export interface WorkspaceDevice extends DeviceInstance {
  position: { x: number; y: number };
  isClockMaster?: boolean;
}
