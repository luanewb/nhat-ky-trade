export interface Screenshot {
  id: string;
  url: string;
  caption: string;
  created_at: number;
}

export interface ChecklistItem {
  label: string;
  checked: boolean;
}

export interface Trade {
  id: string;
  position_id: number;
  account_login: string;
  account_name: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  volume: number;
  entry_time: number;
  exit_time: number;
  close_date: string;
  entry_price: number;
  exit_price: number;
  sl_price: number | null;
  tp_price: number | null;
  custom_sl: number | null;
  custom_tp: number | null;
  effective_sl: number | null;
  effective_tp: number | null;
  gross_profit: number;
  commission: number;
  swap: number;
  net_profit: number;
  r_multiple: number | null;
  mfe_price: number | null;
  mae_price: number | null;
  mfe_r: number | null;
  mae_r: number | null;
  mfe_usd: number | null;
  mae_usd: number | null;
  session: string;
  magic: number;
  mt5_comment: string;
  source: string;
  setup_note: string;
  execution_note: string;
  lesson_note: string;
  action_note: string;
  setup_tags: string[];
  emotion_tags: string[];
  mistake_tags: string[];
  rating: number;
  checklist: ChecklistItem[];
  is_playbook: boolean;
  screenshots: Screenshot[];
  has_journal: boolean;
  updated_at: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradeCandlesResponse {
  symbol: string;
  timeframe: string;
  source: string;
  is_synthetic: boolean;
  candles: Candle[];
}

export interface CalendarDay {
  date: string;
  net_profit: number;
  trade_count: number;
  wins: number;
  losses: number;
  r_total: number | null;
  noted_count: number;
  has_daily_journal: boolean;
  violations: string[];
}

export interface CalendarWeek {
  week: number;
  net_profit: number;
  trade_count: number;
  trading_days: number;
}

export interface CalendarResponse {
  year: number;
  month: number;
  monthly_pnl: number;
  total_trades: number;
  wins: number;
  losses: number;
  winrate: number;
  trading_days: number;
  last_trade_date: string | null;
  days: Record<string, CalendarDay>;
  weeks: CalendarWeek[];
}

export interface DailyJournal {
  date: string;
  mood: string;
  summary: string;
  lessons: string;
  plan_tomorrow: string;
  rating: number;
  updated_at?: number;
}

export interface MT5Status {
  installed: boolean;
  connected: boolean;
  account_login?: string;
  account_name?: string;
  server?: string;
  company?: string;
  balance?: number;
  equity?: number;
  currency?: string;
  leverage?: number;
  message: string;
}

export interface FilterOptions {
  accounts: { login: string; name: string }[];
  symbols: string[];
  sources: string[];
}

export interface AnalyticsGroupItem {
  name: string;
  trades: number;
  wins: number;
  winrate: number;
  net_profit: number;
  avg_profit: number;
}

export interface AnalyticsResponse {
  kpis: {
    total_trades: number;
    wins?: number;
    losses?: number;
    net_profit: number;
    winrate: number;
    profit_factor: number;
    expectancy_usd: number;
    expectancy_r: number | null;
    avg_win: number;
    avg_loss: number;
    best_trade: number;
    worst_trade: number;
    max_drawdown: number;
    max_win_streak: number;
    max_loss_streak: number;
    avg_mfe_r: number | null;
    avg_mae_r: number | null;
    avg_rating: number;
    journaled_pct: number;
  };
  equity_curve: { date: string; equity: number }[];
  by_session: AnalyticsGroupItem[];
  by_weekday: AnalyticsGroupItem[];
  by_symbol: AnalyticsGroupItem[];
  by_setup: AnalyticsGroupItem[];
  by_mistake: AnalyticsGroupItem[];
  by_emotion: AnalyticsGroupItem[];
  rule_violations: { date: string; type: string; message: string }[];
}

export interface Settings {
  daily_loss_limit: number;
  max_trades_per_day: number;
  max_risk_per_trade: number;
  timezone_offset_hours: number;
  show_weekly_column: boolean;
  setup_tags: string[];
  emotion_tags: string[];
  mistake_tags: string[];
  default_checklist: string[];
}

export type ActiveTab = 'calendar' | 'analytics' | 'lessons';
