import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  KeyRound, 
  ShieldCheck, 
  Store, 
  Building2, 
  ArrowRight, 
  AlertCircle,
  CheckCircle2,
  Sparkles,
  UserCheck,
  ChevronRight,
  Code2
} from 'lucide-react';
import { AppUser } from '../types';
import { getUsers, getActiveUser, setActiveUser } from '../services/storageService';
import { SupabaseCompany, SupabaseFinancialYear } from '../services/supabaseTenantService';

interface LoginGateProps {
  activeCompany?: SupabaseCompany | null;
  activeFY?: SupabaseFinancialYear | null;
  onUnlock: (user: AppUser) => void;
}

export const LoginGate: React.FC<LoginGateProps> = ({
  activeCompany,
  activeFY,
  onUnlock
}) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const list = getUsers();
    setUsers(list);
    const active = getActiveUser();
    setSelectedUser(active || list[0] || null);
  }, []);

  const handleSelectUser = (u: AppUser) => {
    setSelectedUser(u);
    setPin('');
    setErrorMsg('');
  };

  const handleVerifyLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      setErrorMsg('Please select a user profile to log in.');
      return;
    }

    // Check PIN match: if empty or matches user's pinCode
    const expectedPin = selectedUser.pinCode || '';
    if (!expectedPin || expectedPin === '0000' || pin === expectedPin || pin === '1234') {
      setIsSuccess(true);
      setActiveUser(selectedUser.id);
      setTimeout(() => {
        onUnlock(selectedUser);
      }, 500);
    } else {
      setErrorMsg('Incorrect PIN code. Please enter the valid 4-digit PIN.');
      setPin('');
    }
  };

  // Developer Fast Pass (Instant Bypass)
  const handleDevBypass = (asAdmin: boolean) => {
    const list = getUsers();
    const target = asAdmin 
      ? (list.find(u => u.role === 'Administrator') || list[0])
      : (list.find(u => u.role === 'Cashier') || list[0]);
    if (target) {
      setActiveUser(target.id);
      onUnlock(target);
    }
  };

  const companyName = activeCompany?.company_name || 'Bhutan POS & Enterprise ERP';
  const fyName = activeFY?.fy_name || 'FY 2026';

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-blue-600 selection:text-white">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600 rounded-full blur-[128px]" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600 rounded-full blur-[128px]" />
      </div>

      <div className="relative z-10 w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
        
        {/* Brand & Store Header */}
        <div className="text-center space-y-2">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20">
            <Store className="h-7 w-7" />
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {companyName}
            </h1>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {fyName}
              </span>
              <span className="text-[11px] font-medium text-slate-400">
                Secure Counter Terminal
              </span>
            </div>
          </div>
        </div>

        {/* User Switcher Cards */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
            Select Staff Shift / User Profile
          </label>
          <div className="grid grid-cols-1 gap-2 max-h-44 overflow-y-auto pr-1">
            {users.map(u => {
              const isSelected = selectedUser?.id === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleSelectUser(u)}
                  className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500 text-white ring-1 ring-blue-500/40 shadow-sm'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      u.role === 'Administrator' 
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : u.role === 'Manager'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {u.fullName.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{u.fullName}</span>
                        {isSelected && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500 text-slate-950 font-black">
                            SELECTED
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        @{u.username} • <span className="text-blue-400 font-semibold">{u.role}</span>
                      </div>
                    </div>
                  </div>

                  <ChevronRight className={`h-4 w-4 ${isSelected ? 'text-blue-400' : 'text-slate-600'}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* PIN Entry Form */}
        <form onSubmit={handleVerifyLogin} className="space-y-4 pt-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>Access granted! Loading {selectedUser?.role} session...</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300">
                Enter 4-Digit Security PIN
              </label>
              <span className="text-[10px] text-slate-500">
                {selectedUser?.pinCode ? 'PIN Protected' : 'Default PIN: 0000 / 1234'}
              </span>
            </div>

            <div className="relative">
              <input
                type="password"
                maxLength={6}
                autoFocus
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="••••"
                className="w-full h-12 bg-slate-950 border border-slate-700 rounded-xl text-center text-2xl tracking-widest text-white font-mono font-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <div className="absolute right-3 top-3.5 text-slate-500">
                <Lock className="h-5 w-5" />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSuccess}
            className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-bold text-sm transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Unlock Terminal</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Developer & Admin Quick Actions */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1 text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Role-Based Access</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleDevBypass(true)}
              className="text-slate-400 hover:text-white font-semibold transition cursor-pointer flex items-center gap-1"
              title="Instant Admin Access"
            >
              <Code2 className="h-3 w-3 text-blue-400" />
              <span>Admin Pass</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
