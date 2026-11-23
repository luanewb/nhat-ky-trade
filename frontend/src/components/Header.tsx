import {
  BarChart3,
  BookOpen,
  CalendarDays,
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
  const tabs: { id: ActiveTab; label: string; icon: typeof CalendarDays }[] = [
    { id: 'calendar', label: 'Lịch P&L', icon: CalendarDays },
    { id: 'analytics', label: 'Phân tích', icon: BarChart3 },
    { id: 'lessons', label: 'Bài học & Playbook', icon: BookOpen },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Brand & Nav */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-sm">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-slate-900">Nhật Ký Giao Dịch</h1>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                  v{version}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">MT5 Trade Journal & Chart Replay</p>
            </div>
          </div>

          <nav className="flex items-center rounded-xl bg-slate-100/90 p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
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
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs focus:border-emerald-500 focus:outline-none"
              title="Lọc theo tài khoản MT5"
            >
              <option value="ALL">Tất cả tài khoản</option>
              {filters.accounts.map((a) => (
                <option key={a.login} value={a.login}>
                  {a.name}
                </option>
              ))}
            </select>
          )}

          {filters.symbols.length > 0 && (
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs focus:border-emerald-500 focus:outline-none"
              title="Lọc theo cặp tiền / sản phẩm"
            >
              <option value="ALL">Tất cả Symbol</option>
              {filters.symbols.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={onQuickSync}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
            title={mt5Status?.message || 'Đồng bộ lệnh trực tiếp từ MT5'}
          >
            {mt5Status?.connected ? (
              <Wifi className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-amber-500" />
            )}
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Đang sync...' : 'Sync MT5'}</span>
          </button>

          <button
            onClick={onOpenSync}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Dữ liệu & Quy tắc</span>
          </button>
        </div>
      </div>
    </header>
  );
}
