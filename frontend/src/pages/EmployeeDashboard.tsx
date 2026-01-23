import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import './Dashboard.css';

const EmployeeDashboard = () => {
  const { user, logout } = useAuth();
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [todayEvents, setTodayEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEventTypes();
    fetchTodayEvents();
  }, []);

  const fetchEventTypes = async () => {
    try {
      const response = await api.get('/event-types');
      setEventTypes(response.data.filter((et: any) => et.active));
    } catch (error) {
      console.error('Failed to fetch event types', error);
    }
  };

  const fetchTodayEvents = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await api.get(`/me/time-events?date=${today}`);
      setTodayEvents(response.data);
    } catch (error) {
      console.error('Failed to fetch today events', error);
    }
  };

  const handleClockAction = async (eventTypeId: string) => {
    setLoading(true);
    try {
      await api.post('/time-events', { eventTypeId });
      await fetchTodayEvents();
    } catch (error) {
      console.error('Failed to create time event', error);
      alert('Failed to clock in/out');
    } finally {
      setLoading(false);
    }
  };

  const workEvents = eventTypes.filter(et => et.category === 'WORK');
  const breakEvents = eventTypes.filter(et => et.category === 'BREAK');

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Time Tracker</h1>
        <div className="user-info">
          <span>{user?.fullName}</span>
          <button onClick={logout} className="btn-secondary">Logout</button>
        </div>
      </header>
      <div className="dashboard-content">
        <div className="card">
          <h2>Clock Actions</h2>
          <div className="action-buttons">
            {workEvents.map(et => (
              <button
                key={et.id}
                onClick={() => handleClockAction(et.id)}
                disabled={loading}
                className="btn-primary btn-large"
              >
                {et.name}
              </button>
            ))}
            {breakEvents.map(et => (
              <button
                key={et.id}
                onClick={() => handleClockAction(et.id)}
                disabled={loading}
                className="btn-secondary btn-large"
              >
                {et.name}
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>Today's Timeline</h2>
          {todayEvents.length === 0 ? (
            <p>No events today</p>
          ) : (
            <ul className="timeline">
              {todayEvents.map(event => (
                <li key={event.id}>
                  <strong>{event.eventType.name}</strong> - {new Date(event.timestampUtc).toLocaleTimeString()}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
