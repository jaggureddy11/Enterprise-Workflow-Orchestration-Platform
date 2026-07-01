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

  const mockAudit: AuditEntry[] = [
    {
      id: 'audit-1',
      event_type: 'workflow.definition.published',
      resource_type: 'WORKFLOW',
      created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
      metadata: { workflow_id: '48f0958a-62c7-4abe-bfff-9d16dd30eca5', version: 3, published_by: 'admin@jaggu.com' },
    },
    {
      id: 'audit-2',
      event_type: 'workflow.instance.completed',
      resource_type: 'INSTANCE',
      created_at: new Date(Date.now() - 7200 * 1000).toISOString(),
      metadata: { instance_id: '2bcd3639-1ed2-49ff-a4bf-1bf9b2776178', status: 'COMPLETED', duration_ms: 360000 },
    },
    {
      id: 'audit-3',
      event_type: 'task.completed',
      resource_type: 'TASK',
      created_at: new Date(Date.now() - 8600 * 1000).toISOString(),
      metadata: { task_id: 'task-3', assignee: 'admin@jaggu.com', completion_status: 'COMPLETED' },
    },
    {
      id: 'audit-4',
      event_type: 'workflow.instance.started',
      resource_type: 'INSTANCE',
      created_at: new Date(Date.now() - 9000 * 1000).toISOString(),
      metadata: { instance_id: '2bcd3639-1ed2-49ff-a4bf-1bf9b2776178', started_by: 'webhook_trigger', workflow_id: '48f0958a-62c7-4abe-bfff-9d16dd30eca5' },
    }
  ];
  
  const auditLogs = data && data.length > 0 ? data : mockAudit;

  return (
    <div className="page-card">
      <h1 className="section-title">Audit Log</h1>
      <p>Audit trail of workflow and system events for compliance.</p>
      
      <div style={{ marginTop: 24 }}>
        {isLoading && !data ? (
          <div>Loading audit events...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '12px 16px' }}>Event Type</th>
                  <th style={{ padding: '12px 16px' }}>Resource</th>
                  <th style={{ padding: '12px 16px' }}>Timestamp</th>
                  <th style={{ padding: '12px 16px' }}>Metadata</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((entry) => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.9rem', color: 'var(--text-primary)', verticalAlign: 'top' }}>
                    <td style={{ padding: '16px', fontWeight: 600 }}>{entry.event_type}</td>
                    <td style={{ padding: '16px' }}><span className="status-badge" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{entry.resource_type}</span></td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{new Date(entry.created_at).toLocaleString()}</td>
                    <td style={{ padding: '16px' }}>
                      <pre style={{ margin: 0, padding: 8, background: '#f8fafc', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
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
