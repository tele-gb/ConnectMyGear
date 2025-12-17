import { useState } from 'react';
import type { Device } from '../models/Device';
import type { Port, PortConnector, PortDirection, PortSignal } from '../models/Port';

interface DraftPort {
  tempId: string;
  label: string;
  direction: PortDirection;
  connector: PortConnector;
  signals: Set<PortSignal>;
  notes?: string;
}

interface CustomDeviceModalProps {
  onClose: () => void;
  onSave: (device: Device) => void;
  existingDeviceIds: Set<string>;
}

const PORT_DIRECTIONS: PortDirection[] = ['in', 'out', 'in_out'];
const PORT_CONNECTORS: PortConnector[] = [
  'din_5',
  'trs_3.5mm',
  'ts_6.35mm',
  'trs_6.35mm',
  'usb_c',
  'usb_b',
  'usb_a',
  'xlr',
  'combo_xlr_trs',
  'sync_out',
  'sync_in',
  'cv_gate'
];

const PORT_SIGNALS: PortSignal[] = ['audio', 'midi', 'sync', 'usb_audio', 'usb_midi', 'cv'];

const defaultPortDraft = (): DraftPort => ({
  tempId: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
  label: '',
  direction: 'in',
  connector: 'trs_6.35mm',
  signals: new Set<PortSignal>(['audio'])
});

const normalizeId = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `port-${Date.now()}`;
};

