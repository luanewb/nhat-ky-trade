import random
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from database import cache_candles, compute_r_metrics, get_conn, upsert_trade
from mt5_service import _generate_synthetic_candles, classify_session

# Realistic November 2026 schedule inspired by Image 1 & Image 2
DEMO_DAYS = [
    # (day_of_nov, [(symbol, dir, lot, entry_p, sl_dist, tp_dist, exit_r, mfe_r, mae_r, hour_utc, dur_min, pnl_override, notes)])
    (2, [
        ("XAUUSD", "LONG", 0.30, 3575.71, 21.14, 44.76, 1.55, 1.64, -0.02, 8, 95, 154.77, {
            "setup_note": "Giá quét thanh khoản đáy phiên Á rồi tạo cú đẩy mạnh phá cấu trúc M5 (BOS). Đợi giá hồi về vùng FVG + OB 3575.70 mới vào lệnh Long.",
            "execution_note": "Vào lệnh khớp đẹp, drawdown rất nhỏ (-0.02R). Giá chạy một mạch tới +1.64R, chủ động chốt ở +1.55R trước kháng cự khung H1.",
            "lesson_note": "Kiên nhẫn chờ nhịp hồi sau cú xung lực giúp SL cực ngắn và RR đẹp, không cần đuổi giá lúc nến đang phóng mạnh.",
            "action_note": "Luôn đánh dấu sẵn vùng OB/FVG và đặt Limit hoặc đợi nến rút chân M5 xác nhận.",
            "setup_tags": ["SMC / BOS", "Pullback"],
            "emotion_tags": ["Bình tĩnh & Kỷ luật"],
            "mistake_tags": [],
            "rating": 5,
            "is_playbook": True,
        }),
        ("XAUUSD", "SHORT", 0.25, 3622.40, 12.0, 24.0, 1.25, 1.42, -0.20, 13, 65, 148.50, {
            "setup_note": "Tạo 2 đỉnh phân kỳ ở vùng đỉnh ngày 3625 đầu phiên Mỹ.",
            "lesson_note": "Phiên giao thoa Âu–Mỹ thanh khoản rất đẹp cho lệnh đảo chiều tại đỉnh ngày.",
            "setup_tags": ["Liquidity Sweep", "Reversal"],
            "emotion_tags": ["Bình tĩnh & Kỷ luật"],
            "rating": 4,
        }),
        ("EURUSD", "LONG", 0.50, 1.08420, 0.0018, 0.0036, 1.15, 1.30, -0.35, 14, 80, 103.50, {}),
        ("XAUUSD", "LONG", 0.20, 3598.10, 10.5, 21.0, 0.90, 1.10, -0.15, 16, 45, 89.23, {}),
    ]),
    (3, [
        ("XAUUSD", "LONG", 0.30, 3588.50, 11.0, 25.0, 1.90, 2.15, -0.18, 7, 110, 295.00, {
            "setup_note": "Breakout hộp tích lũy phiên Á lúc mở cửa London.",
            "lesson_note": "Khi giá đi đúng hướng rõ ràng, giữ lệnh qua vùng rung lắc đầu tiên để đạt trọn 2R.",
            "action_note": "Dời SL về hòa vốn (BE) sau khi giá vượt +1R.",
            "setup_tags": ["Breakout", "Trend Continuation"],
            "emotion_tags": ["Tự tin"],
            "rating": 5,
            "is_playbook": True,
        }),
        ("XAUUSD", "LONG", 0.25, 3605.20, 9.0, 18.0, 1.40, 1.55, -0.10, 12, 70, 185.00, {}),
        ("NAS100", "LONG", 0.20, 21140.0, 45.0, 95.0, 1.60, 1.80, -0.25, 14, 55, 220.00, {}),
        ("EURUSD", "SHORT", 0.40, 1.08850, 0.0015, 0.0030, -1.00, 0.25, -1.00, 15, 35, -60.00, {
            "setup_note": "Bắt đỉnh ngược xu hướng chính H1.",
            "lesson_note": "Không bắt đỉnh khi khung H1 đang tăng mạnh và chưa có nến đóng xác nhận gãy cấu trúc.",
            "action_note": "Bắt buộc kiểm tra xu hướng H1/H4 trước khi nhấn nút.",
            "setup_tags": ["Reversal"],
            "emotion_tags": ["Thiếu kiên nhẫn"],
            "mistake_tags": ["Ngược xu hướng HTF", "Không đợi xác nhận"],
            "rating": 2,
        }),
        ("XAUUSD", "LONG", 0.30, 3618.00, 10.0, 20.0, 1.10, 1.35, -0.22, 16, 50, 140.00, {}),
        ("GBPUSD", "LONG", 0.30, 1.29400, 0.0020, 0.0040, 0.80, 1.05, -0.30, 17, 40, 80.00, {}),
    ]),
    (4, [
        ("XAUUSD", "LONG", 0.40, 3610.00, 12.0, 30.0, 2.20, 2.40, -0.12, 8, 125, 480.00, {
            "setup_note": "Setup A+: Quét đáy phiên Á + phá cấu trúc mạnh đầu phiên Âu.",
            "lesson_note": "Những ngày có xu hướng rõ rệt là lúc kiếm lợi nhuận chính của cả tháng.",
            "setup_tags": ["Liquidity Sweep", "SMC / BOS"],
            "emotion_tags": ["Bình tĩnh & Kỷ luật"],
            "rating": 5,
            "is_playbook": True,
        }),
        ("XAUUSD", "LONG", 0.35, 3632.50, 10.0, 22.0, 1.75, 1.90, -0.15, 12, 80, 350.00, {}),
        ("NAS100", "LONG", 0.25, 21220.0, 40.0, 85.0, 1.85, 2.05, -0.20, 14, 65, 329.00, {}),
        ("XAUUSD", "SHORT", 0.20, 3658.00, 10.0, 20.0, 1.45, 1.60, -0.18, 16, 55, 290.00, {}),
    ]),
    (5, [
        ("XAUUSD", "SHORT", 0.30, 3652.00, 11.0, 22.0, 1.60, 1.85, -0.14, 9, 75, 284.00, {}),
        ("EURUSD", "LONG", 0.50, 1.08610, 0.0016, 0.0032, 1.35, 1.50, -0.20, 13, 60, 165.00, {}),
        ("XAUUSD", "LONG", 0.25, 3628.40, 9.5, 19.0, 1.05, 1.30, -0.35, 15, 50, 125.00, {}),
    ]),
    (6, [
        ("XAUUSD", "LONG", 0.35, 3634.00, 11.5, 26.0, 1.85, 2.00, -0.09, 8, 90, 363.00, {}),
        ("NAS100", "SHORT", 0.20, 21380.0, 45.0, 90.0, 1.50, 1.75, -0.25, 14, 70, 210.00, {}),
        ("GBPUSD", "LONG", 0.35, 1.29650, 0.0018, 0.0036, 1.10, 1.25, -0.15, 16, 45, 120.00, {}),
    ]),
    (9, [
        ("XAUUSD", "LONG", 0.25, 3642.00, 10.0, 20.0, 1.20, 1.45, -0.28, 9, 85, 158.00, {}),
        ("EURUSD", "SHORT", 0.35, 1.09020, 0.0015, 0.0030, 0.80, 1.15, -0.20, 14, 55, 80.00, {}),
    ]),
    (10, [
        ("XAUUSD", "LONG", 0.35, 3648.50, 11.0, 24.0, 1.80, 1.95, -0.11, 8, 95, 344.00, {}),
        ("XAUUSD", "LONG", 0.30, 3668.00, 10.0, 20.0, 1.45, 1.65, -0.18, 13, 60, 260.00, {}),
        ("NAS100", "LONG", 0.20, 21410.0, 40.0, 80.0, 1.35, 1.55, -0.22, 15, 50, 220.00, {}),
    ]),
    (11, [
        ("XAUUSD", "SHORT", 0.35, 3692.00, 12.0, 28.0, 2.05, 2.30, -0.10, 8, 105, 421.00, {}),
        ("XAUUSD", "SHORT", 0.30, 3670.50, 10.0, 22.0, 1.65, 1.85, -0.20, 13, 75, 310.00, {}),
        ("EURUSD", "SHORT", 0.50, 1.08750, 0.0016, 0.0032, 1.60, 1.75, -0.15, 14, 65, 190.00, {}),
        ("GBPUSD", "SHORT", 0.35, 1.29200, 0.0018, 0.0036, 1.20, 1.40, -0.25, 16, 55, 150.00, {}),
    ]),
    # Red day on Nov 12 like Image 1 (-$645)
    (12, [
        ("XAUUSD", "LONG", 0.35, 3655.00, 11.0, 22.0, -1.00, 0.30, -1.00, 8, 35, -185.00, {
            "setup_note": "Vào Long sớm khi giá chưa đóng nến qua vùng cản chéo.",
            "execution_note": "Bị quét SL ngay khi tin CPI mở biên độ mạnh.",
            "lesson_note": "Tuyệt đối không vào lệnh trước tin đỏ lớn hoặc khi chưa có nến đóng xác nhận.",
            "action_note": "Kiểm tra lịch Forex Factory trước khi bắt đầu phiên giao dịch.",
            "setup_tags": ["Breakout"],
            "emotion_tags": ["FOMO"],
            "mistake_tags": ["Vào lệnh sớm", "Không đợi xác nhận"],
            "rating": 2,
        }),
        ("XAUUSD", "SHORT", 0.45, 3642.00, 12.0, 24.0, -1.00, 0.15, -1.00, 9, 25, -245.00, {
            "setup_note": "Vào lệnh trả thù ngay sau lệnh thua trước với khối lượng tăng lên 0.45 lot.",
            "execution_note": "Tâm lý cay cú, thấy nến giảm là bán đuổi ngay đáy.",
            "lesson_note": "Revenge trade + tăng lot sau khi thua là con đường nhanh nhất phá hủy lợi nhuận cả tuần.",
            "action_note": "Thua 2 lệnh liên tiếp => Đóng máy nghỉ hết phiên, không trade thêm!",
            "setup_tags": ["News Spike"],
            "emotion_tags": ["Cay cú (Revenge)", "FOMO"],
            "mistake_tags": ["Quá Volume", "Overtrading"],
            "rating": 1,
        }),
        ("NAS100", "LONG", 0.25, 21310.0, 45.0, 90.0, -1.00, 0.40, -1.00, 14, 30, -215.00, {
            "setup_note": "Cố gỡ lại khoản lỗ sáng nhưng thị trường đi choppy 2 đầu.",
            "lesson_note": "Chấp nhận ngày đỏ là một phần bình thường của trading, bảo vệ vốn quan trọng hơn cố gỡ.",
            "action_note": "Tuân thủ Daily Loss Limit -$500.",
            "emotion_tags": ["Cay cú (Revenge)", "Mệt mỏi"],
            "mistake_tags": ["Overtrading"],
            "rating": 1,
        }),
    ]),
    (13, [
        ("XAUUSD", "LONG", 0.30, 3618.00, 10.5, 24.0, 1.85, 2.05, -0.08, 8, 95, 314.00, {
            "setup_note": "Quay lại đúng quy trình chuẩn sau ngày thua hôm qua. Hạ volume về 0.30, đợi quét đáy phiên Á.",
            "lesson_note": "Giữ cái đầu lạnh và quay về đúng khối lượng chuẩn giúp phục hồi ngay lập tức.",
            "setup_tags": ["Liquidity Sweep", "Pullback"],
            "emotion_tags": ["Bình tĩnh & Kỷ luật"],
            "rating": 5,
            "is_playbook": True,
        }),
        ("XAUUSD", "LONG", 0.25, 3638.00, 9.5, 19.0, 1.50, 1.70, -0.15, 13, 70, 210.00, {}),
        ("EURUSD", "LONG", 0.40, 1.08540, 0.0015, 0.0030, 1.10, 1.30, -0.20, 15, 50, 120.00, {}),
    ]),
    (16, [
        ("XAUUSD", "LONG", 0.35, 3645.00, 11.0, 25.0, 1.75, 2.10, -0.14, 8, 100, 338.00, {
            "setup_note": "Pullback về EMA20 + vùng cầu H1.",
            "execution_note": "Giá lên tới +2.10R nhưng chốt hơi sớm ở +1.75R do thấy 1 nến đỏ M5.",
            "lesson_note": "Tin tưởng vào TP hoặc dời trailing stop theo đáy M5 thay vì chốt tay vì sợ mất lãi.",
            "action_note": "Chỉ chốt non khi có nến đóng phá vỡ cấu trúc M5 ngược chiều.",
            "setup_tags": ["Supply & Demand", "Pullback"],
            "emotion_tags": ["Sợ mất lãi"],
            "mistake_tags": ["Chốt lời non"],
            "rating": 4,
        }),
        ("NAS100", "LONG", 0.25, 21450.0, 40.0, 85.0, 1.60, 1.75, -0.18, 14, 65, 260.00, {}),
        ("GBPUSD", "LONG", 0.35, 1.29800, 0.0018, 0.0036, 1.30, 1.50, -0.22, 15, 55, 160.00, {}),
    ]),
    (17, [
        ("XAUUSD", "SHORT", 0.30, 3678.00, 11.0, 22.0, 1.35, 1.60, -0.25, 9, 80, 214.00, {}),
        ("EURUSD", "SHORT", 0.40, 1.09100, 0.0016, 0.0032, 1.25, 1.45, -0.15, 14, 60, 160.00, {}),
    ]),
    (18, [
        ("XAUUSD", "LONG", 0.35, 3654.00, 11.0, 24.0, 1.65, 1.90, -0.10, 8, 85, 329.00, {}),
        ("XAUUSD", "LONG", 0.30, 3672.00, 10.0, 20.0, 1.45, 1.65, -0.18, 13, 65, 280.00, {}),
    ]),
    (19, [
        ("XAUUSD", "LONG", 0.40, 3682.00, 12.0, 28.0, 1.95, 2.20, -0.08, 8, 110, 428.00, {}),
        ("NAS100", "LONG", 0.25, 21580.0, 42.0, 90.0, 1.75, 1.90, -0.20, 14, 70, 290.00, {}),
        ("XAUUSD", "SHORT", 0.25, 3712.00, 10.0, 20.0, 1.30, 1.55, -0.15, 16, 55, 210.00, {}),
    ]),
    (20, [
        ("XAUUSD", "LONG", 0.35, 3695.00, 11.5, 26.0, 1.80, 2.00, -0.05, 8, 95, 372.00, {}),
        ("EURUSD", "LONG", 0.50, 1.08900, 0.0016, 0.0032, 1.45, 1.65, -0.12, 13, 65, 200.00, {}),
        ("GBPUSD", "LONG", 0.35, 1.30100, 0.0018, 0.0036, 1.15, 1.35, -0.20, 15, 50, 150.00, {}),
    ]),
]


