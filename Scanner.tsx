
import React from 'react';
import { View, User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeView: View;
  onViewChange: (view: View) => void;
  currentUser: User | null;
  onLogout: () => void;
  hasPendingRequests?: boolean;
}

// Custom SVG Icons
const Icons = {
  Inventory: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4"/><path d="M12 12v6"/><path d="M8 15h8"/></svg>
  ),
  StockIn: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M8 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4"/></svg>
  ),
  StockOut: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3"/><path d="m8 7 4-4 4 4"/><path d="M8 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/><path d="M16 5h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4"/></svg>
  ),
  Request: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7 1 1 0 0 1 1 1V10h4.5a1 1 0 0 1 1 1Z"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L12 14l-4 1 1-4 7.5-7.5Z"/></svg>
  ),
  Return: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
  ),
  Queue: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  ),
  Register: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
  ),
  History: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
  ),
  Dashboard: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
  ),
  Settings: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
  )
};

export const Layout: React.FC<LayoutProps> = ({ children, activeView, onViewChange, currentUser, onLogout, hasPendingRequests }) => {
  const isGuest = !currentUser;

  const navItems = [
    { id: View.INVENTORY, label: 'คลัง', icon: <Icons.Inventory />, roles: ['admin', 'staff'] },
    { id: View.GUEST_REQUEST, label: 'ขอ', icon: <Icons.Request />, roles: ['guest'] },
    { id: View.GUEST_RETURN, label: 'คืน', icon: <Icons.Return />, roles: ['guest'] },
    { id: View.STOCK_IN, label: 'รับเข้า', icon: <Icons.StockIn />, roles: ['admin', 'staff'] },
    { id: View.STOCK_OUT, label: 'จ่ายออก', icon: <Icons.StockOut />, roles: ['admin', 'staff'] },
  ].filter(item => {
    if (isGuest) return item.roles.includes('guest');
    return item.roles.includes(currentUser.role);
  });

  const headerActionItems = [
    { id: View.QUEUE_LIST, label: 'คิว', icon: <Icons.Queue />, roles: ['admin', 'staff'] },
    { id: View.REGISTRATION, label: 'สินค้า', icon: <Icons.Register />, roles: ['admin', 'staff'] },
    { id: View.DASHBOARD, label: 'สรุป', icon: <Icons.Dashboard />, roles: ['admin', 'staff'] },
    { id: View.USER_MANAGEMENT, label: 'ผู้ใช้', icon: <Icons.Settings />, roles: ['admin'] },
  ].filter(item => {
    if (isGuest) return false;
    return item.roles.includes(currentUser.role);
  });

  const getThemeColor = () => {
    if (currentUser?.role === 'admin') return 'bg-indigo-900';
    if (currentUser?.role === 'staff') return 'bg-blue-900';
    return 'bg-slate-900';
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f1f5f9]">
      <header className={`${getThemeColor()} text-white pt-6 pb-4 px-4 shadow-lg sticky top-0 z-[60] transition-all duration-700`}>
        <div className="max-w-5xl mx-auto flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div onClick={() => onViewChange(isGuest ? View.GUEST_REQUEST : View.INVENTORY)} className="cursor-pointer group">
              <h1 className="text-xl font-black tracking-tighter flex items-center gap-2">
                <span className="bg-white text-blue-900 w-8 h-8 rounded-lg flex items-center justify-center text-sm transform group-active:scale-90 transition-transform">PNK</span>
                PNK_PD <span className="text-blue-300 font-light">Stock</span>
                <span className="ml-1 text-[10px] font-bold text-blue-300/50">Update - 009</span>
              </h1>
              <div className="text-[9px] font-bold text-blue-200/60 uppercase tracking-[0.2em] mt-0.5">
                {currentUser ? `${currentUser.role}: ${currentUser.firstName}` : 'PATIENT SELF-SERVICE'}
              </div>
            </div>
            
            {!isGuest ? (
              <button onClick={onLogout} className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 hover:bg-red-500/20 text-white transition-all active:scale-90">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            ) : (
              <button onClick={() => onViewChange(View.USERS)} className="px-5 py-2.5 bg-emerald-500 text-white font-black text-[10px] rounded-xl shadow-lg shadow-emerald-900/20 active:scale-95 transition-all">
                STAFF LOGIN
              </button>
            )}
          </div>

          {!isGuest && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {headerActionItems.map((item) => {
                const isQueueButton = item.id === View.QUEUE_LIST;
                const shouldBlink = isQueueButton && hasPendingRequests;
                
                return (
                  <button 
                    key={item.id}
                    onClick={() => onViewChange(item.id)}
                    className={`flex shrink-0 items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[10px] transition-all ${
                      activeView === item.id 
                      ? 'bg-white text-blue-900 shadow-xl' 
                      : shouldBlink 
                        ? 'bg-amber-500 text-white animate-blink shadow-lg shadow-amber-900/20'
                        : 'bg-white/5 text-blue-100 hover:bg-white/10'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                    {shouldBlink && <span className="w-2 h-2 bg-white rounded-full ml-1"></span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 mb-28">
        {children}
      </main>

      <nav className="fixed bottom-6 left-4 right-4 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-2xl z-50 overflow-hidden">
        <div className="max-w-md mx-auto flex justify-around p-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex-1 flex flex-col items-center py-3 px-1 rounded-[2rem] transition-all relative ${
                activeView === item.id 
                  ? 'text-white' 
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {activeView === item.id && (
                <span className="absolute inset-0 bg-blue-600 rounded-[2rem] -z-10 scale-90 shadow-lg shadow-blue-600/40"></span>
              )}
              <div className={`mb-1 transition-transform duration-300 ${activeView === item.id ? 'scale-110 -translate-y-0.5' : ''}`}>
                {item.icon}
              </div>
              <span className={`text-[9px] uppercase tracking-widest font-black ${activeView === item.id ? 'opacity-100' : 'opacity-60'}`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};
