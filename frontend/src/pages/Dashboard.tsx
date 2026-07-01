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

  const defaultData: OverviewData = {
    active_instances: 12,
    completed_instances: 245,
    failed_instances: 4,
    total_instances: 261,
    overdue_tasks: 1,
  };

  const overview = data ? { ...defaultData, ...data } : defaultData;

  const mockRecentActivity = [
    { id: '1', event: 'Workflow Triggered', detail: 'Employee Onboarding Flow #284', time: '10 mins ago', status: 'running' },
    { id: '2', event: 'Task Completed', detail: 'Manager Approval: Expense Report #912', time: '45 mins ago', status: 'completed' },
    { id: '3', event: 'Step Failed', detail: 'Slack Notification: Slack API Limit reached', time: '2 hours ago', status: 'failed' },
    { id: '4', event: 'New Workflow Published', detail: 'Procurement Approval Chain v2.1', time: '5 hours ago', status: 'completed' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <h1 className="section-title">Dashboard</h1>
        <p>Enterprise workflow status and real-time operations.</p>
      </div>

      {isLoading && !data ? (
        <div>Loading dashboard metrics...</div>
      ) : (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
            {[
              { title: 'Active Instances', value: overview.active_instances, badge: 'running' },
              { title: 'Completed Instances', value: overview.completed_instances, badge: 'completed' },
              { title: 'Failed Instances', value: overview.failed_instances, badge: 'failed' },
              { title: 'Total Instances', value: overview.total_instances, badge: 'running' },
              { title: 'Overdue Tasks', value: overview.overdue_tasks, badge: 'failed' },
            ].map((item) => (
              <div key={item.title} className="page-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <span className={`status-badge ${item.badge}`} style={{ alignSelf: 'flex-start' }}>
                  {item.badge}
                </span>
                <div>
                  <p style={{ color: 'var(--text-secondary)', margin: '0 0 4px 0', fontSize: '0.875rem', fontWeight: 500 }}>{item.title}</p>
                  <p style={{ fontSize: '2.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="page-card" style={{ marginTop: 8 }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.01em' }}>Recent Operations Activity</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {mockRecentActivity.map((activity) => (
                <div key={activity.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{activity.event}</p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>{activity.detail}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{activity.time}</span>
                    <span className={`status-badge ${activity.status}`}>{activity.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
