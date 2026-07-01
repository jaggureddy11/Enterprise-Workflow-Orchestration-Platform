import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

interface OverviewData {
  active_instances: number;
  completed_instances: number;
  failed_instances: number;
  total_instances: number;
  overdue_tasks: number;
}

export function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['overview'],
    queryFn: async () => {
      const response = await api.get('/analytics/overview');
      return response.data.data as OverviewData;
    },
  });

  return (
    <div className="page-card">
      <h1 className="section-title">Dashboard</h1>
      <p>Enterprise workflow status at a glance.</p>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginTop: 20 }}>
        {isLoading ? (
          <div>Loading analytics...</div>
        ) : (
          [
            { title: 'Active Instances', value: data?.active_instances ?? 0 },
            { title: 'Completed', value: data?.completed_instances ?? 0 },
            { title: 'Failed', value: data?.failed_instances ?? 0 },
            { title: 'Total Instances', value: data?.total_instances ?? 0 },
            { title: 'Overdue Tasks', value: data?.overdue_tasks ?? 0 },
          ].map((item) => (
            <div key={item.title} className="page-card">
              <p style={{ color: 'var(--color-text-secondary)', margin: '0 0 8px 0', fontSize: '0.875rem', fontWeight: 500 }}>{item.title}</p>
              <p style={{ fontSize: '2rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>{item.value}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
