export type PortDirection = 'in' | 'out' | 'in_out';

export type PhysicalConnector =
  | '6.35mm-ts'
  | '6.35mm-trs'
  | 'xlr'
  | 'rca'
  | '3.5mm-trs'
  | 'din5'
  | 'trs-midi';

export type AudioWiring = 'balanced_mono' | 'unbalanced_mono' | 'unbalanced_stereo';

export type PortDomain = 'audio' | 'midi';

export type PortConnector =
  | 'din_5'
  | 'trs_3.5mm'
  | 'ts_6.35mm'
  | 'trs_6.35mm'
  | 'usb_c'
  | 'usb_b'
  | 'usb_a'
  | 'xlr'
  | 'combo_xlr_trs'
  | 'sync_out'
  | 'sync_in'
  | 'cv_gate'
  | PhysicalConnector;

export type PortSignal =
  | 'audio'
  | 'midi'
  | 'sync'
  | 'usb_audio'
  | 'usb_midi'
  | 'cv';

export interface Port {
  id: string;
  label: string;
  direction: PortDirection;
  connector: PortConnector;
  signals: PortSignal[];
  domain?: PortDomain;
  stereo?: boolean;
  audioWiring?: AudioWiring;
  physicalConnector?: PhysicalConnector;
  notes?: string;
}
