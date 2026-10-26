// ============================================================
//  TUYỂN DỤNG — nhúng bài thi tuyển dụng MEP (thư mục interview/) vào HMD.
//  Chỉ Quản lý / Admin thấy mục này. Trang interview/ đọc quyền từ phiên đăng nhập HMD (cùng domain):
//  tạo tài khoản ứng viên, chấm bài, xuất kết quả chỉ làm được khi đăng nhập HMD bằng quyền Quản lý / Admin.
//  Ứng viên mở link interview/ và đăng nhập bằng tài khoản được cấp (không cần tài khoản HMD).
// ============================================================
function ivBase() { return new URL('interview/', location.href.split('#')[0].split('?')[0]).href; }
function ivShow() {
  const f = document.getElementById('ivFrame'); if (!f) return;
  const url = ivBase();
  const l = document.getElementById('ivLink'); if (l) l.value = url;
  const o = document.getElementById('ivOpen'); if (o) o.href = url;
  if (!f.getAttribute('src')) f.src = url + 'index.html?embed=1';
}
function ivCopy() {
  const v = ivBase();
  const done = () => toast('✅ Đã sao chép link gửi ứng viên.');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, () => { const l = document.getElementById('ivLink'); if (l) { l.select(); document.execCommand('copy'); done(); } });
  else { const l = document.getElementById('ivLink'); if (l) { l.select(); document.execCommand('copy'); done(); } }
}
