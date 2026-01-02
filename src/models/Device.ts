import type { Port } from './Port';

export interface Device {
  id: string;
  name: string;
  manufacturer?: string;
  category?: string;
  description?: string;
  ports: Port[];
  tags?: string[];
}
