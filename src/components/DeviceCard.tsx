import { memo } from 'react';
import type { DragEvent } from 'react';
import type { Device } from '../models/Device';
import type { Port } from '../models/Port';
import { PortIcon } from './PortIcon';

interface DeviceCardProps {
  device: Device;
  variant?: 'library' | 'workspace';
  onPortClick?: (port: Port) => void;
  selectedPortId?: string | null;
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLDivElement>, device: Device) => void;
  onRemove?: () => void;
  onAddToWorkspace?: (device: Device) => void;
  registerPortElement?: (portId: string, element: HTMLElement | null) => void;
  onTestSound?: () => void;
  testSoundAvailable?: boolean;
  onToggleClockMaster?: () => void;
  canToggleClockMaster?: boolean;
  isClockMaster?: boolean;
  isHighlighted?: boolean;
}

const DeviceCardComponent = ({
  device,
  variant = 'library',
  onPortClick,
  selectedPortId,
  draggable,
  onDragStart,
  onRemove,
  onAddToWorkspace,
  registerPortElement,
  onTestSound,
  testSoundAvailable,
  onToggleClockMaster,
  canToggleClockMaster,
  isClockMaster,
  isHighlighted
}: DeviceCardProps) => {
  const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
    if (!draggable) {
      event.preventDefault();
      return;
    }
    if (onDragStart) {
      onDragStart(event, device);
    }
  };

  const inputs = device.ports.filter((port) => port.direction === 'in' || port.direction === 'in_out');
  const outputs = device.ports.filter((port) => port.direction === 'out' || port.direction === 'in_out');

  const cardClassName = [
    'device-card',
    `device-card--${variant}`,
    variant === 'workspace' && isHighlighted ? 'device-card--highlighted' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
  <div
    className={cardClassName}
    draggable={draggable}
    onDragStart={handleDragStart}
    data-draggable={draggable ? 'true' : 'false'}
  >
      <header className="device-card__header">
        <div>
          <h3>{device.name}</h3>
          {device.manufacturer ? <p className="device-card__subtitle">{device.manufacturer}</p> : null}
        </div>
        {variant === 'workspace' ? (
          <div className="device-card__actions">
            {canToggleClockMaster && onToggleClockMaster ? (
              <button
                type="button"
                className="device-card__clock"
                onClick={onToggleClockMaster}
                data-draggable-ignore="true"
                data-active={isClockMaster ? 'true' : 'false'}
                aria-pressed={isClockMaster ? 'true' : 'false'}
              >
                {isClockMaster ? 'Clock Master' : 'Set Clock Master'}
              </button>
            ) : null}
            {onTestSound ? (
              <button
                type="button"
                className="device-card__test"
                onClick={onTestSound}
                data-draggable-ignore="true"
                disabled={!testSoundAvailable}
              >
                Test Sound
              </button>
            ) : null}
            {onRemove ? (
              <button
                type="button"
                className="device-card__remove"
                onClick={onRemove}
                data-draggable-ignore="true"
              >
                Remove
              </button>
            ) : null}
          </div>
        ) : null}
      </header>
      {device.description ? <p className="device-card__description">{device.description}</p> : null}
      <div className="device-card__ports">
        <section>
          <h4>Inputs</h4>
          <div className="device-card__port-list">
            {inputs.length ? (
              inputs.map((port) => (
                <PortIcon
                  key={port.id}
                  port={port}
                  onClick={onPortClick}
                  isActive={selectedPortId === port.id}
                  registerElement={(element) => registerPortElement?.(port.id, element)}
                />
              ))
            ) : (
              <p className="device-card__empty">No inputs</p>
            )}
          </div>
        </section>
        <section>
          <h4>Outputs</h4>
          <div className="device-card__port-list">
            {outputs.length ? (
              outputs.map((port) => (
                <PortIcon
                  key={port.id}
                  port={port}
                  onClick={onPortClick}
                  isActive={selectedPortId === port.id}
                  registerElement={(element) => registerPortElement?.(port.id, element)}
                />
              ))
            ) : (
              <p className="device-card__empty">No outputs</p>
            )}
          </div>
        </section>
      </div>
      {device.tags && device.tags.length ? (
        <footer className="device-card__tags">
          {device.tags.map((tag) => (
            <span key={tag} className="device-card__tag">
              {tag}
            </span>
          ))}
        </footer>
      ) : null}
      {variant === 'library' && onAddToWorkspace ? (
        <button type="button" className="device-card__add" onClick={() => onAddToWorkspace(device)}>
          Add to workspace
        </button>
      ) : null}
    </div>
  );
};

export const DeviceCard = memo(DeviceCardComponent);

export default DeviceCard;
