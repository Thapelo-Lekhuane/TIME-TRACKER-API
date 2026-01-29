import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';

interface User {
  id: string;
  email: string;
  fullName: string;
  designation?: string;
  role: string;
  campaign?: { id: string; name: string } | null;
  teamLeader?: { id: string; fullName: string } | null;
  teamLeaderId?: string | null;
}

interface Campaign {
  id: string;
  name: string;
  description?: string;
  timeZone?: string;
  leaveApproverEmail?: string;
  users?: User[];
}

const ManagerDashboard = () => {
  const { user, logout } = useAuth();
  const [currentSection, setCurrentSection] = useState('managerDashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateFilterType, setDateFilterType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [leaveFilterCampaign, setLeaveFilterCampaign] = useState<string>('');
  const [leaveFilterStatus, setLeaveFilterStatus] = useState<string>('PENDING');
  
  // Campaign CRUD state
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [campaignForm, setCampaignForm] = useState({ 
    name: '', 
    description: '', 
    timeZone: 'Africa/Johannesburg', 
    leaveApproverEmail: '',
    workDayStart: '',
    workDayEnd: '',
    lunchStart: '',
    lunchEnd: '',
    teaBreaks: [] as Array<{ start: string; end: string }>,
  });
  const [newTeaBreak, setNewTeaBreak] = useState({ start: '', end: '' });
  const [assigningCampaign, setAssigningCampaign] = useState<Campaign | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  
  // Team Leader assignment state
  const [showTeamLeaderModal, setShowTeamLeaderModal] = useState(false);
  const [editingUserForTeamLeader, setEditingUserForTeamLeader] = useState<User | null>(null);
  const [selectedTeamLeaderId, setSelectedTeamLeaderId] = useState<string>('');

  useEffect(() => {
    fetchCampaigns();
    fetchAllUsers();
  }, []);

  useEffect(() => {
    fetchAttendanceDaily();
  }, [selectedDate, selectedCampaign, dateFilterType, dateRange]);

  useEffect(() => {
    fetchLeaveRequests();
  }, [leaveFilterCampaign, leaveFilterStatus, dateRange]);

  const fetchCampaigns = async () => {
    try {
      const response = await api.get('/campaigns');
      setCampaigns(response.data);
      if (response.data.length > 0 && !selectedCampaign) {
        setSelectedCampaign(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch campaigns', error);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const response = await api.get('/users');
      setAllUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users', error);
    }
  };

  const fetchAttendanceDaily = async () => {
    try {
      // Validate dates before making request
      if (dateFilterType === 'weekly' || dateFilterType === 'monthly') {
        if (!dateRange.from || !dateRange.to) {
          // If date range is not set yet, don't make the request
          return;
        }
        // Validate dates
        const fromDate = new Date(dateRange.from);
        const toDate = new Date(dateRange.to);
        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
          console.error('Invalid date range');
          return;
        }
      }
      
      let url = '/reports/attendance/daily?';
      if (dateFilterType === 'daily') {
        if (!selectedDate) return;
        url += `date=${selectedDate}`;
      } else if (dateFilterType === 'weekly' && dateRange.from && dateRange.to) {
        url += `from=${dateRange.from}&to=${dateRange.to}`;
      } else if (dateFilterType === 'monthly' && dateRange.from && dateRange.to) {
        url += `from=${dateRange.from}&to=${dateRange.to}`;
      } else {
        // Fallback to daily with selected date
        if (!selectedDate) return;
        url += `date=${selectedDate}`;
      }
      if (selectedCampaign) {
        url += `&campaignId=${selectedCampaign}`;
      }
      const response = await api.get(url);
      setAttendanceData(response.data);
    } catch (error) {
      console.error('Failed to fetch attendance', error);
      alert('Failed to fetch attendance data. Please check your date filters.');
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      let url = '/leave-requests?';
      const params: string[] = [];
      if (leaveFilterStatus) {
        params.push(`status=${leaveFilterStatus}`);
      }
      if (leaveFilterCampaign) {
        params.push(`campaignId=${leaveFilterCampaign}`);
      }
      if (dateRange.from && dateRange.to) {
        params.push(`from=${dateRange.from}&to=${dateRange.to}`);
      }
      url += params.join('&');
      const response = await api.get(url);
      setLeaveRequests(response.data);
    } catch (error) {
      console.error('Failed to fetch leave requests', error);
    }
  };

  const getWeekRange = (date: string) => {
    if (!date || isNaN(Date.parse(date))) {
      const today = new Date().toISOString().split('T')[0];
      date = today;
    }
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      const today = new Date().toISOString().split('T')[0];
      d.setTime(new Date(today).getTime());
    }
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday as first day
    const monday = new Date(d.getFullYear(), d.getMonth(), diff);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      from: monday.toISOString().split('T')[0],
      to: sunday.toISOString().split('T')[0],
    };
  };

  const getMonthRange = (date: string) => {
    if (!date || isNaN(Date.parse(date))) {
      const today = new Date().toISOString().split('T')[0];
      date = today;
    }
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      const today = new Date();
      d.setTime(today.getTime());
    }
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return {
      from: firstDay.toISOString().split('T')[0],
      to: lastDay.toISOString().split('T')[0],
    };
  };

  const handleDateFilterChange = (type: 'daily' | 'weekly' | 'monthly') => {
    setDateFilterType(type);
    // Ensure we have a valid date
    const dateToUse = selectedDate || new Date().toISOString().split('T')[0];
    if (!selectedDate) {
      setSelectedDate(dateToUse);
    }
    
    if (type === 'weekly') {
      const range = getWeekRange(dateToUse);
      setDateRange(range);
    } else if (type === 'monthly') {
      const range = getMonthRange(dateToUse);
      setDateRange(range);
    } else {
      setDateRange({ from: '', to: '' });
    }
  };

  const handleApproveLeave = async (id: string) => {
    try {
      await api.patch(`/leave-requests/${id}`, { status: 'APPROVED' });
      fetchLeaveRequests();
    } catch (error) {
      console.error('Failed to approve leave', error);
      alert('Failed to approve leave request');
    }
  };

  const handleRejectLeave = async (id: string) => {
    try {
      await api.patch(`/leave-requests/${id}`, { status: 'REJECTED' });
      fetchLeaveRequests();
    } catch (error) {
      console.error('Failed to reject leave', error);
      alert('Failed to reject leave request');
    }
  };

  const exportCSV = async () => {
    try {
      const response = await fetch(`/api/reports/attendance/daily/export?date=${selectedDate}${selectedCampaign ? `&campaignId=${selectedCampaign}` : ''}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance-${selectedDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export CSV', error);
      alert('Failed to export CSV');
    }
  };

  // Campaign CRUD handlers
  const handleCreateCampaign = () => {
    setEditingCampaign(null);
    setCampaignForm({ 
      name: '', 
      description: '', 
      timeZone: 'Africa/Johannesburg', 
      leaveApproverEmail: '',
      workDayStart: '',
      workDayEnd: '',
      lunchStart: '',
      lunchEnd: '',
      teaBreaks: [],
    });
    setNewTeaBreak({ start: '', end: '' });
    setShowCampaignModal(true);
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setCampaignForm({
      name: campaign.name,
      description: campaign.description || '',
      timeZone: campaign.timeZone || 'Africa/Johannesburg',
      leaveApproverEmail: campaign.leaveApproverEmail || '',
      workDayStart: campaign.workDayStart || '',
      workDayEnd: campaign.workDayEnd || '',
      lunchStart: campaign.lunchStart || '',
      lunchEnd: campaign.lunchEnd || '',
      teaBreaks: (campaign.teaBreaks as Array<{ start: string; end: string }>) || [],
    });
    setNewTeaBreak({ start: '', end: '' });
    setShowCampaignModal(true);
  };

  const addTeaBreak = () => {
    if (newTeaBreak.start && newTeaBreak.end) {
      setCampaignForm({
        ...campaignForm,
        teaBreaks: [...campaignForm.teaBreaks, { ...newTeaBreak }],
      });
      setNewTeaBreak({ start: '', end: '' });
    }
  };

  const removeTeaBreak = (index: number) => {
    setCampaignForm({
      ...campaignForm,
      teaBreaks: campaignForm.teaBreaks.filter((_, i) => i !== index),
    });
  };

  const handleSaveCampaign = async () => {
    try {
      if (editingCampaign) {
        await api.patch(`/campaigns/${editingCampaign.id}`, campaignForm);
      } else {
        await api.post('/campaigns', campaignForm);
      }
      setShowCampaignModal(false);
      fetchCampaigns();
    } catch (error: any) {
      console.error('Failed to save campaign', error);
      alert(error.response?.data?.message || 'Failed to save campaign');
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign? All users will be unassigned.')) return;
    try {
      await api.delete(`/campaigns/${campaignId}`);
      fetchCampaigns();
    } catch (error: any) {
      console.error('Failed to delete campaign', error);
      alert(error.response?.data?.message || 'Failed to delete campaign');
    }
  };

  const handleOpenAssignModal = (campaign: Campaign) => {
    setAssigningCampaign(campaign);
    setSelectedUserIds(campaign.users?.map(u => u.id) || []);
    setShowAssignModal(true);
  };

  const handleSaveAssignments = async () => {
    if (!assigningCampaign) return;
    try {
      await api.post(`/campaigns/${assigningCampaign.id}/users`, { userIds: selectedUserIds });
      setShowAssignModal(false);
      fetchCampaigns();
      fetchAllUsers();
    } catch (error: any) {
      console.error('Failed to assign users', error);
      alert(error.response?.data?.message || 'Failed to assign users');
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleAssignTeamLeader = (user: User) => {
    setEditingUserForTeamLeader(user);
    setSelectedTeamLeaderId(user.teamLeaderId || '');
    setShowTeamLeaderModal(true);
  };

  const handleSaveTeamLeader = async () => {
    if (!editingUserForTeamLeader) return;
    
    try {
      await api.patch(`/users/${editingUserForTeamLeader.id}`, {
        teamLeaderId: selectedTeamLeaderId || null,
      });
      alert('Team leader assigned successfully');
      setShowTeamLeaderModal(false);
      setEditingUserForTeamLeader(null);
      fetchAllUsers();
      fetchAttendanceDaily();
    } catch (error: any) {
      console.error('Failed to assign team leader', error);
      alert(error.response?.data?.message || 'Failed to assign team leader');
    }
  };

  const presentCount = attendanceData?.rows?.filter((r: any) => {
    const dateData = r[selectedDate];
    return dateData?.status === 'Present';
  }).length || 0;
  const totalUsers = attendanceData?.rows?.length || 0;

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
              className={`sidebar-link ${currentSection === 'managerDashboard' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setCurrentSection('managerDashboard'); }}
            >
              Dashboard
            </a>
            <a
              href="#"
              className={`sidebar-link ${currentSection === 'teamAttendance' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setCurrentSection('teamAttendance'); }}
            >
              Team Attendance
            </a>
            <a
              href="#"
              className={`sidebar-link ${currentSection === 'leaveApprovals' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setCurrentSection('leaveApprovals'); }}
            >
              Leave Approvals
            </a>
            <a
              href="#"
              className={`sidebar-link ${currentSection === 'reports' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setCurrentSection('reports'); }}
            >
              Reports
            </a>
            <a
              href="#"
              className={`sidebar-link ${currentSection === 'campaigns' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setCurrentSection('campaigns'); }}
            >
              Campaigns
            </a>
            <a
              href="#"
              className={`sidebar-link ${currentSection === 'teamLeaders' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setCurrentSection('teamLeaders'); }}
            >
              Team Leaders
            </a>
          </nav>
        </div>
        
        <div className="main-content">
          {currentSection === 'managerDashboard' && (
            <div className="section">
              <h2>Manager Dashboard</h2>
              <p className="text-small">Team overview and attendance tracking</p>
              
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{presentCount}/{totalUsers}</div>
                  <div className="stat-label">Present Today</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{leaveRequests.length}</div>
                  <div className="stat-label">Pending Leaves</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{totalUsers - presentCount}</div>
                  <div className="stat-label">Absent</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{campaigns.length}</div>
                  <div className="stat-label">Active Campaigns</div>
                </div>
              </div>
              
              <div className="filters">
                <div className="filter-group">
                  <label className="form-label">Campaign:</label>
                  <select
                    className="form-input"
                    style={{ width: '200px' }}
                    value={selectedCampaign}
                    onChange={(e) => setSelectedCampaign(e.target.value)}
                  >
                    <option value="">All Campaigns</option>
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="filter-group">
                  <label className="form-label">Date Filter:</label>
                  <select
                    className="form-input"
                    style={{ width: '150px' }}
                    value={dateFilterType}
                    onChange={(e) => handleDateFilterChange(e.target.value as 'daily' | 'weekly' | 'monthly')}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                
                {dateFilterType === 'daily' && (
                  <div className="filter-group">
                    <label className="form-label">Date:</label>
                    <input
                      type="date"
                      className="form-input"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                  </div>
                )}
                
                {(dateFilterType === 'weekly' || dateFilterType === 'monthly') && (
                  <>
                    <div className="filter-group">
                      <label className="form-label">From:</label>
                      <input
                        type="date"
                        className="form-input"
                        value={dateRange.from}
                        onChange={(e) => {
                          const newRange = { ...dateRange, from: e.target.value };
                          setDateRange(newRange);
                          if (dateFilterType === 'weekly') {
                            const range = getWeekRange(e.target.value);
                            setDateRange(range);
                          } else if (dateFilterType === 'monthly') {
                            const range = getMonthRange(e.target.value);
                            setDateRange(range);
                          }
                        }}
                      />
                    </div>
                    <div className="filter-group">
                      <label className="form-label">To:</label>
                      <input
                        type="date"
                        className="form-input"
                        value={dateRange.to}
                        onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                      />
                    </div>
                  </>
                )}
                
                <button className="btn btn-secondary btn-sm" onClick={exportCSV}>
                  Export CSV
                </button>
              </div>
              
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Agent Name</th>
                      <th>Team Leader</th>
                      <th>Campaign</th>
                      <th>Today Status</th>
                      <th>Hours Worked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceData?.rows?.map((row: any, idx: number) => {
                      const dateData = row[selectedDate];
                      const status = dateData?.status || 'Absent';
                      const hours = dateData?.workHours || 0;
                      return (
                        <tr key={idx}>
                          <td>{row.agentName}</td>
                          <td>{row.teamLeader}</td>
                          <td>{row.campaign}</td>
                          <td>
                            <span className={`badge badge-${status.toLowerCase().replace(' ', '-')}`}>
                              {status}
                            </span>
                          </td>
                          <td>{hours.toFixed(1)}h</td>
                        </tr>
                      );
                    }) || (
                      <tr>
                        <td colSpan={5} className="text-center">No data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {currentSection === 'teamAttendance' && (
            <div className="section">
              <h2>Team Attendance</h2>
              <p className="text-small">Detailed attendance tracking for your team</p>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceData?.rows?.map((row: any, idx: number) => {
                      const dateData = row[selectedDate];
                      return (
                        <tr key={idx}>
                          <td>{row.agentName}</td>
                          <td>{selectedDate}</td>
                          <td>
                            <span className={`badge badge-${(dateData?.status || 'Absent').toLowerCase().replace(' ', '-')}`}>
                              {dateData?.status || 'Absent'}
                            </span>
                          </td>
                          <td>{dateData?.workHours?.toFixed(1) || '0'}h</td>
                        </tr>
                      );
                    }) || (
                      <tr>
                        <td colSpan={4} className="text-center">No data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {currentSection === 'leaveApprovals' && (
            <div className="section">
              <h2>Leave Approvals</h2>
              <p className="text-small">Review and approve team leave requests</p>
              
              <div className="filters" style={{ marginBottom: 'var(--spacing-md)' }}>
                <div className="filter-group">
                  <label className="form-label">Campaign:</label>
                  <select
                    className="form-input"
                    style={{ width: '200px' }}
                    value={leaveFilterCampaign}
                    onChange={(e) => setLeaveFilterCampaign(e.target.value)}
                  >
                    <option value="">All Campaigns</option>
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="filter-group">
                  <label className="form-label">Status:</label>
                  <select
                    className="form-input"
                    style={{ width: '150px' }}
                    value={leaveFilterStatus}
                    onChange={(e) => setLeaveFilterStatus(e.target.value)}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="CANCELED">Canceled</option>
                    <option value="">All Statuses</option>
                  </select>
                </div>
                
                <div className="filter-group">
                  <label className="form-label">From Date:</label>
                  <input
                    type="date"
                    className="form-input"
                    value={dateRange.from}
                    onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                  />
                </div>
                
                <div className="filter-group">
                  <label className="form-label">To Date:</label>
                  <input
                    type="date"
                    className="form-input"
                    value={dateRange.to}
                    onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                  />
                </div>
                
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setLeaveFilterCampaign('');
                    setLeaveFilterStatus('PENDING');
                    setDateRange({ from: '', to: '' });
                  }}
                >
                  Clear Filters
                </button>
              </div>
              
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Campaign</th>
                      <th>Leave Type</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Days</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveRequests.map(req => {
                      const startDate = new Date(req.startUtc);
                      const endDate = new Date(req.endUtc);
                      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                      return (
                        <tr key={req.id}>
                          <td>{req.user?.fullName}</td>
                          <td>{req.campaign?.name || '-'}</td>
                          <td>{req.leaveType?.name}</td>
                          <td>{startDate.toLocaleDateString()}</td>
                          <td>{endDate.toLocaleDateString()}</td>
                          <td>{days}</td>
                          <td>{req.reason || '-'}</td>
                          <td>
                            <span className={`badge badge-${req.status?.toLowerCase() || 'pending'}`}>
                              {req.status || 'Pending'}
                            </span>
                          </td>
                          <td>
                            {req.status === 'PENDING' && (
                              <>
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleApproveLeave(req.id)}
                                  style={{ marginRight: '8px' }}
                                >
                                  Approve
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleRejectLeave(req.id)}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {req.status !== 'PENDING' && (
                              <span className="text-small" style={{ color: 'var(--text-muted)' }}>
                                {req.approvedBy ? `By ${req.approvedBy.fullName}` : 'Processed'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {leaveRequests.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center">No leave requests found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {currentSection === 'reports' && (
            <div className="section">
              <h2>Reports</h2>
              <p className="text-small">Generate and view team performance reports</p>
              <p className="text-small">Reports functionality coming soon...</p>
            </div>
          )}
          
          {currentSection === 'campaigns' && (
            <div className="section">
              <h2>Campaigns</h2>
              <p className="text-small">Manage campaigns and assign employees</p>
              
              <button
                className="btn btn-primary"
                style={{ marginBottom: 'var(--spacing-md)' }}
                onClick={handleCreateCampaign}
              >
                Create New Campaign
              </button>
              
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Description</th>
                      <th>Leave Approver</th>
                      <th>Assigned Employees</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map(c => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{c.description || '-'}</td>
                        <td>
                          {c.leaveApproverEmail ? (
                            <span style={{ color: 'var(--success)' }}>{c.leaveApproverEmail}</span>
                          ) : (
                            <span style={{ color: 'var(--warning)' }}>Not Set</span>
                          )}
                        </td>
                        <td>{c.users?.length || 0} employees</td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenAssignModal(c)}
                            style={{ marginRight: '8px' }}
                          >
                            Assign Users
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleEditCampaign(c)}
                            style={{ marginRight: '8px' }}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteCampaign(c.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {campaigns.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center">No campaigns found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {currentSection === 'teamLeaders' && (
            <div className="section">
              <h2>Team Leaders</h2>
              <p className="text-small">Assign team leaders to employees</p>
              
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Employee Name</th>
                      <th>Email</th>
                      <th>Campaign</th>
                      <th>Current Team Leader</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.filter(u => u.role === 'EMPLOYEE').map(u => (
                      <tr key={u.id}>
                        <td>{u.fullName}</td>
                        <td>{u.email}</td>
                        <td>{u.campaign?.name || 'Unassigned'}</td>
                        <td>{u.teamLeader?.fullName || 'None'}</td>
                        <td>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleAssignTeamLeader(u)}
                          >
                            Assign Team Leader
                          </button>
                        </td>
                      </tr>
                    ))}
                    {allUsers.filter(u => u.role === 'EMPLOYEE').length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center">No employees found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Team Leader Assignment Modal */}
      {showTeamLeaderModal && editingUserForTeamLeader && (
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
            <h3>Assign Team Leader</h3>
            <p className="text-small">Select a team leader for {editingUserForTeamLeader.fullName}</p>
            
            <div className="form-group" style={{ marginTop: 'var(--spacing-md)' }}>
              <label className="form-label">Team Leader:</label>
              <select
                className="form-input"
                value={selectedTeamLeaderId}
                onChange={(e) => setSelectedTeamLeaderId(e.target.value)}
              >
                <option value="">None (Unassign)</option>
                {allUsers
                  .filter(u => u.role === 'MANAGER' || u.role === 'EMPLOYEE')
                  .filter(u => u.id !== editingUserForTeamLeader.id)
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.email}) - {u.role}
                    </option>
                  ))}
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowTeamLeaderModal(false);
                  setEditingUserForTeamLeader(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveTeamLeader}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Create/Edit Modal */}
      {showCampaignModal && (
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
            maxHeight: '90vh',
            overflow: 'auto',
          }}>
            <h3>{editingCampaign ? 'Edit Campaign' : 'Create Campaign'}</h3>
            
            <div className="form-group">
              <label className="form-label">Campaign Name *</label>
              <input
                type="text"
                className="form-input"
                value={campaignForm.name}
                onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                placeholder="Enter campaign name"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                value={campaignForm.description}
                onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                placeholder="Enter description"
                rows={3}
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Time Zone</label>
              <select
                className="form-input"
                value={campaignForm.timeZone}
                onChange={(e) => setCampaignForm({ ...campaignForm, timeZone: e.target.value })}
              >
                <option value="Africa/Johannesburg">Africa/Johannesburg</option>
                <option value="UTC">UTC</option>
                <option value="Europe/London">Europe/London</option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
              </select>
            </div>
            
            <div style={{ marginTop: 'var(--spacing-md)', paddingTop: 'var(--spacing-md)', borderTop: '1px solid #e5e7eb' }}>
              <h4 style={{ marginBottom: 'var(--spacing-sm)' }}>Work Schedule</h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                <div className="form-group">
                  <label className="form-label">Work Start Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={campaignForm.workDayStart}
                    onChange={(e) => setCampaignForm({ ...campaignForm, workDayStart: e.target.value })}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Work End Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={campaignForm.workDayEnd}
                    onChange={(e) => setCampaignForm({ ...campaignForm, workDayEnd: e.target.value })}
                  />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
                <div className="form-group">
                  <label className="form-label">Lunch Start Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={campaignForm.lunchStart}
                    onChange={(e) => setCampaignForm({ ...campaignForm, lunchStart: e.target.value })}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Lunch End Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={campaignForm.lunchEnd}
                    onChange={(e) => setCampaignForm({ ...campaignForm, lunchEnd: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="form-group" style={{ marginTop: 'var(--spacing-md)' }}>
                <label className="form-label">Tea Breaks</label>
                {campaignForm.teaBreaks.map((tb, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center', marginBottom: 'var(--spacing-xs)' }}>
                    <input
                      type="time"
                      className="form-input"
                      value={tb.start}
                      onChange={(e) => {
                        const updated = [...campaignForm.teaBreaks];
                        updated[idx].start = e.target.value;
                        setCampaignForm({ ...campaignForm, teaBreaks: updated });
                      }}
                      style={{ flex: 1 }}
                    />
                    <span>to</span>
                    <input
                      type="time"
                      className="form-input"
                      value={tb.end}
                      onChange={(e) => {
                        const updated = [...campaignForm.teaBreaks];
                        updated[idx].end = e.target.value;
                        setCampaignForm({ ...campaignForm, teaBreaks: updated });
                      }}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => removeTeaBreak(idx)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center', marginTop: 'var(--spacing-xs)' }}>
                  <input
                    type="time"
                    className="form-input"
                    value={newTeaBreak.start}
                    onChange={(e) => setNewTeaBreak({ ...newTeaBreak, start: e.target.value })}
                    placeholder="Start"
                    style={{ flex: 1 }}
                  />
                  <span>to</span>
                  <input
                    type="time"
                    className="form-input"
                    value={newTeaBreak.end}
                    onChange={(e) => setNewTeaBreak({ ...newTeaBreak, end: e.target.value })}
                    placeholder="End"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={addTeaBreak}
                    disabled={!newTeaBreak.start || !newTeaBreak.end}
                  >
                    Add Break
                  </button>
                </div>
              </div>
            </div>
            
            <div className="form-group" style={{ marginTop: 'var(--spacing-md)' }}>
              <label className="form-label">Leave Approver Email</label>
              <input
                type="email"
                className="form-input"
                value={campaignForm.leaveApproverEmail}
                onChange={(e) => setCampaignForm({ ...campaignForm, leaveApproverEmail: e.target.value })}
                placeholder="leave-approver@company.com"
              />
              <p className="text-small" style={{ marginTop: '4px', color: 'var(--text-muted)' }}>
                This email will receive notifications when employees submit leave requests.
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowCampaignModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveCampaign}
                disabled={!campaignForm.name}
              >
                {editingCampaign ? 'Save Changes' : 'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Users Modal */}
      {showAssignModal && assigningCampaign && (
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
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
          }}>
            <h3>Assign Users to "{assigningCampaign.name}"</h3>
            <p className="text-small">Select employees to assign to this campaign</p>
            
            <div style={{ marginTop: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
              <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-sm)' }}>
                Selected: {selectedUserIds.length} users
              </div>
              
              <div style={{ maxHeight: '300px', overflow: 'auto', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)' }}>
                {allUsers.map(u => {
                  const isSelected = selectedUserIds.includes(u.id);
                  const isInOtherCampaign = u.campaign && u.campaign.id !== assigningCampaign.id;
                  
                  return (
                    <div
                      key={u.id}
                      style={{
                        padding: 'var(--spacing-sm)',
                        borderBottom: '1px solid var(--border-light)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'var(--card-light)' : 'transparent',
                      }}
                      onClick={() => toggleUserSelection(u.id)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleUserSelection(u.id)}
                        style={{ cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>{u.fullName}</div>
                        <div className="text-small">{u.email}</div>
                        {u.designation && <div className="text-smaller">{u.designation}</div>}
                      </div>
                      <div>
                        {isInOtherCampaign && (
                          <span className="badge badge-pending" style={{ fontSize: '11px' }}>
                            In: {u.campaign?.name}
                          </span>
                        )}
                        {u.campaign?.id === assigningCampaign.id && (
                          <span className="badge badge-active" style={{ fontSize: '11px' }}>
                            Currently Assigned
                          </span>
                        )}
                        {!u.campaign && (
                          <span className="badge badge-inactive" style={{ fontSize: '11px' }}>
                            Unassigned
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {allUsers.length === 0 && (
                  <div style={{ padding: 'var(--spacing-md)', textAlign: 'center' }}>
                    No users found
                  </div>
                )}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowAssignModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveAssignments}
              >
                Save Assignments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerDashboard;
