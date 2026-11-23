import {
  AlertTriangle,
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  Columns3,
  NotebookPen,
  Sparkles,
} from 'lucide-react';
import { formatUSD } from '../api';
import type { CalendarResponse } from '../types';

interface CalendarViewProps {
  year: number;
  month: number;
  data: CalendarResponse | null;
  loading: boolean;
  showWeekly: boolean;
  onToggleWeekly: () => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onThisMonth: () => void;
  onSelectDate: (dateStr: string) => void;
  selectedDate: string | null;
  onLoadDemo: () => void;
  onOpenSync: () => void;
}

const MONTH_NAMES = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

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

export function CalendarView({
  year,
  month,
  data,
  loading,
  showWeekly,
  onToggleWeekly,
  onPrevMonth,
  onNextMonth,
  onThisMonth,
  onSelectDate,
  selectedDate,
  onLoadDemo,
  onOpenSync,
}: CalendarViewProps) {
  const weeks = buildMonthGrid(year, month);
  const monthlyPnl = data?.monthly_pnl ?? 0;
  const totalTrades = data?.total_trades ?? 0;

  const throughText = data?.last_trade_date
    ? `Cập nhật đến ${data.last_trade_date.split('-').reverse().join('/')}`
    : 'Chưa có giao dịch trong tháng';

  return (
    <div className="space-y-4">
      {/* Main Calendar Card matching Image 1 */}
      <div className="relative rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs sm:p-6">
        {/* Side Floating Prev / Next arrows like Image 1 */}
        <button
          onClick={onPrevMonth}
          className="absolute top-1/2 -left-3.5 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-slate-700/85 text-white shadow-md transition hover:scale-105 hover:bg-slate-800 md:flex"
          title="Tháng trước"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={onNextMonth}
          className="absolute top-1/2 -right-3.5 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-slate-700/85 text-white shadow-md transition hover:scale-105 hover:bg-slate-800 md:flex"
          title="Tháng sau"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* Calendar Top Bar */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <button
                onClick={onPrevMonth}
                className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                title="Tháng trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h2 className="min-w-[140px] text-center text-lg font-bold text-slate-900 sm:text-xl">
                {MONTH_NAMES[month - 1]} {year}
              </h2>
              <button
                onClick={onNextMonth}
                className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                title="Tháng sau"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={onThisMonth}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50"
            >
              Tháng này
            </button>

            <span className="text-xs font-medium text-slate-400">{throughText}</span>

            {totalTrades > 0 && (
              <div className="hidden items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 sm:flex">
                <span>
                  <strong className="text-slate-900">{totalTrades}</strong> lệnh
                </span>
                <span className="text-slate-300">•</span>
                <span>
                  Winrate <strong className="text-emerald-700">{data?.winrate}%</strong>
                </span>
                <span className="text-slate-300">•</span>
                <span>
                  <strong className="text-slate-900">{data?.trading_days}</strong> ngày trade
                </span>
              </div>
            )}
          </div>

          {/* Right side: Monthly P&L + Toggle Weekly column */}
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleWeekly}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                showWeekly
                  ? 'border-slate-300 bg-slate-100 text-slate-800'
                  : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'
              }`}
              title="Hiện/ẩn cột tổng kết tuần"
            >
              <Columns3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tổng tuần</span>
            </button>

            <div
              className={`text-xl font-extrabold tracking-tight sm:text-2xl ${
                monthlyPnl > 0
                  ? 'text-[#157a29]'
                  : monthlyPnl < 0
                    ? 'text-[#c82333]'
                    : 'text-slate-400'
              }`}
            >
              {formatUSD(monthlyPnl)}
            </div>
          </div>
        </div>

        {/* Weekday Headers */}
        <div
          className={`mb-2.5 grid gap-2 ${
            showWeekly ? 'grid-cols-7 lg:grid-cols-8' : 'grid-cols-7'
          }`}
        >
          {WEEKDAYS.map((wd) => (
            <div
              key={wd}
              className="rounded-lg border border-slate-200/80 bg-white py-2 text-center text-xs font-semibold text-slate-700"
            >
              {wd}
            </div>
          ))}
          {showWeekly && (
            <div className="hidden rounded-lg border border-slate-200/80 bg-slate-50 py-2 text-center text-xs font-semibold text-slate-600 lg:block">
              Tổng tuần
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
                    return (
                      <div
                        key={`empty-${wIdx}-${dIdx}`}
                        className="min-h-[96px] rounded-xl bg-slate-50/70 sm:min-h-[112px]"
                      />
                    );
                  }

                  const dayNum = Number(dateStr.split('-')[2]);
                  const info = data?.days?.[dateStr];
                  const isWin = info && info.net_profit > 0;
                  const isLoss = info && info.net_profit < 0;
                  const isSelected = selectedDate === dateStr;
                  const hasViolations = (info?.violations?.length ?? 0) > 0;

                  let cellClasses =
                    'bg-[#f3f4f6]/80 border-slate-200/50 hover:border-slate-300 hover:bg-slate-100/80';
                  if (isWin) {
                    cellClasses =
                      'bg-[#edf9ee] border-[#a8dfb1] hover:border-[#5bbd6b] hover:shadow-sm';
                  } else if (isLoss) {
                    cellClasses =
                      'bg-[#fdf0f0] border-[#f2b8b8] hover:border-[#e06666] hover:shadow-sm';
                  }

                  return (
                    <button
                      key={dateStr}
                      onClick={() => onSelectDate(dateStr)}
                      className={`group relative flex min-h-[96px] flex-col justify-between rounded-xl border p-2 text-left transition-all sm:min-h-[112px] sm:p-2.5 ${cellClasses} ${
                        isSelected ? 'ring-2 ring-slate-900 ring-offset-1' : ''
                      }`}
                    >
                      {/* Top Row: Indicators + Day Number */}
                      <div className="flex w-full items-start justify-between">
                        <div className="flex items-center gap-1">
                          {hasViolations && (
                            <span
                              title={info?.violations.join(' | ')}
                              className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-amber-700"
                            >
                              <AlertTriangle className="h-3 w-3" />
                            </span>
                          )}
                          {info?.has_daily_journal && (
                            <span
                              title="Có nhật ký tổng kết ngày"
                              className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-blue-700"
                            >
                              <BookOpenCheck className="h-3 w-3" />
                            </span>
                          )}
                          {info && info.noted_count > 0 && (
                            <span
                              title={`${info.noted_count}/${info.trade_count} lệnh đã ghi chú`}
                              className="inline-flex items-center gap-0.5 rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                            >
                              <NotebookPen className="h-2.5 w-2.5" />
                              {info.noted_count}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-medium text-slate-600">{dayNum}</span>
                      </div>

                      {/* Center P&L + Trade Count (Exact Image 1 visual hierarchy) */}
                      {info ? (
                        <div className="my-auto flex flex-col items-center justify-center text-center">
                          <span
                            className={`text-base font-extrabold tracking-tight sm:text-xl ${
                              isWin
                                ? 'text-[#157a29]'
                                : isLoss
                                  ? 'text-[#c82333]'
                                  : 'text-slate-700'
                            }`}
                          >
                            {formatUSD(info.net_profit)}
                          </span>
                          <span className="mt-0.5 text-[11px] font-medium text-slate-500">
                            {info.trade_count} trades
                          </span>
                        </div>
                      ) : (
                        <div className="my-auto flex items-center justify-center">
                          {dIdx === 0 || dIdx === 6 ? null : (
                            <span className="text-[11px] text-slate-400 opacity-0 transition group-hover:opacity-100">
                              Ghi chú
                            </span>
                          )}
                        </div>
                      )}

                      {/* Subtle R-Multiple bottom indicator */}
                      <div className="flex w-full justify-center">
                        {info?.r_total !== null && info?.r_total !== undefined && (
                          <span
                            className={`text-[10px] font-semibold ${
                              info.r_total >= 0 ? 'text-emerald-700/80' : 'text-rose-700/80'
                            }`}
                          >
                            {info.r_total >= 0 ? `+${info.r_total}R` : `${info.r_total}R`}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}

                {/* Optional Weekly Total Column */}
                {showWeekly && (
                  <div className="hidden min-h-[112px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-2 text-center lg:flex">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Tuần {wIdx + 1}
                    </span>
                    {weekSummary && weekSummary.trade_count > 0 ? (
                      <>
                        <span
                          className={`mt-1 text-base font-extrabold ${
                            weekSummary.net_profit >= 0 ? 'text-[#157a29]' : 'text-[#c82333]'
                          }`}
                        >
                          {formatUSD(weekSummary.net_profit)}
                        </span>
                        <span className="mt-0.5 text-[11px] text-slate-500">
                          {weekSummary.trade_count} trades · {weekSummary.trading_days} ngày
                        </span>
                      </>
                    ) : (
                      <span className="mt-1 text-xs text-slate-300">—</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty State Banner when user hasn't synced yet */}
        {!loading && totalTrades === 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Chưa có lệnh giao dịch trong {MONTH_NAMES[month - 1]} {year}
                </h3>
                <p className="mt-0.5 text-xs text-slate-600">
                  Hãy bấm <strong>Sync MT5</strong> để kéo lệnh trực tiếp từ MetaTrader 5, Import file báo cáo MT5, hoặc nạp <strong>Dữ liệu mẫu</strong> để trải nghiệm ngay.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onLoadDemo}
                className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700"
              >
                Nạp dữ liệu mẫu (Tháng 11/2026)
              </button>
              <button
                onClick={onOpenSync}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Đồng bộ / Import MT5
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
