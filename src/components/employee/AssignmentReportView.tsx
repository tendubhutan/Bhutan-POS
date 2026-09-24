import React, { useState, useMemo } from 'react';
import { 
  CheckSquare, Plus, Search, Filter, Calendar, Download, Printer, 
  Clock, CheckCircle2, AlertCircle, AlertTriangle, MessageSquare, 
  User, Users, ArrowUpDown, ChevronRight, X, Sparkles, SlidersHorizontal,
  ChevronDown, Send, Edit3, Trash2, Eye, FileSpreadsheet, Layers,
  BarChart2, PieChart, Check, Phone, ArrowUpRight, TrendingUp, RefreshCw
} from 'lucide-react';
import { TaskAssignment, TaskStatus, TaskPriority, TaskAssignmentComment } from '../../types/staffPortal';
import { Employee, Config } from '../../types';
import { 
  getTaskAssignments, createTaskAssignment, updateTaskStatus, 
  addTaskComment, updateTaskAssignment, deleteTaskAssignment,
  getTodayDateString 
} from '../../services/employeeStaffService';
import { getActiveCompanyId } from '../../services/supabaseTenantService';
import { getActiveUser } from '../../services/storageService';
import XLSX from 'xlsx-js-style';

interface AssignmentReportViewProps {
  config: Config;
  employees: Employee[];
  tasks?: TaskAssignment[];
  onRefreshData?: () => void;
  showHeaderControls?: boolean;
}

