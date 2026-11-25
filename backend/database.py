import json
import os
import sqlite3
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(__file__).resolve().parent / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "journal.db"

DEFAULT_SETTINGS: Dict[str, Any] = {
    "daily_loss_limit": 500.0,
    "max_trades_per_day": 8,
    "max_risk_per_trade": 250.0,
    "account_balance": 10000.0,
    "timezone_offset_hours": 7,
    "show_weekly_column": False,
    "setup_tags": [
        "Breakout",
        "Pullback",
        "Liquidity Sweep",
        "SMC / BOS",
        "Supply & Demand",
        "Trend Continuation",
        "Reversal",
        "News Spike",
    ],
    "emotion_tags": [
        "Bình tĩnh & Kỷ luật",
        "Tự tin",
        "FOMO",
        "Sợ mất lãi",
        "Cay cú (Revenge)",
        "Mệt mỏi",
        "Thiếu kiên nhẫn",
    ],
    "mistake_tags": [
        "Vào lệnh sớm",
        "Dời SL xa hơn",
        "Chốt lời non",
        "Quá Volume",
        "Ngược xu hướng HTF",
        "Không đợi xác nhận",
        "Trade ngoài giờ vàng",
        "Overtrading",
    ],
    "default_checklist": [
        "Đúng xu hướng khung lớn (HTF)",
        "Có vùng cản / thanh khoản rõ ràng",
        "Đã xác định sẵn SL & TP hợp lý (R:R >= 1:1.5)",
        "Khối lượng đúng quy tắc quản lý vốn",
        "Không có tin đỏ mạnh sắp ra trong 15 phút",
        "Tâm lý bình tĩnh, không FOMO",
    ],
}


def ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def get_conn() -> sqlite3.Connection:
    ensure_dirs()
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db() -> None:
    conn = get_conn()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS trades (
                id TEXT PRIMARY KEY,
                position_id INTEGER DEFAULT 0,
                account_login TEXT DEFAULT '',
                account_name TEXT DEFAULT '',
                symbol TEXT NOT NULL,
                direction TEXT NOT NULL,
                volume REAL NOT NULL,
                entry_time INTEGER NOT NULL,
                exit_time INTEGER NOT NULL,
                close_date TEXT NOT NULL,
                entry_price REAL NOT NULL,
                exit_price REAL NOT NULL,
                sl_price REAL,
                tp_price REAL,
                custom_sl REAL,
                custom_tp REAL,
                gross_profit REAL NOT NULL,
                commission REAL DEFAULT 0,
                swap REAL DEFAULT 0,
                net_profit REAL NOT NULL,
                r_multiple REAL,
                mfe_price REAL,
                mae_price REAL,
                mfe_r REAL,
                mae_r REAL,
                mfe_usd REAL,
                mae_usd REAL,
                session TEXT DEFAULT 'Other',
                magic INTEGER DEFAULT 0,
                mt5_comment TEXT DEFAULT '',
                source TEXT DEFAULT 'mt5',
                setup_note TEXT DEFAULT '',
                execution_note TEXT DEFAULT '',
                lesson_note TEXT DEFAULT '',
                action_note TEXT DEFAULT '',
                setup_tags TEXT DEFAULT '[]',
                emotion_tags TEXT DEFAULT '[]',
                mistake_tags TEXT DEFAULT '[]',
                rating INTEGER DEFAULT 0,
                checklist TEXT DEFAULT '[]',
                is_playbook INTEGER DEFAULT 0,
                screenshots TEXT DEFAULT '[]',
                updated_at INTEGER DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_trades_close_date ON trades(close_date);
            CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
            CREATE INDEX IF NOT EXISTS idx_trades_account ON trades(account_login);
            CREATE INDEX IF NOT EXISTS idx_trades_entry_time ON trades(entry_time);

            CREATE TABLE IF NOT EXISTS candle_cache (
                symbol TEXT NOT NULL,
                timeframe TEXT NOT NULL,
                time INTEGER NOT NULL,
                open REAL NOT NULL,
                high REAL NOT NULL,
                low REAL NOT NULL,
                close REAL NOT NULL,
                volume REAL DEFAULT 0,
                PRIMARY KEY (symbol, timeframe, time)
            );

            CREATE INDEX IF NOT EXISTS idx_candle_lookup ON candle_cache(symbol, timeframe, time);

            CREATE TABLE IF NOT EXISTS daily_journals (
                date TEXT PRIMARY KEY,
                mood TEXT DEFAULT '',
                summary TEXT DEFAULT '',
                lessons TEXT DEFAULT '',
                plan_tomorrow TEXT DEFAULT '',
                rating INTEGER DEFAULT 0,
                updated_at INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            """
        )

        # Ensure default settings exist
        for k, v in DEFAULT_SETTINGS.items():
            conn.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                (k, json.dumps(v, ensure_ascii=False)),
            )
        conn.commit()
    finally:
        conn.close()


def get_version() -> str:
    version_file = ROOT_DIR / "version.json"
    if version_file.exists():
        try:
            data = json.loads(version_file.read_text(encoding="utf-8"))
            return str(data.get("version", "1.0.0"))
        except Exception:
            pass
    return "1.0.0"


def get_all_settings() -> Dict[str, Any]:
    conn = get_conn()
    try:
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
        result = dict(DEFAULT_SETTINGS)
        for row in rows:
            try:
                result[row["key"]] = json.loads(row["value"])
            except Exception:
                result[row["key"]] = row["value"]
        return result
    finally:
        conn.close()


def save_settings(updates: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_conn()
    try:
        for k, v in updates.items():
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (k, json.dumps(v, ensure_ascii=False)),
            )
        conn.commit()
    finally:
        conn.close()
    return get_all_settings()


def compute_r_metrics(
    direction: str,
    entry_price: float,
    exit_price: float,
    net_profit: float,
    sl_price: Optional[float],
    mfe_price: Optional[float],
    mae_price: Optional[float],
) -> Dict[str, Optional[float]]:
    """Compute R-multiple, MFE R/USD, MAE R/USD given effective SL and extreme prices."""
    r_multiple: Optional[float] = None
    mfe_r: Optional[float] = None
    mae_r: Optional[float] = None
    mfe_usd: Optional[float] = None
    mae_usd: Optional[float] = None

    price_diff = (exit_price - entry_price) if direction == "LONG" else (entry_price - exit_price)
    usd_per_point: Optional[float] = None
    if abs(price_diff) > 1e-9:
        usd_per_point = abs(net_profit) / abs(price_diff)

    risk_dist: Optional[float] = None
    if sl_price is not None and sl_price > 0:
        d = (entry_price - sl_price) if direction == "LONG" else (sl_price - entry_price)
        if d > 1e-9:
            risk_dist = d

    if risk_dist is not None:
        r_multiple = round(price_diff / risk_dist, 2)

    if mfe_price is not None:
        fav_dist = (mfe_price - entry_price) if direction == "LONG" else (entry_price - mfe_price)
        fav_dist = max(0.0, fav_dist)
        if risk_dist is not None:
            mfe_r = round(fav_dist / risk_dist, 2)
        if usd_per_point is not None:
            mfe_usd = round(fav_dist * usd_per_point, 2)

    if mae_price is not None:
        adv_dist = (entry_price - mae_price) if direction == "LONG" else (mae_price - entry_price)
        adv_dist = max(0.0, adv_dist)
        if risk_dist is not None:
            mae_r = round(-adv_dist / risk_dist, 2)
        if usd_per_point is not None:
            mae_usd = round(-adv_dist * usd_per_point, 2)

    return {
        "r_multiple": r_multiple,
        "mfe_r": mfe_r,
        "mae_r": mae_r,
        "mfe_usd": mfe_usd,
        "mae_usd": mae_usd,
    }


def serialize_trade(row: sqlite3.Row) -> Dict[str, Any]:
    d = dict(row)
    for field in ("setup_tags", "emotion_tags", "mistake_tags", "checklist", "screenshots"):
        try:
            d[field] = json.loads(d[field]) if d[field] else []
        except Exception:
            d[field] = []
    d["is_playbook"] = bool(d.get("is_playbook", 0))
    d["effective_sl"] = d["custom_sl"] if d.get("custom_sl") is not None else d.get("sl_price")
    d["effective_tp"] = d["custom_tp"] if d.get("custom_tp") is not None else d.get("tp_price")
    d["has_journal"] = bool(
        (d.get("setup_note") or "").strip()
        or (d.get("execution_note") or "").strip()
        or (d.get("lesson_note") or "").strip()
        or (d.get("action_note") or "").strip()
        or d["setup_tags"]
        or d["emotion_tags"]
        or d["mistake_tags"]
        or d["screenshots"]
    )
    return d


def upsert_trade(conn: sqlite3.Connection, trade: Dict[str, Any]) -> None:
    """Insert or update execution fields while preserving user journal entries."""
    now = int(time.time())
    conn.execute(
        """
        INSERT INTO trades (
            id, position_id, account_login, account_name, symbol, direction, volume,
            entry_time, exit_time, close_date, entry_price, exit_price,
            sl_price, tp_price, custom_sl, custom_tp,
            gross_profit, commission, swap, net_profit,
            r_multiple, mfe_price, mae_price, mfe_r, mae_r, mfe_usd, mae_usd,
            session, magic, mt5_comment, source,
            setup_note, execution_note, lesson_note, action_note,
            setup_tags, emotion_tags, mistake_tags, rating, checklist, is_playbook, screenshots,
            updated_at
        ) VALUES (
            :id, :position_id, :account_login, :account_name, :symbol, :direction, :volume,
            :entry_time, :exit_time, :close_date, :entry_price, :exit_price,
            :sl_price, :tp_price, :custom_sl, :custom_tp,
            :gross_profit, :commission, :swap, :net_profit,
            :r_multiple, :mfe_price, :mae_price, :mfe_r, :mae_r, :mfe_usd, :mae_usd,
            :session, :magic, :mt5_comment, :source,
            :setup_note, :execution_note, :lesson_note, :action_note,
            :setup_tags, :emotion_tags, :mistake_tags, :rating, :checklist, :is_playbook, :screenshots,
            :updated_at
        )
        ON CONFLICT(id) DO UPDATE SET
            account_login = excluded.account_login,
            account_name = excluded.account_name,
            symbol = excluded.symbol,
            direction = excluded.direction,
            volume = excluded.volume,
            entry_time = excluded.entry_time,
            exit_time = excluded.exit_time,
            close_date = excluded.close_date,
            entry_price = excluded.entry_price,
            exit_price = excluded.exit_price,
            sl_price = COALESCE(excluded.sl_price, trades.sl_price),
            tp_price = COALESCE(excluded.tp_price, trades.tp_price),
            gross_profit = excluded.gross_profit,
            commission = excluded.commission,
            swap = excluded.swap,
            net_profit = excluded.net_profit,
            mfe_price = COALESCE(excluded.mfe_price, trades.mfe_price),
            mae_price = COALESCE(excluded.mae_price, trades.mae_price),
            r_multiple = COALESCE(excluded.r_multiple, trades.r_multiple),
            mfe_r = COALESCE(excluded.mfe_r, trades.mfe_r),
            mae_r = COALESCE(excluded.mae_r, trades.mae_r),
            mfe_usd = COALESCE(excluded.mfe_usd, trades.mfe_usd),
            mae_usd = COALESCE(excluded.mae_usd, trades.mae_usd),
            session = excluded.session,
            magic = excluded.magic,
            mt5_comment = excluded.mt5_comment,
            updated_at = excluded.updated_at
        """,
        {
            "id": trade["id"],
            "position_id": trade.get("position_id", 0),
            "account_login": str(trade.get("account_login", "")),
            "account_name": str(trade.get("account_name", "")),
            "symbol": trade["symbol"],
            "direction": trade["direction"],
            "volume": float(trade["volume"]),
            "entry_time": int(trade["entry_time"]),
            "exit_time": int(trade["exit_time"]),
            "close_date": trade["close_date"],
            "entry_price": float(trade["entry_price"]),
            "exit_price": float(trade["exit_price"]),
            "sl_price": trade.get("sl_price"),
            "tp_price": trade.get("tp_price"),
            "custom_sl": trade.get("custom_sl"),
            "custom_tp": trade.get("custom_tp"),
            "gross_profit": float(trade["gross_profit"]),
            "commission": float(trade.get("commission", 0.0)),
            "swap": float(trade.get("swap", 0.0)),
            "net_profit": float(trade["net_profit"]),
            "r_multiple": trade.get("r_multiple"),
            "mfe_price": trade.get("mfe_price"),
            "mae_price": trade.get("mae_price"),
            "mfe_r": trade.get("mfe_r"),
            "mae_r": trade.get("mae_r"),
            "mfe_usd": trade.get("mfe_usd"),
            "mae_usd": trade.get("mae_usd"),
            "session": trade.get("session", "Other"),
            "magic": int(trade.get("magic", 0)),
            "mt5_comment": str(trade.get("mt5_comment", "")),
            "source": trade.get("source", "mt5"),
            "setup_note": trade.get("setup_note", ""),
            "execution_note": trade.get("execution_note", ""),
            "lesson_note": trade.get("lesson_note", ""),
            "action_note": trade.get("action_note", ""),
            "setup_tags": json.dumps(trade.get("setup_tags", []), ensure_ascii=False),
            "emotion_tags": json.dumps(trade.get("emotion_tags", []), ensure_ascii=False),
            "mistake_tags": json.dumps(trade.get("mistake_tags", []), ensure_ascii=False),
            "rating": int(trade.get("rating", 0)),
            "checklist": json.dumps(trade.get("checklist", []), ensure_ascii=False),
            "is_playbook": 1 if trade.get("is_playbook") else 0,
            "screenshots": json.dumps(trade.get("screenshots", []), ensure_ascii=False),
            "updated_at": now,
        },
    )


def cache_candles(conn: sqlite3.Connection, symbol: str, timeframe: str, candles: List[Dict[str, Any]]) -> None:
    if not candles:
        return
    conn.executemany(
        """
        INSERT OR REPLACE INTO candle_cache (symbol, timeframe, time, open, high, low, close, volume)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                symbol,
                timeframe,
                int(c["time"]),
                float(c["open"]),
                float(c["high"]),
                float(c["low"]),
                float(c["close"]),
                float(c.get("volume", 0)),
            )
            for c in candles
        ],
    )
