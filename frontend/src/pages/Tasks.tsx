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

  return (
    <div className="page-card">
      <h1 className="section-title">My Tasks</h1>
      <p>Review and complete work items assigned to you.</p>
      <div style={{ marginTop: 24 }}>
        {isLoading ? (
          <div>Loading tasks...</div>
        ) : data?.length ? (
          <div className="grid" style={{ gap: 12 }}>
            {data.map((task) => (
              <div key={task.id} className="page-card" style={{ padding: 16 }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{task.title}</p>
                <p style={{ margin: '8px 0 0', color: '#94a3b8' }}>Assignee: {task.assignee_email ?? 'TBD'}</p>
                <p style={{ margin: 4, color: '#cbd5e1' }}>Due: {new Date(task.due_at).toLocaleString()}</p>
                <p style={{ margin: 4, color: '#7dd3fc' }}>Status: {task.status}</p>
                <p style={{ margin: 4, color: '#fca5a5' }}>Priority: {task.priority}</p>
              </div>
            ))}
          </div>
        ) : (
          <div>No tasks found.</div>
        )}
      </div>
    </div>
  );
}
