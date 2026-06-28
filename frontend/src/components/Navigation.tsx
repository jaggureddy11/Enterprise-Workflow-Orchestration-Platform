import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

export function Navigation() {
  const logout = useAuthStore((state) => state.logout);

  return (
    <aside className="sidebar">
      <h2>EWAP</h2>
      <p>Enterprise Workflow Automation</p>
      <nav>
        <ul className="nav-list">
          <li><NavLink className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} to="/">Dashboard</NavLink></li>
          <li><NavLink className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} to="/workflow-builder">Workflow Builder</NavLink></li>
          <li><NavLink className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} to="/tasks">Tasks</NavLink></li>
          <li><NavLink className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} to="/analytics">Analytics</NavLink></li>
          <li><NavLink className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} to="/audit">Audit Log</NavLink></li>
        </ul>
      </nav>
      <button className="button secondary" onClick={logout} style={{ marginTop: '18px', width: '100%' }}>Logout</button>
    </aside>
  );
}
