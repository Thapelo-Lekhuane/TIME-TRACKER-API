import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

const AdminDashboard = () => {
  const { user, logout } = useAuth();

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <div className="user-info">
          <span>{user?.fullName}</span>
          <button onClick={logout} className="btn-secondary">Logout</button>
        </div>
      </header>
      <div className="dashboard-content">
        <div className="card">
          <h2>User Management</h2>
          <p>User management interface - to be implemented with API integration</p>
        </div>
        <div className="card">
          <h2>Campaign Management</h2>
          <p>Campaign management interface - to be implemented with API integration</p>
        </div>
        <div className="card">
          <h2>Reports</h2>
          <p>Reports interface - to be implemented with API integration</p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
