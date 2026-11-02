// ── Tách 2 miền: Hồ Chí Minh (HCM) / Hà Nội (HN) ────────────────────────────
// Một app, một Firebase. Dữ liệu HCM nằm ở collection "data"; dữ liệu Hà Nội nằm ở collection "data_hn" — hai bên không bao giờ lẫn nhau.
// Miền đang dùng lưu ở sessionStorage (mỗi tab một miền). Bộ nhớ cục bộ của Hà Nội dùng hậu tố "@HN" để không đè dữ liệu HCM.
(function () {
  let site = 'HCM';
  try { site = sessionStorage.getItem('ot_site_sel') === 'HN' ? 'HN' : 'HCM'; } catch (e) {}
  window.SITE = site; window.SITE_HN = site === 'HN';
  window.SITE_LABEL = { HCM: 'Hồ Chí Minh', HN: 'Hà Nội' };
  // Các mục Hà Nội được dùng (các mục khác chỉ dành cho HCM)
  window.HN_PAGES = ['dash', 'dept', 'employees', 'compare', 'late', 'formula', 'guide', 'settings'];

  const P = Storage.prototype, g = P.getItem, s = P.setItem, r = P.removeItem;
  const map = (self, k) => (window.SITE_HN && self === window.localStorage && typeof k === 'string' && k.indexOf('ot_manager_') === 0) ? k + '@HN' : k;
  P.getItem = function (k) { return g.call(this, map(this, k)); };
  P.setItem = function (k, v) { return s.call(this, map(this, k), v); };
  P.removeItem = function (k) { return r.call(this, map(this, k)); };
  // Xoá sạch dữ liệu cục bộ của CẢ 2 miền (khi đăng xuất / đổi người dùng)
  window.siteWipeAll = function () {
    try { Object.keys(localStorage).filter(k => k.indexOf('ot_manager_') === 0).forEach(k => r.call(localStorage, k)); } catch (e) {}
  };
  window.siteSelect = function (v) {
    try { sessionStorage.setItem('ot_site_sel', v === 'HN' ? 'HN' : 'HCM'); } catch (e) {}
    location.reload();
  };
  window.siteChoose = function () { try { sessionStorage.removeItem('ot_site_sel'); } catch (e) {} location.reload(); };
  if (window.SITE_HN) {
    document.documentElement.classList.add('site-hn');
    document.addEventListener('DOMContentLoaded', () => {
      document.body.classList.add('site-hn');
    });
  }
})();
