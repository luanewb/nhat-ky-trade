import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Database,
  FileUp,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { api } from '../api';
import type { MT5Status, Settings } from '../types';

interface SyncImportModalProps {
  open: boolean;
  onClose: () => void;
  mt5Status: MT5Status | null;
  settings: Settings | null;
  onRefreshAll: () => void;
  onSettingsUpdated: (s: Settings) => void;
}

export function SyncImportModal({
  open,
  onClose,
  mt5Status,
  settings,
  onRefreshAll,
  onSettingsUpdated,
}: SyncImportModalProps) {
  const [tab, setTab] = useState<'mt5' | 'import' | 'rules'>('mt5');
  const [daysBack, setDaysBack] = useState(90);
  const [fetchCandles, setFetchCandles] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const [accountLabel, setAccountLabel] = useState('MT5 Report');
  const [file, setFile] = useState<File | null>(null);

  const [dailyLoss, setDailyLoss] = useState(500);
  const [maxTrades, setMaxTrades] = useState(8);
  const [maxRisk, setMaxRisk] = useState(250);
  const [accountBalance, setAccountBalance] = useState(10000);
  const [tzOffset, setTzOffset] = useState(7);

  useEffect(() => {
    if (settings) {
      setDailyLoss(settings.daily_loss_limit);
      setMaxTrades(settings.max_trades_per_day);
      setMaxRisk(settings.max_risk_per_trade);
      setAccountBalance(settings.account_balance ?? 10000);
      setTzOffset(settings.timezone_offset_hours);
    }
  }, [settings, open]);

  if (!open) return null;

  const handleMt5Sync = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.mt5Sync({ days_back: daysBack, fetch_candles: fetchCandles });
      setFeedback({ ok: res.success, text: res.message });
      if (res.success) onRefreshAll();
    } catch (e: unknown) {
      setFeedback({ ok: false, text: String(e) });
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.importFile(file, accountLabel);
      setFeedback({ ok: res.success, text: res.message });
      if (res.success) onRefreshAll();
    } catch (e: unknown) {
      setFeedback({ ok: false, text: String(e) });
    } finally {
      setBusy(false);
    }
  };

  const handleLoadDemo = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.loadDemo();
      setFeedback({ ok: res.success, text: res.message });
      onRefreshAll();
    } finally {
      setBusy(false);
    }
  };

  const handleClearDemo = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await api.clearDemo();
      setFeedback({ ok: res.success, text: res.message });
      onRefreshAll();
    } finally {
      setBusy(false);
    }
  };

  const handleSaveRules = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const updated = await api.saveSettings({
        daily_loss_limit: Number(dailyLoss),
        max_trades_per_day: Number(maxTrades),
        max_risk_per_trade: Number(maxRisk),
        account_balance: Number(accountBalance),
        timezone_offset_hours: Number(tzOffset),
      });
      onSettingsUpdated(updated);
      setFeedback({ ok: true, text: 'Đã lưu quy tắc quản lý rủi ro, vốn gốc & múi giờ.' });
      onRefreshAll();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12131c] text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Đồng bộ MT5, Import &amp; Quy tắc</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.07] px-5">
          <button
            onClick={() => {
              setTab('mt5');
              setFeedback(null);
            }}
            className={`border-b-2 px-3 py-2.5 text-xs font-semibold transition ${
              tab === 'mt5'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Kết nối MT5 trực tiếp
          </button>
          <button
            onClick={() => {
              setTab('import');
              setFeedback(null);
            }}
            className={`border-b-2 px-3 py-2.5 text-xs font-semibold transition ${
              tab === 'import'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Import file MT5
          </button>
          <button
            onClick={() => {
              setTab('rules');
              setFeedback(null);
            }}
            className={`border-b-2 px-3 py-2.5 text-xs font-semibold transition ${
              tab === 'rules'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Quy tắc kỷ luật &amp; Vốn
          </button>
        </div>

        <div className="space-y-4 p-5">
          {tab === 'mt5' && (
            <>
              <div
                className={`flex items-start gap-3 rounded-xl border p-3.5 ${
                  mt5Status?.connected
                    ? 'border-emerald-500/25 bg-emerald-500/10'
                    : 'border-amber-500/25 bg-amber-500/10'
                }`}
              >
                {mt5Status?.connected ? (
                  <Wifi className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                ) : (
                  <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                )}
                <div className="text-xs">
                  <div className="font-bold text-white">
                    {mt5Status?.connected
                      ? `Đã kết nối tài khoản #${mt5Status.account_login}`
                      : 'Chưa phát hiện MT5 đang chạy'}
                  </div>
                  <p className="mt-0.5 text-slate-300">{mt5Status?.message}</p>
                  {mt5Status?.connected && (
                    <p className="mt-1 font-medium text-emerald-300">
                      Balance: ${mt5Status.balance?.toLocaleString()} {mt5Status.currency} · Equity: $
                      {mt5Status.equity?.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    Lấy lịch sử (số ngày gần nhất)
                  </label>
                  <select
                    value={daysBack}
                    onChange={(e) => setDaysBack(Number(e.target.value))}
                    className="w-full rounded-lg border border-white/[0.08] bg-[#171925] px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value={7} className="bg-[#171925]">7 ngày gần nhất</option>
                    <option value={30} className="bg-[#171925]">30 ngày gần nhất</option>
                    <option value={90} className="bg-[#171925]">90 ngày gần nhất</option>
                    <option value={180} className="bg-[#171925]">6 tháng gần nhất</option>
                    <option value={365} className="bg-[#171925]">1 năm gần nhất</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.08] bg-[#171925] px-3 py-2 text-xs font-medium text-slate-300">
                    <input
                      type="checkbox"
                      checked={fetchCandles}
                      onChange={(e) => setFetchCandles(e.target.checked)}
                      className="rounded border-slate-600 bg-transparent accent-emerald-500"
                    />
                    Tải &amp; cache nến M5 + tính MFE/MAE
                  </label>
                </div>
              </div>

              <button
                onClick={handleMt5Sync}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
                {busy ? 'Đang đồng bộ từ MT5...' : 'Đồng bộ lệnh từ MT5 ngay'}
              </button>

              <div className="border-t border-white/[0.07] pt-3">
                <p className="mb-2 text-xs font-semibold text-slate-400">
                  Chế độ trải nghiệm nhanh (Dữ liệu mẫu)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleLoadDemo}
                    disabled={busy}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#171925] py-2 text-xs font-semibold text-slate-200 transition hover:bg-[#1e2131]"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    Nạp dữ liệu mẫu T11/2026
                  </button>
                  <button
                    onClick={handleClearDemo}
                    disabled={busy}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Xóa dữ liệu mẫu
                  </button>
                </div>
              </div>
            </>
          )}

          {tab === 'import' && (
            <>
              <div className="rounded-xl border border-white/[0.07] bg-[#171925] p-3 text-xs text-slate-300">
                Trong MT5: mở tab <strong className="text-white">History (Lịch sử)</strong> → chuột phải →{' '}
                <strong className="text-white">Report</strong> → chọn{' '}
                <strong className="text-white">Open XML (MS Office Excel .xlsx)</strong> hoặc{' '}
                <strong className="text-white">HTML</strong> rồi tải lên đây. Hỗ trợ cả file{' '}
                <strong className="text-white">.csv</strong>.
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Tên nhãn tài khoản</label>
                <input
                  value={accountLabel}
                  onChange={(e) => setAccountLabel(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.08] bg-[#171925] px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  placeholder="VD: Exness Live / FTMO 100k"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Chọn file báo cáo MT5 (.xlsx, .html, .csv)
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xlsm,.html,.htm,.csv"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-dashed border-white/15 bg-[#171925] p-3 text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-600 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-indigo-500"
                />
              </div>
              <button
                onClick={handleImport}
                disabled={busy || !file}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                <FileUp className="h-4 w-4" />
                {busy ? 'Đang nhập dữ liệu...' : 'Import lịch sử giao dịch'}
              </button>
            </>
          )}

          {tab === 'rules' && (
            <>
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-200">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <span>
                  <strong className="text-amber-300">Rule Guardian</strong> tự động cảnh báo trên lịch và trang Phân tích nếu có ngày vượt giới hạn lỗ hoặc vào quá số lệnh quy định.
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    Lỗ tối đa / ngày (USD)
                  </label>
                  <input
                    type="number"
                    value={dailyLoss}
                    onChange={(e) => setDailyLoss(Number(e.target.value))}
                    className="w-full rounded-lg border border-white/[0.08] bg-[#171925] px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    Số lệnh tối đa / ngày
                  </label>
                  <input
                    type="number"
                    value={maxTrades}
                    onChange={(e) => setMaxTrades(Number(e.target.value))}
                    className="w-full rounded-lg border border-white/[0.08] bg-[#171925] px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    Rủi ro tối đa / lệnh (USD)
                  </label>
                  <input
                    type="number"
                    value={maxRisk}
                    onChange={(e) => setMaxRisk(Number(e.target.value))}
                    className="w-full rounded-lg border border-white/[0.08] bg-[#171925] px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    Vốn gốc tính Net Return % (USD)
                  </label>
                  <input
                    type="number"
                    value={accountBalance}
                    onChange={(e) => setAccountBalance(Number(e.target.value))}
                    className="w-full rounded-lg border border-white/[0.08] bg-[#171925] px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    Múi giờ hiển thị (UTC+)
                  </label>
                  <input
                    type="number"
                    value={tzOffset}
                    onChange={(e) => setTzOffset(Number(e.target.value))}
                    className="w-full rounded-lg border border-white/[0.08] bg-[#171925] px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveRules}
                disabled={busy}
                className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                Lưu quy tắc &amp; cài đặt
              </button>
            </>
          )}

          {feedback && (
            <div
              className={`flex items-start gap-2 rounded-xl border p-3 text-xs font-medium ${
                feedback.ok
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                  : 'border-rose-500/25 bg-rose-500/10 text-rose-300'
              }`}
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{feedback.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
