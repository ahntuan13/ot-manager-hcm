# OT Manager HCM

Ứng dụng quản lý OT / Đi trễ / WLB — chạy hoàn toàn phía trình duyệt (client-side, không cần
server backend riêng), dữ liệu đồng bộ qua Google Apps Script (Google Sheets) — giữ nguyên như
bản cũ, không đổi gì phần này.

## Cấu trúc thư mục

```
index.html              Trang chính (khung HTML)
css/style.css            Toàn bộ giao diện (CSS)
js/app.js                 Toàn bộ logic ứng dụng (tính OT, biểu đồ, đồng bộ Google Sheet...)
js/vendor/                 Thư viện bên thứ 3 — lưu LOCAL để không phụ thuộc CDN ngoài
  chart.umd.js              Vẽ biểu đồ
  xlsx.full.min.js           Đọc / xuất file Excel
  jspdf.umd.min.js            Xuất file PDF
  html2canvas.min.js           Chụp ảnh màn hình cho báo cáo PDF
assets/                    (để trống, dự phòng cho ảnh/icon nếu cần sau này)
```

## Vì sao tách thành nhiều file?

File gốc trước đây là 1 file `index.html` duy nhất (nhúng cả HTML + CSS + JS + 4 thư viện bên
thứ 3 luôn trong đó) để tiện copy-paste. Bản này tách rõ ràng theo đúng chuẩn 1 project web bình
thường (index.html / css / js), dễ bảo trì, dễ đọc code, và vẫn giữ nguyên nguyên tắc **KHÔNG tải
gì qua CDN** — toàn bộ 4 thư viện (Chart.js, XLSX, jsPDF, html2canvas) đã tải sẵn về máy, nằm
trong `js/vendor/`, nên vẫn chạy tốt kể cả khi mạng công ty chặn CDN ngoài.

## Cách deploy

Upload **toàn bộ thư mục này** (giữ nguyên cấu trúc con — không được tách rời file `css/style.css`
hay các file trong `js/`) lên nơi lưu trữ web tĩnh bất kỳ:
- GitHub Pages
- Firebase Hosting
- Netlify
- Thư viện tài liệu SharePoint (dạng upload cả folder)

Chỉ cần mở `index.html` — các file css/js sẽ tự động được tải theo **đường dẫn tương đối**
(`css/style.css`, `js/app.js`, `js/vendor/...`), miễn là cấu trúc thư mục được giữ nguyên khi
upload.

⚠️ **Lưu ý quan trọng**: nếu chỉ upload MỘT MÌNH file `index.html` mà quên upload theo cả 2 thư
mục `css/` và `js/`, trang sẽ bị lỗi (mất giao diện + mất toàn bộ chức năng) vì thiếu file.

## Đồng bộ dữ liệu (Google Apps Script)

App vẫn dùng Google Apps Script làm backend lưu trữ — không đổi gì so với bản cũ. Cấu hình URL
Apps Script trong mục **Cài đặt** ngay trong app (lưu vào localStorage của trình duyệt, không
nằm trong code).
