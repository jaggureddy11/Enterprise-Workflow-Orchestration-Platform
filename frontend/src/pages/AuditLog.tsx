import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

interface AuditEntry {
  id: string;
  event_type: string;
  resource_type: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

export function AuditLog() {
  const { data, isLoading } = useQuery({
    queryKey: ['auditLog'],
    queryFn: async () => {
      const response = await api.get('/audit?limit=30');
      return response.data.data as AuditEntry[];
    },
  });

  return (
    <div className="page-card">
      <h1 className="section-title">Audit Log</h1>
      <p>Audit trail of workflow and system events for compliance.</p>
      <div style={{ marginTop: 24 }}>
        {isLoading ? (
          <div>Loading audit events...</div>
        ) : data?.length ? (
          <div className="grid" style={{ gap: 14 }}>
            {data.map((entry) => (
              <div key={entry.id} className="page-card" style={{ padding: 16 }}>
                <p style={{ margin: 0, fontWeight: 700 }}>{entry.event_type}</p>
                <p style={{ margin: 4, color: '#94a3b8' }}>{entry.resource_type}</p>
                <p style={{ margin: 4, color: '#cbd5e1' }}>{new Date(entry.created_at).toLocaleString()}</p>
                <pre style={{ marginTop: 10, color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>{JSON.stringify(entry.metadata, null, 2)}</pre>
              </div>
            ))}
          </div>
        ) : (
          <div>No audit entries found.</div>
        )}
      </div>
    </div>
  );
}
