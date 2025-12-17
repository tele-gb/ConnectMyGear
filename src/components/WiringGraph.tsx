import { useMemo } from 'react';
import type { DeviceInstance, Connection } from '../utils/inference';

interface WiringGraphProps {
  devices: DeviceInstance[];
  connections: Connection[];
}

interface GraphNode {
  instanceId: string;
  name: string;
  x: number;
  y: number;
}

export const WiringGraph = ({ devices, connections }: WiringGraphProps) => {
  const nodes = useMemo<GraphNode[]>(() => {
    const width = 720;
    const height = 360;
    const spacing = width / Math.max(devices.length + 1, 1);
    return devices.map((instance, index) => ({
      instanceId: instance.instanceId,
      name: instance.device.name,
      x: spacing * (index + 1),
      y: height / 2
    }));
  }, [devices]);

  return (
    <section className="wiring-graph">
      <div className="wiring-graph__header">
        <h3>Connection Graph</h3>
        <p>Drag ports to connect devices. Lines below are a placeholder for future visualization.</p>
      </div>
      <svg className="wiring-graph__canvas" viewBox="0 0 720 360" role="img" aria-label="Device connection preview">
        <defs>
          <marker id="arrow-head" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <polygon points="0 0, 8 4, 0 8" fill="#607d8b" />
          </marker>
        </defs>
        {connections.map((connection: Connection) => {
          const fromNode = nodes.find((node) => node.instanceId === connection.from.instanceId);
          const toNode = nodes.find((node) => node.instanceId === connection.to.instanceId);

          if (!fromNode || !toNode) {
            return null;
          }

          return (
            <line
              key={connection.id}
              x1={fromNode.x}
              y1={fromNode.y}
              x2={toNode.x}
              y2={toNode.y}
              className={`wiring-graph__link wiring-graph__link--${connection.status}`}
              markerEnd="url(#arrow-head)"
            />
          );
        })}
        {nodes.map((node: GraphNode) => (
          <g key={node.instanceId} className="wiring-graph__node" transform={`translate(${node.x}, ${node.y})`}>
            <circle r="14" />
            <text y="-20" textAnchor="middle">
              {node.name}
            </text>
          </g>
        ))}
      </svg>
    </section>
  );
};

export default WiringGraph;
