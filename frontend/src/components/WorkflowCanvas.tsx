import React, { useCallback, Dispatch, SetStateAction } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  applyNodeChanges,
  applyEdgeChanges,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface WorkflowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
}

export function WorkflowCanvas({ nodes, edges, setNodes, setEdges }: WorkflowCanvasProps) {
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((prev) => applyNodeChanges(changes, prev)),
    [setNodes],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((prev) => applyEdgeChanges(changes, prev)),
    [setEdges],
  );
  const onConnect = useCallback(
    (connection: Connection) => setEdges((prev) => addEdge(connection, prev)),
    [setEdges],
  );

  return (
    <div style={{ width: '100%', height: '560px', borderRadius: 18, overflow: 'hidden', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView>
        <Background gap={16} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
