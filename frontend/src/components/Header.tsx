import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  RefreshCw,
  SlidersHorizontal,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { ActiveTab, FilterOptions, MT5Status } from '../types';

interface HeaderProps {
  version: string;
  activeTab: ActiveTab;
  setActiveTab: (t: ActiveTab) => void;
  filters: FilterOptions;
  selectedAccount: string;
  setSelectedAccount: (v: string) => void;
  selectedSymbol: string;
  setSelectedSymbol: (v: string) => void;
  mt5Status: MT5Status | null;
  onOpenSync: () => void;
  onQuickSync: () => void;
  syncing: boolean;
}

export function Header({
  version,
  activeTab,
  setActiveTab,
  filters,
  selectedAccount,
  setSelectedAccount,
  selectedSymbol,
  setSelectedSymbol,
  mt5Status,
  onOpenSync,
  onQuickSync,
  syncing,
}: HeaderProps) {
  const tabs: { id: ActiveTab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'analytics', label: 'Phân tích', icon: BarChart3 },
    { id: 'lessons', label: 'Bài học & Playbook', icon: BookOpen },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0d0e16]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Brand & Nav */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 text-white shadow-sm shadow-indigo-500/20">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-white sm:text-base">
                  Nhật Ký Giao Dịch
                </h1>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                  v{version}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">MT5 Trade Journal &amp; Chart Replay</p>
            </div>
          </div>

          <nav className="flex items-center rounded-xl border border-white/[0.06] bg-[#141622] p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all sm:text-sm ${
                    active
                      ? 'bg-[#222536] text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Filters & MT5 Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {filters.accounts.length > 0 && (
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="rounded-lg border border-white/[0.08] bg-[#161824] px-2.5 py-1.5 text-xs font-medium text-slate-200 focus:border-indigo-500 focus:outline-none"
              title="Lọc theo tài khoản MT5"
            >
              <option value="ALL" className="bg-[#161824]">Tất cả tài khoản</option>
              {filters.accounts.map((a) => (
                <option key={a.login} value={a.login} className="bg-[#161824]">
                  {a.name}
                </option>
              ))}
            </select>
          )}

          {filters.symbols.length > 0 && (
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="rounded-lg border border-white/[0.08] bg-[#161824] px-2.5 py-1.5 text-xs font-medium text-slate-200 focus:border-indigo-500 focus:outline-none"
              title="Lọc theo cặp tiền / sản phẩm"
            >
              <option value="ALL" className="bg-[#161824]">Tất cả Symbol</option>
              {filters.symbols.map((s) => (
                <option key={s} value={s} className="bg-[#161824]">
                  {s}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={onQuickSync}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-60"
            title={mt5Status?.message || 'Đồng bộ lệnh trực tiếp từ MT5'}
          >
            {mt5Status?.connected ? (
              <Wifi className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-amber-400" />
            )}
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Đang sync...' : 'Sync MT5'}</span>
          </button>

          <button
            onClick={onOpenSync}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-[#1b1e2e] px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-[#24283c]"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Dữ liệu &amp; Quy tắc</span>
          </button>
        </div>
      </div>
    </header>
  );
}
