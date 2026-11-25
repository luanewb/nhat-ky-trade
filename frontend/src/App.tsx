import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { AnalyticsView } from './components/AnalyticsView';
import { DashboardView } from './components/DashboardView';
import { DayTradesDrawer } from './components/DayTradesDrawer';
import { Header } from './components/Header';
import { LessonsView } from './components/LessonsView';
import { SyncImportModal } from './components/SyncImportModal';
import { TradeDetailModal } from './components/TradeDetailModal';
import type {
  ActiveTab,
  AnalyticsResponse,
  CalendarResponse,
  FilterOptions,
  MT5Status,
  Settings,
  Trade,
} from './types';

export default function App() {
  const now = new Date();
  const [version, setVersion] = useState('1.0.2');
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [filters, setFilters] = useState<FilterOptions>({ accounts: [], symbols: [], sources: [] });
  const [selectedAccount, setSelectedAccount] = useState('ALL');
  const [selectedSymbol, setSelectedSymbol] = useState('ALL');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showWeekly, setShowWeekly] = useState(false);

  const [mt5Status, setMt5Status] = useState<MT5Status | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarResponse | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const [analyticsData, setAnalyticsData] = useState<AnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeTrade, setActiveTrade] = useState<Trade | null>(null);
  const [siblingTrades, setSiblingTrades] = useState<Trade[]>([]);

  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const showToast = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 3500);
  };

  const loadMeta = useCallback(async () => {
    try {
      const [h, f, st, cfg] = await Promise.all([
        api.health(),
        api.filters(),
        api.mt5Status(),
        api.getSettings(),
      ]);
      setVersion(h.version);
      setFilters(f);
      setMt5Status(st);
      setSettings(cfg);
    } catch {
      // ignore initial error
    }
  }, []);

  const loadCalendar = useCallback(async () => {
    setCalendarLoading(true);
    try {
      const res = await api.calendar(year, month, selectedAccount, selectedSymbol);
      setCalendarData(res);
    } finally {
      setCalendarLoading(false);
    }
  }, [year, month, selectedAccount, selectedSymbol]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await api.analytics({ account: selectedAccount, symbol: selectedSymbol });
      setAnalyticsData(res);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [selectedAccount, selectedSymbol]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  useEffect(() => {
    if (activeTab === 'dashboard' || activeTab === 'analytics') {
      loadAnalytics();
    }
  }, [activeTab, loadAnalytics]);

  // Escape key closes active modal/drawer cleanly
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeTrade) setActiveTrade(null);
        else if (syncModalOpen) setSyncModalOpen(false);
        else if (selectedDate) setSelectedDate(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTrade, syncModalOpen, selectedDate]);

  const refreshAll = useCallback(() => {
    loadMeta();
    loadCalendar();
    loadAnalytics();
  }, [loadMeta, loadCalendar, loadAnalytics]);

  const handleQuickSync = async () => {
    setSyncing(true);
    try {
      const res = await api.mt5Sync({ days_back: 90, fetch_candles: true });
      showToast(res.success, res.message);
      if (res.success) refreshAll();
      else setSyncModalOpen(true);
    } catch (e: unknown) {
      showToast(false, String(e));
    } finally {
      setSyncing(false);
    }
  };

  const handleLoadDemo = async () => {
    const res = await api.loadDemo();
    showToast(res.success, res.message);
    setYear(2026);
    setMonth(11);
    refreshAll();
  };

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const handleThisMonth = () => {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const handleTradeUpdated = (updated: Trade) => {
    setActiveTrade(updated);
    setSiblingTrades((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    loadCalendar();
    loadAnalytics();
  };

  const accountBalance =
    (mt5Status?.connected && mt5Status.balance && mt5Status.balance > 0
      ? mt5Status.balance
      : settings?.account_balance) || 10000;

  return (
    <div className="min-h-screen bg-[#0b0c12] text-slate-100">
      <Header
        version={version}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        filters={filters}
        selectedAccount={selectedAccount}
        setSelectedAccount={setSelectedAccount}
        selectedSymbol={selectedSymbol}
        setSelectedSymbol={setSelectedSymbol}
        mt5Status={mt5Status}
        onOpenSync={() => setSyncModalOpen(true)}
        onQuickSync={handleQuickSync}
        syncing={syncing}
      />

      <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            year={year}
            month={month}
            calendarData={calendarData}
            calendarLoading={calendarLoading}
            analyticsData={analyticsData}
            analyticsLoading={analyticsLoading}
            accountBalance={accountBalance}
            showWeekly={showWeekly}
            onToggleWeekly={() => setShowWeekly((v) => !v)}
            onChangeYear={setYear}
            onChangeMonth={setMonth}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onThisMonth={handleThisMonth}
            onSelectDate={(ds) => setSelectedDate(ds)}
            selectedDate={selectedDate}
            onLoadDemo={handleLoadDemo}
            onOpenSync={() => setSyncModalOpen(true)}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView data={analyticsData} loading={analyticsLoading} />
        )}

        {activeTab === 'lessons' && (
          <LessonsView
            onSelectTrade={(trade, list) => {
              setActiveTrade(trade);
              setSiblingTrades(list);
            }}
          />
        )}
      </main>

      {/* Day Trades Drawer */}
      <DayTradesDrawer
        dateStr={selectedDate}
        account={selectedAccount}
        symbol={selectedSymbol}
        onClose={() => setSelectedDate(null)}
        onSelectTrade={(trade, dayTrades) => {
          setActiveTrade(trade);
          setSiblingTrades(dayTrades);
        }}
        onJournalSaved={loadCalendar}
      />

      {/* Trade Detail Chart Replay & Journal Modal */}
      <TradeDetailModal
        trade={activeTrade}
        siblingTrades={siblingTrades}
        settings={settings}
        onClose={() => setActiveTrade(null)}
        onSelectSibling={(t) => setActiveTrade(t)}
        onTradeUpdated={handleTradeUpdated}
      />

      {/* Sync / Import / Rules Modal */}
      <SyncImportModal
        open={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        mt5Status={mt5Status}
        settings={settings}
        onRefreshAll={refreshAll}
        onSettingsUpdated={(s) => setSettings(s)}
      />

      {/* Global Toast */}
      {toast && (
        <div
          className={`fixed right-5 bottom-5 z-[80] max-w-sm rounded-xl border px-4 py-3 text-xs font-semibold text-white shadow-2xl ${
            toast.ok
              ? 'border-emerald-500/40 bg-emerald-600/95'
              : 'border-rose-500/40 bg-rose-600/95'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
