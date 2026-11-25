import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  Columns3,
  NotebookPen,
  Sparkles,
} from 'lucide-react';
import { formatDashboardUSD } from '../api';
import type { CalendarResponse } from '../types';

interface CalendarViewProps {
  year: number;
  month: number;
  data: CalendarResponse | null;
  loading: boolean;
  accountBalance: number;
  showWeekly: boolean;
  onToggleWeekly: () => void;
  onChangeYear: (y: number) => void;
  onChangeMonth: (m: number) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onThisMonth: () => void;
  onSelectDate: (dateStr: string) => void;
  selectedDate: string | null;
  onLoadDemo: () => void;
  onOpenSync: () => void;
}

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function buildMonthGrid(year: number, month: number): (string | null)[][] {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDow = firstDay.getDay(); // 0=Sun..6=Sat

  const weeks: (string | null)[][] = [];
  let curWeek: (string | null)[] = Array(startDow).fill(null);

  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    curWeek.push(ds);
    if (curWeek.length === 7) {
      weeks.push(curWeek);
      curWeek = [];
    }
  }
  if (curWeek.length > 0) {
    while (curWeek.length < 7) curWeek.push(null);
    weeks.push(curWeek);
  }
  return weeks;
}

function formatReturnPct(pnl: number, baseBalance: number): string {
  const denom = baseBalance > 0 ? baseBalance : 10000;
  const pct = (pnl / denom) * 100;
  const absStr = Math.abs(pct).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  if (pct < 0) return `-${absStr}%`;
  if (pct > 0) return `+${absStr}%`;
  return '0%';
}

