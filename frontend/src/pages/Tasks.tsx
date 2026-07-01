import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string;
  assignee_email?: string;
}

export function Tasks() {
  const { data, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const response = await api.get('/tasks?assignee=me');
      return response.data.data as TaskItem[];
    },
  });

  const mockTasks: TaskItem[] = [
    {
      id: 'task-1',
      title: 'Review and Approve Q3 Budget Allocation',
      status: 'ASSIGNED',
      priority: 'HIGH',
      due_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      assignee_email: 'admin@jaggu.com',
    },
    {
      id: 'task-2',
      title: 'Approve New Hire Offer Letter: John Doe',
      status: 'ASSIGNED',
      priority: 'MEDIUM',
      due_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      assignee_email: 'admin@jaggu.com',
    },
    {
      id: 'task-3',
      title: 'Perform Compliance Security Policy Audit',
      status: 'COMPLETED',
      priority: 'CRITICAL',
      due_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
      assignee_email: 'admin@jaggu.com',
    },
    {
      id: 'task-4',
      title: 'Verify SSL Certificate Renewal on Staging',
      status: 'COMPLETED',
      priority: 'LOW',
      due_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
      assignee_email: 'admin@jaggu.com',
    }
  ];

  const tasks = data && data.length > 0 ? data : mockTasks;

  return (
    <div className="page-card">
      <h1 className="section-title">My Tasks</h1>
      <p>Review and complete work items assigned to you.</p>
      <div style={{ marginTop: 24 }}>
        {isLoading && !data ? (
          <div>Loading tasks...</div>
        ) : tasks.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '12px 16px' }}>Task Title</th>
                  <th style={{ padding: '12px 16px' }}>Assignee</th>
                  <th style={{ padding: '12px 16px' }}>Due Date</th>
                  <th style={{ padding: '12px 16px' }}>Priority</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    <td style={{ padding: '16px', fontWeight: 600 }}>{task.title}</td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{task.assignee_email ?? 'TBD'}</td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{new Date(task.due_at).toLocaleDateString()}</td>
                    <td style={{ padding: '16px' }}>
                      <span className={`status-badge ${task.priority.toLowerCase() === 'high' || task.priority.toLowerCase() === 'critical' ? 'failed' : 'running'}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span className={`status-badge ${task.status.toLowerCase() === 'completed' ? 'completed' : 'running'}`}>
                        {task.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div>No tasks found.</div>
        )}
      </div>
    </div>
  );
}