def load_demo_data() -> Dict[str, Any]:
    conn = get_conn()
    count = 0
    try:
        # Remove previous demo data first so it's idempotent
        conn.execute("DELETE FROM trades WHERE source = 'demo'")
        for day_num, items in DEMO_DAYS:
            for idx, item in enumerate(items):
                symbol, direction, vol, entry_p, sl_d, tp_d, exit_r, mfe_r, mae_r, hour_utc, dur_min, pnl, notes = item
                entry_dt = datetime(2026, 11, day_num, hour_utc, 10 + (idx * 7) % 40, 0, tzinfo=timezone.utc)
                exit_dt = entry_dt + timedelta(minutes=dur_min)
                entry_ts = int(entry_dt.timestamp())
                exit_ts = int(exit_dt.timestamp())

                if direction == "LONG":
                    sl_p = round(entry_p - sl_d, 5)
                    tp_p = round(entry_p + tp_d, 5)
                    exit_p = round(entry_p + exit_r * sl_d, 5)
                    mfe_p = round(entry_p + mfe_r * sl_d, 5)
                    mae_p = round(entry_p + mae_r * sl_d, 5)
                else:
                    sl_p = round(entry_p + sl_d, 5)
                    tp_p = round(entry_p - tp_d, 5)
                    exit_p = round(entry_p - exit_r * sl_d, 5)
                    mfe_p = round(entry_p - mfe_r * sl_d, 5)
                    mae_p = round(entry_p - mae_r * sl_d, 5)

                comm = round(-vol * 7.0, 2)
                gross = round(pnl - comm, 2)
                metrics = compute_r_metrics(direction, entry_p, exit_p, pnl, sl_p, mfe_p, mae_p)

                trade_obj: Dict[str, Any] = {
                    "id": f"demo_202611{day_num:02d}_{idx + 1}",
                    "position_id": 500000 + day_num * 100 + idx,
                    "account_login": "DEMO-MT5",
                    "account_name": "DEMO-MT5 (Dữ liệu mẫu)",
                    "symbol": symbol,
                    "direction": direction,
                    "volume": vol,
                    "entry_time": entry_ts,
                    "exit_time": exit_ts,
                    "close_date": f"2026-11-{day_num:02d}",
                    "entry_price": entry_p,
                    "exit_price": exit_p,
                    "sl_price": sl_p,
                    "tp_price": tp_p,
                    "gross_profit": gross,
                    "commission": comm,
                    "swap": 0.0,
                    "net_profit": pnl,
                    "r_multiple": metrics["r_multiple"],
                    "mfe_price": mfe_p,
                    "mae_price": mae_p,
                    "mfe_r": metrics["mfe_r"],
                    "mae_r": metrics["mae_r"],
                    "mfe_usd": metrics["mfe_usd"],
                    "mae_usd": metrics["mae_usd"],
                    "session": classify_session(entry_ts),
                    "source": "demo",
                    "setup_note": notes.get("setup_note", ""),
                    "execution_note": notes.get("execution_note", ""),
                    "lesson_note": notes.get("lesson_note", ""),
                    "action_note": notes.get("action_note", ""),
                    "setup_tags": notes.get("setup_tags", []),
                    "emotion_tags": notes.get("emotion_tags", []),
                    "mistake_tags": notes.get("mistake_tags", []),
                    "rating": notes.get("rating", 0),
                    "is_playbook": notes.get("is_playbook", False),
                }
                upsert_trade(conn, trade_obj)
                # Pre-cache 5m candles for demo trades
                candles = _generate_synthetic_candles(trade_obj, "5m")
                cache_candles(conn, symbol, "5m", candles)
                count += 1

        # Add a couple of sample daily journals
        now = int(time.time())
        conn.execute(
            """
            INSERT OR REPLACE INTO daily_journals (date, mood, summary, lessons, plan_tomorrow, rating, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "2026-11-12",
                "Cay cú / Mất bình tĩnh",
                "Ngày giao dịch kém kỷ luật. Bị dính SL lệnh đầu lúc tin ra rồi nóng vội tăng lot để gỡ.",
                "Mất -$645 chủ yếu do Revenge Trade. Nếu dừng sau lệnh thua thứ 2 đã bảo vệ được hơn $200.",
                "Ngày mai hạ lot về mức chuẩn, chỉ đánh setup quen thuộc đầu phiên Âu, không đụng vào lệnh lúc tin đỏ.",
                2,
                now,
            ),
        )
        conn.execute(
            """
            INSERT OR REPLACE INTO daily_journals (date, mood, summary, lessons, plan_tomorrow, rating, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "2026-11-02",
                "Tập trung & Bình tĩnh",
                "Khởi đầu tuần mới suôn sẻ với 4 lệnh thắng liên tiếp, lệnh XAUUSD đầu phiên Âu khớp chuẩn sách giáo khoa.",
                "Đợi pullback sau BOS giúp tối ưu điểm vào và giữ tâm lý thoải mái suốt lệnh.",
                "Duy trì kỷ luật tương tự, không chủ quan sau chuỗi thắng.",
                5,
                now,
            ),
        )
        conn.commit()
    finally:
        conn.close()

    return {"success": True, "loaded": count, "message": f"Đã nạp {count} lệnh mẫu tháng 11/2026 để trải nghiệm."}


def clear_demo_data() -> Dict[str, Any]:
    conn = get_conn()
    try:
        cur = conn.execute("DELETE FROM trades WHERE source = 'demo'")
        deleted = cur.rowcount
        conn.commit()
    finally:
        conn.close()
    return {"success": True, "deleted": deleted, "message": f"Đã xóa {deleted} lệnh dữ liệu mẫu."}
