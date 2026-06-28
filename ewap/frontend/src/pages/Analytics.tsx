import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

interface Bottleneck {
  id: string;
  name: string;
  step_type: string;
  avg_duration_ms: number;
  execution_count: number;
  completion_rate: number;
}

export function Analytics() {
  const { data, isLoading } = useQuery({
    queryKey: ['bottlenecks'],
    queryFn: async () => {
      const response = await api.get('/analytics/bottlenecks');
      return response.data.data as Bottleneck[];
    },
  });

  return (
    <div className="page-card">
      <h1 className="section-title">Analytics</h1>
      <p>Identify workflow bottlenecks and process performance trends.</p>
      <div style={{ marginTop: 24 }}>
        {isLoading ? (
          <div>Loading analytics...</div>
        ) : data?.length ? (
          <div className="grid" style={{ gap: 16 }}>
            {data.map((item) => (
              <div key={item.id} className="page-card" style={{ padding: 16 }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{item.name}</p>
                <p style={{ margin: 4, color: '#94a3b8' }}>{item.step_type}</p>
                <p style={{ margin: 4 }}>Avg duration: {Math.round(item.avg_duration_ms)} ms</p>
                <p style={{ margin: 4 }}>Completed: {Math.round(item.completion_rate * 100)}%</p>
              </div>
            ))}
          </div>
        ) : (
          <div>No bottleneck data available yet.</div>
        )}
      </div>
    </div>
  );
}
