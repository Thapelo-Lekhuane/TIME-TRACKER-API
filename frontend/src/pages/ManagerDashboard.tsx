import { useState, useEffect } from 'react';
import React from 'react';
import ExcelJS from 'exceljs';
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
  workDayStart?: string | null;
  workDayEnd?: string | null;
  lunchStart?: string | null;
  lunchEnd?: string | null;
  teaBreaks?: { start: string; end: string }[] | null;
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
  
  // Weekly attendance state
  const [weeklyAttendanceData, setWeeklyAttendanceData] = useState<any>(null);
  const [weeklyWeekStart, setWeeklyWeekStart] = useState<string>('');
  const [weeklyCampaign, setWeeklyCampaign] = useState<string>('');
  const [reportWeeksCount, setReportWeeksCount] = useState<1 | 2 | 3 | 4>(1);
  
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
  const [selectedEmployeesForTeamLeader, setSelectedEmployeesForTeamLeader] = useState<string[]>([]);
  const [confirmationStep, setConfirmationStep] = useState(1); // 1 = select employees, 2 = confirm

  const addDays = (dateStr: string, days: number): string => {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const fetchWeeklyAttendance = async () => {
    if (!weeklyWeekStart) return;

    try {
      if (reportWeeksCount === 1) {
        let url = `/reports/attendance/weekly?weekStart=${weeklyWeekStart}`;
        if (weeklyCampaign) url += `&campaignId=${weeklyCampaign}`;
        const response = await api.get(url);
        setWeeklyAttendanceData(response.data);
      } else {
        const toDate = addDays(weeklyWeekStart, reportWeeksCount * 7 - 1);
        let url = `/reports/attendance/daily?from=${weeklyWeekStart}&to=${toDate}`;
        if (weeklyCampaign) url += `&campaignId=${weeklyCampaign}`;
        const response = await api.get(url);
        const rangeData = response.data as { columns: string[]; rows: any[] };
        const today = new Date().toISOString().split('T')[0];
        const dateCols = rangeData.columns.slice(3);
        const rowsWithTotals = rangeData.rows.map((row: any) => {
          let totalWorkMinutes = 0;
          for (const date of dateCols) {
            if (date <= today && row[date]?.workMinutes) totalWorkMinutes += row[date].workMinutes;
          }
          const totalWorkHours = parseFloat((totalWorkMinutes / 60).toFixed(2));
          const newRow: any = { ...row, totalWorkHours, totalWorkMinutes };
          for (const date of dateCols) {
            if (date > today) newRow[date] = null;
          }
          return newRow;
        });
        setWeeklyAttendanceData({
          columns: rangeData.columns,
          rows: rowsWithTotals,
          weekStart: weeklyWeekStart,
          weekEnd: toDate,
        });
      }
    } catch (error) {
      console.error('Failed to fetch weekly attendance', error);
      alert('Failed to fetch weekly attendance data.');
    }
  };

  useEffect(() => {
    fetchCampaigns();
    fetchAllUsers();
    // Set default week start to Monday of current week
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(today.setDate(diff));
    setWeeklyWeekStart(monday.toISOString().split('T')[0]);
  }, []);
  
  useEffect(() => {
    if (weeklyWeekStart) {
      fetchWeeklyAttendance();
    }
  }, [weeklyWeekStart, weeklyCampaign, reportWeeksCount]);

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
      // Don't auto-select first campaign - let user choose "All Campaigns" if they want
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

  /** Returns the first Monday of the given month (YYYY-MM) as YYYY-MM-DD */
  const getFirstMondayOfMonth = (monthStr: string): string => {
    if (!monthStr || monthStr.length < 7) return '';
    const [y, m] = monthStr.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const day = first.getDay();
    const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
    const monday = new Date(y, m - 1, 1 + diff);
    return monday.toISOString().split('T')[0];
  };

  const exportWeeklyReportCSV = () => {
    if (!weeklyAttendanceData?.columns || !weeklyAttendanceData?.rows?.length) {
      alert('Load a report first before exporting.');
      return;
    }
    const cols = [...weeklyAttendanceData.columns, 'Total Hours'];
    const escape = (v: unknown): string => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = cols.map(escape).join(',');
    const dateCols = weeklyAttendanceData.columns.slice(3);
    const rows = weeklyAttendanceData.rows
      .sort((a: any, b: any) => (a.campaign || 'ZZZ').localeCompare(b.campaign || 'ZZZ'))
      .map((row: any) => {
        const cells = [
          row.agentName ?? '',
          row.teamLeader ?? '',
          row.campaign ?? '',
          ...dateCols.map((d: string) => {
            const data = row[d];
            if (!data) return '';
            const parts = [data.status || ''];
            if (data.workHours > 0) parts.push(`${data.workHours.toFixed(1)}h`);
            if (data.lateMinutes > 0) parts.push(`Late: ${data.lateMinutes}m`);
            return parts.join(' ');
          }),
          (row.totalWorkHours ?? 0).toFixed(1),
        ];
        return cells.map(escape).join(',');
      });
    const csv = [header, ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `weekly-attendance-${weeklyWeekStart || 'report'}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const hexToArgb = (hex: string): string => {
    const h = hex.replace('#', '');
    if (h.length === 6) return 'FF' + h.toUpperCase();
    return 'FF' + (h.length === 8 ? h : h.slice(-6)).toUpperCase();
  };

  const getStatusColorHex = (status: string, _campaignBg: string): string => {
    const statusLower = (status || '').toLowerCase();
    if (statusLower.includes('present')) return '#d1fae5';
    if (statusLower.includes('day off')) return '#f3f4f6';
    if (statusLower.includes('annual leave')) return '#dbeafe';
    if (statusLower.includes('sick leave')) return '#fce7f3';
    if (statusLower.includes('maternity') || statusLower.includes('paternity')) return '#fef3c7';
    if (statusLower.includes('absent')) return '#fee2e2';
    return '#f3f4f6';
  };

  const exportWeeklyReportExcel = async () => {
    if (!weeklyAttendanceData?.columns || !weeklyAttendanceData?.rows?.length) {
      alert('Load a report first before exporting.');
      return;
    }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Attendance', { views: [{ state: 'frozen', ySplit: 1 }] });
    const dateCols = weeklyAttendanceData.columns.slice(3);
    const headerRow = [...weeklyAttendanceData.columns, 'Total Hours'];
    ws.addRow(headerRow);
    const headerRowObj = ws.getRow(1);
    headerRowObj.font = { bold: true };
    headerRowObj.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    const sortedRows = [...weeklyAttendanceData.rows].sort((a: any, b: any) =>
      (a.campaign || 'ZZZ').localeCompare(b.campaign || 'ZZZ')
    );
    const today = new Date().toISOString().split('T')[0];
    for (const row of sortedRows) {
      const bgHex = getCampaignColorHex(row.campaign);
      const campaignArgb = hexToArgb(bgHex);
      const cells: (string | number)[] = [
        row.agentName ?? '',
        row.teamLeader ?? '',
        row.campaign ?? '',
      ];
      for (const date of dateCols) {
        const data = row[date];
        if (date > today || !data) {
          cells.push('');
        } else {
          const parts = [data.status || ''];
          if (data.workHours > 0) parts.push(`${data.workHours.toFixed(1)}h`);
          if (data.lateMinutes > 0) parts.push(`Late: ${data.lateMinutes}m`);
          cells.push(parts.join(' '));
        }
      }
      cells.push((row.totalWorkHours ?? 0).toFixed(1));
      const added = ws.addRow(cells);
      added.eachCell((cell, colNumber) => {
        if (colNumber <= 3 || colNumber === headerRow.length) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: campaignArgb } };
        } else {
          const date = dateCols[colNumber - 4];
          const data = row[date];
          const status = data?.status || '';
          const fillHex = getStatusColorHex(status, bgHex);
          const fillArgb = hexToArgb(fillHex.startsWith('#') ? fillHex : '#ffffff');
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillArgb } };
        }
      });
    }
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `weekly-attendance-${weeklyWeekStart || 'report'}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
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

  // Generate consistent color for each campaign based on name
  const getCampaignColor = (campaignName: string | null | undefined): string => {
    if (!campaignName) return '#f3f4f6';
    // Hash campaign name to get consistent color
    let hash = 0;
    for (let i = 0; i < campaignName.length; i++) {
      hash = campaignName.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Generate pastel colors (light backgrounds)
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 40%, 95%)`; // Light pastel color
  };

  const getCampaignBorderColor = (campaignName: string | null | undefined): string => {
    if (!campaignName) return '#e5e7eb';
    let hash = 0;
    for (let i = 0; i < campaignName.length; i++) {
      hash = campaignName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 60%, 50%)`; // More saturated border color
  };

  /** Light pastel hex for Excel (same hue as getCampaignColor) */
  const getCampaignColorHex = (campaignName: string | null | undefined): string => {
    if (!campaignName) return '#f3f4f6';
    let hash = 0;
    for (let i = 0; i < campaignName.length; i++) {
      hash = campaignName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    const s = 0.4, l = 0.95;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + hue / 30) % 12;
      return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    };
    const r = Math.round(f(0) * 255);
    const g = Math.round(f(8) * 255);
    const b = Math.round(f(4) * 255);
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  };

  const exportCSV = async () => {
    try {
      let url = '/api/reports/attendance/';
      let filename = '';
      
      if (dateFilterType === 'daily') {
        url += `daily/export?date=${selectedDate}`;
        filename = `attendance-daily-${selectedDate}.csv`;
      } else if (dateFilterType === 'weekly' || dateFilterType === 'monthly') {
        if (!dateRange.from || !dateRange.to) {
          alert('Please select date range for weekly/monthly export');
          return;
        }
        url += `range/export?from=${dateRange.from}&to=${dateRange.to}`;
        filename = `attendance-${dateFilterType}-${dateRange.from}-to-${dateRange.to}.csv`;
      } else {
        url += `daily/export?date=${selectedDate}`;
        filename = `attendance-daily-${selectedDate}.csv`;
      }
      
      if (selectedCampaign) {
        url += `&campaignId=${selectedCampaign}`;
      }
      
      const response = await fetch(`/api${url}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const blob = await response.blob();
      const urlObj = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = urlObj;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(urlObj);
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
      workDayStart: (campaign.workDayStart ?? '') || '',
      workDayEnd: (campaign.workDayEnd ?? '') || '',
      lunchStart: (campaign.lunchStart ?? '') || '',
      lunchEnd: (campaign.lunchEnd ?? '') || '',
      teaBreaks: (campaign.teaBreaks ?? []) || [],
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
    if (!user.campaign) {
      alert('This employee is not assigned to a campaign. Please assign them to a campaign first.');
      return;
    }
    
    setEditingUserForTeamLeader(user);
    setSelectedEmployeesForTeamLeader([]);
    setConfirmationStep(1);
    setShowTeamLeaderModal(true);
  };

  const handleSaveTeamLeader = async () => {
    if (!editingUserForTeamLeader || confirmationStep !== 2 || selectedEmployeesForTeamLeader.length === 0) return;
    
    try {
      const teamLeaderId = selectedEmployeesForTeamLeader[0];
      const campaignId = editingUserForTeamLeader.campaign?.id;
      
      if (!campaignId) {
        alert('Campaign ID is missing');
        return;
      }
      
      // Get all employees in the campaign (excluding managers)
      const employeesToAssign = allUsers.filter(u => 
        u.role === 'EMPLOYEE' && 
        u.campaign?.id === campaignId
      );
      
      if (employeesToAssign.length === 0) {
        alert('No employees found in this campaign');
        return;
      }
      
      // Use bulk assignment endpoint
      const response = await api.post('/users/assign-team-leader', {
        campaignId: campaignId,
        teamLeaderId: teamLeaderId,
      });
      
      const teamLeader = allUsers.find(u => u.id === teamLeaderId);
      alert(`Successfully assigned ${response.data.assignedCount} employee(s) to ${teamLeader?.fullName} as team leader. Emails have been sent.`);
      setShowTeamLeaderModal(false);
      setEditingUserForTeamLeader(null);
      setSelectedEmployeesForTeamLeader([]);
      setConfirmationStep(1);
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
                
                {dateFilterType === 'weekly' && (
                  <>
                    <div className="filter-group">
                      <label className="form-label">Week Start (Monday):</label>
                      <input
                        type="date"
                        className="form-input"
                        value={dateRange.from}
                        onChange={(e) => {
                          const range = getWeekRange(e.target.value);
                          setDateRange(range);
                        }}
                      />
                    </div>
                    <div className="filter-group">
                      <label className="form-label">Week End (Sunday):</label>
                      <input
                        type="date"
                        className="form-input"
                        value={dateRange.to}
                        readOnly
                        style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
                      />
                    </div>
                  </>
                )}
                {dateFilterType === 'monthly' && (
                  <>
                    <div className="filter-group">
                      <label className="form-label">Month:</label>
                      <input
                        type="month"
                        className="form-input"
                        value={dateRange.from ? dateRange.from.substring(0, 7) : ''}
                        onChange={(e) => {
                          const month = e.target.value; // Format: YYYY-MM
                          if (month) {
                            const range = getMonthRange(month + '-01');
                            setDateRange(range);
                          }
                        }}
                      />
                    </div>
                    <div className="filter-group">
                      <label className="form-label">From:</label>
                      <input
                        type="date"
                        className="form-input"
                        value={dateRange.from}
                        readOnly
                        style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
                      />
                    </div>
                    <div className="filter-group">
                      <label className="form-label">To:</label>
                      <input
                        type="date"
                        className="form-input"
                        value={dateRange.to}
                        readOnly
                        style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
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
                      {dateFilterType === 'daily' ? (
                        <>
                          <th>Today Status</th>
                          <th>Hours Worked</th>
                        </>
                      ) : (
                        <>
                          {attendanceData?.columns?.slice(3).map((col: string) => (
                            <th key={col}>{col}</th>
                          ))}
                          <th>Total Hours</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      if (!attendanceData?.rows || attendanceData.rows.length === 0) {
                        return (
                          <tr>
                            <td colSpan={dateFilterType === 'daily' ? 5 : (attendanceData?.columns?.length || 5) + 1} className="text-center">No data available</td>
                          </tr>
                        );
                      }
                      
                      // Sort rows by campaign name to group them
                      const sortedRows = [...attendanceData.rows].sort((a, b) => {
                        const campaignA = a.campaign || 'ZZZ';
                        const campaignB = b.campaign || 'ZZZ';
                        return campaignA.localeCompare(campaignB);
                      });
                      
                      let currentCampaign = '';
                      let totalHours = 0;
                      
                      return sortedRows.map((row: any, idx: number) => {
                        const campaignChanged = currentCampaign !== row.campaign;
                        currentCampaign = row.campaign || '';
                        
                        let rowHours = 0;
                        if (dateFilterType === 'daily') {
                          const dateData = row[selectedDate];
                          rowHours = dateData?.workHours || 0;
                        } else {
                          // Calculate total hours for range
                          attendanceData.columns.slice(3).forEach((col: string) => {
                            const dateData = row[col];
                            if (dateData?.workHours) {
                              rowHours += dateData.workHours;
                            }
                          });
                        }
                        totalHours += rowHours;
                        
                        const bgColor = getCampaignColor(row.campaign);
                        const borderColor = getCampaignBorderColor(row.campaign);
                        
                        return (
                          <React.Fragment key={idx}>
                            {campaignChanged && idx > 0 && (
                              <tr style={{ height: '4px', backgroundColor: '#e5e7eb' }}>
                                <td colSpan={dateFilterType === 'daily' ? 5 : (attendanceData.columns.length + 1)}></td>
                              </tr>
                            )}
                            <tr style={{ 
                              backgroundColor: bgColor,
                              borderLeft: `4px solid ${borderColor}`,
                            }}>
                              <td>{row.agentName}</td>
                              <td>{row.teamLeader}</td>
                              <td><strong>{row.campaign || 'Unassigned'}</strong></td>
                              {dateFilterType === 'daily' ? (
                                <>
                                  <td>
                                    <span className={`badge badge-${(row[selectedDate]?.status || 'Absent').toLowerCase().replace(' ', '-')}`}>
                                      {row[selectedDate]?.status || 'Absent'}
                                    </span>
                                  </td>
                                  <td>{rowHours.toFixed(1)}h</td>
                                </>
                              ) : (
                                <>
                                  {attendanceData.columns.slice(3).map((col: string) => {
                                    const dateData = row[col];
                                    return (
                                      <td key={col}>
                                        {dateData ? (
                                          <>
                                            <div>{dateData.status}</div>
                                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                              {dateData.workHours.toFixed(1)}h
                                            </div>
                                          </>
                                        ) : '-'}
                                      </td>
                                    );
                                  })}
                                  <td><strong>{rowHours.toFixed(1)}h</strong></td>
                                </>
                              )}
                            </tr>
                          </React.Fragment>
                        );
                      }).concat(
                        <tr key="total" style={{ 
                          backgroundColor: '#f3f4f6',
                          fontWeight: 'bold',
                          borderTop: '2px solid #2563eb',
                        }}>
                          <td colSpan={dateFilterType === 'daily' ? 4 : attendanceData.columns.length - 1}>
                            <strong>Total Hours</strong>
                          </td>
                          <td>
                            <strong>{totalHours.toFixed(1)}h</strong>
                          </td>
                        </tr>
                      );
                    })()}
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
                    <>
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
                    </>
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {currentSection === 'reports' && (
            <div className="section">
              <h2>Weekly Team Attendance</h2>
              <p className="text-small">View weekly attendance with total hours worked</p>
              
              <div className="filters" style={{ marginBottom: 'var(--spacing-md)' }}>
                <div className="filter-group">
                  <label className="form-label">Month:</label>
                  <input
                    type="month"
                    className="form-input"
                    value={weeklyWeekStart ? weeklyWeekStart.substring(0, 7) : ''}
                    onChange={(e) => {
                      const month = e.target.value;
                      if (month) {
                        const firstMonday = getFirstMondayOfMonth(month);
                        if (firstMonday) setWeeklyWeekStart(firstMonday);
                      }
                    }}
                  />
                </div>
                <div className="filter-group">
                  <label className="form-label">Week Start (Monday):</label>
                  <input
                    type="date"
                    className="form-input"
                    value={weeklyWeekStart}
                    onChange={(e) => {
                      setWeeklyWeekStart(e.target.value);
                    }}
                  />
                </div>
                <div className="filter-group">
                  <label className="form-label">Weeks:</label>
                  <select
                    className="form-input"
                    style={{ width: '90px' }}
                    value={reportWeeksCount}
                    onChange={(e) => setReportWeeksCount(Number(e.target.value) as 1 | 2 | 3 | 4)}
                  >
                    <option value={1}>1 week</option>
                    <option value={2}>2 weeks</option>
                    <option value={3}>3 weeks</option>
                    <option value={4}>4 weeks</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label className="form-label">Campaign:</label>
                  <select
                    className="form-input"
                    style={{ width: '200px' }}
                    value={weeklyCampaign}
                    onChange={(e) => {
                      setWeeklyCampaign(e.target.value);
                    }}
                  >
                    <option value="">All Campaigns</option>
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-primary btn-sm" onClick={fetchWeeklyAttendance}>
                  Load Report
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={exportWeeklyReportCSV}
                  disabled={!weeklyAttendanceData?.rows?.length}
                  title={weeklyAttendanceData?.rows?.length ? 'Download as CSV' : 'Load a report first'}
                >
                  Export CSV
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={exportWeeklyReportExcel}
                  disabled={!weeklyAttendanceData?.rows?.length}
                  title={weeklyAttendanceData?.rows?.length ? 'Download as Excel with colors' : 'Load a report first'}
                >
                  Export Excel (with colors)
                </button>
              </div>
              
              {weeklyAttendanceData && (
                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table style={{ minWidth: '800px', fontSize: '14px' }}>
                    <thead>
                      <tr>
                        {weeklyAttendanceData.columns.map((col: string, idx: number) => (
                          <th key={idx} style={{ 
                            position: idx < 3 ? 'sticky' : 'relative',
                            left: idx === 0 ? 0 : idx === 1 ? '150px' : idx === 2 ? '300px' : 'auto',
                            backgroundColor: '#f9fafb',
                            zIndex: idx < 3 ? 10 : 1,
                            borderRight: idx < 3 ? '2px solid #e5e7eb' : 'none',
                            padding: '10px',
                            textAlign: 'left',
                            fontWeight: 600,
                          }}>
                            {col}
                          </th>
                        ))}
                        <th style={{ 
                          position: 'sticky',
                          right: 0,
                          backgroundColor: '#f9fafb',
                          zIndex: 10,
                          borderLeft: '2px solid #e5e7eb',
                          padding: '10px',
                          fontWeight: 600,
                        }}>Total Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        if (!weeklyAttendanceData.rows || weeklyAttendanceData.rows.length === 0) {
                          return (
                            <tr>
                              <td colSpan={weeklyAttendanceData.columns.length + 1} className="text-center">No data available</td>
                            </tr>
                          );
                        }
                        
                        // Sort rows by campaign to group them
                        const sortedRows = [...weeklyAttendanceData.rows].sort((a, b) => {
                          const campaignA = a.campaign || 'ZZZ';
                          const campaignB = b.campaign || 'ZZZ';
                          return campaignA.localeCompare(campaignB);
                        });
                        
                        const dateColumns = weeklyAttendanceData.columns.slice(3);
                        let currentCampaign = '';
                        let grandTotalHours = 0;
                        
                        const rows = sortedRows.map((row: any, rowIdx: number) => {
                          const campaignChanged = currentCampaign !== row.campaign;
                          currentCampaign = row.campaign || '';
                          
                          const bgColor = getCampaignColor(row.campaign);
                          const borderColor = getCampaignBorderColor(row.campaign);
                          const rowTotalHours = row.totalWorkHours || 0;
                          grandTotalHours += rowTotalHours;
                          
                          return (
                            <React.Fragment key={rowIdx}>
                              {campaignChanged && rowIdx > 0 && (
                                <tr style={{ height: '4px', backgroundColor: '#e5e7eb' }}>
                                  <td colSpan={weeklyAttendanceData.columns.length + 1}></td>
                                </tr>
                              )}
                              <tr style={{ backgroundColor: bgColor }}>
                                <td style={{ 
                                  position: 'sticky',
                                  left: 0,
                                  backgroundColor: bgColor,
                                  zIndex: 5,
                                  borderRight: '2px solid #e5e7eb',
                                  borderLeft: `4px solid ${borderColor}`,
                                  padding: '10px',
                                }}>{row.agentName}</td>
                                <td style={{ 
                                  position: 'sticky',
                                  left: '150px',
                                  backgroundColor: bgColor,
                                  zIndex: 5,
                                  borderRight: '2px solid #e5e7eb',
                                  padding: '10px',
                                }}>{row.teamLeader}</td>
                                <td style={{ 
                                  position: 'sticky',
                                  left: '300px',
                                  backgroundColor: bgColor,
                                  zIndex: 5,
                                  borderRight: '2px solid #e5e7eb',
                                  padding: '10px',
                                  fontWeight: 600,
                                }}><strong>{row.campaign || 'Unassigned'}</strong></td>
                                {dateColumns.map((date: string) => {
                                  const dateData = row[date];
                                  const today = new Date().toISOString().split('T')[0];
                                  const isFutureDate = date > today;
                                  
                                  // If future date or no data, show blank
                                  if (isFutureDate || !dateData) {
                                    return (
                                      <td 
                                        key={date}
                                        style={{
                                          backgroundColor: bgColor,
                                          textAlign: 'center',
                                          padding: '8px',
                                          border: '1px solid #e5e7eb',
                                        }}
                                      >
                                        {isFutureDate ? '-' : ''}
                                      </td>
                                    );
                                  }
                                  
                                  const status = dateData?.status || 'Absent';
                                  const getStatusColor = (s: string) => {
                                    const statusLower = s.toLowerCase();
                                    if (statusLower.includes('present')) return '#d1fae5'; // Light green
                                    if (statusLower.includes('day off')) return '#f3f4f6'; // Gray
                                    if (statusLower.includes('annual leave')) return '#dbeafe'; // Light blue
                                    if (statusLower.includes('sick leave')) return '#fce7f3'; // Light pink
                                    if (statusLower.includes('maternity') || statusLower.includes('paternity')) return '#fef3c7'; // Yellow
                                    if (statusLower.includes('absent')) return '#fee2e2'; // Red
                                    return bgColor; // Use campaign color as fallback
                                  };
                                  return (
                                    <td 
                                      key={date}
                                      style={{
                                        backgroundColor: getStatusColor(status),
                                        textAlign: 'center',
                                        padding: '8px',
                                        border: '1px solid #e5e7eb',
                                      }}
                                    >
                                      <div style={{ fontWeight: 500 }}>{status}</div>
                                      {dateData?.workHours > 0 && (
                                        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                                          {dateData.workHours.toFixed(1)}h
                                        </div>
                                      )}
                                      {dateData?.lateMinutes > 0 && (
                                        <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: 'bold', marginTop: '2px' }}>
                                          Late: {dateData.lateMinutes}m
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                                <td style={{ 
                                  position: 'sticky',
                                  right: 0,
                                  backgroundColor: bgColor,
                                  zIndex: 5,
                                  borderLeft: '2px solid #e5e7eb',
                                  fontWeight: 'bold',
                                  textAlign: 'center',
                                  padding: '10px',
                                }}>
                                  {rowTotalHours.toFixed(1)}h
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        });
                        
                        // Add total row
                        rows.push(
                          <tr key="total" style={{ 
                            backgroundColor: '#f3f4f6',
                            fontWeight: 'bold',
                            borderTop: '2px solid #2563eb',
                          }}>
                            <td colSpan={weeklyAttendanceData.columns.length} style={{ padding: '10px' }}>
                              <strong>Total Hours</strong>
                            </td>
                            <td style={{ 
                              position: 'sticky',
                              right: 0,
                              backgroundColor: '#f3f4f6',
                              zIndex: 5,
                              borderLeft: '2px solid #e5e7eb',
                              textAlign: 'center',
                              padding: '10px',
                            }}>
                              <strong>{grandTotalHours.toFixed(1)}h</strong>
                            </td>
                          </tr>
                        );
                        
                        return rows;
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
              
              {!weeklyAttendanceData && (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)', color: '#6b7280' }}>
                  Select a week start date and click "Load Report" to view weekly attendance
                </div>
              )}
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
                    {(() => {
                      const employees = allUsers.filter(u => u.role === 'EMPLOYEE');
                      // Sort by campaign to group them
                      const sortedEmployees = [...employees].sort((a, b) => {
                        const campaignA = a.campaign?.name || 'ZZZ';
                        const campaignB = b.campaign?.name || 'ZZZ';
                        return campaignA.localeCompare(campaignB);
                      });
                      
                      let currentCampaign = '';
                      return sortedEmployees.map((u, idx) => {
                        const campaignChanged = currentCampaign !== (u.campaign?.name || '');
                        currentCampaign = u.campaign?.name || '';
                        const bgColor = getCampaignColor(u.campaign?.name || undefined);
                        const borderColor = getCampaignBorderColor(u.campaign?.name || undefined);
                        
                        return (
                          <React.Fragment key={u.id}>
                            {campaignChanged && idx > 0 && (
                              <tr style={{ height: '4px', backgroundColor: '#e5e7eb' }}>
                                <td colSpan={5}></td>
                              </tr>
                            )}
                            <tr style={{ 
                              backgroundColor: bgColor,
                              borderLeft: `4px solid ${borderColor}`,
                            }}>
                              <td>{u.fullName}</td>
                              <td>{u.email}</td>
                              <td><strong>{u.campaign?.name || 'Unassigned'}</strong></td>
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
                          </React.Fragment>
                        );
                      });
                    })()}
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
      {showTeamLeaderModal && editingUserForTeamLeader && editingUserForTeamLeader.campaign && (
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
            maxWidth: '800px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <h3>Assign Team Leader for Campaign</h3>
            <p className="text-small">
              Campaign: <strong>{editingUserForTeamLeader.campaign.name}</strong>
            </p>
            
            {confirmationStep === 1 ? (
              <>
                <div style={{ marginTop: 'var(--spacing-md)' }}>
                  <p style={{ marginBottom: 'var(--spacing-md)', fontWeight: 500 }}>
                    Select ONE team leader for this campaign. All employees (except managers) will be assigned to this team leader:
                  </p>
                  
                  {(() => {
                    const campaignId = editingUserForTeamLeader.campaign?.id;
                    // Get all users from the same campaign who can be team leaders (EMPLOYEE or MANAGER role, but exclude MANAGER role for assignment)
                    const potentialTeamLeaders = campaignId
                      ? allUsers.filter(u => 
                          (u.role === 'EMPLOYEE' || u.role === 'MANAGER') && 
                          u.campaign?.id === campaignId
                        )
                      : [];
                    
                    // Get all employees who will be assigned (excluding managers)
                    const employeesToAssign = campaignId
                      ? allUsers.filter(u => 
                          u.role === 'EMPLOYEE' && 
                          u.campaign?.id === campaignId
                        )
                      : [];
                    
                    return (
                      <>
                        <div className="form-group" style={{ marginTop: 'var(--spacing-md)' }}>
                          <label className="form-label">Select Team Leader:</label>
                          <select
                            className="form-input"
                            value={selectedEmployeesForTeamLeader[0] || ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                setSelectedEmployeesForTeamLeader([e.target.value]);
                              } else {
                                setSelectedEmployeesForTeamLeader([]);
                              }
                            }}
                            style={{ width: '100%' }}
                          >
                            <option value="">-- Select Team Leader --</option>
                            {potentialTeamLeaders.map(u => (
                              <option key={u.id} value={u.id}>
                                {u.fullName} ({u.email}) - {u.role}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        {selectedEmployeesForTeamLeader[0] && (
                          <div style={{ marginTop: 'var(--spacing-md)' }}>
                            <p style={{ fontWeight: 500, marginBottom: 'var(--spacing-sm)' }}>
                              Employees who will be assigned to this team leader ({employeesToAssign.length}):
                            </p>
                            <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                              <table>
                                <thead>
                                  <tr>
                                    <th>Employee Name</th>
                                    <th>Email</th>
                                    <th>Current Team Leader</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {employeesToAssign.map((employee) => {
                                    const bgColor = getCampaignColor(employee.campaign?.name);
                                    const borderColor = getCampaignBorderColor(employee.campaign?.name);
                                    
                                    return (
                                      <tr 
                                        key={employee.id} 
                                        style={{ 
                                          backgroundColor: bgColor,
                                          borderLeft: `4px solid ${borderColor}`,
                                        }}
                                      >
                                        <td><strong>{employee.fullName}</strong></td>
                                        <td>{employee.email}</td>
                                        <td>{employee.teamLeader?.fullName || 'None'}</td>
                                      </tr>
                                    );
                                  })}
                                  {employeesToAssign.length === 0 && (
                                    <tr>
                                      <td colSpan={3} className="text-center">No employees found in this campaign</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowTeamLeaderModal(false);
                      setEditingUserForTeamLeader(null);
                      setSelectedEmployeesForTeamLeader([]);
                      setConfirmationStep(1);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      if (selectedEmployeesForTeamLeader.length === 0) {
                        alert('Please select a team leader');
                        return;
                      }
                      setConfirmationStep(2);
                    }}
                    disabled={selectedEmployeesForTeamLeader.length === 0}
                  >
                    Continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ 
                  marginTop: 'var(--spacing-md)', 
                  padding: 'var(--spacing-md)', 
                  backgroundColor: '#fef3c7',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid #f59e0b'
                }}>
                  <h4 style={{ marginTop: 0, color: '#92400e' }}>Confirm Assignment</h4>
                  {(() => {
                    const teamLeader = allUsers.find(u => u.id === selectedEmployeesForTeamLeader[0]);
                    const campaignId = editingUserForTeamLeader.campaign?.id;
                    const employeesToAssign = campaignId
                      ? allUsers.filter(u => 
                          u.role === 'EMPLOYEE' && 
                          u.campaign?.id === campaignId
                        )
                      : [];
                    
                    return (
                      <>
                        <p style={{ marginBottom: 'var(--spacing-sm)' }}>
                          You are about to assign <strong>{teamLeader?.fullName}</strong> as the team leader for campaign <strong>{editingUserForTeamLeader.campaign.name}</strong>.
                        </p>
                        <p style={{ marginBottom: 'var(--spacing-sm)', fontWeight: 500 }}>
                          The following {employeesToAssign.length} employee(s) will be assigned to this team leader:
                        </p>
                        <ul style={{ marginLeft: '20px', marginBottom: 0 }}>
                          {employeesToAssign.map(emp => (
                            <li key={emp.id}><strong>{emp.fullName}</strong> ({emp.email})</li>
                          ))}
                        </ul>
                        <p style={{ marginTop: 'var(--spacing-md)', marginBottom: 0, fontWeight: 500 }}>
                          All employees (except managers) in this campaign will report to {teamLeader?.fullName}.
                        </p>
                      </>
                    );
                  })()}
                </div>
                
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setConfirmationStep(1)}
                  >
                    Back
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      setShowTeamLeaderModal(false);
                      setEditingUserForTeamLeader(null);
                      setSelectedEmployeesForTeamLeader([]);
                      setConfirmationStep(1);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveTeamLeader}
                  >
                    Confirm & Assign
                  </button>
                </div>
              </>
            )}
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
