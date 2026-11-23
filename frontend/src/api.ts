import type {
  AnalyticsResponse,
  CalendarResponse,
  DailyJournal,
  FilterOptions,
  MT5Status,
  Settings,
  Trade,
  TradeCandlesResponse,
} from './types';

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  health: () => req<{ status: string; version: string; total_trades: number }>('/api/health'),
  mt5Status: () => req<MT5Status>('/api/mt5/status'),
  mt5Sync: (payload: { days_back?: number; date_from?: string; date_to?: string; fetch_candles?: boolean }) =>
    req<{ success: boolean; synced: number; candles_cached?: number; message: string }>('/api/mt5/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  importFile: (file: File, accountLabel: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('account_label', accountLabel);
    return req<{ success: boolean; imported: number; message: string }>('/api/import', {
      method: 'POST',
      body: fd,
    });
  },
  loadDemo: () => req<{ success: boolean; loaded: number; message: string }>('/api/demo/load', { method: 'POST' }),
  clearDemo: () => req<{ success: boolean; deleted: number; message: string }>('/api/demo/clear', { method: 'DELETE' }),
  filters: () => req<FilterOptions>('/api/filters'),
  calendar: (year: number, month: number, account?: string, symbol?: string) => {
    const sp = new URLSearchParams({ year: String(year), month: String(month) });
    if (account && account !== 'ALL') sp.set('account', account);
    if (symbol && symbol !== 'ALL') sp.set('symbol', symbol);
    return req<CalendarResponse>(`/api/calendar?${sp}`);
  },
  trades: (params: { date?: string; account?: string; symbol?: string; search?: string; playbook_only?: boolean }) => {
    const sp = new URLSearchParams();
    if (params.date) sp.set('date', params.date);
    if (params.account && params.account !== 'ALL') sp.set('account', params.account);
    if (params.symbol && params.symbol !== 'ALL') sp.set('symbol', params.symbol);
    if (params.search) sp.set('search', params.search);
    if (params.playbook_only) sp.set('playbook_only', 'true');
    return req<{ trades: Trade[]; total: number }>(`/api/trades?${sp}`);
  },
  tradeDetail: (id: string) => req<Trade>(`/api/trades/${encodeURIComponent(id)}`),
  updateTrade: (id: string, body: Record<string, unknown>) =>
    req<Trade>(`/api/trades/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  uploadScreenshot: (tradeId: string, file: File, caption = '') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('caption', caption);
    return req<{ screenshot: unknown; screenshots: Trade['screenshots'] }>(
      `/api/trades/${encodeURIComponent(tradeId)}/screenshots`,
      { method: 'POST', body: fd },
    );
  },
  deleteScreenshot: (tradeId: string, shotId: string) =>
    req<{ screenshots: Trade['screenshots'] }>(
      `/api/trades/${encodeURIComponent(tradeId)}/screenshots/${encodeURIComponent(shotId)}`,
      { method: 'DELETE' },
    ),
  tradeCandles: (tradeId: string, timeframe = '5m') =>
    req<TradeCandlesResponse>(`/api/trades/${encodeURIComponent(tradeId)}/candles?timeframe=${encodeURIComponent(timeframe)}`),
  getDailyJournal: (dateStr: string) => req<DailyJournal>(`/api/daily-journal/${encodeURIComponent(dateStr)}`),
  saveDailyJournal: (dateStr: string, body: Omit<DailyJournal, 'date' | 'updated_at'>) =>
    req<DailyJournal>(`/api/daily-journal/${encodeURIComponent(dateStr)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  analytics: (params: { account?: string; symbol?: string; date_from?: string; date_to?: string }) => {
    const sp = new URLSearchParams();
    if (params.account && params.account !== 'ALL') sp.set('account', params.account);
    if (params.symbol && params.symbol !== 'ALL') sp.set('symbol', params.symbol);
    if (params.date_from) sp.set('date_from', params.date_from);
    if (params.date_to) sp.set('date_to', params.date_to);
    return req<AnalyticsResponse>(`/api/analytics?${sp}`);
  },
  lessons: (params: { search?: string; playbook_only?: boolean; tag?: string }) => {
    const sp = new URLSearchParams();
    if (params.search) sp.set('search', params.search);
    if (params.playbook_only) sp.set('playbook_only', 'true');
    if (params.tag) sp.set('tag', params.tag);
    return req<{ trade_lessons: Trade[]; daily_lessons: DailyJournal[] }>(`/api/lessons?${sp}`);
  },
  getSettings: () => req<Settings>('/api/settings'),
  saveSettings: (body: Partial<Settings>) =>
    req<Settings>('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
};

export function formatUSD(val: number, showPlus = true, decimals?: number): string {
  const abs = Math.abs(val);
  const dec = decimals !== undefined ? decimals : abs >= 100 ? 0 : 2;
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
  if (val > 0) return `${showPlus ? '+' : ''}$${formatted}`;
  if (val < 0) return `-$${formatted}`;
  return '$0';
}

export function formatUSDExact(val: number, showPlus = true): string {
  const abs = Math.abs(val);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (val > 0) return `${showPlus ? '+' : ''}$${formatted}`;
  if (val < 0) return `-$${formatted}`;
  return '$0.00';
}

export function formatPrice(price: number | null | undefined, symbol = ''): string {
  if (price === null || price === undefined) return '—';
  const sym = symbol.toUpperCase();
  let dec = 2;
  if (sym.includes('JPY')) dec = 3;
  else if (sym.includes('XAU') || sym.includes('GOLD') || sym.includes('US30') || sym.includes('NAS') || sym.includes('BTC')) dec = 2;
  else if (price < 20) dec = 5;
  return price.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function formatTimeVN(unixSec: number, includeDate = false): string {
  const d = new Date(unixSec * 1000);
  if (includeDate) {
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDuration(startSec: number, endSec: number): string {
  const diff = Math.max(0, endSec - startSec);
  const hrs = Math.floor(diff / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}
