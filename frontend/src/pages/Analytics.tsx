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

  const mockBottlenecks: Bottleneck[] = [
    { id: 'step-1', name: 'Legal Department Review', step_type: 'APPROVAL', avg_duration_ms: 172800000, execution_count: 42, completion_rate: 0.88 },
    { id: 'step-2', name: 'Security Vulnerability Scan', step_type: 'TASK', avg_duration_ms: 4500000, execution_count: 120, completion_rate: 0.99 },
    { id: 'step-3', name: 'Finance Approval', step_type: 'APPROVAL', avg_duration_ms: 86400000, execution_count: 55, completion_rate: 0.94 },
    { id: 'step-4', name: 'Automated Slack Notification', step_type: 'NOTIFICATION', avg_duration_ms: 250, execution_count: 310, completion_rate: 1.0 }
  ];

  const bottlenecks = data && data.length > 0 ? data : mockBottlenecks;

  const formatDuration = (ms: number) => {
    if (ms >= 86400000) return `${Math.round(ms / 86400000)} days`;
    if (ms >= 3600000) return `${Math.round(ms / 3600000)} hours`;
    if (ms >= 60000) return `${Math.round(ms / 60000)} mins`;
    if (ms >= 1000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms)}ms`;
  };

  return (
    <div className="page-card">
      <h1 className="section-title">Analytics & Bottlenecks</h1>
      <p>Identify workflow performance bottlenecks and process trends.</p>
      
      <div style={{ marginTop: 24 }}>
        {isLoading && !data ? (
          <div>Loading analytics...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '12px 16px' }}>Step Name</th>
                  <th style={{ padding: '12px 16px' }}>Type</th>
                  <th style={{ padding: '12px 16px' }}>Avg Duration</th>
                  <th style={{ padding: '12px 16px' }}>Total Runs</th>
                  <th style={{ padding: '12px 16px' }}>Completion Rate</th>
                </tr>
              </thead>
              <tbody>
                {bottlenecks.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    <td style={{ padding: '16px', fontWeight: 600 }}>{item.name}</td>
                    <td style={{ padding: '16px' }}><span className="status-badge" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{item.step_type}</span></td>
                    <td style={{ padding: '16px', color: item.avg_duration_ms >= 86400000 ? 'var(--error-text)' : 'var(--text-secondary)', fontWeight: item.avg_duration_ms >= 86400000 ? 600 : 400 }}>{formatDuration(item.avg_duration_ms)}</td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{item.execution_count}</td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 60, height: 6, borderRadius: 3, background: 'var(--border)' }}>
                          <div style={{ width: `${item.completion_rate * 100}%`, height: '100%', borderRadius: 3, background: item.completion_rate > 0.9 ? 'var(--success-text)' : 'var(--accent)' }} />
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{Math.round(item.completion_rate * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
