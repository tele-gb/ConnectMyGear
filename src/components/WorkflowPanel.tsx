import type { Connection, InferenceResult } from '../utils/inference';
import Recommendations from './Recommendations';

interface WorkflowPanelProps {
  inference: InferenceResult;
  recommendations?: string[];
  onRemoveConnection?: (connectionId: string) => void;
}

export const WorkflowPanel = ({ inference, recommendations = [], onRemoveConnection }: WorkflowPanelProps) => (
  <aside className="workflow-panel">
    <h3>Workflow & Warnings</h3>
    <section>
      <h4>Connections</h4>
      {inference.connections.length ? (
        <ul>
          {inference.connections.map((connection: Connection) => {
            const fromDevice = connection.from.deviceName ?? connection.from.deviceId;
            const fromPort = connection.from.portLabel ?? connection.from.portId;
            const toDevice = connection.to.deviceName ?? connection.to.deviceId;
            const toPort = connection.to.portLabel ?? connection.to.portId;
            const statusLabel =
              connection.status === 'valid'
                ? 'OK'
                : connection.status === 'pending'
                ? 'PEND'
                : 'WARN';

            return (
              <li
                key={connection.id}
                className={`workflow-panel__connection workflow-panel__connection--${connection.status}`}
              >
                <div className="workflow-panel__connection-header">
                  <div className="workflow-panel__connection-meta">
                    <span className={`workflow-panel__status workflow-panel__status--${connection.status}`}>
                      {statusLabel}
                    </span>
                    <span className="workflow-panel__connection-text">
                      {fromDevice} {fromPort} {'->'} {toDevice} {toPort}
                    </span>
                  </div>
                  {onRemoveConnection ? (
                    <button
                      type="button"
                      className="workflow-panel__remove"
                      onClick={() => onRemoveConnection(connection.id)}
                      data-draggable-ignore="true"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                {connection.issues ? (
                  <ul className="workflow-panel__issues">
                    {connection.issues.map((issue: string) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="workflow-panel__empty">No connections yet. Select two ports to begin.</p>
      )}
    </section>
    <section>
      <h4>Required Cables</h4>
      {inference.requiredCables.length ? (
        <ul>
          {inference.requiredCables.map((cable) => (
            <li key={cable.id}>{cable.description}</li>
          ))}
        </ul>
      ) : (
        <p className="workflow-panel__empty">Cable suggestions will appear here.</p>
      )}
    </section>
    <Recommendations items={recommendations} />
    <section>
      <h4>Warnings</h4>
      {inference.warnings.length ? (
        <ul>
          {inference.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : (
        <p className="workflow-panel__empty">No warnings detected.</p>
      )}
    </section>
    <section>
      <h4>Workflow Ideas</h4>
      {inference.summaries.length ? (
        <ul>
          {inference.summaries.map((summary, index) => (
            <li key={`${summary}-${index}`}>{index + 1}. {summary}</li>
          ))}
        </ul>
      ) : (
        <p className="workflow-panel__empty">Connect devices to see workflow suggestions.</p>
      )}
    </section>
  </aside>
);

export default WorkflowPanel;