export const AssignmentReportView: React.FC<AssignmentReportViewProps> = ({
  config,
  employees,
  tasks: propTasks,
  onRefreshData,
  showHeaderControls = true
}) => {
  const companyId = getActiveCompanyId();
  const activeUser = getActiveUser();

  // Local state for tasks if not passed from parent
  const [internalTasks, setInternalTasks] = useState<TaskAssignment[]>(() => getTaskAssignments(companyId));
  const tasks = propTasks || internalTasks;

  const refreshLocalTasks = () => {
    setInternalTasks(getTaskAssignments(companyId));
    if (onRefreshData) onRefreshData();
  };

  // View Mode: 'table' (Detailed Register) | 'workload' (Staff Performance Matrix) | 'insights' (Category & Priority)
  const [viewMode, setViewMode] = useState<'table' | 'workload' | 'insights'>('table');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [datePreset, setDatePreset] = useState<'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM'>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<'dueDate' | 'createdAt' | 'priority' | 'status' | 'taskNo'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<TaskAssignment | null>(null);
  const [editingTask, setEditingTask] = useState<TaskAssignment | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [newCommentInput, setNewCommentInput] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // New Task Form
  const [newTaskForm, setNewTaskForm] = useState({
    title: '',
    description: '',
    priority: 'Medium' as TaskPriority,
    assignedToEmpId: '',
    dueDate: getTodayDateString(),
    category: 'General' as TaskAssignment['category']
  });

  const showToast = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  // Preset Date Filter Handler
  const handleDatePresetChange = (preset: 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM') => {
    setDatePreset(preset);
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'ALL') {
      setFromDate('');
      setToDate('');
    } else if (preset === 'TODAY') {
      const todayStr = toDateStr(today);
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'THIS_WEEK') {
      const day = today.getDay(); // 0 is Sunday
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(today.setDate(diff));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setFromDate(toDateStr(monday));
      setToDate(toDateStr(sunday));
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setFromDate(toDateStr(firstDay));
      setToDate(toDateStr(lastDay));
    }
  };

  // Filtered & Sorted Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = task.title?.toLowerCase().includes(q);
        const matchesDesc = task.description?.toLowerCase().includes(q);
        const matchesNo = task.taskNo?.toLowerCase().includes(q);
        const matchesAssignee = task.assignedToEmpName?.toLowerCase().includes(q);
        const matchesAssigner = task.assignedByName?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesNo && !matchesAssignee && !matchesAssigner) {
          return false;
        }
      }

      // Status
      const todayZero = new Date().setHours(0, 0, 0, 0);
      const isTaskOverdue = new Date(task.dueDate).getTime() < todayZero && task.status !== 'Completed';

      if (statusFilter === 'OVERDUE') {
        if (!isTaskOverdue) return false;
      } else if (statusFilter !== 'ALL') {
        if (task.status !== statusFilter) return false;
      }

      // Priority
      if (priorityFilter !== 'ALL' && task.priority !== priorityFilter) {
        return false;
      }

      // Assignee
      if (assigneeFilter !== 'ALL' && task.assignedToEmpId !== assigneeFilter) {
        return false;
      }

      // Category
      if (categoryFilter !== 'ALL' && (task.category || 'General') !== categoryFilter) {
        return false;
      }

      // Date Range (Created or Due Date)
      if (fromDate) {
        const taskCreated = task.createdAt ? task.createdAt.split('T')[0] : '';
        const taskDue = task.dueDate || '';
        if (taskCreated < fromDate && taskDue < fromDate) return false;
      }
      if (toDate) {
        const taskCreated = task.createdAt ? task.createdAt.split('T')[0] : '';
        const taskDue = task.dueDate || '';
        if (taskCreated > toDate && taskDue > toDate) return false;
      }

      return true;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'createdAt') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === 'dueDate') {
        comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      } else if (sortBy === 'taskNo') {
        comparison = a.taskNo.localeCompare(b.taskNo);
      } else if (sortBy === 'priority') {
        const pWeight: Record<string, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
        comparison = (pWeight[a.priority] || 0) - (pWeight[b.priority] || 0);
      } else if (sortBy === 'status') {
        const sWeight: Record<string, number> = { Assigned: 1, 'In Progress': 2, 'Under Review': 3, Completed: 4 };
        comparison = (sWeight[a.status] || 0) - (sWeight[b.status] || 0);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [tasks, searchQuery, statusFilter, priorityFilter, assigneeFilter, categoryFilter, fromDate, toDate, sortBy, sortOrder]);

  // High-Level KPIs
  const kpis = useMemo(() => {
    const total = tasks.length;
    let completed = 0;
    let inProgress = 0;
    let underReview = 0;
    let assigned = 0;
    let overdue = 0;
    let urgentOrHigh = 0;

    const todayZero = new Date().setHours(0, 0, 0, 0);

    tasks.forEach(t => {
      if (t.status === 'Completed') {
        completed += 1;
      } else {
        if (t.status === 'In Progress') inProgress += 1;
        else if (t.status === 'Under Review') underReview += 1;
        else assigned += 1;

        if (new Date(t.dueDate).getTime() < todayZero) {
          overdue += 1;
        }
      }

      if (t.priority === 'Urgent' || t.priority === 'High') {
        urgentOrHigh += 1;
      }
    });

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const activeTasks = total - completed;

    return {
      total,
      completed,
      activeTasks,
      inProgress,
      underReview,
      assigned,
      overdue,
      urgentOrHigh,
      completionRate
    };
  }, [tasks]);

  // Per-Employee Workload Aggregator
  const employeeWorkload = useMemo(() => {
    const map = new Map<string, {
      emp: Employee;
      total: number;
      completed: number;
      active: number;
      overdue: number;
      urgent: number;
      tasks: TaskAssignment[];
    }>();

    employees.forEach(emp => {
      map.set(emp.id, {
        emp,
        total: 0,
        completed: 0,
        active: 0,
        overdue: 0,
        urgent: 0,
        tasks: []
      });
    });

    const todayZero = new Date().setHours(0, 0, 0, 0);

    tasks.forEach(t => {
      let item = map.get(t.assignedToEmpId);
      if (!item) {
        const dummyEmp: Employee = {
          id: t.assignedToEmpId,
          empCode: '',
          fullName: t.assignedToEmpName || 'Unassigned Staff',
          cidNo: '',
          designation: 'Staff',
          department: 'General',
          joiningDate: '',
          contactNo: '',
          bankName: '',
          accountNo: '',
          basicSalary: 0,
          status: 'Active'
        };
        item = { emp: dummyEmp, total: 0, completed: 0, active: 0, overdue: 0, urgent: 0, tasks: [] };
        map.set(t.assignedToEmpId, item);
      }

      item.total += 1;
      item.tasks.push(t);
      if (t.status === 'Completed') {
        item.completed += 1;
      } else {
        item.active += 1;
        if (new Date(t.dueDate).getTime() < todayZero) {
          item.overdue += 1;
        }
      }
      if (t.priority === 'Urgent' || t.priority === 'High') {
        item.urgent += 1;
      }
    });

    return Array.from(map.values()).filter(w => w.total > 0 || w.emp.status === 'Active');
  }, [tasks, employees]);

  // Category Breakdown Aggregator
  const categoryBreakdown = useMemo(() => {
    const counts: Record<string, { total: number; completed: number; active: number }> = {};
    const categories: Array<TaskAssignment['category']> = [
      'General', 'POS Counter', 'Stock & Inventory', 'Accounts', 'Customer Followup', 'Administration'
    ];

    categories.forEach(c => {
      if (c) counts[c] = { total: 0, completed: 0, active: 0 };
    });

    tasks.forEach(t => {
      const cat = t.category || 'General';
      if (!counts[cat]) counts[cat] = { total: 0, completed: 0, active: 0 };
      counts[cat].total += 1;
      if (t.status === 'Completed') counts[cat].completed += 1;
      else counts[cat].active += 1;
    });

    return Object.entries(counts).map(([name, data]) => ({
      name,
      ...data,
      completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0
    }));
  }, [tasks]);

  // Export to XLSX
  const handleExportExcel = () => {
    try {
      const rows = filteredTasks.map((t, idx) => {
        const isOverdue = new Date(t.dueDate).getTime() < new Date().setHours(0, 0, 0, 0) && t.status !== 'Completed';
        return {
          'Sl No': idx + 1,
          'Task ID': t.taskNo,
          'Created Date': t.createdAt ? t.createdAt.split('T')[0] : '',
          'Category': t.category || 'General',
          'Assignment Title': t.title,
          'Description': t.description || '',
          'Assigned To': t.assignedToEmpName,
          'Assigned By': `${t.assignedByName} (${t.assignedByRole})`,
          'Priority': t.priority,
          'Due Date': t.dueDate,
          'Status': t.status,
          'Overdue': isOverdue ? 'YES' : 'NO',
          'Completed At': t.completedAt ? t.completedAt.split('T')[0] : '-',
          'Comments Count': t.comments ? t.comments.length : 0
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);

      // Set column widths
      ws['!cols'] = [
        { wch: 6 },  // Sl No
        { wch: 12 }, // Task ID
        { wch: 14 }, // Created Date
        { wch: 18 }, // Category
        { wch: 30 }, // Title
        { wch: 35 }, // Description
        { wch: 22 }, // Assigned To
        { wch: 22 }, // Assigned By
        { wch: 12 }, // Priority
        { wch: 14 }, // Due Date
        { wch: 16 }, // Status
        { wch: 10 }, // Overdue
        { wch: 16 }, // Completed At
        { wch: 15 }  // Comments Count
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Staff_Assignments');
      const filename = `Staff_Assignment_Report_${getTodayDateString()}.xlsx`;
      XLSX.writeFile(wb, filename);
      showToast('Assignment Report exported to Excel successfully!');
    } catch (err) {
      console.error('Failed to export assignments to Excel', err);
      alert('Failed to export to Excel.');
    }
  };

  // Print Report Handler
  const handlePrintReport = () => {
    window.print();
  };

  // Submit New Task
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskForm.title.trim() || !newTaskForm.assignedToEmpId) {
      alert('Please provide task title and assign it to an employee.');
      return;
    }

    const targetEmp = employees.find(emp => emp.id === newTaskForm.assignedToEmpId);
    if (!targetEmp) {
      alert('Selected employee not found.');
      return;
    }

    const created = createTaskAssignment({
      title: newTaskForm.title.trim(),
      description: newTaskForm.description.trim(),
      priority: newTaskForm.priority,
      assignedToEmpId: targetEmp.id,
      assignedToEmpName: targetEmp.fullName,
      assignedByUserId: activeUser?.username || 'admin',
      assignedByName: activeUser?.username || 'Store Manager',
      assignedByRole: (activeUser?.role as any) || 'Manager',
      dueDate: newTaskForm.dueDate,
      category: newTaskForm.category
    }, companyId);

    setShowNewModal(false);
    setNewTaskForm({
      title: '',
      description: '',
      priority: 'Medium',
      assignedToEmpId: '',
      dueDate: getTodayDateString(),
      category: 'General'
    });

    refreshLocalTasks();
    showToast(`Task ${created.taskNo} assigned successfully!`);
  };

  // Quick Status Changer
  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    const success = updateTaskStatus(
      taskId, 
      newStatus, 
      `Status updated to ${newStatus}`, 
      {
        id: activeUser?.username || 'admin',
        name: activeUser?.username || 'Manager',
        role: 'Manager'
      }, 
      companyId
    );

    if (success) {
      refreshLocalTasks();
      if (selectedTaskDetail && selectedTaskDetail.id === taskId) {
        setSelectedTaskDetail({
          ...selectedTaskDetail,
          status: newStatus,
          completedAt: newStatus === 'Completed' ? new Date().toISOString() : undefined
        });
      }
      showToast(`Task status updated to ${newStatus}`);
    }
  };

  // Submit Comment
  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskDetail || !newCommentInput.trim()) return;

    const added = addTaskComment(
      selectedTaskDetail.id,
      newCommentInput.trim(),
      {
        id: activeUser?.username || 'admin',
        name: activeUser?.username || 'Manager',
        role: 'Manager'
      },
      companyId
    );

    if (added) {
      setNewCommentInput('');
      const updatedComments = [...(selectedTaskDetail.comments || []), added];
      setSelectedTaskDetail({
        ...selectedTaskDetail,
        comments: updatedComments
      });
      refreshLocalTasks();
    }
  };

  // Delete Task
  const handleDeleteTask = (taskId: string) => {
    const ok = deleteTaskAssignment(taskId, companyId);
    if (ok) {
      setDeleteConfirmId(null);
      if (selectedTaskDetail?.id === taskId) setSelectedTaskDetail(null);
      refreshLocalTasks();
      showToast('Assignment deleted successfully.');
    }
  };

  // Edit Task Submit
  const handleSaveEditedTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    const targetEmp = employees.find(emp => emp.id === editingTask.assignedToEmpId);
    const updated = updateTaskAssignment(editingTask.id, {
      title: editingTask.title,
      description: editingTask.description,
      priority: editingTask.priority,
      category: editingTask.category,
      assignedToEmpId: editingTask.assignedToEmpId,
      assignedToEmpName: targetEmp ? targetEmp.fullName : editingTask.assignedToEmpName,
      dueDate: editingTask.dueDate,
      status: editingTask.status
    }, companyId);

    if (updated) {
      setEditingTask(null);
      if (selectedTaskDetail?.id === editingTask.id) {
        setSelectedTaskDetail(updated);
      }
      refreshLocalTasks();
      showToast('Task details updated successfully!');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Toast Notification */}
      {actionSuccessMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white border border-emerald-500/50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* ================================================================ */}
      {/* PRINT-ONLY EXECUTIVE HEADER */}
      {/* ================================================================ */}
      <div className="hidden print:block mb-6 border-b pb-4 text-slate-900">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-tight">{config?.CompanyName || 'Enterprise POS'}</h1>
            <p className="text-xs text-slate-600 font-medium">{config?.CompanyAddress || 'Bhutan'}</p>
            <p className="text-xs text-slate-600">Contact: {config?.CompanyPhone || '-'}</p>
          </div>
          <div className="text-right">
            <h2 className="text-base font-bold text-slate-800 uppercase tracking-wider">STAFF ASSIGNMENT & TASK REPORT</h2>
            <p className="text-xs font-mono text-slate-600">Generated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
            <p className="text-xs text-slate-600">Total Tasks: {filteredTasks.length} | Completed: {kpis.completed} ({kpis.completionRate}%)</p>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* 1. TOP CONTROL BAR & SEGMENTED VIEW SWITCHER */}
      {/* ================================================================ */}
      {showHeaderControls && (
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 print:hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <CheckSquare className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-base leading-tight">
                    Staff Assignment & Task Report
                  </h2>
                  <p className="text-xs text-slate-500">
                    Comprehensive ledger of assignments, operational duties, deadlines, and staff progress.
                  </p>
                </div>
              </div>
            </div>

            {/* View Mode Switcher & Primary Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Segmented View Mode Tabs */}
              <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Register Table</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('workload')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'workload'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Staff Workload</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('insights')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'insights'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  <span>Category Insights</span>
                </button>
              </div>

              {/* Export & Print */}
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                title="Export filtered tasks to Excel (.xlsx)"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Excel</span>
              </button>

              <button
                type="button"
                onClick={handlePrintReport}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                title="Print or save as PDF"
              >
                <Printer className="h-3.5 w-3.5 text-slate-600" />
                <span className="hidden sm:inline">Print</span>
              </button>

              {/* Assign New Task */}
              <button
                type="button"
                onClick={() => setShowNewModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Assign Task</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 2. KPI SUMMARY METRICS CARDS */}
      {/* ================================================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 print:grid-cols-6">
        {/* Total */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium uppercase tracking-wider">Total Tasks</span>
            <CheckSquare className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">{kpis.total}</span>
            <span className="text-[10px] text-slate-400">assignments</span>
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-[11px] font-medium uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">{kpis.completed}</span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md font-mono tabular-nums">
              {kpis.completionRate}%
            </span>
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-white p-3.5 rounded-2xl border border-blue-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-[11px] font-medium uppercase tracking-wider">In Progress</span>
            <Clock className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-blue-700 tabular-nums">{kpis.inProgress}</span>
            <span className="text-[10px] text-slate-400">in execution</span>
          </div>
        </div>

        {/* Under Review */}
        <div className="bg-white p-3.5 rounded-2xl border border-amber-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-[11px] font-medium uppercase tracking-wider">Under Review</span>
            <Eye className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-amber-700 tabular-nums">{kpis.underReview}</span>
            <span className="text-[10px] text-slate-400">pending signoff</span>
          </div>
        </div>

        {/* Overdue */}
        <div className={`p-3.5 rounded-2xl border shadow-2xs flex flex-col justify-between ${
          kpis.overdue > 0 ? 'bg-rose-50/50 border-rose-200 text-rose-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-rose-700">Overdue</span>
            <AlertTriangle className={`h-4 w-4 ${kpis.overdue > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-2xl font-bold font-mono tabular-nums ${kpis.overdue > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
              {kpis.overdue}
            </span>
            <span className="text-[10px] text-slate-400">passed deadline</span>
          </div>
        </div>

        {/* Urgent/High Priority */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-700">
            <span className="text-[11px] font-medium uppercase tracking-wider">Urgent / High</span>
            <TrendingUp className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-indigo-700 tabular-nums">{kpis.urgentOrHigh}</span>
            <span className="text-[10px] text-slate-400">critical tasks</span>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* 3. MULTI-FACETED FILTER & SEARCH TOOLBAR */}
      {/* ================================================================ */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search task #, title, description, staff..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8.5 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100"
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Statuses ({tasks.length})</option>
              <option value="Assigned">Assigned ({kpis.assigned})</option>
              <option value="In Progress">In Progress ({kpis.inProgress})</option>
              <option value="Under Review">Under Review ({kpis.underReview})</option>
              <option value="Completed">Completed ({kpis.completed})</option>
              <option value="OVERDUE">⚠️ Overdue Only ({kpis.overdue})</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Priorities</option>
              <option value="Urgent">🔴 Urgent</option>
              <option value="High">🟠 High</option>
              <option value="Medium">🔵 Medium</option>
              <option value="Low">⚪ Low</option>
            </select>
          </div>

          {/* Staff Assignee Filter */}
          <div>
            <select
              value={assigneeFilter}
              onChange={e => setAssigneeFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Staff Members</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} {emp.empCode ? `(${emp.empCode})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Categories</option>
              <option value="General">General</option>
              <option value="POS Counter">POS Counter</option>
              <option value="Stock & Inventory">Stock & Inventory</option>
              <option value="Accounts">Accounts</option>
              <option value="Customer Followup">Customer Followup</option>
              <option value="Administration">Administration</option>
            </select>
          </div>
        </div>

        {/* Date Presets & Custom Date Range */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Period:</span>
            {(['ALL', 'TODAY', 'THIS_WEEK', 'THIS_MONTH', 'CUSTOM'] as const).map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => handleDatePresetChange(preset)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  datePreset === preset
                    ? 'bg-slate-900 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {preset === 'ALL' ? 'All Time' : preset.replace('_', ' ')}
              </button>
            ))}

            {datePreset === 'CUSTOM' && (
              <div className="flex items-center gap-1.5 ml-2">
                <input
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-mono text-slate-800"
                  placeholder="From"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-mono text-slate-800"
                  placeholder="To"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-slate-500">
            <span className="text-xs">
              Showing <strong className="text-slate-900 font-mono tabular-nums">{filteredTasks.length}</strong> of{' '}
              <span className="font-mono tabular-nums">{tasks.length}</span> assignments
            </span>
            {(searchQuery || statusFilter !== 'ALL' || priorityFilter !== 'ALL' || assigneeFilter !== 'ALL' || categoryFilter !== 'ALL' || datePreset !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setPriorityFilter('ALL');
                  setAssigneeFilter('ALL');
                  setCategoryFilter('ALL');
                  handleDatePresetChange('ALL');
                }}
                className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* 4. VIEW MODE 1: DETAILED TABULAR REGISTER */}
      {/* ================================================================ */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[10px] font-bold select-none">
                  <th className="py-3 px-3.5 w-12 text-center">Sl</th>
                  <th 
                    className="py-3 px-3 cursor-pointer hover:text-slate-900"
                    onClick={() => {
                      if (sortBy === 'taskNo') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else { setSortBy('taskNo'); setSortOrder('asc'); }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>Task #</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Assignment & Category</th>
                  <th className="py-3 px-4">Assigned Staff</th>
                  <th className="py-3 px-3">Assigned By</th>
                  <th 
                    className="py-3 px-3 cursor-pointer hover:text-slate-900"
                    onClick={() => {
                      if (sortBy === 'priority') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else { setSortBy('priority'); setSortOrder('desc'); }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>Priority</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </th>
                  <th 
                    className="py-3 px-3 cursor-pointer hover:text-slate-900"
                    onClick={() => {
                      if (sortBy === 'dueDate') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else { setSortBy('dueDate'); setSortOrder('asc'); }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>Due Date</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </th>
                  <th 
                    className="py-3 px-3 cursor-pointer hover:text-slate-900"
                    onClick={() => {
                      if (sortBy === 'status') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      else { setSortBy('status'); setSortOrder('asc'); }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span>Status</span>
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center">Notes / Chat</th>
                  <th className="py-3 px-3 text-right pr-4 print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((task, idx) => {
                  const todayZero = new Date().setHours(0, 0, 0, 0);
                  const isOverdue = new Date(task.dueDate).getTime() < todayZero && task.status !== 'Completed';

                  return (
                    <tr 
                      key={task.id} 
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isOverdue ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      {/* Sl */}
                      <td className="py-3 px-3.5 text-center font-mono text-slate-400 tabular-nums">
                        {idx + 1}
                      </td>

                      {/* Task # & Created Date */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedTaskDetail(task)}
                          className="font-bold font-mono text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer block"
                        >
                          {task.taskNo}
                        </button>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {task.createdAt ? task.createdAt.split('T')[0] : ''}
                        </span>
                      </td>

                      {/* Title & Category */}
                      <td className="py-3 px-4 max-w-sm">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-0.5">
                          <span className="font-semibold text-slate-600">{task.category || 'General'}</span>
                        </div>
                        <p 
                          onClick={() => setSelectedTaskDetail(task)}
                          className="font-bold text-slate-900 hover:text-indigo-600 transition cursor-pointer leading-snug line-clamp-2"
                        >
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-[11px] text-slate-500 truncate mt-0.5 max-w-xs">
                            {task.description}
                          </p>
                        )}
                      </td>

                      {/* Assigned Staff */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {task.assignedToEmpName ? task.assignedToEmpName.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 block text-xs leading-tight">
                              {task.assignedToEmpName}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Staff ID: {task.assignedToEmpId}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Assigned By */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                        <span className="font-medium block text-xs">{task.assignedByName}</span>
                        <span className="text-[10px] text-slate-400">{task.assignedByRole}</span>
                      </td>

                      {/* Priority (Zero-Pill: Clean unboxed text) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                          task.priority === 'Urgent' ? 'text-rose-600' :
                          task.priority === 'High' ? 'text-amber-600' :
                          task.priority === 'Medium' ? 'text-blue-600' : 'text-slate-500'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            task.priority === 'Urgent' ? 'bg-rose-600' :
                            task.priority === 'High' ? 'bg-amber-600' :
                            task.priority === 'Medium' ? 'bg-blue-600' : 'bg-slate-400'
                          }`} />
                          {task.priority}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`font-mono text-xs font-medium tabular-nums ${
                          isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700'
                        }`}>
                          {task.dueDate}
                        </span>
                        {isOverdue && (
                          <span className="block text-[10px] text-rose-600 font-bold uppercase tracking-wider">
                            Overdue
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="relative inline-block">
                          <select
                            value={task.status}
                            onChange={e => handleStatusChange(task.id, e.target.value as TaskStatus)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer outline-none ${
                              task.status === 'Completed' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                              task.status === 'In Progress' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                              task.status === 'Under Review' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                              'bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                          >
                            <option value="Assigned">Assigned</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Under Review">Under Review</option>
                            <option value="Completed">Completed</option>
                          </select>
                        </div>
                      </td>

                      {/* Notes / Chat */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedTaskDetail(task)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 font-mono text-xs transition cursor-pointer"
                        >
                          <MessageSquare className="h-3 w-3" />
                          <span>{task.comments ? task.comments.length : 0}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right pr-4 whitespace-nowrap print:hidden">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedTaskDetail(task)}
                            className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                            title="View full task & conversation"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingTask(task)}
                            className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="Edit task parameters"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(task.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Delete task"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 space-y-2">
                      <CheckSquare className="h-8 w-8 mx-auto text-slate-300" />
                      <p className="text-sm font-semibold text-slate-600">No assignments match your filter</p>
                      <p className="text-xs text-slate-400">Try adjusting your status, date range, or search criteria.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 5. VIEW MODE 2: STAFF WORKLOAD & PERFORMANCE MATRIX */}
      {/* ================================================================ */}
      {viewMode === 'workload' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employeeWorkload.map(w => {
              const completionPercent = w.total > 0 ? Math.round((w.completed / w.total) * 100) : 0;

              return (
                <div 
                  key={w.emp.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3"
                >
                  {/* Employee Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-100 border border-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">
                        {w.emp.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm leading-tight">{w.emp.fullName}</h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <span>{w.emp.empCode || 'Staff'}</span>
                          <span>·</span>
                          <span>{w.emp.designation || w.emp.department || 'Employee'}</span>
                        </div>
                      </div>
                    </div>

                    <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                      {completionPercent}% Done
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-4 gap-1 text-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase">Total</span>
                      <span className="font-bold font-mono text-xs text-slate-800">{w.total}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-emerald-600 uppercase">Done</span>
                      <span className="font-bold font-mono text-xs text-emerald-700">{w.completed}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-blue-600 uppercase">Active</span>
                      <span className="font-bold font-mono text-xs text-blue-700">{w.active}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-rose-600 uppercase">Late</span>
                      <span className={`font-bold font-mono text-xs ${w.overdue > 0 ? 'text-rose-600 font-black' : 'text-slate-400'}`}>
                        {w.overdue}
                      </span>
                    </div>
                  </div>

                  {/* Recent Tasks List for this employee */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Active Assignments ({w.tasks.filter(t => t.status !== 'Completed').length})
                    </span>
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {w.tasks.filter(t => t.status !== 'Completed').map(t => (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTaskDetail(t)}
                          className="p-2 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 transition text-xs flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <div className="truncate">
                            <span className="font-mono text-[10px] text-indigo-600 font-bold mr-1">{t.taskNo}</span>
                            <span className="text-slate-800 font-medium">{t.title}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">{t.dueDate}</span>
                        </div>
                      ))}
                      {w.tasks.filter(t => t.status !== 'Completed').length === 0 && (
                        <p className="text-[11px] text-slate-400 italic py-2 text-center">No active tasks pending.</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 6. VIEW MODE 3: CATEGORY & PRIORITY INSIGHTS */}
      {/* ================================================================ */}
      {viewMode === 'insights' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Category Breakdown */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600" />
              <span>Assignment Breakdown by Department / Category</span>
            </h3>

            <div className="space-y-3">
              {categoryBreakdown.map(cat => (
                <div key={cat.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{cat.name}</span>
                    <div className="flex items-center gap-2 font-mono text-slate-500">
                      <span>{cat.completed}/{cat.total} completed</span>
                      <span className="font-bold text-indigo-600">({cat.completionRate}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${cat.completionRate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Priority & Turnaround Metrics */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <span>Priority Distribution & Resolution Status</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              {(['Urgent', 'High', 'Medium', 'Low'] as TaskPriority[]).map(p => {
                const count = tasks.filter(t => t.priority === p).length;
                const completedCount = tasks.filter(t => t.priority === p && t.status === 'Completed').length;
                const rate = count > 0 ? Math.round((completedCount / count) * 100) : 0;

                return (
                  <div key={p} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${
                        p === 'Urgent' ? 'text-rose-600' :
                        p === 'High' ? 'text-amber-600' :
                        p === 'Medium' ? 'text-blue-600' : 'text-slate-600'
                      }`}>
                        {p} Priority
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-800">{count}</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          p === 'Urgent' ? 'bg-rose-500' :
                          p === 'High' ? 'bg-amber-500' :
                          p === 'Medium' ? 'bg-blue-500' : 'bg-slate-400'
                        }`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 block text-right font-mono">
                      {completedCount} resolved ({rate}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 7. MODAL: ASSIGN NEW TASK */}
      {/* ================================================================ */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Assign New Staff Task</h3>
                  <p className="text-xs text-slate-500">Create and allocate operational assignment</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Assignment Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Conduct physical inventory count for Beverage Section"
                  value={newTaskForm.title}
                  onChange={e => setNewTaskForm({ ...newTaskForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Assign To Staff *
                  </label>
                  <select
                    required
                    value={newTaskForm.assignedToEmpId}
                    onChange={e => setNewTaskForm({ ...newTaskForm, assignedToEmpId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">-- Select Employee --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.empCode || 'Staff'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={newTaskForm.category}
                    onChange={e => setNewTaskForm({ ...newTaskForm, category: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="General">General</option>
                    <option value="POS Counter">POS Counter</option>
                    <option value="Stock & Inventory">Stock & Inventory</option>
                    <option value="Accounts">Accounts</option>
                    <option value="Customer Followup">Customer Followup</option>
                    <option value="Administration">Administration</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Priority Level
                  </label>
                  <select
                    value={newTaskForm.priority}
                    onChange={e => setNewTaskForm({ ...newTaskForm, priority: e.target.value as TaskPriority })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="Low">Low Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="High">High Priority</option>
                    <option value="Urgent">🔴 Urgent Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newTaskForm.dueDate}
                    onChange={e => setNewTaskForm({ ...newTaskForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Detailed Instructions / Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide detailed instructions, expected milestones, or items to check..."
                  value={newTaskForm.description}
                  onChange={e => setNewTaskForm({ ...newTaskForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  Assign Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 8. MODAL: TASK DETAIL & 2-WAY CONVERSATION DRAWER */}
      {/* ================================================================ */}
      {selectedTaskDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-indigo-600 text-xs bg-indigo-50 px-2 py-0.5 rounded-md">
                    {selectedTaskDetail.taskNo}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {selectedTaskDetail.category || 'General'}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-base leading-snug">
                  {selectedTaskDetail.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTaskDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Status Bar & Assignee Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-semibold">Assigned To</span>
                <span className="font-bold text-slate-800">{selectedTaskDetail.assignedToEmpName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-semibold">Priority</span>
                <span className="font-bold text-slate-800">{selectedTaskDetail.priority}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-semibold">Due Date</span>
                <span className="font-bold font-mono text-slate-800">{selectedTaskDetail.dueDate}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-semibold">Current Status</span>
                <select
                  value={selectedTaskDetail.status}
                  onChange={e => handleStatusChange(selectedTaskDetail.id, e.target.value as TaskStatus)}
                  className="font-bold text-indigo-600 bg-transparent outline-none cursor-pointer"
                >
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>

            {/* Description */}
            {selectedTaskDetail.description && (
              <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed">
                <p className="font-semibold text-slate-500 text-[10px] uppercase mb-1">Instructions</p>
                {selectedTaskDetail.description}
              </div>
            )}

            {/* 2-Way Comment History */}
            <div className="flex-1 overflow-y-auto space-y-2.5 min-h-[140px] pr-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Activity & Conversation ({selectedTaskDetail.comments ? selectedTaskDetail.comments.length : 0})
              </span>

              {selectedTaskDetail.comments && selectedTaskDetail.comments.map(c => (
                <div 
                  key={c.id} 
                  className={`p-3 rounded-xl text-xs space-y-1 ${
                    c.authorRole === 'Manager' || c.authorRole === 'Admin'
                      ? 'bg-indigo-50/70 border border-indigo-100 text-indigo-950 ml-4'
                      : 'bg-slate-100 border border-slate-200 text-slate-800 mr-4'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-slate-900">{c.authorName} ({c.authorRole})</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-700 leading-normal">{c.message}</p>
                </div>
              ))}

              {(!selectedTaskDetail.comments || selectedTaskDetail.comments.length === 0) && (
                <p className="text-xs text-slate-400 italic text-center py-4">No comments or activity notes yet.</p>
              )}
            </div>

            {/* Add Comment Input */}
            <form onSubmit={handleSendComment} className="pt-2 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                placeholder="Type instructions or reply to staff..."
                value={newCommentInput}
                onChange={e => setNewCommentInput(e.target.value)}
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                type="submit"
                disabled={!newCommentInput.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs transition flex items-center gap-1 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 9. MODAL: EDIT TASK */}
      {/* ================================================================ */}
      {editingTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Edit Task {editingTask.taskNo}</h3>
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={editingTask.title}
                  onChange={e => setEditingTask({ ...editingTask, title: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Assignee
                  </label>
                  <select
                    value={editingTask.assignedToEmpId}
                    onChange={e => setEditingTask({ ...editingTask, assignedToEmpId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none"
                  >
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editingTask.dueDate}
                    onChange={e => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Priority
                  </label>
                  <select
                    value={editingTask.priority}
                    onChange={e => setEditingTask({ ...editingTask, priority: e.target.value as TaskPriority })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={editingTask.category || 'General'}
                    onChange={e => setEditingTask({ ...editingTask, category: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none"
                  >
                    <option value="General">General</option>
                    <option value="POS Counter">POS Counter</option>
                    <option value="Stock & Inventory">Stock & Inventory</option>
                    <option value="Accounts">Accounts</option>
                    <option value="Customer Followup">Customer Followup</option>
                    <option value="Administration">Administration</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editingTask.description}
                  onChange={e => setEditingTask({ ...editingTask, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 10. MODAL: DELETE CONFIRMATION */}
      {/* ================================================================ */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="h-10 w-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Delete Assignment?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete this staff task? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTask(deleteConfirmId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
