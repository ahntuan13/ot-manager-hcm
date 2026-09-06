// ============================================================
//  PHIÊN BẢN APP — chỉ cần đổi số này mỗi lần update (vd: '2026.2', '2026.3'...)
// ============================================================
const APP_VERSION = '2026.34';

// ============================================================
//  PHÂN QUYỀN USER / ADMIN — chống xoá nhầm dữ liệu
// ============================================================
// Lưu vào sessionStorage (KHÔNG phải localStorage) — mỗi lần mở tab/trình duyệt MỚI sẽ phải chọn
// lại vai trò, tránh trường hợp lỡ để chế độ Admin mở sẵn qua nhiều ngày rồi ai đó vô tình xoá.
// LƯU Ý: đây là app chạy hoàn toàn phía trình duyệt (không có máy chủ xác thực) nên đây KHÔNG phải
// bảo mật thực sự (ai rành kỹ thuật vẫn có thể qua mặt) — mục đích chính là NGĂN THAO TÁC NHẦM của
// người dùng thường, không phải chống truy cập trái phép có chủ đích.
const ROLE_KEY = 'ot_manager_role_v1';
function isAdmin() { return sessionStorage.getItem(ROLE_KEY) === 'admin'; }

// ── Mật khẩu Admin — mặc định "admin123" lúc đầu, ĐỔI NGAY trong Cài đặt sau khi vào lần đầu.
// Đồng bộ qua Google Sheets giống USERS_DB để dùng được ở nhiều máy.
const ADMIN_PW_KEY = 'ot_manager_admin_pw_v1';
function getAdminPassword() { return localStorage.getItem(ADMIN_PW_KEY) || 'admin123'; }
function setAdminPassword(newPw) { localStorage.setItem(ADMIN_PW_KEY, newPw); }
function changeAdminPassword() {
  if (!requireAdmin('đổi mật khẩu Admin')) return;
  const cur = prompt('Nhập mật khẩu Admin HIỆN TẠI để xác nhận:');
  if (cur === null) return;
  if (cur !== getAdminPassword()) { toast('Mật khẩu hiện tại không đúng'); return; }
  const next = prompt('Nhập mật khẩu Admin MỚI:');
  if (!next) return;
  const confirmNext = prompt('Nhập lại mật khẩu mới để xác nhận:');
  if (next !== confirmNext) { toast('2 lần nhập không khớp — huỷ đổi mật khẩu'); return; }
  setAdminPassword(next);
  toast('Đã đổi mật khẩu Admin — nhớ bấm "Lưu & Đồng bộ" để dùng được ở máy khác.');
}

// ── Danh sách tài khoản User do Admin tạo — lưu localStorage + đồng bộ qua Google Sheets (dùng
// chung cơ chế Update data/Lưu & Đồng bộ đã có) để quản lý ở máy khác cũng đăng nhập được.
// LƯU Ý: chỉ để NGĂN THAO TÁC NHẦM, không phải bảo mật thực sự (mật khẩu lưu dạng thường, ai
// mở DevTools cũng xem được) — phù hợp với mục đích "chống xoá nhầm data", không phải chống truy
// cập trái phép có chủ đích.
const USERS_KEY = 'ot_manager_users_v1';
let USERS_DB = {}; // { username: { password, note, createdAt } }
function loadUsersDB() { try { const raw = localStorage.getItem(USERS_KEY); if (raw) USERS_DB = JSON.parse(raw); } catch(e) {} }
function saveUsersDB() { try { localStorage.setItem(USERS_KEY, JSON.stringify(USERS_DB)); } catch(e) {} }
function addUser(username, password, note) {
  username = (username||'').trim();
  if (!username || !password) return false;
  if (USERS_DB[username]) return false;
  USERS_DB[username] = { password, note: note||'', createdAt: new Date().toLocaleString('vi-VN') };
  saveUsersDB();
  return true;
}
function deleteUser(username) {
  if (!requireAdmin('xoá tài khoản User')) return;
  if (!confirm(`Xoá tài khoản "${username}"?`)) return;
  delete USERS_DB[username];
  saveUsersDB();
  renderUsersManage();
  toast('Đã xoá tài khoản');
}
function promptAddUser() {
  if (!requireAdmin('tạo tài khoản User')) return;
  const username = prompt('Tên đăng nhập (VD: pm_reddragon):');
  if (!username) return;
  const password = prompt(`Mật khẩu cho "${username}":`);
  if (!password) return;
  const note = prompt('Ghi chú (VD: PM dự án Red Dragon) — có thể để trống:') || '';
  if (addUser(username, password, note)) { toast(`Đã tạo tài khoản "${username}"`); renderUsersManage(); }
  else toast('Tên đăng nhập đã tồn tại hoặc không hợp lệ');
}
function renderUsersManage() {
  const box = document.getElementById('usersManageBox');
  if (!box) return;
  const names = Object.keys(USERS_DB).sort();
  box.innerHTML = names.length ? names.map(u => {
    const info = USERS_DB[u];
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--border2);border-radius:8px;margin-bottom:6px">
      <div style="flex:1">
        <div style="font-weight:600;font-family:var(--font-mono);font-size:12.5px">${u}</div>
        <div style="font-size:11px;color:var(--text2)">${info.note ? info.note+' · ' : ''}Mật khẩu: <span style="font-family:var(--font-mono)">${info.password}</span> · Tạo lúc ${info.createdAt}</div>
      </div>
      <button class="btn btn-danger" style="padding:4px 10px;font-size:11px" onclick="deleteUser('${u.replace(/'/g,"\\'")}')">Xoá</button>
    </div>`;
  }).join('') : '<div style="font-size:12px;color:var(--text2);padding:8px">Chưa có tài khoản User nào. Bấm "+ Tạo tài khoản" để thêm.</div>';
}

// ── Màn hình đăng nhập (vai trò User) — nhập đúng username/password do Admin tạo mới vào được.
function showAdminPwForm() {
  document.getElementById('roleGateMain').style.display = 'none';
  document.getElementById('roleGateAdminPw').style.display = 'block';
  document.getElementById('adminPwInput').value = '';
  document.getElementById('adminPwError').style.display = 'none';
  setTimeout(() => document.getElementById('adminPwInput').focus(), 50);
}
function backToRoleMain() {
  document.getElementById('roleGateAdminPw').style.display = 'none';
  document.getElementById('roleGateMain').style.display = 'block';
}
function attemptAdminLogin() {
  const p = document.getElementById('adminPwInput').value;
  const errEl = document.getElementById('adminPwError');
  if (p === getAdminPassword()) {
    enterAsRole('admin');
  } else {
    if (errEl) { errEl.style.display = 'block'; }
  }
}

function enterAsRole(role) {
  sessionStorage.setItem(ROLE_KEY, role);
  document.getElementById('roleGate').style.display = 'none';
  applyRoleUI();
}
function switchRole() {
  sessionStorage.removeItem(ROLE_KEY);
  sessionStorage.removeItem('ot_manager_username');
  document.getElementById('roleGate').style.display = 'flex';
  backToRoleMain();
}
// Ẩn mục "Cài đặt" khỏi sidebar + cập nhật hiển thị vai trò hiện tại, nếu không phải Admin.
function applyRoleUI() {
  const adminSection = document.querySelector('.sb-admin');
  if (adminSection) adminSection.style.display = isAdmin() ? 'block' : 'none';
  document.querySelectorAll('.admin-only-btn').forEach(el => { el.style.display = isAdmin() ? '' : 'none'; });
  const badge = document.getElementById('roleBadge');
  const uname = sessionStorage.getItem('ot_manager_username');
  if (badge) badge.textContent = isAdmin() ? '🔑 Admin' : (uname ? `👤 ${uname}` : '👤 User');
}
// Dùng để bọc quanh MỌI hành động xoá dữ liệu — nếu không phải Admin, chặn lại + báo rõ lý do,
// thay vì ẩn nút lặt vặt ở từng nơi (dễ sót) — gọi hàm này ở ĐẦU mỗi hàm xoá là đủ an toàn.
function requireAdmin(actionLabel) {
  if (isAdmin()) return true;
  toast(`⚠️ Chỉ Admin mới được ${actionLabel || 'xoá dữ liệu'}. Bấm vào tên app để đổi vai trò.`);
  return false;
}

(() => {
  const el = document.getElementById('appVersionBadge');
  if (el) el.textContent = 'v' + APP_VERSION;
})();

// ============================================================
//  CHART.JS GLOBAL DEFAULTS — earthy palette + Inter font
// ============================================================
Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.color = '#8A8378';
Chart.defaults.plugins.tooltip.backgroundColor = '#211F1C';
Chart.defaults.plugins.tooltip.titleColor = '#F3EFE8';
Chart.defaults.plugins.tooltip.bodyColor = '#F3EFE8';
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.displayColors = false;
// Tắt hẳn animation — biểu đồ hiện dữ liệu NGAY LẬP TỨC thay vì "mọc dần". Lý do: biểu đồ tròn/
// donut dùng animation xoay mặc định của Chart.js, nếu bị chụp/đóng băng giữa chừng (hoặc bị
// resize() ngắt animation) sẽ hiện thành hình méo/vỡ dạng miếng bánh dở dang thay vì hình tròn đủ.
// Tắt animation loại bỏ hẳn khả năng này, đồng thời giúp chuyển trang/tab cảm giác nhanh hơn.
Chart.defaults.animation = false;

// ============================================================
//  CONFIG & STATE
// ============================================================
const DEPT_COLORS = ['#2D6CDF','#5E7A4F','#7B5EA7','#B14B3F','#3E7C8C','#A07A3E','#6B7280','#9C5B8E'];

// Lightweight plugin: draws "Xh" or "X%" on bars (vertical or horizontal).
// Enable per-chart via options.plugins.barValueLabels = { suffix: 'h' }
const barValueLabelsPlugin = {
  id: 'barValueLabels',
  afterDatasetsDraw(chart) {
    const opts = chart.options.plugins && chart.options.plugins.barValueLabels;
    if (!opts) return;
    const { ctx } = chart;
    const suffix = opts.suffix || '';
    const showZero = !!opts.showZero;
    const fontSize = opts.fontSize || 11;
    const isHorizontal = chart.options.indexAxis === 'y';
    const isStacked = chart.options.scales?.y?.stacked || chart.options.scales?.x?.stacked;

    chart.data.datasets.forEach((dataset, di) => {
      const meta = chart.getDatasetMeta(di);
      if (meta.type !== 'bar' || meta.hidden) return;
      meta.data.forEach((bar, i) => {
        const val = dataset.data[i];
        if (val === null || val === undefined) return;
        if (val === 0 && !showZero) return;
        const label = `${val}${suffix}`;

        // For stacked bars: draw label INSIDE the segment (white text) if segment is tall/wide enough
        if (isStacked && !isHorizontal) {
          const segH = Math.abs(bar.base - bar.y);
          if (segH < 16) return; // too thin to show text
          ctx.save();
          ctx.fillStyle = 'rgba(255,255,255,0.92)';
          ctx.font = `700 ${segH > 24 ? 12 : 10}px "Inter", -apple-system, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const cy = bar.y + segH / 2;
          const tw = ctx.measureText(label).width;
          if (tw < bar.width - 6) ctx.fillText(label, bar.x, cy);
          ctx.restore();
          return;
        }

        // Default: label outside the bar (for non-stacked charts) — kể cả giá trị 0
        ctx.save();
        ctx.fillStyle = val === 0
          ? (getComputedStyle(document.documentElement).getPropertyValue('--text3').trim() || '#9CA3AF')
          : (getComputedStyle(document.documentElement).getPropertyValue('--text2').trim() || '#6B7280');
        ctx.font = `${val === 0 ? 600 : 600} ${fontSize}px "Inter", -apple-system, sans-serif`;
        if (isHorizontal) {
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, bar.x + 6, bar.y);
        } else {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(label, bar.x, bar.y - 3);
        }
        ctx.restore();
      });
    });
  }
};
Chart.register(barValueLabelsPlugin);

// Nền xen kẽ + đường kẻ giữa các NHÓM phòng ban trên grouped bar — giúp nhìn rõ
// cụm W1…W5 thuộc cùng 1 phòng ban (tránh phòng OT thấp bị tưởng là "thiếu cột").
const deptGroupBandsPlugin = {
  id: 'deptGroupBands',
  beforeDatasetsDraw(chart) {
    const opts = chart.options.plugins && chart.options.plugins.deptGroupBands;
    if (!opts) return;
    const x = chart.scales.x;
    const { ctx, chartArea, data } = chart;
    if (!x || !chartArea || !data.labels?.length) return;
    const n = data.labels.length;
    const band = (i) => {
      const c = x.getPixelForTick(i);
      const left = i === 0 ? chartArea.left : (x.getPixelForTick(i - 1) + c) / 2;
      const right = i === n - 1 ? chartArea.right : (c + x.getPixelForTick(i + 1)) / 2;
      return { left, right, c };
    };
    ctx.save();
    for (let i = 0; i < n; i++) {
      const { left, right } = band(i);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(45,108,223,0.05)' : 'rgba(128,128,128,0.04)';
      ctx.fillRect(left, chartArea.top, right - left, chartArea.bottom - chartArea.top);
    }
    ctx.restore();
  },
  afterDatasetsDraw(chart) {
    const opts = chart.options.plugins && chart.options.plugins.deptGroupBands;
    if (!opts) return;
    const x = chart.scales.x;
    const { ctx, chartArea, data } = chart;
    if (!x || !chartArea || !data.labels?.length) return;
    const n = data.labels.length;
    ctx.save();
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border2').trim() || 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (let i = 0; i < n - 1; i++) {
      const mid = (x.getPixelForTick(i) + x.getPixelForTick(i + 1)) / 2;
      ctx.beginPath();
      ctx.moveTo(mid, chartArea.top);
      ctx.lineTo(mid, chartArea.bottom);
      ctx.stroke();
    }
    ctx.restore();
  }
};
Chart.register(deptGroupBandsPlugin);

// Plugin vẽ NHÃN KÉO RA (leader line) cho biểu đồ tròn/doughnut — mỗi lát cắt có 1 đường thẳng
// kéo từ mép lát cắt ra ngoài, kèm nhãn "Tên: giá trị" — dễ đọc hơn nhét chữ vào trong lát nhỏ.
// Bật qua options.plugins.pieLeaderLabels = { formatLabel: (label, val, pct) => `${label}: ${val}h` }.
const pieLeaderLabelsPlugin = {
  id: 'pieLeaderLabels',
  afterDraw(chart) {
    const opts = chart.options.plugins && chart.options.plugins.pieLeaderLabels;
    if (!opts) return;
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data.length) return;
    const dataset = chart.data.datasets[0];
    const total = dataset.data.reduce((a,b)=>a+(b||0),0);
    if (!total) return;
    const { ctx } = chart;
    ctx.save();
    ctx.font = '600 11px Inter, -apple-system, sans-serif';
    ctx.textBaseline = 'middle';
    const lineColor = getComputedStyle(document.documentElement).getPropertyValue('--text3').trim() || '#9CA3AF';
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#1A1D29';
    meta.data.forEach((arc, i) => {
      const val = dataset.data[i];
      if (!val) return;
      const pct = Math.round(val/total*100);
      const { x, y } = arc.getCenterPoint();
      const angle = (arc.startAngle + arc.endAngle) / 2;
      const outerR = arc.outerRadius;
      const sx = x + Math.cos(angle) * outerR;
      const sy = y + Math.sin(angle) * outerR;
      const ex = x + Math.cos(angle) * (outerR + 16);
      const ey = y + Math.sin(angle) * (outerR + 16);
      const isRight = Math.cos(angle) >= 0;
      const tx = ex + (isRight ? 18 : -18);
      const ty = ey;

      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      ctx.fillStyle = textColor;
      ctx.textAlign = isRight ? 'left' : 'right';
      const label = opts.formatLabel ? opts.formatLabel(chart.data.labels[i], val, pct) : `${val}`;
      ctx.fillText(label, tx + (isRight?4:-4), ty);
    });
    ctx.restore();
  }
};
Chart.register(pieLeaderLabelsPlugin);

// Draws ONE clear total value above each stacked bar group (instead of cluttered per-segment text)
const stackedTotalLabelPlugin = {
  id:'stackedTotalLabel',
  afterDatasetsDraw(chart) {
    const opts = chart.options.plugins && chart.options.plugins.stackedTotalLabel;
    if (!opts || !opts.totals) return;
    const { ctx } = chart;
    const lastDatasetIdx = chart.data.datasets.length - 1;
    const meta = chart.getDatasetMeta(lastDatasetIdx);
    ctx.save();
    ctx.font = '700 13px "JetBrains Mono", ui-monospace, monospace';
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#1A1D29';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    meta.data.forEach((bar, i) => {
      const total = opts.totals[i];
      if (total === undefined || total === null) return;
      ctx.fillStyle = textColor;
      ctx.fillText(`${total}h`, bar.x, bar.y - 5);
    });
    ctx.restore();
  }
};

const NV_COLORS   = ['#2D6CDF','#5E7A4F','#7B5EA7','#B14B3F','#3E7C8C','#A07A3E','#9C5B8E','#6B7280','#3E7C8C','#B5731E'];
const MN = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const STORAGE_KEY = 'ot_manager_v3';

let DB = {};
let activeMK = null;
let activePeriod = null;
let dashTab = 'week'; // 'week' | 'month'
let empMK = null;
let empPeriod = null;
let empTab = 'month'; // 'week' | 'month' — trang Danh sách nhân viên OT, độc lập với dashTab
let empProjectFilter = null; // {group, proj, codes:[staffCode..]} — lọc riêng theo dự án khi bấm từ Action Plan, null = không lọc
let CH = {};

// ============================================================
//  FIX TỔNG QUÁT: biểu đồ trắng do được tạo lúc trang/tab đang ẩn (display:none)
// ============================================================
// Chart.js đo kích thước canvas TẠI THỜI ĐIỂM tạo — nếu container đang ẩn lúc đó, nó đo ra 0×0
// và KHÔNG tự đo lại sau này dù trang có hiện lại. Đây là nguyên nhân gốc gây ra hiện tượng biểu
// đồ trắng lặp đi lặp lại ở nhiều trang (Dashboard, So sánh OT, Đi trễ, WLB...) — thay vì vá từng
// chỗ một, hàm này ép TẤT CẢ chart hiện có (trong cả 3 kho: CH, CHL, WLB_CH) đo lại kích thước
// thật ngay khi có, gọi ngay sau MỌI lần chuyển trang/tab để đảm bảo container đã hiện ra rồi.
function forceResizeAllCharts() {
  [CH, typeof CHL !== 'undefined' ? CHL : {}, typeof WLB_CH !== 'undefined' ? WLB_CH : {}].forEach(store => {
    Object.values(store).forEach(chart => {
      if (!chart || typeof chart.resize !== 'function') return;
      try {
        // Tự đo kích thước khung chứa bằng DOM thuần (getBoundingClientRect) rồi TRUYỀN THẲNG
        // vào resize(width, height) — không dựa vào Chart.js tự đo, vì cơ chế responsive tự động
        // của nó bị lỗi trong kiến trúc SPA này (canvas bị kẹt ở kích thước mặc định 300×150 của
        // HTML5 <canvas> khi Chart.js chưa từng đo được kích thước thật của khung chứa lúc tạo).
        const canvasEl = chart.canvas;
        const wrap = canvasEl && canvasEl.parentElement;
        if (wrap) {
          const rect = wrap.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            chart.resize(rect.width, rect.height);
            return;
          }
        }
        chart.resize(); // fallback nếu không đo được container (hiếm khi xảy ra)
      } catch(e) {}
    });
  });
}
// Gọi resize nhiều lần sau khi CSS display đổi — lần đầu browser có thể chưa kịp layout
// (đặc biệt chart nằm trong CSS grid vừa hiện từ display:none → width tạm = 0).
// Thêm setTimeout 50/200ms để bắt chắc layout ổn định trên mọi trình duyệt.
function scheduleChartResize() {
  requestAnimationFrame(() => {
    forceResizeAllCharts();
    requestAnimationFrame(() => {
      forceResizeAllCharts();
      setTimeout(forceResizeAllCharts, 50);
      setTimeout(forceResizeAllCharts, 200);
    });
  });
}

// Tạo chart an toàn: reset size canvas cũ → new Chart trong try/catch.
// Một chart lỗi không được làm đứt cả hàm render (tránh các khối sau bị trắng).
function safeMakeChart(store, killFn, id, canvasEl, config) {
  if (!canvasEl) return null;
  try {
    killFn(id);
    canvasEl.removeAttribute('width');
    canvasEl.removeAttribute('height');
    canvasEl.style.width = '';
    canvasEl.style.height = '';
    store[id] = new Chart(canvasEl, config);
    return store[id];
  } catch (err) {
    console.error('Chart create failed:', id, err);
    store[id] = null;
    return null;
  }
}

// ============================================================
//  UTILS
// ============================================================
const MONTH_NAMES_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function fmtMK(mk) {
  const [y,m] = mk.split('-').map(Number);
  return `${MONTH_NAMES_EN[m-1]} ${y}`;
}
function stOf(t) { return t > 70 ? 'd' : t > 45 ? 'w45' : 'o'; }
function stBadge(t) {
  const s = stOf(t);
  return s==='d' ? '<span class="badge bd">Vượt mức</span>'
       : s==='w45' ? '<span class="badge bw">Vượt mức 45</span>'
                 : '<span class="badge bo">Bình thường</span>';
}
function killChart(id) { if (CH[id]) { CH[id].destroy(); CH[id] = null; } }
function maxTot(arr) { return arr.length ? Math.max(...arr.map(t=>t.total)) : 80; }

// Lời chào theo thời gian thực: Xin chào buổi sáng/trưa/chiều/tối, Anh Chị 👋
function greetText() {
  const hr = new Date().getHours();
  const part = hr < 11 ? 'buổi sáng' : hr < 14 ? 'buổi trưa' : hr < 18 ? 'buổi chiều' : 'buổi tối';
  return `Xin chào ${part}, Anh Chị 👋`;
}

// Nhãn nhân viên dùng trong TẤT CẢ biểu đồ: "Mã NV - Tên" (thay vì chỉ lấy tên cuối).
// Dùng khi đã có object (t.staffCode / t.code) sẵn từ getTotals()/getLateTotals().
function nvLabel(t) {
  const code = (t && (t.staffCode || t.code)) || '';
  const name = (t && t.name) || '';
  return code ? `${code} - ${name}` : name;
}
// Dùng khi chỉ có tên (string) và cần tự tra mã NV từ DB/LATE_DB theo các tháng đã có.
function nvLabelByName(name, db, mkList) {
  for (const mk of mkList) {
    const e = db[mk] && db[mk].employees && db[mk].employees[name];
    if (e) { const code = e.staffCode || e.code || ''; return code ? `${code} - ${name}` : name; }
  }
  return name;
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

function mkDate(raw) {
  if (typeof raw === 'number') {
    const d = new Date(Math.round((raw - 25569) * 86400000));
    return isNaN(d) ? null : d;
  }
  const s = String(raw).trim();
  let d;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const parts = s.split('/');
    d = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
  } else {
    d = new Date(s);
  }
  return isNaN(d) ? null : d;
}
function weekOf(raw) {
  const d = mkDate(raw); if (!d) return -1;
  const day = d.getDate();
  return day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;
}
function monthKeyOf(raw) {
  const d = mkDate(raw); if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

// ---- Company month cycle: runs from the 16th to the 15th of next month ----
// "Company month key" is labeled by the month/year of its END date (the 15th).
// e.g. 16/04 - 15/05 -> key "2026-05"
function companyMonthInfo(d) {
  const day = d.getDate();
  let endMonth, endYear;
  if (day >= 16) {
    endMonth = d.getMonth() + 1; // next month
    endYear  = d.getFullYear();
    if (endMonth > 11) { endMonth = 0; endYear++; }
  } else {
    endMonth = d.getMonth();
    endYear  = d.getFullYear();
  }
  const mk = `${endYear}-${String(endMonth+1).padStart(2,'0')}`;

  // Week index within the cycle: 16-22 -> 0, 23-29 -> 1, 30/31/1-6 -> 2, 7-15 -> 3
  let wi;
  if (day >= 16 && day <= 22) wi = 0;
  else if (day >= 23 && day <= 29) wi = 1;
  else if (day >= 30 || day <= 6) wi = 2;
  else wi = 3; // 7-15

  return { monthKey: mk, weekIdx: wi };
}
function companyMonthKeyOf(raw) {
  const d = mkDate(raw); if (!d) return null;
  return companyMonthInfo(d).monthKey;
}
// ISO date string "YYYY-MM-DD" for storage keys
function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function isoDateOf(raw) {
  const d = mkDate(raw); if (!d) return null;
  return isoDate(d);
}
// Day-of-cycle index (0-based) within the 16th-15th company month, 0..29/30
function dayOfCycleIdx(d) {
  const day = d.getDate();
  return day >= 16 ? (day - 16) : (day + (daysInMonth(prevMonth(d)) - 16));
}
function daysInMonth(d) { return new Date(d.getFullYear(), d.getMonth()+1, 0).getDate(); }
function prevMonth(d) { return new Date(d.getFullYear(), d.getMonth()-1, 1); }

// Get the cycle-start date (16th of start-month) for a company-month key
function cycleStartOf(mk) {
  const [y,mm] = mk.split('-').map(Number);
  let startMonth = mm - 1, startYear = y;
  if (startMonth < 1) { startMonth = 12; startYear--; }
  return new Date(startYear, startMonth-1, 16);
}
// Cycle-end date (15th of the mk month)
function cycleEndOf(mk) {
  const [y,mm] = mk.split('-').map(Number);
  return new Date(y, mm-1, 15);
}

// Chia tuần theo ĐÚNG LỊCH TUẦN THẬT (Thứ 2 → Chủ nhật), không phải cứ đếm cứng 7 ngày từ 16.
// Quy tắc (đúng theo ảnh lịch tháng công ty cung cấp):
//  · Các tuần Ở GIỮA chu kỳ = trọn vẹn 1 tuần lịch (Thứ 2 → Chủ nhật).
//  · Phần lẻ ĐẦU chu kỳ (từ ngày 16 đến hết tuần lịch chứa ngày 16, nếu 16 không rơi đúng Thứ 2)
//    → GỘP VÀO tuần lịch kế tiếp để thành "Tuần 1" (tránh 1 tuần chỉ có 1-2 ngày lẻ loi).
//    Ví dụ: 16/08/2026 là Chủ nhật → Tuần 1 = 16/08 (1 ngày lẻ) gộp với tuần 17-23/08 = 16→23/08.
//  · Phần lẻ CUỐI chu kỳ (từ đầu tuần lịch chứa ngày 15 đến hết ngày 15, nếu 15 không rơi đúng CN)
//    → GỘP VÀO tuần lịch liền trước để thành "Tuần cuối".
//    Ví dụ: 15/09/2026 là Thứ Ba → phần lẻ 14-15/09 gộp với tuần 07-13/09 = 07→15/09.
function fixedWeekEndDates(mk) {
  const cycleStart = cycleStartOf(mk);
  const cycleEnd = cycleEndOf(mk);

  // dow: 0=CN,1=T2,...,6=T7 → quy đổi sang "số ngày kể từ Thứ 2" (Thứ 2=0 ... Chủ nhật=6)
  const mondayIdx = (d) => (d.getDay() + 6) % 7;

  // Ngày Chủ nhật kết thúc tuần lịch chứa `d`
  const sundayOfWeek = (d) => { const r = new Date(d); r.setDate(r.getDate() + (6 - mondayIdx(d))); return r; };
  // Ngày Thứ 2 bắt đầu tuần lịch chứa `d`
  const mondayOfWeek = (d) => { const r = new Date(d); r.setDate(r.getDate() - mondayIdx(d)); return r; };

  // Danh sách mốc KẾT THÚC của từng tuần lịch (Chủ nhật), bắt đầu từ tuần lịch chứa cycleStart,
  // cho đến khi vượt quá cycleEnd.
  const weekEnds = [];
  let cur = sundayOfWeek(cycleStart);
  while (cur < cycleEnd) {
    weekEnds.push(new Date(cur));
    cur = new Date(cur); cur.setDate(cur.getDate() + 7);
  }
  weekEnds.push(new Date(cur)); // mốc tuần lịch cuối cùng (>= cycleEnd)

  // Nếu ngày 16 KHÔNG phải Thứ 2 → tuần lịch đầu tiên chỉ có vài ngày lẻ (16 → hết tuần đó).
  // Gộp mốc đầu tiên này vào mốc thứ 2 (bỏ mốc đầu) để thành "Tuần 1" đủ dài hơn.
  if (mondayIdx(cycleStart) !== 0 && weekEnds.length > 1) weekEnds.shift();

  // Nếu ngày 15 (cycleEnd) KHÔNG phải Chủ nhật → tuần lịch cuối cùng chỉ có vài ngày lẻ
  // (đầu tuần đó → 15). Gộp mốc áp chót vào mốc cuối (bỏ mốc áp chót) để thành "Tuần cuối" đủ dài hơn.
  if (mondayIdx(cycleEnd) !== 6 && weekEnds.length > 1) weekEnds.splice(weekEnds.length - 2, 1);

  // Luôn đảm bảo mốc cuối cùng = đúng cycleEnd (ngày 15), và không có mốc nào vượt quá phạm vi chu kỳ.
  return weekEnds.map(d => {
    if (d < cycleStart) return new Date(cycleStart);
    if (d > cycleEnd) return new Date(cycleEnd);
    return d;
  }).map((d,i,arr) => i === arr.length-1 ? new Date(cycleEnd) : d);
}

function collectDataDates(mk) {
  const m = DB[mk]; if (!m) return [];
  const all = new Set();
  (m.names || []).forEach(n => {
    const e = m.employees[n]; if (!e) return;
    Object.keys(e.days || {}).forEach(dt => all.add(dt));
    Object.keys(e.quotaDays || {}).forEach(dt => all.add(dt));
  });
  return [...all].sort();
}

// Snapshot / mốc tuần để buildPeriods:
//  · ≥2 snapshot từ upload tuần → giữ nguyên (W1…W5 theo lần upload).
//  · 0–1 snapshot (demo, sync thiếu, hoặc chỉ upload 1 file cả tháng) → TÁCH theo 4 tuần
//    cố định 16→15 dựa trên ngày có dữ liệu. Tránh gộp cả chu kỳ thành 1 cột "W1".
function getSnapshots(mk) {
  const m = DB[mk]; if (!m) return [];
  const uploaded = (m.snapshots || []).slice().sort();
  if (uploaded.length >= 2) return uploaded;

  const dataDates = collectDataDates(mk);
  if (!dataDates.length) return uploaded.length ? uploaded : [];

  const maxIso = dataDates[dataDates.length - 1];
  const fixed = fixedWeekEndDates(mk)
    .map(d => isoDate(d))
    .filter(iso => iso <= maxIso);
  if (!fixed.length) return [maxIso];
  // Nếu dữ liệu dừng giữa chừng tuần cuối (vd hết ngày 10 trong khi W4 = 15) → thêm mốc maxIso
  if (fixed[fixed.length - 1] < maxIso) fixed.push(maxIso);
  return fixed;
}

// Build period objects for display: each period is cumulative from cycle-start to that snapshot.
// weekNum = thứ tự tuần (W1, W2, …). Label hiện KHOẢNG NGÀY RIÊNG của tuần đó (không luỹ kế).
function buildPeriods(mk) {
  const snaps = getSnapshots(mk);
  if (!snaps.length) return [];
  const cycleStart = cycleStartOf(mk);
  return snaps.map((snapIso, i) => {
    const end = new Date(snapIso + 'T00:00:00');
    const isLast = i === snaps.length - 1;
    const weekNum = i + 1;
    let rangeStart = cycleStart;
    if (i > 0) {
      rangeStart = new Date(snaps[i - 1] + 'T00:00:00');
      rangeStart.setDate(rangeStart.getDate() + 1);
    }
    const dateRange = `${pad2(rangeStart.getDate())}/${pad2(rangeStart.getMonth()+1)}-${pad2(end.getDate())}/${pad2(end.getMonth()+1)}`;
    const label = `W${weekNum} · ${dateRange}`;
    return { start: cycleStart, end, label, isLast, snapIso, weekNum };
  });
}
function pad2(n){ return String(n).padStart(2,'0'); }

// Trả về khoảng ngày RIÊNG của 1 tuần (không tính luỹ kế từ ngày 16) — dùng cho Đi trễ tab "Theo tuần".
// Tuần đầu tiên (idx=0): từ ngày 16 (cycleStart) đến hết tuần đó. Các tuần sau: từ ngay-sau-tuần-trước đến hết tuần đó.
function getWeekOnlyRange(periods, idx) {
  if (!periods.length || idx < 0 || idx >= periods.length) return null;
  const period = periods[idx];
  if (idx === 0) return { start: period.start, end: period.end };
  const prevEnd = periods[idx-1].end;
  const start = new Date(prevEnd);
  start.setDate(start.getDate() + 1);
  return { start, end: period.end };
}

// Sum OT hours for an employee within a date range [start,end] inclusive.
// Tối ưu hiệu năng: so sánh CHUỖI ISO (YYYY-MM-DD) thay vì tạo `new Date()` cho từng entry —
// vì key ngày đã ở dạng ISO nên so sánh chuỗi cho kết quả CHÍNH XÁC như so sánh Date, nhưng nhanh
// hơn nhiều lần (không tốn chi phí tạo object Date) — quan trọng khi có hàng trăm NV × nhiều tháng.
function sumDaysInRange(daysObj, start, end) {
  if (!daysObj) return 0;
  const startIso = typeof start === 'string' ? start : isoDate(start);
  const endIso = typeof end === 'string' ? end : isoDate(end);
  let sum = 0;
  for (const dt in daysObj) {
    if (dt >= startIso && dt <= endIso) sum += daysObj[dt];
  }
  return sum;
}
// Total OT hours for an employee record — theo công thức mới: MAX(0, tổng giờ đã làm − tổng giờ tiêu chuẩn).
function totalOf(e) {
  const worked = Object.values(e.days || {}).reduce((a,b)=>a+b,0);
  const quota = Object.values(e.quotaDays || {}).reduce((a,b)=>a+b,0);
  return Math.max(0, worked - quota);
}
// Tổng phần OT phát sinh SAU 22:00 (Night OT) — chỉ để theo dõi riêng, đã nằm sẵn trong totalOf() ở trên.
function nightTotalOf(e) {
  return Object.values(e.nightDays || {}).reduce((a,b)=>a+b,0);
}

function fmtCompanyMK(mk) {
  const [y,m] = mk.split('-').map(Number);
  let startMonth = m - 1, startYear = y;
  if (startMonth < 1) { startMonth = 12; startYear--; }
  return `16/${String(startMonth).padStart(2,'0')} - 15/${String(m).padStart(2,'0')}/${y}`;
}

// ============================================================
//  STORAGE
// ============================================================
function saveDB(triggerAuto = true) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(DB)); } catch(e) {}
  if (triggerAuto && AUTO_SYNC && SYNC_URL) syncSave();
}
function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      DB = JSON.parse(raw);
      migrateOldFormat();
      return true;
    }
  } catch(e) {}
  return false;
}

// Migrate legacy data that used employees[name].weeks = [w1,w2,w3,w4] (no per-day storage)
function migrateOldFormat() {
  Object.keys(DB).forEach(mk => {
    const m = DB[mk];
    if (!m || !m.names) return;
    if (!m.snapshots) m.snapshots = [];
    m.names.forEach(n => {
      const e = m.employees[n];
      if (!e) return;
      if (!e.days && Array.isArray(e.weeks)) {
        // Spread each weekly total across 7 days starting at the cycle start + week offset
        const cycleStart = cycleStartOf(mk);
        e.days = {};
        e.weeks.forEach((wTotal, wi) => {
          if (!wTotal) return;
          const segStart = new Date(cycleStart);
          segStart.setDate(segStart.getDate() + wi*7);
          // put the whole week total on the first day of the segment (simplest safe migration)
          e.days[isoDate(segStart)] = Math.round(wTotal*100)/100;
        });
        delete e.weeks;
      }
      if (!e.days) e.days = {};
    });
    if (!m.snapshots.length) {
      const allDates = new Set();
      m.names.forEach(n => Object.keys(m.employees[n].days||{}).forEach(dt=>allDates.add(dt)));
      if (allDates.size) m.snapshots = [[...allDates].sort().pop()];
    }
  });
}

// ============================================================
//  DEPT / COMPARE SUB-TABS
// ============================================================
let deptTab = 'week';    // 'week' | 'month'
let deptPeriodIdx = null; // selected period in week view
let cmpTab = 'week';     // 'week' | 'month'

function setDashTab(tab) {
  dashTab = tab;
  document.getElementById('dashTabWeek').classList.toggle('active',  tab==='week');
  document.getElementById('dashTabMonth').classList.toggle('active', tab==='month');
  document.getElementById('dashWeekBar').style.display = tab==='week' ? 'flex' : 'none';
  renderDash();
  scheduleChartResize();
}

function setDeptTab(tab) {
  deptTab = tab;
  document.getElementById('deptTabWeek').classList.toggle('active', tab==='week');
  document.getElementById('deptTabMonth').classList.toggle('active', tab==='month');
  document.getElementById('deptWeekBar').style.display = tab==='week' ? 'flex' : 'none';
  renderDept();
  scheduleChartResize();
}

function setCmpTab(tab) {
  cmpTab = tab;
  document.getElementById('cmpTabWeek').classList.toggle('active',  tab==='week');
  document.getElementById('cmpTabMonth').classList.toggle('active', tab==='month');
  document.getElementById('cmpTabQuarter').classList.toggle('active', tab==='quarter');
  document.getElementById('cmp-week').style.display    = tab==='week'    ? 'block' : 'none';
  document.getElementById('cmp-month').style.display   = tab==='month'   ? 'block' : 'none';
  document.getElementById('cmp-quarter').style.display = tab==='quarter' ? 'block' : 'none';
  const monthRow = document.getElementById('cmpMonthSelRow');
  if (monthRow) monthRow.style.display = tab === 'quarter' ? 'none' : 'flex';
  if (tab === 'week') renderCompareWeek();
  else if (tab === 'quarter') renderCompareQuarter();
  else renderCompareMonth();
  scheduleChartResize();
}

// Đổi tháng trên dropdown dùng chung — render đúng tab đang mở (Tuần hoặc Tháng).
function onCmpMonthChange() {
  if (cmpTab === 'week') renderCompareWeek();
  else if (cmpTab === 'month') renderCompareMonth();
}

let lateTab = 'month';
function setLateTab(tab) {
  lateTab = tab;
  document.getElementById('lateTabWeek').classList.toggle('active', tab==='week');
  document.getElementById('lateTabMonth').classList.toggle('active', tab==='month');
  document.getElementById('lateTabQuarter').classList.toggle('active', tab==='quarter');
  document.getElementById('late-week').style.display    = tab==='week'    ? 'block' : 'none';
  document.getElementById('late-month').style.display   = tab==='month'   ? 'block' : 'none';
  document.getElementById('late-quarter').style.display = tab==='quarter' ? 'block' : 'none';
  if (tab === 'quarter') renderLateQuarter();
  else if (tab === 'week') renderLateWeek();
  else renderLate();
  scheduleChartResize();
}

// ============================================================
//  NAVIGATION
// ============================================================
// ============================================================
//  THEME TOGGLE (sáng/tối, lưu lựa chọn của người dùng)
// ============================================================
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.innerHTML = t === 'dark'
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme')
    || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem('ot_theme', next); } catch(e) {}
}
(function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('ot_theme'); } catch(e) {}
  if (saved === 'dark' || saved === 'light') applyTheme(saved);
})();

function goPage(p, deptFilter, keepProjectFilter) {
  // Chặn vào Cài đặt nếu không phải Admin — kể cả khi gọi trực tiếp qua code, không chỉ ẩn nút.
  if (p === 'settings' && !isAdmin()) {
    toast('⚠️ Chỉ Admin mới vào được mục Cài đặt. Bấm vào tên app để đổi vai trò.');
    return;
  }
  const dashGroup = ['dash','dept','compare','late','wlb'];
  document.querySelectorAll('.pg').forEach(x => x.classList.remove('show'));
  document.querySelectorAll('.nt[data-page]').forEach(x => x.classList.remove('active'));
  document.querySelectorAll(`.nt[data-page="${p}"]`).forEach(x => x.classList.add('active'));
  if (dashGroup.includes(p)) {
    goSub(p);
    return;
  }
  const pg = document.getElementById('pg-' + p);
  if (pg) pg.classList.add('show');
  if (p === 'settings')  { renderSavedMonths(); renderSyncPage(); }
  if (p === 'report') { populateReportSelectors(); }
  if (p === 'action') renderActionPlan();
  if (p === 'employees') {
    if (!keepProjectFilter) empProjectFilter = null; // điều hướng bình thường (không phải từ Action Plan) → bỏ lọc dự án cũ
    if (deptFilter) {
      const empDF = document.getElementById('empDeptFilter');
      // Đảm bảo select đã có option của phòng ban này trước khi gán giá trị
      if (empDF && ![...empDF.options].some(o => o.value === deptFilter)) {
        empDF.innerHTML += `<option value="${deptFilter}">${deptFilter}</option>`;
      }
      if (empDF) empDF.value = deptFilter;
    }
    renderEmployeeList();
  }
  scheduleChartResize();
}

function goSub(p) {
  ['dash','dept','compare','late','wlb'].forEach(x => {
    const el = document.getElementById('pg-' + x);
    if (el) el.classList.remove('show');
  });
  const pg = document.getElementById('pg-' + p);
  if (pg) pg.classList.add('show');
  // QUAN TRỌNG: phải re-render lại biểu đồ MỖI LẦN điều hướng vào 1 trang (kể cả 'dash') —
  // nếu chỉ hiện lại trang bằng CSS mà không gọi lại hàm render, biểu đồ nào từng được build
  // trong lúc trang đó đang ẩn (display:none) sẽ bị Chart.js đo kích thước = 0×0 và render TRẮNG
  // mãi mãi (Chart.js không tự đo lại khi container chuyển từ ẩn sang hiện). Đây là nguyên nhân
  // gốc gây ra hiện tượng "biểu đồ Dashboard trắng sau khi Update data ở trang khác".
  if (p === 'dash')    renderDash();
  if (p === 'dept')    renderDept();
  if (p === 'compare') renderCompare();
  if (p === 'late')    { if (lateTab === 'quarter') renderLateQuarter(); else if (lateTab === 'week') renderLateWeek(); else renderLate(); }
  if (p === 'wlb')     { renderWlbSummary(); renderWlb(); }
  // Lưới an toàn cuối cùng: dù render function ở trên có tính đúng kích thước hay không, ép TẤT
  // CẢ chart hiện có đo lại kích thước thật ngay khi trang này đã thực sự hiện ra trên màn hình.
  scheduleChartResize();
}

// ============================================================
//  DATA HELPERS
// ============================================================
function getAllDepts() {
  const s = new Set();
  Object.values(DB).forEach(m => Object.keys(m.depts || {}).forEach(d => s.add(d)));
  return [...s].sort();
}

// Dùng riêng cho trang WLB: gộp tên phòng ban từ CẢ 2 nguồn (OT + Off Day).
// getAllDepts() gốc chỉ lấy từ OT (dùng cho Dashboard/OT phòng ban để khớp đúng dữ liệu OT thuần) —
// nhưng ở WLB nếu chỉ dùng danh sách đó, phòng ban nào chỉ xuất hiện trong file Off Day
// (tên hơi khác, hoặc NV đó chưa có OT tháng này) sẽ bị rớt khỏi bảng dù có dữ liệu.
function getAllDeptsForWlb() {
  const s = new Set(getAllDepts());
  Object.values(OFF_DB).forEach(m => Object.keys(m.depts || {}).forEach(d => { if (d) s.add(d); }));
  wlbXlsAllDepts().forEach(d => s.add(d));
  return [...s].sort();
}

// Get totals for employees in month `mk`, cumulative up to period index `pIdx` (default: last/latest period).
// Returns { name, dept, total } per employee — `total` = MAX(0, tổng giờ đã làm − tổng giờ tiêu chuẩn)
// cộng dồn từ đầu chu kỳ (16) đến hết period đang xét — đúng công thức lấy từ file Excel VBA gốc.
// Khi đang ở tab "Theo tuần", thay .total/.nightTotal (luỹ kế) bằng .deltaTotal/.deltaNightTotal
// (chỉ riêng tuần đang xem, KHÔNG cộng dồn từ ngày 16) — áp dụng cho Dashboard & Danh sách NV OT.
// Tab "Theo tháng" giữ nguyên luỹ kế như cũ (không gọi hàm này).
function applyWeekDelta(totals) {
  // Giữ lại tổng LŨY KẾ gốc (từ ngày 16 đến hết tuần đang xem) dưới tên cumulativeTotal, TRƯỚC
  // khi ghi đè total = deltaTotal (chỉ riêng tuần đó) — để nơi nào cần "tổng lũy kế các tuần"
  // (như biểu đồ % Giới hạn KPI/Chi trả) vẫn lấy được đúng số, không bị mất sau bước này.
  return totals.map(t => ({ ...t, cumulativeTotal: t.total, total: t.deltaTotal, nightTotal: t.deltaNightTotal }));
}

function getTotals(mk, deptFilter = '__all__', pIdx = null) {
  const m = DB[mk]; if (!m) return [];
  const periods = buildPeriods(mk);
  if (!periods.length) return [];
  const idx = (pIdx === null || pIdx < 0 || pIdx >= periods.length) ? periods.length-1 : pIdx;
  const period = periods[idx];
  // Tính sẵn chuỗi ISO ranh giới MỘT LẦN cho cả lượt gọi (không phải mỗi nhân viên) — vì
  // period.start/end giống nhau cho mọi NV, tránh gọi isoDate() lặp lại hàng trăm lần không cần thiết.
  const startIso = isoDate(period.start), endIso = isoDate(period.end);
  // Cửa sổ NGÀY RIÊNG của tuần đang xét (sau hết tuần trước → hết tuần này) — dùng cho deltaTotal.
  // Tránh công thức cũ max(0, OT_luỹ_kế_n − OT_luỹ_kế_n−1) khiến W4 = 0 khi quota đuổi kịp giờ làm
  // dù tuần đó vẫn có giờ OT thật (phần OT bị dồn sang W5).
  const weekRange = getWeekOnlyRange(periods, idx);
  const weekStartIso = weekRange ? isoDate(weekRange.start) : startIso;
  const weekEndIso = weekRange ? isoDate(weekRange.end) : endIso;
  const sumIso = (obj, s, e) => { let sum=0; for (const k in obj) { if (k>=s && k<=e) sum+=obj[k]; } return sum; };
  return m.names
    .filter(n => deptFilter === '__all__' || m.employees[n]?.dept === deptFilter)
    .map(n => {
      const e = m.employees[n];
      const days = e.days || {};
      const quotaDays = e.quotaDays || {};
      const nightDays = e.nightDays || {};
      const workedUpTo = sumIso(days, startIso, endIso);
      const quotaUpTo = sumIso(quotaDays, startIso, endIso);
      const tot = Math.round(Math.max(0, workedUpTo - quotaUpTo)*10)/10;
      const nightTot = Math.round(sumIso(nightDays, startIso, endIso)*10)/10;
      // OT / Night PHÁT SINH RIÊNG trong đúng cửa sổ tuần (không trừ luỹ kế).
      const workedWeek = sumIso(days, weekStartIso, weekEndIso);
      const quotaWeek = sumIso(quotaDays, weekStartIso, weekEndIso);
      const deltaTotal = Math.round(Math.max(0, workedWeek - quotaWeek)*10)/10;
      const deltaNightTotal = Math.round(sumIso(nightDays, weekStartIso, weekEndIso)*10)/10;
      return { name: n, dept: e.dept, staffCode: e.staffCode || '', total: tot, nightTotal: nightTot, deltaTotal, deltaNightTotal };
    });
}

function updateSelects() {
  const depts = getAllDepts();
  const opts = '<option value="__all__">Tất cả phòng ban</option>' +
    depts.map(d => `<option value="${d}">${d}</option>`).join('');
  document.getElementById('deptFilterDash').innerHTML = opts;
  document.getElementById('deptSel').innerHTML = opts;
  const empDF = document.getElementById('empDeptFilter');
  if (empDF) empDF.innerHTML = opts;
  const keys = Object.keys(DB).sort();
  const mOpts = keys.map(mk => `<option value="${mk}" title="${fmtCompanyMK(mk)}">${fmtMK(mk)}</option>`).join('');
  document.getElementById('deptMonthSel').innerHTML = mOpts || '<option>Chưa có dữ liệu</option>';
  if (activeMK && keys.includes(activeMK))
    document.getElementById('deptMonthSel').value = activeMK;
}

// Parse "H:MM" or "HH:MM" time string -> minutes since midnight. Returns null if invalid.
function timeToMinutes(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    // Excel time fraction (0..1) or full datetime serial
    const frac = val % 1;
    return Math.round(frac * 24 * 60);
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1],10)*60 + parseInt(m[2],10);
}

// ── Danh sách ngày nghỉ lễ/Tết do công ty ban hành (theo lịch nghỉ chính thức 2026) ──
// Cập nhật mỗi năm theo thông báo lịch nghỉ mới của công ty. Vào các ngày này,
// OT được tính từ 8:00 sáng (toàn bộ thời gian làm việc được xem là OT theo quy định).
// Lưu ý: các ngày Chủ nhật chỉ ghi chú "Weekend day" (nghỉ tuần bình thường, không phải
// ngày nghỉ lễ riêng) KHÔNG đưa vào danh sách này — vẫn áp dụng quy tắc CN thông thường (cutoff 17:00).
const VN_HOLIDAYS = new Set([
  // 2026 — theo lịch nghỉ lễ/Tết công ty ban hành
  '2026-01-01', // Thu — Tết Dương lịch (Calendar New Year)
  '2026-02-14', // Sat — 27th Lunar New Year (*)
  '2026-02-16', // Mon — 29th Lunar New Year, ngày nghỉ bù do Tết trùng thứ 7 1/2/2025 (*)
  '2026-02-17', // Tue — Mùng 1 Tết
  '2026-02-18', // Wed — Mùng 2 Tết
  '2026-02-19', // Thu — Mùng 3 Tết
  '2026-02-20', // Fri — Mùng 4 Tết
  '2026-02-21', // Sat — 5th Lunar New Year (*)
  '2026-04-25', // Sat (*)
  '2026-04-27', // Mon — nghỉ bù Giỗ Tổ Hùng Vương (trùng CN 26/4)
  '2026-04-30', // Thu — Ngày Chiến thắng (Victory Day)
  '2026-05-01', // Fri — Quốc tế Lao động (Labor Day)
  '2026-05-02', // Sat (*)
  '2026-09-01', // Tue — Quốc khánh (Independence Day)
  '2026-09-02', // Wed — Quốc khánh (Independence Day, 2 ngày theo Luật LĐ 2019)
]);
function isVNHoliday(iso) { return !!iso && VN_HOLIDAYS.has(iso); }

// ============================================================
//  CÔNG THỨC TÍNH OT — theo đúng file Excel VBA (macro WT2 / New_Over_Hour) do công ty dùng trước đây.
//  OT (cả kỳ) = MAX(0, Tổng giờ ĐÃ LÀM trong kỳ − Tổng giờ TIÊU CHUẨN trong kỳ)
//  Đây là công thức TỔNG HỢP (không phải "quá X giờ mỗi ngày mới tính OT" như bản cũ) — mỗi ngày chỉ
//  đóng góp "giờ đã làm" (đã trừ giờ nghỉ trưa 12h-13h) và "giờ tiêu chuẩn" (8h/4h/0h theo loại ngày),
//  OT thực sự chỉ lộ ra ở phần CHÊNH LỆCH cộng dồn cả kỳ.
// ============================================================

// Làm tròn giờ (dạng phút) theo đúng cách file Excel: làm tròn LÊN 15 phút, rồi làm tròn XUỐNG 30 phút.
// Ví dụ: 7:32 → (làm tròn lên 15p) 7:45 → (làm tròn xuống 30p) 7:30.
function roundToHalfHourVBA(mins) {
  const upQuarter = Math.ceil(mins / 15) * 15;
  return Math.floor(upQuarter / 30) * 30;
}

// Tính "giờ đã làm" trong 1 ngày (đã trừ giờ nghỉ trưa 12h-13h, CÓ tính giờ đến sớm) + phần OT sau 22h (theo dõi riêng).
// Khớp CHÍNH XÁC với macro VBA gốc công ty dùng (WT2 / MD_Get_WTR_Weekly2025_04):
//   · Thiếu 1 TRONG 2 (thiếu giờ vào HOẶC thiếu giờ ra) → ngày đó đóng góp 0 GIỜ LÀM — KHÔNG có giả định
//     8:00/17:00 nào cả (macro gốc không hề làm việc này). Quota (8h/4h) của ngày đó vẫn được tính bình thường.
//   · Chỉ khi CÓ ĐỦ CẢ giờ vào và giờ ra mới tính giờ làm thực tế của ngày đó.
function computeDayWorked(inVal, outVal, iso) {
  const inM = timeToMinutes(inVal);
  const outM = timeToMinutes(outVal);
  if (inM === null || outM === null) return { worked: 0, night: 0 }; // thiếu 1 trong 2 → 0 giờ làm, đúng theo file gốc

  const inR = roundToHalfHourVBA(inM);
  const outR = roundToHalfHourVBA(outM);

  // Giờ đã làm = (giờ ra, tối đa 12h) − giờ vào  +  giờ ra − (13h hoặc giờ vào, cái nào muộn hơn)
  const morning = Math.max(0, Math.min(12 * 60, outR) - inR);
  const afternoon = Math.max(0, outR - Math.max(13 * 60, inR));
  const worked = (morning + afternoon) / 60;

  // OT sau 22h — chỉ để theo dõi riêng (không trừ/cộng vào công thức chính ở trên).
  const NIGHT_START = 22 * 60;
  const night = outR > NIGHT_START ? (outR - NIGHT_START) / 60 : 0;

  return { worked, night };
}

// Giờ tiêu chuẩn (quota) của 1 ngày theo loại ngày — LUÔN cộng dồn dù ngày đó có đi làm hay không
// (nghỉ không phép/không chấm công vẫn tính đủ giờ tiêu chuẩn, làm giảm OT tháng đó — đúng theo file gốc).
// NGOẠI LỆ đã sửa so với file gốc: ngày lễ/Tết được MIỄN quota (0h) — vì công thức gốc không làm việc
// này, khiến người NGHỈ đúng ngày lễ bị kéo tụt OT cả tháng một cách bất hợp lý (còn người VẪN ĐI LÀM
// ngày lễ thì không bị ảnh hưởng, vì giờ làm hôm đó vẫn được tính OT 100% như cũ — xem computeDayWorked).
function getDayQuota(iso) {
  if (isVNHoliday(iso)) return 0; // ngày lễ: miễn quota, dù rơi vào thứ mấy
  const dow = new Date(iso + 'T00:00:00').getDay(); // 0=CN, 6=T7
  if (dow === 0) return 0;   // Chủ nhật
  if (dow === 6) return 4;   // Thứ 7
  return 8;                  // Thứ 2 - Thứ 6
}

// Parse dd/mm/yyyy date string used in the checkin-out header row
function parseDDMMYYYY(s) {
  if (!s) return null;
  const str = String(s).trim();
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
}

// Detect & parse the "Bảng theo dõi chấm công" checkin-out timesheet format.
// Returns true if handled, false if format not recognized.
function tryParseCheckinOutFormat(ws) {
  const aoa = XLSX.utils.sheet_to_json(ws, {header:1, raw:true, defval:null});
  if (aoa.length < 5) return false;

  // Header rows: row index 1 = column titles, row index 2 = dates, row index 3 = In/Out labels
  const titleRow = aoa[1] || [];
  const dateRow  = aoa[2] || [];
  const inOutRow = aoa[3] || [];

  // Find required columns by header name
  const nameCol  = titleRow.findIndex(c => /họ tên|ho ten|name/i.test(String(c||'')));
  const deptCol  = titleRow.findIndex(c => /phòng\/?ban|phong ban|department|dept/i.test(String(c||'')));
  const codeCol  = titleRow.findIndex(c => /staff\s*code|employee\s*(id|code)|emp\s*(id|code)|mã\s*nv\b|mã\s*nh[âa]n\s*vi[êe]n|ma\s*nv\b|ma\s*nhan\s*vien|msnv|staff\s*id/i.test(String(c||'')));
  if (nameCol < 0 || deptCol < 0) return false;

  // Find the starting column of the date grid (first column with a dd/mm/yyyy value in dateRow)
  let dateStart = -1;
  for (let c = 0; c < dateRow.length; c++) {
    if (parseDDMMYYYY(dateRow[c])) { dateStart = c; break; }
  }
  if (dateStart < 0) return false;

  // Only include these HCM departments
  const ALLOWED_DEPTS = new Set(['HCM-EC','S-AD','S-ED','S-QC','S-PU','S-PD','S-AZ']);

  // Build list of {inCol, outCol, isoDate, monthKey} for each "In" column (pairs In/Out)
  const dayCols = [];
  for (let c = dateStart; c < dateRow.length; c++) {
    const d = parseDDMMYYYY(dateRow[c]);
    if (!d) continue;
    const label = String(inOutRow[c] || '').trim().toLowerCase();
    if (label !== 'in') continue; // only anchor on "In" columns; Out is c+1
    dayCols.push({ inCol:c, outCol:c+1, iso:isoDate(d), monthKey:companyMonthKeyOf(d) });
  }
  if (!dayCols.length) return false;

  let cnt = 0;
  const months = new Set();
  const monthMaxIso = {}; // mk -> max iso date seen in this upload
  const lateMonths = new Set(); // mk -> months touched by auto-derived late tracking

  for (let r = 4; r < aoa.length; r++) {
    const row = aoa[r];
    if (!row) continue;
    const name = row[nameCol];
    if (!name || !String(name).trim()) continue;
    const dept = String(row[deptCol] || 'Chưa phân loại').trim();
    if (!ALLOWED_DEPTS.has(dept)) continue;
    const staffCode = codeCol >= 0 ? String(row[codeCol] || '').trim() : '';

    dayCols.forEach(dc => {
      const wResult = computeDayWorked(row[dc.inCol], row[dc.outCol], dc.iso);
      const quota = getDayQuota(dc.iso);
      const mk = dc.monthKey;
      if (!DB[mk]) DB[mk] = { employees:{}, names:[], depts:{}, snapshots:[] };
      if (!DB[mk].employees[name]) {
        DB[mk].employees[name] = { days:{}, quotaDays:{}, nightDays:{}, dept, staffCode };
        DB[mk].names.push(name);
      }
      if (staffCode) DB[mk].employees[name].staffCode = staffCode;
      if (!DB[mk].employees[name].nightDays) DB[mk].employees[name].nightDays = {};
      if (!DB[mk].employees[name].quotaDays) DB[mk].employees[name].quotaDays = {};
      // days[iso] giờ lưu GIỜ ĐÃ LÀM trong ngày (không phải OT trực tiếp nữa) — OT = tổng giờ làm − tổng quota cả kỳ.
      if (wResult.worked > 0) {
        DB[mk].employees[name].days[dc.iso] = Math.round(wResult.worked*100)/100;
        cnt++;
      } else {
        delete DB[mk].employees[name].days[dc.iso];
      }
      // Quota luôn được ghi nhận (kể cả ngày không đi làm) — đúng theo công thức gốc.
      DB[mk].employees[name].quotaDays[dc.iso] = quota;
      if (wResult.night > 0) {
        DB[mk].employees[name].nightDays[dc.iso] = Math.round(wResult.night*100)/100;
      } else {
        delete DB[mk].employees[name].nightDays[dc.iso];
      }
      DB[mk].employees[name].dept = dept;
      if (!DB[mk].depts[dept]) DB[mk].depts[dept] = [];
      if (!DB[mk].depts[dept].includes(name)) DB[mk].depts[dept].push(name);
      months.add(mk);
      if (!monthMaxIso[mk] || dc.iso > monthMaxIso[mk]) monthMaxIso[mk] = dc.iso;

      // Auto-derive "đi trễ" (late arrival) from the same In/Out columns — no separate upload needed.
      // CHỈ áp dụng Thứ 2 - Thứ 6 (Sat/Sun không tính đi trễ, kể cả nếu có giờ chấm công hôm đó).
      const dowForLate = new Date(dc.iso + 'T00:00:00').getDay(); // 0=CN, 6=T7
      const isWeekdayForLate = dowForLate >= 1 && dowForLate <= 5;
      if (typeof LATE_ALLOWED_DEPTS !== 'undefined' && LATE_ALLOWED_DEPTS.has(dept) && isWeekdayForLate) {
        const lateM = computeLateMinutes(row[dc.inCol]);
        if (!LATE_DB[mk]) LATE_DB[mk] = { employees:{}, names:[], depts:{} };
        if (!LATE_DB[mk].employees[name]) {
          LATE_DB[mk].employees[name] = { days:{}, dept, code: staffCode };
          LATE_DB[mk].names.push(name);
        }
        if (lateM > 0) LATE_DB[mk].employees[name].days[dc.iso] = lateM;
        else delete LATE_DB[mk].employees[name].days[dc.iso];
        LATE_DB[mk].employees[name].dept = dept;
        if (staffCode) LATE_DB[mk].employees[name].code = staffCode;
        if (!LATE_DB[mk].depts[dept]) LATE_DB[mk].depts[dept] = [];
        if (!LATE_DB[mk].depts[dept].includes(name)) LATE_DB[mk].depts[dept].push(name);
        lateMonths.add(mk);
      } else if (typeof LATE_ALLOWED_DEPTS !== 'undefined' && LATE_ALLOWED_DEPTS.has(dept) && !isWeekdayForLate) {
        // Đảm bảo dữ liệu cũ (nếu re-upload đè lên) không còn sót ngày cuối tuần bị ghi nhận nhầm trước đây.
        if (LATE_DB[mk] && LATE_DB[mk].employees[name]) delete LATE_DB[mk].employees[name].days[dc.iso];
      }
    });
  }

  if (!months.size) return false;

  // Record a snapshot marker = the latest date covered by this upload, per month
  months.forEach(mk => {
    if (!DB[mk].snapshots) DB[mk].snapshots = [];
    const maxIso = monthMaxIso[mk];
    if (maxIso && !DB[mk].snapshots.includes(maxIso)) {
      DB[mk].snapshots.push(maxIso);
      DB[mk].snapshots.sort();
    }
  });

  return { ok:true, cnt, months, lateMonths };
}

// ============================================================
//  FILE HANDLING
// ============================================================
function readFileAsBinary(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('read error'));
    reader.readAsBinaryString(file);
  });
}

// Fallback parser: simple format with Tên NV / Phòng Ban / Ngày / Giờ OT columns.
// No side effects — just mutates DB and returns a summary, same contract as tryParseCheckinOutFormat.
function tryParseSimpleFormat(ws) {
  const rows = XLSX.utils.sheet_to_json(ws);
  let cnt = 0;
  const months = new Set();
  const monthMaxIso = {};
  rows.forEach(row => {
    const vals = Object.values(row);
    const name = row['Tên NV'] || row['Ho ten'] || row['Name'] || vals[0];
    const dept = String(row['Phòng Ban'] || row['Phong Ban'] || row['Department'] || row['Dept'] || 'Chưa phân loại').trim();
    const date = row['Ngày'] || row['Date'] || vals[2] || vals[1];
    const ot   = parseFloat(row['Giờ OT'] || row['OT'] || row['Hours'] || vals[3]) || 0;
    const sc   = String(row['Staff Code'] || row['StaffCode'] || row['Mã NV'] || row['Mã nhân viên'] || row['Ma nhan vien'] || row['MSNV'] || '').trim();
    if (!name || !date) return;
    const mk = companyMonthKeyOf(date); if (!mk) return;
    const iso = isoDateOf(date); if (!iso) return;
    if (!DB[mk]) DB[mk] = { employees:{}, names:[], depts:{}, snapshots:[] };
    if (!DB[mk].employees[name]) {
      DB[mk].employees[name] = { days:{}, dept, staffCode: sc };
      DB[mk].names.push(name);
    }
    if (sc) DB[mk].employees[name].staffCode = sc;
    DB[mk].employees[name].days[iso] = (DB[mk].employees[name].days[iso] || 0) + ot;
    DB[mk].employees[name].dept = dept;
    if (!DB[mk].depts[dept]) DB[mk].depts[dept] = [];
    if (!DB[mk].depts[dept].includes(name)) DB[mk].depts[dept].push(name);
    cnt++; months.add(mk);
    if (!monthMaxIso[mk] || iso > monthMaxIso[mk]) monthMaxIso[mk] = iso;
  });
  if (!cnt) return false;
  months.forEach(mk => {
    if (!DB[mk].snapshots) DB[mk].snapshots = [];
    const maxIso = monthMaxIso[mk];
    if (maxIso && !DB[mk].snapshots.includes(maxIso)) {
      DB[mk].snapshots.push(maxIso);
      DB[mk].snapshots.sort();
    }
  });
  return { ok:true, cnt, months, lateMonths: new Set() };
}

// Process one file's binary content → returns {fileName, ok, cnt, months, lateMonths, error}
function processOneFile(fileName, binaryStr) {
  try {
    const wb = XLSX.read(binaryStr, {type:'binary'});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const r1 = tryParseCheckinOutFormat(ws);
    if (r1) return { fileName, ...r1 };
    const r2 = tryParseSimpleFormat(ws);
    if (r2) return { fileName, ...r2 };
    return { fileName, ok:false, error:'Không đọc được dữ liệu — kiểm tra định dạng cột' };
  } catch (err) {
    return { fileName, ok:false, error:'Lỗi đọc file' };
  }
}

// Handle one or many files selected at once. Each file is parsed and merged into DB
// sequentially; UI/storage is saved once at the end with a combined summary.
async function handleFile(inp) {
  const files = Array.from(inp.files || []);
  if (!files.length) return;

  const results = [];
  for (const file of files) {
    try {
      const bin = await readFileAsBinary(file);
      results.push(processOneFile(file.name, bin));
    } catch (err) {
      results.push({ fileName: file.name, ok:false, error:'Lỗi đọc file' });
    }
  }
  inp.value = '';

  const okResults = results.filter(r => r.ok);
  const failResults = results.filter(r => !r.ok);

  if (!okResults.length) {
    toast(files.length > 1 ? 'Không file nào đọc được dữ liệu' : 'Lỗi đọc file.');
    document.getElementById('upLog').textContent =
      failResults.map(r => `${r.fileName}: ${r.error}`).join(' · ');
    return;
  }

  const allMonths = new Set();
  const allLateMonths = new Set();
  let totalCnt = 0;
  okResults.forEach(r => {
    r.months.forEach(mk => allMonths.add(mk));
    (r.lateMonths || new Set()).forEach(mk => allLateMonths.add(mk));
    totalCnt += r.cnt;
  });

  const mArr = [...allMonths].sort();
  if (mArr.length) {
    activeMK = mArr[mArr.length-1];
    activePeriod = (DB[activeMK].snapshots||[]).length - 1;
  }
  saveDB(); rebuildUI();
  // WLB dùng dữ liệu OT để tính → cập nhật luôn khi upload OT mới
  if (document.getElementById('pg-wlb')?.classList.contains('show')) renderWlb();
  else renderWlbSummary();

  if (allLateMonths.size) {
    const lateArr = [...allLateMonths].sort();
    activeLateMK = lateArr[lateArr.length-1];
    saveLateDB(); rebuildLateUI();
  }

  const summaryParts = [
    `Đã xử lý ${okResults.length}/${files.length} file`,
    `${totalCnt} dòng/ngày có OT`,
    `${mArr.length} tháng: ${mArr.map(fmtMK).join(', ')}`
  ];
  if (allLateMonths.size) summaryParts.push('Đã tự động cập nhật dữ liệu Đi trễ');
  if (failResults.length) summaryParts.push(`Lỗi: ${failResults.map(r=>r.fileName).join(', ')}`);
  document.getElementById('upLog').textContent = summaryParts.join(' · ');
  toast(failResults.length ? `Upload xong, ${failResults.length} file lỗi` : 'Upload thành công!');
}

function loadDemo() {
  const now = new Date();
  // month keys ending at current/prev/prev-prev company months
  const months = [-2,-1,0].map(o => {
    const d = new Date(now.getFullYear(), now.getMonth()+o, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const depts = {
    'Kỹ thuật':  ['Nguyễn Văn An','Trần Thị Bảo','Lê Văn Cường'],
    'Marketing': ['Phạm Thị Dung','Hoàng Minh Em'],
    'Kinh doanh':['Đỗ Thị Phương','Ngô Văn Giang','Vũ Thị Hoa'],
    'Hành chính':['Đặng Văn Inh','Bùi Thị Khánh']
  };
  // approximate weekly totals to spread across each segment's working days
  const base = {
    'Nguyễn Văn An':[18,20,22,15], 'Trần Thị Bảo':[12,14,10,8],  'Lê Văn Cường':[20,22,25,18],
    'Phạm Thị Dung':[16,18,20,14], 'Hoàng Minh Em':[8,10,9,7],
    'Đỗ Thị Phương':[14,16,18,12], 'Ngô Văn Giang':[22,20,24,20], 'Vũ Thị Hoa':[10,12,11,9],
    'Đặng Văn Inh':[6,8,7,5],      'Bùi Thị Khánh':[8,9,8,6]
  };

  months.forEach((mk, mi) => {
    DB[mk] = { employees:{}, names:[], depts:{} };
    // cycle start = 16th of previous calendar month relative to mk's month
    const [y,m] = mk.split('-').map(Number);
    let startMonth = m-1, startYear = y;
    if (startMonth < 1) { startMonth = 12; startYear--; }
    const cycleStart = new Date(startYear, startMonth-1, 16);

    Object.entries(depts).forEach(([dept, nvs]) => {
      DB[mk].depts[dept] = [];
      nvs.forEach(name => {
        const days = {};
        const weekTotals = base[name].map(h => Math.max(0, h + Math.round((Math.random()-.5)*4*(mi+1))));
        // distribute each weekly total across ~5 working days within that 7-day segment
        for (let seg = 0; seg < 4; seg++) {
          const segStart = new Date(cycleStart);
          segStart.setDate(segStart.getDate() + seg*7);
          const wt = weekTotals[seg];
          const perDay = wt / 5;
          for (let d = 0; d < 5; d++) {
            const dt = new Date(segStart);
            dt.setDate(dt.getDate() + d);
            const variance = perDay * (0.6 + Math.random()*0.8);
            if (variance > 0.05) days[isoDate(dt)] = Math.round(variance*10)/10;
          }
        }
        DB[mk].employees[name] = { days, dept };
        DB[mk].names.push(name);
        DB[mk].depts[dept].push(name);
      });
    });
  });
  activeMK = months[months.length-1]; activePeriod = null;
  saveDB(); rebuildUI();
  toast('Đã tải dữ liệu mẫu!');
}

function deleteMonth(mk) {
  if (!requireAdmin('xoá dữ liệu tháng')) return;
  if (!confirm(`Xóa dữ liệu ${fmtMK(mk)}?`)) return;
  delete DB[mk];
  const ks = Object.keys(DB).sort();
  activeMK = ks.length ? ks[ks.length-1] : null;
  saveDB(); rebuildUI(); renderSavedMonths(); renderWlbSummary();
  if (document.getElementById('pg-wlb')?.classList.contains('show')) renderWlb();
  toast(`Đã xóa ${fmtMK(mk)}`);
}

function clearAll() {
  if (!requireAdmin('xoá toàn bộ dữ liệu OT')) return;
  if (!confirm('Xóa TOÀN BỘ dữ liệu OT? Không thể khôi phục!')) return;
  DB = {}; activeMK = null;
  saveDB(); rebuildUI(); renderSavedMonths(); renderWlbSummary();
  document.getElementById('upLog').textContent = 'Đã xóa toàn bộ dữ liệu.';
  toast('Đã xóa toàn bộ dữ liệu OT');
}

function rebuildUI() { updateSelects(); renderDash(); renderEmployeeList(); }

// ============================================================
//  DASHBOARD
// ============================================================
function renderMonthChips() {
  const keys = Object.keys(DB).sort();
  const el = document.getElementById('monthDashSel');
  if (!keys.length) { el.innerHTML = '<option>Chưa có dữ liệu</option>'; return; }
  if (!activeMK || !DB[activeMK]) activeMK = keys[keys.length-1];
  el.innerHTML = keys.map(mk =>
    `<option value="${mk}" title="${fmtCompanyMK(mk)}" ${mk===activeMK?'selected':''}>${fmtMK(mk)}</option>`
  ).join('');
}
function setActiveMK(mk) { activeMK = mk; activePeriod = null; renderDash(); }

function renderPeriodChips() {
  const el = document.getElementById('periodChips');
  if (!activeMK || !DB[activeMK]) { el.innerHTML = ''; return; }
  const periods = buildPeriods(activeMK);
  if (!periods.length) { el.innerHTML = '<span style="font-size:12px;color:var(--text2)">Chưa có dữ liệu</span>'; return; }
  if (activePeriod === null || activePeriod >= periods.length) activePeriod = periods.length - 1;
  el.innerHTML = periods.map((p,i) => `
    <button class="chip ${i===activePeriod?'active':''}" onclick="setActivePeriod(${i})">${p.label}</button>
  `).join('');
}
function setActivePeriod(i) { activePeriod = i; renderDash(); }

function renderDash() {
  renderMonthChips();
  // Show/hide period chips based on tab
  document.getElementById('dashWeekBar').style.display = dashTab==='week' ? 'flex' : 'none';
  document.getElementById('dashTabWeek').classList.toggle('active',  dashTab==='week');
  document.getElementById('dashTabMonth').classList.toggle('active', dashTab==='month');

  if (dashTab === 'week') renderPeriodChips();

  if (!activeMK || !DB[activeMK]) {
    document.getElementById('dashMetrics').innerHTML =
      '<div style="grid-column:1/-1;font-size:13px;color:var(--text2);padding:16px 0">Chưa có dữ liệu. Vào tab <strong>Upload</strong> để bắt đầu.</div>';
    ['cBar','cDashLimitPct'].forEach(killChart);
    document.getElementById('dtHead').innerHTML = '';
    document.getElementById('dtBody').innerHTML = '';
    const dwl = document.getElementById('dashWarnList');
    if (dwl) dwl.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:14px;color:var(--text2)">Chưa có dữ liệu.</td></tr>';
    const now0 = new Date();
    document.getElementById('greetTitle').textContent = greetText();
    document.getElementById('greetSub').textContent = 'Chưa có dữ liệu OT — upload file chấm công để bắt đầu. / No OT data yet.';
    const wd0 = ['Chủ nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
    document.getElementById('greetDate').textContent =
      `📅 ${wd0[now0.getDay()]}, ${String(now0.getDate()).padStart(2,'0')}/${String(now0.getMonth()+1).padStart(2,'0')}/${now0.getFullYear()}`;
    return;
  }
  const df = document.getElementById('deptFilterDash').value;
  const periods = buildPeriods(activeMK);

  // In month mode: always use last period (Week 4) & show CUMULATIVE (luỹ kế đủ tháng).
  // In week mode: show CHỈ RIÊNG tuần đang xem (không cộng dồn từ ngày 16).
  const periodIdx = dashTab==='month' ? periods.length-1 : activePeriod;
  let totals = getTotals(activeMK, df, periodIdx);
  if (dashTab === 'week') totals = applyWeekDelta(totals);
  const tots = totals.map(t => t.total);
  const over = totals.filter(t => t.total > 70).length;
  const nightNV = totals.filter(t => (t.nightTotal||0) > 0).length;
  const nightTotalSum = Math.round(totals.reduce((s,t)=>s+(t.nightTotal||0),0)*10)/10;
  const avg  = tots.length ? Math.round(tots.reduce((a,b)=>a+b,0)/tots.length) : 0;
  const mx   = tots.length ? Math.max(...tots) : 0;
  const mxNV = nvLabel(totals.find(t => t.total === mx)) || '—';
  const lastPeriod = periods[periods.length-1];
  const periodLabel = dashTab==='month'
    ? `${lastPeriod ? lastPeriod.label.split(' · ')[0] : 'Week 4'} — ${fmtMK(activeMK)}`
    : (periods[periodIdx] ? periods[periodIdx].label : '');
  const periodSubLabel = dashTab==='month' ? fmtCompanyMK(activeMK) : periodLabel;

  const isWeek = dashTab === 'week';
  const overKpiWeek = totals.filter(t => t.total > 45).length;
  document.getElementById('dashMetrics').innerHTML = isWeek ? `
    <div class="mc"><div class="mic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg></div><div class="ml">Nhân viên</div><div class="mv">${totals.length}</div><div class="ms">đang theo dõi</div></div>
    <div class="mc ${overKpiWeek>0?'amber':''}"><div class="mic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><div class="ml">NV OT trong tuần &gt; 45h</div><div class="mv">${overKpiWeek}</div><div class="ms">vượt giới hạn KPI</div></div>
    <div class="mc ${nightNV>0?'amber':''}"><div class="mic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg></div><div class="ml">OT sau 22h trong tuần</div><div class="mv">${nightNV}</div><div class="ms">NV · tổng ${nightTotalSum}h</div></div>
    <div class="mc"><div class="mic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div><div class="ml">OT TB trong tuần</div><div class="mv">${avg}h</div><div class="ms">${periodSubLabel}</div></div>
    <div class="mc ${stOf(mx)==='d'?'red':''}"><div class="mic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div><div class="ml">NV có OT cao nhất trong tuần</div><div class="mv">${mx}h</div><div class="ms">${mxNV}</div></div>` : `
    <div class="mc"><div class="mic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg></div><div class="ml">Nhân viên</div><div class="mv">${totals.length}</div><div class="ms">đang theo dõi</div></div>
    <div class="mc red"><div class="mic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div><div class="ml">Vượt 70h</div><div class="mv">${over}</div><div class="ms">cần xem lại</div></div>
    <div class="mc ${nightNV>0?'amber':''}"><div class="mic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg></div><div class="ml">OT sau 22h</div><div class="mv">${nightNV}</div><div class="ms">NV · tổng ${nightTotalSum}h</div></div>
    <div class="mc"><div class="mic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div><div class="ml">OT trung bình</div><div class="mv">${avg}h</div><div class="ms">${periodSubLabel}</div></div>
    <div class="mc ${stOf(mx)==='d'?'red':''}"><div class="mic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div><div class="ml">Cao nhất</div><div class="mv">${mx}h</div><div class="ms">${mxNV}</div></div>`;

  // Greeting header
  const now = new Date();
  document.getElementById('greetTitle').textContent = greetText();
  document.getElementById('greetSub').innerHTML = isWeek
    ? `${totals.length} NV đang theo dõi · <strong style="color:var(--amber)">${nightNV} NV có OT sau 22h</strong> trong tuần này <span style="color:var(--text3)">/ ${totals.length} tracked · ${nightNV} night OT this week</span>`
    : `<strong style="color:var(--red)">${over} NV vượt mức</strong> · <strong style="color:var(--amber)">${nightNV} NV có OT sau 22h</strong> · ${totals.length} đang theo dõi <span style="color:var(--text3)">/ ${over} over limit · ${nightNV} night OT · ${totals.length} tracked</span>`;
  const weekdayNames = ['Chủ nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
  document.getElementById('greetDate').textContent =
    `📅 ${weekdayNames[now.getDay()]}, ${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;

  document.getElementById('barChartTitle').textContent = dashTab === 'month'
    ? `📊 Tổng OT cả tháng — ${fmtMK(activeMK)}`
    : `📊 Top 5 NV có OT cao nhất — ${periodLabel}`;
  const barLegendEl = document.getElementById('dashBarLegend');
  if (barLegendEl) barLegendEl.style.display = dashTab === 'month' ? 'flex' : 'none';

  if (dashTab === 'month') renderMonthDonut(totals);
  else renderBarChart(totals, true);

  const limitCard = document.getElementById('dashLimitPctCard');
  if (dashTab === 'week') {
    if (limitCard) limitCard.style.display = 'block';
    renderDashLimitPctChart(totals, periodLabel);
  } else {
    if (limitCard) limitCard.style.display = 'none';
    killChart('cDashLimitPct');
  }

  renderDashDeptLineChart();
  renderDashWarnList(totals);
  renderNightOtFreqChart(df, periodIdx);
  renderDashOverBarChart(totals);
  renderDashProjectBarChart(totals);
}

// Biểu đồ gộp (thay cho "Top 8 NV" cũ) — % Giới hạn KPI (45h) và % Giới hạn Chi trả (70h) trong
// CÙNG 1 biểu đồ (2 cột cạnh nhau mỗi NV), tính trên TỔNG LŨY KẾ từ ngày 16 đến hết tuần đang
// xem (t.cumulativeTotal) — KHÔNG phải chỉ riêng OT phát sinh trong tuần đó — theo đúng yêu cầu.
function renderDashLimitPctChart(totals, periodLabel) {
  const lbl = document.getElementById('dashLimitPctLabel');
  if (lbl) lbl.textContent = periodLabel || '';
  const emptyEl = document.getElementById('cDashLimitPctEmpty');
  const canvasEl = document.getElementById('cDashLimitPct');
  // CHỈ hiện NV đã vượt mức 45h (cả 2 mức "Vượt mức 45" và "Vượt mức") — không còn là biểu đồ
  // "top 15 bất kỳ" như trước, vì mục đích giờ là liệt kê rõ TOÀN BỘ người vượt để dễ theo dõi.
  const rows = totals.filter(t => (t.cumulativeTotal||0) > 45)
    .map(t => ({ name: t.name, cum: t.cumulativeTotal||0 }))
    .sort((a,b) => b.cum - a.cum);

  killChart('cDashLimitPct');
  if (!rows.length) {
    if (emptyEl) emptyEl.style.display = 'block';
    if (canvasEl) canvasEl.style.display = 'none';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  if (canvasEl) canvasEl.style.display = 'block';
  // Biểu đồ CỘT DỌC (không phải nằm ngang nữa) — vì số lượng NV vượt mức có thể rất nhiều, cho
  // canvas rộng theo số lượng + cuộn ngang, thay vì kéo dài mãi xuống dưới như bản nằm ngang cũ.
  const wrapEl = canvasEl.parentElement;
  const scrollWrap = wrapEl.parentElement; // .chart-hscroll
  const barW = Math.max(scrollWrap ? scrollWrap.clientWidth || 700 : 700, rows.length * 46 + 60);
  wrapEl.style.width = barW + 'px';
  wrapEl.style.height = '380px';
  // Hiện đúng SỐ GIỜ luỹ kế (không phải %) — tô màu theo mốc đã vượt: cam (Vượt mức 45, 45-70h),
  // đỏ (Vượt mức, >70h).
  const colorFor = h => h > 70 ? '#C0392B' : '#E8A33D';
  safeMakeChart(CH, killChart, 'cDashLimitPct', canvasEl, {
    type: 'bar',
    data: { labels: rows.map(r=>r.name),
      datasets: [
        { label:'Tổng OT luỹ kế (h)', data: rows.map(r=>r.cum), backgroundColor: rows.map(r=>colorFor(r.cum)), borderWidth:0, borderRadius:4, maxBarThickness:34 }
      ] },
    options: { responsive:true, maintainAspectRatio:false,
      layout:{ padding:{ top:22, right:8, bottom:4, left:4 } },
      plugins:{ legend:{display:false}, barValueLabels:{ suffix:'h' },
        tooltip:{ callbacks:{ label:c=>{
          const h = c.raw;
          const note = h>70 ? ' — vượt mức Chi trả (70h)' : ' — vượt mức KPI (45h)';
          return ` ${h}h${note}`;
        } } } },
      scales:{
        x:{ grid:{display:false}, ticks:{font:{size:10.5}, maxRotation:60, minRotation:60, autoSkip:false} },
        y:{ grid:{color:'rgba(128,128,128,0.12)'}, ticks:{font:{size:10}},
            suggestedMax: Math.ceil(Math.max(45,70, ...rows.map(r=>r.cum)) * 1.15) } }
    }
  });
}

// Biểu đồ cột ngang: Nhân viên vượt mức (>70h) — chỉ hiện ở tab Theo tháng (lấy đúng danh sách
// từ khung "Vượt mức" bên cạnh, vẽ dạng cột cho dễ so sánh giữa nhiều người cùng lúc).
function renderDashOverBarChart(totals) {
  const card = document.getElementById('dashOverBarCard');
  const emptyEl = document.getElementById('dashOverBarEmpty');
  const canvasEl = document.getElementById('cDashOverBar');
  if (!card) return;

  if (dashTab !== 'month') {
    card.style.display = 'none';
    killChart('cDashOverBar');
    return;
  }
  card.style.display = 'block';

  const over = totals.filter(t => t.total > 70).sort((a,b) => b.total - a.total);
  killChart('cDashOverBar');

  if (!over.length) {
    if (emptyEl) emptyEl.style.display = 'block';
    if (canvasEl) canvasEl.style.display = 'none';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  if (canvasEl) canvasEl.style.display = 'block';

  const barH = Math.max(340, over.length * 26 + 60);
  canvasEl.parentElement.style.height = barH + 'px';
  CH['cDashOverBar'] = new Chart(canvasEl, {
    type: 'bar',
    data: { labels: over.map(t => nvLabel(t)),
      datasets: [{ data: over.map(t => t.total), backgroundColor: '#C0392B', borderWidth: 0, borderRadius: 3, label: 'Tổng OT (h)' }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      layout: { padding: { right: 40, top: 4, bottom: 4, left: 4 } },
      plugins: { legend: { display: false }, barValueLabels: { suffix: 'h' },
        tooltip: { callbacks: { label: c => ` ${c.raw}h · ${over[c.dataIndex]?.name}` } } },
      scales: {
        x: { grid: { color: 'rgba(128,128,128,0.12)' }, ticks: { font: { size: 10 } },
             suggestedMax: Math.ceil(Math.max(...over.map(t=>t.total)) * 1.15) },
        y: { grid: { display: false }, ticks: { font: { size: 10 } } } }
    }
  });
}

// Biểu đồ cột ngang: Tổng OT theo TỪNG DỰ ÁN (HCM-EC) — chỉ hiện ở tab Theo tháng. Dùng lại
// `totals` đã tính sẵn cho Dashboard (không tính lại), chỉ nhóm theo dự án qua PROJECTS_DB.
function renderDashProjectBarChart(totals) {
  const card = document.getElementById('dashProjectBarCard');
  const emptyEl = document.getElementById('dashProjectBarEmpty');
  const canvasEl = document.getElementById('cDashProjectBar');
  if (!card) return;

  if (dashTab !== 'month' || !PROJECTS_DB) {
    card.style.display = 'none';
    killChart('cDashProjectBar');
    return;
  }
  card.style.display = 'block';
  killChart('cDashProjectBar');

  // Gộp OT theo dự án — chỉ tính NV có staffCode đã được gán vào 1 dự án cụ thể trong PROJECTS_DB.
  const projTotals = {}; // "group/proj" -> tổng OT
  totals.forEach(t => {
    if (!t.staffCode) return;
    const info = findEmployeeProject(t.staffCode);
    if (!info) return;
    const key = `${info.group}/${info.proj.replace(/^HCM\s+/i,'')}`;
    if (!projTotals[key]) projTotals[key] = 0;
    projTotals[key] += t.total;
  });
  const entries = Object.entries(projTotals).map(([k,v]) => ({ key:k, total: Math.round(v*10)/10 }))
    .filter(e => e.total > 0).sort((a,b) => b.total - a.total);

  if (!entries.length) {
    if (emptyEl) emptyEl.style.display = 'block';
    if (canvasEl) canvasEl.style.display = 'none';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  if (canvasEl) canvasEl.style.display = 'block';

  const barH = Math.max(340, entries.length * 26 + 60);
  canvasEl.parentElement.style.height = barH + 'px';
  CH['cDashProjectBar'] = new Chart(canvasEl, {
    type: 'bar',
    data: { labels: entries.map(e => e.key),
      datasets: [{ data: entries.map(e => e.total), backgroundColor: '#2D6CDF', borderWidth: 0, borderRadius: 3, label: 'Tổng OT (h)' }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      layout: { padding: { right: 40, top: 4, bottom: 4, left: 4 } },
      plugins: { legend: { display: false }, barValueLabels: { suffix: 'h' },
        tooltip: { callbacks: { label: c => ` ${c.raw}h` } } },
      scales: {
        x: { grid: { color: 'rgba(128,128,128,0.12)' }, ticks: { font: { size: 10 } },
             suggestedMax: Math.ceil(Math.max(...entries.map(e=>e.total)) * 1.15) },
        y: { grid: { display: false }, ticks: { font: { size: 10 } } } },
      onClick: (evt, elements) => { if (elements.length) goPage('action'); }
    }
  });
}

// Đếm SỐ NGÀY mỗi nhân viên có phát sinh OT sau 22h, trong đúng khoảng thời gian (period) đang xem —
// dùng để vẽ biểu đồ tần suất OT khuya, giúp biết ai thường xuyên làm việc sau 22h (không chỉ 1-2 lần).
function getNightOtFrequency(mk, deptFilter, pIdx) {
  const m = DB[mk]; if (!m) return [];
  const periods = buildPeriods(mk);
  if (!periods.length) return [];
  const idx = (pIdx === null || pIdx === undefined || pIdx < 0 || pIdx >= periods.length) ? periods.length-1 : pIdx;
  const period = periods[idx];
  const startIso = isoDate(period.start), endIso = isoDate(period.end);
  return m.names
    .filter(n => deptFilter === '__all__' || m.employees[n]?.dept === deptFilter)
    .map(n => {
      const e = m.employees[n];
      const nightDays = e.nightDays || {};
      let count = 0, hours = 0;
      for (const iso in nightDays) {
        if (iso >= startIso && iso <= endIso) { count++; hours += nightDays[iso]; }
      }
      return { name: n, dept: e.dept, staffCode: e.staffCode || '', count, hours: Math.round(hours*10)/10 };
    })
    .filter(x => x.count > 0);
}

function renderNightOtFreqChart(deptFilter, periodIdx) {
  killChart('cNightOtFreq');
  const emptyEl = document.getElementById('nightOtEmpty');
  const canvasEl = document.getElementById('cNightOtFreq');
  if (!activeMK || !DB[activeMK]) { if (emptyEl) emptyEl.style.display='block'; if (canvasEl) canvasEl.style.display='none'; return; }
  const rows = getNightOtFrequency(activeMK, deptFilter, periodIdx).sort((a,b) => b.count - a.count).slice(0, 15);
  if (!rows.length) {
    if (emptyEl) emptyEl.style.display = 'block';
    if (canvasEl) canvasEl.style.display = 'none';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  if (canvasEl) canvasEl.style.display = 'block';
  CH['cNightOtFreq'] = new Chart(canvasEl, {
    type:'bar',
    data:{ labels: rows.map(r => nvLabel(r)),
           datasets:[{ data: rows.map(r=>r.count), backgroundColor:'#6B4FA0', borderWidth:0, borderRadius:4, label:'Số ngày OT sau 22h' }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
      layout:{ padding:{ right:36, top:4, bottom:4, left:4 } },
      plugins:{ legend:{display:false}, barValueLabels:{suffix:' ngày'},
        tooltip:{ callbacks:{ label:c => ` ${rows[c.dataIndex].count} ngày · tổng ${rows[c.dataIndex].hours}h` } } },
      scales:{
        x:{ grid:{color:'rgba(128,128,128,0.12)'}, ticks:{font:{size:11}, stepSize:1},
            suggestedMax: Math.ceil(Math.max(...rows.map(r=>r.count)) * 1.25) },
        y:{ grid:{display:false}, ticks:{font:{size:10}} }
      }}
  });
}

// Theo tháng: danh sách NV vượt mức (>70h). Theo tuần: Top 5 NV có OT cao nhất tuần đó
// (ngưỡng 70h là mốc THÁNG, không có ý nghĩa khi xem riêng 1 tuần).
function renderDashWarnList(totals) {
  const el = document.getElementById('dashWarnList');
  if (!el) return;
  const isWeek = dashTab === 'week';
  const titleEl = document.getElementById('dashWarnListTitle');
  if (titleEl) titleEl.textContent = isWeek ? 'Top 5 NV OT cao nhất tuần' : 'Vượt mức (>70h)';
  const flagged = isWeek
    ? [...totals].filter(t => t.total > 0).sort((a,b) => b.total - a.total).slice(0, 5)
    : totals.filter(t => t.total > 70).sort((a,b) => b.total - a.total);
  el.innerHTML = flagged.map(t => {
    const c = isWeek ? '#2D6CDF' : '#C0392B';
    return `<tr>
      <td style="font-family:var(--font-mono);font-size:11px;color:${c};font-weight:700">${t.staffCode||'—'}</td>
      <td style="font-weight:600;color:${c}">${t.name}${isWeek ? '' : ' <span class="late-dot" title="Vượt 70h OT"></span>'}</td>
      <td style="font-family:var(--font-mono);font-weight:700;color:${c}">${t.total}h</td>
    </tr>`;
  }).join('') || `<tr><td colspan="3" style="text-align:center;padding:14px;color:var(--text2)">${isWeek ? 'Chưa có dữ liệu OT trong tuần này' : 'Không có NV vượt mức trong kỳ này 🎉'}</td></tr>`;
}

// Biểu đồ line lên xuống: Tổng OT của từng phòng ban PHÁT SINH MỖI TUẦN (không luỹ kế)
// — để thấy rõ tuần nào tăng, tuần nào giảm, theo từng phòng ban trong tháng đang chọn.
function renderDashDeptLineChart() {
  killChart('cDashDeptLine');
  if (!activeMK || !DB[activeMK]) return;
  const periods = buildPeriods(activeMK);
  if (!periods.length) return;
  const allDepts = getAllDepts();
  const shortLabels = periods.map(p => `W${p.weekNum}`);

  document.getElementById('dashDeptLineLeg').innerHTML =
    allDepts.map((d,i)=>`<span><span class="ldot" style="background:${DEPT_COLORS[i%DEPT_COLORS.length]}"></span>${d}</span>`).join('');

  // Tổng OT PHÁT SINH RIÊNG mỗi tuần, theo phòng ban — dùng ĐÚNG field deltaTotal có sẵn trong
  // getTotals() (đã tính đúng, dùng chung khắp app) thay vì tự tính lại (cum[i]-cum[i-1]) ở đây,
  // để tránh 2 nơi tính ra 2 kết quả khác nhau cho cùng 1 tuần.
  const weeklyByDept = allDepts.map(d => periods.map((p,pi) => {
    const tots = getTotals(activeMK, d, pi).map(t=>t.deltaTotal);
    return Math.round((tots.length ? tots.reduce((a,b)=>a+b,0) : 0)*10)/10;
  }));

  CH['cDashDeptLine'] = new Chart(document.getElementById('cDashDeptLine'), {
    type:'line',
    data:{ labels: shortLabels, datasets: allDepts.map((d,i) => ({
      label: d,
      data: weeklyByDept[i],
      borderColor: DEPT_COLORS[i%DEPT_COLORS.length], backgroundColor:'transparent',
      tension:.35, borderWidth:2.5, pointRadius:5, pointHoverRadius:7, spanGaps:true
    })) },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false},
        tooltip:{ callbacks:{
          title: items => periods[items[0].dataIndex]?.label || '',
          label:c=>` ${c.dataset.label}: ${c.raw}h (tuần này)`
        } } },
      scales:{ x:{ grid:{display:false}, ticks:{font:{size:11}} },
               y:{ grid:{color:'rgba(128,128,128,0.12)'}, ticks:{font:{size:10}},
                   title:{display:true, text:'Tổng OT phát sinh trong tuần (h)', font:{size:10},
                     // Canvas KHÔNG hiểu cú pháp CSS "var(--xxx)" — phải resolve ra màu thật (hex) trước khi
                     // truyền vào Chart.js, nếu không plugin vẽ text/tiêu đề trục sẽ âm thầm lỗi (không throw,
                     // chỉ không vẽ được) — đây từng là nguyên nhân y hệt gây lỗi viền đen ở biểu đồ tròn trước đó.
                     color: getComputedStyle(document.documentElement).getPropertyValue('--text2').trim() || '#6B7280'
                   } } } }
  });
}

function renderBarChart(totals, showAll = false) {
  killChart('cBar');

  const chartEl = document.getElementById('cBar');
  const emptyEl = document.getElementById('cBarEmpty');

  // Theo tuần: CHỈ hiện Top 5 NV có OT cao nhất tuần đó (không liệt kê hết, tránh vỡ layout).
  const TOP_N = 5;
  const displayList = [...totals].sort((a,b) => b.total - a.total).slice(0, TOP_N);

  // Resize khung chart cho vừa đúng 5 cột (không để trống thừa / không bị bóp chữ).
  const chartWrap = chartEl ? chartEl.parentElement : null;
  if (chartWrap) chartWrap.style.height = '300px';

  if (!displayList.length) {
    if (chartEl) chartEl.style.display = 'none';
    if (!emptyEl) {
      const div = document.createElement('div');
      div.id = 'cBarEmpty';
      div.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;color:#5E7A4F;font-size:13px;font-weight:600;gap:8px;';
      div.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Không có dữ liệu';
      chartEl.parentNode.appendChild(div);
    } else { emptyEl.style.display = 'flex'; }
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  if (chartEl) chartEl.style.display = 'block';

  const cols = displayList.map(t => t.total > 70 ? '#C0392B' : '#7A9468');
  CH['cBar'] = new Chart(chartEl, {
    type:'bar',
    data:{
      labels: displayList.map(t => nvLabel(t)),
      datasets:[{
        data: displayList.map(t => t.total),
        backgroundColor: cols, borderWidth:0, borderRadius:4
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      layout:{ padding:{ top:24 } },
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:c=>` ${c.raw}h · ${displayList[c.dataIndex]?.name}`}},
        barValueLabels:{ suffix:'h' }
      },
      scales:{
        x:{grid:{display:false}, ticks:{font:{size:11},autoSkip:false,maxRotation:20}},
        y:{grid:{color:'rgba(128,128,128,0.12)'}, ticks:{font:{size:10}},
           min:0, max:Math.max(90, maxTot(displayList)+8)}
      }
    }
  });
}

// Donut chart: company-wide OT breakdown by status bucket (month mode).
// Each slice = total OT hours summed across employees in that bucket, with hours + % shown directly.
function renderMonthDonut(totals) {
  killChart('cBar');

  const chartEl = document.getElementById('cBar');
  const emptyEl = document.getElementById('cBarEmpty');
  if (chartEl && chartEl.parentElement) chartEl.parentElement.style.height = '420px';
  if (emptyEl) emptyEl.style.display = 'none';
  if (chartEl) chartEl.style.display = 'block';

  if (!totals.length) {
    if (chartEl) chartEl.style.display = 'none';
    if (!emptyEl) {
      const div = document.createElement('div');
      div.id = 'cBarEmpty';
      div.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;color:var(--text2);font-size:13px;font-weight:600;gap:8px;';
      div.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg> Không có dữ liệu';
      chartEl.parentNode.appendChild(div);
    } else { emptyEl.style.display = 'flex'; }
    return;
  }

  const groups = [
    { key:'o', label:'Bình thường ≤45h', color:'#7A9468' },
    { key:'w45', label:'Vượt mức 45 (45-70h)', color:'#E8A33D' },
    { key:'d', label:'Vượt mức (>70h)',          color:'#C0392B' }
  ];
  groups.forEach(g => { g.hours = 0; g.count = 0; });
  totals.forEach(t => {
    const g = groups.find(g => g.key === stOf(t.total));
    g.hours += t.total; g.count += 1;
  });
  groups.forEach(g => g.hours = Math.round(g.hours*10)/10);
  const grandTotal = Math.round(groups.reduce((a,g)=>a+g.hours,0)*10)/10;

  CH['cBar'] = new Chart(chartEl, {
    type:'doughnut',
    data:{
      labels: groups.map(g=>g.label),
      datasets:[{
        data: groups.map(g=>g.hours),
        backgroundColor: groups.map(g=>g.color),
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      cutout:'62%',
      layout:{ padding:{ top:55, bottom:25, left:75, right:75 } },
      plugins:{
        legend:{ display:false },
        tooltip:{ callbacks:{ label:c => {
          const g = groups[c.dataIndex];
          const pct = grandTotal ? Math.round(g.hours/grandTotal*1000)/10 : 0;
          return ` ${g.label}: ${g.hours}h (${pct}%) · ${g.count} NV`;
        }}},
        donutCenterText:{ total: grandTotal },
        donutSliceLabels:{ groups, grandTotal }
      }
    },
    plugins:[donutCenterTextPlugin, donutSliceLabelsPlugin]
  });
}

// Draws "Tổng OT" + total hours in the center of the donut
const donutCenterTextPlugin = {
  id:'donutCenterText',
  afterDraw(chart) {
    const opts = chart.options.plugins && chart.options.plugins.donutCenterText;
    if (!opts) return;
    const { ctx, chartArea:{left,right,top,bottom} } = chart;
    const cx = (left+right)/2, cy = (top+bottom)/2;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 22px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#1A1D29';
    ctx.fillText(`${opts.total}h`, cx, cy-9);
    ctx.font = '600 10.5px "Inter", sans-serif';
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text2').trim() || '#6B7280';
    ctx.fillText('TỔNG OT CÔNG TY', cx, cy+13);
    ctx.restore();
  }
};

// Draws "Xh (Y%)" labels next to each donut slice
const donutSliceLabelsPlugin = {
  id:'donutSliceLabels',
  afterDraw(chart) {
    const opts = chart.options.plugins && chart.options.plugins.donutSliceLabels;
    if (!opts) return;
    const { ctx, chartArea } = chart;
    const meta = chart.getDatasetMeta(0);
    const { groups, grandTotal } = opts;
    ctx.save();
    meta.data.forEach((arc, i) => {
      const g = groups[i];
      if (!g || g.hours <= 0) return;
      const pct = grandTotal ? Math.round(g.hours/grandTotal*1000)/10 : 0;
      const angle = (arc.startAngle + arc.endAngle) / 2;
      const r = (arc.outerRadius + 20);
      let x = arc.x + Math.cos(angle) * r;
      let y = arc.y + Math.sin(angle) * r;
      x = Math.min(Math.max(x, 36), chart.width - 36);
      y = Math.min(Math.max(y, 16), chart.height - 16);
      ctx.textAlign = x < arc.x ? 'right' : x > arc.x ? 'left' : 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 12px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillStyle = g.color;
      ctx.fillText(`${g.hours}h`, x, y-7);
      ctx.font = '500 10px "Inter", sans-serif';
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text2').trim() || '#6B7280';
      ctx.fillText(`${pct}% · ${g.count} NV`, x, y+7);
    });
    ctx.restore();
  }
};


// Hiển thị Top 8 NV cao nhất CHỈ trong tuần/mốc đang được chọn (không cộng dồn cả 4 tuần).
function renderTrendPeriodChart(deptFilter, periodIdx) {
  killChart('cTrendPeriod');
  if (!activeMK) return;
  const periods = buildPeriods(activeMK);
  if (!periods.length) return;
  if (periodIdx === undefined || periodIdx === null || periodIdx >= periods.length) periodIdx = periods.length - 1;

  const finalTotals = applyWeekDelta(getTotals(activeMK, deptFilter, periodIdx))
    .sort((a,b)=>b.total-a.total).slice(0,8);
  const legend = document.getElementById('trendLegend');
  legend.innerHTML = `<span style="color:var(--text2);font-weight:500">${periods[periodIdx]?.label || ''}</span>`;

  const data = finalTotals.map(t=>t.total);
  const cols = finalTotals.map(t => t.total>70?'#C0392B':'#7A9468');
  const maxVal = data.length ? Math.max(...data) : 80;
  CH['cTrendPeriod'] = new Chart(document.getElementById('cTrendPeriod'), {
    type:'bar',
    data:{ labels: finalTotals.map(t=>nvLabel(t)),
           datasets:[{data, backgroundColor:cols, borderWidth:0, borderRadius:4, label:'OT (h)'}]},
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
      layout:{ padding:{ right:44, top:10, bottom:4, left:4 } },
      plugins:{legend:{display:false}, barValueLabels:{suffix:'h'},
        tooltip:{callbacks:{label:c=>` ${c.raw}h`}}},
      scales:{
        x:{ grid:{color:'rgba(128,128,128,0.12)'}, ticks:{font:{size:11}},
            suggestedMax: Math.ceil(maxVal * 1.22) },
        y:{ grid:{display:false}, ticks:{font:{size:10}, padding:6} }
      }}
  });
}

function renderDashTable(totals, periods) {
  const fs = document.getElementById('stFilter')?.value || 'all';
  const q  = (document.getElementById('nvSearch')?.value || '').toLowerCase();
  if (!totals) {
    const df = document.getElementById('deptFilterDash')?.value || '__all__';
    totals = getTotals(activeMK, df, activePeriod);
  }
  if (!periods) periods = activeMK ? buildPeriods(activeMK) : [];
  const rows = totals.filter(t => {
    if (fs !== 'all' && stOf(t.total) !== fs) return false;
    if (q && !t.name.toLowerCase().includes(q)) return false;
    if (empProjectFilter && !empProjectFilter.codes.includes(t.staffCode)) return false;
    return true;
  });
  document.getElementById('dtHead').innerHTML =
    `<tr><th>Staff Code</th><th>Nhân viên <span style="font-weight:400;color:var(--text3)">/ Employee</span></th><th>Phòng ban <span style="font-weight:400;color:var(--text3)">/ Dept</span></th><th>OT bình thường <span style="font-weight:400;color:var(--text3)">/ Normal OT</span></th><th>OT sau 22h <span style="font-weight:400;color:var(--text3)">/ Night OT</span></th><th>Tổng OT luỹ kế <span style="font-weight:400;color:var(--text3)">/ Total OT</span></th><th>% Giới hạn KPI <span style="font-weight:400;color:var(--text3)">(45h)</span></th><th>% Giới hạn Chi trả <span style="font-weight:400;color:var(--text3)">(70h)</span></th><th>Trạng thái <span style="font-weight:400;color:var(--text3)">/ Status</span></th></tr>`;
  document.getElementById('dtBody').innerHTML = rows.map(t => {
    // % Giới hạn KPI: tính trên mốc 45h/tháng (mục tiêu KPI nội bộ) — % Giới hạn Chi trả: tính
    // trên mốc 70h/tháng (mức trần được công ty chi trả OT theo quy định) — 2 mốc khác nhau,
    // hiển thị riêng để PM/HR phân biệt rõ "vượt KPI" khác với "vượt mức chi trả".
    const pctKpi = Math.min(999, Math.round(t.total/45*100));
    const pctPay = Math.min(999, Math.round(t.total/70*100));
    const fcKpi  = pctKpi>=100 ? '#C0392B' : pctKpi>=80 ? '#E8A33D' : '#7A9468';
    const fcPay  = pctPay>=100 ? '#C0392B' : pctPay>=80 ? '#E8A33D' : '#7A9468';
    const fc  = stOf(t.total)==='d'?'#C0392B':stOf(t.total)==='w45'?'#E8A33D':'#7A9468';
    const over = t.total > 70;
    const rc = over ? 'color:#C0392B;font-weight:700' : '';
    const rawNight = t.nightTotal || 0;
    // OT sau 22h hiển thị KHÔNG được vượt quá Tổng OT chính thức (Tổng = MAX(0, giờ làm − quota) —
    // nếu quota đã "hấp thụ" hết OT tháng đó, phần giờ khuya thô cũng không còn được công nhận riêng).
    // Cách này đảm bảo LUÔN ĐÚNG: OT bình thường + OT sau 22h = Tổng OT luỹ kế (không còn lệch số).
    const night = Math.min(rawNight, t.total);
    const normal = Math.round((t.total - night)*10)/10;
    const projInfo = t.staffCode ? findEmployeeProject(t.staffCode) : null;
    const projName = projInfo ? projInfo.proj.replace(/^HCM\s+/i, '') : '';
    const deptDisplay = projInfo ? `${projInfo.group}/${projName}` : t.dept;
    return `<tr>
      <td style="font-family:var(--font-mono);font-size:11px;${over?'color:#C0392B;font-weight:700':'color:var(--text2)'}">${t.staffCode||'—'}</td>
      <td style="${over?'font-weight:700;color:#C0392B':'font-weight:500'}">${t.name}${over ? ' <span class="late-dot" title="Vượt 70h OT"></span>' : ''}</td>
      <td style="color:var(--text2)" title="${deptDisplay}">${deptDisplay}</td>
      <td style="color:var(--text2)">${normal}h</td>
      <td style="${night>0?'font-weight:600;color:#6B4FA0':'color:var(--text3)'}">${night>0?night+'h':'—'}</td>
      <td style="${rc || 'font-weight:700'}">${t.total}h</td>
      <td><div style="font-size:10px;color:var(--text2)">${pctKpi}%</div>
          <div class="pb"><div class="pf" style="width:${Math.min(100,pctKpi)}%;background:${fcKpi}"></div></div></td>
      <td><div style="font-size:10px;color:var(--text2)">${pctPay}%</div>
          <div class="pb"><div class="pf" style="width:${Math.min(100,pctPay)}%;background:${fcPay}"></div></div></td>
      <td>${stBadge(t.total)}</td></tr>`;
  }).join('') || `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text2)">Không tìm thấy kết quả. <span style="color:var(--text3)">/ No results found.</span></td></tr>`;
}

// ============================================================
//  DANH SÁCH NHÂN VIÊN OT (Employee OT List) — trang riêng, độc lập với Dashboard
//  Có Theo tuần / Theo tháng riêng (empTab/empPeriod/empMK), dùng lại renderDashTable()
//  để vẽ đúng 1 bộ cột giống bản gốc (Staff Code, Tên, Phòng ban, Tổng OT, %, Trạng thái).
// ============================================================
function setEmpMK(mk) { empMK = mk; empPeriod = null; renderEmployeeList(); }

function setEmpTab(tab) {
  empTab = tab;
  document.getElementById('empTabWeek').classList.toggle('active', tab==='week');
  document.getElementById('empTabMonth').classList.toggle('active', tab==='month');
  document.getElementById('empWeekBar').style.display = tab==='week' ? 'flex' : 'none';
  renderEmployeeList();
}

function setEmpPeriod(i) { empPeriod = i; renderEmployeeList(); }

function renderEmployeeMonthSel() {
  const keys = Object.keys(DB).sort();
  const el = document.getElementById('empMonthSel');
  if (!el) return;
  if (!keys.length) { el.innerHTML = '<option>Chưa có dữ liệu</option>'; return; }
  if (!empMK || !DB[empMK]) empMK = (activeMK && DB[activeMK]) ? activeMK : keys[keys.length-1];
  el.innerHTML = keys.map(mk =>
    `<option value="${mk}" title="${fmtCompanyMK(mk)}" ${mk===empMK?'selected':''}>${fmtMK(mk)}</option>`
  ).join('');
}

function renderEmployeePeriodChips() {
  const el = document.getElementById('empPeriodChips');
  if (!el) return;
  if (!empMK || !DB[empMK]) { el.innerHTML = ''; return; }
  const periods = buildPeriods(empMK);
  if (!periods.length) { el.innerHTML = '<span style="font-size:12px;color:var(--text2)">Chưa có dữ liệu</span>'; return; }
  if (empPeriod === null || empPeriod >= periods.length) empPeriod = periods.length - 1;
  el.innerHTML = periods.map((p,i) => `
    <button class="chip ${i===empPeriod?'active':''}" onclick="setEmpPeriod(${i})">${p.label}</button>
  `).join('');
}

function renderEmployeeList() {
  renderEmployeeMonthSel();
  const weekBar = document.getElementById('empWeekBar');
  if (weekBar) weekBar.style.display = empTab==='week' ? 'flex' : 'none';
  document.getElementById('empTabWeek')?.classList.toggle('active', empTab==='week');
  document.getElementById('empTabMonth')?.classList.toggle('active', empTab==='month');
  if (empTab === 'week') renderEmployeePeriodChips();

  const banner = document.getElementById('empProjectFilterBanner');
  if (banner) {
    if (empProjectFilter) {
      banner.style.display = 'flex';
      document.getElementById('empProjectFilterText').innerHTML =
        `🔎 Đang lọc theo dự án: <strong>${empProjectFilter.group}/${empProjectFilter.proj}</strong> (${empProjectFilter.codes.length} NV)`;
    } else {
      banner.style.display = 'none';
    }
  }

  if (!empMK || !DB[empMK]) {
    document.getElementById('dtHead').innerHTML = '';
    document.getElementById('dtBody').innerHTML =
      '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text2)">Chưa có dữ liệu. Vào tab Upload để bắt đầu.</td></tr>';
    const tt = document.getElementById('empTableTitle');
    if (tt) tt.textContent = '';
    return;
  }
  const df = document.getElementById('empDeptFilter')?.value || '__all__';
  const periods = buildPeriods(empMK);
  const periodIdx = empTab === 'month' ? periods.length-1 : empPeriod;
  let totals = getTotals(empMK, df, periodIdx);
  if (empTab === 'week') totals = applyWeekDelta(totals);
  const tt = document.getElementById('empTableTitle');
  if (tt) tt.textContent = empTab === 'month' ? fmtMK(empMK) : (periods[periodIdx] ? periods[periodIdx].label : '');
  renderDashTable(totals, periods);
}

// ============================================================
//  PHÒNG BAN
// ============================================================
function renderDept() {
  const dSel = document.getElementById('deptSel').value;
  const mk   = document.getElementById('deptMonthSel').value || activeMK;
  if (!mk || !DB[mk]) return;

  const allDepts = Object.keys(DB[mk].depts || {}).sort();
  const depts    = dSel === '__all__' ? allDepts : [dSel];
  const periods  = buildPeriods(mk);

  // Render period buttons for week tab
  const pBtns = document.getElementById('deptPeriodBtns');
  if (periods.length) {
    if (deptPeriodIdx === null || deptPeriodIdx >= periods.length) deptPeriodIdx = periods.length - 1;
    pBtns.innerHTML = periods.map((p,i) => `<button class="wbtn ${i===deptPeriodIdx?'active':''}" onclick="deptPeriodIdx=${i};renderDept()">${p.label}</button>`).join('');
  }

  // pIdx for data: week tab = selected period, month tab = last period (full month)
  const pIdx = deptTab === 'week' ? deptPeriodIdx : periods.length - 1;

  const deptStats = depts.map((d,i) => {
    const tots = getTotals(mk, d, pIdx).map(t=>t.total);
    const total = Math.round(tots.reduce((a,b)=>a+b,0)*10)/10;
    const over = tots.filter(t => t > 70).length;
    const ci   = allDepts.indexOf(d);
    return { name:d, nvCount: tots.length, total, over,
             overPct: tots.length ? Math.round(over/tots.length*100) : 0,
             color: DEPT_COLORS[ci % DEPT_COLORS.length] };
  });

  const periodLabel = periods[pIdx]?.label || 'Cả tháng';
  const titleEl = document.getElementById('deptAvgTitle');
  if (titleEl) titleEl.textContent = `Tổng OT luỹ kế theo phòng ban — ${periodLabel}`;

  document.getElementById('deptMetrics').innerHTML = deptStats.map(d => `
    <div class="mc">
      <div class="ml" style="display:flex;align-items:center;gap:5px">
        <span style="width:9px;height:9px;border-radius:2px;background:${d.color};flex-shrink:0"></span>${d.name}
      </div>
      <div class="mv">${d.total}h</div>
      <div class="ms">${d.nvCount} NV${deptTab==='week' ? '' : ` &middot; ${d.over} vượt 70h`}</div>
    </div>`).join('');

  document.getElementById('deptLegend').innerHTML =
    deptStats.map(d=>`<span><span class="ldot" style="background:${d.color}"></span>${d.name}</span>`).join('');

  killChart('cDeptAvg');
  const deptAvgMax = Math.max(1, ...deptStats.map(d=>d.total));
  CH['cDeptAvg'] = new Chart(document.getElementById('cDeptAvg'), {
    type:'bar',
    data:{ labels: deptStats.map(d=>d.name),
           datasets:[{data:deptStats.map(d=>d.total), backgroundColor:deptStats.map(d=>d.color), borderWidth:0, borderRadius:5, label:'Tổng giờ OT'}]},
    options:{ responsive:true, maintainAspectRatio:false, layout:{padding:{top:26,right:10,left:6,bottom:6}},
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>` ${c.raw}h tổng luỹ kế`}}, barValueLabels:{suffix:'h'}},
      scales:{x:{grid:{display:false},ticks:{font:{size:10}}},
              y:{grid:{color:'rgba(128,128,128,0.12)'},ticks:{font:{size:10}}, suggestedMax: Math.ceil(deptAvgMax*1.18)}}}});

  // "% NV vượt 70h" chỉ có ý nghĩa ở tab THÁNG (ngưỡng 70h/tháng) — ẩn hẳn khi đang xem Theo tuần.
  const overCard = document.getElementById('deptOverCard');
  const chartsGrid = document.getElementById('deptChartsGrid');
  if (deptTab === 'week') {
    if (overCard) overCard.style.display = 'none';
    if (chartsGrid) chartsGrid.style.gridTemplateColumns = '1fr';
    killChart('cDeptOver');
  } else {
    if (overCard) overCard.style.display = '';
    if (chartsGrid) chartsGrid.style.gridTemplateColumns = '';
    killChart('cDeptOver');
    CH['cDeptOver'] = new Chart(document.getElementById('cDeptOver'), {
      type:'bar',
      data:{
        labels: deptStats.map(d => d.name),
        datasets:[{
          data: deptStats.map(d => d.overPct),
          backgroundColor: deptStats.map(d => d.overPct > 50 ? '#C0392B' : d.overPct > 20 ? '#E8A33D' : '#7A9468'),
          borderWidth: 0, borderRadius: 4, label:'% vượt 70h'
        }]
      },
      options:{
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        layout:{ padding:{ right:34, top:4, bottom:4, left:4 } },
        plugins:{ legend:{display:false}, tooltip:{callbacks:{label: c => ` ${c.raw}% nhân viên vượt 70h`}}, barValueLabels:{ suffix:'%' }},
        scales:{
          x:{ grid:{color:'rgba(128,128,128,0.1)'}, ticks:{font:{size:10}}, max:100 },
          y:{ grid:{display:false}, ticks:{font:{size:11}} }
        }
      }
    });
  }

  const showDept = dSel === '__all__' ? null : dSel;
  document.getElementById('deptTableTitle').textContent = `${showDept || 'Tất cả phòng ban'} — ${periodLabel}`;
  // Bảng phòng ban: hiển thị tổng hợp theo phòng ban (không list từng NV), kèm nút Chi tiết
  document.getElementById('deptTHead').innerHTML =
    `<tr><th>Phòng ban</th><th>Số NV</th><th>Tổng OT (h)</th><th>Vượt 70h</th><th></th></tr>`;
  const deptRows = (showDept ? [showDept] : deptStats.map(d=>d.name)).map(dname => {
    const ds = deptStats.find(d=>d.name===dname);
    if (!ds) return '';
    const ci = allDepts.indexOf(dname);
    const col = DEPT_COLORS[ci % DEPT_COLORS.length];
    const isEC = dname === 'HCM-EC';
    const boxIdD = `deptProjBox_${mk.replace(/[^a-zA-Z0-9]/g,'_')}_${deptTab}`;
    let row = `<tr>
      <td><span style="display:inline-flex;align-items:center;gap:6px;font-weight:600">
        <span style="width:10px;height:10px;border-radius:3px;background:${col};flex-shrink:0"></span>${dname}</span>${isEC ? projectExpandButtonHtml(boxIdD) : ''}</td>
      <td>${ds.nvCount}</td>
      <td style="font-weight:700;font-family:var(--font-mono)">${ds.total}h</td>
      <td>${ds.over>0?`<span class="badge bd">${ds.over}</span>`:'<span style="color:var(--text3)">—</span>'}</td>
      <td><button class="btn" onclick="goPage('employees','${dname}')" style="padding:3px 10px;font-size:11px">Chi tiết →</button></td></tr>`;
    if (isEC) {
      row += `<tr><td colspan="5" style="padding:0;border:none"><div id="${boxIdD}" style="display:none;padding:8px 0 8px 18px"></div></td></tr>`;
      const useDeltaD = deptTab === 'week';
      const projRowsD = projectsInGroup('HCM-EC').sort().map(proj => {
        const s = getProjectOTForPeriod('HCM-EC', proj, mk, pIdx, useDeltaD);
        return { name: proj, display: s.total+'h', nv: s.nvCount };
      });
      setTimeout(() => fillProjectBox(boxIdD, projRowsD, 'OT (h)'), 0);
    }
    return row;
  }).join('') || `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text2)">Không có dữ liệu.</td></tr>`;
  document.getElementById('deptTBody').innerHTML = deptRows;

  // Chart mới: OT theo dự án (HCM-EC) — đúng theo kỳ đang xem (tuần/tháng)
  if (allDepts.includes('HCM-EC')) {
    const useDeltaChart = deptTab === 'week';
    const projEntriesD = projectsInGroup('HCM-EC').sort().map(proj => {
      const s = getProjectOTForPeriod('HCM-EC', proj, mk, pIdx, useDeltaChart);
      return { name: proj.replace(/^HCM\s+/i,''), value: s.total };
    }).filter(e => e.value > 0);
    const lblD = document.getElementById('deptProjChartLabel');
    if (lblD) lblD.textContent = periodLabel;
    renderGenericProjectBarChart(CH, killChart, 'cDeptProj',
      document.getElementById('cDeptProj'), document.getElementById('cDeptProjEmpty'),
      projEntriesD, 'h', '#6B4FA0');
    const card = document.getElementById('deptProjCard');
    if (card) card.style.display = 'block';
  } else {
    killChart('cDeptProj');
    const card = document.getElementById('deptProjCard');
    if (card) card.style.display = 'none';
  }
}

// ============================================================
//  SO SÁNH
// ============================================================
function renderCompare() {
  const keys = Object.keys(DB).sort();
  if (!keys.length) {
    ['cCmpTrend','cCmpDept','cRisk','cPeriodTrend','cPeriodDept'].forEach(killChart);
    const sel = document.getElementById('cmpMonthSel');
    if (sel) sel.innerHTML = '<option>Chưa có dữ liệu</option>';
    return;
  }

  // Populate month selector without resetting current value
  const cmpMonthSel = document.getElementById('cmpMonthSel');
  const prevVal = cmpMonthSel.value;
  cmpMonthSel.innerHTML = keys.map(mk=>`<option value="${mk}">${fmtMK(mk)}</option>`).join('');
  if (keys.includes(prevVal)) cmpMonthSel.value = prevVal;
  else cmpMonthSel.value = keys[keys.length-1];

  // Chỉ render đúng tab đang active (tránh dựng dư 3 lần biểu đồ cho cả 3 tab mỗi lần vào trang).
  if (cmpTab === 'week') renderCompareWeek();
  else if (cmpTab === 'quarter') renderCompareQuarter();
  else renderCompareMonth();
}

// ── Weekly compare: OT per individual week window (incremental, not cumulative) ──
function renderCompareWeek() {
  const keys = Object.keys(DB).sort();
  if (!keys.length) return;
  const allDepts = getAllDepts();

  // Sync month selector
  const cmpMonthSel = document.getElementById('cmpMonthSel');
  const prevVal = cmpMonthSel.value;
  cmpMonthSel.innerHTML = keys.map(mk=>`<option value="${mk}" title="${fmtCompanyMK(mk)}">${fmtMK(mk)}</option>`).join('');
  if (keys.includes(prevVal)) cmpMonthSel.value = prevVal;
  else cmpMonthSel.value = keys[keys.length-1];

  const cmpMk = cmpMonthSel.value;
  const periods = buildPeriods(cmpMk);
  if (!periods.length) {
    ['cPeriodTrend','cPeriodDept'].forEach(killChart);
    document.getElementById('periodTBody').innerHTML =
      '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text2)">Chưa có dữ liệu cho tháng này.</td></tr>';
    return;
  }

  // OT tuần theo phòng ban — giữ 1 chữ số thập phân, không Math.round sớm.
  // Tổng công ty = Σ phòng ban đang hiển thị (cùng nguồn) → cộng tay luôn khớp biểu đồ/bảng.
  function getWeeklySum(mk, dept, pi) {
    const s = getTotals(mk, dept, pi).reduce((a, t) => a + (t.deltaTotal || 0), 0);
    return Math.round(s * 10) / 10;
  }

  // Week labels (short): based on actual weekNum, not array position
  const weekLabels = periods.map((p) => `W${p.weekNum}`);

  // Ma trận [tuần][phòng ban] — chart phòng ban + tổng công ty dùng chung
  const deptWeekMatrix = periods.map((p, pi) => allDepts.map(d => getWeeklySum(cmpMk, d, pi)));
  const companyWeekTotal = deptWeekMatrix.map(row => Math.round(row.reduce((a, b) => a + b, 0) * 10) / 10);

  // Chart 1: Grouped bar — mỗi phòng ban = 1 nhóm sát nhau (W1…Wn), nhóm cách nhau rõ;
  // tuần = 0 vẫn hiện nhãn "0" + minBarLength để không bị tưởng thiếu cột.
  document.getElementById('periodDeptLeg').innerHTML =
    allDepts.map((d,i)=>`<span><span class="ldot" style="background:${DEPT_COLORS[i%DEPT_COLORS.length]}"></span>${d}</span>`).join('') +
    `<span style="margin-left:8px;font-size:11px;color:var(--text3)">· Mỗi cụm cột = 1 phòng ban (W1→W${periods.length})</span>`;

  const periodDeptCanvas = document.getElementById('cPeriodDept');
  if (periodDeptCanvas?.parentElement) {
    periodDeptCanvas.parentElement.style.height = Math.max(360, 280 + periods.length * 8) + 'px';
  }

  killChart('cPeriodDept');
  const WEEK_COLORS = ['#2D6CDF','#7B5EA7','#5E7A4F','#B14B3F','#3E7C8C','#9C5B8E'];
  const deptDatasets = periods.map((p,pi) => ({
    label: weekLabels[pi],
    data: deptWeekMatrix[pi],
    backgroundColor: WEEK_COLORS[pi % WEEK_COLORS.length]+'CC',
    borderColor: WEEK_COLORS[pi % WEEK_COLORS.length],
    borderWidth:1, borderRadius:3,
    minBarLength: 3 // cột 0h vẫn có “chân” nhỏ để thấy slot tuần
  }));

  CH['cPeriodDept'] = new Chart(periodDeptCanvas, {
    type:'bar',
    data:{ labels: allDepts, datasets: deptDatasets },
    options:{
      responsive:true, maintainAspectRatio:false,
      layout:{ padding:{ top: 18 } },
      datasets:{
        bar:{
          categoryPercentage: 0.72, // khoảng trống giữa các PHÒNG BAN (nhóm)
          barPercentage: 0.92       // cột tuần trong cùng nhóm sát nhau
        }
      },
      plugins:{
        deptGroupBands:{},
        barValueLabels:{ showZero:true, fontSize:9, suffix:'' },
        legend:{display:true, position:'top', labels:{font:{size:11},boxWidth:12,padding:10,
          generateLabels: chart => periods.map((p,i)=>({
            text: weekLabels[i], fillStyle: WEEK_COLORS[i%WEEK_COLORS.length],
            strokeStyle: WEEK_COLORS[i%WEEK_COLORS.length], lineWidth:1, hidden:false, index:i
          }))
        }},
        tooltip:{callbacks:{
          title: items => {
            const dept = items[0]?.label || '';
            const week = periods[items[0]?.datasetIndex]?.label || '';
            return dept ? `${dept} · ${week}` : week;
          },
          label:c=>` ${c.dataset.label}: ${c.raw}h (phát sinh trong tuần)`
        }}
      },
      scales:{
        x:{grid:{display:false}, ticks:{font:{size:11, weight:'600'}, color: getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#211F1C'}},
        y:{grid:{color:'rgba(128,128,128,0.12)'}, ticks:{font:{size:10}},
           title:{display:true, text:'Tổng OT phát sinh trong tuần (h)', font:{size:10}, color:'#8A8378'},
           beginAtZero:true}
      }
    }
  });

  // Chart 2: Bar — TỔNG OT toàn công ty = Σ phòng ban (cùng deptWeekMatrix)
  killChart('cPeriodTrend');
  const ptShortLabels = periods.map(p => `W${p.weekNum}`);
  CH['cPeriodTrend'] = new Chart(document.getElementById('cPeriodTrend'), {
    type:'bar',
    data:{
      labels: ptShortLabels,
      datasets:[
        { type:'bar', label:'Tổng OT trong tuần (h)', data:companyWeekTotal,
          backgroundColor:'rgba(45,108,223,0.7)', borderColor:'#2D6CDF',
          borderWidth:1, borderRadius:4, yAxisID:'y' }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:true, position:'top', labels:{font:{size:11},boxWidth:12,padding:10}},
        barValueLabels:{ suffix:'' },
        tooltip:{callbacks:{
          title: items => periods[items[0].dataIndex]?.label || '',
          label:c=>` ${c.dataset.label}: ${c.raw}h`
        }}
      },
      scales:{
        x:{grid:{display:false}, ticks:{font:{size:10}}},
        y:{grid:{color:'rgba(128,128,128,0.12)'}, ticks:{font:{size:10}},
           position:'left', title:{display:true, text:'Tổng OT công ty trong tuần (h)', font:{size:10}, color:'#8A8378'}}
      }
    }
  });

  // Table — cùng số liệu với 2 chart
  const weekBoxId = 'cmpProjBox_week';
  document.getElementById('periodTHead').innerHTML =
    `<tr><th>Tuần</th>${allDepts.map(d=>`<th>${d}${d==='HCM-EC'?projectExpandButtonHtml(weekBoxId):''}</th>`).join('')}<th>Tổng công ty</th></tr>`;
  const periodRowsHtml = periods.map((p,pi) => {
    const deptCells = deptWeekMatrix[pi].map(val =>
      `<td style="font-family:var(--font-mono)">${val}h</td>`
    ).join('');
    const co = companyWeekTotal[pi];
    return `<tr>
      <td style="font-weight:600;white-space:nowrap">${p.label}</td>
      ${deptCells}
      <td style="font-family:var(--font-mono);font-weight:600;color:var(--accent)">${co}h</td>
    </tr>`;
  }).join('');
  document.getElementById('periodTBody').innerHTML = periodRowsHtml
    ? periodRowsHtml + `<tr><td colspan="${allDepts.length+2}" style="padding:0;border:none"><div id="${weekBoxId}" style="display:none;padding:8px 0"></div></td></tr>`
    : '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--text2)">Không có dữ liệu.</td></tr>';

  // Chart mới: OT theo dự án (HCM-EC) — tuần đang chọn (tuần cuối cùng trong bảng, mới nhất)
  if (allDepts.includes('HCM-EC') && periods.length) {
    const lastPeriodIdx = periods.length - 1;
    const lblW = document.getElementById('cmpProjWeekLabel');
    if (lblW) lblW.textContent = periods[lastPeriodIdx]?.label || '';
    const projEntriesW = projectsInGroup('HCM-EC').sort().map(proj => {
      const s = getProjectOTForPeriod('HCM-EC', proj, activeMK, lastPeriodIdx, true);
      return { name: proj.replace(/^HCM\s+/i,''), value: s.total };
    }).filter(e => e.value > 0);
    renderGenericProjectBarChart(CH, killChart, 'cCmpProjWeek',
      document.getElementById('cCmpProjWeek'), document.getElementById('cCmpProjWeekEmpty'),
      projEntriesW, 'h', '#6B4FA0');
    const projRowsW = projectsInGroup('HCM-EC').sort().map(proj => {
      const s = getProjectOTForPeriod('HCM-EC', proj, activeMK, lastPeriodIdx, true);
      return { name: proj, display: s.total+'h', nv: s.nvCount };
    });
    setTimeout(() => fillProjectBox(weekBoxId, projRowsW, 'OT (h)'), 0);
  }
}

// ── Monthly compare: existing month-over-month charts ──
function renderCompareMonth() {
  const keys = Object.keys(DB).sort();
  if (!keys.length) return;
  const allDepts = getAllDepts();
  const totalByMk = keys.map(mk => {
    const tots = DB[mk].names.map(n => totalOf(DB[mk].employees[n]));
    return Math.round(tots.reduce((a,b)=>a+b,0)*10)/10;
  });
  const monthLabels = keys.map(fmtMK);

  safeMakeChart(CH, killChart, 'cCmpTrend', document.getElementById('cCmpTrend'), {
    type:'line',
    data:{ labels: monthLabels, datasets:[
      { label:'Tổng OT công ty', data:totalByMk, borderColor:'#2D6CDF', backgroundColor:'rgba(45,108,223,0.10)',
        tension:.35, borderWidth:2.5, pointRadius:5, fill:true }]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>` ${c.dataset.label}: ${c.raw}h`}}},
      scales:{x:{grid:{display:false},ticks:{font:{size:10}}},
              y:{grid:{color:'rgba(128,128,128,0.12)'},ticks:{font:{size:10}}, min:0,
                 max: Math.max(10, ...totalByMk) * 1.15}}}
  });

  document.getElementById('cmpDeptLeg').innerHTML =
    allDepts.map((d,i)=>`<span><span class="ldot" style="background:${DEPT_COLORS[i%DEPT_COLORS.length]}"></span>${d}</span>`).join('');

  // ── Cột ngang: Tổng OT từng phòng ban — theo tháng ĐANG CHỌN ở dropdown (không cứng tháng mới nhất) ──
  const cmpMonthSel = document.getElementById('cmpMonthSel');
  const prevFocus = cmpMonthSel ? cmpMonthSel.value : '';
  if (cmpMonthSel) {
    cmpMonthSel.innerHTML = keys.map(mk=>`<option value="${mk}" title="${fmtCompanyMK(mk)}">${fmtMK(mk)}</option>`).join('');
    if (keys.includes(prevFocus)) cmpMonthSel.value = prevFocus;
    else cmpMonthSel.value = keys[keys.length-1];
  }
  const focusMk = (cmpMonthSel && keys.includes(cmpMonthSel.value)) ? cmpMonthSel.value : keys[keys.length-1];
  const lbl = document.getElementById('cmpProjMonthLabel');
  if (lbl) lbl.textContent = fmtMK(focusMk);
  const projData = allDepts.map(d => {
    const nvs = DB[focusMk].depts?.[d] || [];
    return Math.round(nvs.reduce((s,n)=> s + (DB[focusMk].employees[n] ? totalOf(DB[focusMk].employees[n]) : 0), 0)*10)/10;
  });
  const projCanvas = document.getElementById('cCmpProjPie');
  const projWrap = projCanvas?.parentElement;
  if (projWrap) projWrap.style.height = Math.max(220, allDepts.length * 36 + 48) + 'px';
  const projMax = Math.max(10, ...projData, 0);
  safeMakeChart(CH, killChart, 'cCmpProjPie', projCanvas, {
    type:'bar',
    data:{ labels: allDepts, datasets:[{
      label: 'Tổng OT (h)',
      data: projData,
      backgroundColor: allDepts.map((_,i)=>DEPT_COLORS[i%DEPT_COLORS.length]),
      borderWidth:0, borderRadius:4
    }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
      layout:{ padding:{ right:48, top:4, bottom:4, left:4 } },
      plugins:{ legend:{display:false}, barValueLabels:{ suffix:'h' },
        tooltip:{callbacks:{label:c=>` ${c.label}: ${c.raw}h`}} },
      scales:{
        x:{ grid:{color:'rgba(128,128,128,0.12)'}, ticks:{font:{size:10}}, min:0, max: projMax * 1.15 },
        y:{ grid:{display:false}, ticks:{font:{size:11}} }
      }
    }
  });

  // Line theo phòng ban: dùng 0 thay null để tránh Chart.js vẽ trống khi spanGaps + layout 0px
  const deptSeriesMax = [];
  const deptDatasets = allDepts.map((d,i) => {
    const data = keys.map(mk => {
      const nvs  = DB[mk].depts?.[d] || [];
      const tots = nvs.map(n => (DB[mk].employees[n] ? totalOf(DB[mk].employees[n]) : 0));
      const v = tots.length ? Math.round(tots.reduce((a,b)=>a+b,0)*10)/10 : 0;
      deptSeriesMax.push(v);
      return v;
    });
    return {
      label: d, data,
      borderColor: DEPT_COLORS[i%DEPT_COLORS.length], backgroundColor:'transparent',
      tension:.35, borderWidth:2, pointRadius:4, spanGaps:true
    };
  });
  safeMakeChart(CH, killChart, 'cCmpDept', document.getElementById('cCmpDept'), {
    type:'line',
    data:{ labels: monthLabels, datasets: deptDatasets },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>` ${c.dataset.label}: ${c.raw}h`}}},
      scales:{x:{grid:{display:false},ticks:{font:{size:10}}},
              y:{grid:{color:'rgba(128,128,128,0.12)'},ticks:{font:{size:10}}, min:0,
                 max: Math.max(10, ...deptSeriesMax, 0) * 1.15}}}
  });

  const allNVs = [...new Set(keys.flatMap(mk=>DB[mk].names))];
  const risk = allNVs.map(n => ({
    name: nvLabelByName(n, DB, keys),
    count: keys.filter(mk => DB[mk].employees[n] && totalOf(DB[mk].employees[n])>70).length
  })).filter(x=>x.count>0).sort((a,b)=>b.count-a.count).slice(0,8);

  killChart('cRisk');
  const riskEmptyEl = document.getElementById('cRiskEmpty');
  const riskCanvasEl = document.getElementById('cRisk');
  const riskWrap = document.getElementById('cRiskWrap');
  if (!risk.length) {
    if (riskEmptyEl) riskEmptyEl.style.display = 'flex';
    if (riskWrap) riskWrap.style.display = 'none';
    else if (riskCanvasEl) riskCanvasEl.style.display = 'none';
  } else {
    if (riskEmptyEl) riskEmptyEl.style.display = 'none';
    if (riskWrap) riskWrap.style.display = 'block';
    if (riskCanvasEl) riskCanvasEl.style.display = 'block';
    const riskH = Math.max(160, risk.length*36+60);
    if (riskWrap) riskWrap.style.height = riskH+'px';
    else if (riskCanvasEl?.parentElement) riskCanvasEl.parentElement.style.height = riskH+'px';
    const riskMax = Math.max(1, ...risk.map(x=>x.count));
    safeMakeChart(CH, killChart, 'cRisk', riskCanvasEl, {
      type:'bar',
      data:{ labels:risk.map(x=>x.name), datasets:[{data:risk.map(x=>x.count),
        backgroundColor:'#C0392B', borderWidth:0, borderRadius:3, label:'Tháng vượt'}]},
      options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
        layout:{ padding:{ right:34, top:4, bottom:4, left:4 } },
        plugins:{legend:{display:false}, barValueLabels:{},
          tooltip:{callbacks:{label:c=>` ${c.raw} tháng vượt 70h`}}},
        scales:{x:{grid:{color:'rgba(128,128,128,0.12)'},ticks:{font:{size:10},stepSize:1},
                   min:0, max: Math.ceil(riskMax * 1.25)},
                y:{grid:{display:false},ticks:{font:{size:10}}}}}
    });
  }

  document.getElementById('cmpTHead').innerHTML =
    '<tr><th>Tháng</th><th>Phòng ban</th><th>Tổng NV</th><th>Vượt 70h</th><th>Bình thường</th><th>Tổng OT</th></tr>';
  const cmpRows = [];
  keys.forEach(mk => {
    const allD = Object.keys(DB[mk].depts||{}).sort();
    allD.forEach(dept => {
      const nvs  = DB[mk].depts[dept];
      const tots = nvs.map(n=>totalOf(DB[mk].employees[n]));
      const boxIdM = `cmpProjBox_m_${mk.replace(/[^a-zA-Z0-9]/g,'_')}`;
      const expandBtnM = dept === 'HCM-EC' ? projectExpandButtonHtml(boxIdM) : '';
      cmpRows.push(`<tr>
        <td style="font-weight:500">${fmtMK(mk)}</td>
        <td>${dept}${expandBtnM}</td><td>${nvs.length}</td>
        <td><span class="badge bd">${tots.filter(t=>t>70).length}</span></td>
        <td><span class="badge bo">${tots.filter(t=>t<=70).length}</span></td>
        <td style="font-weight:600;color:var(--accent)">${Math.round(tots.reduce((a,b)=>a+b,0)*10)/10}h</td></tr>`);
      if (dept === 'HCM-EC') {
        cmpRows.push(`<tr><td colspan="6" style="padding:0;border:none"><div id="${boxIdM}" style="display:none;padding:8px 0 8px 18px"></div></td></tr>`);
        const periodsM = buildPeriods(mk);
        const pIdxM = periodsM.length ? periodsM.length - 1 : null;
        const projRowsM = projectsInGroup('HCM-EC').sort().map(proj => {
          const s = getProjectOTForPeriod('HCM-EC', proj, mk, pIdxM, false);
          return { name: proj, display: s.total+'h', nv: s.nvCount };
        });
        setTimeout(() => fillProjectBox(boxIdM, projRowsM, 'OT (h)'), 0);
      }
    });
  });
  document.getElementById('cmpTBody').innerHTML = cmpRows.join('') ||
    '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text2)">Không có dữ liệu.</td></tr>';

  // Chart mới: OT theo dự án (HCM-EC) — tháng đang chọn (cmpMonthSel, hoặc tháng cuối)
  const cmpSelMk = document.getElementById('cmpMonthSel')?.value || keys[keys.length-1];
  const lblM2 = document.getElementById('cmpProjMonthLabel2');
  if (lblM2) lblM2.textContent = cmpSelMk ? fmtMK(cmpSelMk) : '';
  if (cmpSelMk && DB[cmpSelMk]) {
    const periodsM2 = buildPeriods(cmpSelMk);
    const pIdxM2 = periodsM2.length ? periodsM2.length - 1 : null;
    const projEntriesM = projectsInGroup('HCM-EC').sort().map(proj => {
      const s = getProjectOTForPeriod('HCM-EC', proj, cmpSelMk, pIdxM2, false);
      return { name: proj.replace(/^HCM\s+/i,''), value: s.total };
    }).filter(e => e.value > 0);
    renderGenericProjectBarChart(CH, killChart, 'cCmpProjMonth',
      document.getElementById('cCmpProjMonth'), document.getElementById('cCmpProjMonthEmpty'),
      projEntriesM, 'h', '#6B4FA0');
  }
}

// ── Quý lịch chuẩn: Q1=T1–T3, Q2=T4–T6, Q3=T7–T9, Q4=T10–T12 ──
function quarterKeyOf(mk) {
  const [y, m] = mk.split('-').map(Number);
  return `${y}-Q${Math.ceil(m/3)}`;
}
function fmtQK(qk) {
  const [y, qStr] = qk.split('-Q');
  const q = Number(qStr);
  const startM = (q - 1) * 3; // 0-based index into MONTH_NAMES_EN
  const a = MONTH_NAMES_EN[startM].slice(0, 3);
  const b = MONTH_NAMES_EN[startM + 2].slice(0, 3);
  return `Quý ${q}/${y} (${a}–${b})`;
}
function monthsInQuarterKey(qk) {
  // Trả về 3 month-key YYYY-MM thuộc quý lịch (kể cả tháng chưa có dữ liệu)
  const [y, qStr] = qk.split('-Q');
  const q = Number(qStr);
  const start = (q - 1) * 3 + 1;
  return [start, start + 1, start + 2].map(m => `${y}-${String(m).padStart(2, '0')}`);
}
function renderCompareQuarter() {
  const keys = Object.keys(DB).sort();
  if (!keys.length) { ['cQtrTrend','cQtrDept','cQtrRisk'].forEach(killChart); return; }
  const allDepts = getAllDepts();
  const qKeys = [...new Set(keys.map(quarterKeyOf))].sort();

  // Tổng OT toàn công ty trong quý = tổng OT của tất cả các tháng thuộc quý đó
  const totalByQ = qKeys.map(qk => {
    const mks = keys.filter(mk => quarterKeyOf(mk) === qk);
    const monthlyTotals = mks.map(mk => {
      const tots = DB[mk].names.map(n => totalOf(DB[mk].employees[n]));
      return tots.reduce((a,b)=>a+b,0);
    });
    return Math.round(monthlyTotals.reduce((a,b)=>a+b,0)*10)/10;
  });

  killChart('cQtrTrend');
  CH['cQtrTrend'] = new Chart(document.getElementById('cQtrTrend'), {
    type:'line',
    data:{ labels: qKeys.map(fmtQK), datasets:[
      { label:'Tổng OT công ty', data:totalByQ, borderColor:'#2D6CDF', backgroundColor:'rgba(45,108,223,0.10)',
        tension:.35, borderWidth:2.5, pointRadius:5, fill:true }]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>` ${c.dataset.label}: ${c.raw}h`}}},
      scales:{x:{grid:{display:false},ticks:{font:{size:10}}},
              y:{grid:{color:'rgba(128,128,128,0.12)'},ticks:{font:{size:10}}}}}});

  document.getElementById('cmpQtrDeptLeg').innerHTML =
    allDepts.map((d,i)=>`<span><span class="ldot" style="background:${DEPT_COLORS[i%DEPT_COLORS.length]}"></span>${d}</span>`).join('');

  killChart('cQtrDept');
  CH['cQtrDept'] = new Chart(document.getElementById('cQtrDept'), {
    type:'line',
    data:{ labels: qKeys.map(fmtQK), datasets: allDepts.map((d,i) => ({
      label: d,
      data: qKeys.map(qk => {
        const mks = keys.filter(mk => quarterKeyOf(mk) === qk);
        const monthlyTotals = mks.map(mk => {
          const nvs  = DB[mk].depts?.[d] || [];
          const tots = nvs.map(n => (DB[mk].employees[n] ? totalOf(DB[mk].employees[n]) : 0));
          return tots.length ? tots.reduce((a,b)=>a+b,0) : null;
        }).filter(v => v !== null);
        return monthlyTotals.length ? Math.round(monthlyTotals.reduce((a,b)=>a+b,0)*10)/10 : null;
      }),
      borderColor: DEPT_COLORS[i%DEPT_COLORS.length], backgroundColor:'transparent',
      tension:.35, borderWidth:2, pointRadius:4, spanGaps:true }))},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>` ${c.dataset.label}: ${c.raw}h`}}},
      scales:{x:{grid:{display:false},ticks:{font:{size:10}}},
              y:{grid:{color:'rgba(128,128,128,0.12)'},ticks:{font:{size:10}}}}}});

  // Nhân viên hay vượt mức nhất theo quý (số tháng vượt 70h trong quý đó, gộp các quý)
  const allNVs = [...new Set(keys.flatMap(mk => DB[mk].names))];
  const risk = allNVs.map(n => ({
    name: nvLabelByName(n, DB, keys),
    count: keys.filter(mk => DB[mk].employees[n] && totalOf(DB[mk].employees[n]) > 70).length
  })).filter(x => x.count > 0).sort((a,b) => b.count - a.count).slice(0, 8);

  killChart('cQtrRisk');
  const riskEmptyEl = document.getElementById('cQtrRiskEmpty');
  const riskCanvasEl = document.getElementById('cQtrRisk');
  if (!risk.length) {
    if (riskEmptyEl) riskEmptyEl.style.display = 'flex';
    if (riskCanvasEl) riskCanvasEl.style.display = 'none';
  } else {
    if (riskEmptyEl) riskEmptyEl.style.display = 'none';
    if (riskCanvasEl) riskCanvasEl.style.display = 'block';
    const riskH = Math.max(160, risk.length*36+60);
    riskCanvasEl.parentElement.style.height = riskH+'px';
    CH['cQtrRisk'] = new Chart(riskCanvasEl, {
      type:'bar',
      data:{ labels:risk.map(x=>x.name), datasets:[{data:risk.map(x=>x.count),
        backgroundColor:'#C0392B', borderWidth:0, borderRadius:3, label:'Tháng vượt'}]},
      options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
        layout:{ padding:{ right:34, top:4, bottom:4, left:4 } },
        plugins:{legend:{display:false}, barValueLabels:{},
          tooltip:{callbacks:{label:c=>` ${c.raw} tháng vượt 70h`}}},
        scales:{x:{grid:{color:'rgba(128,128,128,0.12)'},ticks:{font:{size:10},stepSize:1},
                   suggestedMax: Math.ceil(Math.max(1, ...risk.map(x=>x.count)) * 1.25)},
                y:{grid:{display:false},ticks:{font:{size:10}}}}}});
  }

  // Bảng tổng hợp theo Quý × phòng ban (gộp lượt từng tháng trong quý)
  document.getElementById('cmpQtrTHead').innerHTML =
    '<tr><th>Quý</th><th>Phòng ban</th><th>Tổng NV (lượt)</th><th>Vượt 70h</th><th>Bình thường</th><th>Tổng OT</th></tr>';
  const qRows = [];
  qKeys.forEach(qk => {
    const mks = keys.filter(mk => quarterKeyOf(mk) === qk);
    const allD = [...new Set(mks.flatMap(mk => Object.keys(DB[mk].depts || {})))].sort();
    allD.forEach(dept => {
      let totalSum = 0, entries = 0, overCount = 0, normalCount = 0;
      mks.forEach(mk => {
        const nvs = DB[mk].depts?.[dept] || [];
        nvs.forEach(n => {
          const t = DB[mk].employees[n] ? totalOf(DB[mk].employees[n]) : 0;
          totalSum += t; entries += 1;
          if (t > 70) overCount++; else normalCount++;
        });
      });
      const boxIdQ = `cmpProjBox_q_${qk.replace(/[^a-zA-Z0-9]/g,'_')}`;
      const expandBtnQ = dept === 'HCM-EC' ? projectExpandButtonHtml(boxIdQ) : '';
      qRows.push(`<tr>
        <td style="font-weight:500">${fmtQK(qk)}</td>
        <td>${dept}${expandBtnQ}</td><td>${entries}</td>
        <td><span class="badge bd">${overCount}</span></td>
        <td><span class="badge bo">${normalCount}</span></td>
        <td style="font-weight:600;color:var(--accent)">${Math.round(totalSum*10)/10}h</td></tr>`);
      if (dept === 'HCM-EC') {
        qRows.push(`<tr><td colspan="6" style="padding:0;border:none"><div id="${boxIdQ}" style="display:none;padding:8px 0 8px 18px"></div></td></tr>`);
        const projRowsQ = projectsInGroup('HCM-EC').sort().map(proj => {
          let sum = 0, nv = 0;
          mks.forEach(mk => {
            const periodsQ = buildPeriods(mk);
            const pIdxQ = periodsQ.length ? periodsQ.length - 1 : null;
            const s = getProjectOTForPeriod('HCM-EC', proj, mk, pIdxQ, false);
            sum += s.total; nv = Math.max(nv, s.nvCount);
          });
          return { name: proj, display: Math.round(sum*10)/10+'h', nv };
        });
        setTimeout(() => fillProjectBox(boxIdQ, projRowsQ, 'OT (h)'), 0);
      }
    });
  });
  document.getElementById('cmpQtrTBody').innerHTML = qRows.join('') ||
    '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text2)">Không có dữ liệu.</td></tr>';

  // Chart mới: OT theo dự án (HCM-EC) — quý gần nhất có dữ liệu
  const lastQk = qKeys[qKeys.length-1];
  const lblQ2 = document.getElementById('cmpProjQtrLabel');
  if (lblQ2) lblQ2.textContent = lastQk ? fmtQK(lastQk) : '';
  if (lastQk) {
    const mksLastQ = keys.filter(mk => quarterKeyOf(mk) === lastQk);
    const projEntriesQ = projectsInGroup('HCM-EC').sort().map(proj => {
      let sum = 0;
      mksLastQ.forEach(mk => {
        const periodsQ2 = buildPeriods(mk);
        const pIdxQ2 = periodsQ2.length ? periodsQ2.length - 1 : null;
        sum += getProjectOTForPeriod('HCM-EC', proj, mk, pIdxQ2, false).total;
      });
      return { name: proj.replace(/^HCM\s+/i,''), value: Math.round(sum*10)/10 };
    }).filter(e => e.value > 0);
    renderGenericProjectBarChart(CH, killChart, 'cCmpProjQtr',
      document.getElementById('cCmpProjQtr'), document.getElementById('cCmpProjQtrEmpty'),
      projEntriesQ, 'h', '#6B4FA0');
  }
}

// ============================================================
//  UPLOAD PAGE
// ============================================================
function renderSavedMonths() {
  const keys = Object.keys(DB).sort();
  const el = document.getElementById('savedMonths');
  if (!keys.length) {
    el.innerHTML = '<p style="font-size:12px;color:var(--text2)">Chưa có dữ liệu được lưu.</p>'; return;
  }
  el.innerHTML = '<p style="font-size:12px;color:var(--text2);margin-bottom:8px">Dữ liệu đang lưu trong trình duyệt:</p>' +
    keys.map(mk => {
      const m    = DB[mk];
      const tots = m.names.map(n => totalOf(m.employees[n]));
      const depts = Object.keys(m.depts||{});
      return `<div class="month-list-item">
        <span><strong>${fmtMK(mk)}</strong> &nbsp;—&nbsp; ${m.names.length} NV &middot; ${depts.length} phòng ban &middot; ${tots.reduce((a,b)=>a+b,0)}h OT tổng</span>
        <button class="btn btn-danger" onclick="deleteMonth('${mk}')" style="padding:4px 10px;font-size:11px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          Xóa
        </button>
      </div>`;
    }).join('');
}

// ============================================================
//  EXPORT EXCEL
// ============================================================
function exportAll() {
  const keys = Object.keys(DB).sort();
  if (!keys.length) { toast('Không có dữ liệu để xuất'); return; }
  const wb = XLSX.utils.book_new();

  keys.forEach(mk => {
    const periods = buildPeriods(mk);
    const header = ['Nhân viên','Phòng ban', ...periods.map(p=>`OT ${p.label}`), '% Giới hạn (70h)', 'Trạng thái'];
    const rows = [header];
    const names = DB[mk].names;
    names.forEach(n => {
      const e = DB[mk].employees[n];
      const perPeriod = periods.map((p,pi) => getTotals(mk, '__all__', pi).find(x=>x.name===n)?.total ?? 0);
      const finalTotal = perPeriod.length ? perPeriod[perPeriod.length-1] : 0;
      rows.push([n, e.dept, ...perPeriod, Math.round(finalTotal/70*100)+'%',
                 finalTotal>70?'Vượt mức':'Bình thường']);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{wch:22},{wch:16}, ...periods.map(()=>({wch:18})), {wch:14},{wch:11}];
    XLSX.utils.book_append_sheet(wb, ws, fmtMK(mk).replace(/[\/ ]/g,'_').slice(0,30));
  });

  const sumRows = [['Tháng','Phòng ban','Tổng NV','Vượt 70h','Bình thường','Tổng OT (h)']];
  keys.forEach(mk => {
    const allD = Object.keys(DB[mk].depts||{}).sort();
    allD.forEach(dept => {
      const nvs  = DB[mk].depts[dept];
      const tots = nvs.map(n=>Math.round(totalOf(DB[mk].employees[n])*10)/10);
      sumRows.push([fmtMK(mk), dept, nvs.length,
        tots.filter(t=>t>70).length, tots.filter(t=>t<=70).length,
        Math.round(tots.reduce((a,b)=>a+b,0)*10)/10]);
    });
  });
  const wsSum = XLSX.utils.aoa_to_sheet(sumRows);
  wsSum['!cols'] = [{wch:14},{wch:16},{wch:8},{wch:10},{wch:12},{wch:11}];
  XLSX.utils.book_append_sheet(wb, wsSum, 'Tóm_tắt_phòng_ban');

  XLSX.writeFile(wb, `OT_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('Đã xuất file Excel!');
}

// ============================================================
//  EXPORT HTML REPORT (with charts)
// ============================================================
// Builds the full report HTML string. autoprint=true adds a script that
// triggers the print dialog once all charts have rendered (used for PDF export).
// Điền dropdown Tháng + Quý ở trang Báo cáo — Tháng lấy từ DB (chu kỳ OT 16→15), Quý gộp từ
// các tháng đó theo quarterKeyOf(). Mặc định chọn kỳ MỚI NHẤT mỗi lần vào trang.
function populateReportSelectors() {
  const keys = Object.keys(DB).sort();
  const monthSel = document.getElementById('reportMonthSel');
  if (monthSel) {
    monthSel.innerHTML = keys.map(mk => `<option value="${mk}">${fmtMK(mk)}</option>`).join('') || '<option value="">— Chưa có dữ liệu —</option>';
    monthSel.value = keys[keys.length-1] || '';
  }
  const qKeys = [...new Set(keys.map(quarterKeyOf))].sort();
  const qSel = document.getElementById('reportQuarterSel');
  if (qSel) {
    qSel.innerHTML = qKeys.map(qk => `<option value="${qk}">${fmtQK(qk)}</option>`).join('') || '<option value="">— Chưa có dữ liệu —</option>';
    qSel.value = qKeys[qKeys.length-1] || '';
  }
}

function buildReportHtml(mode) {
  const keys = Object.keys(DB).sort();
  const selMk = document.getElementById('reportMonthSel')?.value || keys[keys.length-1] || null;
  const selQk = document.getElementById('reportQuarterSel')?.value || null;

  // ═══ MỤC 1: TỔNG QUAN OT (cho tháng selMk) ═══
  const periods = selMk ? buildPeriods(selMk) : [];
  const totals = selMk ? getTotals(selMk, '__all__', periods.length ? periods.length-1 : null).sort((a,b)=>b.total-a.total) : [];
  const overCount = totals.filter(t=>t.total>70).length;
  const avgOt = totals.length ? Math.round(totals.reduce((a,b)=>a+b.total,0)/totals.length*10)/10 : 0;
  const maxOt = totals.length ? totals[0].total : 0;
  const maxNv = totals.length ? totals[0].name : '—';
  const top15 = totals.slice(0, 15);

  // ═══ MỤC 2: OT PHÒNG BAN (cho tháng selMk) ═══
  const allDepts = selMk && DB[selMk] ? Object.keys(DB[selMk].depts||{}).sort() : [];
  const deptStats = allDepts.map(d => {
    const dtotals = getTotals(selMk, d).map(t=>t.total);
    return {
      name: d,
      total: Math.round(dtotals.reduce((a,b)=>a+b,0)*10)/10,
      nv: dtotals.length,
      over: dtotals.filter(t=>t>70).length
    };
  }).sort((a,b)=>b.total-a.total);

  // ═══ MỤC 3: SO SÁNH OT (tháng selMk so với tháng liền trước, nếu có) ═══
  const curIdx = keys.indexOf(selMk);
  const prevMk = curIdx > 0 ? keys[curIdx-1] : null;
  const prevMap = {};
  if (prevMk && DB[prevMk]) {
    Object.keys(DB[prevMk].depts||{}).forEach(d => {
      const dtotals = getTotals(prevMk, d).map(t=>t.total);
      prevMap[d] = Math.round(dtotals.reduce((a,b)=>a+b,0)*10)/10;
    });
  }
  const cmpRows = deptStats.map(d => {
    const prev = prevMap[d.name];
    const diff = (prev !== undefined) ? Math.round((d.total - prev)*10)/10 : null;
    return { ...d, prev: prev ?? null, diff };
  });

  // ═══ MỤC 4: WLB THEO QUÝ (cho quý selQk) ═══
  const qMksArr = selQk ? monthsInQuarterKey(selQk).filter(mk => DB[mk] || OFF_DB[mk] || Object.keys(WLB_XLS.employees||{}).length) : [];
  const wlbAllDepts = [...new Set(qMksArr.flatMap(mk => Object.keys(DB[mk]?.depts||{})))].sort();
  const coOT_q = Math.round(qMksArr.reduce((s,mk)=>s+getTotalOT(mk,'__all__'),0)*10)/10;
  const coOff_q = Math.round(qMksArr.reduce((s,mk)=>s+getOffDays(mk,'__all__'),0)*10)/10;
  const coWlb_q = wlbRatio(coOff_q, coOT_q);
  const deptWlb_q = wlbAllDepts.map(d => {
    const ot = Math.round(qMksArr.reduce((s,mk)=>s+getTotalOT(mk,d),0)*10)/10;
    const off = Math.round(qMksArr.reduce((s,mk)=>s+getOffDays(mk,d),0)*10)/10;
    return { name: d, ot, off, wlb: wlbRatio(off, ot) };
  });

  const fmtDelta = (d) => d===null ? '—' : (d>0?'+':'')+d+'h';
  const deltaColor = (d) => d===null ? 'var(--text3)' : d>0 ? '#C0392B' : d<0 ? '#7A9468' : 'var(--text2)';
  const wlbColorR = (v) => v===null ? '#999' : v>WLB_THRESHOLD ? '#2E7D32' : '#C0392B';
  const wlbBadgeR = (v) => v===null ? '—' : v>WLB_THRESHOLD ? '✅ Đạt' : '⚠️ Không đạt';

  const html = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="UTF-8">
<title>Báo cáo OT — ${selMk ? fmtMK(selMk) : ''} — ${new Date().toLocaleDateString('vi-VN')}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; color:#211F1C; background:#fff; padding:24px; -webkit-font-smoothing:antialiased; }
  .num { font-family:'JetBrains Mono', ui-monospace, monospace; font-feature-settings:"tnum" 1; }
  .cover { text-align:center; padding:30px 0 20px; border-bottom:3px solid #2D6CDF; margin-bottom:24px; }
  .cover h1 { font-size:24px; font-weight:800; color:#14181F; }
  .cover p { font-size:13px; color:#666; margin-top:6px; }
  .section { margin-bottom:28px; page-break-inside:avoid; }
  .section-title { font-size:16px; font-weight:800; color:#14181F; margin-bottom:4px; padding-bottom:6px; border-bottom:2px solid #E8EFFC; }
  .section-sub { font-size:11.5px; color:#888; margin-bottom:10px; }
  .kpi-row { display:flex; gap:12px; margin-bottom:14px; flex-wrap:wrap; }
  .kpi { flex:1; min-width:110px; background:#F3F5FA; border-radius:10px; padding:10px 12px; }
  .kpi .l { font-size:10.5px; color:#888; }
  .kpi .v { font-size:19px; font-weight:800; color:#14181F; margin-top:2px; }
  table { width:100%; border-collapse:collapse; font-size:12px; margin-bottom:4px; }
  th { text-align:left; background:#F3F5FA; padding:6px 8px; font-weight:700; color:#444; border-bottom:1px solid #E0E0E0; }
  td { padding:5px 8px; border-bottom:1px solid #F0F0F0; }
  tr:nth-child(even) td { background:#FAFAFA; }
  .badge { display:inline-block; padding:1px 8px; border-radius:999px; font-size:10.5px; font-weight:700; }
  .bd { background:#FCE9E7; color:#C0392B; }
  .bo { background:#E8F3E5; color:#2E7D32; }
  .empty-note { color:#999; font-style:italic; padding:10px 0; }
  @media print { body{padding:12px;} .section{page-break-inside:avoid;} }
</style>
</head>
<body>

  <div class="cover">
    <h1>BÁO CÁO OVERTIME</h1>
    <p>Tháng: <strong>${selMk ? fmtMK(selMk) : 'Chưa chọn'}</strong> &nbsp;·&nbsp; Quý (WLB): <strong>${selQk ? fmtQK(selQk) : 'Chưa chọn'}</strong> &nbsp;·&nbsp; Xuất ngày ${new Date().toLocaleDateString('vi-VN')}</p>
  </div>

  <div class="section">
    <div class="section-title">1. Tổng quan OT</div>
    <div class="section-sub">${selMk ? fmtMK(selMk) : ''}</div>
    ${!selMk || !totals.length ? '<div class="empty-note">Không có dữ liệu OT cho tháng này.</div>' : `
    <div class="kpi-row">
      <div class="kpi"><div class="l">Tổng nhân viên</div><div class="v">${totals.length}</div></div>
      <div class="kpi"><div class="l">NV vượt mức (&gt;70h)</div><div class="v" style="color:#C0392B">${overCount}</div></div>
      <div class="kpi"><div class="l">OT trung bình</div><div class="v">${avgOt}h</div></div>
      <div class="kpi"><div class="l">OT cao nhất</div><div class="v">${maxOt}h</div><div style="font-size:10px;color:#888">${maxNv}</div></div>
    </div>
    <table><thead><tr><th>#</th><th>Nhân viên</th><th>Phòng ban</th><th>Tổng OT</th><th>Trạng thái</th></tr></thead>
    <tbody>${top15.map((t,i)=>`<tr><td class="num">${i+1}</td><td>${t.name}</td><td>${t.dept||'—'}</td><td class="num">${t.total}h</td><td>${t.total>70?'<span class="badge bd">Vượt mức</span>':t.total>45?'<span class="badge bd" style="background:#FDF1DE;color:#B8790C">Vượt mức 45</span>':'<span class="badge bo">Bình thường</span>'}</td></tr>`).join('')}</tbody></table>
    <div style="font-size:10.5px;color:#999;margin-top:4px">Hiển thị top ${top15.length}/${totals.length} nhân viên theo tổng OT.</div>
    `}
  </div>

  <div class="section">
    <div class="section-title">2. OT phòng ban</div>
    <div class="section-sub">${selMk ? fmtMK(selMk) : ''}</div>
    ${!deptStats.length ? '<div class="empty-note">Không có dữ liệu phòng ban cho tháng này.</div>' : `
    <table><thead><tr><th>Phòng ban</th><th>Số NV</th><th>Tổng OT</th><th>NV vượt mức</th></tr></thead>
    <tbody>${deptStats.map(d=>`<tr><td><strong>${d.name}</strong></td><td class="num">${d.nv}</td><td class="num">${d.total}h</td><td>${d.over>0?`<span class="badge bd">${d.over}</span>`:'—'}</td></tr>`).join('')}</tbody></table>
    `}
  </div>

  <div class="section">
    <div class="section-title">3. So sánh OT</div>
    <div class="section-sub">${selMk?fmtMK(selMk):''} so với ${prevMk?fmtMK(prevMk):'tháng liền trước (không có dữ liệu)'}</div>
    ${!cmpRows.length ? '<div class="empty-note">Không có dữ liệu để so sánh.</div>' : `
    <table><thead><tr><th>Phòng ban</th><th>OT ${selMk?fmtMK(selMk):''}</th><th>OT ${prevMk?fmtMK(prevMk):'tháng trước'}</th><th>Chênh lệch</th></tr></thead>
    <tbody>${cmpRows.map(d=>`<tr><td><strong>${d.name}</strong></td><td class="num">${d.total}h</td><td class="num">${d.prev===null?'—':d.prev+'h'}</td><td class="num" style="color:${deltaColor(d.diff)};font-weight:700">${fmtDelta(d.diff)}</td></tr>`).join('')}</tbody></table>
    `}
  </div>

  <div class="section">
    <div class="section-title">4. WLB (Work-Life Balance) — theo quý</div>
    <div class="section-sub">${selQk ? fmtQK(selQk) : 'Chưa chọn quý'}</div>
    ${!selQk || !qMksArr.length ? '<div class="empty-note">Không có dữ liệu WLB cho quý này.</div>' : `
    <div class="kpi-row">
      <div class="kpi"><div class="l">Tổng OT (toàn công ty)</div><div class="v">${coOT_q}h</div></div>
      <div class="kpi"><div class="l">Tổng Off (toàn công ty)</div><div class="v">${coOff_q}h</div></div>
      <div class="kpi"><div class="l">WLB toàn công ty</div><div class="v" style="color:${wlbColorR(coWlb_q)}">${coWlb_q===null?'—':coWlb_q+'%'}</div></div>
    </div>
    <table><thead><tr><th>Phòng ban</th><th>Tổng OT</th><th>Tổng Off</th><th>WLB</th><th>Kết quả</th></tr></thead>
    <tbody>${deptWlb_q.map(d=>`<tr><td><strong>${d.name}</strong></td><td class="num">${d.ot}h</td><td class="num">${d.off}h</td><td class="num" style="color:${wlbColorR(d.wlb)};font-weight:700">${d.wlb===null?'—':d.wlb+'%'}</td><td>${wlbBadgeR(d.wlb)}</td></tr>`).join('')}</tbody></table>
    <div style="font-size:10.5px;color:#999;margin-top:6px">Ngưỡng: &gt;${WLB_THRESHOLD} = Đạt, ≤${WLB_THRESHOLD} = Không đạt. Các tháng trong quý: ${qMksArr.map(fmtMK).join(', ')}.</div>
    `}
  </div>

<script>
  // Không còn biểu đồ (đã chuyển toàn bộ báo cáo sang dạng bảng để đơn giản, đáng tin cậy hơn
  // khi xuất PDF) — báo hiệu sẵn sàng ngay lập tức, không cần chờ animation của chart nữa.
  ${mode === 'pdf' ? 'window.__pdfReady = true;' : ''}
  ${mode === 'print' ? 'setTimeout(() => window.print(), 300);' : ''}
</script>
</body></html>`;

  return html;
}

function exportHtmlReport() {
  const keys = Object.keys(DB).sort();
  if (!keys.length) { toast('Không có dữ liệu để xuất'); return; }
  const html = buildReportHtml(false);
  const blob = new Blob([html], {type:'text/html'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `OT_Report_${new Date().toISOString().slice(0,10)}.html`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Đã xuất báo cáo HTML!');
}

async function exportPdfReport() {
  const keys = Object.keys(DB).sort();
  if (!keys.length) { toast('Không có dữ liệu để xuất'); return; }

  // Loading state
  const btn = document.querySelector('.sb-btn.primary');
  const origHTML = btn ? btn.innerHTML : '';
  const setLoading = (msg) => { if (btn) btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg><span>${msg}</span>`; };
  setLoading('Đang dựng báo cáo...');
  toast('Đang tạo PDF — vui lòng chờ...');
  await new Promise(r => setTimeout(r, 50));

  // PDF được dựng bằng cách chụp lại CHÍNH báo cáo HTML (buildReportHtml) đang chạy trong
  // 1 iframe ẩn — đảm bảo PDF giống 100% bản HTML/bản trên app (đúng font tiếng Việt vì
  // chữ được render thật bởi trình duyệt, không phải vẽ chữ thủ công bằng jsPDF/Helvetica
  // — vốn không có dấu tiếng Việt; và hình/biểu đồ giữ đúng kích thước như khi xem trên web).
  let iframe = null;
  try {
    const html = buildReportHtml('pdf');

    iframe = document.createElement('iframe');
    iframe.setAttribute('data-pdf-tmp', '1');
    iframe.style.cssText = 'position:fixed;top:0;left:-99999px;width:1050px;height:800px;border:0;background:#fff;';
    document.body.appendChild(iframe);
    iframe.srcdoc = html;

    await new Promise((resolve, reject) => {
      iframe.onload = resolve;
      iframe.onerror = () => reject(new Error('Không tải được báo cáo'));
      setTimeout(resolve, 4000); // safety fallback
    });

    setLoading('Đang vẽ biểu đồ...');
    // Chờ tất cả chart trong iframe render xong (cờ __pdfReady do buildReportHtml() bật lên)
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    const waitStart = Date.now();
    while (win && !win.__pdfReady && Date.now() - waitStart < 8000) {
      await new Promise(r => setTimeout(r, 120));
    }
    await new Promise(r => setTimeout(r, 200)); // chừa thêm chút cho lần vẽ cuối ổn định

    setLoading('Đang xuất PDF...');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const A4_W = 210, A4_H = 297, MARGIN = 10;
    const contentW = A4_W - MARGIN * 2;
    let pageNum = 0;

    function addFooter() {
      pageNum++;
      pdf.setFontSize(8);
      pdf.setTextColor(180, 174, 163);
      try { pdf.text(`Bao cao OT  ·  ${new Date().toLocaleDateString('vi-VN')}  ·  Trang ${pageNum}`, A4_W/2, A4_H - 5, {align:'center'}); } catch(e) {}
    }

    // Chụp 1 element DOM (trong iframe) thành 1 hoặc nhiều ảnh, mỗi ảnh tự xuống trang PDF
    // mới nếu nội dung dài hơn 1 trang A4 (giữ nguyên độ phân giải, không co nhỏ chart/chữ).
    async function renderElementToPdf(el, isFirstEver) {
      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
        windowWidth: 1050
      });
      const mmPerPx = contentW / canvas.width;
      const maxSlicePx = Math.floor((A4_H - MARGIN * 2 - 6) / mmPerPx);
      let y = 0, sliceIdx = 0;
      while (y < canvas.height) {
        const sliceH = Math.min(maxSlicePx, canvas.height - y);
        const sc = document.createElement('canvas');
        sc.width = canvas.width; sc.height = sliceH;
        sc.getContext('2d').drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const imgData = sc.toDataURL('image/jpeg', 0.93);
        if (!(isFirstEver && sliceIdx === 0)) { pdf.addPage(); }
        pdf.addImage(imgData, 'JPEG', MARGIN, MARGIN, contentW, sliceH * mmPerPx);
        addFooter();
        y += sliceH;
        sliceIdx++;
      }
    }

    const coverEl = doc.querySelector('.cover');
    const sectionEls = Array.from(doc.querySelectorAll('.section'));
    const elements = coverEl ? [coverEl, ...sectionEls] : sectionEls;

    if (!elements.length) {
      pdf.text('Không có dữ liệu.', MARGIN, MARGIN + 6);
      addFooter();
    } else {
      for (let i = 0; i < elements.length; i++) {
        setLoading(`Đang xuất trang ${i+1}/${elements.length}...`);
        await renderElementToPdf(elements[i], i === 0);
      }
    }

    const dateStr = new Date().toISOString().slice(0,10);
    pdf.save(`OT_Report_${dateStr}.pdf`);
    toast('Đã xuất PDF thành công!');

  } catch (err) {
    console.error('PDF export error:', err);
    toast('Lỗi xuất PDF: ' + err.message + ' — Kiểm tra Console (F12) để xem chi tiết');
  } finally {
    if (btn) btn.innerHTML = origHTML;
    if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
    document.querySelectorAll('[data-pdf-tmp]').forEach(el => el.remove());
  }
}

// ============================================================
//  GOOGLE SHEETS SYNC
// ============================================================
const SYNC_URL_KEY = 'ot_manager_sync_url';
const AUTOSYNC_KEY = 'ot_manager_autosync';
const DEFAULT_SYNC_URL = 'https://script.google.com/macros/s/AKfycbzASugHHerHmMB1iDEmDbeGqv_V7rwZrvRbVeTfrBpl8JnwX6JEoeXMSIe_02dSA_Y/exec';
let SYNC_URL = '';
let AUTO_SYNC = false;
let lastSyncedAt = null;

function loadSyncConfig() {
  try {
    SYNC_URL = localStorage.getItem(SYNC_URL_KEY);
    if (SYNC_URL === null) { SYNC_URL = DEFAULT_SYNC_URL; localStorage.setItem(SYNC_URL_KEY, SYNC_URL); }
    AUTO_SYNC = localStorage.getItem(AUTOSYNC_KEY) === '1';
  } catch(e) { SYNC_URL = DEFAULT_SYNC_URL; }
}

function updateSyncBadge(state, text) {
  const el = document.getElementById('syncStatus');
  const txt = document.getElementById('syncStatusText');
  el.className = 'sync-badge sync-' + state;
  txt.textContent = text;
}

function refreshSyncBadgeIdle() {
  if (!SYNC_URL) { updateSyncBadge('off','Chưa kết nối'); return; }
  updateSyncBadge('ok', AUTO_SYNC ? 'Đã kết nối · Online · Auto' : 'Đã kết nối · Online');
}

function renderSyncPage() {
  document.getElementById('syncUrl').value = SYNC_URL;
  document.getElementById('autoSyncChk').checked = AUTO_SYNC;
  const info = document.getElementById('syncInfo');
  if (!SYNC_URL) {
    info.textContent = 'Chưa cấu hình URL. Dán URL Web App (Apps Script) rồi bấm Lưu URL.';
  } else {
    info.innerHTML = `Đang kết nối tới: <code style="font-size:11px">${SYNC_URL.slice(0,60)}...</code>` +
      (lastSyncedAt ? `<br>Lần đồng bộ gần nhất: ${lastSyncedAt}` : '');
  }
  loadNotifyRecipients();
  updateNotifyPreview();
  renderWlbSummary(); // cập nhật luôn phần Off Day months trong Cài đặt
}

function saveSyncUrl() {
  const url = document.getElementById('syncUrl').value.trim();
  if (url && !url.startsWith('https://script.google.com/')) {
    if (!confirm('URL này không giống Apps Script URL. Vẫn lưu?')) return;
  }
  SYNC_URL = url;
  try { localStorage.setItem(SYNC_URL_KEY, SYNC_URL); } catch(e) {}
  refreshSyncBadgeIdle();
  renderSyncPage();
  toast(url ? 'Đã lưu URL kết nối' : 'Đã xóa URL kết nối');
}

function toggleAutoSync() {
  AUTO_SYNC = document.getElementById('autoSyncChk').checked;
  try { localStorage.setItem(AUTOSYNC_KEY, AUTO_SYNC ? '1' : '0'); } catch(e) {}
  refreshSyncBadgeIdle();
  if (AUTO_SYNC && SYNC_URL) toast('Đã bật tự động tải lên Sheet');
}

// ============================================================
//  GỬI THÔNG BÁO EMAIL CHO QUẢN LÝ — khi update data tuần mới
// ============================================================
const NOTIFY_RECIPIENTS_KEY = 'ot_notify_recipients';
const NOTIFY_SENDER = 'anhtuan@taikisha-vn.com';
const NOTIFY_REPORT_URL = 'https://ot-manager-hcm.netlify.app/';

function loadNotifyRecipients() {
  let val = '';
  try { val = localStorage.getItem(NOTIFY_RECIPIENTS_KEY) || ''; } catch(e) {}
  const el = document.getElementById('notifyRecipients');
  if (el) el.value = val;
}
function saveNotifyRecipients() {
  try { localStorage.setItem(NOTIFY_RECIPIENTS_KEY, document.getElementById('notifyRecipients').value); } catch(e) {}
  updateNotifyPreview();
}

// Tự động lấy "ngày" theo tuần dữ liệu mới nhất đã upload (theo tên/khoảng ngày của lần upload gần nhất)
function buildNotifyEmail() {
  const keys = Object.keys(DB).sort();
  let periodStr = '(chưa có dữ liệu)';
  if (keys.length) {
    const mk = keys[keys.length-1];
    const periods = buildPeriods(mk);
    const last = periods[periods.length-1];
    periodStr = last ? `${last.label} — ${fmtMK(mk)}` : fmtMK(mk);
  }
  const subject = `[OT Weekly Report] Cập nhật báo cáo OT — ${periodStr}`;
  const body =
`Dear Anh/Chị Quản lý,

Phòng AD-HR xin thông báo, báo cáo OT tuần (${periodStr}) đã được cập nhật.

Anh/Chị vui lòng truy cập theo đường link dưới đây để xem chi tiết, nhớ bấm Update Data

OT Weekly Report:
${NOTIFY_REPORT_URL}

Nếu Anh/Chị cần thêm thông tin hoặc có bất kỳ góp ý nào để cải thiện báo cáo, vui lòng phản hồi lại email này.

Cảm ơn Anh/Chị!

Thanks & Best regards,
Anh Tuấn`;
  return { subject, body, periodStr };
}

function updateNotifyPreview() {
  const subEl = document.getElementById('notifySubjectPreview');
  const bodyEl = document.getElementById('notifyBodyPreview');
  if (!subEl || !bodyEl) return;
  const { subject, body } = buildNotifyEmail();
  subEl.textContent = subject;
  bodyEl.textContent = body;
}

function getNotifyRecipientList() {
  const raw = (document.getElementById('notifyRecipients')?.value || '').trim();
  return raw.split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean);
}

// Cách 1 (luôn hoạt động, không cần cấu hình gì thêm): mở email nháp trên Outlook/Gmail desktop app của máy,
// admin chỉ cần bấm Gửi. Người gửi hiển thị theo tài khoản mail đang đăng nhập trên máy đó.
function sendNotifyMailto() {
  const to = getNotifyRecipientList();
  if (!to.length) { toast('Vui lòng nhập email người nhận trước'); return; }
  const { subject, body } = buildNotifyEmail();
  const mailto = `mailto:${to.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;
}

// Cách 2 (tự động, không cần mở app mail): gửi qua Google Apps Script đang dùng để Sync Sheet.
// Cần Apps Script đã có thêm action 'sendNotifyEmail' dùng MailApp.sendEmail() — xem ghi chú trong UI.
async function sendNotifyAuto() {
  const to = getNotifyRecipientList();
  if (!to.length) { toast('Vui lòng nhập email người nhận trước'); return; }
  if (!SYNC_URL) { toast('Chưa cấu hình URL Apps Script (Sync) — không thể gửi tự động'); return; }
  const { subject, body } = buildNotifyEmail();
  toast('Đang gửi email...');
  try {
    const res = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'sendNotifyEmail', to, subject, body, from: NOTIFY_SENDER })
    });
    let json;
    try { json = await res.json(); }
    catch(e) { throw new Error('Apps Script chưa hỗ trợ action "sendNotifyEmail" — dùng nút "Soạn email" thay thế, hoặc thêm đoạn code MailApp vào Apps Script.'); }
    if (json.ok) toast(`Đã gửi email tới ${to.length} người nhận!`);
    else throw new Error(json.error || 'unknown');
  } catch (err) {
    toast('Lỗi gửi tự động: ' + err.message);
  }
}

async function syncSave() {
  if (!SYNC_URL) { toast('Chưa cấu hình URL Sheet'); goPage('settings'); return; }
  updateSyncBadge('busy','Đang tải lên...');
  try {
    // Gói chung OT (DB) + Đi trễ (LATE_DB) + Off Day + Dự án/Action Plan (PROJECTS_DB) vào 1
    // payload để Sheet luôn đồng bộ đủ cả — trước đây PROJECTS_DB chỉ lưu localStorage nên
    // máy khác mở lên không thấy được tên PM/lý do/duyệt do người khác đã điền.
    const res = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'save', data: { ot: DB, late: LATE_DB, off: OFF_DB, projects: PROJECTS_DB, users: USERS_DB, adminPw: getAdminPassword() } })
    });
    let json;
    try { json = await res.json(); }
    catch(parseErr) {
      const text = await res.text().catch(()=> '');
      throw new Error(`HTTP ${res.status} — phản hồi không phải JSON. ${text.slice(0,150)}`);
    }
    if (json.ok) {
      lastSyncedAt = new Date().toLocaleString('vi-VN');
      refreshSyncBadgeIdle();
      renderSyncPage();
      const apSel = document.getElementById('actionPlanMonthSel'); if (apSel) apSel.value = ''; if (document.getElementById('pg-action')?.classList.contains('show')) renderActionPlan();
      toast('Đã tải lên Google Sheet! (OT + Đi trễ + Off Day WLB + Action Plan)');
    } else throw new Error(json.error || 'unknown');
  } catch (err) {
    updateSyncBadge('err','Lỗi sync');
    toast('Lỗi tải lên: ' + err.message);
    console.error('syncSave error:', err);
  }
}

async function syncLoad() {
  if (!SYNC_URL) { toast('Chưa cấu hình URL Sheet'); goPage('settings'); return; }
  const hasData = Object.keys(DB).length || Object.keys(LATE_DB).length || Object.keys(OFF_DB).length;
  if (hasData && !confirm('Dữ liệu hiện tại (OT + Đi trễ + Off Day WLB + Action Plan) sẽ bị thay bằng dữ liệu trên Sheet. Tiếp tục?')) return;
  updateSyncBadge('busy','Đang tải xuống...');
  try {
    const res = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'load' })
    });
    let json;
    try { json = await res.json(); }
    catch(parseErr) {
      const text = await res.text().catch(()=> '');
      throw new Error(`HTTP ${res.status} — phản hồi không phải JSON. ${text.slice(0,150)}`);
    }
    if (json.ok) {
      const parsed = JSON.parse(json.data || '{}');
      // Hỗ trợ cả payload mới { ot, late, off } và payload cũ (chỉ OT)
      const isNewFormat = parsed && typeof parsed === 'object' && (parsed.ot || parsed.late || parsed.off || parsed.projects);
      DB = isNewFormat ? (parsed.ot || {}) : (parsed && typeof parsed === 'object' ? parsed : {});
      LATE_DB = isNewFormat ? (parsed.late || {}) : {};
      OFF_DB = isNewFormat ? (parsed.off || {}) : {};
      // Chỉ ghi đè PROJECTS_DB nếu Sheet THỰC SỰ có dữ liệu dự án — tránh trường hợp Sheet cũ
      // chưa từng lưu projects (payload cũ) làm mất sạch dữ liệu Action Plan đang có trên máy này.
      if (isNewFormat && parsed.projects && Object.keys(parsed.projects).length) {
        PROJECTS_DB = parsed.projects;
        saveProjectsDB();
      }
      // Tương tự với danh sách tài khoản User — chỉ ghi đè nếu Sheet THỰC SỰ có dữ liệu, để tài
      // khoản Admin vừa tạo trên máy này không bị mất khi Pull về từ 1 Sheet cũ chưa có mục này.
      if (isNewFormat && parsed.users && Object.keys(parsed.users).length) {
        USERS_DB = parsed.users;
        saveUsersDB();
      }
      // Tương tự với mật khẩu Admin — chỉ ghi đè nếu Sheet có sẵn giá trị này (payload mới).
      if (isNewFormat && parsed.adminPw) {
        setAdminPassword(parsed.adminPw);
      }
      migrateOldFormat();
      migrateOffDBKeys();
      const keys = Object.keys(DB).sort();
      activeMK = keys.length ? keys[keys.length-1] : null;
      activePeriod = null;
      const lateKeys = Object.keys(LATE_DB).sort();
      activeLateMK = lateKeys.length ? lateKeys[lateKeys.length-1] : null;
      // Lưu cả 3 DB vào localStorage
      saveDB(false);
      saveLateDB();
      saveOffDB();
      // Cập nhật toàn bộ UI: OT, Đi trễ, WLB, Danh sách NV
      rebuildUI();
      rebuildLateUI();
      renderWlbSummary();
      if (document.getElementById('pg-wlb')?.classList.contains('show')) renderWlb();
      const apSel = document.getElementById('actionPlanMonthSel'); if (apSel) apSel.value = ''; if (document.getElementById('pg-action')?.classList.contains('show')) renderActionPlan();
      lastSyncedAt = new Date().toLocaleString('vi-VN');
      refreshSyncBadgeIdle();
      renderSyncPage();
      scheduleChartResize();
      const parts = [];
      if (Object.keys(DB).length)     parts.push('OT');
      if (Object.keys(LATE_DB).length) parts.push('Đi trễ');
      if (Object.keys(OFF_DB).length)  parts.push('Off Day (WLB)');
      toast(`Đã tải dữ liệu từ Sheet: ${parts.length ? parts.join(' + ') : 'không có dữ liệu'}!`);
    } else throw new Error(json.error || 'unknown');
  } catch (err) {
    updateSyncBadge('err','Lỗi sync');
    toast('Lỗi tải xuống: ' + err.message);
    console.error('syncLoad error:', err);
  }
}

// ============================================================
//  ĐI TRỄ (LATE ARRIVAL) MODULE
//  Uses the same company-month cycle (16→15) and parsing approach as OT.
//  Unit: MINUTES (more intuitive for small late durations).
// ============================================================
const LATE_STORAGE_KEY = 'ot_manager_late_db_v1';
const LATE_ALLOWED_DEPTS = new Set(['S-AD','S-AZ','S-PD','S-PU','S-QC','S-ED']);
const LATE_DEPT_LIST = ['S-AD','S-AZ','S-PD','S-PU','S-QC','S-ED'];
let LATE_DB = {};
let activeLateMK = null;
let activeLateWeekMK = null;
let activeLateWeekIdx = null;
let CHL = {};

// ============================================================
//  WLB — Work-Life Balance
//  OFF_DB: { 'YYYY-M': { employees: { name: { days: Set<iso>, dept, code } }, names:[], depts:{} } }
//  Dữ liệu OT lấy từ DB (đã có sẵn). File Off Day upload riêng.
// ============================================================
let OFF_DB = {};
const OFF_STORAGE_KEY = 'ot_manager_off_db_v1';
const WLB_CH = {};
let wlbTab = 'month';

function killWlbChart(id) { if (WLB_CH[id]) { WLB_CH[id].destroy(); WLB_CH[id] = null; } }

function saveOffDB() { try { localStorage.setItem(OFF_STORAGE_KEY, JSON.stringify(OFF_DB)); } catch(e) {} }
function loadOffDB() {
  try { const r = localStorage.getItem(OFF_STORAGE_KEY); if (r) OFF_DB = JSON.parse(r); } catch(e) {}
  migrateOffDBKeys();
}
// Chuẩn hóa khóa tháng của OFF_DB về đúng format "YYYY-MM" (2 chữ số) giống DB (OT) —
// vì có 1 khoảng thời gian trước đây khóa được lưu dạng "YYYY-M" (không đệm số 0),
// khiến 2 tháng giống nhau (vd "2026-1" và "2026-01") bị coi là 2 tháng khác nhau
// → dropdown hiện trùng lặp và biểu đồ WLB tra sai dữ liệu (OT/Off Day lệch khóa).
function migrateOffDBKeys() {
  let changed = false;
  const fixed = {};
  Object.keys(OFF_DB).forEach(mk => {
    const parts = mk.split('-');
    if (parts.length !== 2) { fixed[mk] = OFF_DB[mk]; return; }
    const y = parts[0], mNum = parts[1];
    const properMk = `${y}-${String(parseInt(mNum,10)).padStart(2,'0')}`;
    if (properMk !== mk) changed = true;
    if (!fixed[properMk]) {
      fixed[properMk] = OFF_DB[mk];
    } else {
      // Gộp nếu đã có dữ liệu ở khóa đúng (tránh mất dữ liệu khi có cả 2 khóa trùng nghĩa)
      const existing = fixed[properMk];
      const incoming = OFF_DB[mk];
      incoming.names.forEach(n => {
        if (!existing.employees[n]) { existing.employees[n] = incoming.employees[n]; existing.names.push(n); }
        else if (typeof incoming.employees[n].offTotal === 'number') {
          existing.employees[n].offTotal = (existing.employees[n].offTotal||0) + incoming.employees[n].offTotal;
        }
      });
      Object.keys(incoming.depts||{}).forEach(d => {
        if (!existing.depts[d]) existing.depts[d] = [];
        incoming.depts[d].forEach(n => { if (!existing.depts[d].includes(n)) existing.depts[d].push(n); });
      });
    }
  });
  if (changed) { OFF_DB = fixed; saveOffDB(); }
}

function setWlbTab(tab) {
  wlbTab = tab;
  document.getElementById('wlbTabMonth').classList.toggle('active', tab==='month');
  document.getElementById('wlbTabQuarter').classList.toggle('active', tab==='quarter');
  document.getElementById('wlb-month').style.display   = tab==='month'   ? 'block' : 'none';
  document.getElementById('wlb-quarter').style.display = tab==='quarter' ? 'block' : 'none';
  renderWlb();
  scheduleChartResize();
}

// Đọc file Off day: mỗi dòng = 1 ngày nghỉ của 1 NV. Cột: Staff Code, Tên, Phòng ban, Ngày nghỉ (dd/mm/yyyy)
async function handleOffDayFile(inp) {
  const files = Array.from(inp.files || []);
  if (!files.length) return;
  let totalCnt = 0; const allMonths = new Set();

  for (const file of files) {
    const bin = await new Promise((res,rej) => {
      const r = new FileReader(); r.onload = e=>res(e.target.result); r.onerror=rej; r.readAsBinaryString(file);
    });
    try {
      const wb = XLSX.read(bin, {type:'binary'});
      // Tìm sheet Off-Day nếu có nhiều sheet
      let sheetName = wb.SheetNames[0];
      for (const sn of wb.SheetNames) {
        if (/off.?day|ngay.?nghi/i.test(sn)) { sheetName = sn; break; }
      }
      const ws = wb.Sheets[sheetName];
      // Đọc 2 bản: raw:true để lấy SỐ chính xác cho dữ liệu ngày nghỉ,
      // raw:false để lấy CHỮ đã định dạng cho dòng tiêu đề — vì nếu ô "Jan/Feb..." trong
      // Excel được nhập dưới dạng ngày tháng (date) thay vì chữ thường, đọc raw:true sẽ
      // trả về số serial ngày (vd 46023) chứ không phải "Jan", khiến không dò được cột tháng.
      const aoa = XLSX.utils.sheet_to_json(ws, {header:1, raw:true, defval:null});
      const aoaText = XLSX.utils.sheet_to_json(ws, {header:1, raw:false, defval:null});

      // ── Bước 1: Lấy năm từ tiêu đề file (vd "LIST OF STAFF UNDER MONITORING 2026") ──
      let year = new Date().getFullYear();
      for (let r = 0; r < Math.min(5, aoaText.length); r++) {
        for (const cell of (aoaText[r]||[])) {
          const m = String(cell||'').match(/20\d{2}/);
          if (m) { year = parseInt(m[0]); break; }
        }
      }

      // ── Bước 2: Tìm header row có tên tháng (Jan, Feb, Mar...) — dò trên bản TEXT đã format ──
      const MONTH_SHORT = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
      let headerRowIdx = -1;
      let monthCols = {};   // colIdx → month number (1–12)
      let codeCol = -1, nameCol = -1, deptCol = -1;

      for (let r = 0; r < Math.min(12, aoaText.length); r++) {
        const row = aoaText[r] || [];
        const monthHits = row.filter(c => MONTH_SHORT.includes(String(c||'').trim().toLowerCase().slice(0,3))).length;
        if (monthHits >= 3) {
          headerRowIdx = r;
          row.forEach((cell, ci) => {
            const s = String(cell||'').trim().toLowerCase();
            const mIdx = MONTH_SHORT.indexOf(s.slice(0,3));
            if (mIdx >= 0) monthCols[ci] = mIdx + 1;
            if (/staff.{0,2}code|mã.{0,2}nv|msnv/i.test(s)) codeCol = ci;
            if (/staff.{0,2}name|họ.{0,2}tên|ho.{0,2}ten/i.test(s)) nameCol = ci;
            if (/dept|phòng|phong/i.test(s)) deptCol = ci;
          });
          // Fallback: tìm cột Staff Code theo pattern S\d+ trong dòng đầu data (dùng bản text)
          if (codeCol < 0 && aoaText[r+1]) {
            aoaText[r+1].forEach((cell, ci) => {
              if (/^S\d{4,6}$/i.test(String(cell||'').trim())) codeCol = ci;
            });
          }
          // Fallback name: cột liền sau Staff Code
          if (nameCol < 0 && codeCol >= 0) nameCol = codeCol + 1;
          break;
        }
      }

      if (headerRowIdx < 0 || Object.keys(monthCols).length === 0) {
        // Thử format cũ (1 dòng = 1 ngày nghỉ)
        const rows = XLSX.utils.sheet_to_json(ws, {defval:''});
        let cnt = 0; const months = new Set();
        rows.forEach(row => {
          const vals = Object.values(row);
          const name = String(row['Họ tên']||row['Ho ten']||row['Name']||vals[1]||'').trim();
          const dept = String(row['Phòng ban']||row['Phong ban']||row['Department']||vals[2]||'Chưa phân loại').trim();
          const code = String(row['Staff Code']||row['Mã NV']||row['MSNV']||vals[0]||'').trim();
          const dateRaw = row['Ngày nghỉ']||row['Ngay nghi']||row['Off Date']||row['Date']||vals[3]||'';
          if (!name || !dateRaw) return;
          const d = parseDDMMYYYY(String(dateRaw).trim());
          if (!d) return;
          const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
          if (!OFF_DB[mk]) OFF_DB[mk] = { employees:{}, names:[], depts:{} };
          if (!OFF_DB[mk].employees[name]) { OFF_DB[mk].employees[name] = {offTotal:0, dept, code}; OFF_DB[mk].names.push(name); }
          OFF_DB[mk].employees[name].offTotal++;
          if (!OFF_DB[mk].depts[dept]) OFF_DB[mk].depts[dept] = [];
          if (!OFF_DB[mk].depts[dept].includes(name)) OFF_DB[mk].depts[dept].push(name);
          cnt++; months.add(mk);
        });
        totalCnt += cnt; months.forEach(m => allMonths.add(m));
        continue;
      }

      // ── Bước 3: Đọc từng dòng nhân viên ──
      let cnt = 0; const months = new Set();
      for (let r = headerRowIdx + 1; r < aoa.length; r++) {
        const rowText = aoaText[r] || [];
        const row = aoa[r] || [];
        const code = codeCol >= 0 ? String(rowText[codeCol]||'').trim() : '';
        const name = nameCol >= 0 ? String(rowText[nameCol]||'').trim() : '';
        if (!name && !code) continue;
        const staffName = name || code;
        const staffCode = code;

        // Tra phòng ban từ DB OT (vì file Off Day thường không có cột phòng ban)
        let dept = deptCol >= 0 ? String(rowText[deptCol]||'').trim() : '';
        if (!dept || dept === '__unknown__') {
          // Tìm trong DB theo staff code hoặc tên
          for (const mk of Object.keys(DB)) {
            const dbEmp = DB[mk].employees[staffName];
            if (dbEmp) { dept = dbEmp.dept || dept; break; }
            if (staffCode) {
              const byCode = DB[mk].names.find(n => DB[mk].employees[n]?.staffCode === staffCode);
              if (byCode) { dept = DB[mk].employees[byCode].dept || dept; break; }
            }
          }
        }
        if (!dept) dept = 'Chưa phân loại';

        // Đọc số ngày nghỉ cho từng tháng
        for (const [colIdxStr, monthNum] of Object.entries(monthCols)) {
          const colIdx = parseInt(colIdxStr);
          const rawVal = row[colIdx];
          if (rawVal === null || rawVal === undefined || rawVal === '') continue;
          const offDays = parseFloat(String(rawVal).replace(/[^\d.]/g,''));
          if (isNaN(offDays) || offDays <= 0) continue;

          const mk = `${year}-${String(monthNum).padStart(2,'0')}`;
          if (!OFF_DB[mk]) OFF_DB[mk] = { employees:{}, names:[], depts:{} };
          if (!OFF_DB[mk].employees[staffName]) {
            OFF_DB[mk].employees[staffName] = { offTotal:0, dept, code:staffCode };
            OFF_DB[mk].names.push(staffName);
          }
          OFF_DB[mk].employees[staffName].offTotal = (OFF_DB[mk].employees[staffName].offTotal||0) + offDays;
          if (dept && dept !== 'Chưa phân loại') {
            if (!OFF_DB[mk].depts[dept]) OFF_DB[mk].depts[dept] = [];
            if (!OFF_DB[mk].depts[dept].includes(staffName)) OFF_DB[mk].depts[dept].push(staffName);
          }
          cnt++; months.add(mk);
        }
      }
      totalCnt += cnt; months.forEach(m => allMonths.add(m));
    } catch(e) { console.error('Off day parse error:', e); toast('Lỗi đọc file: ' + e.message); }
  }

  inp.value = '';
  saveOffDB();
  const mArr = [...allMonths].sort();
  const logEl = document.getElementById('offDayLog');
  if (logEl) logEl.textContent = totalCnt
    ? `✅ Đã đọc ${totalCnt} bản ghi · ${mArr.length} tháng: ${mArr.map(fmtMK).join(', ')}`
    : '❌ Không đọc được — kiểm tra file có sheet "Off-Day List" và cột tháng (Jan, Feb...).';
  renderWlbSummary();
  renderWlb();
  toast(totalCnt ? `Upload Off Day thành công! (${mArr.length} tháng)` : 'Lỗi đọc file Off Day');
}

// ============================================================
//  WLB — NGUỒN DỮ LIỆU RIÊNG TỪ FILE EXCEL "OT List" + "Off-Day List"
// ============================================================
// QUAN TRỌNG: WLB tính từ CHÍNH file Excel công ty cung cấp (2 sheet: "OT List" và "Off-Day
// List"), theo ĐÚNG THÁNG DƯƠNG LỊCH (Jan, Feb, Mar...) cho CẢ 2 chỉ số OT và Off Day —
// KHÔNG dùng chu kỳ lương 16→15 như OT theo dõi ở các trang khác, và KHÔNG suy ra OT từ dữ liệu
// chấm công hàng ngày. Lý do: nếu OT lấy từ chu kỳ 16-15 (DB) còn Off Day lấy theo tháng dương
// lịch (OFF_DB cũ), 2 số liệu bị LỆCH NGÀY so với nhau, khiến tỷ lệ WLB tính sai. Dùng cùng 1
// file Excel cho cả OT lẫn Off Day đảm bảo 2 số liệu luôn khớp đúng cùng 1 khoảng thời gian.
// ============================================================
//  QUẢN LÝ DỰ ÁN (PROJECTS) — gán nhân viên vào dự án theo địa điểm chấm công
// ============================================================
// Dữ liệu khởi tạo (seed) đọc từ file chấm công chi tiết ("Địa điểm" mỗi ngày) do công ty cung
// cấp — với mỗi NV, chọn dự án được chấm công NHIỀU NHẤT làm dự án chính. Các dự án thuộc
// Murata Đà Nẵng / Mabuchi được gộp chung thành "HCM-CS3" theo đúng yêu cầu công ty.
// Sau khi seed lần đầu, người dùng có thể tự thêm/xoá/đổi tên dự án và di chuyển NV — mọi thay
// đổi được lưu vào localStorage, KHÔNG bị ghi đè lại bởi seed ở những lần mở app sau.
const PROJECTS_SEED = {
  "HCM-EC": {
    "HCM AEON MT": ["S22214","S22639","S21834","S21309","S22035","S20708","S22614","S22235"],
    "HCM CS1": ["S22632","S22529","S21802","S21636","S22610","S22010"],
    "HCM DHG": ["S21910","S22630"],
    "HCM HOUSE FOODS": ["S22625","S20504","S22013"],
    "HCM LOTTE": ["S22629","S22250","S21711","S20502"],
    "HCM MURATA BH": ["JES22402","S22212","S22408","S21304","S22204","S21825","S21202","S21101","S22040","S22623","S22518","S22514","S21714","S22240","S22615","S22507","S21705","S22509","S22612","S22230","S22019","S22229","S22417","S22012","S22220"],
    "HCM NESTLE": ["S22219","S22412","S21317","S21908","S22207","S21833","S22252","S22519","S22249","S21701","S22416"],
    "HCM NIPRO": ["S22407","H21214","S20503"],
    "HCM OFFICE 1": ["S22029"],
    "HCM OLP_SMZ": ["S22633","S21832","S22041","S22621","S22224"],
    "HCM POCARI": ["S21917","S22402","S22401","S22203","S22523","S21819","S21811","S22243","S20604","S22023","S22415"],
    "HCM RED DRAGON": ["S22641","S22602","S22635","S22531","S22631","S21823","S21115","S22042","S22520","S21012","S21754","S22517","S20813","S22618","S22516","S21718","S22510","S22239","S21707","S22025","S22506","S20003","S22608","S22222"],
    "HCM ROKKO": ["S22640","S22638","S21737","S22223","S22003"],
    "HCM SHARP": ["S21922","S22026","S21702"],
    "HCM SMC": ["S21607","S21310","S22107","S22522","S21731","S22617","S22616","S22016","S22609","S20101"],
    "HCM TAKIGAWA": ["S21622","S22530","S22304","S21635"],
    "HCM VSAP DN": ["S22209","S22208","S22627","S22251","S22015","S20809","S22611","S22606"],
    "HCM-CS3": ["S22605","S21615","S22532","S22528","H22335","S22527","S22201","H22313","S22305","S21106","S22624","S22244","S22515","S22024","S22613","S21704","S20411","S21642"],
    "HN AEON HUE": ["H22340"],
    "Japan": ["S22031"],
    "Thai Lan": ["S22233","S22018"],
  },
  "S-ED": {}
};

const PROJECTS_DB_KEY = 'ot_manager_projects_db_v1';
let PROJECTS_DB = null; // groups -> project name -> {employees:[staffCode..], pm, plan, reason, approvedBy, note}

function loadProjectsDB() {
  try {
    const raw = localStorage.getItem(PROJECTS_DB_KEY);
    if (raw) { PROJECTS_DB = JSON.parse(raw); return; }
  } catch(e) {}
  // Chưa có dữ liệu lưu trước đó — khởi tạo từ seed (chỉ chạy đúng 1 lần duy nhất)
  PROJECTS_DB = {};
  Object.keys(PROJECTS_SEED).forEach(group => {
    PROJECTS_DB[group] = {};
    Object.entries(PROJECTS_SEED[group]).forEach(([proj, codes]) => {
      PROJECTS_DB[group][proj] = { employees: [...codes], pm:'', plan:'', reason:'', approvedBy:'', note:'' };
    });
  });
  saveProjectsDB();
}
function saveProjectsDB() { try { localStorage.setItem(PROJECTS_DB_KEY, JSON.stringify(PROJECTS_DB)); } catch(e) {} }

function projectGroups() { return Object.keys(PROJECTS_DB || {}); }
function projectsInGroup(group) { return Object.keys((PROJECTS_DB && PROJECTS_DB[group]) || {}); }
function findEmployeeProject(staffCode) {
  for (const group of projectGroups()) {
    for (const proj of projectsInGroup(group)) {
      if (PROJECTS_DB[group][proj].employees.includes(staffCode)) return { group, proj };
    }
  }
  return null;
}
function addProject(group, name) {
  if (!PROJECTS_DB[group]) PROJECTS_DB[group] = {};
  if (!name || PROJECTS_DB[group][name]) return false;
  PROJECTS_DB[group][name] = { employees:[], pm:'', plan:'', reason:'', approvedBy:'', note:'' };
  saveProjectsDB();
  return true;
}
function renameProject(group, oldName, newName) {
  if (!PROJECTS_DB[group] || !PROJECTS_DB[group][oldName] || !newName || PROJECTS_DB[group][newName]) return false;
  PROJECTS_DB[group][newName] = PROJECTS_DB[group][oldName];
  delete PROJECTS_DB[group][oldName];
  saveProjectsDB();
  return true;
}
function deleteProject(group, name) {
  if (!PROJECTS_DB[group] || !PROJECTS_DB[group][name]) return false;
  delete PROJECTS_DB[group][name];
  saveProjectsDB();
  return true;
}
function moveEmployeeToProject(staffCode, toGroup, toProj) {
  const cur = findEmployeeProject(staffCode);
  if (cur) {
    const arr = PROJECTS_DB[cur.group][cur.proj].employees;
    const idx = arr.indexOf(staffCode);
    if (idx >= 0) arr.splice(idx, 1);
  }
  if (toGroup && toProj && PROJECTS_DB[toGroup] && PROJECTS_DB[toGroup][toProj]) {
    if (!PROJECTS_DB[toGroup][toProj].employees.includes(staffCode)) PROJECTS_DB[toGroup][toProj].employees.push(staffCode);
  }
  saveProjectsDB();
}
// Lấy tên hiển thị NV theo staff code — dò trong WLB_XLS trước (nguồn nhân sự), sau đó DB (chấm công OT).

// ============================================================
//  ACTION PLAN — OVERTIME (OT) MANAGEMENT (tab con của WLB)
// ============================================================
// Lấy tên hiển thị NV theo staff code — dò trong WLB_XLS trước (nguồn nhân sự), sau đó DB (chấm công OT).
function employeeNameByCode(code) {
  const wx = Object.values(WLB_XLS.employees || {}).find(e => e.code === code);
  if (wx) return wx.name;
  for (const mk in DB) {
    const n = DB[mk].names.find(nm => DB[mk].employees[nm]?.staffCode === code);
    if (n) return n;
  }
  return code;
}

// Bấm "Số NV OT: X người" ở Action Plan → chuyển qua Danh sách NV OT, lọc đúng NV của dự án đó.
function viewProjectEmployees(group, proj, mk) {
  const p = PROJECTS_DB[group] && PROJECTS_DB[group][proj];
  if (!p) return;
  empProjectFilter = { group, proj, codes: [...p.employees] };
  if (mk) { empMK = mk; empTab = 'month'; empPeriod = null; }
  goPage('employees', null, true);
}
function clearEmpProjectFilter() {
  empProjectFilter = null;
  renderEmployeeList();
}

function renderActionPlan() {
  const sel = document.getElementById('actionPlanMonthSel');
  const allMk = Object.keys(DB).sort();
  if (sel) {
    const prev = sel.value;
    sel.innerHTML = allMk.map(mk => `<option value="${mk}">${fmtMK(mk)}</option>`).join('') || '<option value="">— Chưa có dữ liệu OT —</option>';
    if (allMk.includes(prev)) sel.value = prev;
    else sel.value = allMk[allMk.length-1] || '';
  }
  const mk = sel ? sel.value : latestOtMk();
  const lbl = document.getElementById('wlbActionMonthLabel');
  if (lbl) lbl.textContent = mk ? `Số liệu OT tháng: ${fmtMK(mk)}` : 'Chưa có dữ liệu OT (chấm công hàng ngày) để tính OT thường/OT đêm.';
  buildActionPlanTable('HCM-EC', 'actionPlanTBodyEC', mk);
  buildActionPlanTableSED('actionPlanTBodyED', mk);
  const syncNote = document.getElementById('actionPlanSyncNote');
  if (syncNote) {
    syncNote.textContent = lastSyncedAt
      ? `Lần đồng bộ gần nhất: ${lastSyncedAt}`
      : SYNC_URL ? '⚠️ Chưa đồng bộ lần nào trong phiên này — nhớ bấm "Lưu & Đồng bộ" sau khi điền xong.' : '⚠️ Chưa cấu hình Google Sheets — vào Cài đặt để bật đồng bộ, nếu không dữ liệu chỉ lưu trên máy này.';
  }
}

// Khung "Duyệt bởi ECM/HODs": 2 nút Duyệt/Từ chối + 1 ô comment riêng — trạng thái + comment lưu
// vào p.approvedBy (dạng "Đạt|Từ chối|" + text comment) để không cần thêm field mới.
function approvalBoxHtml(group, proj, p) {
  const raw = p.approvedBy || '';
  const status = raw.startsWith('APPROVED|') ? 'approved' : raw.startsWith('REJECTED|') ? 'rejected' : '';
  const comment = raw.includes('|') ? raw.slice(raw.indexOf('|')+1) : raw;
  const projEsc = proj.replace(/'/g,"\\'");
  return `
    <div style="display:flex;gap:6px;margin-bottom:6px">
      <button class="btn" style="flex:1;padding:4px 6px;font-size:11px;${status==='approved'?'background:var(--green);color:#fff;border-color:var(--green)':''}" onclick="setApprovalStatus('${group}','${projEsc}','APPROVED')">✅ Duyệt</button>
      <button class="btn" style="flex:1;padding:4px 6px;font-size:11px;${status==='rejected'?'background:#C0392B;color:#fff;border-color:#C0392B':''}" onclick="setApprovalStatus('${group}','${projEsc}','REJECTED')">❌ Từ chối</button>
    </div>
    <textarea rows="2" style="width:100%;border:1px solid var(--border2);border-radius:6px;padding:6px 8px;font-family:inherit;font-size:12px;resize:vertical" placeholder="Comment của ECM/HODs..." onchange="setApprovalComment('${group}','${projEsc}',this.value)">${comment.replace(/</g,'&lt;')}</textarea>`;
}

function buildActionPlanTable(group, tbodyId, mk) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const projNames = projectsInGroup(group).sort();
  if (!projNames.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text2)">Chưa có dự án nào trong nhóm ${group}. Bấm "+ Thêm dự án" ở trên để tạo mới.</td></tr>`;
    return;
  }
  tbody.innerHTML = projNames.map((proj, i) => {
    const p = PROJECTS_DB[group][proj];
    const stats = getProjectOTStats(group, proj, mk);
    const projEsc = proj.replace(/'/g,"\\'");
    const editable = (field, ph) => `<textarea rows="2" style="width:100%;border:1px solid var(--border2);border-radius:6px;padding:6px 8px;font-family:inherit;font-size:12px;resize:vertical" placeholder="${ph}" onchange="saveProjectField('${group}','${projEsc}','${field}',this.value)">${(p[field]||'').replace(/</g,'&lt;')}</textarea>`;
    const isRejected = (p.approvedBy||'').startsWith('REJECTED|');
    return `<tr class="${isRejected ? 'row-rejected' : ''}">
      <td style="text-align:center;color:var(--text2)">${i+1}</td>
      <td>
        <div style="font-weight:600;cursor:pointer;color:var(--accent)" onclick="toggleProjectEmployees('${group}','${projEsc}')">${proj} <span style="font-weight:400;color:var(--text3);font-size:11px">(${p.employees.length} NV) ▾</span></div>
        <div style="margin-top:4px;display:flex;gap:6px">
          <button class="btn" style="padding:2px 8px;font-size:10.5px" onclick="renameProjectPrompt('${group}','${projEsc}')">Đổi tên</button>
          <button class="btn btn-danger" style="padding:2px 8px;font-size:10.5px" onclick="deleteProjectConfirm('${group}','${projEsc}')">Xoá</button>
        </div>
        <div id="projEmpBox_${group}_${proj.replace(/[^a-zA-Z0-9]/g,'_')}" style="display:none;margin-top:8px;padding:8px;background:var(--bg2);border-radius:8px;font-size:11.5px"></div>
      </td>
      <td><input type="text" value="${(p.pm||'').replace(/"/g,'&quot;')}" placeholder="Tên PM" style="width:100%;border:1px solid var(--border2);border-radius:6px;padding:5px 8px;font-size:12px" onchange="saveProjectField('${group}','${projEsc}','pm',this.value)"></td>
      <td style="font-size:12px;line-height:1.8;white-space:nowrap">
        OT thường: <strong>${stats.otNormal}h</strong><br>
        OT đêm: <strong style="color:#C0392B">${stats.otNight}h</strong><br>
        Số NV OT: <strong style="cursor:pointer;color:var(--accent);text-decoration:underline" onclick="viewProjectEmployees('${group}','${projEsc}','${mk}')" title="Bấm để xem đúng ${stats.nvCount} NV này ở Danh sách NV OT">${stats.nvCount}</strong> người<br>
        <span style="color:${stats.overKpi>0?'#E8A33D':'var(--text3)'}">Vượt KPI (45h): <strong>${stats.overKpi}</strong> NV</span><br>
        <span style="color:${stats.overPay>0?'#C0392B':'var(--text3)'}">Vượt Chi trả (70h): <strong>${stats.overPay}</strong> NV</span>
      </td>
      <td>${editable('reason','Lý do...')}</td>
      <td>${editable('plan','Kế hoạch tháng tiếp theo...')}</td>
      <td>${approvalBoxHtml(group, proj, p)}</td>
      <td>${editable('note','Ghi chú...')}</td>
    </tr>`;
  }).join('');
}

// Phần S-ED: KHÔNG dùng dự án riêng trong PROJECTS_DB — lấy chung toàn bộ NV có dept=S-ED
// trực tiếp từ dữ liệu OT (giống hệt "Danh sách NV OT"), vì S-ED không tách theo site/dự án.
function buildActionPlanTableSED(tbodyId, mk) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const group = 'S-ED';
  const manualProjs = projectsInGroup(group).sort();

  // Hàng "S-ED (tất cả)" tự động — luôn hiện đầu tiên. Dùng ĐÚNG getTotals() (giống Danh sách NV OT).
  let otNormal = 0, otNight = 0, nvCount = 0, codes = [], overKpiSed = 0, overPaySed = 0;
  if (mk && DB[mk]) {
    const periods = buildPeriods(mk);
    const periodIdx = periods.length ? periods.length - 1 : null;
    const totals = getTotals(mk, 'S-ED', periodIdx);
    totals.forEach(t => {
      const night = Math.min(t.nightTotal || 0, t.total);
      otNormal += (t.total - night); otNight += night;
      if (t.total > 0) nvCount++;
      if (t.staffCode) codes.push(t.staffCode);
      if (t.total > 45) overKpiSed++;
      if (t.total > 70) overPaySed++;
    });
  }
  const sedKey = '__SED_ALL__';
  if (!PROJECTS_DB[group][sedKey]) PROJECTS_DB[group][sedKey] = { employees:[], pm:'', plan:'', reason:'', approvedBy:'', note:'' };
  const pAuto = PROJECTS_DB[group][sedKey];
  const isAutoRejected = (pAuto.approvedBy||'').startsWith('REJECTED|');
  const rowsHtml = [];
  rowsHtml.push(`<tr class="${isAutoRejected ? 'row-rejected' : ''}">
    <td style="text-align:center;color:var(--text2)">1</td>
    <td><div style="font-weight:600">S-ED (tất cả)</div><div style="font-size:10.5px;color:var(--text3);margin-top:2px">Tự động lấy từ Danh sách NV OT</div></td>
    <td><input type="text" value="${(pAuto.pm||'').replace(/"/g,'&quot;')}" placeholder="Tên PM" style="width:100%;border:1px solid var(--border2);border-radius:6px;padding:5px 8px;font-size:12px" onchange="saveProjectField('${group}','${sedKey}','pm',this.value)"></td>
    <td style="font-size:12px;line-height:1.8;white-space:nowrap">
      OT thường: <strong>${Math.round((otNormal)*10)/10}h</strong><br>
      OT đêm: <strong style="color:#C0392B">${Math.round(otNight*10)/10}h</strong><br>
      Số NV OT: <strong style="cursor:pointer;color:var(--accent);text-decoration:underline" onclick="viewProjectEmployeesByCodes('${JSON.stringify(codes).replace(/"/g,'&quot;')}','S-ED','${mk}')">${nvCount}</strong> người<br>
      <span style="color:${overKpiSed>0?'#E8A33D':'var(--text3)'}">Vượt KPI (45h): <strong>${overKpiSed}</strong> NV</span><br>
      <span style="color:${overPaySed>0?'#C0392B':'var(--text3)'}">Vượt Chi trả (70h): <strong>${overPaySed}</strong> NV</span>
    </td>
    <td><textarea rows="2" style="width:100%;border:1px solid var(--border2);border-radius:6px;padding:6px 8px;font-family:inherit;font-size:12px;resize:vertical" placeholder="Lý do..." onchange="saveProjectField('${group}','${sedKey}','reason',this.value)">${(pAuto.reason||'').replace(/</g,'&lt;')}</textarea></td>
    <td><textarea rows="2" style="width:100%;border:1px solid var(--border2);border-radius:6px;padding:6px 8px;font-family:inherit;font-size:12px;resize:vertical" placeholder="Kế hoạch tháng tiếp theo..." onchange="saveProjectField('${group}','${sedKey}','plan',this.value)">${(pAuto.plan||'').replace(/</g,'&lt;')}</textarea></td>
    <td>${approvalBoxHtml(group, sedKey, pAuto)}</td>
    <td><textarea rows="2" style="width:100%;border:1px solid var(--border2);border-radius:6px;padding:6px 8px;font-family:inherit;font-size:12px;resize:vertical" placeholder="Ghi chú..." onchange="saveProjectField('${group}','${sedKey}','note',this.value)">${(pAuto.note||'').replace(/</g,'&lt;')}</textarea></td>
  </tr>`);

  // Các dự án S-ED được thêm thủ công (nếu có) — hiện tiếp bên dưới, giống HCM-EC
  manualProjs.filter(p => p !== sedKey).forEach((proj, idx) => {
    const p = PROJECTS_DB[group][proj];
    const stats = getProjectOTStats(group, proj, mk);
    const projEsc = proj.replace(/'/g,"\\'");
    const editable = (field, ph) => `<textarea rows="2" style="width:100%;border:1px solid var(--border2);border-radius:6px;padding:6px 8px;font-family:inherit;font-size:12px;resize:vertical" placeholder="${ph}" onchange="saveProjectField('${group}','${projEsc}','${field}',this.value)">${(p[field]||'').replace(/</g,'&lt;')}</textarea>`;
    const isRejected2 = (p.approvedBy||'').startsWith('REJECTED|');
    rowsHtml.push(`<tr class="${isRejected2 ? 'row-rejected' : ''}">
      <td style="text-align:center;color:var(--text2)">${idx+2}</td>
      <td>
        <div style="font-weight:600;cursor:pointer;color:var(--accent)" onclick="toggleProjectEmployees('${group}','${projEsc}')">${proj} <span style="font-weight:400;color:var(--text3);font-size:11px">(${p.employees.length} NV) ▾</span></div>
        <div style="margin-top:4px;display:flex;gap:6px">
          <button class="btn" style="padding:2px 8px;font-size:10.5px" onclick="renameProjectPrompt('${group}','${projEsc}')">Đổi tên</button>
          <button class="btn btn-danger" style="padding:2px 8px;font-size:10.5px" onclick="deleteProjectConfirm('${group}','${projEsc}')">Xoá</button>
        </div>
        <div id="projEmpBox_${group}_${proj.replace(/[^a-zA-Z0-9]/g,'_')}" style="display:none;margin-top:8px;padding:8px;background:var(--bg2);border-radius:8px;font-size:11.5px"></div>
      </td>
      <td><input type="text" value="${(p.pm||'').replace(/"/g,'&quot;')}" placeholder="Tên PM" style="width:100%;border:1px solid var(--border2);border-radius:6px;padding:5px 8px;font-size:12px" onchange="saveProjectField('${group}','${projEsc}','pm',this.value)"></td>
      <td style="font-size:12px;line-height:1.8;white-space:nowrap">
        OT thường: <strong>${stats.otNormal}h</strong><br>
        OT đêm: <strong style="color:#C0392B">${stats.otNight}h</strong><br>
        Số NV OT: <strong style="cursor:pointer;color:var(--accent);text-decoration:underline" onclick="viewProjectEmployees('${group}','${projEsc}','${mk}')">${stats.nvCount}</strong> người<br>
        <span style="color:${stats.overKpi>0?'#E8A33D':'var(--text3)'}">Vượt KPI (45h): <strong>${stats.overKpi}</strong> NV</span><br>
        <span style="color:${stats.overPay>0?'#C0392B':'var(--text3)'}">Vượt Chi trả (70h): <strong>${stats.overPay}</strong> NV</span>
      </td>
      <td>${editable('reason','Lý do...')}</td>
      <td>${editable('plan','Kế hoạch tháng tiếp theo...')}</td>
      <td>${approvalBoxHtml(group, proj, p)}</td>
      <td>${editable('note','Ghi chú...')}</td>
    </tr>`);
  });
  tbody.innerHTML = rowsHtml.join('');
}

function setApprovalStatus(group, proj, status) {
  const p = PROJECTS_DB[group]?.[proj]; if (!p) return;
  const comment = (p.approvedBy||'').includes('|') ? p.approvedBy.slice(p.approvedBy.indexOf('|')+1) : (p.approvedBy||'');
  p.approvedBy = `${status}|${comment}`;
  saveProjectsDB();
  renderActionPlan();
  toast(status === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối');
}
function setApprovalComment(group, proj, comment) {
  const p = PROJECTS_DB[group]?.[proj]; if (!p) return;
  const status = (p.approvedBy||'').startsWith('APPROVED|') ? 'APPROVED' : (p.approvedBy||'').startsWith('REJECTED|') ? 'REJECTED' : '';
  p.approvedBy = status ? `${status}|${comment}` : comment;
  saveProjectsDB();
}
// Xem danh sách NV theo 1 mảng staff code cụ thể (dùng cho hàng "S-ED (tất cả)" tự động,
// không nằm trong PROJECTS_DB nên không dùng chung viewProjectEmployees được).
function viewProjectEmployeesByCodes(codesJson, label, mk) {
  let codes = [];
  try { codes = JSON.parse(codesJson); } catch(e) {}
  empProjectFilter = { group: label, proj: '(tất cả)', codes };
  if (mk) { empMK = mk; empTab = 'month'; empPeriod = null; }
  goPage('employees', null, true);
}



function saveProjectField(group, proj, field, value) {
  if (!PROJECTS_DB[group] || !PROJECTS_DB[group][proj]) return;
  PROJECTS_DB[group][proj][field] = value;
  saveProjectsDB();
}

function promptAddProject(group) {
  const name = prompt(`Tên dự án mới (nhóm ${group}):`);
  if (!name) return;
  if (addProject(group, name.trim())) { toast(`Đã thêm dự án "${name.trim()}"`); renderActionPlan(); }
  else toast('Tên dự án đã tồn tại hoặc không hợp lệ');
}
function renameProjectPrompt(group, proj) {
  const name = prompt('Đổi tên dự án thành:', proj);
  if (!name || name.trim() === proj) return;
  if (renameProject(group, proj, name.trim())) { toast('Đã đổi tên dự án'); renderActionPlan(); }
  else toast('Tên mới đã tồn tại hoặc không hợp lệ');
}
function deleteProjectConfirm(group, proj) {
  if (!requireAdmin('xoá dự án')) return;
  const n = (PROJECTS_DB[group]?.[proj]?.employees || []).length;
  if (!confirm(`Xoá dự án "${proj}"? ${n} nhân viên trong dự án này sẽ trở thành "chưa gán dự án".`)) return;
  deleteProject(group, proj);
  toast('Đã xoá dự án');
  renderActionPlan();
}

function toggleProjectEmployees(group, proj) {
  const boxId = `projEmpBox_${group}_${proj.replace(/[^a-zA-Z0-9]/g,'_')}`;
  const box = document.getElementById(boxId);
  if (!box) return;
  if (box.style.display === 'block') { box.style.display = 'none'; return; }
  // Đóng các box khác đang mở để đỡ rối
  document.querySelectorAll('[id^="projEmpBox_"]').forEach(b => b.style.display = 'none');
  renderProjectEmployeeBox(group, proj, box);
  box.style.display = 'block';
}
function renderProjectEmployeeBox(group, proj, box) {
  const p = PROJECTS_DB[group][proj];
  const allProjOptions = [];
  projectGroups().forEach(g => projectsInGroup(g).forEach(pr => allProjOptions.push({g, pr})));
  box.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">
      ${p.employees.map(code => `
        <span style="display:inline-flex;align-items:center;gap:5px;background:var(--bg);border:1px solid var(--border2);border-radius:999px;padding:3px 6px 3px 10px;font-family:var(--font-mono)">
          ${code} — ${employeeNameByCode(code)}
          <select style="font-size:10px;border:none;background:transparent;cursor:pointer" onchange="if(this.value){moveEmployeeToProject('${code}',this.value.split('|')[0],this.value.split('|')[1]);renderActionPlan();toast('Đã chuyển NV');}">
            <option value="">Chuyển đến...</option>
            ${allProjOptions.filter(o=>!(o.g===group&&o.pr===proj)).map(o=>`<option value="${o.g}|${o.pr}">${o.g} / ${o.pr}</option>`).join('')}
          </select>
          <span style="cursor:pointer;color:var(--red)" title="Bỏ khỏi dự án" onclick="moveEmployeeToProject('${code}',null,null);renderActionPlan();toast('Đã bỏ NV khỏi dự án');">✕</span>
        </span>`).join('') || '<span style="color:var(--text3)">Chưa có nhân viên nào.</span>'}
    </div>
    <div style="display:flex;gap:6px">
      <input type="text" id="addEmpInput_${group}_${proj.replace(/[^a-zA-Z0-9]/g,'_')}" placeholder="Nhập Staff Code để thêm..." style="flex:1;border:1px solid var(--border2);border-radius:6px;padding:5px 8px;font-size:11.5px">
      <button class="btn" style="padding:4px 10px;font-size:11px" onclick="(function(){
        const inp=document.getElementById('addEmpInput_${group}_${proj.replace(/[^a-zA-Z0-9]/g,'_')}');
        const code=inp.value.trim(); if(!code) return;
        moveEmployeeToProject(code,'${group}','${proj.replace(/'/g,"\\'")}');
        renderActionPlan(); toast('Đã thêm NV vào dự án');
      })()">+ Thêm</button>
    </div>`;
}


// Tính OT thường + OT đêm + số NV có OT, cho 1 dự án cụ thể — lấy từ DB chấm công hàng ngày
// (không phải WLB_XLS, vì WLB_XLS không tách riêng OT ngày/đêm). Dùng tháng gần nhất có dữ liệu.
function getProjectOTStats(group, projectName, mk) {
  const proj = PROJECTS_DB[group] && PROJECTS_DB[group][projectName];
  if (!proj || !mk || !DB[mk]) return { otNormal: 0, otNight: 0, nvCount: 0, overKpi: 0, overPay: 0 };
  const codes = new Set(proj.employees);
  // Dùng ĐÚNG getTotals() — cùng 1 hàm mà trang "Danh sách NV OT" đang dùng để hiển thị — đảm bảo
  // 2 nơi luôn ra cùng 1 con số, không tính lại bằng công thức khác dễ gây lệch.
  const periods = buildPeriods(mk);
  const periodIdx = periods.length ? periods.length - 1 : null;
  const totals = getTotals(mk, '__all__', periodIdx);
  let otNormal = 0, otNight = 0, nvCount = 0, overKpi = 0, overPay = 0;
  totals.forEach(t => {
    if (!t.staffCode || !codes.has(t.staffCode)) return;
    const night = Math.min(t.nightTotal || 0, t.total);
    otNormal += (t.total - night);
    otNight += night;
    if (t.total > 0) nvCount++;
    // % Giới hạn KPI = mốc 45h/tháng, % Giới hạn Chi trả = mốc 70h/tháng — đếm số NV vượt mỗi mốc.
    if (t.total > 45) overKpi++;
    if (t.total > 70) overPay++;
  });
  return { otNormal: Math.round(otNormal*10)/10, otNight: Math.round(otNight*10)/10, nvCount, overKpi, overPay };
}
// ============================================================
//  PHÂN TÍCH THEO DỰ ÁN (dùng chung cho WLB / So sánh OT / OT phòng ban)
// ============================================================
// OT của 1 dự án, tổng quát cho MỌI loại kỳ (tuần/tháng): periodIdx=null → luỹ kế (tháng),
// periodIdx=số cụ thể + useDelta=true → đúng riêng tuần đó (không cộng dồn), khớp quy ước
// "Theo tuần" đã dùng khắp app (deltaTotal). Dùng chung 1 nguồn getTotals() để luôn khớp số.
function getProjectOTForPeriod(group, proj, mk, periodIdx, useDelta) {
  const p = PROJECTS_DB[group] && PROJECTS_DB[group][proj];
  if (!p || !mk || !DB[mk]) return { total: 0, nvCount: 0 };
  const codes = new Set(p.employees);
  const totals = getTotals(mk, '__all__', periodIdx);
  let total = 0, nvCount = 0;
  totals.forEach(t => {
    if (!t.staffCode || !codes.has(t.staffCode)) return;
    const v = useDelta ? (t.deltaTotal||0) : t.total;
    total += v;
    if (v > 0) nvCount++;
  });
  return { total: Math.round(total*10)/10, nvCount };
}
// WLB (off÷OT) của 1 dự án cho ĐÚNG 1 tháng dương lịch (monthNum 1-12) — lấy từ WLB_XLS
// (nguồn nhân sự), vì Off Day chỉ có ở đó, không có trong DB chấm công hàng ngày.
function getProjectWlbForMonth(group, proj, monthNum) {
  const p = PROJECTS_DB[group] && PROJECTS_DB[group][proj];
  if (!p) return { ot: 0, off: 0, wlb: null };
  let ot = 0, off = 0;
  p.employees.forEach(code => {
    const e = Object.values(WLB_XLS.employees || {}).find(x => x.code === code);
    if (!e) return;
    ot += (e.ot[monthNum] || 0);
    off += (e.off[monthNum] || 0);
  });
  return { ot: Math.round(ot*10)/10, off: Math.round(off*10)/10, wlb: wlbRatio(off, ot) };
}
// WLB của 1 dự án cho 1 NHÓM THÁNG (quý chồng lấp) — cộng dồn OT + Off trước rồi mới chia,
// đúng công thức Excel (không phải trung bình cộng của từng tháng riêng lẻ).
function getProjectWlbForMonths(group, proj, monthNums) {
  const p = PROJECTS_DB[group] && PROJECTS_DB[group][proj];
  if (!p) return { ot: 0, off: 0, wlb: null };
  let ot = 0, off = 0;
  p.employees.forEach(code => {
    const e = Object.values(WLB_XLS.employees || {}).find(x => x.code === code);
    if (!e) return;
    monthNums.forEach(m => { ot += (e.ot[m]||0); off += (e.off[m]||0); });
  });
  return { ot: Math.round(ot*10)/10, off: Math.round(off*10)/10, wlb: wlbRatio(off, ot) };
}

// ── UI: nút "▾ Xem theo dự án" — bấm vào hiện bảng mini liệt kê từng dự án HCM-EC + giá trị.
// `valueFn(proj)` trả về {label, value, extra} để hiển thị — dùng chung cho mọi trang.
function projectExpandButtonHtml(boxId) {
  return `<button class="btn" style="padding:3px 10px;font-size:11px;margin-left:8px" onclick="toggleGenericProjectBox('${boxId}')">▾ Xem theo dự án</button>
    <div id="${boxId}" style="display:none;margin-top:8px"></div>`;
}
function toggleGenericProjectBox(boxId) {
  const box = document.getElementById(boxId);
  if (!box) return;
  box.style.display = box.style.display === 'block' ? 'none' : 'block';
}
// renderFn(box) tự build nội dung — cho phép mỗi trang tự định nghĩa cách tính/hiển thị,
// nhưng dùng chung khung bảng để đồng nhất giao diện.
function fillProjectBox(boxId, rows, valueLabel) {
  const box = document.getElementById(boxId);
  if (!box) return;
  if (!rows.length) { box.innerHTML = '<div style="font-size:11.5px;color:var(--text2);padding:8px">Chưa có dự án nào (HCM-EC).</div>'; return; }
  box.innerHTML = `<div class="tbl-wrap tbl-grid"><table style="font-size:11.5px">
    <thead><tr><th>Dự án</th><th style="text-align:right">${valueLabel}</th><th style="text-align:right">Số NV</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${r.name}</td><td style="text-align:right;font-family:var(--font-mono);font-weight:600">${r.display}</td><td style="text-align:right;font-family:var(--font-mono);color:var(--text2)">${r.nv}</td></tr>`).join('')}</tbody>
  </table></div>`;
}

// ── UI: biểu đồ cột ngang OT/WLB theo dự án — dùng chung, chỉ cần truyền labels+values+màu.
function renderGenericProjectBarChart(store, killFn, chartId, canvasEl, emptyEl, entries, unitSuffix, color) {
  if (!canvasEl) return;
  killFn(chartId);
  if (!entries.length) {
    if (emptyEl) emptyEl.style.display = 'block';
    canvasEl.style.display = 'none';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  canvasEl.style.display = 'block';
  const barH = Math.max(220, entries.length * 26 + 60);
  canvasEl.parentElement.style.height = barH + 'px';
  safeMakeChart(store, killFn, chartId, canvasEl, {
    type: 'bar',
    data: { labels: entries.map(e => e.name),
      datasets: [{ data: entries.map(e => e.value), backgroundColor: color || '#2D6CDF', borderWidth: 0, borderRadius: 3 }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      layout: { padding: { right: 40, top: 4, bottom: 4, left: 4 } },
      plugins: { legend: { display: false }, barValueLabels: { suffix: unitSuffix || '' },
        tooltip: { callbacks: { label: c => ` ${c.raw}${unitSuffix||''}` } } },
      scales: {
        x: { grid: { color: 'rgba(128,128,128,0.12)' }, ticks: { font: { size: 10 } },
             suggestedMax: Math.ceil(Math.max(1, ...entries.map(e=>e.value)) * 1.15) },
        y: { grid: { display: false }, ticks: { font: { size: 10 } } } }
    }
  });
}

function latestOtMk() {
  const keys = Object.keys(DB).sort();
  return keys.length ? keys[keys.length-1] : null;
}

const WLB_XLS_KEY = 'ot_manager_wlb_xls_v1';
let WLB_XLS = { year: new Date().getFullYear(), employees: {} }; // employees[staffCode] = {name,dept,position,ot:{1..12},off:{1..12}}

function saveWlbXls() { try { localStorage.setItem(WLB_XLS_KEY, JSON.stringify(WLB_XLS)); } catch(e) {} }
function loadWlbXls() {
  try { const raw = localStorage.getItem(WLB_XLS_KEY); if (raw) WLB_XLS = JSON.parse(raw); } catch(e) {}
}

const MONTH_SHORT_EN = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const MONTH_NAMES_VI = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

// Chuẩn hoá tên phòng ban từ file Excel (tên đầy đủ tiếng Việt, có thể viết hoa/thường khác nhau
// giữa các dòng) về đúng MÃ NGẮN đã dùng thống nhất khắp app (S-AD, S-AZ...) — theo đúng bảng
// quy đổi công ty cung cấp. So khớp không phân biệt hoa/thường và khoảng trắng thừa.
const DEPT_NAME_MAP = {
  'phong hanh chinh tong hop': 'S-AD',
  'phong hse': 'S-AZ',
  'phong thiet ke - du toan': 'S-ED',
  'phong thiet ke du toan': 'S-ED',
  'phong kinh doanh': 'S-PD',
  'phong cung ung': 'S-PU',
  'phong qa/qc': 'S-QC',
  'phong qa qc': 'S-QC',
  'phong xay dung': 'HCM-EC',
};
function normalizeDeptName(raw) {
  const s = String(raw||'').trim();
  if (!s) return s;
  // Bỏ dấu tiếng Việt + hạ chữ thường + gộp khoảng trắng, để so khớp không phân biệt hoa/thường/dấu.
  const key = s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/gi,'d').replace(/\s+/g,' ').trim();
  return DEPT_NAME_MAP[key] || s; // không khớp → giữ nguyên tên gốc (phòng ban lạ, không tự đoán)
}

// Dò 1 sheet: tìm dòng header có tên tháng (Jan/Feb/Mar...), rồi cột Staff Code / Name / Dept —
// dùng chung cho cả OT List lẫn Off-Day List vì 2 sheet có cấu trúc rất giống nhau.
function parseMonthlySheet(ws) {
  const aoa = XLSX.utils.sheet_to_json(ws, {header:1, raw:true, defval:null});
  const aoaText = XLSX.utils.sheet_to_json(ws, {header:1, raw:false, defval:null});
  let year = new Date().getFullYear();
  for (let r = 0; r < Math.min(5, aoaText.length); r++) {
    for (const cell of (aoaText[r]||[])) {
      const m = String(cell||'').match(/20\d{2}/);
      if (m) { year = parseInt(m[0]); break; }
    }
  }
  let headerRowIdx = -1, monthCols = {}, codeCol = -1, nameCol = -1, deptCol = -1, positionCol = -1;
  for (let r = 0; r < Math.min(12, aoaText.length); r++) {
    const row = aoaText[r] || [];
    const monthHits = row.filter(c => MONTH_SHORT_EN.includes(String(c||'').trim().toLowerCase().slice(0,3))).length;
    if (monthHits >= 3) {
      headerRowIdx = r;
      row.forEach((cell, ci) => {
        const s = String(cell||'').trim().toLowerCase();
        const mIdx = MONTH_SHORT_EN.indexOf(s.slice(0,3));
        if (mIdx >= 0 && !(ci in monthCols)) monthCols[ci] = mIdx + 1;
        if (/staff.{0,2}code|mã.{0,2}nv|msnv/i.test(s)) codeCol = ci;
        if (/staff.{0,2}name|họ.{0,2}tên|ho.{0,2}ten/i.test(s)) nameCol = ci;
        if (/^dept\.?$|phòng ban|phong ban/i.test(s)) deptCol = ci;
        if (/position|chức vụ|chuc vu/i.test(s)) positionCol = ci;
      });
      if (codeCol < 0 && aoaText[r+2]) {
        aoaText[r+2].forEach((cell, ci) => { if (/^[A-Z]?\d{4,6}$|^S\d{4,6}$|^H\d{4,6}$/i.test(String(cell||'').trim())) codeCol = ci; });
      }
      if (nameCol < 0 && codeCol >= 0) nameCol = codeCol + 1;
      break;
    }
  }
  if (headerRowIdx < 0 || !Object.keys(monthCols).length) return null;
  const rows = [];
  for (let r = headerRowIdx + 1; r < aoa.length; r++) {
    const rowText = aoaText[r] || [];
    const row = aoa[r] || [];
    const code = codeCol >= 0 ? String(rowText[codeCol]||'').trim() : '';
    const name = nameCol >= 0 ? String(rowText[nameCol]||'').trim() : '';
    if (!name && !code) continue;
    const dept = normalizeDeptName(deptCol >= 0 ? String(rowText[deptCol]||'').trim() : '');
    const position = positionCol >= 0 ? String(rowText[positionCol]||'').trim() : '';
    const byMonth = {};
    for (const [colIdxStr, monthNum] of Object.entries(monthCols)) {
      const raw = row[parseInt(colIdxStr)];
      if (raw === null || raw === undefined || raw === '') continue;
      const val = parseFloat(String(raw).replace(/[^\d.\-]/g,''));
      if (!isNaN(val)) byMonth[monthNum] = val;
    }
    rows.push({ code, name: name||code, dept, position, byMonth });
  }
  return { year, rows };
}

async function handleWlbMonthlyExcel(inp) {
  const files = Array.from(inp.files || []);
  if (!files.length) return;
  let otRows = null, offRows = null, year = WLB_XLS.year;

  for (const file of files) {
    const bin = await new Promise((res,rej) => {
      const r = new FileReader(); r.onload = e=>res(e.target.result); r.onerror=rej; r.readAsBinaryString(file);
    });
    try {
      const wb = XLSX.read(bin, {type:'binary'});
      let otSheetName = null, offSheetName = null;
      wb.SheetNames.forEach(sn => {
        if (/^ot\s*list$|ot.?list/i.test(sn)) otSheetName = sn;
        if (/off.?day.?list|off.?day/i.test(sn)) offSheetName = sn;
      });
      if (otSheetName) { const parsed = parseMonthlySheet(wb.Sheets[otSheetName]); if (parsed) { otRows = parsed.rows; year = parsed.year; } }
      if (offSheetName) { const parsed = parseMonthlySheet(wb.Sheets[offSheetName]); if (parsed) { offRows = parsed.rows; year = parsed.year; } }
    } catch(e) { console.error('WLB excel parse error:', e); toast('Lỗi đọc file: ' + e.message); }
  }
  inp.value = '';

  if (!otRows && !offRows) {
    document.getElementById('wlbXlsLog').textContent = '❌ Không tìm thấy sheet "OT List" hoặc "Off-Day List" hợp lệ trong file.';
    toast('Không đọc được file — cần đúng 2 sheet "OT List" và "Off-Day List"');
    return;
  }

  WLB_XLS = { year, employees: {} };
  const ensure = (code, name, dept, position) => {
    const key = code || ('N:'+name);
    if (!WLB_XLS.employees[key]) WLB_XLS.employees[key] = { name, code, dept: dept||'', position: position||'', ot:{}, off:{} };
    if (dept && !WLB_XLS.employees[key].dept) WLB_XLS.employees[key].dept = dept;
    return WLB_XLS.employees[key];
  };
  (otRows||[]).forEach(r => { const e = ensure(r.code, r.name, r.dept, r.position); Object.assign(e.ot, r.byMonth); });
  (offRows||[]).forEach(r => { const e = ensure(r.code, r.name, r.dept, r.position); Object.assign(e.off, r.byMonth); });

  saveWlbXls();
  const empCount = Object.keys(WLB_XLS.employees).length;
  const monthsWithData = new Set();
  Object.values(WLB_XLS.employees).forEach(e => {
    Object.keys(e.ot).forEach(m=>monthsWithData.add(+m));
    Object.keys(e.off).forEach(m=>monthsWithData.add(+m));
  });
  const mArr = [...monthsWithData].sort((a,b)=>a-b);
  document.getElementById('wlbXlsLog').textContent = empCount
    ? `✅ Đã đọc ${empCount} nhân viên · năm ${year} · ${mArr.length} tháng có dữ liệu: ${mArr.map(m=>MONTH_NAMES_VI[m-1]).join(', ')}${!otRows?' ⚠️ thiếu sheet OT List':''}${!offRows?' ⚠️ thiếu sheet Off-Day List':''}`
    : '❌ Không đọc được dữ liệu nhân viên nào.';
  renderWlbSummary();
  renderWlb();
  toast(empCount ? `Upload WLB Excel thành công! (${empCount} NV, năm ${year})` : 'Lỗi đọc file WLB Excel');
}

// ── Hàm tính toán trên WLB_XLS (dùng cho toàn bộ trang WLB) ──
function wlbXlsAllDepts() {
  const set = new Set();
  Object.values(WLB_XLS.employees).forEach(e => { if (e.dept) set.add(e.dept); });
  return [...set].sort();
}
function wlbXlsMonthsWithData() {
  const set = new Set();
  Object.values(WLB_XLS.employees).forEach(e => {
    Object.keys(e.ot).forEach(m=>set.add(+m));
    Object.keys(e.off).forEach(m=>set.add(+m));
  });
  return [...set].sort((a,b)=>a-b);
}
function wlbXlsTotalOT(monthNum, dept) {
  return Object.values(WLB_XLS.employees)
    .filter(e => !dept || dept==='__all__' || e.dept===dept)
    .reduce((s,e)=> s + (e.ot[monthNum]||0), 0);
}
function wlbXlsTotalOff(monthNum, dept) {
  return Object.values(WLB_XLS.employees)
    .filter(e => !dept || dept==='__all__' || e.dept===dept)
    .reduce((s,e)=> s + (e.off[monthNum]||0), 0);
}
// Nhóm Quý kiểu CHỒNG LẤP 3 tháng liên tiếp, đúng công thức Excel: Q1=T1+T2+T3, Q2=T3+T4+T5...
function wlbXlsQuarterGroups() {
  const months = wlbXlsMonthsWithData();
  const groups = [];
  for (let i = 0; i + 2 < months.length; i += 2) {
    const ms = [months[i], months[i+1], months[i+2]];
    groups.push({ key:'RQ'+(groups.length+1), label:`Quý ${groups.length+1} (${MONTH_NAMES_VI[ms[0]-1]}–${MONTH_NAMES_VI[ms[2]-1]})`, months: ms });
  }
  return groups;
}
// Trả về danh sách "mk" (định dạng YYYY-MM) tương ứng các tháng có dữ liệu trong WLB_XLS —
// để gộp vào allMks của trang WLB, đảm bảo dropdown tháng vẫn hiện đủ dù người dùng CHỈ
// upload file Excel WLB (chưa có dữ liệu OT/Off Day nào khác).
function wlbXlsMks() {
  return wlbXlsMonthsWithData().map(m => `${WLB_XLS.year}-${String(m).padStart(2,'0')}`);
}
// Kiểm tra "đã có dữ liệu Off Day cho tháng này chưa" — tính cả 2 nguồn (OFF_DB cũ hoặc
// WLB_XLS mới) để không báo nhầm "chưa có Off Day" khi dữ liệu thực ra đến từ file Excel WLB.
function hasOffDataForMk(mk) {
  if (OFF_DB[mk]) return true;
  const monthNum = parseInt(String(mk).split('-')[1], 10);
  return Object.keys(WLB_XLS.employees).length > 0 && wlbXlsMonthsWithData().includes(monthNum);
}

// Lấy tổng số ngày Off cho 1 tháng, 1 phòng ban.
// Hỗ trợ cả 2 format: offTotal (monthly summary) và days[] (daily format cũ).
function getOffDays(mk, deptFilter) {
  // Ưu tiên dữ liệu từ file Excel WLB (OT List + Off-Day List) nếu đã upload — vì đây là
  // nguồn ĐÚNG THÁNG DƯƠNG LỊCH khớp chính xác với OT cùng file, tránh lệch ngày so với
  // cách tính cũ (Off Day theo tháng dương lịch nhưng OT theo chu kỳ lương 16→15).
  const monthNum = parseInt(String(mk).split('-')[1], 10);
  if (Object.keys(WLB_XLS.employees).length && wlbXlsMonthsWithData().includes(monthNum)) {
    return Math.round(wlbXlsTotalOff(monthNum, deptFilter)*10)/10;
  }
  const m = OFF_DB[mk]; if (!m) return 0;
  const names = (deptFilter && deptFilter !== '__all__') ? (m.depts[deptFilter] || []) : m.names;
  return names.reduce((s, n) => {
    const e = m.employees[n]; if (!e) return s;
    return s + (typeof e.offTotal === 'number' ? e.offTotal : (Array.isArray(e.days) ? e.days.length : 0));
  }, 0);
}

function getTotalOT(mk, deptFilter) {
  // Ưu tiên OT từ file Excel WLB (cùng nguồn với Off Day, cùng tháng dương lịch) nếu đã upload.
  const monthNum = parseInt(String(mk).split('-')[1], 10);
  if (Object.keys(WLB_XLS.employees).length && wlbXlsMonthsWithData().includes(monthNum)) {
    return Math.round(wlbXlsTotalOT(monthNum, deptFilter)*10)/10;
  }
  if (!DB[mk]) return 0;
  // Ưu tiên getTotals (theo period/snapshot) khi có; nếu tháng chưa có snapshot thì
  // fallback totalOf trực tiếp — tránh WLB Tháng ra 0h dù So sánh OT vẫn hiện số tháng đó.
  const fromPeriods = getTotals(mk, deptFilter === '__all__' ? '__all__' : deptFilter);
  if (fromPeriods.length) {
    return fromPeriods.reduce((a, b) => a + b.total, 0);
  }
  const m = DB[mk];
  const names = (deptFilter && deptFilter !== '__all__')
    ? m.names.filter(n => m.employees[n]?.dept === deptFilter)
    : m.names;
  return names.reduce((s, n) => s + totalOf(m.employees[n] || {}), 0);
}

function clearOffDay() {
  if (!requireAdmin('xoá dữ liệu Off Day')) return;
  if (!confirm('Xóa toàn bộ dữ liệu Off Day? Không thể khôi phục!')) return;
  OFF_DB = {};
  saveOffDB();
  renderWlbSummary();
  if (document.getElementById('pg-wlb')?.classList.contains('show')) renderWlb();
  toast('Đã xóa toàn bộ dữ liệu Off Day');
}

function renderWlbSummary() {
  const keys = Object.keys(OFF_DB).sort();
  // Cập nhật summary ở trang WLB (info-bar nhỏ phía trên)
  const wlbEl = document.getElementById('offDaySummary');
  if (wlbEl) {
    if (!keys.length) {
      wlbEl.innerHTML = `<div style="font-size:12px;color:var(--text2);background:var(--amber-bg);border-radius:var(--radius);padding:10px 14px;border-left:3px solid var(--amber)">
        ⚠️ Chưa có dữ liệu Off Day — vào <button onclick="goPage('settings')" style="background:none;border:none;color:var(--accent);font-weight:600;cursor:pointer;font-size:12px;padding:0;text-decoration:underline">Cài đặt → Upload file Off Day</button> để bắt đầu tính WLB.
      </div>`;
    } else {
      wlbEl.innerHTML = `<div style="font-size:12px;color:var(--text2);background:var(--green-bg);border-radius:var(--radius);padding:10px 14px;border-left:3px solid var(--green)">
        ✅ Dữ liệu Off Day: <strong style="color:var(--text)">${keys.map(fmtMK).join(', ')}</strong>
      </div>`;
    }
  }
  // Cập nhật danh sách tháng ở Cài đặt
  const settEl = document.getElementById('offDayMonths');
  if (settEl) {
    settEl.textContent = keys.length
      ? `Đã có Off Day cho: ${keys.map(fmtMK).join(', ')}`
      : 'Chưa có dữ liệu Off Day nào.';
  }
}

// Ngưỡng đổi từ 10 xuống 0.1 để KHỚP LẠI đúng với công thức mới (đã bỏ nhân ×100 ở wlbRatio) —
// ngưỡng "10%" trước đây thực chất là tỷ lệ 0.10, nên giờ công thức không nhân 100 nữa thì ngưỡng
// cũng phải chia lại tương ứng, để kết quả Đạt/Không đạt của MỌI phòng ban giữ nguyên như trước
// (không bị lật ngược do đổi thang đo), chỉ có số hiển thị dễ đọc hơn hẳn (VD: 11.5 thay vì 1150).
const WLB_THRESHOLD = 0.1; // tương đương "10%" theo công thức cũ — >0.1 = Đạt, ≤0.1 = Không đạt
// Bỏ nhân ×100 (đã thử trước đây nhưng gây ra số quá lớn bất thường, VD: OT=5h, Off=57.5h ra
// tới 1150% — trong khi ngưỡng chỉ 10%, chênh lệch quá xa gây khó đọc). Giờ dùng ĐÚNG tỷ lệ gốc
// (off÷ot), giữ 2 số thập phân, gắn thêm "%" cho quen mắt — để số liệu và ngưỡng cùng 1 tầm nhìn
// (VD: 11.50% so với ngưỡng 10% — hợp lý, dễ so sánh trực quan hơn hẳn).
function wlbRatio(off, ot) { return ot ? Math.round((off/ot)*100)/100 : null; }
function wlbColor(v) { return v===null?'var(--text3)':v>WLB_THRESHOLD?'var(--green)':'var(--red)'; }
function wlbBadge(v) { return v===null?'<span style="color:var(--text3)">—</span>':v>WLB_THRESHOLD?'<span class="badge bo">✅ Đạt</span>':'<span class="badge bd">⚠️ Không đạt</span>'; }
function wlbDisplay(v) { return (v===null||v===undefined) ? '—' : v+'%'; }
// Ngưỡng OT tối thiểu để WLB% được coi là "đại diện" — dưới mức này, mẫu số (OT) quá nhỏ khiến
// tỷ lệ dễ lệch cao bất thường (VD: OT=5h, Off=57.5h → 11.5, vẫn hợp lý hơn hẳn cách tính cũ
// nhưng vẫn cần lưu ý vì OT quá ít không đủ đại diện) dù công thức tính hoàn toàn đúng.
// KHÔNG ẩn số (vẫn hiện đúng số đã tính) — chỉ thêm cảnh báo để người xem biết số liệu này chưa
// đủ đại diện, tránh hiểu nhầm phòng ban "mất cân bằng nghiêm trọng" khi thực ra chỉ vì họ hầu
// như không phát sinh OT.
const WLB_LOW_OT_THRESHOLD = 10;
function wlbDisplayWithWarn(v, ot) {
  const base = wlbDisplay(v);
  if (ot !== undefined && ot !== null && ot < WLB_LOW_OT_THRESHOLD && v !== null) {
    return `${base} <span title="OT quá thấp (${ot}h) — số liệu không đại diện" style="cursor:help;color:var(--amber)">⚠️</span>`;
  }
  return base;
}

// Gộp dữ liệu OT + Off Day theo TỪNG NHÂN VIÊN cho 1 danh sách tháng (mks) — khớp theo Staff Code
// (nếu cả 2 nguồn đều có mã), fallback theo tên nếu thiếu mã. Trả về mảng đã tính WLB, sắp xếp
// NV không đạt (WLB cao nhất) lên đầu để quản lý dễ xem ai cần chú ý trước.
function buildEmployeeWlbRows(mks, deptFilter, searchTerm) {
  const rowsMap = {};
  const hasXls = Object.keys(WLB_XLS.employees).length > 0;
  mks.forEach(mk => {
    const monthNum = parseInt(String(mk).split('-')[1], 10);
    const useXlsForThisMonth = hasXls && wlbXlsMonthsWithData().includes(monthNum);

    if (useXlsForThisMonth) {
      // Nguồn ĐÚNG (Excel WLB) cho tháng này — cả OT và Off Day cùng khớp 1 nguồn, 1 khoảng thời gian.
      Object.values(WLB_XLS.employees).forEach(e => {
        const key = e.code ? ('C:'+e.code) : ('N:'+e.name);
        if (!rowsMap[key]) rowsMap[key] = { name:e.name, code:e.code||'', dept:e.dept||'', ot:0, off:0 };
        rowsMap[key].ot += (e.ot[monthNum]||0);
        rowsMap[key].off += (e.off[monthNum]||0);
        if (!rowsMap[key].dept && e.dept) rowsMap[key].dept = e.dept;
        if (e.code && !rowsMap[key].code) rowsMap[key].code = e.code;
      });
      return;
    }

    // Fallback: nguồn cũ (DB theo chấm công hàng ngày + OFF_DB theo tháng dương lịch riêng).
    if (DB[mk]) {
      DB[mk].names.forEach(n => {
        const e = DB[mk].employees[n]; if (!e) return;
        const key = e.staffCode ? ('C:'+e.staffCode) : ('N:'+n);
        if (!rowsMap[key]) rowsMap[key] = { name:n, code:e.staffCode||'', dept:e.dept||'', ot:0, off:0 };
        rowsMap[key].ot += totalOf(e);
        if (!rowsMap[key].dept && e.dept) rowsMap[key].dept = e.dept;
        if (e.staffCode && !rowsMap[key].code) rowsMap[key].code = e.staffCode;
      });
    }
    if (OFF_DB[mk]) {
      OFF_DB[mk].names.forEach(n => {
        const e = OFF_DB[mk].employees[n]; if (!e) return;
        const key = e.code ? ('C:'+e.code) : ('N:'+n);
        if (!rowsMap[key]) rowsMap[key] = { name:n, code:e.code||'', dept:e.dept||'', ot:0, off:0 };
        rowsMap[key].off += (typeof e.offTotal === 'number' ? e.offTotal : 0);
        if (!rowsMap[key].dept && e.dept) rowsMap[key].dept = e.dept;
        if (e.code && !rowsMap[key].code) rowsMap[key].code = e.code;
      });
    }
  });
  let rows = Object.values(rowsMap);
  if (deptFilter && deptFilter !== '__all__') rows = rows.filter(r => r.dept === deptFilter);
  if (searchTerm) {
    const q = searchTerm.trim().toLowerCase();
    if (q) rows = rows.filter(r => r.name.toLowerCase().includes(q) || (r.code||'').toLowerCase().includes(q));
  }
  rows.forEach(r => { r.wlb = wlbRatio(r.off, r.ot); r.ot = Math.round(r.ot*10)/10; r.off = Math.round(r.off*10)/10; });
  rows.sort((a,b) => {
    if (a.wlb===null && b.wlb===null) return a.name.localeCompare(b.name);
    if (a.wlb===null) return 1;
    if (b.wlb===null) return -1;
    return b.wlb - a.wlb; // WLB cao (không đạt) lên đầu
  });
  return rows;
}

function renderEmployeeWlbTable(theadId, tbodyId, rows) {
  document.getElementById(theadId).innerHTML =
    `<tr><th>Staff Code</th><th>Nhân viên</th><th>Phòng ban</th><th>Tổng OT (h)</th><th>Off Day (ngày)</th><th>WLB = off÷OT</th><th>Kết quả</th></tr>`;
  document.getElementById(tbodyId).innerHTML = rows.map(r => `<tr>
    <td style="font-family:var(--font-mono);font-size:11px;color:var(--text2)">${r.code||'—'}</td>
    <td style="font-weight:500">${r.name}</td>
    <td style="color:var(--text2)">${r.dept||'—'}</td>
    <td style="font-family:var(--font-mono)">${r.ot}h</td>
    <td style="font-family:var(--font-mono)">${r.off}</td>
    <td style="font-family:var(--font-mono);font-weight:700;color:${wlbColor(r.wlb)}" title="${r.ot===0 ? 'Không có OT trong kỳ này nên không tính được tỷ lệ WLB (chia cho 0)' : ''}">${r.ot===0?'N/A':wlbDisplay(r.wlb)}</td>
    <td>${r.ot===0 ? '<span style="color:var(--text3);font-size:11.5px" title="NV không phát sinh OT trong kỳ này — không có cơ sở để đánh giá WLB">— (không có OT)</span>' : wlbBadge(r.wlb)}</td></tr>`).join('') ||
    '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text2)">Không tìm thấy nhân viên phù hợp.</td></tr>';
}

// Refresh NHẸ — chỉ cập nhật lại BẢNG nhân viên (không đụng tới biểu đồ) — dùng cho ô tìm kiếm/lọc,
// để gõ tìm kiếm không bị giật/lag do phải phá-dựng lại toàn bộ Chart.js mỗi lần gõ phím.
function refreshWlbEmpTableMonth() {
  const selMk = document.getElementById('wlbMonthSel')?.value;
  if (!selMk) return;
  const df = document.getElementById('wlbEmpMonthDept')?.value || '__all__';
  const q = document.getElementById('wlbEmpMonthSearch')?.value || '';
  renderEmployeeWlbTable('wlbEmpMonthTHead', 'wlbEmpMonthTBody', buildEmployeeWlbRows([selMk], df, q));
}
function refreshWlbEmpTableQtr() {
  const selQk = document.getElementById('wlbQtrSel')?.value;
  if (!selQk) return;
  const offKeys = Object.keys(OFF_DB).sort();
  const otKeys  = Object.keys(DB).sort();
  const allMks  = [...new Set([...offKeys,...otKeys,...wlbXlsMks()])].sort();
  const mks = allMks.filter(mk => quarterKeyOf(mk) === selQk);
  const df = document.getElementById('wlbEmpQtrDept')?.value || '__all__';
  const q = document.getElementById('wlbEmpQtrSearch')?.value || '';
  renderEmployeeWlbTable('wlbEmpQtrTHead', 'wlbEmpQtrTBody', buildEmployeeWlbRows(mks, df, q));
}

function renderWlb() {
  const offKeys = Object.keys(OFF_DB).sort();
  const otKeys  = Object.keys(DB).sort();
  const allMks  = [...new Set([...offKeys,...otKeys,...wlbXlsMks()])].sort();
  const allDepts = getAllDeptsForWlb();
  const THRESHOLD = WLB_THRESHOLD;
  const EMPTY = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text2)">Chưa có dữ liệu. Upload file OT và Off Day để bắt đầu.</td></tr>';

  // Shared bar chart options (1 tháng/quý đang chọn)
  const barOpts = (yTitle) => ({
    responsive:true, maintainAspectRatio:false, layout:{padding:{top:24,right:12}},
    plugins:{ legend:{display:true, position:'top', labels:{font:{size:11},boxWidth:12,padding:8}},
      barValueLabels:{},
      tooltip:{callbacks:{label:c=>` ${c.dataset.label}: ${c.raw}`}} },
    scales:{
      x:{grid:{display:false}, ticks:{font:{size:10}}},
      y:{grid:{color:'rgba(128,128,128,0.12)'}, ticks:{font:{size:10}},
         title:{display:true, text:yTitle, font:{size:10}}, min:0} }
  });

  // Shared line chart options (so sánh nhiều kỳ)
  const lineOpts = () => ({
    responsive:true, maintainAspectRatio:false, layout:{padding:{top:6,right:12}},
    plugins:{ legend:{display:true, position:'top', labels:{font:{size:11},boxWidth:12,padding:8}},
      tooltip:{callbacks:{label:c=>c.raw!==null?` ${c.dataset.label}: ${c.raw}`:` ${c.dataset.label}: —`}} },
    scales:{
      x:{grid:{display:false}, ticks:{font:{size:10}}},
      y:{grid:{color:'rgba(128,128,128,0.12)'}, ticks:{font:{size:10}},
         title:{display:true, text:'WLB (off÷OT)', font:{size:10}}, min:0, suggestedMax:Math.max(12,THRESHOLD*1.5)} }
  });

  if (wlbTab === 'month') {
    // ── Populate month selector ──
    // Tôn trọng lựa chọn của user (June/July/August...). Chỉ auto-chọn tháng có Off Day
    // khi lần đầu vào / prevMk không còn trong list — KHÔNG được kéo ngược selection khi
    // user chủ động đổi tháng (dù tháng đó chưa có Off Day).
    const sel = document.getElementById('wlbMonthSel');
    const prevMk = sel.value;
    const withOff = allMks.filter(mk => hasOffDataForMk(mk));
    const withBoth = withOff.filter(mk => DB[mk]);
    sel.innerHTML = allMks.map(mk=>`<option value="${mk}">${fmtMK(mk)}${hasOffDataForMk(mk)?'':' ⚠️ (chưa có Off Day)'}</option>`).join('') || '<option value="">— Chưa có dữ liệu —</option>';
    if (prevMk && allMks.includes(prevMk)) {
      sel.value = prevMk;
    } else {
      sel.value = (withBoth.length ? withBoth : withOff).slice(-1)[0]
        || allMks[allMks.length - 1]
        || '';
    }
    const selMk = sel.value;
    const labelEl = document.getElementById('wlbMonthSelLabel');
    if (labelEl) labelEl.textContent = selMk ? fmtMK(selMk) : '';

    // ── KPI tháng đang chọn ──
    const hasOffForMonth = !!OFF_DB[selMk];
    const totalOff = selMk ? Math.round(getOffDays(selMk,'__all__')) : 0;
    const totalOT  = selMk ? Math.round(getTotalOT(selMk,'__all__')) : 0;
    const ratio = wlbRatio(totalOff, totalOT);
    const ok = ratio !== null && ratio > THRESHOLD;
    const otherOffHint = withOff.length
      ? ` · Có Off Day ở: ${withOff.map(fmtMK).join(', ')}`
      : '';
    document.getElementById('wlbMetrics').innerHTML = !selMk ? '' : !hasOffForMonth ? `
      <div class="mc"><div class="ml">Ngày nghỉ (off)</div><div class="mv">—</div><div class="ms">Chưa có Off Day tháng này</div></div>
      <div class="mc"><div class="ml">Tổng OT</div><div class="mv">${totalOT}h</div><div class="ms">${fmtMK(selMk)} · toàn công ty</div></div>
      <div class="mc amber"><div class="ml">WLB = off ÷ OT</div><div class="mv">—</div><div class="ms">⚠️ Chưa có Off Day cho ${fmtMK(selMk)}${otherOffHint}</div></div>` : `
      <div class="mc"><div class="ml">Ngày nghỉ (off)</div><div class="mv">${totalOff}</div><div class="ms">${fmtMK(selMk)} · toàn công ty</div></div>
      <div class="mc"><div class="ml">Tổng OT</div><div class="mv">${totalOT}h</div><div class="ms">${fmtMK(selMk)} · toàn công ty</div></div>
      <div class="mc ${ok?'green':'red'}"><div class="ml">WLB = off ÷ OT</div><div class="mv">${wlbDisplayWithWarn(ratio, totalOT)}</div><div class="ms">${ok?'✅ Đạt (>0.1)':'⚠️ Không đạt (≤0.1)'}</div></div>`;

    // ── Cột ngang: Tổng OT từng phòng ban — thay doughnut hay bị trắng ──
    const projLbl = document.getElementById('wlbProjMonthLabel');
    if (projLbl) projLbl.textContent = selMk ? fmtMK(selMk) : '';
    if (selMk && allDepts.length) {
      const projData = allDepts.map(d => Math.round(getTotalOT(selMk,d)));
      const projCanvas = document.getElementById('cWlbProjPie');
      const projWrap = projCanvas?.parentElement;
      if (projWrap) projWrap.style.height = Math.max(220, allDepts.length * 36 + 48) + 'px';
      const projMax = Math.max(10, ...projData, 0);
      safeMakeChart(WLB_CH, killWlbChart, 'cWlbProjPie', projCanvas, {
        type:'bar',
        data:{ labels: allDepts, datasets:[{
          label: 'Tổng OT (h)',
          data: projData,
          backgroundColor: allDepts.map((_,i)=>DEPT_COLORS[i%DEPT_COLORS.length]),
          borderWidth:0, borderRadius:4
        }] },
        options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
          layout:{ padding:{ right:48, top:4, bottom:4, left:4 } },
          plugins:{ legend:{display:false}, barValueLabels:{ suffix:'h' },
            tooltip:{callbacks:{label:c=>` ${c.label}: ${c.raw}h`}} },
          scales:{
            x:{ grid:{color:'rgba(128,128,128,0.12)'}, ticks:{font:{size:10}}, min:0, max: projMax * 1.15 },
            y:{ grid:{display:false}, ticks:{font:{size:11}} }
          }
        }
      });
    } else {
      killWlbChart('cWlbProjPie');
    }

    // ── Biểu đồ 1: WLB tháng đang chọn ──
    // Luôn cho đổi tháng. Tháng chưa có Off Day → empty-state (không reset dropdown).
    // Tháng có Off Day → vẽ chart giống tab Quý.
    killWlbChart('cWlbMonth');
    const wlbMonthEmpty = document.getElementById('cWlbMonthEmpty');
    const wlbMonthCanvas = document.getElementById('cWlbMonth');
    const wlbMonthWrap = document.getElementById('cWlbMonthWrap');
    if (hasOffForMonth && selMk && allDepts.length) {
      if (wlbMonthEmpty) wlbMonthEmpty.style.display = 'none';
      if (wlbMonthWrap) wlbMonthWrap.style.display = 'block';
      if (wlbMonthCanvas) wlbMonthCanvas.style.display = 'block';
      const otData  = allDepts.map(d => Math.round(getTotalOT(selMk,d)));
      const offData = allDepts.map(d => Math.round(getOffDays(selMk,d)));
      const wlbData = allDepts.map((d,i) => wlbRatio(offData[i], otData[i]));
      const otMax  = Math.max(10, ...otData);
      const offMax = Math.max(5, ...offData);
      const wlbMax = Math.max(12, THRESHOLD * 1.5, ...wlbData.filter(v => v !== null && !Number.isNaN(v)));
      safeMakeChart(WLB_CH, killWlbChart, 'cWlbMonth', wlbMonthCanvas, {
        type:'bar',
        data:{ labels: allDepts,
          datasets:[
            { label:'Tổng OT (h)', data:otData, backgroundColor:'rgba(45,108,223,0.7)', borderColor:'#2D6CDF', borderWidth:1, borderRadius:4, yAxisID:'y' },
            { label:'Off Day (ngày)', data:offData, backgroundColor:'rgba(31,157,85,0.7)', borderColor:'#1F9D55', borderWidth:1, borderRadius:4, yAxisID:'yOff' },
            { type:'line', label:'WLB (off÷OT)', data:wlbData, yAxisID:'y2',
              borderColor:'#C0392B', backgroundColor:'transparent', tension:.3, borderWidth:2, pointRadius:5, spanGaps:true }
          ]},
        options:{ responsive:true, maintainAspectRatio:false, layout:{padding:{top:10,right:12}},
          plugins:{ legend:{display:true, position:'top', labels:{font:{size:11},boxWidth:12,padding:8}},
            tooltip:{callbacks:{label:c=>` ${c.dataset.label}: ${c.raw}${c.datasetIndex<2?'%':'%  ('+((c.raw??'—')>THRESHOLD?'Đạt':'Không đạt')+')'}`}} },
          scales:{
            x:{grid:{display:false}, ticks:{font:{size:10}}},
            y:{grid:{color:'rgba(128,128,128,0.12)'}, ticks:{font:{size:10}}, position:'left', min:0, max: otMax,
               title:{display:true, text:'Tổng OT (giờ)', font:{size:10}, color:'#2D6CDF'}},
            yOff:{grid:{display:false}, ticks:{font:{size:10}}, position:'right', min:0, max: offMax,
               title:{display:true, text:'Off Day (ngày)', font:{size:10}, color:'#1F9D55'}},
            y2:{grid:{display:false}, ticks:{font:{size:10}}, position:'right', offset:true,
               title:{display:true, text:'WLB (off÷OT)', font:{size:10}, color:'#C0392B'}, min:0, max: wlbMax} }}
      });
    } else {
      if (wlbMonthEmpty) {
        wlbMonthEmpty.style.display = 'flex';
        wlbMonthEmpty.innerHTML = withOff.length
          ? `Tháng <strong>${selMk ? fmtMK(selMk) : '—'}</strong> chưa có Off Day. Các tháng có Off Day: <strong>${withOff.map(fmtMK).join(', ')}</strong> — chọn tháng đó trên dropdown, hoặc upload thêm Off Day cho tháng này.`
          : `Chưa có dữ liệu Off Day — vào <button type="button" onclick="goPage('settings')" style="background:none;border:none;color:var(--accent);font-weight:600;cursor:pointer;font-size:13px;padding:0;text-decoration:underline">Cài đặt → Upload Off Day</button>.`;
      }
      if (wlbMonthWrap) wlbMonthWrap.style.display = 'none';
      else if (wlbMonthCanvas) wlbMonthCanvas.style.display = 'none';
    }

    // ── Biểu đồ mới: WLB từng dự án (HCM-EC) — tháng đang chọn ──
    const wlbProjLbl = document.getElementById('wlbProjMonthSelLabel');
    if (wlbProjLbl) wlbProjLbl.textContent = selMk ? fmtMK(selMk) : '';
    if (selMk) {
      const monthNumP = parseInt(selMk.split('-')[1], 10);
      const allEcProjects = projectsInGroup('HCM-EC');
      const projEntries = allEcProjects.sort().map(proj => {
        const w = getProjectWlbForMonth('HCM-EC', proj, monthNumP);
        return { name: proj.replace(/^HCM\s+/i,''), value: w.wlb };
      }).filter(e => e.value !== null && e.value !== undefined);
      // Thông báo rõ nguyên nhân khi rỗng — tránh để trắng trơn khiến người dùng tưởng bị lỗi/mất
      // dữ liệu, trong khi thực ra chỉ đơn giản là tháng đang xem chưa có dữ liệu Excel WLB.
      const emptyElP = document.getElementById('cWlbProjMonthEmpty');
      if (emptyElP) {
        if (!allEcProjects.length) {
          emptyElP.textContent = 'Chưa có dự án nào trong nhóm HCM-EC (vào Action Plan để tạo/gán dự án).';
        } else if (!wlbXlsMonthsWithData().includes(monthNumP)) {
          emptyElP.textContent = `Chưa có dữ liệu Excel WLB cho ${fmtMK(selMk)} — vào Cài đặt upload lại file Excel WLB có đủ tháng này.`;
        } else {
          emptyElP.textContent = 'Chưa có dữ liệu dự án đủ để tính WLB cho tháng này.';
        }
      }
      renderGenericProjectBarChart(WLB_CH, killWlbChart, 'cWlbProjMonth',
        document.getElementById('cWlbProjMonth'), emptyElP,
        projEntries, '', '#6B4FA0');
    }

    // ── Biểu đồ 2: Line — WLB các tháng, từng phòng ban ──
    // Chỉ dùng tháng ĐÃ CÓ Off Day (khớp với bảng bên dưới) — tránh vẽ đường WLB=0 giả cho tháng
    // chưa upload Off Day (trước đây dùng allMks khiến đường kẻ bị kéo về 0 sai lệch).
    killWlbChart('cWlbMonthCmp');
    const cmpMks = allMks.filter(mk => hasOffDataForMk(mk));
    document.getElementById('wlbMonthCmpLeg').innerHTML =
      allDepts.map((d,i)=>`<span><span class="ldot" style="background:${DEPT_COLORS[i%DEPT_COLORS.length]}"></span>${d}</span>`).join('');
    const cmpEmptyEl = document.getElementById('cWlbMonthCmpEmpty');
    const cmpCanvasEl = document.getElementById('cWlbMonthCmp');
    if (cmpMks.length && allDepts.length) {
      if (cmpEmptyEl) cmpEmptyEl.style.display = 'none';
      if (cmpCanvasEl) cmpCanvasEl.style.display = 'block';
      safeMakeChart(WLB_CH, killWlbChart, 'cWlbMonthCmp', cmpCanvasEl, {
        type:'line',
        data:{ labels: cmpMks.map(fmtMK),
          datasets:[
            ...allDepts.map((d,i)=>({
              label:d,
              data: cmpMks.map(mk=>wlbRatio(getOffDays(mk,d), getTotalOT(mk,d))),
              borderColor:DEPT_COLORS[i%DEPT_COLORS.length], backgroundColor:'transparent',
              tension:.3, borderWidth:2, pointRadius:4, spanGaps:true
            })),
            { label:'Ngưỡng 0.1', data:cmpMks.map(()=>THRESHOLD),
              borderColor:'#C0392B', borderDash:[6,4], borderWidth:1.5, pointRadius:0, backgroundColor:'transparent' }
          ]},
        options: lineOpts()
      });
    } else {
      if (cmpEmptyEl) cmpEmptyEl.style.display = 'flex';
      if (cmpCanvasEl) cmpCanvasEl.style.display = 'none';
    }

    // ── Bảng: Tổng OT + Off Day + WLB theo tháng × phòng ban ──
    // Chỉ hiển thị các tháng ĐÃ CÓ ĐỦ dữ liệu Off Day upload (bỏ qua tháng chỉ có OT mà chưa
    // có Off Day, tránh hiện dòng "0 ngày nghỉ / 0 WLB / Đạt" gây hiểu lầm là đã đạt chuẩn).
    document.getElementById('wlbMonthTHead').innerHTML =
      `<tr><th>Tháng</th><th>Phòng ban</th><th>Tổng OT (h)</th><th>Off Day (ngày)</th><th>WLB = off÷OT</th><th>Kết quả</th></tr>`;
    const rows = [];
    const mksWithOff = allMks.filter(mk => hasOffDataForMk(mk));
    mksWithOff.forEach(mk => {
      // Dòng tổng công ty
      const coOT = Math.round(getTotalOT(mk,'__all__')); const coOff = Math.round(getOffDays(mk,'__all__'));
      if (coOT || coOff) {
        const v = wlbRatio(coOff, coOT);
        rows.push(`<tr style="background:var(--bg2)">
          <td style="font-weight:600${mk===selMk?';color:var(--accent)':''}">${fmtMK(mk)}${mk===selMk?' ◀':''}</td>
          <td style="font-weight:600">🏢 Toàn công ty</td>
          <td style="font-family:var(--font-mono);font-weight:700">${coOT}h</td>
          <td style="font-family:var(--font-mono);font-weight:700">${coOff}</td>
          <td style="font-family:var(--font-mono);font-weight:700;color:${wlbColor(v)}">${wlbDisplayWithWarn(v, coOT)}</td>
          <td>${wlbBadge(v)}</td></tr>`);
      }
      // Dòng từng phòng ban
      allDepts.forEach(d => {
        const ot = Math.round(getTotalOT(mk,d)); const off = Math.round(getOffDays(mk,d));
        if (!ot && !off) return;
        const v = wlbRatio(off, ot);
        const boxId = `wlbProjBox_m_${mk.replace(/[^a-zA-Z0-9]/g,'_')}`;
        const expandBtn = d === 'HCM-EC' ? projectExpandButtonHtml(boxId) : '';
        rows.push(`<tr>
          <td style="color:var(--text3);font-size:11px;padding-left:18px">${fmtMK(mk)}</td>
          <td>${d}${expandBtn}</td>
          <td style="font-family:var(--font-mono)">${ot}h</td>
          <td style="font-family:var(--font-mono)">${off}</td>
          <td style="font-family:var(--font-mono);font-weight:700;color:${wlbColor(v)}">${wlbDisplayWithWarn(v, ot)}</td>
          <td>${wlbBadge(v)}</td></tr>`);
        if (d === 'HCM-EC') {
          const monthNum = parseInt(mk.split('-')[1], 10);
          const projRows = projectsInGroup('HCM-EC').sort().map(proj => {
            const w = getProjectWlbForMonth('HCM-EC', proj, monthNum);
            return { name: proj, display: wlbDisplayWithWarn(w.wlb, w.ot), nv: PROJECTS_DB['HCM-EC'][proj].employees.length };
          });
          rows.push(`<tr><td colspan="6" style="padding:0;border:none"><div id="${boxId}" style="display:none;padding:6px 0 10px 18px"></div></td></tr>`);
          // Điền nội dung ngay (ẩn sẵn) — không đợi bấm mới tính, vì dữ liệu WLB theo dự án nhẹ.
          setTimeout(() => fillProjectBox(boxId, projRows, 'WLB'), 0);
        }
      });
    });
    document.getElementById('wlbMonthTBody').innerHTML = rows.join('') || EMPTY;

    // ── Bảng theo TỪNG NHÂN VIÊN — tháng đang chọn ──
    const empDeptSelM = document.getElementById('wlbEmpMonthDept');
    if (empDeptSelM) {
      const prevD = empDeptSelM.value;
      empDeptSelM.innerHTML = '<option value="__all__">Tất cả phòng ban</option>' + allDepts.map(d=>`<option value="${d}">${d}</option>`).join('');
      if ([...empDeptSelM.options].some(o=>o.value===prevD)) empDeptSelM.value = prevD;
    }
    const empLabelM = document.getElementById('wlbEmpMonthLabel');
    if (empLabelM) empLabelM.textContent = selMk ? `— ${fmtMK(selMk)}` : '';
    const empRowsM = selMk ? buildEmployeeWlbRows([selMk], empDeptSelM?.value, document.getElementById('wlbEmpMonthSearch')?.value) : [];
    renderEmployeeWlbTable('wlbEmpMonthTHead', 'wlbEmpMonthTBody', empRowsM);

  } else {
    // ── TAB QUARTER — WLB tính theo Quý kiểu CHỒNG LẤP 3 tháng liên tiếp (KHÔNG phải quý lịch
    // chuẩn Jan-Mar/Apr-Jun) — đúng theo công thức Excel công ty cung cấp:
    //   Quý 1 = tháng 1+2+3, Quý 2 = tháng 3+4+5, Quý 3 = tháng 5+6+7...
    // (tháng cuối của quý trước = tháng đầu của quý sau, mỗi quý lùi lại 2 tháng so với quý trước).
    const wlbQGroups = [];
    for (let i = 0; i + 2 < allMks.length; i += 2) {
      const mks = [allMks[i], allMks[i+1], allMks[i+2]];
      wlbQGroups.push({ key: 'RQ'+(wlbQGroups.length+1), label: `Quý ${wlbQGroups.length+1} (${fmtMK(mks[0])} – ${fmtMK(mks[2])})`, mks });
    }
    const qKeys = wlbQGroups.map(g => g.key);
    const qLabel = {}; wlbQGroups.forEach(g => { qLabel[g.key] = g.label; });
    const qMks = (qk) => (wlbQGroups.find(g => g.key === qk) || {mks:[]}).mks;

    const sel = document.getElementById('wlbQtrSel');
    const prevQk = sel.value;
    sel.innerHTML = qKeys.map(qk =>
      `<option value="${qk}">${qLabel[qk]}</option>`
    ).join('') || '<option value="">— Chưa có dữ liệu (cần tối thiểu 3 tháng dữ liệu) —</option>';
    if (qKeys.includes(prevQk)) sel.value = prevQk;
    else sel.value = qKeys[qKeys.length - 1] || '';
    const selQk = sel.value;
    const labelEl2 = document.getElementById('wlbQtrSelLabel');
    if (labelEl2) labelEl2.textContent = selQk ? qLabel[selQk] : '';

    // ── Biểu đồ 1: Grouped bar — OT + Off quý đang chọn, từng phòng ban ──
    if (selQk && allDepts.length) {
      const mks = qMks(selQk);
      const hasOffInQtr = mks.some(mk => hasOffDataForMk(mk));
      const otData  = allDepts.map(d => Math.round(mks.reduce((s,mk)=>s+getTotalOT(mk,d),0)));
      const offData = allDepts.map(d => Math.round(mks.reduce((s,mk)=>s+getOffDays(mk,d),0)));
      const wlbData = allDepts.map((d,i) => wlbRatio(offData[i], otData[i]));
      if (!hasOffInQtr) {
        killWlbChart('cWlbQuarter');
      } else {
        const otMax  = Math.max(10, ...otData);
        const offMax = Math.max(5, ...offData);
        const wlbMax = Math.max(12, THRESHOLD * 1.5, ...wlbData.filter(v => v !== null));
        safeMakeChart(WLB_CH, killWlbChart, 'cWlbQuarter', document.getElementById('cWlbQuarter'), {
          type:'bar',
          data:{ labels: allDepts,
            datasets:[
              { label:'Tổng OT (h)', data:otData, backgroundColor:'rgba(45,108,223,0.7)', borderColor:'#2D6CDF', borderWidth:1, borderRadius:4, yAxisID:'y' },
              { label:'Off Day (ngày)', data:offData, backgroundColor:'rgba(31,157,85,0.7)', borderColor:'#1F9D55', borderWidth:1, borderRadius:4, yAxisID:'yOff' },
              { type:'line', label:'WLB (off÷OT)', data:wlbData, yAxisID:'y2',
                borderColor:'#C0392B', backgroundColor:'transparent', tension:.3, borderWidth:2, pointRadius:5, spanGaps:true }
            ]},
          options:{ responsive:true, maintainAspectRatio:false, layout:{padding:{top:10,right:12}},
            plugins:{ legend:{display:true, position:'top', labels:{font:{size:11},boxWidth:12,padding:8}},
              tooltip:{callbacks:{label:c=>` ${c.dataset.label}: ${c.raw}`}} },
            scales:{
              x:{grid:{display:false}, ticks:{font:{size:10}}},
              y:{grid:{color:'rgba(128,128,128,0.12)'}, ticks:{font:{size:10}}, position:'left', min:0, max: otMax,
                 title:{display:true, text:'Tổng OT (giờ)', font:{size:10}, color:'#2D6CDF'}},
              yOff:{grid:{display:false}, ticks:{font:{size:10}}, position:'right', min:0, max: offMax,
                 title:{display:true, text:'Off Day (ngày)', font:{size:10}, color:'#1F9D55'}},
              y2:{grid:{display:false}, ticks:{font:{size:10}}, position:'right', offset:true,
                 title:{display:true, text:'WLB (off÷OT)', font:{size:10}, color:'#C0392B'}, min:0, max: wlbMax} }}
        });
      }
    } else {
      killWlbChart('cWlbQuarter');
    }

    // ── Biểu đồ mới: WLB từng dự án (HCM-EC) — quý đang chọn ──
    const wlbProjQLbl = document.getElementById('wlbProjQtrSelLabel');
    if (wlbProjQLbl) wlbProjQLbl.textContent = selQk ? qLabel[selQk] : '';
    if (selQk) {
      const monthNumsQ = qMks(selQk).map(mk => parseInt(mk.split('-')[1], 10));
      const allEcProjectsQ = projectsInGroup('HCM-EC');
      const projEntriesQ = allEcProjectsQ.sort().map(proj => {
        const w = getProjectWlbForMonths('HCM-EC', proj, monthNumsQ);
        return { name: proj.replace(/^HCM\s+/i,''), value: w.wlb };
      }).filter(e => e.value !== null && e.value !== undefined);
      const emptyElQ = document.getElementById('cWlbProjQtrEmpty');
      if (emptyElQ) {
        const hasAnyMonth = monthNumsQ.some(m => wlbXlsMonthsWithData().includes(m));
        if (!allEcProjectsQ.length) {
          emptyElQ.textContent = 'Chưa có dự án nào trong nhóm HCM-EC (vào Action Plan để tạo/gán dự án).';
        } else if (!hasAnyMonth) {
          emptyElQ.textContent = `Chưa có dữ liệu Excel WLB cho quý ${qLabel[selQk]||''} — vào Cài đặt upload lại file Excel WLB có đủ các tháng này.`;
        } else {
          emptyElQ.textContent = 'Chưa có dữ liệu dự án đủ để tính WLB cho quý này.';
        }
      }
      renderGenericProjectBarChart(WLB_CH, killWlbChart, 'cWlbProjQtr',
        document.getElementById('cWlbProjQtr'), emptyElQ,
        projEntriesQ, '', '#6B4FA0');
    }

    // ── Biểu đồ 2: Line — WLB các quý, từng phòng ban ──
    document.getElementById('wlbQtrCmpLeg').innerHTML =
      allDepts.map((d,i)=>`<span><span class="ldot" style="background:${DEPT_COLORS[i%DEPT_COLORS.length]}"></span>${d}</span>`).join('');
    if (qKeys.length && allDepts.length) {
      safeMakeChart(WLB_CH, killWlbChart, 'cWlbQtrCmp', document.getElementById('cWlbQtrCmp'), {
        type:'line',
        data:{ labels: qKeys.map(qk=>qLabel[qk]),
          datasets:[
            ...allDepts.map((d,i)=>({
              label:d,
              data: qKeys.map(qk => { const mks=qMks(qk); return wlbRatio(mks.reduce((s,mk)=>s+getOffDays(mk,d),0), mks.reduce((s,mk)=>s+getTotalOT(mk,d),0)); }),
              borderColor:DEPT_COLORS[i%DEPT_COLORS.length], backgroundColor:'transparent',
              tension:.3, borderWidth:2, pointRadius:5, spanGaps:true
            })),
            { label:'Ngưỡng 0.1', data:qKeys.map(()=>THRESHOLD),
              borderColor:'#C0392B', borderDash:[6,4], borderWidth:1.5, pointRadius:0, backgroundColor:'transparent' }
          ]},
        options: lineOpts()
      });
    } else {
      killWlbChart('cWlbQtrCmp');
    }

    // ── Bảng: Tổng OT + Off Day + WLB theo quý × phòng ban ──
    // Chỉ tính các tháng trong quý ĐÃ CÓ Off Day (bỏ qua tháng chỉ có OT), và bỏ hẳn quý nào
    // không có tháng nào đủ dữ liệu — tránh hiện dòng "0/0/Đạt" gây hiểu lầm.
    document.getElementById('wlbQtrTHead').innerHTML =
      `<tr><th>Quý</th><th>Phòng ban</th><th>Tổng OT (h)</th><th>Off Day (ngày)</th><th>WLB = off÷OT</th><th>Kết quả</th></tr>`;
    const qRows = [];
    qKeys.forEach(qk => {
      const mks = qMks(qk).filter(mk => hasOffDataForMk(mk));
      if (!mks.length) return; // quý này chưa có tháng nào đủ dữ liệu Off Day
      // Dòng tổng công ty
      const coOT = Math.round(mks.reduce((s,mk)=>s+getTotalOT(mk,'__all__'),0));
      const coOff= Math.round(mks.reduce((s,mk)=>s+getOffDays(mk,'__all__'),0));
      if (coOT || coOff) {
        const v = wlbRatio(coOff, coOT);
        qRows.push(`<tr style="background:var(--bg2)">
          <td style="font-weight:600${qk===selQk?';color:var(--accent)':''}">${qLabel[qk]}${qk===selQk?' ◀':''}</td>
          <td style="font-weight:600">🏢 Toàn công ty</td>
          <td style="font-family:var(--font-mono);font-weight:700">${coOT}h</td>
          <td style="font-family:var(--font-mono);font-weight:700">${coOff}</td>
          <td style="font-family:var(--font-mono);font-weight:700;color:${wlbColor(v)}">${wlbDisplayWithWarn(v, coOT)}</td>
          <td>${wlbBadge(v)}</td></tr>`);
      }
      // Dòng từng phòng ban
      allDepts.forEach(d => {
        const ot = Math.round(mks.reduce((s,mk)=>s+getTotalOT(mk,d),0));
        const off= Math.round(mks.reduce((s,mk)=>s+getOffDays(mk,d),0));
        if (!ot && !off) return;
        const v = wlbRatio(off, ot);
        const boxId = `wlbProjBox_q_${qk.replace(/[^a-zA-Z0-9]/g,'_')}`;
        const expandBtn = d === 'HCM-EC' ? projectExpandButtonHtml(boxId) : '';
        qRows.push(`<tr>
          <td style="color:var(--text3);font-size:11px;padding-left:18px">${qLabel[qk]}</td>
          <td>${d}${expandBtn}</td>
          <td style="font-family:var(--font-mono)">${ot}h</td>
          <td style="font-family:var(--font-mono)">${off}</td>
          <td style="font-family:var(--font-mono);font-weight:700;color:${wlbColor(v)}">${wlbDisplayWithWarn(v, ot)}</td>
          <td>${wlbBadge(v)}</td></tr>`);
        if (d === 'HCM-EC') {
          const monthNums = mks.map(mk => parseInt(mk.split('-')[1], 10));
          const projRows = projectsInGroup('HCM-EC').sort().map(proj => {
            const w = getProjectWlbForMonths('HCM-EC', proj, monthNums);
            return { name: proj, display: wlbDisplayWithWarn(w.wlb, w.ot), nv: PROJECTS_DB['HCM-EC'][proj].employees.length };
          });
          qRows.push(`<tr><td colspan="6" style="padding:0;border:none"><div id="${boxId}" style="display:none;padding:6px 0 10px 18px"></div></td></tr>`);
          setTimeout(() => fillProjectBox(boxId, projRows, 'WLB'), 0);
        }
      });
    });
    document.getElementById('wlbQtrTBody').innerHTML = qRows.join('') || EMPTY;

    // ── Bảng theo TỪNG NHÂN VIÊN — quý đang chọn (gộp 3 tháng) ──
    const empDeptSelQ = document.getElementById('wlbEmpQtrDept');
    if (empDeptSelQ) {
      const prevD = empDeptSelQ.value;
      empDeptSelQ.innerHTML = '<option value="__all__">Tất cả phòng ban</option>' + allDepts.map(d=>`<option value="${d}">${d}</option>`).join('');
      if ([...empDeptSelQ.options].some(o=>o.value===prevD)) empDeptSelQ.value = prevD;
    }
    const empLabelQ = document.getElementById('wlbEmpQtrLabel');
    if (empLabelQ) empLabelQ.textContent = selQk ? `— ${qLabel[selQk]}` : '';
    const empRowsQ = selQk ? buildEmployeeWlbRows(qMks(selQk), empDeptSelQ?.value, document.getElementById('wlbEmpQtrSearch')?.value) : [];
    renderEmployeeWlbTable('wlbEmpQtrTHead', 'wlbEmpQtrTBody', empRowsQ);
  }
}


function killLateChart(id) { if (CHL[id]) { CHL[id].destroy(); CHL[id] = null; } }

function saveLateDB() {
  try { localStorage.setItem(LATE_STORAGE_KEY, JSON.stringify(LATE_DB)); } catch(e) {}
}
function loadLateDB() {
  try {
    const raw = localStorage.getItem(LATE_STORAGE_KEY);
    if (raw) { LATE_DB = JSON.parse(raw); return true; }
  } catch(e) {}
  return false;
}

// Late minutes for one day: counts minutes AFTER 8:00 (giờ vào chuẩn). Arriving 8:01 or later = late.
// Arriving at or before 8:00 = not late (0).
// Đi trễ: có 5 phút ân hạn — chỉ tính trễ từ 8:05 trở đi (8:00-8:05 không bị tính).
function computeLateMinutes(inVal) {
  const m = timeToMinutes(inVal);
  if (m === null) return 0;
  const GRACE_CUTOFF = 8*60 + 5; // 8:05
  return m > GRACE_CUTOFF ? (m - GRACE_CUTOFF) : 0;
}

// Returns per-employee: chia 2 mốc — Mốc 1: <15 phút (đi trễ nhẹ, phổ biến nhất),
// Mốc 2: ≥30 phút (cần xin phép quản lý). Khoảng 15–29 phút không thuộc mốc nào,
// chỉ tính vào Tổng (không hiển thị riêng vì NV ít rơi vào khoảng này).
// dateRange (tuỳ chọn) = {start, end} (Date objects) — nếu truyền vào, CHỈ tính những ngày đi trễ
// nằm trong khoảng đó (dùng cho tab "Theo tuần"). Không truyền = tính cả tháng (như trước giờ).
function getLateTotals(mk, deptFilter, dateRange) {
  const m = LATE_DB[mk]; if (!m) return [];
  return m.names
    .filter(n => deptFilter==='__all__' || m.employees[n].dept === deptFilter)
    .map(n => {
      const e = m.employees[n];
      const fullDaysObj = e.days || {};
      const daysObj = dateRange
        ? Object.fromEntries(Object.entries(fullDaysObj).filter(([iso]) => {
            const d = new Date(iso+'T00:00:00');
            return d >= dateRange.start && d <= dateRange.end;
          }))
        : fullDaysObj;
      const dayVals = Object.values(daysObj);
      const totalMin = dayVals.reduce((a,b)=>a+b,0);
      const count = dayVals.length;
      const t1Vals = dayVals.filter(v => v < 15);           // Mốc 1: dưới 15 phút
      const t2Vals = dayVals.filter(v => v >= 30);          // Mốc 2: từ 30 phút trở lên
      const midVals = dayVals.filter(v => v >= 5 && v < 30); // Trễ 5–29 phút (không cần xin phép) — dùng cho tỷ lệ % phòng ban đi trễ
      const t1Count = t1Vals.length, t1Min = t1Vals.reduce((a,b)=>a+b,0);
      const t2Count = t2Vals.length, t2Min = t2Vals.reduce((a,b)=>a+b,0);
      const midCount = midVals.length, midMin = midVals.reduce((a,b)=>a+b,0);
      const needsNote = t2Count; // ≥30 phút → cần ghi chú xin phép quản lý
      // Danh sách CHÍNH XÁC những ngày bị đi trễ (chỉ liệt kê ngày có đi trễ, không phải cả lịch),
      // sắp xếp theo ngày tăng dần, kèm giờ vào thực tế (suy ngược từ số phút trễ + mốc 8:05).
      const GRACE_CUTOFF = 8*60 + 5; // 8:05
      const lateDates = Object.keys(daysObj).sort().map(iso => {
        const [y,mo,da] = iso.split('-');
        const lateMin = daysObj[iso];
        const checkinMin = GRACE_CUTOFF + lateMin;
        const hh = Math.floor(checkinMin/60), mm = checkinMin%60;
        const timeLabel = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
        return { iso, label: `${da}/${mo}`, min: lateMin, time: timeLabel };
      });
      return { name:n, dept:e.dept, code:e.code||'', totalMin, count, t1Count, t1Min, t2Count, t2Min, midCount, midMin, needsNote, lateDates };
    });
}

// ============================================================
//  BẢNG LƯỚI LỊCH ĐI TRỄ — kiểu "BẢNG THEO DÕI ĐI TRỄ" (Excel-style), thay cho kiểu liệt kê cũ.
//  Mỗi cột = 1 ngày CÓ ít nhất 1 NV đi trễ (hợp của tất cả ngày trễ trong danh sách NV truyền vào),
//  ô hiển thị GIỜ VÀO thực tế (vd "08:07"), tô màu theo mức độ trễ:
//    · Trễ ≥30 phút (tính từ mốc 8:05) → ĐỎ, cần xin phép
//    · Trễ 5–29 phút → CAM
//    · Trễ <5 phút → màu chữ mặc định (không tô)
// ============================================================
const WEEKDAY_ABBR_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function buildLateDateUnion(empList) {
  const set = new Set();
  empList.forEach(t => (t.lateDates||[]).forEach(d => set.add(d.iso)));
  return [...set].sort();
}

function lateCellColor(min) {
  if (min >= 30) return { color:'#C0392B', weight:'700' };
  if (min >= 5)  return { color:'#E8890C', weight:'700' };
  return { color:'var(--text)', weight:'500' };
}

// Vẽ 1 bảng lưới lịch hoàn chỉnh (thead+tbody) vào 2 element id cho trước.
function renderLateGridTable(theadId, tbodyId, empList) {
  const theadEl = document.getElementById(theadId);
  const tbodyEl = document.getElementById(tbodyId);
  if (!theadEl || !tbodyEl) return;
  const dates = buildLateDateUnion(empList);
  if (!dates.length || !empList.length) {
    theadEl.innerHTML = '';
    tbodyEl.innerHTML = '<tr><td style="text-align:center;padding:20px;color:var(--text2)">Không có dữ liệu.</td></tr>';
    return;
  }
  const dateColsHtml = dates.map(iso => {
    const d = new Date(iso+'T00:00:00');
    const dow = d.getDay();
    const isWeekend = dow===0 || dow===6;
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    return `<th style="text-align:center;min-width:56px;${isWeekend?'background:var(--red-bg)':'background:var(--accent-bg)'}">
      <div style="font-size:9px;color:var(--text2);font-weight:700;text-transform:none">${WEEKDAY_ABBR_EN[dow]}</div>
      <div style="font-size:11px;font-family:var(--font-mono);color:var(--text)">${dd}/${mm}</div>
    </th>`;
  }).join('');
  theadEl.innerHTML = `<tr>
    <th>Staff Code</th><th>Nhân viên</th><th>Phòng ban</th>
    ${dateColsHtml}
    <th style="background:var(--amber-bg);text-align:center">Tổng lượt</th>
    <th style="background:var(--amber-bg);text-align:center">Tổng phút</th>
    <th>Ghi chú</th>
  </tr>`;

  tbodyEl.innerHTML = empList.map(t => {
    const flagged = t.needsNote > 0;
    const byIso = {};
    (t.lateDates||[]).forEach(d => { byIso[d.iso] = d; });
    const cells = dates.map(iso => {
      const rec = byIso[iso];
      if (!rec) return `<td style="text-align:center;color:var(--text3)"></td>`;
      const c = lateCellColor(rec.min);
      return `<td style="text-align:center;font-family:var(--font-mono);color:${c.color};font-weight:${c.weight}" title="Trễ ${rec.min} phút (tính từ 8:05)">${rec.time}</td>`;
    }).join('');
    return `<tr>
      <td style="font-family:var(--font-mono);${flagged?'color:#C0392B;font-weight:700':''}">${t.code||'—'}</td>
      <td style="${flagged?'font-weight:700;color:#C0392B':'font-weight:500'}">${t.name}${flagged ? ' <span class="late-dot" title="Cần xin phép quản lý / evident"></span>' : ''}</td>
      <td style="color:var(--text2)">${t.dept}</td>
      ${cells}
      <td style="font-family:var(--font-mono);text-align:center;${t.count>0?'color:#B5731E;font-weight:600':''}">${t.count}</td>
      <td style="font-family:var(--font-mono);text-align:center;font-weight:600;${flagged?'color:#C0392B':t.totalMin>0?'color:#B5731E':''}">${t.totalMin}p</td>
      <td>${flagged ? `<span class="badge bd">${t.needsNote} lượt — cần xin phép/evident</span>` : '<span style="color:var(--text3)">—</span>'}</td>
    </tr>`;
  }).join('');
}

// Biến thể trả về HTML string (không set trực tiếp vào thead/tbody) — dùng khi cần ghép
// NHIỀU bảng lưới lịch liên tiếp vào 1 container (vd: tab Quý, mỗi tháng 1 bảng riêng vì
// số cột ngày khác nhau giữa các tháng).
function buildLateGridTableHTML(empList) {
  const dates = buildLateDateUnion(empList);
  if (!dates.length || !empList.length) {
    return '<div style="text-align:center;padding:14px;color:var(--text2);font-size:12.5px">Không có dữ liệu.</div>';
  }
  const dateColsHtml = dates.map(iso => {
    const d = new Date(iso+'T00:00:00');
    const dow = d.getDay();
    const isWeekend = dow===0 || dow===6;
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    return `<th style="text-align:center;min-width:56px;${isWeekend?'background:var(--red-bg)':'background:var(--accent-bg)'}">
      <div style="font-size:9px;color:var(--text2);font-weight:700;text-transform:none">${WEEKDAY_ABBR_EN[dow]}</div>
      <div style="font-size:11px;font-family:var(--font-mono);color:var(--text)">${dd}/${mm}</div>
    </th>`;
  }).join('');
  const rowsHtml = empList.map(t => {
    const flagged = t.needsNote > 0;
    const byIso = {};
    (t.lateDates||[]).forEach(d => { byIso[d.iso] = d; });
    const cells = dates.map(iso => {
      const rec = byIso[iso];
      if (!rec) return `<td style="text-align:center;color:var(--text3)"></td>`;
      const c = lateCellColor(rec.min);
      return `<td style="text-align:center;font-family:var(--font-mono);color:${c.color};font-weight:${c.weight}" title="Trễ ${rec.min} phút (tính từ 8:05)">${rec.time}</td>`;
    }).join('');
    return `<tr>
      <td style="font-family:var(--font-mono);${flagged?'color:#C0392B;font-weight:700':''}">${t.code||'—'}</td>
      <td style="${flagged?'font-weight:700;color:#C0392B':'font-weight:500'}">${t.name}${flagged ? ' <span class="late-dot" title="Cần xin phép quản lý / evident"></span>' : ''}</td>
      <td style="color:var(--text2)">${t.dept}</td>
      ${cells}
      <td style="font-family:var(--font-mono);text-align:center;${t.count>0?'color:#B5731E;font-weight:600':''}">${t.count}</td>
      <td style="font-family:var(--font-mono);text-align:center;font-weight:600;${flagged?'color:#C0392B':t.totalMin>0?'color:#B5731E':''}">${t.totalMin}p</td>
      <td>${flagged ? `<span class="badge bd">${t.needsNote} lượt — cần xin phép/evident</span>` : '<span style="color:var(--text3)">—</span>'}</td>
    </tr>`;
  }).join('');
  return `<div class="tbl-wrap tbl-grid"><table><thead><tr>
    <th>Staff Code</th><th>Nhân viên</th><th>Phòng ban</th>
    ${dateColsHtml}
    <th style="background:var(--amber-bg);text-align:center">Tổng lượt</th>
    <th style="background:var(--amber-bg);text-align:center">Tổng phút</th>
    <th>Ghi chú</th>
  </tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
}

function setActiveLateWeekMK(mk) { activeLateWeekMK = mk; activeLateWeekIdx = null; renderLateWeek(); }
function setLateWeekIdx(idx) { activeLateWeekIdx = idx; renderLateWeek(); }

// Tab "Theo tuần" — Đi trễ CHỈ riêng tuần đang chọn (không cộng dồn từ ngày 16), giống kiểu W1-W4 bên OT.
function renderLateWeek() {
  const keys = Object.keys(LATE_DB).sort();
  const sel = document.getElementById('lateWeekMonthSel');
  if (sel) {
    const prevMk = sel.value;
    sel.innerHTML = keys.map(mk=>`<option value="${mk}">${fmtMK(mk)}</option>`).join('') || '<option value="">— Chưa có dữ liệu —</option>';
    if (keys.includes(prevMk) && prevMk) { sel.value = prevMk; activeLateWeekMK = prevMk; }
    else if (!activeLateWeekMK || !keys.includes(activeLateWeekMK)) { activeLateWeekMK = keys[keys.length-1] || null; }
    if (activeLateWeekMK) sel.value = activeLateWeekMK;
  }

  const chipsEl = document.getElementById('lateWeekChips');
  if (!activeLateWeekMK || !LATE_DB[activeLateWeekMK]) {
    if (chipsEl) chipsEl.innerHTML = '<span style="font-size:12px;color:var(--text2)">Chưa có dữ liệu</span>';
    document.getElementById('lateWeekMetrics').innerHTML = '';
    document.getElementById('lateWeekTHead').innerHTML = '';
    document.getElementById('lateWeekTBody').innerHTML = '<tr><td style="text-align:center;padding:20px;color:var(--text2)">Chưa có dữ liệu.</td></tr>';
    return;
  }

  const periods = buildPeriods(activeLateWeekMK);
  if (!periods.length) return;
  if (activeLateWeekIdx === null || activeLateWeekIdx >= periods.length) activeLateWeekIdx = periods.length - 1;
  if (chipsEl) {
    chipsEl.innerHTML = periods.map((p,i) => {
      const shortLbl = p.label.split(' · ')[0]; // "W1", "W2"...
      return `<button class="chip ${i===activeLateWeekIdx?'active':''}" onclick="setLateWeekIdx(${i})" title="${p.label}">${shortLbl}</button>`;
    }).join('');
  }

  const range = getWeekOnlyRange(periods, activeLateWeekIdx);
  const df = document.getElementById('lateWeekDeptFilter')?.value || '__all__';
  const totals = getLateTotals(activeLateWeekMK, df, range);
  const sortedByMin = [...totals].sort((a,b)=>b.totalMin-a.totalMin);
  const lateCnt = totals.filter(t=>t.totalMin>0).length;
  const totalOccurrences = totals.reduce((a,b)=>a+b.count,0);
  const t2Total = totals.reduce((a,b)=>a+b.t2Count,0);
  const totalMinAll = totals.reduce((a,b)=>a+b.totalMin,0);

  document.getElementById('lateWeekMetrics').innerHTML = `
    <div class="mc"><div class="ml">NV đi trễ tuần này</div><div class="mv">${lateCnt}</div><div class="ms">/ ${totals.length} NV</div></div>
    <div class="mc"><div class="ml">Tổng số lần</div><div class="mv">${totalOccurrences}</div><div class="ms">${totalMinAll} phút tổng</div></div>
    <div class="mc ${t2Total>0?'red':''}"><div class="ml">Cần xin phép (≥30p)</div><div class="mv">${t2Total}</div><div class="ms">lượt trong tuần này</div></div>`;

  const periodLabel = periods[activeLateWeekIdx]?.label || '';
  document.getElementById('lateWeekTableTitle').textContent = `${periodLabel} — ${fmtMK(activeLateWeekMK)}`;
  const empList = sortedByMin.filter(t => t.totalMin > 0);
  renderLateGridTable('lateWeekTHead', 'lateWeekTBody', empList);
}

function rebuildLateUI() {
  updateLateSelects();
  if (lateTab === 'quarter') renderLateQuarter();
  else if (lateTab === 'week') renderLateWeek();
  else renderLate();
}

function updateLateSelects() {
  const keys = Object.keys(LATE_DB).sort();
  const sel = document.getElementById('lateDeptFilter');
  sel.innerHTML = '<option value="__all__">Tất cả phòng ban</option>' +
    LATE_DEPT_LIST.map(d=>`<option value="${d}">${d}</option>`).join('');
  const wSel = document.getElementById('lateWeekDeptFilter');
  if (wSel) wSel.innerHTML = '<option value="__all__">Tất cả phòng ban</option>' +
    LATE_DEPT_LIST.map(d=>`<option value="${d}">${d}</option>`).join('');
  const mSel = document.getElementById('lateMonthSel');
  if (!keys.length) { mSel.innerHTML = '<option>Chưa có dữ liệu</option>'; return; }
  if (!activeLateMK || !LATE_DB[activeLateMK]) activeLateMK = keys[keys.length-1];
  mSel.innerHTML = keys.map(mk =>
    `<option value="${mk}" title="${fmtCompanyMK(mk)}" ${mk===activeLateMK?'selected':''}>${fmtMK(mk)}</option>`
  ).join('');
}
function setActiveLateMK(mk) { activeLateMK = mk; renderLate(); }
function deleteLateMonth(mk) {
  if (!requireAdmin('xoá dữ liệu đi trễ')) return;
  if (!mk || !confirm(`Xóa dữ liệu đi trễ tháng ${fmtMK(mk)}?`)) return;
  delete LATE_DB[mk];
  const ks = Object.keys(LATE_DB).sort();
  activeLateMK = ks.length ? ks[ks.length-1] : null;
  saveLateDB(); rebuildLateUI();
}

function renderLate() {
  updateLateSelects();
  if (!activeLateMK || !LATE_DB[activeLateMK]) {
    document.getElementById('lateMetrics').innerHTML =
      '<div style="grid-column:1/-1;font-size:13px;color:var(--text2);padding:8px 0">Chưa có dữ liệu. Upload file chấm công bên dưới để bắt đầu.</div>';
    killLateChart('cLateDeptCombo'); killLateChart('cLateBar'); killLateChart('cLateTrend');
    document.getElementById('lateTHead').innerHTML = '';
    document.getElementById('lateTBody').innerHTML = '';
    const lrt = document.getElementById('lateRateTBody');
    if (lrt) lrt.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:14px;color:var(--text2)">Chưa có dữ liệu.</td></tr>';
    return;
  }
  const df = document.getElementById('lateDeptFilter').value;
  const totals = getLateTotals(activeLateMK, df);
  const sortedByMin = [...totals].sort((a,b)=>b.totalMin-a.totalMin);
  const cnt = totals.length;
  const lateCnt = totals.filter(t=>t.totalMin>0).length;
  const t1CountTotal = totals.reduce((a,b)=>a+b.t1Count,0);
  const t1MinTotal   = totals.reduce((a,b)=>a+b.t1Min,0);
  const t2CountTotal = totals.reduce((a,b)=>a+b.t2Count,0);
  const t2MinTotal   = totals.reduce((a,b)=>a+b.t2Min,0);
  const totalOccurrences = totals.reduce((a,b)=>a+b.count,0);
  const totalMinAll = totals.reduce((a,b)=>a+b.totalMin,0);
  const avgMin = cnt ? Math.round(totalMinAll/cnt) : 0;
  const max = sortedByMin.length ? sortedByMin[0].totalMin : 0;
  const maxName = sortedByMin.length ? nvLabel(sortedByMin[0]) : '—';

  document.getElementById('lateMetrics').innerHTML = `
    <div class="mc"><div class="ml">Nhân viên có đi trễ</div><div class="mv">${lateCnt}</div><div class="ms">/ ${cnt} NV · ${fmtMK(activeLateMK)}</div></div>
    <div class="mc"><div class="ml">Mốc 1: &lt;15p</div><div class="mv">${t1CountTotal}</div><div class="ms">lượt · ${t1MinTotal} phút</div></div>
    <div class="mc red"><div class="ml">Mốc 2: ≥30p</div><div class="mv">${t2CountTotal}</div><div class="ms">lượt · ${t2MinTotal} phút · cần xin phép</div></div>
    <div class="mc"><div class="ml">Tổng số lần</div><div class="mv">${totalOccurrences}</div><div class="ms">${totalMinAll} phút tổng</div></div>
    <div class="mc"><div class="ml">TB phút trễ</div><div class="mv">${avgMin}</div><div class="ms">mỗi NV / tháng</div></div>
    <div class="mc ${max>120?'red':'amber'}"><div class="ml">Cao nhất</div><div class="mv">${max}</div><div class="ms">${maxName} (phút)</div></div>`;

  // ── Bảng tỷ lệ % phòng ban đi trễ — theo tháng ──
  document.getElementById('lateRateTHead').innerHTML =
    '<tr><th>Phòng ban</th><th>Tổng NV</th><th>NV có đi trễ</th><th>Tỷ lệ %</th></tr>';
  document.getElementById('lateRateTBody').innerHTML = LATE_DEPT_LIST.map(d => {
    const dTotals = getLateTotals(activeLateMK, d);
    const nvCount = dTotals.length;
    const lateNv = dTotals.filter(t=>t.midCount>0).length;
    const pct = nvCount ? Math.round(lateNv/nvCount*100) : 0;
    const pc = pct>=50 ? '#C0392B' : pct>=25 ? '#E8A33D' : '#7A9468';
    return `<tr>
      <td style="font-weight:600">${d}</td>
      <td>${nvCount}</td>
      <td>${lateNv}</td>
      <td><div style="display:flex;align-items:center;gap:8px">
        <span style="font-weight:700;color:${pc};min-width:36px">${pct}%</span>
        <div class="pb" style="flex:1"><div class="pf" style="width:${pct}%;background:${pc}"></div></div>
      </div></td></tr>`;
  }).join('') || `<tr><td colspan="4" style="text-align:center;padding:14px;color:var(--text2)">Không có dữ liệu.</td></tr>`;

  // ── Chart gộp: Tổng số phút đi trễ (cột) + Số lần đi trễ (line) — theo phòng ban, 2 mốc ──
  // Gộp 2 biểu đồ trước đây thành 1: cột = tổng phút, line = số lần — dùng 2 trục Y riêng vì
  // thang đo khác nhau hẳn (phút: hàng trăm, số lần: chỉ vài đơn vị). Màu tách biệt bar/line để
  // dễ phân biệt: cột dùng màu đậm (xanh dương/đỏ), line dùng màu khác hẳn (xanh ngọc/cam).
  killLateChart('cLateDeptCombo');
  const deptStatsCombo = LATE_DEPT_LIST.map(d => {
    const t = getLateTotals(activeLateMK, d);
    return {
      name: d,
      t1Min: t.reduce((a,b)=>a+b.t1Min,0), t2Min: t.reduce((a,b)=>a+b.t2Min,0),
      t1Count: t.reduce((a,b)=>a+b.t1Count,0), t2Count: t.reduce((a,b)=>a+b.t2Count,0)
    };
  });
  const minMax = Math.ceil(Math.max(1, ...deptStatsCombo.map(d=>Math.max(d.t1Min,d.t2Min)))*1.25);
  const countMax = Math.ceil(Math.max(1, ...deptStatsCombo.map(d=>Math.max(d.t1Count,d.t2Count)))*1.3);
  CHL['cLateDeptCombo'] = new Chart(document.getElementById('cLateDeptCombo'), {
    data:{ labels: deptStatsCombo.map(d=>d.name),
      datasets:[
        { type:'bar', label:'Phút — Mốc 1 (<15p)', data:deptStatsCombo.map(d=>d.t1Min),
          backgroundColor:'#2D6CDF', borderWidth:0, borderRadius:5, yAxisID:'yMin', order:2 },
        { type:'bar', label:'Phút — Mốc 2 (≥30p)', data:deptStatsCombo.map(d=>d.t2Min),
          backgroundColor:'#C0392B', borderWidth:0, borderRadius:5, yAxisID:'yMin', order:2 },
        { type:'line', label:'Số lần — Mốc 1 (<15p)', data:deptStatsCombo.map(d=>d.t1Count),
          borderColor:'#17A2B8', backgroundColor:'#17A2B8', borderWidth:2.5, pointRadius:5, pointHoverRadius:6,
          tension:.25, yAxisID:'yCount', order:1 },
        { type:'line', label:'Số lần — Mốc 2 (≥30p)', data:deptStatsCombo.map(d=>d.t2Count),
          borderColor:'#E8890C', backgroundColor:'#E8890C', borderWidth:2.5, pointRadius:5, pointHoverRadius:6,
          tension:.25, yAxisID:'yCount', order:1 }
      ] },
    options:{ responsive:true, maintainAspectRatio:false, layout:{padding:{top:16,right:14,left:6,bottom:6}},
      plugins:{ legend:{display:true, position:'top', labels:{font:{size:10.5},boxWidth:12,padding:8}},
        tooltip:{ callbacks:{ label:c=> c.dataset.type==='line' ? ` ${c.dataset.label}: ${c.raw} lần` : ` ${c.dataset.label}: ${c.raw} phút` } } },
      scales:{
        x:{ grid:{display:false}, ticks:{ font:{size:11} } },
        yMin:{ grid:{color:'rgba(128,128,128,0.12)'}, ticks:{ font:{size:10} }, position:'left', min:0, max:minMax,
               title:{display:true, text:'Tổng phút', font:{size:10}, color:'#2D6CDF'} },
        yCount:{ grid:{display:false}, ticks:{ font:{size:10}, stepSize:1 }, position:'right', min:0, max:countMax,
               title:{display:true, text:'Số lần', font:{size:10}, color:'#E8890C'} }
      } }
  });

  // ── Chart 3: Top NV đi trễ nhiều nhất — stacked 2 mốc (chủ yếu là Mốc 1: <15p) ──
  killLateChart('cLateBar');
  const topLate = sortedByMin.filter(t=>(t.t1Count+t.t2Count)>0)
    .sort((a,b)=>(b.t1Count+b.t2Count)-(a.t1Count+a.t2Count)).slice(0,20);
  document.getElementById('lateBarTitle').textContent = topLate.length
    ? `Nhân viên đi trễ nhiều nhất — ${fmtMK(activeLateMK)}`
    : `Không có NV nào đi trễ trong ${fmtMK(activeLateMK)}`;
  if (topLate.length) {
    CHL['cLateBar'] = new Chart(document.getElementById('cLateBar'), {
      type:'bar',
      data:{ labels: topLate.map(t=>nvLabel(t)),
             datasets:[
               { data:topLate.map(t=>t.t1Count), backgroundColor:'#2D6CDF', borderWidth:0, borderRadius:4, label:'Mốc 1: <15p (lượt)', stack:'s' },
               { data:topLate.map(t=>t.t2Count), backgroundColor:'#C0392B', borderWidth:0, borderRadius:4, label:'Mốc 2: ≥30p (lượt)', stack:'s' }
             ] },
      options:{ responsive:true, maintainAspectRatio:false, layout:{padding:{top:8,right:24,left:6,bottom:6}},
        plugins:{ legend:{display:false},
          tooltip:{ callbacks:{ label:c=>` ${c.dataset.label}: ${c.raw} lượt` } } },
        scales:{ x:{ grid:{display:false}, stacked:true, ticks:{ font:{size:9}, autoSkip:true, maxRotation:50 } },
                 y:{ grid:{color:'rgba(128,128,128,0.12)'}, stacked:true, ticks:{ font:{size:10}, stepSize:1 } } } }
    });
  }

  // ── Chart 4: Xu hướng tổng phút đi trễ theo tháng — từng phòng ban ──
  killLateChart('cLateTrend');
  const mKeys = Object.keys(LATE_DB).sort();
  document.getElementById('lateTrendLeg').innerHTML =
    LATE_DEPT_LIST.map((d,i)=>`<span><span class="ldot" style="background:${DEPT_COLORS[i%DEPT_COLORS.length]}"></span>${d}</span>`).join('');
  CHL['cLateTrend'] = new Chart(document.getElementById('cLateTrend'), {
    type:'line',
    data:{ labels: mKeys.map(fmtMK), datasets: LATE_DEPT_LIST.map((d,i) => ({
      label: d,
      data: mKeys.map(mk => {
        const t = getLateTotals(mk, d);
        return t.length ? t.reduce((a,b)=>a+b.totalMin,0) : null;
      }),
      borderColor: DEPT_COLORS[i%DEPT_COLORS.length], backgroundColor:'transparent',
      tension:.3, borderWidth:2, pointRadius:4, spanGaps:true
    })) },
    options:{ responsive:true, maintainAspectRatio:false, layout:{padding:{top:8,right:14,left:6,bottom:6}},
      plugins:{ legend:{display:false},
        tooltip:{ callbacks:{ label:c=>` ${c.dataset.label}: ${c.raw} phút` } } },
      scales:{ x:{ grid:{display:false}, ticks:{ font:{size:10} } },
               y:{ grid:{color:'rgba(128,128,128,0.12)'}, ticks:{ font:{size:10} } } } }
  });

  // ── Table — kiểu lưới lịch (Excel-style): mỗi cột 1 ngày trễ, ô hiển thị giờ vào, tô màu theo mức độ ──
  document.getElementById('lateTableTitle').textContent = fmtMK(activeLateMK);
  const lateEmpList = sortedByMin.filter(t => t.totalMin > 0); // bỏ NV không đi trễ lần nào
  renderLateGridTable('lateTHead', 'lateTBody', lateEmpList);
}

// ── Theo Quý: tổng hợp Đi trễ theo quý × phòng ban, 2 mốc ──
function renderLateQuarter() {
  const keys = Object.keys(LATE_DB).sort();
  if (!keys.length) {
    ['cLateQtrCount','cLateQtrMin','cLateQtrRisk'].forEach(killLateChart);
    document.getElementById('lateQtrTBody').innerHTML =
      '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text2)">Chưa có dữ liệu.</td></tr>';
    const lqet = document.getElementById('lateQtrEmpGrid');
    if (lqet) lqet.innerHTML = '<div style="text-align:center;padding:14px;color:var(--text2);font-size:12.5px">Chưa có dữ liệu.</div>';
    const lqrt = document.getElementById('lateQtrRateTBody');
    if (lqrt) lqrt.innerHTML = '<tr><td style="text-align:center;padding:14px;color:var(--text2)">Chưa có dữ liệu.</td></tr>';
    return;
  }
  const qKeys = [...new Set(keys.map(quarterKeyOf))].sort();

  // ── Bảng tỷ lệ % phòng ban đi trễ — theo quý (mỗi quý 1 cột %) ──
  document.getElementById('lateQtrRateTHead').innerHTML =
    `<tr><th>Phòng ban</th>${qKeys.map(qk=>`<th>${fmtQK(qk)}</th>`).join('')}</tr>`;
  document.getElementById('lateQtrRateTBody').innerHTML = LATE_DEPT_LIST.map(d => {
    const cells = qKeys.map(qk => {
      const mks = keys.filter(mk => quarterKeyOf(mk) === qk);
      // NV tổng trong quý = hợp các NV phòng ban đó xuất hiện trong các tháng thuộc quý
      const nvSet = new Set();
      const lateSet = new Set();
      mks.forEach(mk => {
        getLateTotals(mk, d).forEach(t => {
          nvSet.add(t.name);
          if (t.midCount > 0) lateSet.add(t.name);
        });
      });
      const nvCount = nvSet.size;
      const pct = nvCount ? Math.round(lateSet.size/nvCount*100) : null;
      if (pct === null) return `<td style="color:var(--text3)">—</td>`;
      const pc = pct>=50 ? '#C0392B' : pct>=25 ? '#E8A33D' : '#7A9468';
      return `<td><span style="font-weight:700;color:${pc}">${pct}%</span> <span style="color:var(--text3);font-size:11px">(${lateSet.size}/${nvCount})</span></td>`;
    }).join('');
    return `<tr><td style="font-weight:600">${d}</td>${cells}</tr>`;
  }).join('') || `<tr><td colspan="${qKeys.length+1}" style="text-align:center;padding:14px;color:var(--text2)">Không có dữ liệu.</td></tr>`;

  // Số lần đi trễ theo PB × Quý — 2 mốc (gộp tất cả PB lại theo từng mốc cho dễ nhìn theo Quý)
  killLateChart('cLateQtrCount');
  const qtrCountByDeptTier = LATE_DEPT_LIST.map((d,i) => {
    const t1 = qKeys.map(qk => {
      const mks = keys.filter(mk => quarterKeyOf(mk) === qk);
      return mks.reduce((s,mk)=> s + getLateTotals(mk, d).reduce((a,b)=>a+b.t1Count,0), 0);
    });
    const t2 = qKeys.map(qk => {
      const mks = keys.filter(mk => quarterKeyOf(mk) === qk);
      return mks.reduce((s,mk)=> s + getLateTotals(mk, d).reduce((a,b)=>a+b.t2Count,0), 0);
    });
    return { dept:d, t1, t2 };
  });
  CHL['cLateQtrCount'] = new Chart(document.getElementById('cLateQtrCount'), {
    type:'bar',
    data:{ labels: qKeys.map(fmtQK),
      datasets:[
        { label:'Mốc 1: <15p (tổng các PB)', backgroundColor:'#2D6CDF', borderWidth:0, borderRadius:5,
          data: qKeys.map((_,qi)=> qtrCountByDeptTier.reduce((s,d)=>s+d.t1[qi],0)) },
        { label:'Mốc 2: ≥30p (tổng các PB)', backgroundColor:'#C0392B', borderWidth:0, borderRadius:5,
          data: qKeys.map((_,qi)=> qtrCountByDeptTier.reduce((s,d)=>s+d.t2[qi],0)) }
      ] },
    options:{ responsive:true, maintainAspectRatio:false, layout:{padding:{top:26,right:14,left:6,bottom:6}},
      plugins:{ legend:{display:true, position:'top', labels:{font:{size:11},boxWidth:12,padding:10}},
        barValueLabels:{},
        tooltip:{ callbacks:{ label:c=>` ${c.dataset.label}: ${c.raw} lần` } } },
      scales:{ x:{ grid:{display:false}, ticks:{ font:{size:10} } },
               y:{ grid:{color:'rgba(128,128,128,0.12)'}, ticks:{ font:{size:10}, stepSize:1 },
                   suggestedMax: Math.ceil(Math.max(1, ...qKeys.map((_,qi)=>qtrCountByDeptTier.reduce((s,d)=>s+d.t1[qi],0)))*1.18) } } }
  });

  // Tổng phút đi trễ theo Quý — 2 mốc
  killLateChart('cLateQtrMin');
  const qtrMinByTier = {
    t1: qKeys.map(qk => {
      const mks = keys.filter(mk => quarterKeyOf(mk) === qk);
      return mks.reduce((s,mk)=> s + getLateTotals(mk,'__all__').reduce((a,b)=>a+b.t1Min,0), 0);
    }),
    t2: qKeys.map(qk => {
      const mks = keys.filter(mk => quarterKeyOf(mk) === qk);
      return mks.reduce((s,mk)=> s + getLateTotals(mk,'__all__').reduce((a,b)=>a+b.t2Min,0), 0);
    })
  };
  CHL['cLateQtrMin'] = new Chart(document.getElementById('cLateQtrMin'), {
    type:'bar',
    data:{ labels: qKeys.map(fmtQK),
      datasets:[
        { label:'Mốc 1: <15p', backgroundColor:'#2D6CDF', borderWidth:0, borderRadius:5, data: qtrMinByTier.t1 },
        { label:'Mốc 2: ≥30p', backgroundColor:'#C0392B', borderWidth:0, borderRadius:5, data: qtrMinByTier.t2 }
      ] },
    options:{ responsive:true, maintainAspectRatio:false, layout:{padding:{top:26,right:14,left:6,bottom:6}},
      plugins:{ legend:{display:true, position:'top', labels:{font:{size:11},boxWidth:12,padding:10}},
        barValueLabels:{},
        tooltip:{ callbacks:{ label:c=>` ${c.dataset.label}: ${c.raw} phút` } } },
      scales:{ x:{ grid:{display:false}, ticks:{ font:{size:10} } },
               y:{ grid:{color:'rgba(128,128,128,0.12)'}, ticks:{ font:{size:10} },
                   suggestedMax: Math.ceil(Math.max(1, ...qtrMinByTier.t2)*1.18) } } }
  });

  // NV cần xin phép nhiều nhất (Mốc 2: ≥30p) — gộp toàn bộ các quý
  const allNVs = [...new Set(keys.flatMap(mk => LATE_DB[mk].names))];
  const risk = allNVs.map(n => {
    let t2Sum = 0;
    keys.forEach(mk => {
      const e = LATE_DB[mk].employees[n];
      if (e) t2Sum += Object.values(e.days||{}).filter(v=>v>=30).length;
    });
    return { name: nvLabelByName(n, LATE_DB, keys), count: t2Sum };
  }).filter(x=>x.count>0).sort((a,b)=>b.count-a.count).slice(0,8);

  killLateChart('cLateQtrRisk');
  const riskH = Math.max(160, risk.length*36+60);
  document.getElementById('cLateQtrRisk').parentElement.style.height = riskH+'px';
  CHL['cLateQtrRisk'] = new Chart(document.getElementById('cLateQtrRisk'), {
    type:'bar',
    data:{ labels:risk.map(x=>x.name), datasets:[{data:risk.map(x=>x.count),
      backgroundColor:'#C0392B', borderWidth:0, borderRadius:3, label:'Lượt ≥30p'}]},
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, layout:{padding:{top:6,right:38,left:6,bottom:6}},
      plugins:{legend:{display:false}, barValueLabels:{},
        tooltip:{callbacks:{label:c=>` ${c.raw} lượt ≥30p (cần xin phép)`}}},
      scales:{x:{grid:{color:'rgba(128,128,128,0.12)'},ticks:{font:{size:10},stepSize:1},
                 suggestedMax: Math.ceil(Math.max(1, ...risk.map(x=>x.count))*1.2)},
              y:{grid:{display:false},ticks:{font:{size:10}}}}}});

  // Bảng tổng hợp Quý × phòng ban
  document.getElementById('lateQtrTHead').innerHTML =
    '<tr><th>Quý</th><th>Phòng ban</th><th>Mốc 1: &lt;15p (lượt)</th><th>Mốc 1: &lt;15p (phút)</th>' +
    '<th>Mốc 2: ≥30p (lượt)</th><th>Mốc 2: ≥30p (phút)</th><th>Tổng lượt</th><th>Tổng phút</th></tr>';
  const qRows = [];
  qKeys.forEach(qk => {
    const mks = keys.filter(mk => quarterKeyOf(mk) === qk);
    LATE_DEPT_LIST.forEach(dept => {
      let t1C=0,t1M=0,t2C=0,t2M=0,totC=0,totM=0;
      mks.forEach(mk => {
        getLateTotals(mk, dept).forEach(t => {
          t1C+=t.t1Count; t1M+=t.t1Min; t2C+=t.t2Count; t2M+=t.t2Min; totC+=t.count; totM+=t.totalMin;
        });
      });
      if (totC === 0) return; // bỏ dòng PB không có dữ liệu trong quý đó
      qRows.push(`<tr>
        <td style="font-weight:500">${fmtQK(qk)}</td>
        <td>${dept}</td>
        <td style="font-family:var(--font-mono);color:#2D6CDF;font-weight:600">${t1C}</td>
        <td style="font-family:var(--font-mono);color:#2D6CDF;font-weight:600">${t1M}p</td>
        <td style="font-family:var(--font-mono);color:#C0392B;font-weight:700">${t2C}</td>
        <td style="font-family:var(--font-mono);color:#C0392B;font-weight:700">${t2M}p</td>
        <td style="font-family:var(--font-mono);font-weight:600">${totC}</td>
        <td style="font-family:var(--font-mono);font-weight:600">${totM}p</td></tr>`);
    });
  });
  document.getElementById('lateQtrTBody').innerHTML = qRows.join('') ||
    '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text2)">Không có dữ liệu.</td></tr>';

  // ── Bảng chi tiết theo TỪNG NHÂN VIÊN — theo quý: 1 bảng lưới lịch riêng cho MỖI THÁNG trong quý
  // (vì mỗi tháng có số cột ngày khác nhau, không gộp chung 1 bảng được) ──
  document.getElementById('lateQtrTableTitle').textContent = qKeys.map(fmtQK).join(', ');
  const gridEl = document.getElementById('lateQtrEmpGrid');
  if (gridEl) {
    const monthsInRange = keys.filter(mk => qKeys.includes(quarterKeyOf(mk)));
    const sectionsHtml = monthsInRange.map(mk => {
      const empList = getLateTotals(mk, '__all__').filter(t => t.totalMin > 0).sort((a,b)=>b.totalMin-a.totalMin);
      if (!empList.length) return '';
      return `<div class="late-grid-month-title">${fmtMK(mk)}</div>${buildLateGridTableHTML(empList)}`;
    }).filter(Boolean).join('');
    gridEl.innerHTML = sectionsHtml || '<div style="text-align:center;padding:14px;color:var(--text2);font-size:12.5px">Không có dữ liệu.</div>';
  }
}

// ============================================================
//  INIT
// ============================================================
function init() {
  try {
    loadSyncConfig();
    refreshSyncBadgeIdle();
    const ok   = loadDB();
    const keys = Object.keys(DB).sort();
    if (keys.length) { activeMK = keys[keys.length-1]; activePeriod = null; }
    loadLateDB();
    const lm = Object.keys(LATE_DB).sort();
    if (lm.length) activeLateMK = lm[lm.length-1];
    loadOffDB();
    loadWlbXls();
    loadProjectsDB();
    loadUsersDB();
    rebuildLateUI();
    renderWlbSummary();
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('appBody').style.display = 'block';
    // Nếu phiên này đã chọn vai trò rồi (refresh lại trang cùng tab) thì khỏi hỏi lại — ngược lại
    // vẫn hiện màn hình chọn vai trò (đã hiện sẵn theo mặc định trong HTML).
    if (sessionStorage.getItem(ROLE_KEY)) {
      const gate = document.getElementById('roleGate');
      if (gate) gate.style.display = 'none';
    }
    applyRoleUI();
    if (!ok || !keys.length) loadDemo();
    else rebuildUI();
  } catch (err) {
    console.error('init error:', err);
    const ls = document.getElementById('loadingState');
    ls.innerHTML = `<div style="color:#B14B3F;font-size:13px;text-align:left;max-width:500px;margin:0 auto">
      <strong>Lỗi khi tải app:</strong><br>${err.message}<br><br>
      <button class="btn" onclick="localStorage.removeItem('${STORAGE_KEY}');location.reload()">Xóa dữ liệu lỗi & tải lại</button>
    </div>`;
  }
}

// ============================================================
//  APP INIT (password gate removed)
// ============================================================
document.getElementById('loadingState').style.display = 'block';
init();
