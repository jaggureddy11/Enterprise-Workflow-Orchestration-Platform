import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Tasks } from './pages/Tasks';
import { WorkflowBuilder } from './pages/WorkflowBuilder';
import { Analytics } from './pages/Analytics';
import { AuditLog } from './pages/AuditLog';
import { Navigation } from './components/Navigation';

export default function App() {
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();

  return (
    <div className={token ? "app-shell" : "auth-shell"}>
      {token ? <Navigation /> : null}
      <main className={token ? "main-content" : "auth-content"}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={token ? <Dashboard /> : <Navigate to="/login" replace />} />
          <Route path="/workflow-builder" element={token ? <WorkflowBuilder /> : <Navigate to="/login" replace />} />
          <Route path="/tasks" element={token ? <Tasks /> : <Navigate to="/login" replace />} />
          <Route path="/analytics" element={token ? <Analytics /> : <Navigate to="/login" replace />} />
          <Route path="/audit" element={token ? <AuditLog /> : <Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to={token ? '/' : '/login'} replace />} />
        </Routes>
      </main>
    </div>
  );
}
