// HƯỚNG DẪN — chuyển tab + phóng to ảnh minh hoạ
function guideTab(k) {
  document.querySelectorAll('#gdTabs button').forEach(b => b.classList.toggle('on', b.dataset.g === k));
  document.querySelectorAll('#pg-guide .gd-panel').forEach(p => p.classList.toggle('on', p.id === 'gd-' + k));
  try { sessionStorage.setItem('gd_tab', k); } catch (e) {}
  const m = document.querySelector('.main-panel') || document.scrollingElement; try { m.scrollTo({ top: 0 }); } catch (e) {}
}
function guideZoom(src) {
  const z = document.getElementById('gdZoom'); if (!z) return;
  z.querySelector('img').src = src; z.classList.add('on');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') { const z = document.getElementById('gdZoom'); if (z) z.classList.remove('on'); } });
(function () { let k = 'pu'; try { k = sessionStorage.getItem('gd_tab') || 'pu'; } catch (e) {} const go = () => guideTab(['pu', 'pg', 'iv'].includes(k) ? k : 'pu'); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go(); })();
