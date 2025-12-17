import { useEffect, useRef } from 'react';
import type { Port } from '../models/Port';

interface PortIconProps {
  port: Port;
  onClick?: (port: Port) => void;
  isActive?: boolean;
  registerElement?: (element: HTMLElement | null) => void;
}

const signalColors: Record<string, string> = {
  audio: '#ff8a65',
  midi: '#4db6ac',
  sync: '#9575cd',
  usb_audio: '#4fc3f7',
  usb_midi: '#64b5f6',
  cv: '#f06292'
};

export const PortIcon = ({ port, onClick, isActive, registerElement }: PortIconProps) => {
  const anchorRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (registerElement) {
      registerElement(anchorRef.current);
      return () => registerElement(null);
    }
    return undefined;
  }, [registerElement]);

  const handleClick = () => {
    if (onClick) {
      onClick(port);
    }
  };

  const primaryColor = signalColors[port.signals[0]] ?? '#90a4ae';

  return (
    <button
      className="port-icon"
      type="button"
      onClick={handleClick}
      data-direction={port.direction}
      data-connector={port.connector}
      data-active={isActive ? 'true' : 'false'}
      data-draggable-ignore="true"
    >
      <span ref={anchorRef} className="port-icon__anchor" style={{ background: primaryColor }} aria-hidden="true" />
      <span className="port-icon__bubble" style={{ background: primaryColor }} />
      <span className="port-icon__label">{port.label}</span>
    </button>
  );
};

export default PortIcon;