export function CalendarView({
  year,
  month,
  data,
  loading,
  accountBalance,
  showWeekly,
  onToggleWeekly,
  onChangeYear,
  onChangeMonth,
  onPrevMonth,
  onNextMonth,
  onThisMonth,
  onSelectDate,
  selectedDate,
  onLoadDemo,
  onOpenSync,
}: CalendarViewProps) {
  const [displayMode, setDisplayMode] = useState<'pnl' | 'return'>('pnl');

  const weeks = buildMonthGrid(year, month);
  const monthlyPnl = data?.monthly_pnl ?? 0;
  const totalTrades = data?.total_trades ?? 0;

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const minY = Math.min(2022, year - 2, currentYear - 2);
    const maxY = Math.max(2027, year + 1, currentYear + 1);
    const arr: number[] = [];
    for (let y = maxY; y >= minY; y--) arr.push(y);
    return arr;
  }, [year]);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#12131c] p-4 sm:p-5">
      {/* Top Bar matching reference Monthly Calendar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-100">
            Monthly Calendar
          </h2>
          <span
            className={`text-[15px] font-bold tracking-tight tabular-nums ${
              monthlyPnl > 0
                ? 'text-[#34d399]'
                : monthlyPnl < 0
                  ? 'text-[#f87171]'
                  : 'text-slate-400'
            }`}
          >
            {displayMode === 'pnl'
              ? formatDashboardUSD(monthlyPnl)
              : formatReturnPct(monthlyPnl, accountBalance)}
          </span>

          {totalTrades > 0 && (
            <div className="hidden items-center gap-2 rounded-full border border-white/[0.06] bg-[#181a26] px-2.5 py-0.5 text-[11px] text-slate-400 md:flex">
              <span>
                <strong className="text-slate-200">{totalTrades}</strong> trades
              </span>
              <span className="text-slate-600">•</span>
              <span>
                WR <strong className="text-emerald-400">{data?.winrate}%</strong>
              </span>
              <span className="text-slate-600">•</span>
              <span>
                <strong className="text-slate-200">{data?.trading_days}</strong> days
              </span>
            </div>
          )}
        </div>

        {/* Right Controls: Net P&L | Net Return(%), Year, Month, Prev/Next, Weekly */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Display Mode */}
          <div className="flex items-center rounded-lg border border-white/[0.07] bg-[#0e1018] p-0.5 text-[11px] font-medium">
            <button
              type="button"
              onClick={() => setDisplayMode('pnl')}
              className={`rounded-md px-2.5 py-1 transition ${
                displayMode === 'pnl'
                  ? 'bg-[#222536] text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Net P&amp;L
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('return')}
              className={`rounded-md px-2.5 py-1 transition ${
                displayMode === 'return'
                  ? 'bg-[#222536] text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={`Tính % trên vốn $${accountBalance.toLocaleString('en-US')}`}
            >
              Net Return(%)
            </button>
          </div>

          {/* Year Select */}
          <select
            value={year}
            onChange={(e) => onChangeYear(Number(e.target.value))}
            className="rounded-lg border border-white/[0.08] bg-[#171925] px-2.5 py-1.5 text-xs font-medium text-slate-200 focus:border-indigo-500/70 focus:outline-none"
            title="Chọn năm"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y} className="bg-[#171925] text-slate-200">
                {y}
              </option>
            ))}
          </select>

          {/* Month Select */}
          <select
            value={month}
            onChange={(e) => onChangeMonth(Number(e.target.value))}
            className="rounded-lg border border-white/[0.08] bg-[#171925] px-2.5 py-1.5 text-xs font-medium text-slate-200 focus:border-indigo-500/70 focus:outline-none"
            title="Chọn tháng"
          >
            {MONTH_SHORT.map((mName, idx) => (
              <option key={mName} value={idx + 1} className="bg-[#171925] text-slate-200">
                {mName}
              </option>
            ))}
          </select>

          {/* Prev / Next Month Arrows */}
          <div className="flex items-center rounded-lg border border-white/[0.08] bg-[#171925]">
            <button
              type="button"
              onClick={onPrevMonth}
              className="rounded-l-lg p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
              title="Tháng trước"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onThisMonth}
              className="border-x border-white/[0.06] px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
              title="Về tháng hiện tại"
            >
              Today
            </button>
            <button
              type="button"
              onClick={onNextMonth}
              className="rounded-r-lg p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
              title="Tháng sau"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Toggle Weekly Summary Column */}
          <button
            type="button"
            onClick={onToggleWeekly}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition ${
              showWeekly
                ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300'
                : 'border-white/[0.08] bg-[#171925] text-slate-400 hover:text-slate-200'
            }`}
            title="Hiện/ẩn cột tổng kết tuần"
          >
            <Columns3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Weekly</span>
          </button>
        </div>
      </div>

      {/* Minimal Weekday Headers */}
      <div
        className={`mb-2 grid gap-2 ${
          showWeekly ? 'grid-cols-7 lg:grid-cols-8' : 'grid-cols-7'
        }`}
      >
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="px-1 text-left text-xs font-medium text-slate-500">
            {wd}
          </div>
        ))}
        {showWeekly && (
          <div className="hidden px-1 text-center text-xs font-medium text-slate-500 lg:block">
            Weekly
          </div>
        )}
      </div>

      {/* Calendar Grid */}
      <div className={`space-y-2 transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
        {weeks.map((week, wIdx) => {
          const weekSummary = data?.weeks?.[wIdx];
          return (
            <div
              key={wIdx}
              className={`grid gap-2 ${
                showWeekly ? 'grid-cols-7 lg:grid-cols-8' : 'grid-cols-7'
              }`}
            >
              {week.map((dateStr, dIdx) => {
                if (!dateStr) {
                  return <div key={`empty-${wIdx}-${dIdx}`} className="min-h-[84px] sm:min-h-[96px]" />;
                }

                const dayLabel = dateStr.split('-')[2];
                const info = data?.days?.[dateStr];
                const isWin = info && info.net_profit > 0;
                const isLoss = info && info.net_profit < 0;
                const isSelected = selectedDate === dateStr;
                const hasViolations = (info?.violations?.length ?? 0) > 0;

                let cellClasses =
                  'bg-[#191b27] border-white/[0.04] hover:border-white/[0.14] hover:bg-[#1e2130]';
                if (isWin) {
                  cellClasses =
                    'bg-[#132624] border-emerald-500/20 hover:border-emerald-400/50 hover:bg-[#162d2a]';
                } else if (isLoss) {
                  cellClasses =
                    'bg-[#2a161c] border-rose-500/20 hover:border-rose-400/50 hover:bg-[#321a21]';
                }

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => onSelectDate(dateStr)}
                    className={`group relative flex min-h-[84px] flex-col items-center justify-center rounded-xl border px-1.5 py-2 text-center transition-all sm:min-h-[96px] sm:px-2 ${cellClasses} ${
                      isSelected ? 'ring-2 ring-indigo-400/80 ring-offset-1 ring-offset-[#12131c]' : ''
                    }`}
                  >
                    {/* Subtle Corner Status Icons */}
                    {(hasViolations || info?.has_daily_journal || (info && info.noted_count > 0)) && (
                      <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                        {hasViolations && (
                          <span
                            title={info?.violations.join(' | ')}
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/20 text-amber-400"
                          >
                            <AlertTriangle className="h-2.5 w-2.5" />
                          </span>
                        )}
                        {info?.has_daily_journal && (
                          <span
                            title="Có nhật ký tổng kết ngày"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-500/20 text-sky-400"
                          >
                            <BookOpenCheck className="h-2.5 w-2.5" />
                          </span>
                        )}
                        {info && info.noted_count > 0 && (
                          <span
                            title={`${info.noted_count}/${info.trade_count} lệnh đã ghi chú`}
                            className="inline-flex items-center gap-0.5 rounded-full bg-white/[0.08] px-1 py-0.5 text-[9px] font-medium text-slate-300"
                          >
                            <NotebookPen className="h-2.5 w-2.5" />
                            {info.noted_count}
                          </span>
                        )}
                      </div>
                    )}

                    {info ? (
                      <>
                        <span className="text-xs font-medium text-slate-300/90 tabular-nums">
                          {dayLabel}
                        </span>
                        <span
                          className={`mt-1 text-sm font-bold tracking-tight tabular-nums sm:text-[15px] ${
                            isWin
                              ? 'text-[#34d399]'
                              : isLoss
                                ? 'text-[#f87171]'
                                : 'text-slate-200'
                          }`}
                        >
                          {displayMode === 'pnl'
                            ? formatDashboardUSD(info.net_profit, true)
                            : formatReturnPct(info.net_profit, accountBalance)}
                        </span>
                        <span className="mt-0.5 text-[11px] font-medium text-slate-400/80">
                          {info.trade_count} {info.trade_count === 1 ? 'trade' : 'trades'}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs font-medium text-slate-400/85 tabular-nums transition group-hover:text-slate-200">
                        {dayLabel}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Optional Weekly Summary Column */}
              {showWeekly && (
                <div className="hidden min-h-[96px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-[#151722] p-2 text-center lg:flex">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Week {wIdx + 1}
                  </span>
                  {weekSummary && weekSummary.trade_count > 0 ? (
                    <>
                      <span
                        className={`mt-1 text-sm font-bold tabular-nums ${
                          weekSummary.net_profit >= 0 ? 'text-[#34d399]' : 'text-[#f87171]'
                        }`}
                      >
                        {displayMode === 'pnl'
                          ? formatDashboardUSD(weekSummary.net_profit, true)
                          : formatReturnPct(weekSummary.net_profit, accountBalance)}
                      </span>
                      <span className="mt-0.5 text-[10px] text-slate-500">
                        {weekSummary.trade_count} trades · {weekSummary.trading_days}d
                      </span>
                    </>
                  ) : (
                    <span className="mt-1 text-xs text-slate-600">—</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State Banner when user hasn't synced yet */}
      {!loading && totalTrades === 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/[0.06] p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Chưa có lệnh giao dịch trong {MONTH_SHORT[month - 1]} {year}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Bấm <strong className="text-slate-200">Sync MT5</strong> để kéo lệnh trực tiếp từ MetaTrader 5, Import file báo cáo MT5, hoặc nạp <strong className="text-slate-200">Dữ liệu mẫu</strong>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onLoadDemo}
              className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
            >
              Nạp dữ liệu mẫu (Nov 2026)
            </button>
            <button
              type="button"
              onClick={onOpenSync}
              className="rounded-lg border border-white/10 bg-[#1a1c28] px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-[#222536]"
            >
              Đồng bộ / Import MT5
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