const generateDeviceId = (name: string, existingIds: Set<string>): string => {
  const base = normalizeId(name) || 'custom-device';
  if (!existingIds.has(base)) {
    return base;
  }

  let suffix = 2;
  while (existingIds.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
};

const CustomDeviceModal = ({ onClose, onSave, existingDeviceIds }: CustomDeviceModalProps) => {
  const [name, setName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [ports, setPorts] = useState<DraftPort[]>([defaultPortDraft()]);
  const [errors, setErrors] = useState<string[]>([]);

  const handleAddPort = () => {
    setPorts((prev) => [...prev, defaultPortDraft()]);
  };

  const handleRemovePort = (tempId: string) => {
    setPorts((prev) => prev.filter((port) => port.tempId !== tempId));
  };

  const updatePort = (tempId: string, updater: (port: DraftPort) => DraftPort) => {
    setPorts((prev) => prev.map((port) => (port.tempId === tempId ? updater(port) : port)));
  };

  const handleSave = () => {
    const validationErrors: string[] = [];
    const trimmedName = name.trim();
    if (!trimmedName) {
      validationErrors.push('Name is required.');
    }

    const validPorts = ports.filter((port) => port.label.trim());
    if (validPorts.length === 0) {
      validationErrors.push('Define at least one port.');
    }

    validPorts.forEach((port, index) => {
      if (port.signals.size === 0) {
        validationErrors.push(`Port ${index + 1} requires at least one signal type.`);
      }
    });

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

  const deviceId = generateDeviceId(trimmedName, existingDeviceIds);

    const devicePorts: Port[] = validPorts.map((port, index) => ({
      id: `${normalizeId(port.label)}-${index + 1}`,
      label: port.label.trim(),
      direction: port.direction,
      connector: port.connector,
      signals: Array.from(port.signals),
      notes: port.notes?.trim() ? port.notes.trim() : undefined
    }));

    const device: Device = {
      id: deviceId,
      name: trimmedName,
      manufacturer: manufacturer.trim() || undefined,
      category: category.trim() || undefined,
      description: description.trim() || undefined,
      ports: devicePorts,
      tags: tagsInput
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    };

    setErrors([]);
    onSave(device);
    onClose();
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Create custom device">
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__content">
        <header className="modal__header">
          <h2>Create Custom Device</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="modal__body">
          {errors.length ? (
            <div className="modal__errors">
              <ul>
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="modal__field">
            <label htmlFor="custom-device-name">Name *</label>
            <input
              id="custom-device-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="modal__field-group">
            <div className="modal__field">
              <label htmlFor="custom-device-manufacturer">Manufacturer</label>
              <input
                id="custom-device-manufacturer"
                type="text"
                value={manufacturer}
                onChange={(event) => setManufacturer(event.target.value)}
              />
            </div>
            <div className="modal__field">
              <label htmlFor="custom-device-category">Category</label>
              <input
                id="custom-device-category"
                type="text"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              />
            </div>
          </div>

          <div className="modal__field">
            <label htmlFor="custom-device-description">Description</label>
            <textarea
              id="custom-device-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>

          <div className="modal__field">
            <label htmlFor="custom-device-tags">Tags (comma separated)</label>
            <input
              id="custom-device-tags"
              type="text"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
            />
          </div>

          <section className="modal__ports">
            <header>
              <h3>Ports *</h3>
              <button type="button" className="modal__action" onClick={handleAddPort}>
                Add port
              </button>
            </header>
            {ports.length === 0 ? <p className="modal__empty">No ports yet.</p> : null}
            {ports.map((port, index) => (
              <div key={port.tempId} className="modal__port">
                <div className="modal__port-header">
                  <h4>Port {index + 1}</h4>
                  <button
                    type="button"
                    className="modal__action modal__action--danger"
                    onClick={() => handleRemovePort(port.tempId)}
                    aria-label={`Remove port ${index + 1}`}
                  >
                    Remove
                  </button>
                </div>
                <div className="modal__field">
                  <label htmlFor={`port-label-${port.tempId}`}>Label *</label>
                  <input
                    id={`port-label-${port.tempId}`}
                    type="text"
                    value={port.label}
                    onChange={(event) =>
                      updatePort(port.tempId, (draft) => ({
                        ...draft,
                        label: event.target.value
                      }))
                    }
                  />
                </div>
                <div className="modal__field-group">
                  <div className="modal__field">
                    <label htmlFor={`port-direction-${port.tempId}`}>Direction</label>
                    <select
                      id={`port-direction-${port.tempId}`}
                      value={port.direction}
                      onChange={(event) =>
                        updatePort(port.tempId, (draft) => ({
                          ...draft,
                          direction: event.target.value as PortDirection
                        }))
                      }
                    >
                      {PORT_DIRECTIONS.map((direction) => (
                        <option key={direction} value={direction}>
                          {direction}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="modal__field">
                    <label htmlFor={`port-connector-${port.tempId}`}>Connector</label>
                    <select
                      id={`port-connector-${port.tempId}`}
                      value={port.connector}
                      onChange={(event) =>
                        updatePort(port.tempId, (draft) => ({
                          ...draft,
                          connector: event.target.value as PortConnector
                        }))
                      }
                    >
                      {PORT_CONNECTORS.map((connector) => (
                        <option key={connector} value={connector}>
                          {connector}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal__field">
                  <span>Signals *</span>
                  <div className="modal__checkboxes">
                    {PORT_SIGNALS.map((signal) => (
                      <label key={signal} className="modal__checkbox">
                        <input
                          type="checkbox"
                          checked={port.signals.has(signal)}
                          onChange={(event) =>
                            updatePort(port.tempId, (draft) => {
                              const nextSignals = new Set(draft.signals);
                              if (event.target.checked) {
                                nextSignals.add(signal);
                              } else {
                                nextSignals.delete(signal);
                              }
                              return { ...draft, signals: nextSignals };
                            })
                          }
                        />
                        <span>{signal}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="modal__field">
                  <label htmlFor={`port-notes-${port.tempId}`}>Notes</label>
                  <textarea
                    id={`port-notes-${port.tempId}`}
                    rows={2}
                    value={port.notes ?? ''}
                    onChange={(event) =>
                      updatePort(port.tempId, (draft) => ({
                        ...draft,
                        notes: event.target.value
                      }))
                    }
                  />
                </div>
              </div>
            ))}
          </section>
        </div>

        <footer className="modal__footer">
          <button type="button" className="modal__action" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="modal__action modal__action--primary" onClick={handleSave}>
            Save device
          </button>
        </footer>
      </div>
    </div>
  );
};

export default CustomDeviceModal;
