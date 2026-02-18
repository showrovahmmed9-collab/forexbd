
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ViewMode, Account, UserSession, HistoryEntry, AdminStats } from './types';
import { AccountTable } from './components/AccountTable';
import { StatCard } from './components/StatCard';
import { getAccountAudit } from './services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>(ViewMode.PUBLIC);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [session, setSession] = useState<UserSession>({ isAdmin: false });
  const [loading, setLoading] = useState(true);
  const [aiAudit, setAiAudit] = useState<string>('');
  const [loginError, setLoginError] = useState('');

  // Form states
  const [newAcc, setNewAcc] = useState('');
  const [newPkg, setNewPkg] = useState('22');
  const [num, setNum] = useState(1);
  const [unit, setUnit] = useState<'day' | 'week' | 'month'>('month');

  // Initialize data from localStorage (Simulating Worker KV)
  useEffect(() => {
    const saved = localStorage.getItem('ea_accounts');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Auto-update status based on date
      const today = new Date().toISOString().slice(0, 10);
      const updated = parsed.map((a: Account) => ({
        ...a,
        status: today > a.expire ? 'inactive' : 'active'
      }));
      setAccounts(updated);
    } else {
      // Seed initial data
      const seed: Account[] = [
        { account: "EA-001", expire: "2025-05-10", status: "active", package: "$22", history: [{ date: "2024-05-10", package: "$22", added: "1 month" }] },
        { account: "EA-002", expire: "2024-01-01", status: "inactive", package: "$15", history: [] }
      ];
      setAccounts(seed);
      localStorage.setItem('ea_accounts', JSON.stringify(seed));
    }
    setLoading(false);
  }, []);

  // Persist data whenever it changes
  useEffect(() => {
    if (!loading) {
      localStorage.setItem('ea_accounts', JSON.stringify(accounts));
    }
  }, [accounts, loading]);

  // Generate AI Insights when admin view is active
  useEffect(() => {
    if (view === ViewMode.ADMIN && accounts.length > 0 && !aiAudit) {
      getAccountAudit(accounts).then(setAiAudit);
    }
  }, [view, accounts, aiAudit]);

  const stats = useMemo<AdminStats>(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    let totalRevenue = 0;
    let thisMonthRevenue = 0;
    let lastPackageAmount = 0;
    let activeCount = 0;
    let expiringSoonCount = 0;

    accounts.forEach(acc => {
      if (acc.status === 'active') activeCount++;
      
      const expireDate = new Date(acc.expire);
      const diffDays = Math.ceil((expireDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 3) expiringSoonCount++;

      acc.history.forEach(h => {
        const val = parseFloat(h.package.replace('$', '')) || 0;
        totalRevenue += val;
        
        const hDate = new Date(h.date);
        if (hDate.getMonth() === currentMonth && hDate.getFullYear() === currentYear) {
          thisMonthRevenue += val;
        }
        lastPackageAmount = val;
      });
    });

    return { totalRevenue, thisMonthRevenue, lastPackageAmount, activeAccounts: activeCount, expiringSoon: expiringSoonCount };
  }, [accounts]);

  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    const data = months.map((m, i) => {
      let revenue = 0;
      accounts.forEach(acc => {
        acc.history.forEach(h => {
          const d = new Date(h.date);
          if (d.getMonth() === i && d.getFullYear() === currentYear) {
            revenue += parseFloat(h.package.replace('$', '')) || 0;
          }
        });
      });
      return { name: m, revenue };
    });
    return data;
  }, [accounts]);

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const user = formData.get('user');
    const pass = formData.get('pass');

    // Hardcoded demo check
    if (user === 'admin' && pass === 'admin123') {
      setSession({ isAdmin: true, username: 'Admin' });
      setView(ViewMode.ADMIN);
      setLoginError('');
    } else {
      setLoginError('Invalid username or password');
    }
  };

  const addAccount = () => {
    if (!newAcc || !newPkg) return alert("Fields required");

    let ms = 0;
    const today = new Date();
    if (unit === 'day') ms = num * 86400000;
    else if (unit === 'week') ms = num * 7 * 86400000;
    else if (unit === 'month') ms = num * 30 * 86400000;

    const existing = accounts.find(a => a.account === newAcc);
    const currentExpiry = existing ? new Date(existing.expire) : new Date();
    const baseDate = currentExpiry > today ? currentExpiry : today;
    const newExpireDate = new Date(baseDate.getTime() + ms).toISOString().slice(0, 10);

    const historyEntry: HistoryEntry = {
      date: today.toISOString().slice(0, 10),
      package: `$${newPkg}`,
      added: `${num} ${unit}`
    };

    if (existing) {
      setAccounts(prev => prev.map(a => a.account === newAcc ? {
        ...a,
        expire: newExpireDate,
        status: 'active',
        package: `$${newPkg}`,
        history: [...(a.history || []), historyEntry]
      } : a));
    } else {
      setAccounts(prev => [...prev, {
        account: newAcc,
        expire: newExpireDate,
        status: 'active',
        package: `$${newPkg}`,
        history: [historyEntry]
      }]);
    }

    setNewAcc('');
    setAiAudit(''); // Clear cache to trigger re-audit
  };

  const removeAccount = (accNo: string) => {
    if (window.confirm(`Delete ${accNo}?`)) {
      setAccounts(prev => prev.filter(a => a.account !== accNo));
      setAiAudit('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              EA PRO MANAGER
            </h1>
            <p className="text-[10px] text-slate-500 font-medium tracking-widest uppercase">Subscription Suite</p>
          </div>
        </div>

        <nav className="flex space-x-4">
          <button 
            onClick={() => setView(ViewMode.PUBLIC)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              view === ViewMode.PUBLIC ? 'bg-slate-800 text-white shadow-inner' : 'text-slate-400 hover:text-white'
            }`}
          >
            Public Status
          </button>
          {!session.isAdmin ? (
            <button 
              onClick={() => setView(ViewMode.LOGIN)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === ViewMode.LOGIN ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:text-white'
              }`}
            >
              Admin Access
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setView(ViewMode.ADMIN)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  view === ViewMode.ADMIN ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Dashboard
              </button>
              <button 
                onClick={() => { setSession({ isAdmin: false }); setView(ViewMode.PUBLIC); }}
                className="p-2 text-slate-400 hover:text-rose-400 transition-colors"
                title="Logout"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow p-6 md:p-10 max-w-7xl mx-auto w-full">
        {view === ViewMode.PUBLIC && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Account Status</h2>
                <p className="text-slate-400">Live monitoring of active EA subscription slots.</p>
              </div>
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                  <span className="text-slate-400">Active</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.5)]"></span>
                  <span className="text-slate-400">Expired</span>
                </div>
              </div>
            </div>
            <AccountTable accounts={accounts} isAdmin={false} />
          </div>
        )}

        {view === ViewMode.LOGIN && (
          <div className="flex items-center justify-center py-20 animate-fadeIn">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
              <div className="text-center mb-10">
                <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                  <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white">System Login</h2>
                <p className="text-slate-400 text-sm mt-1">Authorized personnel only.</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Username</label>
                  <input 
                    name="user"
                    type="text" 
                    required 
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                    placeholder="Enter username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Password</label>
                  <input 
                    name="pass"
                    type="password" 
                    required 
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                    placeholder="••••••••"
                  />
                </div>
                {loginError && <p className="text-rose-400 text-sm text-center font-medium">{loginError}</p>}
                <button 
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
                >
                  Sign In
                </button>
                <p className="text-center text-slate-500 text-xs mt-6">
                  Demo Credentials: <span className="text-slate-400">admin / admin123</span>
                </p>
              </form>
            </div>
          </div>
        )}

        {view === ViewMode.ADMIN && (
          <div className="space-y-10 animate-fadeIn">
            {/* Header & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard 
                title="Total Revenue" 
                value={`$${stats.totalRevenue.toLocaleString()}`} 
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                trend={{ value: '12%', isPositive: true }}
              />
              <StatCard 
                title="Active Accounts" 
                value={stats.activeAccounts} 
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
              />
              <StatCard 
                title="Expiring Soon" 
                value={stats.expiringSoon} 
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
              />
              <StatCard 
                title="This Month" 
                value={`$${stats.thisMonthRevenue}`} 
                icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Column */}
              <div className="lg:col-span-2 space-y-8">
                {/* Revenue Chart */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                  <h3 className="text-lg font-bold text-white mb-6">Revenue Performance</h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                        <XAxis dataKey="name" stroke="#64748b" axisLine={false} tickLine={false} />
                        <YAxis stroke="#64748b" axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                        <Tooltip 
                          cursor={{ fill: '#1e293b' }}
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                        />
                        <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.revenue > 0 ? '#3b82f6' : '#1e293b'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Account Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
                  <h3 className="text-lg font-bold text-white mb-6">Subscriber Management</h3>
                  <AccountTable 
                    accounts={accounts} 
                    isAdmin={true} 
                    onRemove={removeAccount}
                  />
                </div>
              </div>

              {/* Sidebar Column */}
              <div className="space-y-8">
                {/* Add Form */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sticky top-28">
                  <h3 className="text-lg font-bold text-white mb-6">New Subscription</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Account ID</label>
                      <input 
                        value={newAcc}
                        onChange={(e) => setNewAcc(e.target.value)}
                        placeholder="EA-XXXX" 
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Package ($)</label>
                      <input 
                        type="number"
                        value={newPkg}
                        onChange={(e) => setNewPkg(e.target.value)}
                        placeholder="Amount" 
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Count</label>
                        <input 
                          type="number" 
                          min="1"
                          value={num}
                          onChange={(e) => setNum(parseInt(e.target.value))}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Unit</label>
                        <select 
                          value={unit}
                          onChange={(e) => setUnit(e.target.value as any)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                          <option value="day">Day(s)</option>
                          <option value="week">Week(s)</option>
                          <option value="month">Month(s)</option>
                        </select>
                      </div>
                    </div>
                    <button 
                      onClick={addAccount}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/10 transition-all flex items-center justify-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                      <span>Add/Renew Account</span>
                    </button>
                  </div>

                  {/* AI Audit Section */}
                  <div className="mt-10 pt-10 border-t border-slate-800">
                    <div className="flex items-center space-x-2 mb-4">
                      <div className="w-8 h-8 bg-purple-600/20 rounded-lg flex items-center justify-center text-purple-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </div>
                      <h4 className="font-bold text-white">AI Auditor</h4>
                    </div>
                    <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl">
                      {aiAudit ? (
                        <p className="text-xs text-slate-400 leading-relaxed italic">
                          "{aiAudit}"
                        </p>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-4 space-y-3">
                          <div className="w-4 h-4 border-2 border-purple-500/50 border-t-purple-500 rounded-full animate-spin"></div>
                          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Generating Audit...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-xs">
          <p>© 2025 EA Subscription Management. All rights reserved.</p>
          <div className="flex space-x-6">
            <span className="flex items-center space-x-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
              <span>Systems Online</span>
            </span>
            <a href="#" className="hover:text-white transition-colors">Documentation</a>
            <a href="#" className="hover:text-white transition-colors">API Keys</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
