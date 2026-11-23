import csv
import hashlib
import io
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from typing import Any, Dict, List, Optional

from database import compute_r_metrics, get_all_settings, get_conn, upsert_trade
from mt5_service import classify_session, ts_to_close_date

try:
    import openpyxl  # type: ignore
except ImportError:
    openpyxl = None  # type: ignore


def _parse_float(val: Any) -> float:
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip().replace(" ", "").replace("\xa0", "").replace(",", "")
    if not s or s == "-":
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def _parse_dt(val: Any) -> Optional[int]:
    if val is None:
        return None
    if isinstance(val, datetime):
        if val.tzinfo is None:
            val = val.replace(tzinfo=timezone.utc)
        return int(val.timestamp())
    s = str(val).strip()
    if not s:
        return None
    formats = [
        "%Y.%m.%d %H:%M:%S",
        "%Y.%m.%d %H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%d.%m.%Y %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M:%S",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(s, fmt).replace(tzinfo=timezone.utc)
            return int(dt.timestamp())
        except ValueError:
            continue
    return None


class _HTMLTableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.rows: List[List[str]] = []
        self._in_tr = False
        self._in_cell = False
        self._cur_row: List[str] = []
        self._cur_cell: List[str] = []

    def handle_starttag(self, tag: str, attrs: Any) -> None:
        t = tag.lower()
        if t == "tr":
            self._in_tr = True
            self._cur_row = []
        elif t in ("td", "th") and self._in_tr:
            self._in_cell = True
            self._cur_cell = []

    def handle_endtag(self, tag: str) -> None:
        t = tag.lower()
        if t in ("td", "th") and self._in_cell:
            self._in_cell = False
            self._cur_row.append("".join(self._cur_cell).strip())
        elif t == "tr" and self._in_tr:
            self._in_tr = False
            if any(c for c in self._cur_row):
                self.rows.append(self._cur_row)

    def handle_data(self, data: str) -> None:
        if self._in_cell:
            self._cur_cell.append(data)


def _extract_positions_from_rows(rows: List[List[Any]], account_label: str) -> List[Dict[str, Any]]:
    """
    Parse MT5 'Positions' section from standard MT5 Excel/HTML/CSV export.
    Standard MT5 Positions columns (13 cols):
    Time | Position | Symbol | Type | Volume | Price | S / L | T / P | Time | Price | Commission | Swap | Profit
    Also supports simple CSV with header: symbol, direction/type, volume, entry_time, exit_time, entry_price, exit_price, sl, tp, profit
    """
    settings = get_all_settings()
    tz_offset = int(settings.get("timezone_offset_hours", 7))
    trades: List[Dict[str, Any]] = []

    # Mode 1: Find MT5 Positions table header
    in_positions = False
    mt5_header_idx: Optional[int] = None
    for idx, row in enumerate(rows):
        cells = [str(c).strip() if c is not None else "" for c in row]
        joined = " ".join(cells).lower()
        if cells and cells[0].lower() in ("positions", "vị thế"):
            in_positions = True
            continue
        if in_positions and ("position" in joined or "ticket" in joined) and "symbol" in joined and "profit" in joined:
            mt5_header_idx = idx
            break
        if not in_positions and len(cells) >= 12 and "position" in joined and "symbol" in joined and "s / l" in joined:
            mt5_header_idx = idx
            break

    if mt5_header_idx is not None:
        for row in rows[mt5_header_idx + 1 :]:
            cells = [c if c is not None else "" for c in row]
            first = str(cells[0]).strip().lower() if cells else ""
            if first in ("orders", "deals", "lệnh", "giao dịch", "results", "balance", "total"):
                break
            if len(cells) < 12:
                continue
            entry_ts = _parse_dt(cells[0])
            if entry_ts is None:
                continue
            pid_str = str(cells[1]).strip()
            symbol = str(cells[2]).strip()
            raw_type = str(cells[3]).strip().lower()
            if raw_type not in ("buy", "sell", "long", "short"):
                continue
            direction = "LONG" if raw_type in ("buy", "long") else "SHORT"
            volume = _parse_float(cells[4])
            entry_price = _parse_float(cells[5])
            if volume <= 0 or entry_price <= 0:
                continue
            row_text_lower = " ".join(str(c).lower() for c in cells)
            if any(w in row_text_lower for w in ("canceled", "cancelled", "rejected", "expired")):
                continue
            sl_val = _parse_float(cells[6])
            tp_val = _parse_float(cells[7])
            exit_ts = _parse_dt(cells[8]) or entry_ts
            exit_price = _parse_float(cells[9])
            commission = _parse_float(cells[10])
            swap = _parse_float(cells[11])
            gross_profit = _parse_float(cells[12]) if len(cells) > 12 else 0.0
            net_profit = round(gross_profit + commission + swap, 2)

            sl_price = sl_val if sl_val > 0 else None
            tp_price = tp_val if tp_val > 0 else None
            metrics = compute_r_metrics(direction, entry_price, exit_price, net_profit, sl_price, None, None)

            uid = hashlib.md5(f"{account_label}_{pid_str}_{entry_ts}_{symbol}".encode()).hexdigest()[:12]
            trades.append(
                {
                    "id": f"imp_{uid}",
                    "position_id": int(re.sub(r"\D", "", pid_str) or 0),
                    "account_login": account_label,
                    "account_name": account_label,
                    "symbol": symbol,
                    "direction": direction,
                    "volume": volume,
                    "entry_time": entry_ts,
                    "exit_time": exit_ts,
                    "close_date": ts_to_close_date(exit_ts, tz_offset),
                    "entry_price": entry_price,
                    "exit_price": exit_price,
                    "sl_price": sl_price,
                    "tp_price": tp_price,
                    "gross_profit": round(gross_profit, 2),
                    "commission": round(commission, 2),
                    "swap": round(swap, 2),
                    "net_profit": net_profit,
                    "r_multiple": metrics["r_multiple"],
                    "session": classify_session(entry_ts),
                    "source": "import",
                }
            )
        return trades

    # Mode 2: Generic CSV header matching
    if rows:
        headers = [str(c).strip().lower() for c in rows[0]]
        col_map = {h: i for i, h in enumerate(headers)}

        def get_col(r: List[Any], *names: str) -> Any:
            for n in names:
                if n in col_map and col_map[n] < len(r):
                    return r[col_map[n]]
            return None

        if any(k in col_map for k in ("symbol", "pair", "instrument")):
            for i, row in enumerate(rows[1:]):
                symbol = str(get_col(row, "symbol", "pair", "instrument") or "").strip()
                if not symbol:
                    continue
                raw_type = str(get_col(row, "type", "direction", "side") or "buy").strip().lower()
                direction = "SHORT" if raw_type in ("sell", "short") else "LONG"
                entry_ts = _parse_dt(get_col(row, "entry_time", "open time", "open_time", "time"))
                exit_ts = _parse_dt(get_col(row, "exit_time", "close time", "close_time")) or entry_ts
                if entry_ts is None:
                    continue
                volume = _parse_float(get_col(row, "volume", "lots", "size", "qty")) or 0.1
                entry_price = _parse_float(get_col(row, "entry_price", "open price", "open_price", "price"))
                exit_price = _parse_float(get_col(row, "exit_price", "close price", "close_price")) or entry_price
                sl_val = _parse_float(get_col(row, "sl", "sl_price", "s/l", "s / l", "stop_loss"))
                tp_val = _parse_float(get_col(row, "tp", "tp_price", "t/p", "t / p", "take_profit"))
                commission = _parse_float(get_col(row, "commission", "comm"))
                swap = _parse_float(get_col(row, "swap"))
                gross_profit = _parse_float(get_col(row, "profit", "gross_profit", "pnl", "net_profit"))
                net_profit = round(gross_profit + commission + swap, 2)
                sl_price = sl_val if sl_val > 0 else None
                tp_price = tp_val if tp_val > 0 else None
                metrics = compute_r_metrics(direction, entry_price, exit_price, net_profit, sl_price, None, None)

                uid = hashlib.md5(f"{account_label}_{i}_{entry_ts}_{symbol}_{net_profit}".encode()).hexdigest()[:12]
                trades.append(
                    {
                        "id": f"imp_{uid}",
                        "position_id": i + 1,
                        "account_login": account_label,
                        "account_name": account_label,
                        "symbol": symbol,
                        "direction": direction,
                        "volume": volume,
                        "entry_time": entry_ts,
                        "exit_time": exit_ts or entry_ts,
                        "close_date": ts_to_close_date(exit_ts or entry_ts, tz_offset),
                        "entry_price": entry_price,
                        "exit_price": exit_price,
                        "sl_price": sl_price,
                        "tp_price": tp_price,
                        "gross_profit": round(gross_profit, 2),
                        "commission": round(commission, 2),
                        "swap": round(swap, 2),
                        "net_profit": net_profit,
                        "r_multiple": metrics["r_multiple"],
                        "session": classify_session(entry_ts),
                        "source": "import",
                    }
                )
    return trades


def import_mt5_file(filename: str, content: bytes, account_label: str = "Imported") -> Dict[str, Any]:
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    rows: List[List[Any]] = []

    if ext in ("xlsx", "xlsm"):
        if openpyxl is None:
            return {"success": False, "message": "Chưa cài đặt openpyxl để đọc file Excel.", "imported": 0}
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
        ws = wb.active
        for row in ws.iter_rows(values_only=True):
            rows.append(list(row))
    elif ext in ("html", "htm"):
        # MT5 HTML reports are often UTF-16 LE or UTF-8
        text = ""
        for enc in ("utf-16", "utf-8-sig", "utf-8", "cp1252", "latin-1"):
            try:
                text = content.decode(enc)
                if "<tr" in text.lower() or "<table" in text.lower():
                    break
            except Exception:
                continue
        parser = _HTMLTableParser()
        parser.feed(text)
        rows = parser.rows
    elif ext in ("csv", "tsv", "txt"):
        text = ""
        for enc in ("utf-8-sig", "utf-16", "utf-8", "cp1252"):
            try:
                text = content.decode(enc)
                break
            except Exception:
                continue
        delimiter = "\t" if "\t" in text.splitlines()[0] else (";" if ";" in text.splitlines()[0] else ",")
        reader = csv.reader(io.StringIO(text), delimiter=delimiter)
        rows = list(reader)
    else:
        return {"success": False, "message": f"Định dạng .{ext} chưa được hỗ trợ. Hãy dùng .xlsx, .html hoặc .csv.", "imported": 0}

    trades = _extract_positions_from_rows(rows, account_label or filename)
    if not trades:
        return {
            "success": False,
            "message": "Không tìm thấy dữ liệu lệnh hợp lệ trong file. Hãy xuất báo cáo MT5 (Report -> Open XML/Excel hoặc HTML) hoặc CSV đúng chuẩn.",
            "imported": 0,
        }

    conn = get_conn()
    try:
        for t in trades:
            upsert_trade(conn, t)
        conn.commit()
    finally:
        conn.close()

    return {
        "success": True,
        "imported": len(trades),
        "message": f"Đã import thành công {len(trades)} lệnh từ {filename}.",
    }
