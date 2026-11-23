# Nhật Ký Giao Dịch MT5 (MT5 Trade Journal & Chart Replay)

Ứng dụng Nhật ký giao dịch dành cho trader sử dụng **MetaTrader 5**, hiển thị lịch lãi/lỗ trực quan (P&L Calendar), biểu đồ xem lại lệnh tích hợp hộp **Long/Short Position Tool + MFE/MAE + Bar Replay**, hệ thống ghi chú bài học có cấu trúc và Dashboard phân tích hiệu suất.

## Tính năng chính (v1.0.0)
- **Kết nối trực tiếp MetaTrader 5**: Đồng bộ lệnh đóng (Deals/Orders), tự động tải & cache dữ liệu nến OHLCV theo sàn, tính toán **R-Multiple, MFE (Max Run) & MAE (Drawdown)**.
- **Import báo cáo MT5 dự phòng**: Hỗ trợ nhập file báo cáo MT5 định dạng `.xlsx`, `.html`, `.csv`.
- **Lịch P&L Calendar**: Hiển thị lãi/lỗ từng ngày (xanh/đỏ), số lệnh, tổng tháng, cột tổng kết tuần, cảnh báo vi phạm kỷ luật và nhật ký tổng kết ngày.
- **Biểu đồ xem lại lệnh (TradingView Chart Replay)**:
  - Đổi khung thời gian (`1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1D`) + Volume.
  - Vẽ **Long/Short Position Box** (vùng TP xanh / vùng SL đỏ), đường Entry/SL/TP/Exit, Key Levels (Prev High/Low) và **Badge thông số nổi** (`[LONG/SHORT] | +R ($P&L) | Max Run | DD`).
  - Chế độ **Bar Replay** tua lại từng cây nến (1x / 2x / 5x).
- **Chú thích, Bài học & Lưu ý**: Ghi chú có cấu trúc (*Bài học rút ra*, *Lưu ý lần sau*, *Lý do vào lệnh*, *Diễn biến*), gắn tag (*Setup*, *Tâm lý*, *Lỗi sai*), chấm điểm kỷ luật 1–5 sao, Checklist, đánh dấu **A+ Playbook** và dán ảnh chụp màn hình bằng `Ctrl+V`.
- **Phân tích hiệu suất (Analytics) & Rule Guardian**: Equity Curve, Winrate, Profit Factor, Expectancy, thống kê theo Phiên (Á/Âu/Mỹ), Thứ trong tuần, Symbol, Setup & Chi phí lỗi sai (*Cost of Mistakes*).

## Hướng dẫn chạy nhanh
1. Cài đặt thư viện (nếu chạy trên máy mới):
   ```powershell
   pip install -r backend/requirements.txt
   cd frontend && npm install && npm run build
   ```
2. Khởi chạy ứng dụng bằng 1 click: chạy file `start.bat` (hoặc `python -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000`) rồi mở `http://127.0.0.1:8000`.
