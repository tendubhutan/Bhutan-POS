import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  User, 
  KeyRound, 
  Mail, 
  ShieldCheck, 
  Store, 
  LogOut, 
  Users, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  X,
  Eye,
  EyeOff,
  UserCheck,
  Building2
} from 'lucide-react';
import { AppUser, UserPermission, ModuleId } from '../types';
import { 
  getUsers, 
  saveUsers, 
  getActiveUser, 
  setActiveUser 
} from '../services/storageService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getActiveCompanyId, fetchUserCompanies, SupabaseCompany } from '../services/supabaseTenantService';

interface UserAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserChanged: (user: AppUser) => void;
}

export const UserAuthModal: React.FC<UserAuthModalProps> = ({
  isOpen,
  onClose,
  onUserChanged
}) => {
  const [activeTab, setActiveTab] = useState<'switch_user' | 'manage_staff' | 'cloud_login'>('switch_user');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [currentUser, setCurrentUser] = useState<AppUser>(getActiveUser());
  const [enteredPin, setEnteredPin] = useState('');
  const [selectedUserToSwitch, setSelectedUserToSwitch] = useState<AppUser | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Add/Edit staff form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState<'Administrator' | 'Manager' | 'Cashier' | 'Accountant' | 'Custom'>('Cashier');
  const [newPin, setNewPin] = useState('');

  // Supabase Auth form
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [activeCompany, setActiveCompany] = useState<SupabaseCompany | null>(null);

  const loadData = async () => {
    const list = getUsers();
    setUsers(list);
    const curr = getActiveUser();
    setCurrentUser(curr);

    // Check Supabase session
    if (isSupabaseConfigured) {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        setSessionEmail(data.session.user.email || null);
      }
      const cId = getActiveCompanyId();
      const { companies } = await fetchUserCompanies();
      const activeC = companies.find(c => c.id === cId) || companies[0];
      if (activeC) setActiveCompany(activeC);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setErrorMsg('');
      setSuccessMsg('');
      setEnteredPin('');
      setShowAddForm(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Fast Switch User via PIN
  const handleQuickSwitch = (user: AppUser) => {
    // If user has no PIN or empty, switch immediately
    if (!user.pinCode || user.pinCode === '0000' || user.pinCode === '') {
      setActiveUser(user.id);
      setCurrentUser(user);
      onUserChanged(user);
      setSuccessMsg(`Logged in as ${user.fullName} (${user.role})`);
      setTimeout(() => {
        onClose();
      }, 700);
      return;
    }
    setSelectedUserToSwitch(user);
    setEnteredPin('');
    setErrorMsg('');
  };

  const handleVerifyPinAndSwitch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserToSwitch) return;
    if (enteredPin === selectedUserToSwitch.pinCode) {
      setActiveUser(selectedUserToSwitch.id);
      setCurrentUser(selectedUserToSwitch);
      onUserChanged(selectedUserToSwitch);
      setSuccessMsg(`Logged in as ${selectedUserToSwitch.fullName} (${selectedUserToSwitch.role})`);
      setTimeout(() => {
        onClose();
      }, 700);
    } else {
      setErrorMsg('Incorrect 4-digit PIN code. Please try again.');
      setEnteredPin('');
    }
  };

  // Add New Staff Account
  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newUsername.trim()) {
      setErrorMsg('Please enter both Staff Full Name and Username.');
      return;
    }

    const defaultPerms: UserPermission[] = [
      { module: 'pos', display: true, create: true, edit: newRole === 'Administrator' || newRole === 'Manager', delete: newRole === 'Administrator', print: true },
      { module: 'purchase', display: newRole !== 'Cashier', create: newRole === 'Administrator' || newRole === 'Manager', edit: newRole === 'Administrator' || newRole === 'Manager', delete: newRole === 'Administrator', print: newRole !== 'Cashier' },
      { module: 'vouchers', display: newRole !== 'Cashier', create: newRole !== 'Cashier', edit: newRole === 'Administrator' || newRole === 'Manager', delete: newRole === 'Administrator', print: newRole !== 'Cashier' },
      { module: 'masters', display: true, create: newRole === 'Administrator' || newRole === 'Manager', edit: newRole === 'Administrator' || newRole === 'Manager', delete: newRole === 'Administrator', print: true },
      { module: 'barcode', display: true, create: true, edit: newRole === 'Administrator', delete: newRole === 'Administrator', print: true },
      { module: 'payroll', display: newRole === 'Administrator' || newRole === 'Manager', create: newRole === 'Administrator', edit: newRole === 'Administrator', delete: newRole === 'Administrator', print: newRole === 'Administrator' || newRole === 'Manager' },
      { module: 'reports', display: newRole !== 'Cashier', create: false, edit: false, delete: false, print: newRole !== 'Cashier' },
      { module: 'settings', display: newRole === 'Administrator', create: newRole === 'Administrator', edit: newRole === 'Administrator', delete: newRole === 'Administrator', print: newRole === 'Administrator' }
    ];

    const newStaffUser: AppUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      fullName: newFullName.trim(),
      username: newUsername.trim().toLowerCase(),
      role: newRole,
      pinCode: newPin || '0000',
      status: 'Active',
      permissions: defaultPerms
    };

    const updated = [...users, newStaffUser];
    saveUsers(updated);
    setUsers(updated);
    setShowAddForm(false);
    setNewFullName('');
    setNewUsername('');
    setNewPin('');
    setSuccessMsg(`Staff account "${newStaffUser.fullName}" created successfully.`);
  };

  // Delete Staff Account
  const handleDeleteStaff = (userId: string) => {
    if (users.length <= 1) {
      setErrorMsg('At least one user account must exist.');
      return;
    }
    const updated = users.filter(u => u.id !== userId);
    saveUsers(updated);
    setUsers(updated);
    if (currentUser.id === userId) {
      setActiveUser(updated[0].id);
      setCurrentUser(updated[0]);
      onUserChanged(updated[0]);
    }
    setSuccessMsg('Staff member removed.');
  };

  // Supabase Cloud Sign In / Sign Up
  const handleSupabaseSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setErrorMsg('Supabase Anon Key is not set yet in Settings.');
      return;
    }
    setAuthLoading(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword
      });
      if (error) {
        setErrorMsg(error.message);
      } else if (data.session) {
        setSessionEmail(data.session.user.email || null);
        setSuccessMsg('Cloud account connected successfully!');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSupabaseSignOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
      setSessionEmail(null);
      setSuccessMsg('Signed out of Supabase Cloud session.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Bar */}
        <div className="bg-slate-800/90 px-5 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  User & Role Authentication
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                  {currentUser.role}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Current User: <strong className="text-white">{currentUser.fullName}</strong> (@{currentUser.username})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="bg-slate-800/40 px-5 pt-3 border-b border-slate-700 flex gap-2">
          <button
            onClick={() => { setActiveTab('switch_user'); setSelectedUserToSwitch(null); setErrorMsg(''); }}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-t-xl transition border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'switch_user'
                ? 'border-blue-500 text-blue-400 bg-slate-800/80'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="h-4 w-4" />
            <span>Switch Shift / User</span>
          </button>

          <button
            onClick={() => { setActiveTab('manage_staff'); setSelectedUserToSwitch(null); setErrorMsg(''); }}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-t-xl transition border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'manage_staff'
                ? 'border-blue-500 text-blue-400 bg-slate-800/80'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Staff Accounts</span>
          </button>

          <button
            onClick={() => { setActiveTab('cloud_login'); setSelectedUserToSwitch(null); setErrorMsg(''); }}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-t-xl transition border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'cloud_login'
                ? 'border-blue-500 text-blue-400 bg-slate-800/80'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="h-4 w-4" />
            <span>Cloud Admin Sign-in</span>
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: Fast Switch User / Shift */}
          {activeTab === 'switch_user' && (
            <div className="space-y-4">
              {!selectedUserToSwitch ? (
                <>
                  <div className="text-xs text-slate-400">
                    Select a counter staff member or manager to switch shift active session:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {users.map(u => {
                      const isCurrent = currentUser.id === u.id;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleQuickSwitch(u)}
                          className={`p-3.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer group ${
                            isCurrent
                              ? 'bg-blue-600/10 border-blue-500/50 ring-1 ring-blue-500/30'
                              : 'bg-slate-800/70 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                              u.role === 'Administrator' 
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : u.role === 'Manager'
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}>
                              {u.fullName.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-sm text-white flex items-center gap-1.5">
                                <span>{u.fullName}</span>
                                {isCurrent && (
                                  <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-1.5 py-0.2 rounded-md">
                                    ACTIVE
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400">
                                @{u.username} • <span className="text-blue-400 font-semibold">{u.role}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-xs font-mono text-slate-400 group-hover:text-white flex items-center gap-1">
                            <span>{u.pinCode ? '🔒 PIN' : '⚡ Instant'}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* PIN Entry Screen */
                <form onSubmit={handleVerifyPinAndSwitch} className="bg-slate-800/80 border border-slate-700 p-6 rounded-2xl max-w-sm mx-auto text-center space-y-4">
                  <div className="h-12 w-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto">
                    <Lock className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Enter 4-Digit Security PIN</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Switching shift to <strong className="text-blue-400">{selectedUserToSwitch.fullName}</strong>
                    </p>
                  </div>

                  <div>
                    <input
                      type="password"
                      maxLength={6}
                      autoFocus
                      required
                      value={enteredPin}
                      onChange={e => setEnteredPin(e.target.value)}
                      placeholder="••••"
                      className="w-40 text-center tracking-widest text-2xl h-12 bg-slate-900 border-2 border-blue-500 rounded-xl text-white font-mono font-black focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => { setSelectedUserToSwitch(null); setEnteredPin(''); }}
                      className="flex-1 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs transition cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer shadow-md"
                    >
                      Verify & Switch
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: Staff Accounts & Roles Management */}
          {activeTab === 'manage_staff' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  Manage store personnel, cashiers, and assigned access privileges.
                </div>
                {!showAddForm && (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add New Staff</span>
                  </button>
                )}
              </div>

              {/* Add New Staff Form */}
              {showAddForm && (
                <form onSubmit={handleCreateStaff} className="p-4 bg-slate-800/90 border border-blue-500/40 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <h3 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-blue-400" />
                      <span>Create Staff Account</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Staff Full Name *</label>
                      <input
                        type="text"
                        required
                        value={newFullName}
                        onChange={e => setNewFullName(e.target.value)}
                        placeholder="e.g. Karma Dorji"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:border-blue-500 focus:outline-none font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Username / Login ID *</label>
                      <input
                        type="text"
                        required
                        value={newUsername}
                        onChange={e => setNewUsername(e.target.value)}
                        placeholder="e.g. karma_pos"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:border-blue-500 focus:outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Role / Privilege Level</label>
                      <select
                        value={newRole}
                        onChange={e => setNewRole(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:border-blue-500 focus:outline-none font-bold"
                      >
                        <option value="Cashier">Cashier (POS Billing & Printing)</option>
                        <option value="Manager">Manager (Billing, Purchases & Stocks)</option>
                        <option value="Administrator">Administrator (Full Store Access)</option>
                        <option value="Accountant">Accountant (Ledgers & Reports)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">4-Digit Shift PIN</label>
                      <input
                        type="password"
                        maxLength={6}
                        value={newPin}
                        onChange={e => setNewPin(e.target.value)}
                        placeholder="Default 0000"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:border-blue-500 focus:outline-none font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                    >
                      Save Staff User
                    </button>
                  </div>
                </form>
              )}

              {/* Staff List Table */}
              <div className="rounded-xl border border-slate-700 overflow-hidden bg-slate-800/50">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-800 text-slate-300 border-b border-slate-700 font-extrabold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Staff Name</th>
                      <th className="py-2.5 px-3">Username</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">PIN</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60 font-medium">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-slate-800/80 transition">
                        <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                          <span>{u.fullName}</span>
                          {currentUser.id === u.id && (
                            <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded-md border border-emerald-500/30">
                              Current
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">@{u.username}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            u.role === 'Administrator' ? 'bg-amber-500/20 text-amber-300' :
                            u.role === 'Manager' ? 'bg-indigo-500/20 text-indigo-300' :
                            'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">••••</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteStaff(u.id)}
                            className="text-rose-400 hover:text-rose-300 font-bold text-[11px] p-1 rounded hover:bg-rose-500/10 cursor-pointer"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Supabase Cloud Admin Auth */}
          {activeTab === 'cloud_login' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">
                      {activeCompany?.company_name || 'Active Store'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Multi-Tenant Cloud Sync: <span className="text-emerald-400 font-semibold">Active</span>
                    </p>
                  </div>
                </div>

                {sessionEmail ? (
                  <div className="flex items-center gap-2">
                    <div className="text-right text-xs">
                      <span className="text-slate-400 block text-[10px]">Cloud Account</span>
                      <strong className="text-emerald-300">{sessionEmail}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={handleSupabaseSignOut}
                      className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                ) : (
                  <span className="text-xs bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full font-bold">
                    Guest / Local Mode
                  </span>
                )}
              </div>

              {!sessionEmail && (
                <form onSubmit={handleSupabaseSignIn} className="p-4 bg-slate-800/50 border border-slate-700 rounded-2xl space-y-3 max-w-md mx-auto">
                  <h3 className="font-bold text-white text-xs sm:text-sm text-center">
                    Sign in to Supabase Multi-Tenant Account
                  </h3>
                  <p className="text-xs text-slate-400 text-center">
                    Enter store owner credentials to connect remote database syncing.
                  </p>

                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Email Address</label>
                      <input
                        type="email"
                        required
                        value={authEmail}
                        onChange={e => setAuthEmail(e.target.value)}
                        placeholder="owner@store.com"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={authPassword}
                          onChange={e => setAuthPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 pr-9 text-white text-xs focus:border-blue-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-2 mt-2"
                  >
                    {authLoading ? 'Signing in...' : 'Sign In with Supabase'}
                  </button>
                </form>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-800/80 px-5 py-3 border-t border-slate-700 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Role-Based Security & Permissions Active</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
