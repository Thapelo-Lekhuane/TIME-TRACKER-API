import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

const ManagerDashboard = () => {
  const { user, logout } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Manager Dashboard</h1>
        <div className="user-info">
          <span>{user?.fullName}</span>
          <button onClick={logout} className="btn-secondary">Logout</button>
        </div>
      </header>
      <div className="dashboard-content">
        <div className="card">
          <h2>Attendance Tracker</h2>
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <p>Attendance report view - to be implemented with API integration</p>
        </div>
        <div className="card">
          <h2>Leave Approvals</h2>
          <p>Leave approval interface - to be implemented with API integration</p>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
