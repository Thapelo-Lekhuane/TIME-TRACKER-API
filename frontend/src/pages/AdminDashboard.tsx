import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';

interface User {
  id: string;
  email: string;
  fullName: string;
  designation?: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  status?: string;
  timeZone?: string;
  campaign?: { id: string; name: string } | null;
}

interface Campaign {
  id: string;
  name: string;
  description?: string;
  leaveApproverEmail?: string;
  timeZone?: string;
  workDayStart?: string;
  workDayEnd?: string;
  lunchStart?: string;
  lunchEnd?: string;
  teaBreaks?: Array<{ start: string; end: string }>;
  users?: User[];
}

interface EventType {
  id: string;
  name: string;
  category: 'WORK' | 'BREAK' | 'LEAVE' | 'OTHER';
  isPaid: boolean;
  isBreak: boolean;
  isGlobal: boolean;
  campaignId?: string | null;
  campaign?: { id: string; name: string } | null;
  active: boolean;
}

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [currentSection, setCurrentSection] = useState('adminDashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [allLeaveBalances, setAllLeaveBalances] = useState<any[]>([]);
  
  // Leave entitlement modal state
  const [showEntitlementModal, setShowEntitlementModal] = useState(false);
  const [entitlementForm, setEntitlementForm] = useState({
    userId: '',
    leaveTypeId: '',
    entitledDays: 0,
    year: new Date().getFullYear(),
  });

  // Event type modal state
  const [showEventTypeModal, setShowEventTypeModal] = useState(false);
  const [editingEventType, setEditingEventType] = useState<EventType | null>(null);
  const [eventTypeForm, setEventTypeForm] = useState({
    name: '',
    category: 'WORK' as 'WORK' | 'BREAK' | 'LEAVE' | 'OTHER',
    isPaid: true,
    isBreak: false,
    isGlobal: true,
    campaignId: '' as string | null,
    active: true,
  });

  // User edit modal state
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    fullName: '',
    designation: '',
    role: 'EMPLOYEE' as 'ADMIN' | 'MANAGER' | 'EMPLOYEE',
    campaignId: '' as string | null,
    status: 'active',
  });

  // Campaign modal state
  const [showCampaignModal, setShowCampaignModal] = useState(false);
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

  // Assign users modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningCampaign, setAssigningCampaign] = useState<Campaign | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  useEffect(() => {
    fetchUsers();
    fetchCampaigns();
    fetchEventTypes();
    fetchLeaveTypes();
    fetchAllLeaveBalances();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users', error);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const response = await api.get('/campaigns');
      setCampaigns(response.data);
    } catch (error) {
      console.error('Failed to fetch campaigns', error);
    }
  };

  const fetchEventTypes = async () => {
    try {
      const response = await api.get('/event-types');
      setEventTypes(response.data);
    } catch (error) {
      console.error('Failed to fetch event types', error);
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      const response = await api.get('/leave-types');
      setLeaveTypes(response.data);
    } catch (error) {
      console.error('Failed to fetch leave types', error);
    }
  };

  const fetchAllLeaveBalances = async () => {
    try {
      const response = await api.get(`/leave-balances/all?year=${new Date().getFullYear()}`);
      setAllLeaveBalances(response.data);
    } catch (error) {
      console.error('Failed to fetch leave balances', error);
    }
  };

  const handleAssignEntitlement = async () => {
    try {
      await api.post('/leave-balances/assign', entitlementForm);
      setShowEntitlementModal(false);
      setEntitlementForm({ userId: '', leaveTypeId: '', entitledDays: 0, year: new Date().getFullYear() });
      fetchAllLeaveBalances();
      alert('Leave entitlement assigned successfully');
    } catch (error: any) {
      console.error('Failed to assign entitlement', error);
      alert(error.response?.data?.message || 'Failed to assign entitlement');
    }
  };

  // User editing handlers
  const handleEditUser = (u: User) => {
    setEditingUser(u);
    setUserForm({
      fullName: u.fullName || '',
      designation: u.designation || '',
      role: u.role,
      campaignId: u.campaign?.id || null,
      status: u.status || 'active',
    });
    setShowUserModal(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    try {
      await api.patch(`/users/${editingUser.id}`, {
        fullName: userForm.fullName,
        designation: userForm.designation,
        role: userForm.role,
        campaignId: userForm.campaignId || null,
        status: userForm.status,
      });
      setShowUserModal(false);
      setEditingUser(null);
      fetchUsers();
      fetchCampaigns();
    } catch (error: any) {
      console.error('Failed to update user', error);
      alert(error.response?.data?.message || 'Failed to update user');
    }
  };

  const handleQuickRoleChange = async (userId: string, role: string) => {
    try {
      await api.patch(`/users/${userId}`, { role });
      fetchUsers();
    } catch (error) {
      console.error('Failed to update user role', error);
      alert('Failed to update user role');
    }
  };

  // Campaign handlers
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

  const handleEditCampaign = (c: Campaign) => {
    setEditingCampaign(c);
    setCampaignForm({
      name: c.name,
      description: c.description || '',
      timeZone: c.timeZone || 'Africa/Johannesburg',
      leaveApproverEmail: c.leaveApproverEmail || '',
      workDayStart: c.workDayStart || '',
      workDayEnd: c.workDayEnd || '',
      lunchStart: c.lunchStart || '',
      lunchEnd: c.lunchEnd || '',
      teaBreaks: (c.teaBreaks as Array<{ start: string; end: string }>) || [],
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
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    try {
      await api.delete(`/campaigns/${campaignId}`);
      fetchCampaigns();
      fetchUsers();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete campaign');
    }
  };

  const handleOpenAssignModal = (c: Campaign) => {
    setAssigningCampaign(c);
    setSelectedUserIds(c.users?.map(u => u.id) || []);
    setShowAssignModal(true);
  };

  const handleSaveAssignments = async () => {
    if (!assigningCampaign) return;
    try {
      await api.post(`/campaigns/${assigningCampaign.id}/users`, { userIds: selectedUserIds });
      setShowAssignModal(false);
      fetchCampaigns();
      fetchUsers();
    } catch (error: any) {
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

  // Event type handlers
  const handleCreateEventType = () => {
    setEditingEventType(null);
    setEventTypeForm({
      name: '',
      category: 'WORK',
      isPaid: true,
      isBreak: false,
      isGlobal: true,
      campaignId: null,
      active: true,
    });
    setShowEventTypeModal(true);
  };

  const handleEditEventType = (et: EventType) => {
    setEditingEventType(et);
    setEventTypeForm({
      name: et.name,
      category: et.category,
      isPaid: et.isPaid,
      isBreak: et.isBreak,
      isGlobal: et.isGlobal,
      campaignId: et.campaignId || null,
      active: et.active,
    });
    setShowEventTypeModal(true);
  };

  const handleSaveEventType = async () => {
    try {
      const payload = {
        name: eventTypeForm.name,
        category: eventTypeForm.category,
        isPaid: eventTypeForm.isPaid,
        isBreak: eventTypeForm.isBreak,
        isGlobal: eventTypeForm.isGlobal,
        campaignId: eventTypeForm.isGlobal ? null : (eventTypeForm.campaignId || null),
        active: eventTypeForm.active,
      };
      
      if (editingEventType) {
        await api.patch(`/event-types/${editingEventType.id}`, payload);
      } else {
        await api.post('/event-types', payload);
      }
      setShowEventTypeModal(false);
      fetchEventTypes();
    } catch (error: any) {
      console.error('Failed to save event type', error);
      alert(error.response?.data?.message || 'Failed to save event type');
    }
  };

  const handleDeleteEventType = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event type?')) return;
    try {
      await api.delete(`/event-types/${id}`);
      fetchEventTypes();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete event type');
    }
  };

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
              className={`sidebar-link ${currentSection === 'adminDashboard' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setCurrentSection('adminDashboard'); }}
            >
              Dashboard
            </a>
            <a
              href="#"
              className={`sidebar-link ${currentSection === 'users' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setCurrentSection('users'); }}
            >
              Users
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
              className={`sidebar-link ${currentSection === 'eventTypes' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setCurrentSection('eventTypes'); }}
            >
              Event Types
            </a>
            <a
              href="#"
              className={`sidebar-link ${currentSection === 'leaveTypes' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setCurrentSection('leaveTypes'); }}
            >
              Leave Types
            </a>
            <a
              href="#"
              className={`sidebar-link ${currentSection === 'leaveSettings' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setCurrentSection('leaveSettings'); }}
            >
              Leave Settings
            </a>
            <a
              href="#"
              className={`sidebar-link ${currentSection === 'leaveEntitlements' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setCurrentSection('leaveEntitlements'); }}
            >
              Leave Entitlements
            </a>
            <a
              href="#"
              className={`sidebar-link ${currentSection === 'reports' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setCurrentSection('reports'); }}
            >
              Reports
            </a>
          </nav>
        </div>
        
        <div className="main-content">
          {currentSection === 'adminDashboard' && (
            <div className="section">
              <h2>Admin Dashboard</h2>
              <p className="text-small">System administration and configuration</p>
              
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{users.length}</div>
                  <div className="stat-label">Total Users</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{campaigns.length}</div>
                  <div className="stat-label">Active Campaigns</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{eventTypes.length}</div>
                  <div className="stat-label">Event Types</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{leaveTypes.length}</div>
                  <div className="stat-label">Leave Types</div>
                </div>
              </div>
              
              <h3 style={{ marginTop: 'var(--spacing-lg)' }}>Users Overview</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Designation</th>
                      <th>Role</th>
                      <th>Campaign</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.slice(0, 10).map(u => (
                      <tr key={u.id}>
                        <td>{u.fullName}</td>
                        <td>{u.email}</td>
                        <td>{u.designation || '-'}</td>
                        <td>
                          <select
                            value={u.role}
                            onChange={(e) => handleQuickRoleChange(u.id, e.target.value)}
                            className="form-input"
                            style={{ padding: '4px 8px', fontSize: '13px', width: '120px' }}
                          >
                            <option value="EMPLOYEE">EMPLOYEE</option>
                            <option value="MANAGER">MANAGER</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        </td>
                        <td>{u.campaign?.name || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}</td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleEditUser(u)}>
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {users.length > 10 && (
                <p className="text-small" style={{ marginTop: 'var(--spacing-sm)' }}>
                  Showing 10 of {users.length} users. <a href="#" onClick={(e) => { e.preventDefault(); setCurrentSection('users'); }}>View all</a>
                </p>
              )}
            </div>
          )}
          
          {currentSection === 'users' && (
            <div className="section">
              <h2>Users Management</h2>
              <p className="text-small">Manage all system users, assign roles and campaigns</p>
              
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Designation</th>
                      <th>Role</th>
                      <th>Campaign</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>{u.fullName}</td>
                        <td>{u.email}</td>
                        <td>{u.designation || '-'}</td>
                        <td>
                          <span className={`badge ${u.role === 'ADMIN' ? 'badge-active' : u.role === 'MANAGER' ? 'badge-pending' : 'badge-inactive'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td>{u.campaign?.name || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}</td>
                        <td><span className="badge badge-active">{u.status || 'active'}</span></td>
                        <td>
                          <button className="btn btn-primary btn-sm" onClick={() => handleEditUser(u)}>
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {currentSection === 'campaigns' && (
            <div className="section">
              <h2>Campaigns Management</h2>
              <p className="text-small">Create and manage campaigns, assign employees and leave approvers</p>
              
              <button className="btn btn-primary" style={{ marginBottom: 'var(--spacing-md)' }} onClick={handleCreateCampaign}>
                Create New Campaign
              </button>
              
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Campaign Name</th>
                      <th>Description</th>
                      <th>Leave Approver Email</th>
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
                          <button className="btn btn-secondary btn-sm" style={{ marginRight: '8px' }} onClick={() => handleOpenAssignModal(c)}>
                            Assign Users
                          </button>
                          <button className="btn btn-secondary btn-sm" style={{ marginRight: '8px' }} onClick={() => handleEditCampaign(c)}>
                            Edit
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteCampaign(c.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {campaigns.length === 0 && (
                      <tr><td colSpan={5} className="text-center">No campaigns found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {currentSection === 'eventTypes' && (
            <div className="section">
              <h2>Event Types Configuration</h2>
              <p className="text-small">Manage time tracking event types. Global events are available to all employees, even without campaign assignment.</p>
              
              <button className="btn btn-primary" style={{ marginBottom: 'var(--spacing-md)' }} onClick={handleCreateEventType}>
                Create New Event Type
              </button>
              
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Event Type</th>
                      <th>Category</th>
                      <th>Paid</th>
                      <th>Is Break</th>
                      <th>Scope</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventTypes.map(et => (
                      <tr key={et.id}>
                        <td>{et.name}</td>
                        <td>
                          <span className={`badge ${et.category === 'WORK' ? 'badge-active' : et.category === 'BREAK' ? 'badge-pending' : 'badge-inactive'}`}>
                            {et.category}
                          </span>
                        </td>
                        <td>{et.isPaid ? 'Yes' : 'No'}</td>
                        <td>{et.isBreak ? 'Yes' : 'No'}</td>
                        <td>
                          {et.isGlobal ? (
                            <span className="badge badge-active">Global</span>
                          ) : (
                            <span className="badge badge-pending">{et.campaign?.name || 'Campaign-specific'}</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${et.active ? 'badge-active' : 'badge-inactive'}`}>
                            {et.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-secondary btn-sm" style={{ marginRight: '8px' }} onClick={() => handleEditEventType(et)}>
                            Edit
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteEventType(et.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {eventTypes.length === 0 && (
                      <tr><td colSpan={7} className="text-center">No event types found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {currentSection === 'leaveTypes' && (
            <div className="section">
              <h2>Leave Types Configuration</h2>
              <p className="text-small">All available leave types (as per company policy)</p>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Leave Type</th>
                      <th>Paid</th>
                      <th>Full Day</th>
                      <th>Half Day</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveTypes.map((lt, idx) => (
                      <tr key={lt.id}>
                        <td>{idx + 1}</td>
                        <td>{lt.name}</td>
                        <td>{lt.paid ? 'Yes' : 'No'}</td>
                        <td>{lt.fullDayAllowed ? 'Yes' : 'No'}</td>
                        <td>{lt.halfDayAllowed ? 'Yes' : 'No'}</td>
                        <td><span className={`badge ${lt.active ? 'badge-active' : 'badge-inactive'}`}>{lt.active ? 'Active' : 'Inactive'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {currentSection === 'leaveSettings' && (
            <div className="section">
              <h2>Leave Approval Settings</h2>
              <p className="text-small">Configure who receives leave request notifications for each campaign</p>
              
              <div style={{
                backgroundColor: '#dbeafe',
                border: '1px solid #2563eb',
                borderRadius: 'var(--radius)',
                padding: 'var(--spacing-md)',
                marginBottom: 'var(--spacing-lg)',
              }}>
                <h4 style={{ color: '#1d4ed8', marginBottom: 'var(--spacing-xs)' }}>How Leave Approvals Work</h4>
                <p style={{ color: '#1e40af', fontSize: '14px', margin: 0 }}>
                  When an employee submits a leave request, an email notification is sent to the Leave Approver 
                  configured for their campaign. The email includes the employee's name, leave type, dates, and reason.
                </p>
              </div>
              
              <h3>Leave Approvers by Campaign</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Leave Approver Email</th>
                      <th>Employees</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map(c => (
                      <tr key={c.id}>
                        <td><strong>{c.name}</strong></td>
                        <td>
                          {c.leaveApproverEmail ? (
                            <span style={{ color: 'var(--success)', fontWeight: 500 }}>{c.leaveApproverEmail}</span>
                          ) : (
                            <span style={{ color: 'var(--warning)' }}>Not configured - leave emails disabled</span>
                          )}
                        </td>
                        <td>{c.users?.length || 0} employees</td>
                        <td>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleEditCampaign(c)}
                          >
                            {c.leaveApproverEmail ? 'Change Approver' : 'Set Approver'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {campaigns.length === 0 && (
                      <tr><td colSpan={4} className="text-center">No campaigns found. Create a campaign first.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              <div style={{ marginTop: 'var(--spacing-lg)', padding: 'var(--spacing-md)', backgroundColor: 'var(--card-light)', borderRadius: 'var(--radius)' }}>
                <h4>Email Configuration</h4>
                <p className="text-small" style={{ marginBottom: 'var(--spacing-sm)' }}>
                  To enable email notifications, add these settings to your server's environment:
                </p>
                <pre style={{
                  backgroundColor: 'var(--card-medium)',
                  padding: 'var(--spacing-sm)',
                  borderRadius: 'var(--radius)',
                  fontSize: '13px',
                  overflow: 'auto',
                }}>
{`SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
SMTP_FROM=noreply@example.com`}
                </pre>
                <p className="text-small" style={{ marginTop: 'var(--spacing-sm)' }}>
                  If not configured, notifications will be logged to the server console instead.
                </p>
              </div>
            </div>
          )}
          
          {currentSection === 'leaveEntitlements' && (
            <div className="section">
              <h2>Leave Entitlements</h2>
              <p className="text-small">Assign and manage annual leave days for employees</p>
              
              <button className="btn btn-primary" style={{ marginBottom: 'var(--spacing-md)' }} onClick={() => setShowEntitlementModal(true)}>
                Assign Leave Entitlement
              </button>
              
              <h3>Current Entitlements ({new Date().getFullYear()})</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Leave Type</th>
                      <th>Entitled</th>
                      <th>Used</th>
                      <th>Pending</th>
                      <th>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allLeaveBalances.length === 0 ? (
                      <tr><td colSpan={6} className="text-center">No leave entitlements assigned yet</td></tr>
                    ) : (
                      allLeaveBalances.map(balance => (
                        <tr key={balance.id}>
                          <td>
                            <div style={{ fontWeight: 500 }}>{balance.user?.fullName || 'Unknown'}</div>
                            <div className="text-small">{balance.user?.email}</div>
                          </td>
                          <td>{balance.leaveType?.name}</td>
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
              
              <div style={{ marginTop: 'var(--spacing-lg)', backgroundColor: 'var(--card-light)', padding: 'var(--spacing-md)', borderRadius: 'var(--radius)' }}>
                <h4>Quick Assign Leave Days</h4>
                <p className="text-small">Use the button above to assign annual leave entitlements to employees. When leave is approved, the used days will automatically increase.</p>
              </div>
            </div>
          )}
          
          {currentSection === 'reports' && (
            <div className="section">
              <h2>System Reports</h2>
              <p className="text-small">Generate system-wide analytics and reports</p>
              <p className="text-small">Reports functionality coming soon...</p>
            </div>
          )}
        </div>
      </div>

      {/* User Edit Modal */}
      {showUserModal && editingUser && (
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
            <h3>Edit User</h3>
            <p className="text-small">{editingUser.email}</p>
            
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-input"
                value={userForm.fullName}
                onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Designation</label>
              <input
                type="text"
                className="form-input"
                value={userForm.designation}
                onChange={(e) => setUserForm({ ...userForm, designation: e.target.value })}
                placeholder="e.g., Sales Agent, Team Leader"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Role</label>
              <select
                className="form-input"
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value as any })}
              >
                <option value="EMPLOYEE">EMPLOYEE</option>
                <option value="MANAGER">MANAGER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">Assign to Campaign</label>
              <select
                className="form-input"
                value={userForm.campaignId || ''}
                onChange={(e) => setUserForm({ ...userForm, campaignId: e.target.value || null })}
              >
                <option value="">-- Not Assigned --</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-input"
                value={userForm.status}
                onChange={(e) => setUserForm({ ...userForm, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-lg)' }}>
              <button className="btn btn-secondary" onClick={() => setShowUserModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveUser}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Modal */}
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
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                value={campaignForm.description}
                onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
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
                This email will receive notifications when employees submit leave requests. Leave empty to disable email notifications.
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
              <button className="btn btn-secondary" onClick={() => setShowCampaignModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveCampaign} disabled={!campaignForm.name}>
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
            
            <div style={{ fontWeight: 600, margin: 'var(--spacing-sm) 0' }}>
              Selected: {selectedUserIds.length} users
            </div>
            
            <div style={{ maxHeight: '400px', overflow: 'auto', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)' }}>
              {users.map(u => {
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
            </div>
            
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
              <button className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveAssignments}>
                Save Assignments
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Type Modal */}
      {showEventTypeModal && (
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
            <h3>{editingEventType ? 'Edit Event Type' : 'Create Event Type'}</h3>
            
            <div className="form-group">
              <label className="form-label">Event Type Name *</label>
              <input
                type="text"
                className="form-input"
                value={eventTypeForm.name}
                onChange={(e) => setEventTypeForm({ ...eventTypeForm, name: e.target.value })}
                placeholder="e.g., Work Start, Lunch Break"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Category *</label>
              <select
                className="form-input"
                value={eventTypeForm.category}
                onChange={(e) => setEventTypeForm({ ...eventTypeForm, category: e.target.value as any })}
              >
                <option value="WORK">WORK</option>
                <option value="BREAK">BREAK</option>
                <option value="LEAVE">LEAVE</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={eventTypeForm.isPaid}
                    onChange={(e) => setEventTypeForm({ ...eventTypeForm, isPaid: e.target.checked })}
                  />
                  <span>Is Paid</span>
                </label>
              </div>
              
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={eventTypeForm.isBreak}
                    onChange={(e) => setEventTypeForm({ ...eventTypeForm, isBreak: e.target.checked })}
                  />
                  <span>Is Break</span>
                </label>
              </div>
            </div>
            
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={eventTypeForm.isGlobal}
                  onChange={(e) => setEventTypeForm({ ...eventTypeForm, isGlobal: e.target.checked })}
                />
                <span>Global Event (Available to all employees)</span>
              </label>
              <p className="text-small" style={{ marginTop: '4px', color: 'var(--text-muted)' }}>
                Global events can be used by all employees, even those not yet assigned to a campaign.
              </p>
            </div>
            
            {!eventTypeForm.isGlobal && (
              <div className="form-group">
                <label className="form-label">Campaign (Optional)</label>
                <select
                  className="form-input"
                  value={eventTypeForm.campaignId || ''}
                  onChange={(e) => setEventTypeForm({ ...eventTypeForm, campaignId: e.target.value || null })}
                >
                  <option value="">-- Select Campaign --</option>
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="text-small" style={{ marginTop: '4px', color: 'var(--text-muted)' }}>
                  If specified, this event type will only be available to employees in this campaign.
                </p>
              </div>
            )}
            
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={eventTypeForm.active}
                  onChange={(e) => setEventTypeForm({ ...eventTypeForm, active: e.target.checked })}
                />
                <span>Active</span>
              </label>
            </div>
            
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-lg)' }}>
              <button className="btn btn-secondary" onClick={() => setShowEventTypeModal(false)}>
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleSaveEventType}
                disabled={!eventTypeForm.name}
              >
                {editingEventType ? 'Save Changes' : 'Create Event Type'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Entitlement Modal */}
      {showEntitlementModal && (
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
            <h3>Assign Leave Entitlement</h3>
            <p className="text-small">Assign annual leave days to an employee for the selected year</p>
            
            <div className="form-group">
              <label className="form-label">Employee *</label>
              <select
                className="form-input"
                value={entitlementForm.userId}
                onChange={(e) => setEntitlementForm({ ...entitlementForm, userId: e.target.value })}
              >
                <option value="">-- Select Employee --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">Leave Type *</label>
              <select
                className="form-input"
                value={entitlementForm.leaveTypeId}
                onChange={(e) => setEntitlementForm({ ...entitlementForm, leaveTypeId: e.target.value })}
              >
                <option value="">-- Select Leave Type --</option>
                {leaveTypes
                  .filter(lt => lt.name !== 'Present' && lt.name !== 'Absent' && lt.name !== 'AWOL' && lt.name !== 'Terminated / Leaver')
                  .map(lt => (
                    <option key={lt.id} value={lt.id}>{lt.name} ({lt.paid ? 'Paid' : 'Unpaid'})</option>
                  ))}
              </select>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
              <div className="form-group">
                <label className="form-label">Year</label>
                <select
                  className="form-input"
                  value={entitlementForm.year}
                  onChange={(e) => setEntitlementForm({ ...entitlementForm, year: parseInt(e.target.value) })}
                >
                  <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                  <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                  <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Entitled Days *</label>
                <input
                  type="number"
                  className="form-input"
                  min="0"
                  step="0.5"
                  value={entitlementForm.entitledDays}
                  onChange={(e) => setEntitlementForm({ ...entitlementForm, entitledDays: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-lg)' }}>
              <button className="btn btn-secondary" onClick={() => setShowEntitlementModal(false)}>
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleAssignEntitlement}
                disabled={!entitlementForm.userId || !entitlementForm.leaveTypeId || entitlementForm.entitledDays <= 0}
              >
                Assign Entitlement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
