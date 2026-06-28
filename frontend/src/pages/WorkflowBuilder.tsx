import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { WorkflowCanvas } from '../components/WorkflowCanvas';
import type { Node, Edge } from 'reactflow';

interface StepDefinition {
  id: string;
  name: string;
  type: string;
  order: number;
  config: Record<string, unknown>;
  isTerminal?: boolean;
}

interface WorkflowDefinition {
  id?: string;
  name: string;
  description?: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  definition: { steps: StepDefinition[] };
}

export function WorkflowBuilder() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('Employee Onboarding');
  const [description, setDescription] = useState('Automated onboarding workflow');
  const [nodes, setNodes] = useState<Node[]>([{
    id: '1',
    data: { label: 'Manager Approval' },
    position: { x: 0, y: 0 },
    style: { padding: 16, borderRadius: 12, background: '#1e293b', color: '#e2e8f0', border: '1px solid #3b82f6' },
  }]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [stepType, setStepType] = useState('TASK');
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: workflows } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const response = await api.get('/workflows');
      return response.data.data as any[];
    },
  });

  useEffect(() => {
    if (workflows?.length && !workflowId) {
      setWorkflowId(workflows[0].id);
    }
  }, [workflows, workflowId]);

  const createWorkflowMutation = useMutation({
    mutationFn: async (workflow: WorkflowDefinition) => {
      const response = await api.post('/workflows', workflow);
      return response.data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
  });

  const publishWorkflowMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/workflows/${id}/publish`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
  });

  const addStep = () => {
    const nextId = `${nodes.length + 1}`;
    const nextStep = {
      id: nextId,
      data: { label: `Step ${nextId}` },
      position: { x: nodes.length * 180, y: 100 },
      style: { padding: 16, borderRadius: 12, background: '#111827', color: '#fff', border: '1px solid #38bdf8' },
    };
    setNodes((prev) => [...prev, nextStep]);
  };

  const buildWorkflow = (): WorkflowDefinition => {
    const steps = nodes.map((node, index) => ({
      id: node.id,
      name: typeof node.data === 'object' && 'label' in node.data ? String(node.data.label) : `Step ${node.id}`,
      type: stepType,
      order: index + 1,
      isTerminal: false,
      config: {
        assigneeType: 'ROLE',
        assignee: 'MANAGER',
        slaHours: 48,
        priority: 'HIGH',
        formSchema: { fields: [{ name: 'decision', type: 'radio', options: ['APPROVED', 'REJECTED'], required: true }] },
      },
    }));

    return {
      name,
      description,
      triggerType: 'MANUAL',
      triggerConfig: {},
      definition: { steps },
    };
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      await createWorkflowMutation.mutateAsync(buildWorkflow());
      alert('Workflow created successfully');
    } catch (error) {
      alert('Unable to create workflow');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!workflowId) return;
    setLoading(true);
    try {
      await publishWorkflowMutation.mutateAsync(workflowId);
      alert('Workflow published');
    } catch (error) {
      alert('Unable to publish workflow');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-card">
      <h1 className="section-title">Workflow Builder</h1>
      <p>Create and publish workflow definitions visually.</p>
      <div className="grid" style={{ gap: 20, marginTop: 24 }}>
        <div className="page-card" style={{ display: 'grid', gap: 14 }}>
          <label>
            Workflow name
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Description
            <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label>
            Step type
            <select className="input" value={stepType} onChange={(e) => setStepType(e.target.value)}>
              <option value="TASK">Task</option>
              <option value="NOTIFICATION">Notification</option>
              <option value="CONDITION">Condition</option>
              <option value="DELAY">Delay</option>
              <option value="WEBHOOK">Webhook</option>
              <option value="AI_ACTION">AI Action</option>
            </select>
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="button" type="button" onClick={addStep}>Add Step</button>
            <button className="button" type="button" onClick={handleCreate} disabled={loading}>Create Workflow</button>
            <button className="button" type="button" onClick={handlePublish} disabled={loading || !workflowId}>Publish</button>
          </div>
        </div>
        <div className="page-card">
          <WorkflowCanvas nodes={nodes} edges={edges} setNodes={setNodes} setEdges={setEdges} />
        </div>
      </div>
    </div>
  );
}
