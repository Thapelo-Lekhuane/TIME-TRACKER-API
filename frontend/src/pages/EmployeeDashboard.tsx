import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';

interface TimeEvent {
  id: string;
  eventType: { name: string; category: string; isBreak: boolean };
  timestampUtc: string;
}

interface LeaveType {
  id: string;
  name: string;
  paid: boolean;
  fullDayAllowed: boolean;
  halfDayAllowed: boolean;
}

interface LeaveRequest {
  id: string;
  leaveType: { id: string; name: string };
  startUtc: string;
  endUtc: string;
  status: string;
  reason?: string;
  approvedBy?: { fullName: string };
}

const EmployeeDashboard = () => {
  const { user, logout } = useAuth();
  const [currentSection, setCurrentSection] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [todayEvents, setTodayEvents] = useState<TimeEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [status, setStatus] = useState<'out' | 'working' | 'lunch' | 'break'>('out');
  const [totalWorkMinutes, setTotalWorkMinutes] = useState(0);
  const [totalBreakMinutes, setTotalBreakMinutes] = useState(0);
  
  // Leave related state
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [myLeaveRequests, setMyLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<any[]>([]);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState('');

  // Check if user is assigned to a campaign
  const isAssignedToCampaign = !!user?.campaign;

  useEffect(() => {
    fetchEventTypes();
    fetchTodayEvents();
    fetchLeaveTypes();
    fetchMyLeaveRequests();
    fetchLeaveBalances();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    calculateStatus();
  }, [todayEvents]);

  const fetchEventTypes = async () => {
    try {
      // Fetch event types available for this user (global + their campaign's events)
      const response = await api.get('/event-types/available');
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

  const fetchLeaveTypes = async () => {
    try {
      const response = await api.get('/leave-types');
      // Filter out types that are not for employee requests (Present, Absent, etc.)
      const applicableTypes = response.data.filter((lt: LeaveType) => 
        lt.name !== 'Present' && 
        lt.name !== 'Absent' && 
        lt.name !== 'Terminated / Leaver' &&
        lt.name !== 'AWOL'
      );
      setLeaveTypes(applicableTypes);
    } catch (error) {
      console.error('Failed to fetch leave types', error);
    }
  };

  const fetchMyLeaveRequests = async () => {
    try {
      const response = await api.get('/leave-requests/me');
      setMyLeaveRequests(response.data);
    } catch (error) {
      console.error('Failed to fetch my leave requests', error);
    }
  };

  const fetchLeaveBalances = async () => {
    try {
      const response = await api.get('/leave-balances/me');
      setLeaveBalances(response.data);
    } catch (error) {
      console.error('Failed to fetch leave balances', error);
    }
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeaveError('');
    
    if (!leaveForm.leaveTypeId || !leaveForm.startDate || !leaveForm.endDate) {
      setLeaveError('Please fill in all required fields');
      return;
    }

    if (new Date(leaveForm.endDate) < new Date(leaveForm.startDate)) {
      setLeaveError('End date cannot be before start date');
      return;
    }

    setLeaveLoading(true);
    try {
      await api.post('/leave-requests', leaveForm);
      setShowLeaveForm(false);
      setLeaveForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
      fetchMyLeaveRequests();
      fetchLeaveBalances();
      alert('Leave request submitted successfully! The approver will be notified via email.');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to submit leave request';
      setLeaveError(message);
    } finally {
      setLeaveLoading(false);
    }
  };

  const calculateLeaveDays = () => {
    if (!leaveForm.startDate || !leaveForm.endDate) return 0;
    const start = new Date(leaveForm.startDate);
    const end = new Date(leaveForm.endDate);
    const diff = end.getTime() - start.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  const calculateStatus = () => {
    if (todayEvents.length === 0) {
      setStatus('out');
      return;
    }
    const sorted = [...todayEvents].sort((a, b) => 
      new Date(a.timestampUtc).getTime() - new Date(b.timestampUtc).getTime()
    );
    const last = sorted[sorted.length - 1];
    if (last.eventType.name.includes('Work Start')) setStatus('working');
    else if (last.eventType.name.includes('Work End')) setStatus('out');
    else if (last.eventType.name.includes('Lunch Start')) setStatus('lunch');
    else if (last.eventType.name.includes('Lunch End')) setStatus('working');
    else if (last.eventType.name.includes('Break Start')) setStatus('break');
    else if (last.eventType.name.includes('Break End')) setStatus('working');
    
    // Calculate work/break minutes
    let workStart: Date | null = null;
    let breakStart: Date | null = null;
    let workMins = 0;
    let breakMins = 0;
    
    for (const event of sorted) {
      const ts = new Date(event.timestampUtc);
      if (event.eventType.name.includes('Work Start')) {
        workStart = ts;
      } else if (event.eventType.name.includes('Work End') && workStart) {
        workMins += (ts.getTime() - workStart.getTime()) / 60000;
        workStart = null;
      } else if (event.eventType.isBreak && !breakStart) {
        breakStart = ts;
      } else if (event.eventType.isBreak && breakStart) {
        breakMins += (ts.getTime() - breakStart.getTime()) / 60000;
        breakStart = null;
      }
    }
    
    setTotalWorkMinutes(Math.round(workMins));
    setTotalBreakMinutes(Math.round(breakMins));
  };

  const handleClockAction = async (eventTypeId: string) => {
    setLoading(true);
    try {
      await api.post('/time-events', { eventTypeId });
      await fetchTodayEvents();
    } catch (error: any) {
      console.error('Failed to create time event', error);
      const message = error.response?.data?.message || 'Failed to clock in/out';
      if (message.includes('not assigned to a campaign')) {
        alert('You are not assigned to any campaign yet. Please contact your manager or admin to be assigned to a campaign before clocking in.');
      } else {
        alert(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const workStartType = eventTypes.find(et => et.name.includes('Work Start'));
  const workEndType = eventTypes.find(et => et.name.includes('Work End'));
  const lunchStartType = eventTypes.find(et => et.name.includes('Lunch Start'));
  const lunchEndType = eventTypes.find(et => et.name.includes('Lunch End'));
  const breakStartType = eventTypes.find(et => et.name.includes('Break Start'));
  const breakEndType = eventTypes.find(et => et.name.includes('Break End'));

  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const workHours = Math.floor(totalWorkMinutes / 60);
  const workMins = Math.round(totalWorkMinutes % 60);
  const regularHours = 8 * 60;
  const overtimeMinutes = Math.max(0, totalWorkMinutes - regularHours);

  return (
    <div className="dashboard">
      <div className="top-bar">
        <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <span></span>
          <span></span>
          <span></span>
        </button>
        <div className="logo">TimeTrack</div>
        <div className="user-info">
          <span>Welcome, {user?.fullName} ({user?.role})</span>
          <span className="logout-btn" onClick={logout}>Logout</span>
        </div>
      </div>
      
      <div className="dashboard-content">
        <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <nav className="sidebar-nav">
            <a
              href="#"
              className={`sidebar-link ${currentSection === 'dashboard' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setCurrentSection('dashboard'); }}
            >
              Dashboard
            </a>
            <a
              href="#"
              className={`sidebar-link ${currentSection === 'timesheet' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setCurrentSection('timesheet'); }}
            >
              My Timesheet
            </a>
            <a
              href="#"
              className={`sidebar-link ${currentSection === 'leave' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setCurrentSection('leave'); }}
            >
              Leave Requests
            </a>
            <a
              href="#"
              className={`sidebar-link ${currentSection === 'profile' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setCurrentSection('profile'); }}
            >
              Profile
            </a>
          </nav>
        </div>
        
        <div className="main-content">
          {currentSection === 'dashboard' && (
            <div className="section">
              <h2>Employee Dashboard</h2>
              <p className="text-small">Track your time and attendance</p>
              
              {!isAssignedToCampaign && (
                <div style={{
                  backgroundColor: '#dbeafe',
                  border: '1px solid #2563eb',
                  borderRadius: 'var(--radius)',
                  padding: 'var(--spacing-lg)',
                  marginBottom: 'var(--spacing-md)',
                }}>
                  <h3 style={{ color: '#1d4ed8', marginBottom: 'var(--spacing-sm)' }}>No Campaign Assigned</h3>
                  <p style={{ color: '#1e40af' }}>
                    You are not currently assigned to a campaign. You can still clock in/out and take breaks using 
                    the general event types below.
                  </p>
                  <p style={{ color: '#1e40af', marginTop: 'var(--spacing-sm)', fontSize: '14px' }}>
                    Note: To apply for leave, you need to be assigned to a campaign. Contact your admin if you need campaign assignment.
                  </p>
                </div>
              )}
              
              <div className="clock-card">
                <div className="current-time">{timeFormatter.format(currentTime)}</div>
                <div className="current-date">{dateFormatter.format(currentTime)}</div>
                <div className={`status-pill status-${status}`}>
                  {status === 'out' ? 'Clocked OUT' : status === 'working' ? 'Working' : status === 'lunch' ? 'On Lunch' : 'On Break'}
                </div>
                <div className="today-hours">Today: {workHours}h {workMins}m</div>
              </div>
              
              <div className="actions-grid">
                {workStartType && status === 'out' && (
                  <button
                    className="btn btn-primary action-btn"
                    onClick={() => handleClockAction(workStartType.id)}
                    disabled={loading}
                  >
                    Start Work
                  </button>
                )}
                {workEndType && status === 'working' && (
                  <button
                    className="btn btn-danger action-btn"
                    onClick={() => handleClockAction(workEndType.id)}
                    disabled={loading}
                  >
                    End Work
                  </button>
                )}
                {lunchStartType && status === 'working' && (
                  <button
                    className="btn action-btn-orange"
                    onClick={() => handleClockAction(lunchStartType.id)}
                    disabled={loading}
                  >
                    Start Lunch
                  </button>
                )}
                {lunchEndType && status === 'lunch' && (
                  <button
                    className="btn action-btn-orange"
                    onClick={() => handleClockAction(lunchEndType.id)}
                    disabled={loading}
                  >
                    End Lunch
                  </button>
                )}
                {breakStartType && status === 'working' && (
                  <button
                    className="btn action-btn-teal"
                    onClick={() => handleClockAction(breakStartType.id)}
                    disabled={loading}
                  >
                    Start Break
                  </button>
                )}
                {breakEndType && status === 'break' && (
                  <button
                    className="btn action-btn-teal"
                    onClick={() => handleClockAction(breakEndType.id)}
                    disabled={loading}
                  >
                    End Break
                  </button>
                )}
              </div>
              
              <div className="timeline-section">
                <h3>Today's Timeline</h3>
                <div className="timeline-list">
                  {todayEvents.length === 0 ? (
                    <div className="timeline-item">
                      <div className="timeline-time">--:--</div>
                      <div className="timeline-event">No entries yet</div>
                    </div>
                  ) : (
                    todayEvents
                      .sort((a, b) => new Date(b.timestampUtc).getTime() - new Date(a.timestampUtc).getTime())
                      .map(event => (
                        <div key={event.id} className="timeline-item">
                          <div className="timeline-time">
                            {timeFormatter.format(new Date(event.timestampUtc))}
                          </div>
                          <div className="timeline-event">{event.eventType.name}</div>
                        </div>
                      ))
                  )}
                </div>
              </div>
              
              <div className="summary-bar">
                <div className="summary-item">
                  <div className="summary-value">{workHours}h {workMins}m</div>
                  <div className="summary-label">Total work</div>
                </div>
                <div className="summary-item">
                  <div className="summary-value">{totalBreakMinutes}m</div>
                  <div className="summary-label">Breaks</div>
                </div>
                <div className="summary-item">
                  <div className="summary-value">{overtimeMinutes > 0 ? `+${overtimeMinutes}m` : '0m'}</div>
                  <div className="summary-label">Overtime</div>
                </div>
              </div>
            </div>
          )}
          
          {currentSection === 'timesheet' && (
            <div className="section">
              <h2>My Timesheet</h2>
              <p className="text-small">View and manage your weekly timesheets</p>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Clock In</th>
                      <th>Clock Out</th>
                      <th>Total Hours</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayEvents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center">No timesheet data available</td>
                      </tr>
                    ) : (
                      <tr>
                        <td>{dateFormatter.format(new Date())}</td>
                        <td>
                          {todayEvents.find(e => e.eventType.name.includes('Work Start')) 
                            ? timeFormatter.format(new Date(todayEvents.find(e => e.eventType.name.includes('Work Start'))!.timestampUtc))
                            : '--:--'}
                        </td>
                        <td>
                          {todayEvents.find(e => e.eventType.name.includes('Work End'))
                            ? timeFormatter.format(new Date(todayEvents.find(e => e.eventType.name.includes('Work End'))!.timestampUtc))
                            : '--:--'}
                        </td>
                        <td>{workHours}h {workMins}m</td>
                        <td><span className="badge badge-present">Approved</span></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {currentSection === 'leave' && (
            <div className="section">
              <h2>Leave Requests</h2>
              <p className="text-small">Request and track your leave applications</p>
              
              {!isAssignedToCampaign ? (
                <div style={{
                  backgroundColor: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: 'var(--radius)',
                  padding: 'var(--spacing-lg)',
                  marginTop: 'var(--spacing-md)',
                }}>
                  <h3 style={{ color: '#92400e', marginBottom: 'var(--spacing-sm)' }}>Not Assigned to a Campaign</h3>
                  <p style={{ color: '#92400e' }}>
                    You are not currently assigned to any campaign. Please wait until your manager or admin 
                    assigns you to a campaign before you can apply for leave.
                  </p>
                  <p style={{ color: '#92400e', marginTop: 'var(--spacing-sm)' }}>
                    Contact your administrator if you believe this is an error.
                  </p>
                </div>
              ) : (
                <>
                  {/* Leave Balances Section */}
                  <h3>My Leave Balances ({new Date().getFullYear()})</h3>
                  <div className="table-container" style={{ marginBottom: 'var(--spacing-lg)' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Leave Type</th>
                          <th>Entitled</th>
                          <th>Used</th>
                          <th>Pending</th>
                          <th>Remaining</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaveBalances.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center">No leave entitlements assigned yet. Contact your admin.</td>
                          </tr>
                        ) : (
                          leaveBalances.map(balance => (
                            <tr key={balance.leaveType.id}>
                              <td>{balance.leaveType.name}</td>
                              <td><strong>{balance.entitledDays}</strong></td>
                              <td>{balance.usedDays}</td>
                              <td>{balance.pendingDays}</td>
                              <td>
                                <span style={{ 
                                  color: balance.remainingDays <= 0 ? 'var(--danger)' : 
                                         balance.remainingDays <= 3 ? 'var(--warning)' : 'var(--success)',
                                  fontWeight: 600 
                                }}>
                                  {balance.remainingDays}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-value">{myLeaveRequests.length}</div>
                      <div className="stat-label">Total Requests</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{myLeaveRequests.filter(r => r.status === 'PENDING').length}</div>
                      <div className="stat-label">Pending</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{myLeaveRequests.filter(r => r.status === 'APPROVED').length}</div>
                      <div className="stat-label">Approved</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{myLeaveRequests.filter(r => r.status === 'REJECTED').length}</div>
                      <div className="stat-label">Rejected</div>
                    </div>
                  </div>
                  
                  <button 
                    className="btn btn-primary" 
                    style={{ marginBottom: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}
                    onClick={() => setShowLeaveForm(true)}
                  >
                    Request New Leave
                  </button>
                  
                  <h3 style={{ marginTop: 'var(--spacing-md)' }}>My Leave Requests</h3>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Leave Type</th>
                          <th>Start Date</th>
                          <th>End Date</th>
                          <th>Days</th>
                          <th>Status</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myLeaveRequests.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center">No leave requests yet</td>
                          </tr>
                        ) : (
                          myLeaveRequests.map(request => {
                            const startDate = new Date(request.startUtc);
                            const endDate = new Date(request.endUtc);
                            const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                            
                            return (
                              <tr key={request.id}>
                                <td>{request.leaveType.name}</td>
                                <td>{startDate.toLocaleDateString()}</td>
                                <td>{endDate.toLocaleDateString()}</td>
                                <td>{days} day(s)</td>
                                <td>
                                  <span className={`badge ${
                                    request.status === 'APPROVED' ? 'badge-present' :
                                    request.status === 'REJECTED' ? 'badge-absent' :
                                    request.status === 'PENDING' ? 'badge-pending' : 'badge-inactive'
                                  }`}>
                                    {request.status}
                                  </span>
                                </td>
                                <td>{request.reason || '-'}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
          
          {/* Leave Request Modal */}
          {showLeaveForm && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}>
              <div style={{
                backgroundColor: 'white',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--spacing-lg)',
                maxWidth: '500px',
                width: '90%',
              }}>
                <h3>Request Leave</h3>
                <p className="text-small">Fill out the form to submit a leave request</p>
                
                <form onSubmit={handleLeaveSubmit}>
                  <div className="form-group">
                    <label className="form-label">Leave Type *</label>
                    <select
                      className="form-input"
                      value={leaveForm.leaveTypeId}
                      onChange={(e) => setLeaveForm({ ...leaveForm, leaveTypeId: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: '16px',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius)',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        appearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%234b5563' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        paddingRight: '40px',
                      }}
                    >
                      <option value="" disabled>-- Select Leave Type --</option>
                      {leaveTypes.length > 0 ? (
                        leaveTypes.map(lt => (
                          <option key={lt.id} value={lt.id}>
                            {lt.name} {lt.paid ? '(Paid)' : '(Unpaid)'}
                          </option>
                        ))
                      ) : (
                        <option value="" disabled>Loading leave types...</option>
                      )}
                    </select>
                    {leaveTypes.length === 0 && (
                      <p className="text-small" style={{ marginTop: '4px', color: 'var(--warning)' }}>
                        No leave types available. Please contact your administrator.
                      </p>
                    )}
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                    <div className="form-group">
                      <label className="form-label">Start Date *</label>
                      <input
                        type="date"
                        className="form-input"
                        value={leaveForm.startDate}
                        onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                        min={new Date().toISOString().split('T')[0]}
                        required
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">End Date *</label>
                      <input
                        type="date"
                        className="form-input"
                        value={leaveForm.endDate}
                        onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                        min={leaveForm.startDate || new Date().toISOString().split('T')[0]}
                        required
                      />
                    </div>
                  </div>
                  
                  {leaveForm.startDate && leaveForm.endDate && (
                    <div style={{
                      backgroundColor: 'var(--card-light)',
                      padding: 'var(--spacing-sm)',
                      borderRadius: 'var(--radius)',
                      marginBottom: 'var(--spacing-md)',
                      textAlign: 'center',
                    }}>
                      <strong>{calculateLeaveDays()} day(s)</strong> of leave requested
                    </div>
                  )}
                  
                  <div className="form-group">
                    <label className="form-label">Reason (Optional)</label>
                    <textarea
                      className="form-input"
                      value={leaveForm.reason}
                      onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                      placeholder="Enter reason for leave request"
                      rows={3}
                    />
                  </div>
                  
                  {leaveError && (
                    <div style={{ color: 'var(--danger)', marginBottom: 'var(--spacing-md)' }}>
                      {leaveError}
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setShowLeaveForm(false);
                        setLeaveError('');
                        setLeaveForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={leaveLoading}
                    >
                      {leaveLoading ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          
          {currentSection === 'profile' && (
            <div className="section">
              <h2>Profile</h2>
              <p className="text-small">Manage your personal information and preferences</p>
              <div style={{ marginTop: 'var(--spacing-lg)' }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input type="text" className="form-input" value={user?.fullName || ''} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={user?.email || ''} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <input type="text" className="form-input" value={user?.role || ''} readOnly />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
