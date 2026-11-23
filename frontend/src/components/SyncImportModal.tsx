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
  const [tzOffset, setTzOffset] = useState(7);

  useEffect(() => {
    if (settings) {
      setDailyLoss(settings.daily_loss_limit);
      setMaxTrades(settings.max_trades_per_day);
      setMaxRisk(settings.max_risk_per_trade);
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
        timezone_offset_hours: Number(tzOffset),
      });
      onSettingsUpdated(updated);
      setFeedback({ ok: true, text: 'Đã lưu quy tắc quản lý rủi ro & múi giờ.' });
      onRefreshAll();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">Đồng bộ MT5, Import & Quy tắc</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-5">
          <button
            onClick={() => { setTab('mt5'); setFeedback(null); }}
            className={`border-b-2 px-3 py-2.5 text-xs font-semibold ${
              tab === 'mt5' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500'
            }`}
          >
            Kết nối MT5 trực tiếp
          </button>
          <button
            onClick={() => { setTab('import'); setFeedback(null); }}
            className={`border-b-2 px-3 py-2.5 text-xs font-semibold ${
              tab === 'import' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500'
            }`}
          >
            Import file MT5
          </button>
          <button
            onClick={() => { setTab('rules'); setFeedback(null); }}
            className={`border-b-2 px-3 py-2.5 text-xs font-semibold ${
              tab === 'rules' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500'
            }`}
          >
            Quy tắc kỷ luật (Rule Guardian)
          </button>
        </div>

        <div className="space-y-4 p-5">
          {tab === 'mt5' && (
            <>
              <div
                className={`flex items-start gap-3 rounded-xl border p-3.5 ${
                  mt5Status?.connected
                    ? 'border-emerald-200 bg-emerald-50/70'
                    : 'border-amber-200 bg-amber-50/70'
                }`}
              >
                {mt5Status?.connected ? (
                  <Wifi className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                )}
                <div className="text-xs">
                  <div className="font-bold text-slate-900">
                    {mt5Status?.connected ? `Đã kết nối tài khoản #${mt5Status.account_login}` : 'Chưa phát hiện MT5 đang chạy'}
                  </div>
                  <p className="mt-0.5 text-slate-600">{mt5Status?.message}</p>
                  {mt5Status?.connected && (
                    <p className="mt-1 font-medium text-emerald-800">
                      Balance: ${mt5Status.balance?.toLocaleString()} {mt5Status.currency} · Equity: ${mt5Status.equity?.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Lấy lịch sử (số ngày gần nhất)</label>
                  <select
                    value={daysBack}
                    onChange={(e) => setDaysBack(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value={7}>7 ngày gần nhất</option>
                    <option value={30}>30 ngày gần nhất</option>
                    <option value={90}>90 ngày gần nhất</option>
                    <option value={180}>6 tháng gần nhất</option>
                    <option value={365}>1 năm gần nhất</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={fetchCandles}
                      onChange={(e) => setFetchCandles(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Tải & cache nến M5 + tính MFE/MAE
                  </label>
                </div>
              </div>

              <button
                onClick={handleMt5Sync}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
                {busy ? 'Đang đồng bộ từ MT5...' : 'Đồng bộ lệnh từ MT5 ngay'}
              </button>

              <div className="border-t border-slate-100 pt-3">
                <p className="mb-2 text-xs font-semibold text-slate-500">Chế độ trải nghiệm nhanh (Dữ liệu mẫu)</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleLoadDemo}
                    disabled={busy}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    Nạp dữ liệu mẫu T11/2026
                  </button>
                  <button
                    onClick={handleClearDemo}
                    disabled={busy}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
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
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                Trong MT5: mở tab <strong>History (Lịch sử)</strong> → chuột phải → <strong>Report</strong> → chọn <strong>Open XML (MS Office Excel .xlsx)</strong> hoặc <strong>HTML</strong> rồi tải lên đây. Hỗ trợ cả file <strong>.csv</strong>.
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Tên nhãn tài khoản</label>
                <input
                  value={accountLabel}
                  onChange={(e) => setAccountLabel(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="VD: Exness Live / FTMO 100k"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Chọn file báo cáo MT5 (.xlsx, .html, .csv)</label>
                <input
                  type="file"
                  accept=".xlsx,.xlsm,.html,.htm,.csv"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-dashed border-slate-300 p-3 text-xs"
                />
              </div>
              <button
                onClick={handleImport}
                disabled={busy || !file}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                <FileUp className="h-4 w-4" />
                {busy ? 'Đang nhập dữ liệu...' : 'Import lịch sử giao dịch'}
              </button>
            </>
          )}

          {tab === 'rules' && (
            <>
              <div className="flex items-start gap-2.5 rounded-xl bg-amber-50/70 p-3 text-xs text-amber-900">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  <strong>Rule Guardian</strong> tự động cảnh báo trên lịch và trang Phân tích nếu có ngày vượt giới hạn lỗ hoặc vào quá số lệnh quy định.
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Lỗ tối đa / ngày (USD)</label>
                  <input
                    type="number"
                    value={dailyLoss}
                    onChange={(e) => setDailyLoss(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Số lệnh tối đa / ngày</label>
                  <input
                    type="number"
                    value={maxTrades}
                    onChange={(e) => setMaxTrades(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Rủi ro tối đa / lệnh (USD)</label>
                  <input
                    type="number"
                    value={maxRisk}
                    onChange={(e) => setMaxRisk(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Múi giờ hiển thị (UTC+)</label>
                  <input
                    type="number"
                    value={tzOffset}
                    onChange={(e) => setTzOffset(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveRules}
                disabled={busy}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Lưu quy tắc & cài đặt
              </button>
            </>
          )}

          {feedback && (
            <div
              className={`flex items-start gap-2 rounded-xl p-3 text-xs font-medium ${
                feedback.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
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
