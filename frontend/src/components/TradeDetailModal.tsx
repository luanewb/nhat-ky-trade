import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  X,
} from 'lucide-react';
import { formatDuration, formatPrice, formatTimeVN, formatUSDExact } from '../api';
import type { Settings, Trade } from '../types';
import { TradeChart } from './TradeChart';
import { TradeJournalPanel } from './TradeJournalPanel';

interface TradeDetailModalProps {
  trade: Trade | null;
  siblingTrades: Trade[];
  settings: Settings | null;
  onClose: () => void;
  onSelectSibling: (t: Trade) => void;
  onTradeUpdated: (updated: Trade) => void;
}

export function TradeDetailModal({
  trade,
  siblingTrades,
  settings,
  onClose,
  onSelectSibling,
  onTradeUpdated,
}: TradeDetailModalProps) {
  if (!trade) return null;

  const curIdx = siblingTrades.findIndex((t) => t.id === trade.id);
  const hasPrev = curIdx > 0;
  const hasNext = curIdx >= 0 && curIdx < siblingTrades.length - 1;
  const isWin = trade.net_profit >= 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-xs">
      {/* Top Modal Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-[#0f131d] px-4 py-2.5 text-white">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-xs font-bold ${
              trade.direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
            }`}
          >
            {trade.direction === 'LONG' ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {trade.direction}
          </span>
          <span className="text-base font-bold tracking-tight">{trade.symbol}</span>
          <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
            {trade.volume} lot
          </span>
          <span
            className={`text-base font-extrabold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}
          >
            {formatUSDExact(trade.net_profit)}
          </span>
          {trade.r_multiple !== null && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                trade.r_multiple >= 0
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-rose-500/15 text-rose-300'
              }`}
            >
              {trade.r_multiple >= 0 ? `+${trade.r_multiple}R` : `${trade.r_multiple}R`}
            </span>
          )}
          <span className="hidden items-center gap-1 text-xs text-slate-400 md:inline-flex">
            <Clock className="h-3.5 w-3.5" />
            {formatTimeVN(trade.entry_time, true)} → {formatTimeVN(trade.exit_time)} (
            {formatDuration(trade.entry_time, trade.exit_time)}) · Phiên {trade.session}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {siblingTrades.length > 1 && curIdx >= 0 && (
            <div className="flex items-center gap-1 rounded-lg bg-slate-800/90 px-1.5 py-1 text-xs">
              <button
                disabled={!hasPrev}
                onClick={() => hasPrev && onSelectSibling(siblingTrades[curIdx - 1])}
                className="rounded p-0.5 text-slate-300 hover:bg-slate-700 disabled:opacity-30"
                title="Lệnh trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-1 text-[11px] font-medium text-slate-300">
                Lệnh {curIdx + 1}/{siblingTrades.length}
              </span>
              <button
                disabled={!hasNext}
                onClick={() => hasNext && onSelectSibling(siblingTrades[curIdx + 1])}
                className="rounded p-0.5 text-slate-300 hover:bg-slate-700 disabled:opacity-30"
                title="Lệnh tiếp theo"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 p-1.5 text-slate-300 transition hover:bg-slate-700 hover:text-white"
            title="Đóng (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Split View: Left Chart (68%) + Right Journal Panel (32%) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-12">
        <div className="flex min-h-[420px] flex-col lg:col-span-8">
          <div className="min-h-0 flex-1">
            <TradeChart trade={trade} />
          </div>

          {/* Bottom Execution Metrics Strip */}
          <div className="grid grid-cols-3 gap-2 border-t border-[#2a2e39] bg-[#0f131d] px-4 py-2.5 text-xs sm:grid-cols-6">
            <div>
              <span className="block text-[10px] text-slate-400">Entry / Exit</span>
              <span className="font-mono font-semibold text-slate-200">
                {formatPrice(trade.entry_price, trade.symbol)} → {formatPrice(trade.exit_price, trade.symbol)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400">Stop Loss / TP</span>
              <span className="font-mono font-semibold text-slate-200">
                {formatPrice(trade.effective_sl, trade.symbol)} / {formatPrice(trade.effective_tp, trade.symbol)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400">Max Run (MFE)</span>
              <span className="font-mono font-semibold text-emerald-400">
                {trade.mfe_r !== null ? `+${trade.mfe_r}R` : '—'}{' '}
                {trade.mfe_usd !== null ? `(${formatUSDExact(trade.mfe_usd)})` : ''}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400">Drawdown (MAE)</span>
              <span className="font-mono font-semibold text-rose-400">
                {trade.mae_r !== null ? `${trade.mae_r}R` : '—'}{' '}
                {trade.mae_usd !== null ? `(${formatUSDExact(trade.mae_usd)})` : ''}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400">Phí (Comm / Swap)</span>
              <span className="font-mono font-semibold text-slate-300">
                {formatUSDExact(trade.commission + trade.swap)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400">Tài khoản</span>
              <span className="truncate font-medium text-slate-300">{trade.account_login || trade.source}</span>
            </div>
          </div>
        </div>

        <div className="min-h-0 border-l border-slate-800 lg:col-span-4">
          <TradeJournalPanel trade={trade} settings={settings} onTradeUpdated={onTradeUpdated} />
        </div>
      </div>
    </div>
  );
}
