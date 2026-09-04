// ============================================================
//  PHIÊN BẢN APP — chỉ cần đổi số này mỗi lần update (vd: '2026.2', '2026.3'...)
// ============================================================
const APP_VERSION = '2026.25';
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
function stOf(t) { return t > 70 ? 'd' : 'o'; }
function stBadge(t) {
  const s = stOf(t);
  return s==='d' ? '<span class="badge bd">Vượt mức</span>'
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
  return totals.map(t => ({ ...t, total: t.deltaTotal, nightTotal: t.deltaNightTotal }));
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
  if (!confirm(`Xóa dữ liệu ${fmtMK(mk)}?`)) return;
  delete DB[mk];
  const ks = Object.keys(DB).sort();
  activeMK = ks.length ? ks[ks.length-1] : null;
  saveDB(); rebuildUI(); renderSavedMonths(); renderWlbSummary();
  if (document.getElementById('pg-wlb')?.classList.contains('show')) renderWlb();
  toast(`Đã xóa ${fmtMK(mk)}`);
}

function clearAll() {
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
    ['cBar','cDashKpiPct','cDashPayPct'].forEach(killChart);
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

  if (dashTab === 'week') {
    renderDashKpiPctChart(totals, periodLabel);
    renderDashPayPctChart(totals, periodLabel);
  } else {
    killChart('cDashKpiPct'); killChart('cDashPayPct');
  }

  renderDashDeptLineChart();
  renderDashWarnList(totals);
  renderNightOtFreqChart(df, periodIdx);
  renderDashOverBarChart(totals);
  renderDashProjectBarChart(totals);
}

// 2 biểu đồ mới (thay cho "Top 8 NV" cũ) — % Giới hạn KPI (45h) và % Giới hạn Chi trả (70h),
// tính trên đúng OT PHÁT SINH TRONG TUẦN đang xem (t.deltaTotal), sắp theo % giảm dần.
function renderDashKpiPctChart(totals, periodLabel) {
  const lbl = document.getElementById('dashKpiPctLabel');
  if (lbl) lbl.textContent = periodLabel || '';
  const entries = totals.filter(t => (t.deltaTotal||0) > 0)
    .map(t => ({ name: t.name, value: Math.round((t.deltaTotal||0)/45*1000)/10 }))
    .sort((a,b) => b.value - a.value).slice(0, 15);
  renderGenericProjectBarChart(CH, killChart, 'cDashKpiPct',
    document.getElementById('cDashKpiPct'), document.getElementById('cDashKpiPctEmpty'),
    entries, '%', '#E8A33D');
}
function renderDashPayPctChart(totals, periodLabel) {
  const lbl = document.getElementById('dashPayPctLabel');
  if (lbl) lbl.textContent = periodLabel || '';
  const entries = totals.filter(t => (t.deltaTotal||0) > 0)
    .map(t => ({ name: t.name, value: Math.round((t.deltaTotal||0)/70*1000)/10 }))
    .sort((a,b) => b.value - a.value).slice(0, 15);
  renderGenericProjectBarChart(CH, killChart, 'cDashPayPct',
    document.getElementById('cDashPayPct'), document.getElementById('cDashPayPctEmpty'),
    entries, '%', '#C0392B');
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
    { key:'o', label:'Bình thường ≤70h', color:'#7A9468' },
    { key:'d', label:'Vượt 70h',          color:'#C0392B' }
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
    const fc  = stOf(t.total)==='d'?'#C0392B':stOf(t.total)==='w'?'#E8A33D':'#7A9468';
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
const CHART_JS_B64_FOR_REPORT = "LyohCiAqIENoYXJ0LmpzIHY0LjUuMQogKiBodHRwczovL3d3dy5jaGFydGpzLm9yZwogKiAoYykgMjAyNSBDaGFydC5qcyBDb250cmlidXRvcnMKICogUmVsZWFzZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlCiAqLwohZnVuY3Rpb24odCxlKXsib2JqZWN0Ij09dHlwZW9mIGV4cG9ydHMmJiJ1bmRlZmluZWQiIT10eXBlb2YgbW9kdWxlP21vZHVsZS5leHBvcnRzPWUoKToiZnVuY3Rpb24iPT10eXBlb2YgZGVmaW5lJiZkZWZpbmUuYW1kP2RlZmluZShlKToodD0idW5kZWZpbmVkIiE9dHlwZW9mIGdsb2JhbFRoaXM/Z2xvYmFsVGhpczp0fHxzZWxmKS5DaGFydD1lKCl9KHRoaXMsKGZ1bmN0aW9uKCl7InVzZSBzdHJpY3QiO3ZhciB0PU9iamVjdC5mcmVlemUoe19fcHJvdG9fXzpudWxsLGdldCBDb2xvcnMoKXtyZXR1cm4gSm99LGdldCBEZWNpbWF0aW9uKCl7cmV0dXJuIHRhfSxnZXQgRmlsbGVyKCl7cmV0dXJuIGJhfSxnZXQgTGVnZW5kKCl7cmV0dXJuIE1hfSxnZXQgU3ViVGl0bGUoKXtyZXR1cm4gUGF9LGdldCBUaXRsZSgpe3JldHVybiBrYX0sZ2V0IFRvb2x0aXAoKXtyZXR1cm4gTmF9fSk7ZnVuY3Rpb24gZSgpe31jb25zdCBpPSgoKT0+e2xldCB0PTA7cmV0dXJuKCk9PnQrK30pKCk7ZnVuY3Rpb24gcyh0KXtyZXR1cm4gbnVsbD09dH1mdW5jdGlvbiBuKHQpe2lmKEFycmF5LmlzQXJyYXkmJkFycmF5LmlzQXJyYXkodCkpcmV0dXJuITA7Y29uc3QgZT1PYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodCk7cmV0dXJuIltvYmplY3QiPT09ZS5zbGljZSgwLDcpJiYiQXJyYXldIj09PWUuc2xpY2UoLTYpfWZ1bmN0aW9uIG8odCl7cmV0dXJuIG51bGwhPT10JiYiW29iamVjdCBPYmplY3RdIj09PU9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh0KX1mdW5jdGlvbiBhKHQpe3JldHVybigibnVtYmVyIj09dHlwZW9mIHR8fHQgaW5zdGFuY2VvZiBOdW1iZXIpJiZpc0Zpbml0ZSgrdCl9ZnVuY3Rpb24gcih0LGUpe3JldHVybiBhKHQpP3Q6ZX1mdW5jdGlvbiBsKHQsZSl7cmV0dXJuIHZvaWQgMD09PXQ/ZTp0fWNvbnN0IGg9KHQsZSk9PiJzdHJpbmciPT10eXBlb2YgdCYmdC5lbmRzV2l0aCgiJSIpP3BhcnNlRmxvYXQodCkvMTAwOit0L2UsYz0odCxlKT0+InN0cmluZyI9PXR5cGVvZiB0JiZ0LmVuZHNXaXRoKCIlIik/cGFyc2VGbG9hdCh0KS8xMDAqZTordDtmdW5jdGlvbiBkKHQsZSxpKXtpZih0JiYiZnVuY3Rpb24iPT10eXBlb2YgdC5jYWxsKXJldHVybiB0LmFwcGx5KGksZSl9ZnVuY3Rpb24gdSh0LGUsaSxzKXtsZXQgYSxyLGw7aWYobih0KSlpZihyPXQubGVuZ3RoLHMpZm9yKGE9ci0xO2E+PTA7YS0tKWUuY2FsbChpLHRbYV0sYSk7ZWxzZSBmb3IoYT0wO2E8cjthKyspZS5jYWxsKGksdFthXSxhKTtlbHNlIGlmKG8odCkpZm9yKGw9T2JqZWN0LmtleXModCkscj1sLmxlbmd0aCxhPTA7YTxyO2ErKyllLmNhbGwoaSx0W2xbYV1dLGxbYV0pfWZ1bmN0aW9uIGYodCxlKXtsZXQgaSxzLG4sbztpZighdHx8IWV8fHQubGVuZ3RoIT09ZS5sZW5ndGgpcmV0dXJuITE7Zm9yKGk9MCxzPXQubGVuZ3RoO2k8czsrK2kpaWYobj10W2ldLG89ZVtpXSxuLmRhdGFzZXRJbmRleCE9PW8uZGF0YXNldEluZGV4fHxuLmluZGV4IT09by5pbmRleClyZXR1cm4hMTtyZXR1cm4hMH1mdW5jdGlvbiBnKHQpe2lmKG4odCkpcmV0dXJuIHQubWFwKGcpO2lmKG8odCkpe2NvbnN0IGU9T2JqZWN0LmNyZWF0ZShudWxsKSxpPU9iamVjdC5rZXlzKHQpLHM9aS5sZW5ndGg7bGV0IG49MDtmb3IoO248czsrK24pZVtpW25dXT1nKHRbaVtuXV0pO3JldHVybiBlfXJldHVybiB0fWZ1bmN0aW9uIHAodCl7cmV0dXJuLTE9PT1bIl9fcHJvdG9fXyIsInByb3RvdHlwZSIsImNvbnN0cnVjdG9yIl0uaW5kZXhPZih0KX1mdW5jdGlvbiBtKHQsZSxpLHMpe2lmKCFwKHQpKXJldHVybjtjb25zdCBuPWVbdF0sYT1pW3RdO28obikmJm8oYSk/eChuLGEscyk6ZVt0XT1nKGEpfWZ1bmN0aW9uIHgodCxlLGkpe2NvbnN0IHM9bihlKT9lOltlXSxhPXMubGVuZ3RoO2lmKCFvKHQpKXJldHVybiB0O2NvbnN0IHI9KGk9aXx8e30pLm1lcmdlcnx8bTtsZXQgbDtmb3IobGV0IGU9MDtlPGE7KytlKXtpZihsPXNbZV0sIW8obCkpY29udGludWU7Y29uc3Qgbj1PYmplY3Qua2V5cyhsKTtmb3IobGV0IGU9MCxzPW4ubGVuZ3RoO2U8czsrK2UpcihuW2VdLHQsbCxpKX1yZXR1cm4gdH1mdW5jdGlvbiBiKHQsZSl7cmV0dXJuIHgodCxlLHttZXJnZXI6X30pfWZ1bmN0aW9uIF8odCxlLGkpe2lmKCFwKHQpKXJldHVybjtjb25zdCBzPWVbdF0sbj1pW3RdO28ocykmJm8obik/YihzLG4pOk9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChlLHQpfHwoZVt0XT1nKG4pKX1jb25zdCB5PXsiIjp0PT50LHg6dD0+dC54LHk6dD0+dC55fTtmdW5jdGlvbiB2KHQpe2NvbnN0IGU9dC5zcGxpdCgiLiIpLGk9W107bGV0IHM9IiI7Zm9yKGNvbnN0IHQgb2YgZSlzKz10LHMuZW5kc1dpdGgoIlxcIik/cz1zLnNsaWNlKDAsLTEpKyIuIjooaS5wdXNoKHMpLHM9IiIpO3JldHVybiBpfWZ1bmN0aW9uIE0odCxlKXtjb25zdCBpPXlbZV18fCh5W2VdPWZ1bmN0aW9uKHQpe2NvbnN0IGU9dih0KTtyZXR1cm4gdD0+e2Zvcihjb25zdCBpIG9mIGUpe2lmKCIiPT09aSlicmVhazt0PXQmJnRbaV19cmV0dXJuIHR9fShlKSk7cmV0dXJuIGkodCl9ZnVuY3Rpb24gdyh0KXtyZXR1cm4gdC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSt0LnNsaWNlKDEpfWNvbnN0IGs9dD0+dm9pZCAwIT09dCxTPXQ9PiJmdW5jdGlvbiI9PXR5cGVvZiB0LFA9KHQsZSk9PntpZih0LnNpemUhPT1lLnNpemUpcmV0dXJuITE7Zm9yKGNvbnN0IGkgb2YgdClpZighZS5oYXMoaSkpcmV0dXJuITE7cmV0dXJuITB9O2Z1bmN0aW9uIEQodCl7cmV0dXJuIm1vdXNldXAiPT09dC50eXBlfHwiY2xpY2siPT09dC50eXBlfHwiY29udGV4dG1lbnUiPT09dC50eXBlfWNvbnN0IEM9TWF0aC5QSSxPPTIqQyxBPU8rQyxUPU51bWJlci5QT1NJVElWRV9JTkZJTklUWSxMPUMvMTgwLEU9Qy8yLFI9Qy80LEk9MipDLzMsej1NYXRoLmxvZzEwLEY9TWF0aC5zaWduO2Z1bmN0aW9uIFYodCxlLGkpe3JldHVybiBNYXRoLmFicyh0LWUpPGl9ZnVuY3Rpb24gQih0KXtjb25zdCBlPU1hdGgucm91bmQodCk7dD1WKHQsZSx0LzFlMyk/ZTp0O2NvbnN0IGk9TWF0aC5wb3coMTAsTWF0aC5mbG9vcih6KHQpKSkscz10L2k7cmV0dXJuKHM8PTE/MTpzPD0yPzI6czw9NT81OjEwKSppfWZ1bmN0aW9uIFcodCl7Y29uc3QgZT1bXSxpPU1hdGguc3FydCh0KTtsZXQgcztmb3Iocz0xO3M8aTtzKyspdCVzPT0wJiYoZS5wdXNoKHMpLGUucHVzaCh0L3MpKTtyZXR1cm4gaT09PSgwfGkpJiZlLnB1c2goaSksZS5zb3J0KCgodCxlKT0+dC1lKSkucG9wKCksZX1mdW5jdGlvbiBOKHQpe3JldHVybiFmdW5jdGlvbih0KXtyZXR1cm4ic3ltYm9sIj09dHlwZW9mIHR8fCJvYmplY3QiPT10eXBlb2YgdCYmbnVsbCE9PXQmJiEoU3ltYm9sLnRvUHJpbWl0aXZlIGluIHR8fCJ0b1N0cmluZyJpbiB0fHwidmFsdWVPZiJpbiB0KX0odCkmJiFpc05hTihwYXJzZUZsb2F0KHQpKSYmaXNGaW5pdGUodCl9ZnVuY3Rpb24gSCh0LGUpe2NvbnN0IGk9TWF0aC5yb3VuZCh0KTtyZXR1cm4gaS1lPD10JiZpK2U+PXR9ZnVuY3Rpb24gaih0LGUsaSl7bGV0IHMsbixvO2ZvcihzPTAsbj10Lmxlbmd0aDtzPG47cysrKW89dFtzXVtpXSxpc05hTihvKXx8KGUubWluPU1hdGgubWluKGUubWluLG8pLGUubWF4PU1hdGgubWF4KGUubWF4LG8pKX1mdW5jdGlvbiAkKHQpe3JldHVybiB0KihDLzE4MCl9ZnVuY3Rpb24gWSh0KXtyZXR1cm4gdCooMTgwL0MpfWZ1bmN0aW9uIFUodCl7aWYoIWEodCkpcmV0dXJuO2xldCBlPTEsaT0wO2Zvcig7TWF0aC5yb3VuZCh0KmUpL2UhPT10OyllKj0xMCxpKys7cmV0dXJuIGl9ZnVuY3Rpb24gWCh0LGUpe2NvbnN0IGk9ZS54LXQueCxzPWUueS10Lnksbj1NYXRoLnNxcnQoaSppK3Mqcyk7bGV0IG89TWF0aC5hdGFuMihzLGkpO3JldHVybiBvPC0uNSpDJiYobys9Tykse2FuZ2xlOm8sZGlzdGFuY2U6bn19ZnVuY3Rpb24gcSh0LGUpe3JldHVybiBNYXRoLnNxcnQoTWF0aC5wb3coZS54LXQueCwyKStNYXRoLnBvdyhlLnktdC55LDIpKX1mdW5jdGlvbiBLKHQsZSl7cmV0dXJuKHQtZStBKSVPLUN9ZnVuY3Rpb24gRyh0KXtyZXR1cm4odCVPK08pJU99ZnVuY3Rpb24gSih0LGUsaSxzKXtjb25zdCBuPUcodCksbz1HKGUpLGE9RyhpKSxyPUcoby1uKSxsPUcoYS1uKSxoPUcobi1vKSxjPUcobi1hKTtyZXR1cm4gbj09PW98fG49PT1hfHxzJiZvPT09YXx8cj5sJiZoPGN9ZnVuY3Rpb24gWih0LGUsaSl7cmV0dXJuIE1hdGgubWF4KGUsTWF0aC5taW4oaSx0KSl9ZnVuY3Rpb24gUSh0KXtyZXR1cm4gWih0LC0zMjc2OCwzMjc2Nyl9ZnVuY3Rpb24gdHQodCxlLGkscz0xZS02KXtyZXR1cm4gdD49TWF0aC5taW4oZSxpKS1zJiZ0PD1NYXRoLm1heChlLGkpK3N9ZnVuY3Rpb24gZXQodCxlLGkpe2k9aXx8KGk9PnRbaV08ZSk7bGV0IHMsbj10Lmxlbmd0aC0xLG89MDtmb3IoO24tbz4xOylzPW8rbj4+MSxpKHMpP289czpuPXM7cmV0dXJue2xvOm8saGk6bn19Y29uc3QgaXQ9KHQsZSxpLHMpPT5ldCh0LGkscz9zPT57Y29uc3Qgbj10W3NdW2VdO3JldHVybiBuPGl8fG49PT1pJiZ0W3MrMV1bZV09PT1pfTpzPT50W3NdW2VdPGkpLHN0PSh0LGUsaSk9PmV0KHQsaSwocz0+dFtzXVtlXT49aSkpO2Z1bmN0aW9uIG50KHQsZSxpKXtsZXQgcz0wLG49dC5sZW5ndGg7Zm9yKDtzPG4mJnRbc108ZTspcysrO2Zvcig7bj5zJiZ0W24tMV0+aTspbi0tO3JldHVybiBzPjB8fG48dC5sZW5ndGg/dC5zbGljZShzLG4pOnR9Y29uc3Qgb3Q9WyJwdXNoIiwicG9wIiwic2hpZnQiLCJzcGxpY2UiLCJ1bnNoaWZ0Il07ZnVuY3Rpb24gYXQodCxlKXt0Ll9jaGFydGpzP3QuX2NoYXJ0anMubGlzdGVuZXJzLnB1c2goZSk6KE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0LCJfY2hhcnRqcyIse2NvbmZpZ3VyYWJsZTohMCxlbnVtZXJhYmxlOiExLHZhbHVlOntsaXN0ZW5lcnM6W2VdfX0pLG90LmZvckVhY2goKGU9Pntjb25zdCBpPSJfb25EYXRhIit3KGUpLHM9dFtlXTtPYmplY3QuZGVmaW5lUHJvcGVydHkodCxlLHtjb25maWd1cmFibGU6ITAsZW51bWVyYWJsZTohMSx2YWx1ZSguLi5lKXtjb25zdCBuPXMuYXBwbHkodGhpcyxlKTtyZXR1cm4gdC5fY2hhcnRqcy5saXN0ZW5lcnMuZm9yRWFjaCgodD0+eyJmdW5jdGlvbiI9PXR5cGVvZiB0W2ldJiZ0W2ldKC4uLmUpfSkpLG59fSl9KSkpfWZ1bmN0aW9uIHJ0KHQsZSl7Y29uc3QgaT10Ll9jaGFydGpzO2lmKCFpKXJldHVybjtjb25zdCBzPWkubGlzdGVuZXJzLG49cy5pbmRleE9mKGUpOy0xIT09biYmcy5zcGxpY2UobiwxKSxzLmxlbmd0aD4wfHwob3QuZm9yRWFjaCgoZT0+e2RlbGV0ZSB0W2VdfSkpLGRlbGV0ZSB0Ll9jaGFydGpzKX1mdW5jdGlvbiBsdCh0KXtjb25zdCBlPW5ldyBTZXQodCk7cmV0dXJuIGUuc2l6ZT09PXQubGVuZ3RoP3Q6QXJyYXkuZnJvbShlKX1jb25zdCBodD0idW5kZWZpbmVkIj09dHlwZW9mIHdpbmRvdz9mdW5jdGlvbih0KXtyZXR1cm4gdCgpfTp3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lO2Z1bmN0aW9uIGN0KHQsZSl7bGV0IGk9W10scz0hMTtyZXR1cm4gZnVuY3Rpb24oLi4ubil7aT1uLHN8fChzPSEwLGh0LmNhbGwod2luZG93LCgoKT0+e3M9ITEsdC5hcHBseShlLGkpfSkpKX19ZnVuY3Rpb24gZHQodCxlKXtsZXQgaTtyZXR1cm4gZnVuY3Rpb24oLi4ucyl7cmV0dXJuIGU/KGNsZWFyVGltZW91dChpKSxpPXNldFRpbWVvdXQodCxlLHMpKTp0LmFwcGx5KHRoaXMscyksZX19Y29uc3QgdXQ9dD0+InN0YXJ0Ij09PXQ/ImxlZnQiOiJlbmQiPT09dD8icmlnaHQiOiJjZW50ZXIiLGZ0PSh0LGUsaSk9PiJzdGFydCI9PT10P2U6ImVuZCI9PT10P2k6KGUraSkvMixndD0odCxlLGkscyk9PnQ9PT0ocz8ibGVmdCI6InJpZ2h0Iik/aToiY2VudGVyIj09PXQ/KGUraSkvMjplO2Z1bmN0aW9uIHB0KHQsZSxpKXtjb25zdCBuPWUubGVuZ3RoO2xldCBvPTAsYT1uO2lmKHQuX3NvcnRlZCl7Y29uc3R7aVNjYWxlOnIsdlNjYWxlOmwsX3BhcnNlZDpofT10LGM9dC5kYXRhc2V0JiZ0LmRhdGFzZXQub3B0aW9ucz90LmRhdGFzZXQub3B0aW9ucy5zcGFuR2FwczpudWxsLGQ9ci5heGlzLHttaW46dSxtYXg6ZixtaW5EZWZpbmVkOmcsbWF4RGVmaW5lZDpwfT1yLmdldFVzZXJCb3VuZHMoKTtpZihnKXtpZihvPU1hdGgubWluKGl0KGgsZCx1KS5sbyxpP246aXQoZSxkLHIuZ2V0UGl4ZWxGb3JWYWx1ZSh1KSkubG8pLGMpe2NvbnN0IHQ9aC5zbGljZSgwLG8rMSkucmV2ZXJzZSgpLmZpbmRJbmRleCgodD0+IXModFtsLmF4aXNdKSkpO28tPU1hdGgubWF4KDAsdCl9bz1aKG8sMCxuLTEpfWlmKHApe2xldCB0PU1hdGgubWF4KGl0KGgsci5heGlzLGYsITApLmhpKzEsaT8wOml0KGUsZCxyLmdldFBpeGVsRm9yVmFsdWUoZiksITApLmhpKzEpO2lmKGMpe2NvbnN0IGU9aC5zbGljZSh0LTEpLmZpbmRJbmRleCgodD0+IXModFtsLmF4aXNdKSkpO3QrPU1hdGgubWF4KDAsZSl9YT1aKHQsbyxuKS1vfWVsc2UgYT1uLW99cmV0dXJue3N0YXJ0Om8sY291bnQ6YX19ZnVuY3Rpb24gbXQodCl7Y29uc3R7eFNjYWxlOmUseVNjYWxlOmksX3NjYWxlUmFuZ2VzOnN9PXQsbj17eG1pbjplLm1pbix4bWF4OmUubWF4LHltaW46aS5taW4seW1heDppLm1heH07aWYoIXMpcmV0dXJuIHQuX3NjYWxlUmFuZ2VzPW4sITA7Y29uc3Qgbz1zLnhtaW4hPT1lLm1pbnx8cy54bWF4IT09ZS5tYXh8fHMueW1pbiE9PWkubWlufHxzLnltYXghPT1pLm1heDtyZXR1cm4gT2JqZWN0LmFzc2lnbihzLG4pLG99Y2xhc3MgeHR7Y29uc3RydWN0b3IoKXt0aGlzLl9yZXF1ZXN0PW51bGwsdGhpcy5fY2hhcnRzPW5ldyBNYXAsdGhpcy5fcnVubmluZz0hMSx0aGlzLl9sYXN0RGF0ZT12b2lkIDB9X25vdGlmeSh0LGUsaSxzKXtjb25zdCBuPWUubGlzdGVuZXJzW3NdLG89ZS5kdXJhdGlvbjtuLmZvckVhY2goKHM9PnMoe2NoYXJ0OnQsaW5pdGlhbDplLmluaXRpYWwsbnVtU3RlcHM6byxjdXJyZW50U3RlcDpNYXRoLm1pbihpLWUuc3RhcnQsbyl9KSkpfV9yZWZyZXNoKCl7dGhpcy5fcmVxdWVzdHx8KHRoaXMuX3J1bm5pbmc9ITAsdGhpcy5fcmVxdWVzdD1odC5jYWxsKHdpbmRvdywoKCk9Pnt0aGlzLl91cGRhdGUoKSx0aGlzLl9yZXF1ZXN0PW51bGwsdGhpcy5fcnVubmluZyYmdGhpcy5fcmVmcmVzaCgpfSkpKX1fdXBkYXRlKHQ9RGF0ZS5ub3coKSl7bGV0IGU9MDt0aGlzLl9jaGFydHMuZm9yRWFjaCgoKGkscyk9PntpZighaS5ydW5uaW5nfHwhaS5pdGVtcy5sZW5ndGgpcmV0dXJuO2NvbnN0IG49aS5pdGVtcztsZXQgbyxhPW4ubGVuZ3RoLTEscj0hMTtmb3IoO2E+PTA7LS1hKW89blthXSxvLl9hY3RpdmU/KG8uX3RvdGFsPmkuZHVyYXRpb24mJihpLmR1cmF0aW9uPW8uX3RvdGFsKSxvLnRpY2sodCkscj0hMCk6KG5bYV09bltuLmxlbmd0aC0xXSxuLnBvcCgpKTtyJiYocy5kcmF3KCksdGhpcy5fbm90aWZ5KHMsaSx0LCJwcm9ncmVzcyIpKSxuLmxlbmd0aHx8KGkucnVubmluZz0hMSx0aGlzLl9ub3RpZnkocyxpLHQsImNvbXBsZXRlIiksaS5pbml0aWFsPSExKSxlKz1uLmxlbmd0aH0pKSx0aGlzLl9sYXN0RGF0ZT10LDA9PT1lJiYodGhpcy5fcnVubmluZz0hMSl9X2dldEFuaW1zKHQpe2NvbnN0IGU9dGhpcy5fY2hhcnRzO2xldCBpPWUuZ2V0KHQpO3JldHVybiBpfHwoaT17cnVubmluZzohMSxpbml0aWFsOiEwLGl0ZW1zOltdLGxpc3RlbmVyczp7Y29tcGxldGU6W10scHJvZ3Jlc3M6W119fSxlLnNldCh0LGkpKSxpfWxpc3Rlbih0LGUsaSl7dGhpcy5fZ2V0QW5pbXModCkubGlzdGVuZXJzW2VdLnB1c2goaSl9YWRkKHQsZSl7ZSYmZS5sZW5ndGgmJnRoaXMuX2dldEFuaW1zKHQpLml0ZW1zLnB1c2goLi4uZSl9aGFzKHQpe3JldHVybiB0aGlzLl9nZXRBbmltcyh0KS5pdGVtcy5sZW5ndGg+MH1zdGFydCh0KXtjb25zdCBlPXRoaXMuX2NoYXJ0cy5nZXQodCk7ZSYmKGUucnVubmluZz0hMCxlLnN0YXJ0PURhdGUubm93KCksZS5kdXJhdGlvbj1lLml0ZW1zLnJlZHVjZSgoKHQsZSk9Pk1hdGgubWF4KHQsZS5fZHVyYXRpb24pKSwwKSx0aGlzLl9yZWZyZXNoKCkpfXJ1bm5pbmcodCl7aWYoIXRoaXMuX3J1bm5pbmcpcmV0dXJuITE7Y29uc3QgZT10aGlzLl9jaGFydHMuZ2V0KHQpO3JldHVybiEhKGUmJmUucnVubmluZyYmZS5pdGVtcy5sZW5ndGgpfXN0b3AodCl7Y29uc3QgZT10aGlzLl9jaGFydHMuZ2V0KHQpO2lmKCFlfHwhZS5pdGVtcy5sZW5ndGgpcmV0dXJuO2NvbnN0IGk9ZS5pdGVtcztsZXQgcz1pLmxlbmd0aC0xO2Zvcig7cz49MDstLXMpaVtzXS5jYW5jZWwoKTtlLml0ZW1zPVtdLHRoaXMuX25vdGlmeSh0LGUsRGF0ZS5ub3coKSwiY29tcGxldGUiKX1yZW1vdmUodCl7cmV0dXJuIHRoaXMuX2NoYXJ0cy5kZWxldGUodCl9fXZhciBidD1uZXcgeHQ7Ci8qIQogKiBAa3Vya2xlL2NvbG9yIHYwLjMuMgogKiBodHRwczovL2dpdGh1Yi5jb20va3Vya2xlL2NvbG9yI3JlYWRtZQogKiAoYykgMjAyMyBKdWtrYSBLdXJrZWxhCiAqIFJlbGVhc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZQogKi9mdW5jdGlvbiBfdCh0KXtyZXR1cm4gdCsuNXwwfWNvbnN0IHl0PSh0LGUsaSk9Pk1hdGgubWF4KE1hdGgubWluKHQsaSksZSk7ZnVuY3Rpb24gdnQodCl7cmV0dXJuIHl0KF90KDIuNTUqdCksMCwyNTUpfWZ1bmN0aW9uIE10KHQpe3JldHVybiB5dChfdCgyNTUqdCksMCwyNTUpfWZ1bmN0aW9uIHd0KHQpe3JldHVybiB5dChfdCh0LzIuNTUpLzEwMCwwLDEpfWZ1bmN0aW9uIGt0KHQpe3JldHVybiB5dChfdCgxMDAqdCksMCwxMDApfWNvbnN0IFN0PXswOjAsMToxLDI6MiwzOjMsNDo0LDU6NSw2OjYsNzo3LDg6OCw5OjksQToxMCxCOjExLEM6MTIsRDoxMyxFOjE0LEY6MTUsYToxMCxiOjExLGM6MTIsZDoxMyxlOjE0LGY6MTV9LFB0PVsuLi4iMDEyMzQ1Njc4OUFCQ0RFRiJdLER0PXQ9PlB0WzE1JnRdLEN0PXQ9PlB0WygyNDAmdCk+PjRdK1B0WzE1JnRdLE90PXQ9PigyNDAmdCk+PjQ9PSgxNSZ0KTtmdW5jdGlvbiBBdCh0KXt2YXIgZT0odD0+T3QodC5yKSYmT3QodC5nKSYmT3QodC5iKSYmT3QodC5hKSkodCk/RHQ6Q3Q7cmV0dXJuIHQ/IiMiK2UodC5yKStlKHQuZykrZSh0LmIpKygodCxlKT0+dDwyNTU/ZSh0KToiIikodC5hLGUpOnZvaWQgMH1jb25zdCBUdD0vXihoc2xhP3xod2J8aHN2KVwoXHMqKFstKy5lXGRdKykoPzpkZWcpP1tccyxdKyhbLSsuZVxkXSspJVtccyxdKyhbLSsuZVxkXSspJSg/OltccyxdKyhbLSsuZVxkXSspKCUpPyk/XHMqXCkkLztmdW5jdGlvbiBMdCh0LGUsaSl7Y29uc3Qgcz1lKk1hdGgubWluKGksMS1pKSxuPShlLG49KGUrdC8zMCklMTIpPT5pLXMqTWF0aC5tYXgoTWF0aC5taW4obi0zLDktbiwxKSwtMSk7cmV0dXJuW24oMCksbig4KSxuKDQpXX1mdW5jdGlvbiBFdCh0LGUsaSl7Y29uc3Qgcz0ocyxuPShzK3QvNjApJTYpPT5pLWkqZSpNYXRoLm1heChNYXRoLm1pbihuLDQtbiwxKSwwKTtyZXR1cm5bcyg1KSxzKDMpLHMoMSldfWZ1bmN0aW9uIFJ0KHQsZSxpKXtjb25zdCBzPUx0KHQsMSwuNSk7bGV0IG47Zm9yKGUraT4xJiYobj0xLyhlK2kpLGUqPW4saSo9biksbj0wO248MztuKyspc1tuXSo9MS1lLWksc1tuXSs9ZTtyZXR1cm4gc31mdW5jdGlvbiBJdCh0KXtjb25zdCBlPXQuci8yNTUsaT10LmcvMjU1LHM9dC5iLzI1NSxuPU1hdGgubWF4KGUsaSxzKSxvPU1hdGgubWluKGUsaSxzKSxhPShuK28pLzI7bGV0IHIsbCxoO3JldHVybiBuIT09byYmKGg9bi1vLGw9YT4uNT9oLygyLW4tbyk6aC8obitvKSxyPWZ1bmN0aW9uKHQsZSxpLHMsbil7cmV0dXJuIHQ9PT1uPyhlLWkpL3MrKGU8aT82OjApOmU9PT1uPyhpLXQpL3MrMjoodC1lKS9zKzR9KGUsaSxzLGgsbikscj02MCpyKy41KSxbMHxyLGx8fDAsYV19ZnVuY3Rpb24genQodCxlLGkscyl7cmV0dXJuKEFycmF5LmlzQXJyYXkoZSk/dChlWzBdLGVbMV0sZVsyXSk6dChlLGkscykpLm1hcChNdCl9ZnVuY3Rpb24gRnQodCxlLGkpe3JldHVybiB6dChMdCx0LGUsaSl9ZnVuY3Rpb24gVnQodCl7cmV0dXJuKHQlMzYwKzM2MCklMzYwfWZ1bmN0aW9uIEJ0KHQpe2NvbnN0IGU9VHQuZXhlYyh0KTtsZXQgaSxzPTI1NTtpZighZSlyZXR1cm47ZVs1XSE9PWkmJihzPWVbNl0/dnQoK2VbNV0pOk10KCtlWzVdKSk7Y29uc3Qgbj1WdCgrZVsyXSksbz0rZVszXS8xMDAsYT0rZVs0XS8xMDA7cmV0dXJuIGk9Imh3YiI9PT1lWzFdP2Z1bmN0aW9uKHQsZSxpKXtyZXR1cm4genQoUnQsdCxlLGkpfShuLG8sYSk6ImhzdiI9PT1lWzFdP2Z1bmN0aW9uKHQsZSxpKXtyZXR1cm4genQoRXQsdCxlLGkpfShuLG8sYSk6RnQobixvLGEpLHtyOmlbMF0sZzppWzFdLGI6aVsyXSxhOnN9fWNvbnN0IFd0PXt4OiJkYXJrIixaOiJsaWdodCIsWToicmUiLFg6ImJsdSIsVzoiZ3IiLFY6Im1lZGl1bSIsVToic2xhdGUiLEE6ImVlIixUOiJvbCIsUzoib3IiLEI6InJhIixDOiJsYXRlZyIsRDoiaWdodHMiLFI6ImluIixROiJ0dXJxdW9pcyIsRToiaGkiLFA6InJvIixPOiJhbCIsTjoibGUiLE06ImRlIixMOiJ5ZWxsbyIsRjoiZW4iLEs6ImNoIixHOiJhcmtzIixIOiJlYSIsSToiaWdodGciLEo6IndoIn0sTnQ9e09pY2VYZToiZjBmOGZmIixhbnRpcXVld0V0ZToiZmFlYmQ3IixhcXVhOiJmZmZmIixhcXVhbWFyUmU6IjdmZmZkNCIsYXp1WToiZjBmZmZmIixiZWlnZToiZjVmNWRjIixiaXNxdWU6ImZmZTRjNCIsYmxhY2s6IjAiLGJsYW5LZWRPbW9uZDoiZmZlYmNkIixYZToiZmYiLFhldmlUZXQ6IjhhMmJlMiIsYlB3bjoiYTUyYTJhIixidXJseXdvb2Q6ImRlYjg4NyIsY2FNdFhlOiI1ZjllYTAiLEthcnRZdXNlOiI3ZmZmMDAiLEtvY1RhdGU6ImQyNjkxZSIsY1NPOiJmZjdmNTAiLGNTbmZsb3dlclhlOiI2NDk1ZWQiLGNTbnNpbGs6ImZmZjhkYyIsY3JpbXNvbjoiZGMxNDNjIixjeWFuOiJmZmZmIix4WGU6IjhiIix4Y3lhbjoiOGI4YiIseGdUTW5QZDoiYjg4NjBiIix4V2F5OiJhOWE5YTkiLHhnWUY6IjY0MDAiLHhnWXk6ImE5YTlhOSIseGtoYWtpOiJiZGI3NmIiLHhtYWdGdGE6IjhiMDA4YiIseFRpdmVnWUY6IjU1NmIyZiIseFNhbmdlOiJmZjhjMDAiLHhTY0VkOiI5OTMyY2MiLHhZZDoiOGIwMDAwIix4c09tb246ImU5OTY3YSIseHNIZ1lGOiI4ZmJjOGYiLHhVWGU6IjQ4M2Q4YiIseFVXYXk6IjJmNGY0ZiIseFVnWXk6IjJmNGY0ZiIseFFlOiJjZWQxIix4dmlUZXQ6Ijk0MDBkMyIsZEFwcFJrOiJmZjE0OTMiLGRBcHNreVhlOiJiZmZmIixkaW1XYXk6IjY5Njk2OSIsZGltZ1l5OiI2OTY5NjkiLGRvZGdlclhlOiIxZTkwZmYiLGZpWWJyaWNrOiJiMjIyMjIiLGZsU093RXRlOiJmZmZhZjAiLGZvWXN0V0FuOiIyMjhiMjIiLGZ1S3NpYToiZmYwMGZmIixnYVJzYlNvOiJkY2RjZGMiLGdob3N0d0V0ZToiZjhmOGZmIixnVGQ6ImZmZDcwMCIsZ1RNblBkOiJkYWE1MjAiLFdheToiODA4MDgwIixnWUY6IjgwMDAiLGdZRkx3OiJhZGZmMmYiLGdZeToiODA4MDgwIixob25leU13OiJmMGZmZjAiLGhvdHBSazoiZmY2OWI0IixSZGlhbllkOiJjZDVjNWMiLFJkaWdvOiI0YjAwODIiLGl2U3k6ImZmZmZmMCIsa2hha2k6ImYwZTY4YyIsbGF2Rk1yOiJlNmU2ZmEiLGxhdkZNclhzaDoiZmZmMGY1IixsYXduZ1lGOiI3Y2ZjMDAiLE5tb25jRWZmb246ImZmZmFjZCIsWlhlOiJhZGQ4ZTYiLFpjU086ImYwODA4MCIsWmN5YW46ImUwZmZmZiIsWmdUTW5QZEx3OiJmYWZhZDIiLFpXYXk6ImQzZDNkMyIsWmdZRjoiOTBlZTkwIixaZ1l5OiJkM2QzZDMiLFpwUms6ImZmYjZjMSIsWnNPbW9uOiJmZmEwN2EiLFpzSGdZRjoiMjBiMmFhIixac2t5WGU6Ijg3Y2VmYSIsWlVXYXk6Ijc3ODg5OSIsWlVnWXk6Ijc3ODg5OSIsWnN0QWxYZToiYjBjNGRlIixaTHc6ImZmZmZlMCIsbGltZToiZmYwMCIsbGltZWdZRjoiMzJjZDMyIixsUkY6ImZhZjBlNiIsbWFnRnRhOiJmZjAwZmYiLG1hUG9uOiI4MDAwMDAiLFZhcXVhbWFyUmU6IjY2Y2RhYSIsVlhlOiJjZCIsVlNjRWQ6ImJhNTVkMyIsVnB1cnBOOiI5MzcwZGIiLFZzSGdZRjoiM2NiMzcxIixWVVhlOiI3YjY4ZWUiLFZzcHJSZ2dZRjoiZmE5YSIsVlFlOiI0OGQxY2MiLFZ2aVRldFlkOiJjNzE1ODUiLG1pZG5pZ2h0WGU6IjE5MTk3MCIsbVJ0Y1lhbToiZjVmZmZhIixtaXN0eVBzZToiZmZlNGUxIixtb2NjYXNSOiJmZmU0YjUiLG5hdmFqb3dFdGU6ImZmZGVhZCIsbmF2eToiODAiLFRkbGFjZToiZmRmNWU2IixUaXZlOiI4MDgwMDAiLFRpdmVkQmI6IjZiOGUyMyIsU2FuZ2U6ImZmYTUwMCIsU2FuZ2VZZDoiZmY0NTAwIixTY0VkOiJkYTcwZDYiLHBPZWdUTW5QZDoiZWVlOGFhIixwT2VnWUY6Ijk4ZmI5OCIscE9lUWU6ImFmZWVlZSIscE9ldmlUZXRZZDoiZGI3MDkzIixwYXBheWF3RXA6ImZmZWZkNSIscEhLcHVmZjoiZmZkYWI5IixwZXJ1OiJjZDg1M2YiLHBSazoiZmZjMGNiIixwbHVtOiJkZGEwZGQiLHBvd01yWGU6ImIwZTBlNiIscHVycE46IjgwMDA4MCIsWWJlY2NhcHVycE46IjY2MzM5OSIsWWQ6ImZmMDAwMCIsUHN5YnJvd246ImJjOGY4ZiIsUHlPWGU6IjQxNjllMSIsc2FkZE5iUHduOiI4YjQ1MTMiLHNPbW9uOiJmYTgwNzIiLHNhbmR5YlB3bjoiZjRhNDYwIixzSGdZRjoiMmU4YjU3IixzSHNoZWxsOiJmZmY1ZWUiLHNpRm5hOiJhMDUyMmQiLHNpbHZlcjoiYzBjMGMwIixza3lYZToiODdjZWViIixVWGU6IjZhNWFjZCIsVVdheToiNzA4MDkwIixVZ1l5OiI3MDgwOTAiLHNub3c6ImZmZmFmYSIsc3ByUmdnWUY6ImZmN2YiLHN0QWxYZToiNDY4MmI0Iix0YW46ImQyYjQ4YyIsdGVPOiI4MDgwIix0RXN0TjoiZDhiZmQ4Iix0b21hdG86ImZmNjM0NyIsUWU6IjQwZTBkMCIsdmlUZXQ6ImVlODJlZSIsSkh0OiJmNWRlYjMiLHdFdGU6ImZmZmZmZiIsd0V0ZXNtb2tlOiJmNWY1ZjUiLEx3OiJmZmZmMDAiLEx3Z1lGOiI5YWNkMzIifTtsZXQgSHQ7ZnVuY3Rpb24ganQodCl7SHR8fChIdD1mdW5jdGlvbigpe2NvbnN0IHQ9e30sZT1PYmplY3Qua2V5cyhOdCksaT1PYmplY3Qua2V5cyhXdCk7bGV0IHMsbixvLGEscjtmb3Iocz0wO3M8ZS5sZW5ndGg7cysrKXtmb3IoYT1yPWVbc10sbj0wO248aS5sZW5ndGg7bisrKW89aVtuXSxyPXIucmVwbGFjZShvLFd0W29dKTtvPXBhcnNlSW50KE50W2FdLDE2KSx0W3JdPVtvPj4xNiYyNTUsbz4+OCYyNTUsMjU1Jm9dfXJldHVybiB0fSgpLEh0LnRyYW5zcGFyZW50PVswLDAsMCwwXSk7Y29uc3QgZT1IdFt0LnRvTG93ZXJDYXNlKCldO3JldHVybiBlJiZ7cjplWzBdLGc6ZVsxXSxiOmVbMl0sYTo0PT09ZS5sZW5ndGg/ZVszXToyNTV9fWNvbnN0ICR0PS9ecmdiYT9cKFxzKihbLSsuXGRdKykoJSk/W1xzLF0rKFstKy5lXGRdKykoJSk/W1xzLF0rKFstKy5lXGRdKykoJSk/KD86W1xzLC9dKyhbLSsuZVxkXSspKCUpPyk/XHMqXCkkLztjb25zdCBZdD10PT50PD0uMDAzMTMwOD8xMi45Mip0OjEuMDU1Kk1hdGgucG93KHQsMS8yLjQpLS4wNTUsVXQ9dD0+dDw9LjA0MDQ1P3QvMTIuOTI6TWF0aC5wb3coKHQrLjA1NSkvMS4wNTUsMi40KTtmdW5jdGlvbiBYdCh0LGUsaSl7aWYodCl7bGV0IHM9SXQodCk7c1tlXT1NYXRoLm1heCgwLE1hdGgubWluKHNbZV0rc1tlXSppLDA9PT1lPzM2MDoxKSkscz1GdChzKSx0LnI9c1swXSx0Lmc9c1sxXSx0LmI9c1syXX19ZnVuY3Rpb24gcXQodCxlKXtyZXR1cm4gdD9PYmplY3QuYXNzaWduKGV8fHt9LHQpOnR9ZnVuY3Rpb24gS3QodCl7dmFyIGU9e3I6MCxnOjAsYjowLGE6MjU1fTtyZXR1cm4gQXJyYXkuaXNBcnJheSh0KT90Lmxlbmd0aD49MyYmKGU9e3I6dFswXSxnOnRbMV0sYjp0WzJdLGE6MjU1fSx0Lmxlbmd0aD4zJiYoZS5hPU10KHRbM10pKSk6KGU9cXQodCx7cjowLGc6MCxiOjAsYToxfSkpLmE9TXQoZS5hKSxlfWZ1bmN0aW9uIEd0KHQpe3JldHVybiJyIj09PXQuY2hhckF0KDApP2Z1bmN0aW9uKHQpe2NvbnN0IGU9JHQuZXhlYyh0KTtsZXQgaSxzLG4sbz0yNTU7aWYoZSl7aWYoZVs3XSE9PWkpe2NvbnN0IHQ9K2VbN107bz1lWzhdP3Z0KHQpOnl0KDI1NSp0LDAsMjU1KX1yZXR1cm4gaT0rZVsxXSxzPStlWzNdLG49K2VbNV0saT0yNTUmKGVbMl0/dnQoaSk6eXQoaSwwLDI1NSkpLHM9MjU1JihlWzRdP3Z0KHMpOnl0KHMsMCwyNTUpKSxuPTI1NSYoZVs2XT92dChuKTp5dChuLDAsMjU1KSkse3I6aSxnOnMsYjpuLGE6b319fSh0KTpCdCh0KX1jbGFzcyBKdHtjb25zdHJ1Y3Rvcih0KXtpZih0IGluc3RhbmNlb2YgSnQpcmV0dXJuIHQ7Y29uc3QgZT10eXBlb2YgdDtsZXQgaTt2YXIgcyxuLG87Im9iamVjdCI9PT1lP2k9S3QodCk6InN0cmluZyI9PT1lJiYobz0ocz10KS5sZW5ndGgsIiMiPT09c1swXSYmKDQ9PT1vfHw1PT09bz9uPXtyOjI1NSYxNypTdFtzWzFdXSxnOjI1NSYxNypTdFtzWzJdXSxiOjI1NSYxNypTdFtzWzNdXSxhOjU9PT1vPzE3KlN0W3NbNF1dOjI1NX06NyE9PW8mJjkhPT1vfHwobj17cjpTdFtzWzFdXTw8NHxTdFtzWzJdXSxnOlN0W3NbM11dPDw0fFN0W3NbNF1dLGI6U3Rbc1s1XV08PDR8U3Rbc1s2XV0sYTo5PT09bz9TdFtzWzddXTw8NHxTdFtzWzhdXToyNTV9KSksaT1ufHxqdCh0KXx8R3QodCkpLHRoaXMuX3JnYj1pLHRoaXMuX3ZhbGlkPSEhaX1nZXQgdmFsaWQoKXtyZXR1cm4gdGhpcy5fdmFsaWR9Z2V0IHJnYigpe3ZhciB0PXF0KHRoaXMuX3JnYik7cmV0dXJuIHQmJih0LmE9d3QodC5hKSksdH1zZXQgcmdiKHQpe3RoaXMuX3JnYj1LdCh0KX1yZ2JTdHJpbmcoKXtyZXR1cm4gdGhpcy5fdmFsaWQ/KHQ9dGhpcy5fcmdiKSYmKHQuYTwyNTU/YHJnYmEoJHt0LnJ9LCAke3QuZ30sICR7dC5ifSwgJHt3dCh0LmEpfSlgOmByZ2IoJHt0LnJ9LCAke3QuZ30sICR7dC5ifSlgKTp2b2lkIDA7dmFyIHR9aGV4U3RyaW5nKCl7cmV0dXJuIHRoaXMuX3ZhbGlkP0F0KHRoaXMuX3JnYik6dm9pZCAwfWhzbFN0cmluZygpe3JldHVybiB0aGlzLl92YWxpZD9mdW5jdGlvbih0KXtpZighdClyZXR1cm47Y29uc3QgZT1JdCh0KSxpPWVbMF0scz1rdChlWzFdKSxuPWt0KGVbMl0pO3JldHVybiB0LmE8MjU1P2Boc2xhKCR7aX0sICR7c30lLCAke259JSwgJHt3dCh0LmEpfSlgOmBoc2woJHtpfSwgJHtzfSUsICR7bn0lKWB9KHRoaXMuX3JnYik6dm9pZCAwfW1peCh0LGUpe2lmKHQpe2NvbnN0IGk9dGhpcy5yZ2Iscz10LnJnYjtsZXQgbjtjb25zdCBvPWU9PT1uPy41OmUsYT0yKm8tMSxyPWkuYS1zLmEsbD0oKGEqcj09LTE/YTooYStyKS8oMSthKnIpKSsxKS8yO249MS1sLGkucj0yNTUmbCppLnIrbipzLnIrLjUsaS5nPTI1NSZsKmkuZytuKnMuZysuNSxpLmI9MjU1JmwqaS5iK24qcy5iKy41LGkuYT1vKmkuYSsoMS1vKSpzLmEsdGhpcy5yZ2I9aX1yZXR1cm4gdGhpc31pbnRlcnBvbGF0ZSh0LGUpe3JldHVybiB0JiYodGhpcy5fcmdiPWZ1bmN0aW9uKHQsZSxpKXtjb25zdCBzPVV0KHd0KHQucikpLG49VXQod3QodC5nKSksbz1VdCh3dCh0LmIpKTtyZXR1cm57cjpNdChZdChzK2kqKFV0KHd0KGUucikpLXMpKSksZzpNdChZdChuK2kqKFV0KHd0KGUuZykpLW4pKSksYjpNdChZdChvK2kqKFV0KHd0KGUuYikpLW8pKSksYTp0LmEraSooZS5hLXQuYSl9fSh0aGlzLl9yZ2IsdC5fcmdiLGUpKSx0aGlzfWNsb25lKCl7cmV0dXJuIG5ldyBKdCh0aGlzLnJnYil9YWxwaGEodCl7cmV0dXJuIHRoaXMuX3JnYi5hPU10KHQpLHRoaXN9Y2xlYXJlcih0KXtyZXR1cm4gdGhpcy5fcmdiLmEqPTEtdCx0aGlzfWdyZXlzY2FsZSgpe2NvbnN0IHQ9dGhpcy5fcmdiLGU9X3QoLjMqdC5yKy41OSp0LmcrLjExKnQuYik7cmV0dXJuIHQucj10Lmc9dC5iPWUsdGhpc31vcGFxdWVyKHQpe3JldHVybiB0aGlzLl9yZ2IuYSo9MSt0LHRoaXN9bmVnYXRlKCl7Y29uc3QgdD10aGlzLl9yZ2I7cmV0dXJuIHQucj0yNTUtdC5yLHQuZz0yNTUtdC5nLHQuYj0yNTUtdC5iLHRoaXN9bGlnaHRlbih0KXtyZXR1cm4gWHQodGhpcy5fcmdiLDIsdCksdGhpc31kYXJrZW4odCl7cmV0dXJuIFh0KHRoaXMuX3JnYiwyLC10KSx0aGlzfXNhdHVyYXRlKHQpe3JldHVybiBYdCh0aGlzLl9yZ2IsMSx0KSx0aGlzfWRlc2F0dXJhdGUodCl7cmV0dXJuIFh0KHRoaXMuX3JnYiwxLC10KSx0aGlzfXJvdGF0ZSh0KXtyZXR1cm4gZnVuY3Rpb24odCxlKXt2YXIgaT1JdCh0KTtpWzBdPVZ0KGlbMF0rZSksaT1GdChpKSx0LnI9aVswXSx0Lmc9aVsxXSx0LmI9aVsyXX0odGhpcy5fcmdiLHQpLHRoaXN9fWZ1bmN0aW9uIFp0KHQpe2lmKHQmJiJvYmplY3QiPT10eXBlb2YgdCl7Y29uc3QgZT10LnRvU3RyaW5nKCk7cmV0dXJuIltvYmplY3QgQ2FudmFzUGF0dGVybl0iPT09ZXx8IltvYmplY3QgQ2FudmFzR3JhZGllbnRdIj09PWV9cmV0dXJuITF9ZnVuY3Rpb24gUXQodCl7cmV0dXJuIFp0KHQpP3Q6bmV3IEp0KHQpfWZ1bmN0aW9uIHRlKHQpe3JldHVybiBadCh0KT90Om5ldyBKdCh0KS5zYXR1cmF0ZSguNSkuZGFya2VuKC4xKS5oZXhTdHJpbmcoKX1jb25zdCBlZT1bIngiLCJ5IiwiYm9yZGVyV2lkdGgiLCJyYWRpdXMiLCJ0ZW5zaW9uIl0saWU9WyJjb2xvciIsImJvcmRlckNvbG9yIiwiYmFja2dyb3VuZENvbG9yIl07Y29uc3Qgc2U9bmV3IE1hcDtmdW5jdGlvbiBuZSh0LGUsaSl7cmV0dXJuIGZ1bmN0aW9uKHQsZSl7ZT1lfHx7fTtjb25zdCBpPXQrSlNPTi5zdHJpbmdpZnkoZSk7bGV0IHM9c2UuZ2V0KGkpO3JldHVybiBzfHwocz1uZXcgSW50bC5OdW1iZXJGb3JtYXQodCxlKSxzZS5zZXQoaSxzKSksc30oZSxpKS5mb3JtYXQodCl9Y29uc3Qgb2U9e3ZhbHVlczp0PT5uKHQpP3Q6IiIrdCxudW1lcmljKHQsZSxpKXtpZigwPT09dClyZXR1cm4iMCI7Y29uc3Qgcz10aGlzLmNoYXJ0Lm9wdGlvbnMubG9jYWxlO2xldCBuLG89dDtpZihpLmxlbmd0aD4xKXtjb25zdCBlPU1hdGgubWF4KE1hdGguYWJzKGlbMF0udmFsdWUpLE1hdGguYWJzKGlbaS5sZW5ndGgtMV0udmFsdWUpKTsoZTwxZS00fHxlPjFlMTUpJiYobj0ic2NpZW50aWZpYyIpLG89ZnVuY3Rpb24odCxlKXtsZXQgaT1lLmxlbmd0aD4zP2VbMl0udmFsdWUtZVsxXS52YWx1ZTplWzFdLnZhbHVlLWVbMF0udmFsdWU7TWF0aC5hYnMoaSk+PTEmJnQhPT1NYXRoLmZsb29yKHQpJiYoaT10LU1hdGguZmxvb3IodCkpO3JldHVybiBpfSh0LGkpfWNvbnN0IGE9eihNYXRoLmFicyhvKSkscj1pc05hTihhKT8xOk1hdGgubWF4KE1hdGgubWluKC0xKk1hdGguZmxvb3IoYSksMjApLDApLGw9e25vdGF0aW9uOm4sbWluaW11bUZyYWN0aW9uRGlnaXRzOnIsbWF4aW11bUZyYWN0aW9uRGlnaXRzOnJ9O3JldHVybiBPYmplY3QuYXNzaWduKGwsdGhpcy5vcHRpb25zLnRpY2tzLmZvcm1hdCksbmUodCxzLGwpfSxsb2dhcml0aG1pYyh0LGUsaSl7aWYoMD09PXQpcmV0dXJuIjAiO2NvbnN0IHM9aVtlXS5zaWduaWZpY2FuZHx8dC9NYXRoLnBvdygxMCxNYXRoLmZsb29yKHoodCkpKTtyZXR1cm5bMSwyLDMsNSwxMCwxNV0uaW5jbHVkZXMocyl8fGU+LjgqaS5sZW5ndGg/b2UubnVtZXJpYy5jYWxsKHRoaXMsdCxlLGkpOiIifX07dmFyIGFlPXtmb3JtYXR0ZXJzOm9lfTtjb25zdCByZT1PYmplY3QuY3JlYXRlKG51bGwpLGxlPU9iamVjdC5jcmVhdGUobnVsbCk7ZnVuY3Rpb24gaGUodCxlKXtpZighZSlyZXR1cm4gdDtjb25zdCBpPWUuc3BsaXQoIi4iKTtmb3IobGV0IGU9MCxzPWkubGVuZ3RoO2U8czsrK2Upe2NvbnN0IHM9aVtlXTt0PXRbc118fCh0W3NdPU9iamVjdC5jcmVhdGUobnVsbCkpfXJldHVybiB0fWZ1bmN0aW9uIGNlKHQsZSxpKXtyZXR1cm4ic3RyaW5nIj09dHlwZW9mIGU/eChoZSh0LGUpLGkpOngoaGUodCwiIiksZSl9Y2xhc3MgZGV7Y29uc3RydWN0b3IodCxlKXt0aGlzLmFuaW1hdGlvbj12b2lkIDAsdGhpcy5iYWNrZ3JvdW5kQ29sb3I9InJnYmEoMCwwLDAsMC4xKSIsdGhpcy5ib3JkZXJDb2xvcj0icmdiYSgwLDAsMCwwLjEpIix0aGlzLmNvbG9yPSIjNjY2Iix0aGlzLmRhdGFzZXRzPXt9LHRoaXMuZGV2aWNlUGl4ZWxSYXRpbz10PT50LmNoYXJ0LnBsYXRmb3JtLmdldERldmljZVBpeGVsUmF0aW8oKSx0aGlzLmVsZW1lbnRzPXt9LHRoaXMuZXZlbnRzPVsibW91c2Vtb3ZlIiwibW91c2VvdXQiLCJjbGljayIsInRvdWNoc3RhcnQiLCJ0b3VjaG1vdmUiXSx0aGlzLmZvbnQ9e2ZhbWlseToiJ0hlbHZldGljYSBOZXVlJywgJ0hlbHZldGljYScsICdBcmlhbCcsIHNhbnMtc2VyaWYiLHNpemU6MTIsc3R5bGU6Im5vcm1hbCIsbGluZUhlaWdodDoxLjIsd2VpZ2h0Om51bGx9LHRoaXMuaG92ZXI9e30sdGhpcy5ob3ZlckJhY2tncm91bmRDb2xvcj0odCxlKT0+dGUoZS5iYWNrZ3JvdW5kQ29sb3IpLHRoaXMuaG92ZXJCb3JkZXJDb2xvcj0odCxlKT0+dGUoZS5ib3JkZXJDb2xvciksdGhpcy5ob3ZlckNvbG9yPSh0LGUpPT50ZShlLmNvbG9yKSx0aGlzLmluZGV4QXhpcz0ieCIsdGhpcy5pbnRlcmFjdGlvbj17bW9kZToibmVhcmVzdCIsaW50ZXJzZWN0OiEwLGluY2x1ZGVJbnZpc2libGU6ITF9LHRoaXMubWFpbnRhaW5Bc3BlY3RSYXRpbz0hMCx0aGlzLm9uSG92ZXI9bnVsbCx0aGlzLm9uQ2xpY2s9bnVsbCx0aGlzLnBhcnNpbmc9ITAsdGhpcy5wbHVnaW5zPXt9LHRoaXMucmVzcG9uc2l2ZT0hMCx0aGlzLnNjYWxlPXZvaWQgMCx0aGlzLnNjYWxlcz17fSx0aGlzLnNob3dMaW5lPSEwLHRoaXMuZHJhd0FjdGl2ZUVsZW1lbnRzT25Ub3A9ITAsdGhpcy5kZXNjcmliZSh0KSx0aGlzLmFwcGx5KGUpfXNldCh0LGUpe3JldHVybiBjZSh0aGlzLHQsZSl9Z2V0KHQpe3JldHVybiBoZSh0aGlzLHQpfWRlc2NyaWJlKHQsZSl7cmV0dXJuIGNlKGxlLHQsZSl9b3ZlcnJpZGUodCxlKXtyZXR1cm4gY2UocmUsdCxlKX1yb3V0ZSh0LGUsaSxzKXtjb25zdCBuPWhlKHRoaXMsdCksYT1oZSh0aGlzLGkpLHI9Il8iK2U7T2JqZWN0LmRlZmluZVByb3BlcnRpZXMobix7W3JdOnt2YWx1ZTpuW2VdLHdyaXRhYmxlOiEwfSxbZV06e2VudW1lcmFibGU6ITAsZ2V0KCl7Y29uc3QgdD10aGlzW3JdLGU9YVtzXTtyZXR1cm4gbyh0KT9PYmplY3QuYXNzaWduKHt9LGUsdCk6bCh0LGUpfSxzZXQodCl7dGhpc1tyXT10fX19KX1hcHBseSh0KXt0LmZvckVhY2goKHQ9PnQodGhpcykpKX19dmFyIHVlPW5ldyBkZSh7X3NjcmlwdGFibGU6dD0+IXQuc3RhcnRzV2l0aCgib24iKSxfaW5kZXhhYmxlOnQ9PiJldmVudHMiIT09dCxob3Zlcjp7X2ZhbGxiYWNrOiJpbnRlcmFjdGlvbiJ9LGludGVyYWN0aW9uOntfc2NyaXB0YWJsZTohMSxfaW5kZXhhYmxlOiExfX0sW2Z1bmN0aW9uKHQpe3Quc2V0KCJhbmltYXRpb24iLHtkZWxheTp2b2lkIDAsZHVyYXRpb246MWUzLGVhc2luZzoiZWFzZU91dFF1YXJ0Iixmbjp2b2lkIDAsZnJvbTp2b2lkIDAsbG9vcDp2b2lkIDAsdG86dm9pZCAwLHR5cGU6dm9pZCAwfSksdC5kZXNjcmliZSgiYW5pbWF0aW9uIix7X2ZhbGxiYWNrOiExLF9pbmRleGFibGU6ITEsX3NjcmlwdGFibGU6dD0+Im9uUHJvZ3Jlc3MiIT09dCYmIm9uQ29tcGxldGUiIT09dCYmImZuIiE9PXR9KSx0LnNldCgiYW5pbWF0aW9ucyIse2NvbG9yczp7dHlwZToiY29sb3IiLHByb3BlcnRpZXM6aWV9LG51bWJlcnM6e3R5cGU6Im51bWJlciIscHJvcGVydGllczplZX19KSx0LmRlc2NyaWJlKCJhbmltYXRpb25zIix7X2ZhbGxiYWNrOiJhbmltYXRpb24ifSksdC5zZXQoInRyYW5zaXRpb25zIix7YWN0aXZlOnthbmltYXRpb246e2R1cmF0aW9uOjQwMH19LHJlc2l6ZTp7YW5pbWF0aW9uOntkdXJhdGlvbjowfX0sc2hvdzp7YW5pbWF0aW9uczp7Y29sb3JzOntmcm9tOiJ0cmFuc3BhcmVudCJ9LHZpc2libGU6e3R5cGU6ImJvb2xlYW4iLGR1cmF0aW9uOjB9fX0saGlkZTp7YW5pbWF0aW9uczp7Y29sb3JzOnt0bzoidHJhbnNwYXJlbnQifSx2aXNpYmxlOnt0eXBlOiJib29sZWFuIixlYXNpbmc6ImxpbmVhciIsZm46dD0+MHx0fX19fSl9LGZ1bmN0aW9uKHQpe3Quc2V0KCJsYXlvdXQiLHthdXRvUGFkZGluZzohMCxwYWRkaW5nOnt0b3A6MCxyaWdodDowLGJvdHRvbTowLGxlZnQ6MH19KX0sZnVuY3Rpb24odCl7dC5zZXQoInNjYWxlIix7ZGlzcGxheTohMCxvZmZzZXQ6ITEscmV2ZXJzZTohMSxiZWdpbkF0WmVybzohMSxib3VuZHM6InRpY2tzIixjbGlwOiEwLGdyYWNlOjAsZ3JpZDp7ZGlzcGxheTohMCxsaW5lV2lkdGg6MSxkcmF3T25DaGFydEFyZWE6ITAsZHJhd1RpY2tzOiEwLHRpY2tMZW5ndGg6OCx0aWNrV2lkdGg6KHQsZSk9PmUubGluZVdpZHRoLHRpY2tDb2xvcjoodCxlKT0+ZS5jb2xvcixvZmZzZXQ6ITF9LGJvcmRlcjp7ZGlzcGxheTohMCxkYXNoOltdLGRhc2hPZmZzZXQ6MCx3aWR0aDoxfSx0aXRsZTp7ZGlzcGxheTohMSx0ZXh0OiIiLHBhZGRpbmc6e3RvcDo0LGJvdHRvbTo0fX0sdGlja3M6e21pblJvdGF0aW9uOjAsbWF4Um90YXRpb246NTAsbWlycm9yOiExLHRleHRTdHJva2VXaWR0aDowLHRleHRTdHJva2VDb2xvcjoiIixwYWRkaW5nOjMsZGlzcGxheTohMCxhdXRvU2tpcDohMCxhdXRvU2tpcFBhZGRpbmc6MyxsYWJlbE9mZnNldDowLGNhbGxiYWNrOmFlLmZvcm1hdHRlcnMudmFsdWVzLG1pbm9yOnt9LG1ham9yOnt9LGFsaWduOiJjZW50ZXIiLGNyb3NzQWxpZ246Im5lYXIiLHNob3dMYWJlbEJhY2tkcm9wOiExLGJhY2tkcm9wQ29sb3I6InJnYmEoMjU1LCAyNTUsIDI1NSwgMC43NSkiLGJhY2tkcm9wUGFkZGluZzoyfX0pLHQucm91dGUoInNjYWxlLnRpY2tzIiwiY29sb3IiLCIiLCJjb2xvciIpLHQucm91dGUoInNjYWxlLmdyaWQiLCJjb2xvciIsIiIsImJvcmRlckNvbG9yIiksdC5yb3V0ZSgic2NhbGUuYm9yZGVyIiwiY29sb3IiLCIiLCJib3JkZXJDb2xvciIpLHQucm91dGUoInNjYWxlLnRpdGxlIiwiY29sb3IiLCIiLCJjb2xvciIpLHQuZGVzY3JpYmUoInNjYWxlIix7X2ZhbGxiYWNrOiExLF9zY3JpcHRhYmxlOnQ9PiF0LnN0YXJ0c1dpdGgoImJlZm9yZSIpJiYhdC5zdGFydHNXaXRoKCJhZnRlciIpJiYiY2FsbGJhY2siIT09dCYmInBhcnNlciIhPT10LF9pbmRleGFibGU6dD0+ImJvcmRlckRhc2giIT09dCYmInRpY2tCb3JkZXJEYXNoIiE9PXQmJiJkYXNoIiE9PXR9KSx0LmRlc2NyaWJlKCJzY2FsZXMiLHtfZmFsbGJhY2s6InNjYWxlIn0pLHQuZGVzY3JpYmUoInNjYWxlLnRpY2tzIix7X3NjcmlwdGFibGU6dD0+ImJhY2tkcm9wUGFkZGluZyIhPT10JiYiY2FsbGJhY2siIT09dCxfaW5kZXhhYmxlOnQ9PiJiYWNrZHJvcFBhZGRpbmciIT09dH0pfV0pO2Z1bmN0aW9uIGZlKCl7cmV0dXJuInVuZGVmaW5lZCIhPXR5cGVvZiB3aW5kb3cmJiJ1bmRlZmluZWQiIT10eXBlb2YgZG9jdW1lbnR9ZnVuY3Rpb24gZ2UodCl7bGV0IGU9dC5wYXJlbnROb2RlO3JldHVybiBlJiYiW29iamVjdCBTaGFkb3dSb290XSI9PT1lLnRvU3RyaW5nKCkmJihlPWUuaG9zdCksZX1mdW5jdGlvbiBwZSh0LGUsaSl7bGV0IHM7cmV0dXJuInN0cmluZyI9PXR5cGVvZiB0PyhzPXBhcnNlSW50KHQsMTApLC0xIT09dC5pbmRleE9mKCIlIikmJihzPXMvMTAwKmUucGFyZW50Tm9kZVtpXSkpOnM9dCxzfWNvbnN0IG1lPXQ9PnQub3duZXJEb2N1bWVudC5kZWZhdWx0Vmlldy5nZXRDb21wdXRlZFN0eWxlKHQsbnVsbCk7ZnVuY3Rpb24geGUodCxlKXtyZXR1cm4gbWUodCkuZ2V0UHJvcGVydHlWYWx1ZShlKX1jb25zdCBiZT1bInRvcCIsInJpZ2h0IiwiYm90dG9tIiwibGVmdCJdO2Z1bmN0aW9uIF9lKHQsZSxpKXtjb25zdCBzPXt9O2k9aT8iLSIraToiIjtmb3IobGV0IG49MDtuPDQ7bisrKXtjb25zdCBvPWJlW25dO3Nbb109cGFyc2VGbG9hdCh0W2UrIi0iK28raV0pfHwwfXJldHVybiBzLndpZHRoPXMubGVmdCtzLnJpZ2h0LHMuaGVpZ2h0PXMudG9wK3MuYm90dG9tLHN9Y29uc3QgeWU9KHQsZSxpKT0+KHQ+MHx8ZT4wKSYmKCFpfHwhaS5zaGFkb3dSb290KTtmdW5jdGlvbiB2ZSh0LGUpe2lmKCJuYXRpdmUiaW4gdClyZXR1cm4gdDtjb25zdHtjYW52YXM6aSxjdXJyZW50RGV2aWNlUGl4ZWxSYXRpbzpzfT1lLG49bWUoaSksbz0iYm9yZGVyLWJveCI9PT1uLmJveFNpemluZyxhPV9lKG4sInBhZGRpbmciKSxyPV9lKG4sImJvcmRlciIsIndpZHRoIikse3g6bCx5OmgsYm94OmN9PWZ1bmN0aW9uKHQsZSl7Y29uc3QgaT10LnRvdWNoZXMscz1pJiZpLmxlbmd0aD9pWzBdOnQse29mZnNldFg6bixvZmZzZXRZOm99PXM7bGV0IGEscixsPSExO2lmKHllKG4sbyx0LnRhcmdldCkpYT1uLHI9bztlbHNle2NvbnN0IHQ9ZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTthPXMuY2xpZW50WC10LmxlZnQscj1zLmNsaWVudFktdC50b3AsbD0hMH1yZXR1cm57eDphLHk6cixib3g6bH19KHQsaSksZD1hLmxlZnQrKGMmJnIubGVmdCksdT1hLnRvcCsoYyYmci50b3ApO2xldHt3aWR0aDpmLGhlaWdodDpnfT1lO3JldHVybiBvJiYoZi09YS53aWR0aCtyLndpZHRoLGctPWEuaGVpZ2h0K3IuaGVpZ2h0KSx7eDpNYXRoLnJvdW5kKChsLWQpL2YqaS53aWR0aC9zKSx5Ok1hdGgucm91bmQoKGgtdSkvZyppLmhlaWdodC9zKX19Y29uc3QgTWU9dD0+TWF0aC5yb3VuZCgxMCp0KS8xMDtmdW5jdGlvbiB3ZSh0LGUsaSxzKXtjb25zdCBuPW1lKHQpLG89X2UobiwibWFyZ2luIiksYT1wZShuLm1heFdpZHRoLHQsImNsaWVudFdpZHRoIil8fFQscj1wZShuLm1heEhlaWdodCx0LCJjbGllbnRIZWlnaHQiKXx8VCxsPWZ1bmN0aW9uKHQsZSxpKXtsZXQgcyxuO2lmKHZvaWQgMD09PWV8fHZvaWQgMD09PWkpe2NvbnN0IG89dCYmZ2UodCk7aWYobyl7Y29uc3QgdD1vLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLGE9bWUobykscj1fZShhLCJib3JkZXIiLCJ3aWR0aCIpLGw9X2UoYSwicGFkZGluZyIpO2U9dC53aWR0aC1sLndpZHRoLXIud2lkdGgsaT10LmhlaWdodC1sLmhlaWdodC1yLmhlaWdodCxzPXBlKGEubWF4V2lkdGgsbywiY2xpZW50V2lkdGgiKSxuPXBlKGEubWF4SGVpZ2h0LG8sImNsaWVudEhlaWdodCIpfWVsc2UgZT10LmNsaWVudFdpZHRoLGk9dC5jbGllbnRIZWlnaHR9cmV0dXJue3dpZHRoOmUsaGVpZ2h0OmksbWF4V2lkdGg6c3x8VCxtYXhIZWlnaHQ6bnx8VH19KHQsZSxpKTtsZXR7d2lkdGg6aCxoZWlnaHQ6Y309bDtpZigiY29udGVudC1ib3giPT09bi5ib3hTaXppbmcpe2NvbnN0IHQ9X2UobiwiYm9yZGVyIiwid2lkdGgiKSxlPV9lKG4sInBhZGRpbmciKTtoLT1lLndpZHRoK3Qud2lkdGgsYy09ZS5oZWlnaHQrdC5oZWlnaHR9aD1NYXRoLm1heCgwLGgtby53aWR0aCksYz1NYXRoLm1heCgwLHM/aC9zOmMtby5oZWlnaHQpLGg9TWUoTWF0aC5taW4oaCxhLGwubWF4V2lkdGgpKSxjPU1lKE1hdGgubWluKGMscixsLm1heEhlaWdodCkpLGgmJiFjJiYoYz1NZShoLzIpKTtyZXR1cm4odm9pZCAwIT09ZXx8dm9pZCAwIT09aSkmJnMmJmwuaGVpZ2h0JiZjPmwuaGVpZ2h0JiYoYz1sLmhlaWdodCxoPU1lKE1hdGguZmxvb3IoYypzKSkpLHt3aWR0aDpoLGhlaWdodDpjfX1mdW5jdGlvbiBrZSh0LGUsaSl7Y29uc3Qgcz1lfHwxLG49TWUodC5oZWlnaHQqcyksbz1NZSh0LndpZHRoKnMpO3QuaGVpZ2h0PU1lKHQuaGVpZ2h0KSx0LndpZHRoPU1lKHQud2lkdGgpO2NvbnN0IGE9dC5jYW52YXM7cmV0dXJuIGEuc3R5bGUmJihpfHwhYS5zdHlsZS5oZWlnaHQmJiFhLnN0eWxlLndpZHRoKSYmKGEuc3R5bGUuaGVpZ2h0PWAke3QuaGVpZ2h0fXB4YCxhLnN0eWxlLndpZHRoPWAke3Qud2lkdGh9cHhgKSwodC5jdXJyZW50RGV2aWNlUGl4ZWxSYXRpbyE9PXN8fGEuaGVpZ2h0IT09bnx8YS53aWR0aCE9PW8pJiYodC5jdXJyZW50RGV2aWNlUGl4ZWxSYXRpbz1zLGEuaGVpZ2h0PW4sYS53aWR0aD1vLHQuY3R4LnNldFRyYW5zZm9ybShzLDAsMCxzLDAsMCksITApfWNvbnN0IFNlPWZ1bmN0aW9uKCl7bGV0IHQ9ITE7dHJ5e2NvbnN0IGU9e2dldCBwYXNzaXZlKCl7cmV0dXJuIHQ9ITAsITF9fTtmZSgpJiYod2luZG93LmFkZEV2ZW50TGlzdGVuZXIoInRlc3QiLG51bGwsZSksd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoInRlc3QiLG51bGwsZSkpfWNhdGNoKHQpe31yZXR1cm4gdH0oKTtmdW5jdGlvbiBQZSh0LGUpe2NvbnN0IGk9eGUodCxlKSxzPWkmJmkubWF0Y2goL14oXGQrKShcLlxkKyk/cHgkLyk7cmV0dXJuIHM/K3NbMV06dm9pZCAwfWZ1bmN0aW9uIERlKHQpe3JldHVybiF0fHxzKHQuc2l6ZSl8fHModC5mYW1pbHkpP251bGw6KHQuc3R5bGU/dC5zdHlsZSsiICI6IiIpKyh0LndlaWdodD90LndlaWdodCsiICI6IiIpK3Quc2l6ZSsicHggIit0LmZhbWlseX1mdW5jdGlvbiBDZSh0LGUsaSxzLG4pe2xldCBvPWVbbl07cmV0dXJuIG98fChvPWVbbl09dC5tZWFzdXJlVGV4dChuKS53aWR0aCxpLnB1c2gobikpLG8+cyYmKHM9byksc31mdW5jdGlvbiBPZSh0LGUsaSxzKXtsZXQgbz0ocz1zfHx7fSkuZGF0YT1zLmRhdGF8fHt9LGE9cy5nYXJiYWdlQ29sbGVjdD1zLmdhcmJhZ2VDb2xsZWN0fHxbXTtzLmZvbnQhPT1lJiYobz1zLmRhdGE9e30sYT1zLmdhcmJhZ2VDb2xsZWN0PVtdLHMuZm9udD1lKSx0LnNhdmUoKSx0LmZvbnQ9ZTtsZXQgcj0wO2NvbnN0IGw9aS5sZW5ndGg7bGV0IGgsYyxkLHUsZjtmb3IoaD0wO2g8bDtoKyspaWYodT1pW2hdLG51bGw9PXV8fG4odSkpe2lmKG4odSkpZm9yKGM9MCxkPXUubGVuZ3RoO2M8ZDtjKyspZj11W2NdLG51bGw9PWZ8fG4oZil8fChyPUNlKHQsbyxhLHIsZikpfWVsc2Ugcj1DZSh0LG8sYSxyLHUpO3QucmVzdG9yZSgpO2NvbnN0IGc9YS5sZW5ndGgvMjtpZihnPmkubGVuZ3RoKXtmb3IoaD0wO2g8ZztoKyspZGVsZXRlIG9bYVtoXV07YS5zcGxpY2UoMCxnKX1yZXR1cm4gcn1mdW5jdGlvbiBBZSh0LGUsaSl7Y29uc3Qgcz10LmN1cnJlbnREZXZpY2VQaXhlbFJhdGlvLG49MCE9PWk/TWF0aC5tYXgoaS8yLC41KTowO3JldHVybiBNYXRoLnJvdW5kKChlLW4pKnMpL3Mrbn1mdW5jdGlvbiBUZSh0LGUpeyhlfHx0KSYmKChlPWV8fHQuZ2V0Q29udGV4dCgiMmQiKSkuc2F2ZSgpLGUucmVzZXRUcmFuc2Zvcm0oKSxlLmNsZWFyUmVjdCgwLDAsdC53aWR0aCx0LmhlaWdodCksZS5yZXN0b3JlKCkpfWZ1bmN0aW9uIExlKHQsZSxpLHMpe0VlKHQsZSxpLHMsbnVsbCl9ZnVuY3Rpb24gRWUodCxlLGkscyxuKXtsZXQgbyxhLHIsbCxoLGMsZCx1O2NvbnN0IGY9ZS5wb2ludFN0eWxlLGc9ZS5yb3RhdGlvbixwPWUucmFkaXVzO2xldCBtPShnfHwwKSpMO2lmKGYmJiJvYmplY3QiPT10eXBlb2YgZiYmKG89Zi50b1N0cmluZygpLCJbb2JqZWN0IEhUTUxJbWFnZUVsZW1lbnRdIj09PW98fCJbb2JqZWN0IEhUTUxDYW52YXNFbGVtZW50XSI9PT1vKSlyZXR1cm4gdC5zYXZlKCksdC50cmFuc2xhdGUoaSxzKSx0LnJvdGF0ZShtKSx0LmRyYXdJbWFnZShmLC1mLndpZHRoLzIsLWYuaGVpZ2h0LzIsZi53aWR0aCxmLmhlaWdodCksdm9pZCB0LnJlc3RvcmUoKTtpZighKGlzTmFOKHApfHxwPD0wKSl7c3dpdGNoKHQuYmVnaW5QYXRoKCksZil7ZGVmYXVsdDpuP3QuZWxsaXBzZShpLHMsbi8yLHAsMCwwLE8pOnQuYXJjKGkscyxwLDAsTyksdC5jbG9zZVBhdGgoKTticmVhaztjYXNlInRyaWFuZ2xlIjpjPW4/bi8yOnAsdC5tb3ZlVG8oaStNYXRoLnNpbihtKSpjLHMtTWF0aC5jb3MobSkqcCksbSs9SSx0LmxpbmVUbyhpK01hdGguc2luKG0pKmMscy1NYXRoLmNvcyhtKSpwKSxtKz1JLHQubGluZVRvKGkrTWF0aC5zaW4obSkqYyxzLU1hdGguY29zKG0pKnApLHQuY2xvc2VQYXRoKCk7YnJlYWs7Y2FzZSJyZWN0Um91bmRlZCI6aD0uNTE2KnAsbD1wLWgsYT1NYXRoLmNvcyhtK1IpKmwsZD1NYXRoLmNvcyhtK1IpKihuP24vMi1oOmwpLHI9TWF0aC5zaW4obStSKSpsLHU9TWF0aC5zaW4obStSKSoobj9uLzItaDpsKSx0LmFyYyhpLWQscy1yLGgsbS1DLG0tRSksdC5hcmMoaSt1LHMtYSxoLG0tRSxtKSx0LmFyYyhpK2QscytyLGgsbSxtK0UpLHQuYXJjKGktdSxzK2EsaCxtK0UsbStDKSx0LmNsb3NlUGF0aCgpO2JyZWFrO2Nhc2UicmVjdCI6aWYoIWcpe2w9TWF0aC5TUVJUMV8yKnAsYz1uP24vMjpsLHQucmVjdChpLWMscy1sLDIqYywyKmwpO2JyZWFrfW0rPVI7Y2FzZSJyZWN0Um90IjpkPU1hdGguY29zKG0pKihuP24vMjpwKSxhPU1hdGguY29zKG0pKnAscj1NYXRoLnNpbihtKSpwLHU9TWF0aC5zaW4obSkqKG4/bi8yOnApLHQubW92ZVRvKGktZCxzLXIpLHQubGluZVRvKGkrdSxzLWEpLHQubGluZVRvKGkrZCxzK3IpLHQubGluZVRvKGktdSxzK2EpLHQuY2xvc2VQYXRoKCk7YnJlYWs7Y2FzZSJjcm9zc1JvdCI6bSs9UjtjYXNlImNyb3NzIjpkPU1hdGguY29zKG0pKihuP24vMjpwKSxhPU1hdGguY29zKG0pKnAscj1NYXRoLnNpbihtKSpwLHU9TWF0aC5zaW4obSkqKG4/bi8yOnApLHQubW92ZVRvKGktZCxzLXIpLHQubGluZVRvKGkrZCxzK3IpLHQubW92ZVRvKGkrdSxzLWEpLHQubGluZVRvKGktdSxzK2EpO2JyZWFrO2Nhc2Uic3RhciI6ZD1NYXRoLmNvcyhtKSoobj9uLzI6cCksYT1NYXRoLmNvcyhtKSpwLHI9TWF0aC5zaW4obSkqcCx1PU1hdGguc2luKG0pKihuP24vMjpwKSx0Lm1vdmVUbyhpLWQscy1yKSx0LmxpbmVUbyhpK2QscytyKSx0Lm1vdmVUbyhpK3Uscy1hKSx0LmxpbmVUbyhpLXUscythKSxtKz1SLGQ9TWF0aC5jb3MobSkqKG4/bi8yOnApLGE9TWF0aC5jb3MobSkqcCxyPU1hdGguc2luKG0pKnAsdT1NYXRoLnNpbihtKSoobj9uLzI6cCksdC5tb3ZlVG8oaS1kLHMtciksdC5saW5lVG8oaStkLHMrciksdC5tb3ZlVG8oaSt1LHMtYSksdC5saW5lVG8oaS11LHMrYSk7YnJlYWs7Y2FzZSJsaW5lIjphPW4/bi8yOk1hdGguY29zKG0pKnAscj1NYXRoLnNpbihtKSpwLHQubW92ZVRvKGktYSxzLXIpLHQubGluZVRvKGkrYSxzK3IpO2JyZWFrO2Nhc2UiZGFzaCI6dC5tb3ZlVG8oaSxzKSx0LmxpbmVUbyhpK01hdGguY29zKG0pKihuP24vMjpwKSxzK01hdGguc2luKG0pKnApO2JyZWFrO2Nhc2UhMTp0LmNsb3NlUGF0aCgpfXQuZmlsbCgpLGUuYm9yZGVyV2lkdGg+MCYmdC5zdHJva2UoKX19ZnVuY3Rpb24gUmUodCxlLGkpe3JldHVybiBpPWl8fC41LCFlfHx0JiZ0Lng+ZS5sZWZ0LWkmJnQueDxlLnJpZ2h0K2kmJnQueT5lLnRvcC1pJiZ0Lnk8ZS5ib3R0b20raX1mdW5jdGlvbiBJZSh0LGUpe3Quc2F2ZSgpLHQuYmVnaW5QYXRoKCksdC5yZWN0KGUubGVmdCxlLnRvcCxlLnJpZ2h0LWUubGVmdCxlLmJvdHRvbS1lLnRvcCksdC5jbGlwKCl9ZnVuY3Rpb24gemUodCl7dC5yZXN0b3JlKCl9ZnVuY3Rpb24gRmUodCxlLGkscyxuKXtpZighZSlyZXR1cm4gdC5saW5lVG8oaS54LGkueSk7aWYoIm1pZGRsZSI9PT1uKXtjb25zdCBzPShlLngraS54KS8yO3QubGluZVRvKHMsZS55KSx0LmxpbmVUbyhzLGkueSl9ZWxzZSJhZnRlciI9PT1uIT0hIXM/dC5saW5lVG8oZS54LGkueSk6dC5saW5lVG8oaS54LGUueSk7dC5saW5lVG8oaS54LGkueSl9ZnVuY3Rpb24gVmUodCxlLGkscyl7aWYoIWUpcmV0dXJuIHQubGluZVRvKGkueCxpLnkpO3QuYmV6aWVyQ3VydmVUbyhzP2UuY3AxeDplLmNwMngscz9lLmNwMXk6ZS5jcDJ5LHM/aS5jcDJ4OmkuY3AxeCxzP2kuY3AyeTppLmNwMXksaS54LGkueSl9ZnVuY3Rpb24gQmUodCxlLGkscyxuKXtpZihuLnN0cmlrZXRocm91Z2h8fG4udW5kZXJsaW5lKXtjb25zdCBvPXQubWVhc3VyZVRleHQocyksYT1lLW8uYWN0dWFsQm91bmRpbmdCb3hMZWZ0LHI9ZStvLmFjdHVhbEJvdW5kaW5nQm94UmlnaHQsbD1pLW8uYWN0dWFsQm91bmRpbmdCb3hBc2NlbnQsaD1pK28uYWN0dWFsQm91bmRpbmdCb3hEZXNjZW50LGM9bi5zdHJpa2V0aHJvdWdoPyhsK2gpLzI6aDt0LnN0cm9rZVN0eWxlPXQuZmlsbFN0eWxlLHQuYmVnaW5QYXRoKCksdC5saW5lV2lkdGg9bi5kZWNvcmF0aW9uV2lkdGh8fDIsdC5tb3ZlVG8oYSxjKSx0LmxpbmVUbyhyLGMpLHQuc3Ryb2tlKCl9fWZ1bmN0aW9uIFdlKHQsZSl7Y29uc3QgaT10LmZpbGxTdHlsZTt0LmZpbGxTdHlsZT1lLmNvbG9yLHQuZmlsbFJlY3QoZS5sZWZ0LGUudG9wLGUud2lkdGgsZS5oZWlnaHQpLHQuZmlsbFN0eWxlPWl9ZnVuY3Rpb24gTmUodCxlLGksbyxhLHI9e30pe2NvbnN0IGw9bihlKT9lOltlXSxoPXIuc3Ryb2tlV2lkdGg+MCYmIiIhPT1yLnN0cm9rZUNvbG9yO2xldCBjLGQ7Zm9yKHQuc2F2ZSgpLHQuZm9udD1hLnN0cmluZyxmdW5jdGlvbih0LGUpe2UudHJhbnNsYXRpb24mJnQudHJhbnNsYXRlKGUudHJhbnNsYXRpb25bMF0sZS50cmFuc2xhdGlvblsxXSkscyhlLnJvdGF0aW9uKXx8dC5yb3RhdGUoZS5yb3RhdGlvbiksZS5jb2xvciYmKHQuZmlsbFN0eWxlPWUuY29sb3IpLGUudGV4dEFsaWduJiYodC50ZXh0QWxpZ249ZS50ZXh0QWxpZ24pLGUudGV4dEJhc2VsaW5lJiYodC50ZXh0QmFzZWxpbmU9ZS50ZXh0QmFzZWxpbmUpfSh0LHIpLGM9MDtjPGwubGVuZ3RoOysrYylkPWxbY10sci5iYWNrZHJvcCYmV2UodCxyLmJhY2tkcm9wKSxoJiYoci5zdHJva2VDb2xvciYmKHQuc3Ryb2tlU3R5bGU9ci5zdHJva2VDb2xvcikscyhyLnN0cm9rZVdpZHRoKXx8KHQubGluZVdpZHRoPXIuc3Ryb2tlV2lkdGgpLHQuc3Ryb2tlVGV4dChkLGksbyxyLm1heFdpZHRoKSksdC5maWxsVGV4dChkLGksbyxyLm1heFdpZHRoKSxCZSh0LGksbyxkLHIpLG8rPU51bWJlcihhLmxpbmVIZWlnaHQpO3QucmVzdG9yZSgpfWZ1bmN0aW9uIEhlKHQsZSl7Y29uc3R7eDppLHk6cyx3Om4saDpvLHJhZGl1czphfT1lO3QuYXJjKGkrYS50b3BMZWZ0LHMrYS50b3BMZWZ0LGEudG9wTGVmdCwxLjUqQyxDLCEwKSx0LmxpbmVUbyhpLHMrby1hLmJvdHRvbUxlZnQpLHQuYXJjKGkrYS5ib3R0b21MZWZ0LHMrby1hLmJvdHRvbUxlZnQsYS5ib3R0b21MZWZ0LEMsRSwhMCksdC5saW5lVG8oaStuLWEuYm90dG9tUmlnaHQscytvKSx0LmFyYyhpK24tYS5ib3R0b21SaWdodCxzK28tYS5ib3R0b21SaWdodCxhLmJvdHRvbVJpZ2h0LEUsMCwhMCksdC5saW5lVG8oaStuLHMrYS50b3BSaWdodCksdC5hcmMoaStuLWEudG9wUmlnaHQscythLnRvcFJpZ2h0LGEudG9wUmlnaHQsMCwtRSwhMCksdC5saW5lVG8oaSthLnRvcExlZnQscyl9ZnVuY3Rpb24gamUodCxlPVsiIl0saSxzLG49KCgpPT50WzBdKSl7Y29uc3Qgbz1pfHx0O3ZvaWQgMD09PXMmJihzPXRpKCJfZmFsbGJhY2siLHQpKTtjb25zdCBhPXtbU3ltYm9sLnRvU3RyaW5nVGFnXToiT2JqZWN0IixfY2FjaGVhYmxlOiEwLF9zY29wZXM6dCxfcm9vdFNjb3BlczpvLF9mYWxsYmFjazpzLF9nZXRUYXJnZXQ6bixvdmVycmlkZTppPT5qZShbaSwuLi50XSxlLG8scyl9O3JldHVybiBuZXcgUHJveHkoYSx7ZGVsZXRlUHJvcGVydHk6KGUsaSk9PihkZWxldGUgZVtpXSxkZWxldGUgZS5fa2V5cyxkZWxldGUgdFswXVtpXSwhMCksZ2V0OihpLHMpPT5xZShpLHMsKCgpPT5mdW5jdGlvbih0LGUsaSxzKXtsZXQgbjtmb3IoY29uc3QgbyBvZiBlKWlmKG49dGkoVWUobyx0KSxpKSx2b2lkIDAhPT1uKXJldHVybiBYZSh0LG4pP1plKGkscyx0LG4pOm59KHMsZSx0LGkpKSksZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yOih0LGUpPT5SZWZsZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0Ll9zY29wZXNbMF0sZSksZ2V0UHJvdG90eXBlT2Y6KCk9PlJlZmxlY3QuZ2V0UHJvdG90eXBlT2YodFswXSksaGFzOih0LGUpPT5laSh0KS5pbmNsdWRlcyhlKSxvd25LZXlzOnQ9PmVpKHQpLHNldCh0LGUsaSl7Y29uc3Qgcz10Ll9zdG9yYWdlfHwodC5fc3RvcmFnZT1uKCkpO3JldHVybiB0W2VdPXNbZV09aSxkZWxldGUgdC5fa2V5cywhMH19KX1mdW5jdGlvbiAkZSh0LGUsaSxzKXtjb25zdCBhPXtfY2FjaGVhYmxlOiExLF9wcm94eTp0LF9jb250ZXh0OmUsX3N1YlByb3h5OmksX3N0YWNrOm5ldyBTZXQsX2Rlc2NyaXB0b3JzOlllKHQscyksc2V0Q29udGV4dDplPT4kZSh0LGUsaSxzKSxvdmVycmlkZTpuPT4kZSh0Lm92ZXJyaWRlKG4pLGUsaSxzKX07cmV0dXJuIG5ldyBQcm94eShhLHtkZWxldGVQcm9wZXJ0eTooZSxpKT0+KGRlbGV0ZSBlW2ldLGRlbGV0ZSB0W2ldLCEwKSxnZXQ6KHQsZSxpKT0+cWUodCxlLCgoKT0+ZnVuY3Rpb24odCxlLGkpe2NvbnN0e19wcm94eTpzLF9jb250ZXh0OmEsX3N1YlByb3h5OnIsX2Rlc2NyaXB0b3JzOmx9PXQ7bGV0IGg9c1tlXTtTKGgpJiZsLmlzU2NyaXB0YWJsZShlKSYmKGg9ZnVuY3Rpb24odCxlLGkscyl7Y29uc3R7X3Byb3h5Om4sX2NvbnRleHQ6byxfc3ViUHJveHk6YSxfc3RhY2s6cn09aTtpZihyLmhhcyh0KSl0aHJvdyBuZXcgRXJyb3IoIlJlY3Vyc2lvbiBkZXRlY3RlZDogIitBcnJheS5mcm9tKHIpLmpvaW4oIi0+IikrIi0+Iit0KTtyLmFkZCh0KTtsZXQgbD1lKG8sYXx8cyk7ci5kZWxldGUodCksWGUodCxsKSYmKGw9WmUobi5fc2NvcGVzLG4sdCxsKSk7cmV0dXJuIGx9KGUsaCx0LGkpKTtuKGgpJiZoLmxlbmd0aCYmKGg9ZnVuY3Rpb24odCxlLGkscyl7Y29uc3R7X3Byb3h5Om4sX2NvbnRleHQ6YSxfc3ViUHJveHk6cixfZGVzY3JpcHRvcnM6bH09aTtpZih2b2lkIDAhPT1hLmluZGV4JiZzKHQpKXJldHVybiBlW2EuaW5kZXglZS5sZW5ndGhdO2lmKG8oZVswXSkpe2NvbnN0IGk9ZSxzPW4uX3Njb3Blcy5maWx0ZXIoKHQ9PnQhPT1pKSk7ZT1bXTtmb3IoY29uc3QgbyBvZiBpKXtjb25zdCBpPVplKHMsbix0LG8pO2UucHVzaCgkZShpLGEsciYmclt0XSxsKSl9fXJldHVybiBlfShlLGgsdCxsLmlzSW5kZXhhYmxlKSk7WGUoZSxoKSYmKGg9JGUoaCxhLHImJnJbZV0sbCkpO3JldHVybiBofSh0LGUsaSkpKSxnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3I6KGUsaSk9PmUuX2Rlc2NyaXB0b3JzLmFsbEtleXM/UmVmbGVjdC5oYXModCxpKT97ZW51bWVyYWJsZTohMCxjb25maWd1cmFibGU6ITB9OnZvaWQgMDpSZWZsZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0LGkpLGdldFByb3RvdHlwZU9mOigpPT5SZWZsZWN0LmdldFByb3RvdHlwZU9mKHQpLGhhczooZSxpKT0+UmVmbGVjdC5oYXModCxpKSxvd25LZXlzOigpPT5SZWZsZWN0Lm93bktleXModCksc2V0OihlLGkscyk9Pih0W2ldPXMsZGVsZXRlIGVbaV0sITApfSl9ZnVuY3Rpb24gWWUodCxlPXtzY3JpcHRhYmxlOiEwLGluZGV4YWJsZTohMH0pe2NvbnN0e19zY3JpcHRhYmxlOmk9ZS5zY3JpcHRhYmxlLF9pbmRleGFibGU6cz1lLmluZGV4YWJsZSxfYWxsS2V5czpuPWUuYWxsS2V5c309dDtyZXR1cm57YWxsS2V5czpuLHNjcmlwdGFibGU6aSxpbmRleGFibGU6cyxpc1NjcmlwdGFibGU6UyhpKT9pOigpPT5pLGlzSW5kZXhhYmxlOlMocyk/czooKT0+c319Y29uc3QgVWU9KHQsZSk9PnQ/dCt3KGUpOmUsWGU9KHQsZSk9Pm8oZSkmJiJhZGFwdGVycyIhPT10JiYobnVsbD09PU9iamVjdC5nZXRQcm90b3R5cGVPZihlKXx8ZS5jb25zdHJ1Y3Rvcj09PU9iamVjdCk7ZnVuY3Rpb24gcWUodCxlLGkpe2lmKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh0LGUpfHwiY29uc3RydWN0b3IiPT09ZSlyZXR1cm4gdFtlXTtjb25zdCBzPWkoKTtyZXR1cm4gdFtlXT1zLHN9ZnVuY3Rpb24gS2UodCxlLGkpe3JldHVybiBTKHQpP3QoZSxpKTp0fWNvbnN0IEdlPSh0LGUpPT4hMD09PXQ/ZToic3RyaW5nIj09dHlwZW9mIHQ/TShlLHQpOnZvaWQgMDtmdW5jdGlvbiBKZSh0LGUsaSxzLG4pe2Zvcihjb25zdCBvIG9mIGUpe2NvbnN0IGU9R2UoaSxvKTtpZihlKXt0LmFkZChlKTtjb25zdCBvPUtlKGUuX2ZhbGxiYWNrLGksbik7aWYodm9pZCAwIT09byYmbyE9PWkmJm8hPT1zKXJldHVybiBvfWVsc2UgaWYoITE9PT1lJiZ2b2lkIDAhPT1zJiZpIT09cylyZXR1cm4gbnVsbH1yZXR1cm4hMX1mdW5jdGlvbiBaZSh0LGUsaSxzKXtjb25zdCBhPWUuX3Jvb3RTY29wZXMscj1LZShlLl9mYWxsYmFjayxpLHMpLGw9Wy4uLnQsLi4uYV0saD1uZXcgU2V0O2guYWRkKHMpO2xldCBjPVFlKGgsbCxpLHJ8fGkscyk7cmV0dXJuIG51bGwhPT1jJiYoKHZvaWQgMD09PXJ8fHI9PT1pfHwoYz1RZShoLGwscixjLHMpLG51bGwhPT1jKSkmJmplKEFycmF5LmZyb20oaCksWyIiXSxhLHIsKCgpPT5mdW5jdGlvbih0LGUsaSl7Y29uc3Qgcz10Ll9nZXRUYXJnZXQoKTtlIGluIHN8fChzW2VdPXt9KTtjb25zdCBhPXNbZV07aWYobihhKSYmbyhpKSlyZXR1cm4gaTtyZXR1cm4gYXx8e319KGUsaSxzKSkpKX1mdW5jdGlvbiBRZSh0LGUsaSxzLG4pe2Zvcig7aTspaT1KZSh0LGUsaSxzLG4pO3JldHVybiBpfWZ1bmN0aW9uIHRpKHQsZSl7Zm9yKGNvbnN0IGkgb2YgZSl7aWYoIWkpY29udGludWU7Y29uc3QgZT1pW3RdO2lmKHZvaWQgMCE9PWUpcmV0dXJuIGV9fWZ1bmN0aW9uIGVpKHQpe2xldCBlPXQuX2tleXM7cmV0dXJuIGV8fChlPXQuX2tleXM9ZnVuY3Rpb24odCl7Y29uc3QgZT1uZXcgU2V0O2Zvcihjb25zdCBpIG9mIHQpZm9yKGNvbnN0IHQgb2YgT2JqZWN0LmtleXMoaSkuZmlsdGVyKCh0PT4hdC5zdGFydHNXaXRoKCJfIikpKSllLmFkZCh0KTtyZXR1cm4gQXJyYXkuZnJvbShlKX0odC5fc2NvcGVzKSksZX1mdW5jdGlvbiBpaSh0LGUsaSxzKXtjb25zdHtpU2NhbGU6bn09dCx7a2V5Om89InIifT10aGlzLl9wYXJzaW5nLGE9bmV3IEFycmF5KHMpO2xldCByLGwsaCxjO2ZvcihyPTAsbD1zO3I8bDsrK3IpaD1yK2ksYz1lW2hdLGFbcl09e3I6bi5wYXJzZShNKGMsbyksaCl9O3JldHVybiBhfWNvbnN0IHNpPU51bWJlci5FUFNJTE9OfHwxZS0xNCxuaT0odCxlKT0+ZTx0Lmxlbmd0aCYmIXRbZV0uc2tpcCYmdFtlXSxvaT10PT4ieCI9PT10PyJ5IjoieCI7ZnVuY3Rpb24gYWkodCxlLGkscyl7Y29uc3Qgbj10LnNraXA/ZTp0LG89ZSxhPWkuc2tpcD9lOmkscj1xKG8sbiksbD1xKGEsbyk7bGV0IGg9ci8ocitsKSxjPWwvKHIrbCk7aD1pc05hTihoKT8wOmgsYz1pc05hTihjKT8wOmM7Y29uc3QgZD1zKmgsdT1zKmM7cmV0dXJue3ByZXZpb3VzOnt4Om8ueC1kKihhLngtbi54KSx5Om8ueS1kKihhLnktbi55KX0sbmV4dDp7eDpvLngrdSooYS54LW4ueCkseTpvLnkrdSooYS55LW4ueSl9fX1mdW5jdGlvbiByaSh0LGU9IngiKXtjb25zdCBpPW9pKGUpLHM9dC5sZW5ndGgsbj1BcnJheShzKS5maWxsKDApLG89QXJyYXkocyk7bGV0IGEscixsLGg9bmkodCwwKTtmb3IoYT0wO2E8czsrK2EpaWYocj1sLGw9aCxoPW5pKHQsYSsxKSxsKXtpZihoKXtjb25zdCB0PWhbZV0tbFtlXTtuW2FdPTAhPT10PyhoW2ldLWxbaV0pL3Q6MH1vW2FdPXI/aD9GKG5bYS0xXSkhPT1GKG5bYV0pPzA6KG5bYS0xXStuW2FdKS8yOm5bYS0xXTpuW2FdfSFmdW5jdGlvbih0LGUsaSl7Y29uc3Qgcz10Lmxlbmd0aDtsZXQgbixvLGEscixsLGg9bmkodCwwKTtmb3IobGV0IGM9MDtjPHMtMTsrK2MpbD1oLGg9bmkodCxjKzEpLGwmJmgmJihWKGVbY10sMCxzaSk/aVtjXT1pW2MrMV09MDoobj1pW2NdL2VbY10sbz1pW2MrMV0vZVtjXSxyPU1hdGgucG93KG4sMikrTWF0aC5wb3cobywyKSxyPD05fHwoYT0zL01hdGguc3FydChyKSxpW2NdPW4qYSplW2NdLGlbYysxXT1vKmEqZVtjXSkpKX0odCxuLG8pLGZ1bmN0aW9uKHQsZSxpPSJ4Iil7Y29uc3Qgcz1vaShpKSxuPXQubGVuZ3RoO2xldCBvLGEscixsPW5pKHQsMCk7Zm9yKGxldCBoPTA7aDxuOysraCl7aWYoYT1yLHI9bCxsPW5pKHQsaCsxKSwhciljb250aW51ZTtjb25zdCBuPXJbaV0sYz1yW3NdO2EmJihvPShuLWFbaV0pLzMscltgY3AxJHtpfWBdPW4tbyxyW2BjcDEke3N9YF09Yy1vKmVbaF0pLGwmJihvPShsW2ldLW4pLzMscltgY3AyJHtpfWBdPW4rbyxyW2BjcDIke3N9YF09YytvKmVbaF0pfX0odCxvLGUpfWZ1bmN0aW9uIGxpKHQsZSxpKXtyZXR1cm4gTWF0aC5tYXgoTWF0aC5taW4odCxpKSxlKX1mdW5jdGlvbiBoaSh0LGUsaSxzLG4pe2xldCBvLGEscixsO2lmKGUuc3BhbkdhcHMmJih0PXQuZmlsdGVyKCh0PT4hdC5za2lwKSkpLCJtb25vdG9uZSI9PT1lLmN1YmljSW50ZXJwb2xhdGlvbk1vZGUpcmkodCxuKTtlbHNle2xldCBpPXM/dFt0Lmxlbmd0aC0xXTp0WzBdO2ZvcihvPTAsYT10Lmxlbmd0aDtvPGE7KytvKXI9dFtvXSxsPWFpKGkscix0W01hdGgubWluKG8rMSxhLShzPzA6MSkpJWFdLGUudGVuc2lvbiksci5jcDF4PWwucHJldmlvdXMueCxyLmNwMXk9bC5wcmV2aW91cy55LHIuY3AyeD1sLm5leHQueCxyLmNwMnk9bC5uZXh0LnksaT1yfWUuY2FwQmV6aWVyUG9pbnRzJiZmdW5jdGlvbih0LGUpe2xldCBpLHMsbixvLGEscj1SZSh0WzBdLGUpO2ZvcihpPTAscz10Lmxlbmd0aDtpPHM7KytpKWE9byxvPXIscj1pPHMtMSYmUmUodFtpKzFdLGUpLG8mJihuPXRbaV0sYSYmKG4uY3AxeD1saShuLmNwMXgsZS5sZWZ0LGUucmlnaHQpLG4uY3AxeT1saShuLmNwMXksZS50b3AsZS5ib3R0b20pKSxyJiYobi5jcDJ4PWxpKG4uY3AyeCxlLmxlZnQsZS5yaWdodCksbi5jcDJ5PWxpKG4uY3AyeSxlLnRvcCxlLmJvdHRvbSkpKX0odCxpKX1jb25zdCBjaT10PT4wPT09dHx8MT09PXQsZGk9KHQsZSxpKT0+LU1hdGgucG93KDIsMTAqKHQtPTEpKSpNYXRoLnNpbigodC1lKSpPL2kpLHVpPSh0LGUsaSk9Pk1hdGgucG93KDIsLTEwKnQpKk1hdGguc2luKCh0LWUpKk8vaSkrMSxmaT17bGluZWFyOnQ9PnQsZWFzZUluUXVhZDp0PT50KnQsZWFzZU91dFF1YWQ6dD0+LXQqKHQtMiksZWFzZUluT3V0UXVhZDp0PT4odC89LjUpPDE/LjUqdCp0Oi0uNSooLS10Kih0LTIpLTEpLGVhc2VJbkN1YmljOnQ9PnQqdCp0LGVhc2VPdXRDdWJpYzp0PT4odC09MSkqdCp0KzEsZWFzZUluT3V0Q3ViaWM6dD0+KHQvPS41KTwxPy41KnQqdCp0Oi41KigodC09MikqdCp0KzIpLGVhc2VJblF1YXJ0OnQ9PnQqdCp0KnQsZWFzZU91dFF1YXJ0OnQ9Pi0oKHQtPTEpKnQqdCp0LTEpLGVhc2VJbk91dFF1YXJ0OnQ9Pih0Lz0uNSk8MT8uNSp0KnQqdCp0Oi0uNSooKHQtPTIpKnQqdCp0LTIpLGVhc2VJblF1aW50OnQ9PnQqdCp0KnQqdCxlYXNlT3V0UXVpbnQ6dD0+KHQtPTEpKnQqdCp0KnQrMSxlYXNlSW5PdXRRdWludDp0PT4odC89LjUpPDE/LjUqdCp0KnQqdCp0Oi41KigodC09MikqdCp0KnQqdCsyKSxlYXNlSW5TaW5lOnQ9PjEtTWF0aC5jb3ModCpFKSxlYXNlT3V0U2luZTp0PT5NYXRoLnNpbih0KkUpLGVhc2VJbk91dFNpbmU6dD0+LS41KihNYXRoLmNvcyhDKnQpLTEpLGVhc2VJbkV4cG86dD0+MD09PXQ/MDpNYXRoLnBvdygyLDEwKih0LTEpKSxlYXNlT3V0RXhwbzp0PT4xPT09dD8xOjEtTWF0aC5wb3coMiwtMTAqdCksZWFzZUluT3V0RXhwbzp0PT5jaSh0KT90OnQ8LjU/LjUqTWF0aC5wb3coMiwxMCooMip0LTEpKTouNSooMi1NYXRoLnBvdygyLC0xMCooMip0LTEpKSksZWFzZUluQ2lyYzp0PT50Pj0xP3Q6LShNYXRoLnNxcnQoMS10KnQpLTEpLGVhc2VPdXRDaXJjOnQ9Pk1hdGguc3FydCgxLSh0LT0xKSp0KSxlYXNlSW5PdXRDaXJjOnQ9Pih0Lz0uNSk8MT8tLjUqKE1hdGguc3FydCgxLXQqdCktMSk6LjUqKE1hdGguc3FydCgxLSh0LT0yKSp0KSsxKSxlYXNlSW5FbGFzdGljOnQ9PmNpKHQpP3Q6ZGkodCwuMDc1LC4zKSxlYXNlT3V0RWxhc3RpYzp0PT5jaSh0KT90OnVpKHQsLjA3NSwuMyksZWFzZUluT3V0RWxhc3RpYyh0KXtjb25zdCBlPS4xMTI1O3JldHVybiBjaSh0KT90OnQ8LjU/LjUqZGkoMip0LGUsLjQ1KTouNSsuNSp1aSgyKnQtMSxlLC40NSl9LGVhc2VJbkJhY2sodCl7Y29uc3QgZT0xLjcwMTU4O3JldHVybiB0KnQqKChlKzEpKnQtZSl9LGVhc2VPdXRCYWNrKHQpe2NvbnN0IGU9MS43MDE1ODtyZXR1cm4odC09MSkqdCooKGUrMSkqdCtlKSsxfSxlYXNlSW5PdXRCYWNrKHQpe2xldCBlPTEuNzAxNTg7cmV0dXJuKHQvPS41KTwxP3QqdCooKDErKGUqPTEuNTI1KSkqdC1lKSouNTouNSooKHQtPTIpKnQqKCgxKyhlKj0xLjUyNSkpKnQrZSkrMil9LGVhc2VJbkJvdW5jZTp0PT4xLWZpLmVhc2VPdXRCb3VuY2UoMS10KSxlYXNlT3V0Qm91bmNlKHQpe2NvbnN0IGU9Ny41NjI1LGk9Mi43NTtyZXR1cm4gdDwxL2k/ZSp0KnQ6dDwyL2k/ZSoodC09MS41L2kpKnQrLjc1OnQ8Mi41L2k/ZSoodC09Mi4yNS9pKSp0Ky45Mzc1OmUqKHQtPTIuNjI1L2kpKnQrLjk4NDM3NX0sZWFzZUluT3V0Qm91bmNlOnQ9PnQ8LjU/LjUqZmkuZWFzZUluQm91bmNlKDIqdCk6LjUqZmkuZWFzZU91dEJvdW5jZSgyKnQtMSkrLjV9O2Z1bmN0aW9uIGdpKHQsZSxpLHMpe3JldHVybnt4OnQueCtpKihlLngtdC54KSx5OnQueStpKihlLnktdC55KX19ZnVuY3Rpb24gcGkodCxlLGkscyl7cmV0dXJue3g6dC54K2kqKGUueC10LngpLHk6Im1pZGRsZSI9PT1zP2k8LjU/dC55OmUueToiYWZ0ZXIiPT09cz9pPDE/dC55OmUueTppPjA/ZS55OnQueX19ZnVuY3Rpb24gbWkodCxlLGkscyl7Y29uc3Qgbj17eDp0LmNwMngseTp0LmNwMnl9LG89e3g6ZS5jcDF4LHk6ZS5jcDF5fSxhPWdpKHQsbixpKSxyPWdpKG4sbyxpKSxsPWdpKG8sZSxpKSxoPWdpKGEscixpKSxjPWdpKHIsbCxpKTtyZXR1cm4gZ2koaCxjLGkpfWNvbnN0IHhpPS9eKG5vcm1hbHwoXGQrKD86XC5cZCspPykocHh8ZW18JSk/KSQvLGJpPS9eKG5vcm1hbHxpdGFsaWN8aW5pdGlhbHxpbmhlcml0fHVuc2V0fChvYmxpcXVlKCAtP1swLTldP1swLTldZGVnKT8pKSQvO2Z1bmN0aW9uIF9pKHQsZSl7Y29uc3QgaT0oIiIrdCkubWF0Y2goeGkpO2lmKCFpfHwibm9ybWFsIj09PWlbMV0pcmV0dXJuIDEuMiplO3N3aXRjaCh0PStpWzJdLGlbM10pe2Nhc2UicHgiOnJldHVybiB0O2Nhc2UiJSI6dC89MTAwfXJldHVybiBlKnR9Y29uc3QgeWk9dD0+K3R8fDA7ZnVuY3Rpb24gdmkodCxlKXtjb25zdCBpPXt9LHM9byhlKSxuPXM/T2JqZWN0LmtleXMoZSk6ZSxhPW8odCk/cz9pPT5sKHRbaV0sdFtlW2ldXSk6ZT0+dFtlXTooKT0+dDtmb3IoY29uc3QgdCBvZiBuKWlbdF09eWkoYSh0KSk7cmV0dXJuIGl9ZnVuY3Rpb24gTWkodCl7cmV0dXJuIHZpKHQse3RvcDoieSIscmlnaHQ6IngiLGJvdHRvbToieSIsbGVmdDoieCJ9KX1mdW5jdGlvbiB3aSh0KXtyZXR1cm4gdmkodCxbInRvcExlZnQiLCJ0b3BSaWdodCIsImJvdHRvbUxlZnQiLCJib3R0b21SaWdodCJdKX1mdW5jdGlvbiBraSh0KXtjb25zdCBlPU1pKHQpO3JldHVybiBlLndpZHRoPWUubGVmdCtlLnJpZ2h0LGUuaGVpZ2h0PWUudG9wK2UuYm90dG9tLGV9ZnVuY3Rpb24gU2kodCxlKXt0PXR8fHt9LGU9ZXx8dWUuZm9udDtsZXQgaT1sKHQuc2l6ZSxlLnNpemUpOyJzdHJpbmciPT10eXBlb2YgaSYmKGk9cGFyc2VJbnQoaSwxMCkpO2xldCBzPWwodC5zdHlsZSxlLnN0eWxlKTtzJiYhKCIiK3MpLm1hdGNoKGJpKSYmKGNvbnNvbGUud2FybignSW52YWxpZCBmb250IHN0eWxlIHNwZWNpZmllZDogIicrcysnIicpLHM9dm9pZCAwKTtjb25zdCBuPXtmYW1pbHk6bCh0LmZhbWlseSxlLmZhbWlseSksbGluZUhlaWdodDpfaShsKHQubGluZUhlaWdodCxlLmxpbmVIZWlnaHQpLGkpLHNpemU6aSxzdHlsZTpzLHdlaWdodDpsKHQud2VpZ2h0LGUud2VpZ2h0KSxzdHJpbmc6IiJ9O3JldHVybiBuLnN0cmluZz1EZShuKSxufWZ1bmN0aW9uIFBpKHQsZSxpLHMpe2xldCBvLGEscixsPSEwO2ZvcihvPTAsYT10Lmxlbmd0aDtvPGE7KytvKWlmKHI9dFtvXSx2b2lkIDAhPT1yJiYodm9pZCAwIT09ZSYmImZ1bmN0aW9uIj09dHlwZW9mIHImJihyPXIoZSksbD0hMSksdm9pZCAwIT09aSYmbihyKSYmKHI9cltpJXIubGVuZ3RoXSxsPSExKSx2b2lkIDAhPT1yKSlyZXR1cm4gcyYmIWwmJihzLmNhY2hlYWJsZT0hMSkscn1mdW5jdGlvbiBEaSh0LGUsaSl7Y29uc3R7bWluOnMsbWF4Om59PXQsbz1jKGUsKG4tcykvMiksYT0odCxlKT0+aSYmMD09PXQ/MDp0K2U7cmV0dXJue21pbjphKHMsLU1hdGguYWJzKG8pKSxtYXg6YShuLG8pfX1mdW5jdGlvbiBDaSh0LGUpe3JldHVybiBPYmplY3QuYXNzaWduKE9iamVjdC5jcmVhdGUodCksZSl9ZnVuY3Rpb24gT2kodCxlLGkpe3JldHVybiB0P2Z1bmN0aW9uKHQsZSl7cmV0dXJue3g6aT0+dCt0K2UtaSxzZXRXaWR0aCh0KXtlPXR9LHRleHRBbGlnbjp0PT4iY2VudGVyIj09PXQ/dDoicmlnaHQiPT09dD8ibGVmdCI6InJpZ2h0Iix4UGx1czoodCxlKT0+dC1lLGxlZnRGb3JMdHI6KHQsZSk9PnQtZX19KGUsaSk6e3g6dD0+dCxzZXRXaWR0aCh0KXt9LHRleHRBbGlnbjp0PT50LHhQbHVzOih0LGUpPT50K2UsbGVmdEZvckx0cjoodCxlKT0+dH19ZnVuY3Rpb24gQWkodCxlKXtsZXQgaSxzOyJsdHIiIT09ZSYmInJ0bCIhPT1lfHwoaT10LmNhbnZhcy5zdHlsZSxzPVtpLmdldFByb3BlcnR5VmFsdWUoImRpcmVjdGlvbiIpLGkuZ2V0UHJvcGVydHlQcmlvcml0eSgiZGlyZWN0aW9uIildLGkuc2V0UHJvcGVydHkoImRpcmVjdGlvbiIsZSwiaW1wb3J0YW50IiksdC5wcmV2VGV4dERpcmVjdGlvbj1zKX1mdW5jdGlvbiBUaSh0LGUpe3ZvaWQgMCE9PWUmJihkZWxldGUgdC5wcmV2VGV4dERpcmVjdGlvbix0LmNhbnZhcy5zdHlsZS5zZXRQcm9wZXJ0eSgiZGlyZWN0aW9uIixlWzBdLGVbMV0pKX1mdW5jdGlvbiBMaSh0KXtyZXR1cm4iYW5nbGUiPT09dD97YmV0d2VlbjpKLGNvbXBhcmU6Syxub3JtYWxpemU6R306e2JldHdlZW46dHQsY29tcGFyZToodCxlKT0+dC1lLG5vcm1hbGl6ZTp0PT50fX1mdW5jdGlvbiBFaSh7c3RhcnQ6dCxlbmQ6ZSxjb3VudDppLGxvb3A6cyxzdHlsZTpufSl7cmV0dXJue3N0YXJ0OnQlaSxlbmQ6ZSVpLGxvb3A6cyYmKGUtdCsxKSVpPT0wLHN0eWxlOm59fWZ1bmN0aW9uIFJpKHQsZSxpKXtpZighaSlyZXR1cm5bdF07Y29uc3R7cHJvcGVydHk6cyxzdGFydDpuLGVuZDpvfT1pLGE9ZS5sZW5ndGgse2NvbXBhcmU6cixiZXR3ZWVuOmwsbm9ybWFsaXplOmh9PUxpKHMpLHtzdGFydDpjLGVuZDpkLGxvb3A6dSxzdHlsZTpmfT1mdW5jdGlvbih0LGUsaSl7Y29uc3R7cHJvcGVydHk6cyxzdGFydDpuLGVuZDpvfT1pLHtiZXR3ZWVuOmEsbm9ybWFsaXplOnJ9PUxpKHMpLGw9ZS5sZW5ndGg7bGV0IGgsYyx7c3RhcnQ6ZCxlbmQ6dSxsb29wOmZ9PXQ7aWYoZil7Zm9yKGQrPWwsdSs9bCxoPTAsYz1sO2g8YyYmYShyKGVbZCVsXVtzXSksbixvKTsrK2gpZC0tLHUtLTtkJT1sLHUlPWx9cmV0dXJuIHU8ZCYmKHUrPWwpLHtzdGFydDpkLGVuZDp1LGxvb3A6ZixzdHlsZTp0LnN0eWxlfX0odCxlLGkpLGc9W107bGV0IHAsbSx4LGI9ITEsXz1udWxsO2NvbnN0IHk9KCk9PmJ8fGwobix4LHApJiYwIT09cihuLHgpLHY9KCk9PiFifHwwPT09cihvLHApfHxsKG8seCxwKTtmb3IobGV0IHQ9YyxpPWM7dDw9ZDsrK3QpbT1lW3QlYV0sbS5za2lwfHwocD1oKG1bc10pLHAhPT14JiYoYj1sKHAsbixvKSxudWxsPT09XyYmeSgpJiYoXz0wPT09cihwLG4pP3Q6aSksbnVsbCE9PV8mJnYoKSYmKGcucHVzaChFaSh7c3RhcnQ6XyxlbmQ6dCxsb29wOnUsY291bnQ6YSxzdHlsZTpmfSkpLF89bnVsbCksaT10LHg9cCkpO3JldHVybiBudWxsIT09XyYmZy5wdXNoKEVpKHtzdGFydDpfLGVuZDpkLGxvb3A6dSxjb3VudDphLHN0eWxlOmZ9KSksZ31mdW5jdGlvbiBJaSh0LGUpe2NvbnN0IGk9W10scz10LnNlZ21lbnRzO2ZvcihsZXQgbj0wO248cy5sZW5ndGg7bisrKXtjb25zdCBvPVJpKHNbbl0sdC5wb2ludHMsZSk7by5sZW5ndGgmJmkucHVzaCguLi5vKX1yZXR1cm4gaX1mdW5jdGlvbiB6aSh0LGUpe2NvbnN0IGk9dC5wb2ludHMscz10Lm9wdGlvbnMuc3BhbkdhcHMsbj1pLmxlbmd0aDtpZighbilyZXR1cm5bXTtjb25zdCBvPSEhdC5fbG9vcCx7c3RhcnQ6YSxlbmQ6cn09ZnVuY3Rpb24odCxlLGkscyl7bGV0IG49MCxvPWUtMTtpZihpJiYhcylmb3IoO248ZSYmIXRbbl0uc2tpcDspbisrO2Zvcig7bjxlJiZ0W25dLnNraXA7KW4rKztmb3IobiU9ZSxpJiYobys9bik7bz5uJiZ0W28lZV0uc2tpcDspby0tO3JldHVybiBvJT1lLHtzdGFydDpuLGVuZDpvfX0oaSxuLG8scyk7aWYoITA9PT1zKXJldHVybiBGaSh0LFt7c3RhcnQ6YSxlbmQ6cixsb29wOm99XSxpLGUpO3JldHVybiBGaSh0LGZ1bmN0aW9uKHQsZSxpLHMpe2NvbnN0IG49dC5sZW5ndGgsbz1bXTtsZXQgYSxyPWUsbD10W2VdO2ZvcihhPWUrMTthPD1pOysrYSl7Y29uc3QgaT10W2Elbl07aS5za2lwfHxpLnN0b3A/bC5za2lwfHwocz0hMSxvLnB1c2goe3N0YXJ0OmUlbixlbmQ6KGEtMSklbixsb29wOnN9KSxlPXI9aS5zdG9wP2E6bnVsbCk6KHI9YSxsLnNraXAmJihlPWEpKSxsPWl9cmV0dXJuIG51bGwhPT1yJiZvLnB1c2goe3N0YXJ0OmUlbixlbmQ6ciVuLGxvb3A6c30pLG99KGksYSxyPGE/cituOnIsISF0Ll9mdWxsTG9vcCYmMD09PWEmJnI9PT1uLTEpLGksZSl9ZnVuY3Rpb24gRmkodCxlLGkscyl7cmV0dXJuIHMmJnMuc2V0Q29udGV4dCYmaT9mdW5jdGlvbih0LGUsaSxzKXtjb25zdCBuPXQuX2NoYXJ0LmdldENvbnRleHQoKSxvPVZpKHQub3B0aW9ucykse19kYXRhc2V0SW5kZXg6YSxvcHRpb25zOntzcGFuR2FwczpyfX09dCxsPWkubGVuZ3RoLGg9W107bGV0IGM9byxkPWVbMF0uc3RhcnQsdT1kO2Z1bmN0aW9uIGYodCxlLHMsbil7Y29uc3Qgbz1yPy0xOjE7aWYodCE9PWUpe2Zvcih0Kz1sO2lbdCVsXS5za2lwOyl0LT1vO2Zvcig7aVtlJWxdLnNraXA7KWUrPW87dCVsIT1lJWwmJihoLnB1c2goe3N0YXJ0OnQlbCxlbmQ6ZSVsLGxvb3A6cyxzdHlsZTpufSksYz1uLGQ9ZSVsKX19Zm9yKGNvbnN0IHQgb2YgZSl7ZD1yP2Q6dC5zdGFydDtsZXQgZSxvPWlbZCVsXTtmb3IodT1kKzE7dTw9dC5lbmQ7dSsrKXtjb25zdCByPWlbdSVsXTtlPVZpKHMuc2V0Q29udGV4dChDaShuLHt0eXBlOiJzZWdtZW50IixwMDpvLHAxOnIscDBEYXRhSW5kZXg6KHUtMSklbCxwMURhdGFJbmRleDp1JWwsZGF0YXNldEluZGV4OmF9KSkpLEJpKGUsYykmJmYoZCx1LTEsdC5sb29wLGMpLG89cixjPWV9ZDx1LTEmJmYoZCx1LTEsdC5sb29wLGMpfXJldHVybiBofSh0LGUsaSxzKTplfWZ1bmN0aW9uIFZpKHQpe3JldHVybntiYWNrZ3JvdW5kQ29sb3I6dC5iYWNrZ3JvdW5kQ29sb3IsYm9yZGVyQ2FwU3R5bGU6dC5ib3JkZXJDYXBTdHlsZSxib3JkZXJEYXNoOnQuYm9yZGVyRGFzaCxib3JkZXJEYXNoT2Zmc2V0OnQuYm9yZGVyRGFzaE9mZnNldCxib3JkZXJKb2luU3R5bGU6dC5ib3JkZXJKb2luU3R5bGUsYm9yZGVyV2lkdGg6dC5ib3JkZXJXaWR0aCxib3JkZXJDb2xvcjp0LmJvcmRlckNvbG9yfX1mdW5jdGlvbiBCaSh0LGUpe2lmKCFlKXJldHVybiExO2NvbnN0IGk9W10scz1mdW5jdGlvbih0LGUpe3JldHVybiBadChlKT8oaS5pbmNsdWRlcyhlKXx8aS5wdXNoKGUpLGkuaW5kZXhPZihlKSk6ZX07cmV0dXJuIEpTT04uc3RyaW5naWZ5KHQscykhPT1KU09OLnN0cmluZ2lmeShlLHMpfWZ1bmN0aW9uIFdpKHQsZSxpKXtyZXR1cm4gdC5vcHRpb25zLmNsaXA/dFtpXTplW2ldfWZ1bmN0aW9uIE5pKHQsZSl7Y29uc3QgaT1lLl9jbGlwO2lmKGkuZGlzYWJsZWQpcmV0dXJuITE7Y29uc3Qgcz1mdW5jdGlvbih0LGUpe2NvbnN0e3hTY2FsZTppLHlTY2FsZTpzfT10O3JldHVybiBpJiZzP3tsZWZ0OldpKGksZSwibGVmdCIpLHJpZ2h0OldpKGksZSwicmlnaHQiKSx0b3A6V2kocyxlLCJ0b3AiKSxib3R0b206V2kocyxlLCJib3R0b20iKX06ZX0oZSx0LmNoYXJ0QXJlYSk7cmV0dXJue2xlZnQ6ITE9PT1pLmxlZnQ/MDpzLmxlZnQtKCEwPT09aS5sZWZ0PzA6aS5sZWZ0KSxyaWdodDohMT09PWkucmlnaHQ/dC53aWR0aDpzLnJpZ2h0KyghMD09PWkucmlnaHQ/MDppLnJpZ2h0KSx0b3A6ITE9PT1pLnRvcD8wOnMudG9wLSghMD09PWkudG9wPzA6aS50b3ApLGJvdHRvbTohMT09PWkuYm90dG9tP3QuaGVpZ2h0OnMuYm90dG9tKyghMD09PWkuYm90dG9tPzA6aS5ib3R0b20pfX12YXIgSGk9T2JqZWN0LmZyZWV6ZSh7X19wcm90b19fOm51bGwsSEFMRl9QSTpFLElORklOSVRZOlQsUEk6QyxQSVRBVTpBLFFVQVJURVJfUEk6UixSQURfUEVSX0RFRzpMLFRBVTpPLFRXT19USElSRFNfUEk6SSxfYWRkR3JhY2U6RGksX2FsaWduUGl4ZWw6QWUsX2FsaWduU3RhcnRFbmQ6ZnQsX2FuZ2xlQmV0d2VlbjpKLF9hbmdsZURpZmY6SyxfYXJyYXlVbmlxdWU6bHQsX2F0dGFjaENvbnRleHQ6JGUsX2JlemllckN1cnZlVG86VmUsX2JlemllckludGVycG9sYXRpb246bWksX2JvdW5kU2VnbWVudDpSaSxfYm91bmRTZWdtZW50czpJaSxfY2FwaXRhbGl6ZTp3LF9jb21wdXRlU2VnbWVudHM6emksX2NyZWF0ZVJlc29sdmVyOmplLF9kZWNpbWFsUGxhY2VzOlUsX2RlcHJlY2F0ZWQ6ZnVuY3Rpb24odCxlLGkscyl7dm9pZCAwIT09ZSYmY29uc29sZS53YXJuKHQrJzogIicraSsnIiBpcyBkZXByZWNhdGVkLiBQbGVhc2UgdXNlICInK3MrJyIgaW5zdGVhZCcpfSxfZGVzY3JpcHRvcnM6WWUsX2VsZW1lbnRzRXF1YWw6ZixfZmFjdG9yaXplOlcsX2ZpbHRlckJldHdlZW46bnQsX2dldFBhcmVudE5vZGU6Z2UsX2dldFN0YXJ0QW5kQ291bnRPZlZpc2libGVQb2ludHM6cHQsX2ludDE2UmFuZ2U6USxfaXNCZXR3ZWVuOnR0LF9pc0NsaWNrRXZlbnQ6RCxfaXNEb21TdXBwb3J0ZWQ6ZmUsX2lzUG9pbnRJbkFyZWE6UmUsX2xpbWl0VmFsdWU6WixfbG9uZ2VzdFRleHQ6T2UsX2xvb2t1cDpldCxfbG9va3VwQnlLZXk6aXQsX21lYXN1cmVUZXh0OkNlLF9tZXJnZXI6bSxfbWVyZ2VySWY6Xyxfbm9ybWFsaXplQW5nbGU6RyxfcGFyc2VPYmplY3REYXRhUmFkaWFsU2NhbGU6aWksX3BvaW50SW5MaW5lOmdpLF9yZWFkVmFsdWVUb1Byb3BzOnZpLF9ybG9va3VwQnlLZXk6c3QsX3NjYWxlUmFuZ2VzQ2hhbmdlZDptdCxfc2V0TWluQW5kTWF4QnlLZXk6aixfc3BsaXRLZXk6dixfc3RlcHBlZEludGVycG9sYXRpb246cGksX3N0ZXBwZWRMaW5lVG86RmUsX3RleHRYOmd0LF90b0xlZnRSaWdodENlbnRlcjp1dCxfdXBkYXRlQmV6aWVyQ29udHJvbFBvaW50czpoaSxhZGRSb3VuZGVkUmVjdFBhdGg6SGUsYWxtb3N0RXF1YWxzOlYsYWxtb3N0V2hvbGU6SCxjYWxsYmFjazpkLGNsZWFyQ2FudmFzOlRlLGNsaXBBcmVhOkllLGNsb25lOmcsY29sb3I6UXQsY3JlYXRlQ29udGV4dDpDaSxkZWJvdW5jZTpkdCxkZWZpbmVkOmssZGlzdGFuY2VCZXR3ZWVuUG9pbnRzOnEsZHJhd1BvaW50OkxlLGRyYXdQb2ludExlZ2VuZDpFZSxlYWNoOnUsZWFzaW5nRWZmZWN0czpmaSxmaW5pdGVPckRlZmF1bHQ6cixmb250U3RyaW5nOmZ1bmN0aW9uKHQsZSxpKXtyZXR1cm4gZSsiICIrdCsicHggIitpfSxmb3JtYXROdW1iZXI6bmUsZ2V0QW5nbGVGcm9tUG9pbnQ6WCxnZXREYXRhc2V0Q2xpcEFyZWE6TmksZ2V0SG92ZXJDb2xvcjp0ZSxnZXRNYXhpbXVtU2l6ZTp3ZSxnZXRSZWxhdGl2ZVBvc2l0aW9uOnZlLGdldFJ0bEFkYXB0ZXI6T2ksZ2V0U3R5bGU6eGUsaXNBcnJheTpuLGlzRmluaXRlOmEsaXNGdW5jdGlvbjpTLGlzTnVsbE9yVW5kZWY6cyxpc051bWJlcjpOLGlzT2JqZWN0Om8saXNQYXR0ZXJuT3JHcmFkaWVudDpadCxsaXN0ZW5BcnJheUV2ZW50czphdCxsb2cxMDp6LG1lcmdlOngsbWVyZ2VJZjpiLG5pY2VOdW06Qixub29wOmUsb3ZlcnJpZGVUZXh0RGlyZWN0aW9uOkFpLHJlYWRVc2VkU2l6ZTpQZSxyZW5kZXJUZXh0Ok5lLHJlcXVlc3RBbmltRnJhbWU6aHQscmVzb2x2ZTpQaSxyZXNvbHZlT2JqZWN0S2V5Ok0scmVzdG9yZVRleHREaXJlY3Rpb246VGkscmV0aW5hU2NhbGU6a2Usc2V0c0VxdWFsOlAsc2lnbjpGLHNwbGluZUN1cnZlOmFpLHNwbGluZUN1cnZlTW9ub3RvbmU6cmksc3VwcG9ydHNFdmVudExpc3RlbmVyT3B0aW9uczpTZSx0aHJvdHRsZWQ6Y3QsdG9EZWdyZWVzOlksdG9EaW1lbnNpb246Yyx0b0ZvbnQ6U2ksdG9Gb250U3RyaW5nOkRlLHRvTGluZUhlaWdodDpfaSx0b1BhZGRpbmc6a2ksdG9QZXJjZW50YWdlOmgsdG9SYWRpYW5zOiQsdG9UUkJMOk1pLHRvVFJCTENvcm5lcnM6d2ksdWlkOmksdW5jbGlwQXJlYTp6ZSx1bmxpc3RlbkFycmF5RXZlbnRzOnJ0LHZhbHVlT3JEZWZhdWx0Omx9KTtmdW5jdGlvbiBqaSh0LGUsaSxuKXtjb25zdHtjb250cm9sbGVyOm8sZGF0YTphLF9zb3J0ZWQ6cn09dCxsPW8uX2NhY2hlZE1ldGEuaVNjYWxlLGg9dC5kYXRhc2V0JiZ0LmRhdGFzZXQub3B0aW9ucz90LmRhdGFzZXQub3B0aW9ucy5zcGFuR2FwczpudWxsO2lmKGwmJmU9PT1sLmF4aXMmJiJyIiE9PWUmJnImJmEubGVuZ3RoKXtjb25zdCByPWwuX3JldmVyc2VQaXhlbHM/c3Q6aXQ7aWYoIW4pe2NvbnN0IG49cihhLGUsaSk7aWYoaCl7Y29uc3R7dlNjYWxlOmV9PW8uX2NhY2hlZE1ldGEse19wYXJzZWQ6aX09dCxhPWkuc2xpY2UoMCxuLmxvKzEpLnJldmVyc2UoKS5maW5kSW5kZXgoKHQ9PiFzKHRbZS5heGlzXSkpKTtuLmxvLT1NYXRoLm1heCgwLGEpO2NvbnN0IHI9aS5zbGljZShuLmhpKS5maW5kSW5kZXgoKHQ9PiFzKHRbZS5heGlzXSkpKTtuLmhpKz1NYXRoLm1heCgwLHIpfXJldHVybiBufWlmKG8uX3NoYXJlZE9wdGlvbnMpe2NvbnN0IHQ9YVswXSxzPSJmdW5jdGlvbiI9PXR5cGVvZiB0LmdldFJhbmdlJiZ0LmdldFJhbmdlKGUpO2lmKHMpe2NvbnN0IHQ9cihhLGUsaS1zKSxuPXIoYSxlLGkrcyk7cmV0dXJue2xvOnQubG8saGk6bi5oaX19fX1yZXR1cm57bG86MCxoaTphLmxlbmd0aC0xfX1mdW5jdGlvbiAkaSh0LGUsaSxzLG4pe2NvbnN0IG89dC5nZXRTb3J0ZWRWaXNpYmxlRGF0YXNldE1ldGFzKCksYT1pW2VdO2ZvcihsZXQgdD0wLGk9by5sZW5ndGg7dDxpOysrdCl7Y29uc3R7aW5kZXg6aSxkYXRhOnJ9PW9bdF0se2xvOmwsaGk6aH09amkob1t0XSxlLGEsbik7Zm9yKGxldCB0PWw7dDw9aDsrK3Qpe2NvbnN0IGU9clt0XTtlLnNraXB8fHMoZSxpLHQpfX19ZnVuY3Rpb24gWWkodCxlLGkscyxuKXtjb25zdCBvPVtdO2lmKCFuJiYhdC5pc1BvaW50SW5BcmVhKGUpKXJldHVybiBvO3JldHVybiAkaSh0LGksZSwoZnVuY3Rpb24oaSxhLHIpeyhufHxSZShpLHQuY2hhcnRBcmVhLDApKSYmaS5pblJhbmdlKGUueCxlLnkscykmJm8ucHVzaCh7ZWxlbWVudDppLGRhdGFzZXRJbmRleDphLGluZGV4OnJ9KX0pLCEwKSxvfWZ1bmN0aW9uIFVpKHQsZSxpLHMsbixvKXtsZXQgYT1bXTtjb25zdCByPWZ1bmN0aW9uKHQpe2NvbnN0IGU9LTEhPT10LmluZGV4T2YoIngiKSxpPS0xIT09dC5pbmRleE9mKCJ5Iik7cmV0dXJuIGZ1bmN0aW9uKHQscyl7Y29uc3Qgbj1lP01hdGguYWJzKHQueC1zLngpOjAsbz1pP01hdGguYWJzKHQueS1zLnkpOjA7cmV0dXJuIE1hdGguc3FydChNYXRoLnBvdyhuLDIpK01hdGgucG93KG8sMikpfX0oaSk7bGV0IGw9TnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO3JldHVybiAkaSh0LGksZSwoZnVuY3Rpb24oaSxoLGMpe2NvbnN0IGQ9aS5pblJhbmdlKGUueCxlLnksbik7aWYocyYmIWQpcmV0dXJuO2NvbnN0IHU9aS5nZXRDZW50ZXJQb2ludChuKTtpZighKCEhb3x8dC5pc1BvaW50SW5BcmVhKHUpKSYmIWQpcmV0dXJuO2NvbnN0IGY9cihlLHUpO2Y8bD8oYT1be2VsZW1lbnQ6aSxkYXRhc2V0SW5kZXg6aCxpbmRleDpjfV0sbD1mKTpmPT09bCYmYS5wdXNoKHtlbGVtZW50OmksZGF0YXNldEluZGV4OmgsaW5kZXg6Y30pfSkpLGF9ZnVuY3Rpb24gWGkodCxlLGkscyxuLG8pe3JldHVybiBvfHx0LmlzUG9pbnRJbkFyZWEoZSk/InIiIT09aXx8cz9VaSh0LGUsaSxzLG4sbyk6ZnVuY3Rpb24odCxlLGkscyl7bGV0IG49W107cmV0dXJuICRpKHQsaSxlLChmdW5jdGlvbih0LGksbyl7Y29uc3R7c3RhcnRBbmdsZTphLGVuZEFuZ2xlOnJ9PXQuZ2V0UHJvcHMoWyJzdGFydEFuZ2xlIiwiZW5kQW5nbGUiXSxzKSx7YW5nbGU6bH09WCh0LHt4OmUueCx5OmUueX0pO0oobCxhLHIpJiZuLnB1c2goe2VsZW1lbnQ6dCxkYXRhc2V0SW5kZXg6aSxpbmRleDpvfSl9KSksbn0odCxlLGksbik6W119ZnVuY3Rpb24gcWkodCxlLGkscyxuKXtjb25zdCBvPVtdLGE9IngiPT09aT8iaW5YUmFuZ2UiOiJpbllSYW5nZSI7bGV0IHI9ITE7cmV0dXJuICRpKHQsaSxlLCgodCxzLGwpPT57dFthXSYmdFthXShlW2ldLG4pJiYoby5wdXNoKHtlbGVtZW50OnQsZGF0YXNldEluZGV4OnMsaW5kZXg6bH0pLHI9cnx8dC5pblJhbmdlKGUueCxlLnksbikpfSkpLHMmJiFyP1tdOm99dmFyIEtpPXtldmFsdWF0ZUludGVyYWN0aW9uSXRlbXM6JGksbW9kZXM6e2luZGV4KHQsZSxpLHMpe2NvbnN0IG49dmUoZSx0KSxvPWkuYXhpc3x8IngiLGE9aS5pbmNsdWRlSW52aXNpYmxlfHwhMSxyPWkuaW50ZXJzZWN0P1lpKHQsbixvLHMsYSk6WGkodCxuLG8sITEscyxhKSxsPVtdO3JldHVybiByLmxlbmd0aD8odC5nZXRTb3J0ZWRWaXNpYmxlRGF0YXNldE1ldGFzKCkuZm9yRWFjaCgodD0+e2NvbnN0IGU9clswXS5pbmRleCxpPXQuZGF0YVtlXTtpJiYhaS5za2lwJiZsLnB1c2goe2VsZW1lbnQ6aSxkYXRhc2V0SW5kZXg6dC5pbmRleCxpbmRleDplfSl9KSksbCk6W119LGRhdGFzZXQodCxlLGkscyl7Y29uc3Qgbj12ZShlLHQpLG89aS5heGlzfHwieHkiLGE9aS5pbmNsdWRlSW52aXNpYmxlfHwhMTtsZXQgcj1pLmludGVyc2VjdD9ZaSh0LG4sbyxzLGEpOlhpKHQsbixvLCExLHMsYSk7aWYoci5sZW5ndGg+MCl7Y29uc3QgZT1yWzBdLmRhdGFzZXRJbmRleCxpPXQuZ2V0RGF0YXNldE1ldGEoZSkuZGF0YTtyPVtdO2ZvcihsZXQgdD0wO3Q8aS5sZW5ndGg7Kyt0KXIucHVzaCh7ZWxlbWVudDppW3RdLGRhdGFzZXRJbmRleDplLGluZGV4OnR9KX1yZXR1cm4gcn0scG9pbnQ6KHQsZSxpLHMpPT5ZaSh0LHZlKGUsdCksaS5heGlzfHwieHkiLHMsaS5pbmNsdWRlSW52aXNpYmxlfHwhMSksbmVhcmVzdCh0LGUsaSxzKXtjb25zdCBuPXZlKGUsdCksbz1pLmF4aXN8fCJ4eSIsYT1pLmluY2x1ZGVJbnZpc2libGV8fCExO3JldHVybiBYaSh0LG4sbyxpLmludGVyc2VjdCxzLGEpfSx4Oih0LGUsaSxzKT0+cWkodCx2ZShlLHQpLCJ4IixpLmludGVyc2VjdCxzKSx5Oih0LGUsaSxzKT0+cWkodCx2ZShlLHQpLCJ5IixpLmludGVyc2VjdCxzKX19O2NvbnN0IEdpPVsibGVmdCIsInRvcCIsInJpZ2h0IiwiYm90dG9tIl07ZnVuY3Rpb24gSmkodCxlKXtyZXR1cm4gdC5maWx0ZXIoKHQ9PnQucG9zPT09ZSkpfWZ1bmN0aW9uIFppKHQsZSl7cmV0dXJuIHQuZmlsdGVyKCh0PT4tMT09PUdpLmluZGV4T2YodC5wb3MpJiZ0LmJveC5heGlzPT09ZSkpfWZ1bmN0aW9uIFFpKHQsZSl7cmV0dXJuIHQuc29ydCgoKHQsaSk9Pntjb25zdCBzPWU/aTp0LG49ZT90Omk7cmV0dXJuIHMud2VpZ2h0PT09bi53ZWlnaHQ/cy5pbmRleC1uLmluZGV4OnMud2VpZ2h0LW4ud2VpZ2h0fSkpfWZ1bmN0aW9uIHRzKHQsZSl7Y29uc3QgaT1mdW5jdGlvbih0KXtjb25zdCBlPXt9O2Zvcihjb25zdCBpIG9mIHQpe2NvbnN0e3N0YWNrOnQscG9zOnMsc3RhY2tXZWlnaHQ6bn09aTtpZighdHx8IUdpLmluY2x1ZGVzKHMpKWNvbnRpbnVlO2NvbnN0IG89ZVt0XXx8KGVbdF09e2NvdW50OjAscGxhY2VkOjAsd2VpZ2h0OjAsc2l6ZTowfSk7by5jb3VudCsrLG8ud2VpZ2h0Kz1ufXJldHVybiBlfSh0KSx7dkJveE1heFdpZHRoOnMsaEJveE1heEhlaWdodDpufT1lO2xldCBvLGEscjtmb3Iobz0wLGE9dC5sZW5ndGg7bzxhOysrbyl7cj10W29dO2NvbnN0e2Z1bGxTaXplOmF9PXIuYm94LGw9aVtyLnN0YWNrXSxoPWwmJnIuc3RhY2tXZWlnaHQvbC53ZWlnaHQ7ci5ob3Jpem9udGFsPyhyLndpZHRoPWg/aCpzOmEmJmUuYXZhaWxhYmxlV2lkdGgsci5oZWlnaHQ9bik6KHIud2lkdGg9cyxyLmhlaWdodD1oP2gqbjphJiZlLmF2YWlsYWJsZUhlaWdodCl9cmV0dXJuIGl9ZnVuY3Rpb24gZXModCxlLGkscyl7cmV0dXJuIE1hdGgubWF4KHRbaV0sZVtpXSkrTWF0aC5tYXgodFtzXSxlW3NdKX1mdW5jdGlvbiBpcyh0LGUpe3QudG9wPU1hdGgubWF4KHQudG9wLGUudG9wKSx0LmxlZnQ9TWF0aC5tYXgodC5sZWZ0LGUubGVmdCksdC5ib3R0b209TWF0aC5tYXgodC5ib3R0b20sZS5ib3R0b20pLHQucmlnaHQ9TWF0aC5tYXgodC5yaWdodCxlLnJpZ2h0KX1mdW5jdGlvbiBzcyh0LGUsaSxzKXtjb25zdHtwb3M6bixib3g6YX09aSxyPXQubWF4UGFkZGluZztpZighbyhuKSl7aS5zaXplJiYodFtuXS09aS5zaXplKTtjb25zdCBlPXNbaS5zdGFja118fHtzaXplOjAsY291bnQ6MX07ZS5zaXplPU1hdGgubWF4KGUuc2l6ZSxpLmhvcml6b250YWw/YS5oZWlnaHQ6YS53aWR0aCksaS5zaXplPWUuc2l6ZS9lLmNvdW50LHRbbl0rPWkuc2l6ZX1hLmdldFBhZGRpbmcmJmlzKHIsYS5nZXRQYWRkaW5nKCkpO2NvbnN0IGw9TWF0aC5tYXgoMCxlLm91dGVyV2lkdGgtZXMocix0LCJsZWZ0IiwicmlnaHQiKSksaD1NYXRoLm1heCgwLGUub3V0ZXJIZWlnaHQtZXMocix0LCJ0b3AiLCJib3R0b20iKSksYz1sIT09dC53LGQ9aCE9PXQuaDtyZXR1cm4gdC53PWwsdC5oPWgsaS5ob3Jpem9udGFsP3tzYW1lOmMsb3RoZXI6ZH06e3NhbWU6ZCxvdGhlcjpjfX1mdW5jdGlvbiBucyh0LGUpe2NvbnN0IGk9ZS5tYXhQYWRkaW5nO2Z1bmN0aW9uIHModCl7Y29uc3Qgcz17bGVmdDowLHRvcDowLHJpZ2h0OjAsYm90dG9tOjB9O3JldHVybiB0LmZvckVhY2goKHQ9PntzW3RdPU1hdGgubWF4KGVbdF0saVt0XSl9KSksc31yZXR1cm4gcyh0P1sibGVmdCIsInJpZ2h0Il06WyJ0b3AiLCJib3R0b20iXSl9ZnVuY3Rpb24gb3ModCxlLGkscyl7Y29uc3Qgbj1bXTtsZXQgbyxhLHIsbCxoLGM7Zm9yKG89MCxhPXQubGVuZ3RoLGg9MDtvPGE7KytvKXtyPXRbb10sbD1yLmJveCxsLnVwZGF0ZShyLndpZHRofHxlLncsci5oZWlnaHR8fGUuaCxucyhyLmhvcml6b250YWwsZSkpO2NvbnN0e3NhbWU6YSxvdGhlcjpkfT1zcyhlLGkscixzKTtofD1hJiZuLmxlbmd0aCxjPWN8fGQsbC5mdWxsU2l6ZXx8bi5wdXNoKHIpfXJldHVybiBoJiZvcyhuLGUsaSxzKXx8Y31mdW5jdGlvbiBhcyh0LGUsaSxzLG4pe3QudG9wPWksdC5sZWZ0PWUsdC5yaWdodD1lK3MsdC5ib3R0b209aStuLHQud2lkdGg9cyx0LmhlaWdodD1ufWZ1bmN0aW9uIHJzKHQsZSxpLHMpe2NvbnN0IG49aS5wYWRkaW5nO2xldHt4Om8seTphfT1lO2Zvcihjb25zdCByIG9mIHQpe2NvbnN0IHQ9ci5ib3gsbD1zW3Iuc3RhY2tdfHx7Y291bnQ6MSxwbGFjZWQ6MCx3ZWlnaHQ6MX0saD1yLnN0YWNrV2VpZ2h0L2wud2VpZ2h0fHwxO2lmKHIuaG9yaXpvbnRhbCl7Y29uc3Qgcz1lLncqaCxvPWwuc2l6ZXx8dC5oZWlnaHQ7ayhsLnN0YXJ0KSYmKGE9bC5zdGFydCksdC5mdWxsU2l6ZT9hcyh0LG4ubGVmdCxhLGkub3V0ZXJXaWR0aC1uLnJpZ2h0LW4ubGVmdCxvKTphcyh0LGUubGVmdCtsLnBsYWNlZCxhLHMsbyksbC5zdGFydD1hLGwucGxhY2VkKz1zLGE9dC5ib3R0b219ZWxzZXtjb25zdCBzPWUuaCpoLGE9bC5zaXplfHx0LndpZHRoO2sobC5zdGFydCkmJihvPWwuc3RhcnQpLHQuZnVsbFNpemU/YXModCxvLG4udG9wLGEsaS5vdXRlckhlaWdodC1uLmJvdHRvbS1uLnRvcCk6YXModCxvLGUudG9wK2wucGxhY2VkLGEscyksbC5zdGFydD1vLGwucGxhY2VkKz1zLG89dC5yaWdodH19ZS54PW8sZS55PWF9dmFyIGxzPXthZGRCb3godCxlKXt0LmJveGVzfHwodC5ib3hlcz1bXSksZS5mdWxsU2l6ZT1lLmZ1bGxTaXplfHwhMSxlLnBvc2l0aW9uPWUucG9zaXRpb258fCJ0b3AiLGUud2VpZ2h0PWUud2VpZ2h0fHwwLGUuX2xheWVycz1lLl9sYXllcnN8fGZ1bmN0aW9uKCl7cmV0dXJuW3t6OjAsZHJhdyh0KXtlLmRyYXcodCl9fV19LHQuYm94ZXMucHVzaChlKX0scmVtb3ZlQm94KHQsZSl7Y29uc3QgaT10LmJveGVzP3QuYm94ZXMuaW5kZXhPZihlKTotMTstMSE9PWkmJnQuYm94ZXMuc3BsaWNlKGksMSl9LGNvbmZpZ3VyZSh0LGUsaSl7ZS5mdWxsU2l6ZT1pLmZ1bGxTaXplLGUucG9zaXRpb249aS5wb3NpdGlvbixlLndlaWdodD1pLndlaWdodH0sdXBkYXRlKHQsZSxpLHMpe2lmKCF0KXJldHVybjtjb25zdCBuPWtpKHQub3B0aW9ucy5sYXlvdXQucGFkZGluZyksbz1NYXRoLm1heChlLW4ud2lkdGgsMCksYT1NYXRoLm1heChpLW4uaGVpZ2h0LDApLHI9ZnVuY3Rpb24odCl7Y29uc3QgZT1mdW5jdGlvbih0KXtjb25zdCBlPVtdO2xldCBpLHMsbixvLGEscjtmb3IoaT0wLHM9KHR8fFtdKS5sZW5ndGg7aTxzOysraSluPXRbaV0sKHtwb3NpdGlvbjpvLG9wdGlvbnM6e3N0YWNrOmEsc3RhY2tXZWlnaHQ6cj0xfX09biksZS5wdXNoKHtpbmRleDppLGJveDpuLHBvczpvLGhvcml6b250YWw6bi5pc0hvcml6b250YWwoKSx3ZWlnaHQ6bi53ZWlnaHQsc3RhY2s6YSYmbythLHN0YWNrV2VpZ2h0OnJ9KTtyZXR1cm4gZX0odCksaT1RaShlLmZpbHRlcigodD0+dC5ib3guZnVsbFNpemUpKSwhMCkscz1RaShKaShlLCJsZWZ0IiksITApLG49UWkoSmkoZSwicmlnaHQiKSksbz1RaShKaShlLCJ0b3AiKSwhMCksYT1RaShKaShlLCJib3R0b20iKSkscj1aaShlLCJ4IiksbD1aaShlLCJ5Iik7cmV0dXJue2Z1bGxTaXplOmksbGVmdEFuZFRvcDpzLmNvbmNhdChvKSxyaWdodEFuZEJvdHRvbTpuLmNvbmNhdChsKS5jb25jYXQoYSkuY29uY2F0KHIpLGNoYXJ0QXJlYTpKaShlLCJjaGFydEFyZWEiKSx2ZXJ0aWNhbDpzLmNvbmNhdChuKS5jb25jYXQobCksaG9yaXpvbnRhbDpvLmNvbmNhdChhKS5jb25jYXQocil9fSh0LmJveGVzKSxsPXIudmVydGljYWwsaD1yLmhvcml6b250YWw7dSh0LmJveGVzLCh0PT57ImZ1bmN0aW9uIj09dHlwZW9mIHQuYmVmb3JlTGF5b3V0JiZ0LmJlZm9yZUxheW91dCgpfSkpO2NvbnN0IGM9bC5yZWR1Y2UoKCh0LGUpPT5lLmJveC5vcHRpb25zJiYhMT09PWUuYm94Lm9wdGlvbnMuZGlzcGxheT90OnQrMSksMCl8fDEsZD1PYmplY3QuZnJlZXplKHtvdXRlcldpZHRoOmUsb3V0ZXJIZWlnaHQ6aSxwYWRkaW5nOm4sYXZhaWxhYmxlV2lkdGg6byxhdmFpbGFibGVIZWlnaHQ6YSx2Qm94TWF4V2lkdGg6by8yL2MsaEJveE1heEhlaWdodDphLzJ9KSxmPU9iamVjdC5hc3NpZ24oe30sbik7aXMoZixraShzKSk7Y29uc3QgZz1PYmplY3QuYXNzaWduKHttYXhQYWRkaW5nOmYsdzpvLGg6YSx4Om4ubGVmdCx5Om4udG9wfSxuKSxwPXRzKGwuY29uY2F0KGgpLGQpO29zKHIuZnVsbFNpemUsZyxkLHApLG9zKGwsZyxkLHApLG9zKGgsZyxkLHApJiZvcyhsLGcsZCxwKSxmdW5jdGlvbih0KXtjb25zdCBlPXQubWF4UGFkZGluZztmdW5jdGlvbiBpKGkpe2NvbnN0IHM9TWF0aC5tYXgoZVtpXS10W2ldLDApO3JldHVybiB0W2ldKz1zLHN9dC55Kz1pKCJ0b3AiKSx0LngrPWkoImxlZnQiKSxpKCJyaWdodCIpLGkoImJvdHRvbSIpfShnKSxycyhyLmxlZnRBbmRUb3AsZyxkLHApLGcueCs9Zy53LGcueSs9Zy5oLHJzKHIucmlnaHRBbmRCb3R0b20sZyxkLHApLHQuY2hhcnRBcmVhPXtsZWZ0OmcubGVmdCx0b3A6Zy50b3AscmlnaHQ6Zy5sZWZ0K2cudyxib3R0b206Zy50b3ArZy5oLGhlaWdodDpnLmgsd2lkdGg6Zy53fSx1KHIuY2hhcnRBcmVhLChlPT57Y29uc3QgaT1lLmJveDtPYmplY3QuYXNzaWduKGksdC5jaGFydEFyZWEpLGkudXBkYXRlKGcudyxnLmgse2xlZnQ6MCx0b3A6MCxyaWdodDowLGJvdHRvbTowfSl9KSl9fTtjbGFzcyBoc3thY3F1aXJlQ29udGV4dCh0LGUpe31yZWxlYXNlQ29udGV4dCh0KXtyZXR1cm4hMX1hZGRFdmVudExpc3RlbmVyKHQsZSxpKXt9cmVtb3ZlRXZlbnRMaXN0ZW5lcih0LGUsaSl7fWdldERldmljZVBpeGVsUmF0aW8oKXtyZXR1cm4gMX1nZXRNYXhpbXVtU2l6ZSh0LGUsaSxzKXtyZXR1cm4gZT1NYXRoLm1heCgwLGV8fHQud2lkdGgpLGk9aXx8dC5oZWlnaHQse3dpZHRoOmUsaGVpZ2h0Ok1hdGgubWF4KDAscz9NYXRoLmZsb29yKGUvcyk6aSl9fWlzQXR0YWNoZWQodCl7cmV0dXJuITB9dXBkYXRlQ29uZmlnKHQpe319Y2xhc3MgY3MgZXh0ZW5kcyBoc3thY3F1aXJlQ29udGV4dCh0KXtyZXR1cm4gdCYmdC5nZXRDb250ZXh0JiZ0LmdldENvbnRleHQoIjJkIil8fG51bGx9dXBkYXRlQ29uZmlnKHQpe3Qub3B0aW9ucy5hbmltYXRpb249ITF9fWNvbnN0IGRzPSIkY2hhcnRqcyIsdXM9e3RvdWNoc3RhcnQ6Im1vdXNlZG93biIsdG91Y2htb3ZlOiJtb3VzZW1vdmUiLHRvdWNoZW5kOiJtb3VzZXVwIixwb2ludGVyZW50ZXI6Im1vdXNlZW50ZXIiLHBvaW50ZXJkb3duOiJtb3VzZWRvd24iLHBvaW50ZXJtb3ZlOiJtb3VzZW1vdmUiLHBvaW50ZXJ1cDoibW91c2V1cCIscG9pbnRlcmxlYXZlOiJtb3VzZW91dCIscG9pbnRlcm91dDoibW91c2VvdXQifSxmcz10PT5udWxsPT09dHx8IiI9PT10O2NvbnN0IGdzPSEhU2UmJntwYXNzaXZlOiEwfTtmdW5jdGlvbiBwcyh0LGUsaSl7dCYmdC5jYW52YXMmJnQuY2FudmFzLnJlbW92ZUV2ZW50TGlzdGVuZXIoZSxpLGdzKX1mdW5jdGlvbiBtcyh0LGUpe2Zvcihjb25zdCBpIG9mIHQpaWYoaT09PWV8fGkuY29udGFpbnMoZSkpcmV0dXJuITB9ZnVuY3Rpb24geHModCxlLGkpe2NvbnN0IHM9dC5jYW52YXMsbj1uZXcgTXV0YXRpb25PYnNlcnZlcigodD0+e2xldCBlPSExO2Zvcihjb25zdCBpIG9mIHQpZT1lfHxtcyhpLmFkZGVkTm9kZXMscyksZT1lJiYhbXMoaS5yZW1vdmVkTm9kZXMscyk7ZSYmaSgpfSkpO3JldHVybiBuLm9ic2VydmUoZG9jdW1lbnQse2NoaWxkTGlzdDohMCxzdWJ0cmVlOiEwfSksbn1mdW5jdGlvbiBicyh0LGUsaSl7Y29uc3Qgcz10LmNhbnZhcyxuPW5ldyBNdXRhdGlvbk9ic2VydmVyKCh0PT57bGV0IGU9ITE7Zm9yKGNvbnN0IGkgb2YgdCllPWV8fG1zKGkucmVtb3ZlZE5vZGVzLHMpLGU9ZSYmIW1zKGkuYWRkZWROb2RlcyxzKTtlJiZpKCl9KSk7cmV0dXJuIG4ub2JzZXJ2ZShkb2N1bWVudCx7Y2hpbGRMaXN0OiEwLHN1YnRyZWU6ITB9KSxufWNvbnN0IF9zPW5ldyBNYXA7bGV0IHlzPTA7ZnVuY3Rpb24gdnMoKXtjb25zdCB0PXdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvO3QhPT15cyYmKHlzPXQsX3MuZm9yRWFjaCgoKGUsaSk9PntpLmN1cnJlbnREZXZpY2VQaXhlbFJhdGlvIT09dCYmZSgpfSkpKX1mdW5jdGlvbiBNcyh0LGUsaSl7Y29uc3Qgcz10LmNhbnZhcyxuPXMmJmdlKHMpO2lmKCFuKXJldHVybjtjb25zdCBvPWN0KCgodCxlKT0+e2NvbnN0IHM9bi5jbGllbnRXaWR0aDtpKHQsZSksczxuLmNsaWVudFdpZHRoJiZpKCl9KSx3aW5kb3cpLGE9bmV3IFJlc2l6ZU9ic2VydmVyKCh0PT57Y29uc3QgZT10WzBdLGk9ZS5jb250ZW50UmVjdC53aWR0aCxzPWUuY29udGVudFJlY3QuaGVpZ2h0OzA9PT1pJiYwPT09c3x8byhpLHMpfSkpO3JldHVybiBhLm9ic2VydmUobiksZnVuY3Rpb24odCxlKXtfcy5zaXplfHx3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigicmVzaXplIix2cyksX3Muc2V0KHQsZSl9KHQsbyksYX1mdW5jdGlvbiB3cyh0LGUsaSl7aSYmaS5kaXNjb25uZWN0KCksInJlc2l6ZSI9PT1lJiZmdW5jdGlvbih0KXtfcy5kZWxldGUodCksX3Muc2l6ZXx8d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoInJlc2l6ZSIsdnMpfSh0KX1mdW5jdGlvbiBrcyh0LGUsaSl7Y29uc3Qgcz10LmNhbnZhcyxuPWN0KChlPT57bnVsbCE9PXQuY3R4JiZpKGZ1bmN0aW9uKHQsZSl7Y29uc3QgaT11c1t0LnR5cGVdfHx0LnR5cGUse3g6cyx5Om59PXZlKHQsZSk7cmV0dXJue3R5cGU6aSxjaGFydDplLG5hdGl2ZTp0LHg6dm9pZCAwIT09cz9zOm51bGwseTp2b2lkIDAhPT1uP246bnVsbH19KGUsdCkpfSksdCk7cmV0dXJuIGZ1bmN0aW9uKHQsZSxpKXt0JiZ0LmFkZEV2ZW50TGlzdGVuZXIoZSxpLGdzKX0ocyxlLG4pLG59Y2xhc3MgU3MgZXh0ZW5kcyBoc3thY3F1aXJlQ29udGV4dCh0LGUpe2NvbnN0IGk9dCYmdC5nZXRDb250ZXh0JiZ0LmdldENvbnRleHQoIjJkIik7cmV0dXJuIGkmJmkuY2FudmFzPT09dD8oZnVuY3Rpb24odCxlKXtjb25zdCBpPXQuc3R5bGUscz10LmdldEF0dHJpYnV0ZSgiaGVpZ2h0Iiksbj10LmdldEF0dHJpYnV0ZSgid2lkdGgiKTtpZih0W2RzXT17aW5pdGlhbDp7aGVpZ2h0OnMsd2lkdGg6bixzdHlsZTp7ZGlzcGxheTppLmRpc3BsYXksaGVpZ2h0OmkuaGVpZ2h0LHdpZHRoOmkud2lkdGh9fX0saS5kaXNwbGF5PWkuZGlzcGxheXx8ImJsb2NrIixpLmJveFNpemluZz1pLmJveFNpemluZ3x8ImJvcmRlci1ib3giLGZzKG4pKXtjb25zdCBlPVBlKHQsIndpZHRoIik7dm9pZCAwIT09ZSYmKHQud2lkdGg9ZSl9aWYoZnMocykpaWYoIiI9PT10LnN0eWxlLmhlaWdodCl0LmhlaWdodD10LndpZHRoLyhlfHwyKTtlbHNle2NvbnN0IGU9UGUodCwiaGVpZ2h0Iik7dm9pZCAwIT09ZSYmKHQuaGVpZ2h0PWUpfX0odCxlKSxpKTpudWxsfXJlbGVhc2VDb250ZXh0KHQpe2NvbnN0IGU9dC5jYW52YXM7aWYoIWVbZHNdKXJldHVybiExO2NvbnN0IGk9ZVtkc10uaW5pdGlhbDtbImhlaWdodCIsIndpZHRoIl0uZm9yRWFjaCgodD0+e2NvbnN0IG49aVt0XTtzKG4pP2UucmVtb3ZlQXR0cmlidXRlKHQpOmUuc2V0QXR0cmlidXRlKHQsbil9KSk7Y29uc3Qgbj1pLnN0eWxlfHx7fTtyZXR1cm4gT2JqZWN0LmtleXMobikuZm9yRWFjaCgodD0+e2Uuc3R5bGVbdF09blt0XX0pKSxlLndpZHRoPWUud2lkdGgsZGVsZXRlIGVbZHNdLCEwfWFkZEV2ZW50TGlzdGVuZXIodCxlLGkpe3RoaXMucmVtb3ZlRXZlbnRMaXN0ZW5lcih0LGUpO2NvbnN0IHM9dC4kcHJveGllc3x8KHQuJHByb3hpZXM9e30pLG49e2F0dGFjaDp4cyxkZXRhY2g6YnMscmVzaXplOk1zfVtlXXx8a3M7c1tlXT1uKHQsZSxpKX1yZW1vdmVFdmVudExpc3RlbmVyKHQsZSl7Y29uc3QgaT10LiRwcm94aWVzfHwodC4kcHJveGllcz17fSkscz1pW2VdO2lmKCFzKXJldHVybjsoe2F0dGFjaDp3cyxkZXRhY2g6d3MscmVzaXplOndzfVtlXXx8cHMpKHQsZSxzKSxpW2VdPXZvaWQgMH1nZXREZXZpY2VQaXhlbFJhdGlvKCl7cmV0dXJuIHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvfWdldE1heGltdW1TaXplKHQsZSxpLHMpe3JldHVybiB3ZSh0LGUsaSxzKX1pc0F0dGFjaGVkKHQpe2NvbnN0IGU9dCYmZ2UodCk7cmV0dXJuISghZXx8IWUuaXNDb25uZWN0ZWQpfX1mdW5jdGlvbiBQcyh0KXtyZXR1cm4hZmUoKXx8InVuZGVmaW5lZCIhPXR5cGVvZiBPZmZzY3JlZW5DYW52YXMmJnQgaW5zdGFuY2VvZiBPZmZzY3JlZW5DYW52YXM/Y3M6U3N9dmFyIERzPU9iamVjdC5mcmVlemUoe19fcHJvdG9fXzpudWxsLEJhc2VQbGF0Zm9ybTpocyxCYXNpY1BsYXRmb3JtOmNzLERvbVBsYXRmb3JtOlNzLF9kZXRlY3RQbGF0Zm9ybTpQc30pO2NvbnN0IENzPSJ0cmFuc3BhcmVudCIsT3M9e2Jvb2xlYW46KHQsZSxpKT0+aT4uNT9lOnQsY29sb3IodCxlLGkpe2NvbnN0IHM9UXQodHx8Q3MpLG49cy52YWxpZCYmUXQoZXx8Q3MpO3JldHVybiBuJiZuLnZhbGlkP24ubWl4KHMsaSkuaGV4U3RyaW5nKCk6ZX0sbnVtYmVyOih0LGUsaSk9PnQrKGUtdCkqaX07Y2xhc3MgQXN7Y29uc3RydWN0b3IodCxlLGkscyl7Y29uc3Qgbj1lW2ldO3M9UGkoW3QudG8scyxuLHQuZnJvbV0pO2NvbnN0IG89UGkoW3QuZnJvbSxuLHNdKTt0aGlzLl9hY3RpdmU9ITAsdGhpcy5fZm49dC5mbnx8T3NbdC50eXBlfHx0eXBlb2Ygb10sdGhpcy5fZWFzaW5nPWZpW3QuZWFzaW5nXXx8ZmkubGluZWFyLHRoaXMuX3N0YXJ0PU1hdGguZmxvb3IoRGF0ZS5ub3coKSsodC5kZWxheXx8MCkpLHRoaXMuX2R1cmF0aW9uPXRoaXMuX3RvdGFsPU1hdGguZmxvb3IodC5kdXJhdGlvbiksdGhpcy5fbG9vcD0hIXQubG9vcCx0aGlzLl90YXJnZXQ9ZSx0aGlzLl9wcm9wPWksdGhpcy5fZnJvbT1vLHRoaXMuX3RvPXMsdGhpcy5fcHJvbWlzZXM9dm9pZCAwfWFjdGl2ZSgpe3JldHVybiB0aGlzLl9hY3RpdmV9dXBkYXRlKHQsZSxpKXtpZih0aGlzLl9hY3RpdmUpe3RoaXMuX25vdGlmeSghMSk7Y29uc3Qgcz10aGlzLl90YXJnZXRbdGhpcy5fcHJvcF0sbj1pLXRoaXMuX3N0YXJ0LG89dGhpcy5fZHVyYXRpb24tbjt0aGlzLl9zdGFydD1pLHRoaXMuX2R1cmF0aW9uPU1hdGguZmxvb3IoTWF0aC5tYXgobyx0LmR1cmF0aW9uKSksdGhpcy5fdG90YWwrPW4sdGhpcy5fbG9vcD0hIXQubG9vcCx0aGlzLl90bz1QaShbdC50byxlLHMsdC5mcm9tXSksdGhpcy5fZnJvbT1QaShbdC5mcm9tLHMsZV0pfX1jYW5jZWwoKXt0aGlzLl9hY3RpdmUmJih0aGlzLnRpY2soRGF0ZS5ub3coKSksdGhpcy5fYWN0aXZlPSExLHRoaXMuX25vdGlmeSghMSkpfXRpY2sodCl7Y29uc3QgZT10LXRoaXMuX3N0YXJ0LGk9dGhpcy5fZHVyYXRpb24scz10aGlzLl9wcm9wLG49dGhpcy5fZnJvbSxvPXRoaXMuX2xvb3AsYT10aGlzLl90bztsZXQgcjtpZih0aGlzLl9hY3RpdmU9biE9PWEmJihvfHxlPGkpLCF0aGlzLl9hY3RpdmUpcmV0dXJuIHRoaXMuX3RhcmdldFtzXT1hLHZvaWQgdGhpcy5fbm90aWZ5KCEwKTtlPDA/dGhpcy5fdGFyZ2V0W3NdPW46KHI9ZS9pJTIscj1vJiZyPjE/Mi1yOnIscj10aGlzLl9lYXNpbmcoTWF0aC5taW4oMSxNYXRoLm1heCgwLHIpKSksdGhpcy5fdGFyZ2V0W3NdPXRoaXMuX2ZuKG4sYSxyKSl9d2FpdCgpe2NvbnN0IHQ9dGhpcy5fcHJvbWlzZXN8fCh0aGlzLl9wcm9taXNlcz1bXSk7cmV0dXJuIG5ldyBQcm9taXNlKCgoZSxpKT0+e3QucHVzaCh7cmVzOmUscmVqOml9KX0pKX1fbm90aWZ5KHQpe2NvbnN0IGU9dD8icmVzIjoicmVqIixpPXRoaXMuX3Byb21pc2VzfHxbXTtmb3IobGV0IHQ9MDt0PGkubGVuZ3RoO3QrKylpW3RdW2VdKCl9fWNsYXNzIFRze2NvbnN0cnVjdG9yKHQsZSl7dGhpcy5fY2hhcnQ9dCx0aGlzLl9wcm9wZXJ0aWVzPW5ldyBNYXAsdGhpcy5jb25maWd1cmUoZSl9Y29uZmlndXJlKHQpe2lmKCFvKHQpKXJldHVybjtjb25zdCBlPU9iamVjdC5rZXlzKHVlLmFuaW1hdGlvbiksaT10aGlzLl9wcm9wZXJ0aWVzO09iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHQpLmZvckVhY2goKHM9Pntjb25zdCBhPXRbc107aWYoIW8oYSkpcmV0dXJuO2NvbnN0IHI9e307Zm9yKGNvbnN0IHQgb2YgZSlyW3RdPWFbdF07KG4oYS5wcm9wZXJ0aWVzKSYmYS5wcm9wZXJ0aWVzfHxbc10pLmZvckVhY2goKHQ9Pnt0IT09cyYmaS5oYXModCl8fGkuc2V0KHQscil9KSl9KSl9X2FuaW1hdGVPcHRpb25zKHQsZSl7Y29uc3QgaT1lLm9wdGlvbnMscz1mdW5jdGlvbih0LGUpe2lmKCFlKXJldHVybjtsZXQgaT10Lm9wdGlvbnM7aWYoIWkpcmV0dXJuIHZvaWQodC5vcHRpb25zPWUpO2kuJHNoYXJlZCYmKHQub3B0aW9ucz1pPU9iamVjdC5hc3NpZ24oe30saSx7JHNoYXJlZDohMSwkYW5pbWF0aW9uczp7fX0pKTtyZXR1cm4gaX0odCxpKTtpZighcylyZXR1cm5bXTtjb25zdCBuPXRoaXMuX2NyZWF0ZUFuaW1hdGlvbnMocyxpKTtyZXR1cm4gaS4kc2hhcmVkJiZmdW5jdGlvbih0LGUpe2NvbnN0IGk9W10scz1PYmplY3Qua2V5cyhlKTtmb3IobGV0IGU9MDtlPHMubGVuZ3RoO2UrKyl7Y29uc3Qgbj10W3NbZV1dO24mJm4uYWN0aXZlKCkmJmkucHVzaChuLndhaXQoKSl9cmV0dXJuIFByb21pc2UuYWxsKGkpfSh0Lm9wdGlvbnMuJGFuaW1hdGlvbnMsaSkudGhlbigoKCk9Pnt0Lm9wdGlvbnM9aX0pLCgoKT0+e30pKSxufV9jcmVhdGVBbmltYXRpb25zKHQsZSl7Y29uc3QgaT10aGlzLl9wcm9wZXJ0aWVzLHM9W10sbj10LiRhbmltYXRpb25zfHwodC4kYW5pbWF0aW9ucz17fSksbz1PYmplY3Qua2V5cyhlKSxhPURhdGUubm93KCk7bGV0IHI7Zm9yKHI9by5sZW5ndGgtMTtyPj0wOy0tcil7Y29uc3QgbD1vW3JdO2lmKCIkIj09PWwuY2hhckF0KDApKWNvbnRpbnVlO2lmKCJvcHRpb25zIj09PWwpe3MucHVzaCguLi50aGlzLl9hbmltYXRlT3B0aW9ucyh0LGUpKTtjb250aW51ZX1jb25zdCBoPWVbbF07bGV0IGM9bltsXTtjb25zdCBkPWkuZ2V0KGwpO2lmKGMpe2lmKGQmJmMuYWN0aXZlKCkpe2MudXBkYXRlKGQsaCxhKTtjb250aW51ZX1jLmNhbmNlbCgpfWQmJmQuZHVyYXRpb24/KG5bbF09Yz1uZXcgQXMoZCx0LGwsaCkscy5wdXNoKGMpKTp0W2xdPWh9cmV0dXJuIHN9dXBkYXRlKHQsZSl7aWYoMD09PXRoaXMuX3Byb3BlcnRpZXMuc2l6ZSlyZXR1cm4gdm9pZCBPYmplY3QuYXNzaWduKHQsZSk7Y29uc3QgaT10aGlzLl9jcmVhdGVBbmltYXRpb25zKHQsZSk7cmV0dXJuIGkubGVuZ3RoPyhidC5hZGQodGhpcy5fY2hhcnQsaSksITApOnZvaWQgMH19ZnVuY3Rpb24gTHModCxlKXtjb25zdCBpPXQmJnQub3B0aW9uc3x8e30scz1pLnJldmVyc2Usbj12b2lkIDA9PT1pLm1pbj9lOjAsbz12b2lkIDA9PT1pLm1heD9lOjA7cmV0dXJue3N0YXJ0OnM/bzpuLGVuZDpzP246b319ZnVuY3Rpb24gRXModCxlKXtjb25zdCBpPVtdLHM9dC5fZ2V0U29ydGVkRGF0YXNldE1ldGFzKGUpO2xldCBuLG87Zm9yKG49MCxvPXMubGVuZ3RoO248bzsrK24paS5wdXNoKHNbbl0uaW5kZXgpO3JldHVybiBpfWZ1bmN0aW9uIFJzKHQsZSxpLHM9e30pe2NvbnN0IG49dC5rZXlzLG89InNpbmdsZSI9PT1zLm1vZGU7bGV0IHIsbCxoLGM7aWYobnVsbD09PWUpcmV0dXJuO2xldCBkPSExO2ZvcihyPTAsbD1uLmxlbmd0aDtyPGw7KytyKXtpZihoPStuW3JdLGg9PT1pKXtpZihkPSEwLHMuYWxsKWNvbnRpbnVlO2JyZWFrfWM9dC52YWx1ZXNbaF0sYShjKSYmKG98fDA9PT1lfHxGKGUpPT09RihjKSkmJihlKz1jKX1yZXR1cm4gZHx8cy5hbGw/ZTowfWZ1bmN0aW9uIElzKHQsZSl7Y29uc3QgaT10JiZ0Lm9wdGlvbnMuc3RhY2tlZDtyZXR1cm4gaXx8dm9pZCAwPT09aSYmdm9pZCAwIT09ZS5zdGFja31mdW5jdGlvbiB6cyh0LGUsaSl7Y29uc3Qgcz10W2VdfHwodFtlXT17fSk7cmV0dXJuIHNbaV18fChzW2ldPXt9KX1mdW5jdGlvbiBGcyh0LGUsaSxzKXtmb3IoY29uc3QgbiBvZiBlLmdldE1hdGNoaW5nVmlzaWJsZU1ldGFzKHMpLnJldmVyc2UoKSl7Y29uc3QgZT10W24uaW5kZXhdO2lmKGkmJmU+MHx8IWkmJmU8MClyZXR1cm4gbi5pbmRleH1yZXR1cm4gbnVsbH1mdW5jdGlvbiBWcyh0LGUpe2NvbnN0e2NoYXJ0OmksX2NhY2hlZE1ldGE6c309dCxuPWkuX3N0YWNrc3x8KGkuX3N0YWNrcz17fSkse2lTY2FsZTpvLHZTY2FsZTphLGluZGV4OnJ9PXMsbD1vLmF4aXMsaD1hLmF4aXMsYz1mdW5jdGlvbih0LGUsaSl7cmV0dXJuYCR7dC5pZH0uJHtlLmlkfS4ke2kuc3RhY2t8fGkudHlwZX1gfShvLGEscyksZD1lLmxlbmd0aDtsZXQgdTtmb3IobGV0IHQ9MDt0PGQ7Kyt0KXtjb25zdCBpPWVbdF0se1tsXTpvLFtoXTpkfT1pO3U9KGkuX3N0YWNrc3x8KGkuX3N0YWNrcz17fSkpW2hdPXpzKG4sYyxvKSx1W3JdPWQsdS5fdG9wPUZzKHUsYSwhMCxzLnR5cGUpLHUuX2JvdHRvbT1Gcyh1LGEsITEscy50eXBlKTsodS5fdmlzdWFsVmFsdWVzfHwodS5fdmlzdWFsVmFsdWVzPXt9KSlbcl09ZH19ZnVuY3Rpb24gQnModCxlKXtjb25zdCBpPXQuc2NhbGVzO3JldHVybiBPYmplY3Qua2V5cyhpKS5maWx0ZXIoKHQ9PmlbdF0uYXhpcz09PWUpKS5zaGlmdCgpfWZ1bmN0aW9uIFdzKHQsZSl7Y29uc3QgaT10LmNvbnRyb2xsZXIuaW5kZXgscz10LnZTY2FsZSYmdC52U2NhbGUuYXhpcztpZihzKXtlPWV8fHQuX3BhcnNlZDtmb3IoY29uc3QgdCBvZiBlKXtjb25zdCBlPXQuX3N0YWNrcztpZighZXx8dm9pZCAwPT09ZVtzXXx8dm9pZCAwPT09ZVtzXVtpXSlyZXR1cm47ZGVsZXRlIGVbc11baV0sdm9pZCAwIT09ZVtzXS5fdmlzdWFsVmFsdWVzJiZ2b2lkIDAhPT1lW3NdLl92aXN1YWxWYWx1ZXNbaV0mJmRlbGV0ZSBlW3NdLl92aXN1YWxWYWx1ZXNbaV19fX1jb25zdCBOcz10PT4icmVzZXQiPT09dHx8Im5vbmUiPT09dCxIcz0odCxlKT0+ZT90Ok9iamVjdC5hc3NpZ24oe30sdCk7Y2xhc3MganN7c3RhdGljIGRlZmF1bHRzPXt9O3N0YXRpYyBkYXRhc2V0RWxlbWVudFR5cGU9bnVsbDtzdGF0aWMgZGF0YUVsZW1lbnRUeXBlPW51bGw7Y29uc3RydWN0b3IodCxlKXt0aGlzLmNoYXJ0PXQsdGhpcy5fY3R4PXQuY3R4LHRoaXMuaW5kZXg9ZSx0aGlzLl9jYWNoZWREYXRhT3B0cz17fSx0aGlzLl9jYWNoZWRNZXRhPXRoaXMuZ2V0TWV0YSgpLHRoaXMuX3R5cGU9dGhpcy5fY2FjaGVkTWV0YS50eXBlLHRoaXMub3B0aW9ucz12b2lkIDAsdGhpcy5fcGFyc2luZz0hMSx0aGlzLl9kYXRhPXZvaWQgMCx0aGlzLl9vYmplY3REYXRhPXZvaWQgMCx0aGlzLl9zaGFyZWRPcHRpb25zPXZvaWQgMCx0aGlzLl9kcmF3U3RhcnQ9dm9pZCAwLHRoaXMuX2RyYXdDb3VudD12b2lkIDAsdGhpcy5lbmFibGVPcHRpb25TaGFyaW5nPSExLHRoaXMuc3VwcG9ydHNEZWNpbWF0aW9uPSExLHRoaXMuJGNvbnRleHQ9dm9pZCAwLHRoaXMuX3N5bmNMaXN0PVtdLHRoaXMuZGF0YXNldEVsZW1lbnRUeXBlPW5ldy50YXJnZXQuZGF0YXNldEVsZW1lbnRUeXBlLHRoaXMuZGF0YUVsZW1lbnRUeXBlPW5ldy50YXJnZXQuZGF0YUVsZW1lbnRUeXBlLHRoaXMuaW5pdGlhbGl6ZSgpfWluaXRpYWxpemUoKXtjb25zdCB0PXRoaXMuX2NhY2hlZE1ldGE7dGhpcy5jb25maWd1cmUoKSx0aGlzLmxpbmtTY2FsZXMoKSx0Ll9zdGFja2VkPUlzKHQudlNjYWxlLHQpLHRoaXMuYWRkRWxlbWVudHMoKSx0aGlzLm9wdGlvbnMuZmlsbCYmIXRoaXMuY2hhcnQuaXNQbHVnaW5FbmFibGVkKCJmaWxsZXIiKSYmY29uc29sZS53YXJuKCJUcmllZCB0byB1c2UgdGhlICdmaWxsJyBvcHRpb24gd2l0aG91dCB0aGUgJ0ZpbGxlcicgcGx1Z2luIGVuYWJsZWQuIFBsZWFzZSBpbXBvcnQgYW5kIHJlZ2lzdGVyIHRoZSAnRmlsbGVyJyBwbHVnaW4gYW5kIG1ha2Ugc3VyZSBpdCBpcyBub3QgZGlzYWJsZWQgaW4gdGhlIG9wdGlvbnMiKX11cGRhdGVJbmRleCh0KXt0aGlzLmluZGV4IT09dCYmV3ModGhpcy5fY2FjaGVkTWV0YSksdGhpcy5pbmRleD10fWxpbmtTY2FsZXMoKXtjb25zdCB0PXRoaXMuY2hhcnQsZT10aGlzLl9jYWNoZWRNZXRhLGk9dGhpcy5nZXREYXRhc2V0KCkscz0odCxlLGkscyk9PiJ4Ij09PXQ/ZToiciI9PT10P3M6aSxuPWUueEF4aXNJRD1sKGkueEF4aXNJRCxCcyh0LCJ4IikpLG89ZS55QXhpc0lEPWwoaS55QXhpc0lELEJzKHQsInkiKSksYT1lLnJBeGlzSUQ9bChpLnJBeGlzSUQsQnModCwiciIpKSxyPWUuaW5kZXhBeGlzLGg9ZS5pQXhpc0lEPXMocixuLG8sYSksYz1lLnZBeGlzSUQ9cyhyLG8sbixhKTtlLnhTY2FsZT10aGlzLmdldFNjYWxlRm9ySWQobiksZS55U2NhbGU9dGhpcy5nZXRTY2FsZUZvcklkKG8pLGUuclNjYWxlPXRoaXMuZ2V0U2NhbGVGb3JJZChhKSxlLmlTY2FsZT10aGlzLmdldFNjYWxlRm9ySWQoaCksZS52U2NhbGU9dGhpcy5nZXRTY2FsZUZvcklkKGMpfWdldERhdGFzZXQoKXtyZXR1cm4gdGhpcy5jaGFydC5kYXRhLmRhdGFzZXRzW3RoaXMuaW5kZXhdfWdldE1ldGEoKXtyZXR1cm4gdGhpcy5jaGFydC5nZXREYXRhc2V0TWV0YSh0aGlzLmluZGV4KX1nZXRTY2FsZUZvcklkKHQpe3JldHVybiB0aGlzLmNoYXJ0LnNjYWxlc1t0XX1fZ2V0T3RoZXJTY2FsZSh0KXtjb25zdCBlPXRoaXMuX2NhY2hlZE1ldGE7cmV0dXJuIHQ9PT1lLmlTY2FsZT9lLnZTY2FsZTplLmlTY2FsZX1yZXNldCgpe3RoaXMuX3VwZGF0ZSgicmVzZXQiKX1fZGVzdHJveSgpe2NvbnN0IHQ9dGhpcy5fY2FjaGVkTWV0YTt0aGlzLl9kYXRhJiZydCh0aGlzLl9kYXRhLHRoaXMpLHQuX3N0YWNrZWQmJldzKHQpfV9kYXRhQ2hlY2soKXtjb25zdCB0PXRoaXMuZ2V0RGF0YXNldCgpLGU9dC5kYXRhfHwodC5kYXRhPVtdKSxpPXRoaXMuX2RhdGE7aWYobyhlKSl7Y29uc3QgdD10aGlzLl9jYWNoZWRNZXRhO3RoaXMuX2RhdGE9ZnVuY3Rpb24odCxlKXtjb25zdHtpU2NhbGU6aSx2U2NhbGU6c309ZSxuPSJ4Ij09PWkuYXhpcz8ieCI6InkiLG89IngiPT09cy5heGlzPyJ4IjoieSIsYT1PYmplY3Qua2V5cyh0KSxyPW5ldyBBcnJheShhLmxlbmd0aCk7bGV0IGwsaCxjO2ZvcihsPTAsaD1hLmxlbmd0aDtsPGg7KytsKWM9YVtsXSxyW2xdPXtbbl06Yyxbb106dFtjXX07cmV0dXJuIHJ9KGUsdCl9ZWxzZSBpZihpIT09ZSl7aWYoaSl7cnQoaSx0aGlzKTtjb25zdCB0PXRoaXMuX2NhY2hlZE1ldGE7V3ModCksdC5fcGFyc2VkPVtdfWUmJk9iamVjdC5pc0V4dGVuc2libGUoZSkmJmF0KGUsdGhpcyksdGhpcy5fc3luY0xpc3Q9W10sdGhpcy5fZGF0YT1lfX1hZGRFbGVtZW50cygpe2NvbnN0IHQ9dGhpcy5fY2FjaGVkTWV0YTt0aGlzLl9kYXRhQ2hlY2soKSx0aGlzLmRhdGFzZXRFbGVtZW50VHlwZSYmKHQuZGF0YXNldD1uZXcgdGhpcy5kYXRhc2V0RWxlbWVudFR5cGUpfWJ1aWxkT3JVcGRhdGVFbGVtZW50cyh0KXtjb25zdCBlPXRoaXMuX2NhY2hlZE1ldGEsaT10aGlzLmdldERhdGFzZXQoKTtsZXQgcz0hMTt0aGlzLl9kYXRhQ2hlY2soKTtjb25zdCBuPWUuX3N0YWNrZWQ7ZS5fc3RhY2tlZD1JcyhlLnZTY2FsZSxlKSxlLnN0YWNrIT09aS5zdGFjayYmKHM9ITAsV3MoZSksZS5zdGFjaz1pLnN0YWNrKSx0aGlzLl9yZXN5bmNFbGVtZW50cyh0KSwoc3x8biE9PWUuX3N0YWNrZWQpJiYoVnModGhpcyxlLl9wYXJzZWQpLGUuX3N0YWNrZWQ9SXMoZS52U2NhbGUsZSkpfWNvbmZpZ3VyZSgpe2NvbnN0IHQ9dGhpcy5jaGFydC5jb25maWcsZT10LmRhdGFzZXRTY29wZUtleXModGhpcy5fdHlwZSksaT10LmdldE9wdGlvblNjb3Blcyh0aGlzLmdldERhdGFzZXQoKSxlLCEwKTt0aGlzLm9wdGlvbnM9dC5jcmVhdGVSZXNvbHZlcihpLHRoaXMuZ2V0Q29udGV4dCgpKSx0aGlzLl9wYXJzaW5nPXRoaXMub3B0aW9ucy5wYXJzaW5nLHRoaXMuX2NhY2hlZERhdGFPcHRzPXt9fXBhcnNlKHQsZSl7Y29uc3R7X2NhY2hlZE1ldGE6aSxfZGF0YTpzfT10aGlzLHtpU2NhbGU6YSxfc3RhY2tlZDpyfT1pLGw9YS5heGlzO2xldCBoLGMsZCx1PTA9PT10JiZlPT09cy5sZW5ndGh8fGkuX3NvcnRlZCxmPXQ+MCYmaS5fcGFyc2VkW3QtMV07aWYoITE9PT10aGlzLl9wYXJzaW5nKWkuX3BhcnNlZD1zLGkuX3NvcnRlZD0hMCxkPXM7ZWxzZXtkPW4oc1t0XSk/dGhpcy5wYXJzZUFycmF5RGF0YShpLHMsdCxlKTpvKHNbdF0pP3RoaXMucGFyc2VPYmplY3REYXRhKGkscyx0LGUpOnRoaXMucGFyc2VQcmltaXRpdmVEYXRhKGkscyx0LGUpO2NvbnN0IGE9KCk9Pm51bGw9PT1jW2xdfHxmJiZjW2xdPGZbbF07Zm9yKGg9MDtoPGU7KytoKWkuX3BhcnNlZFtoK3RdPWM9ZFtoXSx1JiYoYSgpJiYodT0hMSksZj1jKTtpLl9zb3J0ZWQ9dX1yJiZWcyh0aGlzLGQpfXBhcnNlUHJpbWl0aXZlRGF0YSh0LGUsaSxzKXtjb25zdHtpU2NhbGU6bix2U2NhbGU6b309dCxhPW4uYXhpcyxyPW8uYXhpcyxsPW4uZ2V0TGFiZWxzKCksaD1uPT09byxjPW5ldyBBcnJheShzKTtsZXQgZCx1LGY7Zm9yKGQ9MCx1PXM7ZDx1OysrZClmPWQraSxjW2RdPXtbYV06aHx8bi5wYXJzZShsW2ZdLGYpLFtyXTpvLnBhcnNlKGVbZl0sZil9O3JldHVybiBjfXBhcnNlQXJyYXlEYXRhKHQsZSxpLHMpe2NvbnN0e3hTY2FsZTpuLHlTY2FsZTpvfT10LGE9bmV3IEFycmF5KHMpO2xldCByLGwsaCxjO2ZvcihyPTAsbD1zO3I8bDsrK3IpaD1yK2ksYz1lW2hdLGFbcl09e3g6bi5wYXJzZShjWzBdLGgpLHk6by5wYXJzZShjWzFdLGgpfTtyZXR1cm4gYX1wYXJzZU9iamVjdERhdGEodCxlLGkscyl7Y29uc3R7eFNjYWxlOm4seVNjYWxlOm99PXQse3hBeGlzS2V5OmE9IngiLHlBeGlzS2V5OnI9InkifT10aGlzLl9wYXJzaW5nLGw9bmV3IEFycmF5KHMpO2xldCBoLGMsZCx1O2ZvcihoPTAsYz1zO2g8YzsrK2gpZD1oK2ksdT1lW2RdLGxbaF09e3g6bi5wYXJzZShNKHUsYSksZCkseTpvLnBhcnNlKE0odSxyKSxkKX07cmV0dXJuIGx9Z2V0UGFyc2VkKHQpe3JldHVybiB0aGlzLl9jYWNoZWRNZXRhLl9wYXJzZWRbdF19Z2V0RGF0YUVsZW1lbnQodCl7cmV0dXJuIHRoaXMuX2NhY2hlZE1ldGEuZGF0YVt0XX1hcHBseVN0YWNrKHQsZSxpKXtjb25zdCBzPXRoaXMuY2hhcnQsbj10aGlzLl9jYWNoZWRNZXRhLG89ZVt0LmF4aXNdO3JldHVybiBScyh7a2V5czpFcyhzLCEwKSx2YWx1ZXM6ZS5fc3RhY2tzW3QuYXhpc10uX3Zpc3VhbFZhbHVlc30sbyxuLmluZGV4LHttb2RlOml9KX11cGRhdGVSYW5nZUZyb21QYXJzZWQodCxlLGkscyl7Y29uc3Qgbj1pW2UuYXhpc107bGV0IG89bnVsbD09PW4/TmFOOm47Y29uc3QgYT1zJiZpLl9zdGFja3NbZS5heGlzXTtzJiZhJiYocy52YWx1ZXM9YSxvPVJzKHMsbix0aGlzLl9jYWNoZWRNZXRhLmluZGV4KSksdC5taW49TWF0aC5taW4odC5taW4sbyksdC5tYXg9TWF0aC5tYXgodC5tYXgsbyl9Z2V0TWluTWF4KHQsZSl7Y29uc3QgaT10aGlzLl9jYWNoZWRNZXRhLHM9aS5fcGFyc2VkLG49aS5fc29ydGVkJiZ0PT09aS5pU2NhbGUsbz1zLmxlbmd0aCxyPXRoaXMuX2dldE90aGVyU2NhbGUodCksbD0oKHQsZSxpKT0+dCYmIWUuaGlkZGVuJiZlLl9zdGFja2VkJiZ7a2V5czpFcyhpLCEwKSx2YWx1ZXM6bnVsbH0pKGUsaSx0aGlzLmNoYXJ0KSxoPXttaW46TnVtYmVyLlBPU0lUSVZFX0lORklOSVRZLG1heDpOdW1iZXIuTkVHQVRJVkVfSU5GSU5JVFl9LHttaW46YyxtYXg6ZH09ZnVuY3Rpb24odCl7Y29uc3R7bWluOmUsbWF4OmksbWluRGVmaW5lZDpzLG1heERlZmluZWQ6bn09dC5nZXRVc2VyQm91bmRzKCk7cmV0dXJue21pbjpzP2U6TnVtYmVyLk5FR0FUSVZFX0lORklOSVRZLG1heDpuP2k6TnVtYmVyLlBPU0lUSVZFX0lORklOSVRZfX0ocik7bGV0IHUsZjtmdW5jdGlvbiBnKCl7Zj1zW3VdO2NvbnN0IGU9ZltyLmF4aXNdO3JldHVybiFhKGZbdC5heGlzXSl8fGM+ZXx8ZDxlfWZvcih1PTA7dTxvJiYoZygpfHwodGhpcy51cGRhdGVSYW5nZUZyb21QYXJzZWQoaCx0LGYsbCksIW4pKTsrK3UpO2lmKG4pZm9yKHU9by0xO3U+PTA7LS11KWlmKCFnKCkpe3RoaXMudXBkYXRlUmFuZ2VGcm9tUGFyc2VkKGgsdCxmLGwpO2JyZWFrfXJldHVybiBofWdldEFsbFBhcnNlZFZhbHVlcyh0KXtjb25zdCBlPXRoaXMuX2NhY2hlZE1ldGEuX3BhcnNlZCxpPVtdO2xldCBzLG4sbztmb3Iocz0wLG49ZS5sZW5ndGg7czxuOysrcylvPWVbc11bdC5heGlzXSxhKG8pJiZpLnB1c2gobyk7cmV0dXJuIGl9Z2V0TWF4T3ZlcmZsb3coKXtyZXR1cm4hMX1nZXRMYWJlbEFuZFZhbHVlKHQpe2NvbnN0IGU9dGhpcy5fY2FjaGVkTWV0YSxpPWUuaVNjYWxlLHM9ZS52U2NhbGUsbj10aGlzLmdldFBhcnNlZCh0KTtyZXR1cm57bGFiZWw6aT8iIitpLmdldExhYmVsRm9yVmFsdWUobltpLmF4aXNdKToiIix2YWx1ZTpzPyIiK3MuZ2V0TGFiZWxGb3JWYWx1ZShuW3MuYXhpc10pOiIifX1fdXBkYXRlKHQpe2NvbnN0IGU9dGhpcy5fY2FjaGVkTWV0YTt0aGlzLnVwZGF0ZSh0fHwiZGVmYXVsdCIpLGUuX2NsaXA9ZnVuY3Rpb24odCl7bGV0IGUsaSxzLG47cmV0dXJuIG8odCk/KGU9dC50b3AsaT10LnJpZ2h0LHM9dC5ib3R0b20sbj10LmxlZnQpOmU9aT1zPW49dCx7dG9wOmUscmlnaHQ6aSxib3R0b206cyxsZWZ0Om4sZGlzYWJsZWQ6ITE9PT10fX0obCh0aGlzLm9wdGlvbnMuY2xpcCxmdW5jdGlvbih0LGUsaSl7aWYoITE9PT1pKXJldHVybiExO2NvbnN0IHM9THModCxpKSxuPUxzKGUsaSk7cmV0dXJue3RvcDpuLmVuZCxyaWdodDpzLmVuZCxib3R0b206bi5zdGFydCxsZWZ0OnMuc3RhcnR9fShlLnhTY2FsZSxlLnlTY2FsZSx0aGlzLmdldE1heE92ZXJmbG93KCkpKSl9dXBkYXRlKHQpe31kcmF3KCl7Y29uc3QgdD10aGlzLl9jdHgsZT10aGlzLmNoYXJ0LGk9dGhpcy5fY2FjaGVkTWV0YSxzPWkuZGF0YXx8W10sbj1lLmNoYXJ0QXJlYSxvPVtdLGE9dGhpcy5fZHJhd1N0YXJ0fHwwLHI9dGhpcy5fZHJhd0NvdW50fHxzLmxlbmd0aC1hLGw9dGhpcy5vcHRpb25zLmRyYXdBY3RpdmVFbGVtZW50c09uVG9wO2xldCBoO2ZvcihpLmRhdGFzZXQmJmkuZGF0YXNldC5kcmF3KHQsbixhLHIpLGg9YTtoPGErcjsrK2gpe2NvbnN0IGU9c1toXTtlLmhpZGRlbnx8KGUuYWN0aXZlJiZsP28ucHVzaChlKTplLmRyYXcodCxuKSl9Zm9yKGg9MDtoPG8ubGVuZ3RoOysraClvW2hdLmRyYXcodCxuKX1nZXRTdHlsZSh0LGUpe2NvbnN0IGk9ZT8iYWN0aXZlIjoiZGVmYXVsdCI7cmV0dXJuIHZvaWQgMD09PXQmJnRoaXMuX2NhY2hlZE1ldGEuZGF0YXNldD90aGlzLnJlc29sdmVEYXRhc2V0RWxlbWVudE9wdGlvbnMoaSk6dGhpcy5yZXNvbHZlRGF0YUVsZW1lbnRPcHRpb25zKHR8fDAsaSl9Z2V0Q29udGV4dCh0LGUsaSl7Y29uc3Qgcz10aGlzLmdldERhdGFzZXQoKTtsZXQgbjtpZih0Pj0wJiZ0PHRoaXMuX2NhY2hlZE1ldGEuZGF0YS5sZW5ndGgpe2NvbnN0IGU9dGhpcy5fY2FjaGVkTWV0YS5kYXRhW3RdO249ZS4kY29udGV4dHx8KGUuJGNvbnRleHQ9ZnVuY3Rpb24odCxlLGkpe3JldHVybiBDaSh0LHthY3RpdmU6ITEsZGF0YUluZGV4OmUscGFyc2VkOnZvaWQgMCxyYXc6dm9pZCAwLGVsZW1lbnQ6aSxpbmRleDplLG1vZGU6ImRlZmF1bHQiLHR5cGU6ImRhdGEifSl9KHRoaXMuZ2V0Q29udGV4dCgpLHQsZSkpLG4ucGFyc2VkPXRoaXMuZ2V0UGFyc2VkKHQpLG4ucmF3PXMuZGF0YVt0XSxuLmluZGV4PW4uZGF0YUluZGV4PXR9ZWxzZSBuPXRoaXMuJGNvbnRleHR8fCh0aGlzLiRjb250ZXh0PWZ1bmN0aW9uKHQsZSl7cmV0dXJuIENpKHQse2FjdGl2ZTohMSxkYXRhc2V0OnZvaWQgMCxkYXRhc2V0SW5kZXg6ZSxpbmRleDplLG1vZGU6ImRlZmF1bHQiLHR5cGU6ImRhdGFzZXQifSl9KHRoaXMuY2hhcnQuZ2V0Q29udGV4dCgpLHRoaXMuaW5kZXgpKSxuLmRhdGFzZXQ9cyxuLmluZGV4PW4uZGF0YXNldEluZGV4PXRoaXMuaW5kZXg7cmV0dXJuIG4uYWN0aXZlPSEhZSxuLm1vZGU9aSxufXJlc29sdmVEYXRhc2V0RWxlbWVudE9wdGlvbnModCl7cmV0dXJuIHRoaXMuX3Jlc29sdmVFbGVtZW50T3B0aW9ucyh0aGlzLmRhdGFzZXRFbGVtZW50VHlwZS5pZCx0KX1yZXNvbHZlRGF0YUVsZW1lbnRPcHRpb25zKHQsZSl7cmV0dXJuIHRoaXMuX3Jlc29sdmVFbGVtZW50T3B0aW9ucyh0aGlzLmRhdGFFbGVtZW50VHlwZS5pZCxlLHQpfV9yZXNvbHZlRWxlbWVudE9wdGlvbnModCxlPSJkZWZhdWx0IixpKXtjb25zdCBzPSJhY3RpdmUiPT09ZSxuPXRoaXMuX2NhY2hlZERhdGFPcHRzLG89dCsiLSIrZSxhPW5bb10scj10aGlzLmVuYWJsZU9wdGlvblNoYXJpbmcmJmsoaSk7aWYoYSlyZXR1cm4gSHMoYSxyKTtjb25zdCBsPXRoaXMuY2hhcnQuY29uZmlnLGg9bC5kYXRhc2V0RWxlbWVudFNjb3BlS2V5cyh0aGlzLl90eXBlLHQpLGM9cz9bYCR7dH1Ib3ZlcmAsImhvdmVyIix0LCIiXTpbdCwiIl0sZD1sLmdldE9wdGlvblNjb3Blcyh0aGlzLmdldERhdGFzZXQoKSxoKSx1PU9iamVjdC5rZXlzKHVlLmVsZW1lbnRzW3RdKSxmPWwucmVzb2x2ZU5hbWVkT3B0aW9ucyhkLHUsKCgpPT50aGlzLmdldENvbnRleHQoaSxzLGUpKSxjKTtyZXR1cm4gZi4kc2hhcmVkJiYoZi4kc2hhcmVkPXIsbltvXT1PYmplY3QuZnJlZXplKEhzKGYscikpKSxmfV9yZXNvbHZlQW5pbWF0aW9ucyh0LGUsaSl7Y29uc3Qgcz10aGlzLmNoYXJ0LG49dGhpcy5fY2FjaGVkRGF0YU9wdHMsbz1gYW5pbWF0aW9uLSR7ZX1gLGE9bltvXTtpZihhKXJldHVybiBhO2xldCByO2lmKCExIT09cy5vcHRpb25zLmFuaW1hdGlvbil7Y29uc3Qgcz10aGlzLmNoYXJ0LmNvbmZpZyxuPXMuZGF0YXNldEFuaW1hdGlvblNjb3BlS2V5cyh0aGlzLl90eXBlLGUpLG89cy5nZXRPcHRpb25TY29wZXModGhpcy5nZXREYXRhc2V0KCksbik7cj1zLmNyZWF0ZVJlc29sdmVyKG8sdGhpcy5nZXRDb250ZXh0KHQsaSxlKSl9Y29uc3QgbD1uZXcgVHMocyxyJiZyLmFuaW1hdGlvbnMpO3JldHVybiByJiZyLl9jYWNoZWFibGUmJihuW29dPU9iamVjdC5mcmVlemUobCkpLGx9Z2V0U2hhcmVkT3B0aW9ucyh0KXtpZih0LiRzaGFyZWQpcmV0dXJuIHRoaXMuX3NoYXJlZE9wdGlvbnN8fCh0aGlzLl9zaGFyZWRPcHRpb25zPU9iamVjdC5hc3NpZ24oe30sdCkpfWluY2x1ZGVPcHRpb25zKHQsZSl7cmV0dXJuIWV8fE5zKHQpfHx0aGlzLmNoYXJ0Ll9hbmltYXRpb25zRGlzYWJsZWR9X2dldFNoYXJlZE9wdGlvbnModCxlKXtjb25zdCBpPXRoaXMucmVzb2x2ZURhdGFFbGVtZW50T3B0aW9ucyh0LGUpLHM9dGhpcy5fc2hhcmVkT3B0aW9ucyxuPXRoaXMuZ2V0U2hhcmVkT3B0aW9ucyhpKSxvPXRoaXMuaW5jbHVkZU9wdGlvbnMoZSxuKXx8biE9PXM7cmV0dXJuIHRoaXMudXBkYXRlU2hhcmVkT3B0aW9ucyhuLGUsaSkse3NoYXJlZE9wdGlvbnM6bixpbmNsdWRlT3B0aW9uczpvfX11cGRhdGVFbGVtZW50KHQsZSxpLHMpe05zKHMpP09iamVjdC5hc3NpZ24odCxpKTp0aGlzLl9yZXNvbHZlQW5pbWF0aW9ucyhlLHMpLnVwZGF0ZSh0LGkpfXVwZGF0ZVNoYXJlZE9wdGlvbnModCxlLGkpe3QmJiFOcyhlKSYmdGhpcy5fcmVzb2x2ZUFuaW1hdGlvbnModm9pZCAwLGUpLnVwZGF0ZSh0LGkpfV9zZXRTdHlsZSh0LGUsaSxzKXt0LmFjdGl2ZT1zO2NvbnN0IG49dGhpcy5nZXRTdHlsZShlLHMpO3RoaXMuX3Jlc29sdmVBbmltYXRpb25zKGUsaSxzKS51cGRhdGUodCx7b3B0aW9uczohcyYmdGhpcy5nZXRTaGFyZWRPcHRpb25zKG4pfHxufSl9cmVtb3ZlSG92ZXJTdHlsZSh0LGUsaSl7dGhpcy5fc2V0U3R5bGUodCxpLCJhY3RpdmUiLCExKX1zZXRIb3ZlclN0eWxlKHQsZSxpKXt0aGlzLl9zZXRTdHlsZSh0LGksImFjdGl2ZSIsITApfV9yZW1vdmVEYXRhc2V0SG92ZXJTdHlsZSgpe2NvbnN0IHQ9dGhpcy5fY2FjaGVkTWV0YS5kYXRhc2V0O3QmJnRoaXMuX3NldFN0eWxlKHQsdm9pZCAwLCJhY3RpdmUiLCExKX1fc2V0RGF0YXNldEhvdmVyU3R5bGUoKXtjb25zdCB0PXRoaXMuX2NhY2hlZE1ldGEuZGF0YXNldDt0JiZ0aGlzLl9zZXRTdHlsZSh0LHZvaWQgMCwiYWN0aXZlIiwhMCl9X3Jlc3luY0VsZW1lbnRzKHQpe2NvbnN0IGU9dGhpcy5fZGF0YSxpPXRoaXMuX2NhY2hlZE1ldGEuZGF0YTtmb3IoY29uc3RbdCxlLGldb2YgdGhpcy5fc3luY0xpc3QpdGhpc1t0XShlLGkpO3RoaXMuX3N5bmNMaXN0PVtdO2NvbnN0IHM9aS5sZW5ndGgsbj1lLmxlbmd0aCxvPU1hdGgubWluKG4scyk7byYmdGhpcy5wYXJzZSgwLG8pLG4+cz90aGlzLl9pbnNlcnRFbGVtZW50cyhzLG4tcyx0KTpuPHMmJnRoaXMuX3JlbW92ZUVsZW1lbnRzKG4scy1uKX1faW5zZXJ0RWxlbWVudHModCxlLGk9ITApe2NvbnN0IHM9dGhpcy5fY2FjaGVkTWV0YSxuPXMuZGF0YSxvPXQrZTtsZXQgYTtjb25zdCByPXQ9Pntmb3IodC5sZW5ndGgrPWUsYT10Lmxlbmd0aC0xO2E+PW87YS0tKXRbYV09dFthLWVdfTtmb3IocihuKSxhPXQ7YTxvOysrYSluW2FdPW5ldyB0aGlzLmRhdGFFbGVtZW50VHlwZTt0aGlzLl9wYXJzaW5nJiZyKHMuX3BhcnNlZCksdGhpcy5wYXJzZSh0LGUpLGkmJnRoaXMudXBkYXRlRWxlbWVudHMobix0LGUsInJlc2V0Iil9dXBkYXRlRWxlbWVudHModCxlLGkscyl7fV9yZW1vdmVFbGVtZW50cyh0LGUpe2NvbnN0IGk9dGhpcy5fY2FjaGVkTWV0YTtpZih0aGlzLl9wYXJzaW5nKXtjb25zdCBzPWkuX3BhcnNlZC5zcGxpY2UodCxlKTtpLl9zdGFja2VkJiZXcyhpLHMpfWkuZGF0YS5zcGxpY2UodCxlKX1fc3luYyh0KXtpZih0aGlzLl9wYXJzaW5nKXRoaXMuX3N5bmNMaXN0LnB1c2godCk7ZWxzZXtjb25zdFtlLGksc109dDt0aGlzW2VdKGkscyl9dGhpcy5jaGFydC5fZGF0YUNoYW5nZXMucHVzaChbdGhpcy5pbmRleCwuLi50XSl9X29uRGF0YVB1c2goKXtjb25zdCB0PWFyZ3VtZW50cy5sZW5ndGg7dGhpcy5fc3luYyhbIl9pbnNlcnRFbGVtZW50cyIsdGhpcy5nZXREYXRhc2V0KCkuZGF0YS5sZW5ndGgtdCx0XSl9X29uRGF0YVBvcCgpe3RoaXMuX3N5bmMoWyJfcmVtb3ZlRWxlbWVudHMiLHRoaXMuX2NhY2hlZE1ldGEuZGF0YS5sZW5ndGgtMSwxXSl9X29uRGF0YVNoaWZ0KCl7dGhpcy5fc3luYyhbIl9yZW1vdmVFbGVtZW50cyIsMCwxXSl9X29uRGF0YVNwbGljZSh0LGUpe2UmJnRoaXMuX3N5bmMoWyJfcmVtb3ZlRWxlbWVudHMiLHQsZV0pO2NvbnN0IGk9YXJndW1lbnRzLmxlbmd0aC0yO2kmJnRoaXMuX3N5bmMoWyJfaW5zZXJ0RWxlbWVudHMiLHQsaV0pfV9vbkRhdGFVbnNoaWZ0KCl7dGhpcy5fc3luYyhbIl9pbnNlcnRFbGVtZW50cyIsMCxhcmd1bWVudHMubGVuZ3RoXSl9fWNsYXNzICRze3N0YXRpYyBkZWZhdWx0cz17fTtzdGF0aWMgZGVmYXVsdFJvdXRlcz12b2lkIDA7eDt5O2FjdGl2ZT0hMTtvcHRpb25zOyRhbmltYXRpb25zO3Rvb2x0aXBQb3NpdGlvbih0KXtjb25zdHt4OmUseTppfT10aGlzLmdldFByb3BzKFsieCIsInkiXSx0KTtyZXR1cm57eDplLHk6aX19aGFzVmFsdWUoKXtyZXR1cm4gTih0aGlzLngpJiZOKHRoaXMueSl9Z2V0UHJvcHModCxlKXtjb25zdCBpPXRoaXMuJGFuaW1hdGlvbnM7aWYoIWV8fCFpKXJldHVybiB0aGlzO2NvbnN0IHM9e307cmV0dXJuIHQuZm9yRWFjaCgodD0+e3NbdF09aVt0XSYmaVt0XS5hY3RpdmUoKT9pW3RdLl90bzp0aGlzW3RdfSkpLHN9fWZ1bmN0aW9uIFlzKHQsZSl7Y29uc3QgaT10Lm9wdGlvbnMudGlja3Msbj1mdW5jdGlvbih0KXtjb25zdCBlPXQub3B0aW9ucy5vZmZzZXQsaT10Ll90aWNrU2l6ZSgpLHM9dC5fbGVuZ3RoL2krKGU/MDoxKSxuPXQuX21heExlbmd0aC9pO3JldHVybiBNYXRoLmZsb29yKE1hdGgubWluKHMsbikpfSh0KSxvPU1hdGgubWluKGkubWF4VGlja3NMaW1pdHx8bixuKSxhPWkubWFqb3IuZW5hYmxlZD9mdW5jdGlvbih0KXtjb25zdCBlPVtdO2xldCBpLHM7Zm9yKGk9MCxzPXQubGVuZ3RoO2k8cztpKyspdFtpXS5tYWpvciYmZS5wdXNoKGkpO3JldHVybiBlfShlKTpbXSxyPWEubGVuZ3RoLGw9YVswXSxoPWFbci0xXSxjPVtdO2lmKHI+bylyZXR1cm4gZnVuY3Rpb24odCxlLGkscyl7bGV0IG4sbz0wLGE9aVswXTtmb3Iocz1NYXRoLmNlaWwocyksbj0wO248dC5sZW5ndGg7bisrKW49PT1hJiYoZS5wdXNoKHRbbl0pLG8rKyxhPWlbbypzXSl9KGUsYyxhLHIvbyksYztjb25zdCBkPWZ1bmN0aW9uKHQsZSxpKXtjb25zdCBzPWZ1bmN0aW9uKHQpe2NvbnN0IGU9dC5sZW5ndGg7bGV0IGkscztpZihlPDIpcmV0dXJuITE7Zm9yKHM9dFswXSxpPTE7aTxlOysraSlpZih0W2ldLXRbaS0xXSE9PXMpcmV0dXJuITE7cmV0dXJuIHN9KHQpLG49ZS5sZW5ndGgvaTtpZighcylyZXR1cm4gTWF0aC5tYXgobiwxKTtjb25zdCBvPVcocyk7Zm9yKGxldCB0PTAsZT1vLmxlbmd0aC0xO3Q8ZTt0Kyspe2NvbnN0IGU9b1t0XTtpZihlPm4pcmV0dXJuIGV9cmV0dXJuIE1hdGgubWF4KG4sMSl9KGEsZSxvKTtpZihyPjApe2xldCB0LGk7Y29uc3Qgbj1yPjE/TWF0aC5yb3VuZCgoaC1sKS8oci0xKSk6bnVsbDtmb3IoVXMoZSxjLGQscyhuKT8wOmwtbixsKSx0PTAsaT1yLTE7dDxpO3QrKylVcyhlLGMsZCxhW3RdLGFbdCsxXSk7cmV0dXJuIFVzKGUsYyxkLGgscyhuKT9lLmxlbmd0aDpoK24pLGN9cmV0dXJuIFVzKGUsYyxkKSxjfWZ1bmN0aW9uIFVzKHQsZSxpLHMsbil7Y29uc3Qgbz1sKHMsMCksYT1NYXRoLm1pbihsKG4sdC5sZW5ndGgpLHQubGVuZ3RoKTtsZXQgcixoLGMsZD0wO2ZvcihpPU1hdGguY2VpbChpKSxuJiYocj1uLXMsaT1yL01hdGguZmxvb3Ioci9pKSksYz1vO2M8MDspZCsrLGM9TWF0aC5yb3VuZChvK2QqaSk7Zm9yKGg9TWF0aC5tYXgobywwKTtoPGE7aCsrKWg9PT1jJiYoZS5wdXNoKHRbaF0pLGQrKyxjPU1hdGgucm91bmQobytkKmkpKX1jb25zdCBYcz0odCxlLGkpPT4idG9wIj09PWV8fCJsZWZ0Ij09PWU/dFtlXStpOnRbZV0taSxxcz0odCxlKT0+TWF0aC5taW4oZXx8dCx0KTtmdW5jdGlvbiBLcyh0LGUpe2NvbnN0IGk9W10scz10Lmxlbmd0aC9lLG49dC5sZW5ndGg7bGV0IG89MDtmb3IoO288bjtvKz1zKWkucHVzaCh0W01hdGguZmxvb3IobyldKTtyZXR1cm4gaX1mdW5jdGlvbiBHcyh0LGUsaSl7Y29uc3Qgcz10LnRpY2tzLmxlbmd0aCxuPU1hdGgubWluKGUscy0xKSxvPXQuX3N0YXJ0UGl4ZWwsYT10Ll9lbmRQaXhlbCxyPTFlLTY7bGV0IGwsaD10LmdldFBpeGVsRm9yVGljayhuKTtpZighKGkmJihsPTE9PT1zP01hdGgubWF4KGgtbyxhLWgpOjA9PT1lPyh0LmdldFBpeGVsRm9yVGljaygxKS1oKS8yOihoLXQuZ2V0UGl4ZWxGb3JUaWNrKG4tMSkpLzIsaCs9bjxlP2w6LWwsaDxvLXJ8fGg+YStyKSkpcmV0dXJuIGh9ZnVuY3Rpb24gSnModCl7cmV0dXJuIHQuZHJhd1RpY2tzP3QudGlja0xlbmd0aDowfWZ1bmN0aW9uIFpzKHQsZSl7aWYoIXQuZGlzcGxheSlyZXR1cm4gMDtjb25zdCBpPVNpKHQuZm9udCxlKSxzPWtpKHQucGFkZGluZyk7cmV0dXJuKG4odC50ZXh0KT90LnRleHQubGVuZ3RoOjEpKmkubGluZUhlaWdodCtzLmhlaWdodH1mdW5jdGlvbiBRcyh0LGUsaSl7bGV0IHM9dXQodCk7cmV0dXJuKGkmJiJyaWdodCIhPT1lfHwhaSYmInJpZ2h0Ij09PWUpJiYocz0odD0+ImxlZnQiPT09dD8icmlnaHQiOiJyaWdodCI9PT10PyJsZWZ0Ijp0KShzKSksc31jbGFzcyB0biBleHRlbmRzICRze2NvbnN0cnVjdG9yKHQpe3N1cGVyKCksdGhpcy5pZD10LmlkLHRoaXMudHlwZT10LnR5cGUsdGhpcy5vcHRpb25zPXZvaWQgMCx0aGlzLmN0eD10LmN0eCx0aGlzLmNoYXJ0PXQuY2hhcnQsdGhpcy50b3A9dm9pZCAwLHRoaXMuYm90dG9tPXZvaWQgMCx0aGlzLmxlZnQ9dm9pZCAwLHRoaXMucmlnaHQ9dm9pZCAwLHRoaXMud2lkdGg9dm9pZCAwLHRoaXMuaGVpZ2h0PXZvaWQgMCx0aGlzLl9tYXJnaW5zPXtsZWZ0OjAscmlnaHQ6MCx0b3A6MCxib3R0b206MH0sdGhpcy5tYXhXaWR0aD12b2lkIDAsdGhpcy5tYXhIZWlnaHQ9dm9pZCAwLHRoaXMucGFkZGluZ1RvcD12b2lkIDAsdGhpcy5wYWRkaW5nQm90dG9tPXZvaWQgMCx0aGlzLnBhZGRpbmdMZWZ0PXZvaWQgMCx0aGlzLnBhZGRpbmdSaWdodD12b2lkIDAsdGhpcy5heGlzPXZvaWQgMCx0aGlzLmxhYmVsUm90YXRpb249dm9pZCAwLHRoaXMubWluPXZvaWQgMCx0aGlzLm1heD12b2lkIDAsdGhpcy5fcmFuZ2U9dm9pZCAwLHRoaXMudGlja3M9W10sdGhpcy5fZ3JpZExpbmVJdGVtcz1udWxsLHRoaXMuX2xhYmVsSXRlbXM9bnVsbCx0aGlzLl9sYWJlbFNpemVzPW51bGwsdGhpcy5fbGVuZ3RoPTAsdGhpcy5fbWF4TGVuZ3RoPTAsdGhpcy5fbG9uZ2VzdFRleHRDYWNoZT17fSx0aGlzLl9zdGFydFBpeGVsPXZvaWQgMCx0aGlzLl9lbmRQaXhlbD12b2lkIDAsdGhpcy5fcmV2ZXJzZVBpeGVscz0hMSx0aGlzLl91c2VyTWF4PXZvaWQgMCx0aGlzLl91c2VyTWluPXZvaWQgMCx0aGlzLl9zdWdnZXN0ZWRNYXg9dm9pZCAwLHRoaXMuX3N1Z2dlc3RlZE1pbj12b2lkIDAsdGhpcy5fdGlja3NMZW5ndGg9MCx0aGlzLl9ib3JkZXJWYWx1ZT0wLHRoaXMuX2NhY2hlPXt9LHRoaXMuX2RhdGFMaW1pdHNDYWNoZWQ9ITEsdGhpcy4kY29udGV4dD12b2lkIDB9aW5pdCh0KXt0aGlzLm9wdGlvbnM9dC5zZXRDb250ZXh0KHRoaXMuZ2V0Q29udGV4dCgpKSx0aGlzLmF4aXM9dC5heGlzLHRoaXMuX3VzZXJNaW49dGhpcy5wYXJzZSh0Lm1pbiksdGhpcy5fdXNlck1heD10aGlzLnBhcnNlKHQubWF4KSx0aGlzLl9zdWdnZXN0ZWRNaW49dGhpcy5wYXJzZSh0LnN1Z2dlc3RlZE1pbiksdGhpcy5fc3VnZ2VzdGVkTWF4PXRoaXMucGFyc2UodC5zdWdnZXN0ZWRNYXgpfXBhcnNlKHQsZSl7cmV0dXJuIHR9Z2V0VXNlckJvdW5kcygpe2xldHtfdXNlck1pbjp0LF91c2VyTWF4OmUsX3N1Z2dlc3RlZE1pbjppLF9zdWdnZXN0ZWRNYXg6c309dGhpcztyZXR1cm4gdD1yKHQsTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZKSxlPXIoZSxOdW1iZXIuTkVHQVRJVkVfSU5GSU5JVFkpLGk9cihpLE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkscz1yKHMsTnVtYmVyLk5FR0FUSVZFX0lORklOSVRZKSx7bWluOnIodCxpKSxtYXg6cihlLHMpLG1pbkRlZmluZWQ6YSh0KSxtYXhEZWZpbmVkOmEoZSl9fWdldE1pbk1heCh0KXtsZXQgZSx7bWluOmksbWF4OnMsbWluRGVmaW5lZDpuLG1heERlZmluZWQ6b309dGhpcy5nZXRVc2VyQm91bmRzKCk7aWYobiYmbylyZXR1cm57bWluOmksbWF4OnN9O2NvbnN0IGE9dGhpcy5nZXRNYXRjaGluZ1Zpc2libGVNZXRhcygpO2ZvcihsZXQgcj0wLGw9YS5sZW5ndGg7cjxsOysrcillPWFbcl0uY29udHJvbGxlci5nZXRNaW5NYXgodGhpcyx0KSxufHwoaT1NYXRoLm1pbihpLGUubWluKSksb3x8KHM9TWF0aC5tYXgocyxlLm1heCkpO3JldHVybiBpPW8mJmk+cz9zOmkscz1uJiZpPnM/aTpzLHttaW46cihpLHIocyxpKSksbWF4OnIocyxyKGkscykpfX1nZXRQYWRkaW5nKCl7cmV0dXJue2xlZnQ6dGhpcy5wYWRkaW5nTGVmdHx8MCx0b3A6dGhpcy5wYWRkaW5nVG9wfHwwLHJpZ2h0OnRoaXMucGFkZGluZ1JpZ2h0fHwwLGJvdHRvbTp0aGlzLnBhZGRpbmdCb3R0b218fDB9fWdldFRpY2tzKCl7cmV0dXJuIHRoaXMudGlja3N9Z2V0TGFiZWxzKCl7Y29uc3QgdD10aGlzLmNoYXJ0LmRhdGE7cmV0dXJuIHRoaXMub3B0aW9ucy5sYWJlbHN8fCh0aGlzLmlzSG9yaXpvbnRhbCgpP3QueExhYmVsczp0LnlMYWJlbHMpfHx0LmxhYmVsc3x8W119Z2V0TGFiZWxJdGVtcyh0PXRoaXMuY2hhcnQuY2hhcnRBcmVhKXtyZXR1cm4gdGhpcy5fbGFiZWxJdGVtc3x8KHRoaXMuX2xhYmVsSXRlbXM9dGhpcy5fY29tcHV0ZUxhYmVsSXRlbXModCkpfWJlZm9yZUxheW91dCgpe3RoaXMuX2NhY2hlPXt9LHRoaXMuX2RhdGFMaW1pdHNDYWNoZWQ9ITF9YmVmb3JlVXBkYXRlKCl7ZCh0aGlzLm9wdGlvbnMuYmVmb3JlVXBkYXRlLFt0aGlzXSl9dXBkYXRlKHQsZSxpKXtjb25zdHtiZWdpbkF0WmVybzpzLGdyYWNlOm4sdGlja3M6b309dGhpcy5vcHRpb25zLGE9by5zYW1wbGVTaXplO3RoaXMuYmVmb3JlVXBkYXRlKCksdGhpcy5tYXhXaWR0aD10LHRoaXMubWF4SGVpZ2h0PWUsdGhpcy5fbWFyZ2lucz1pPU9iamVjdC5hc3NpZ24oe2xlZnQ6MCxyaWdodDowLHRvcDowLGJvdHRvbTowfSxpKSx0aGlzLnRpY2tzPW51bGwsdGhpcy5fbGFiZWxTaXplcz1udWxsLHRoaXMuX2dyaWRMaW5lSXRlbXM9bnVsbCx0aGlzLl9sYWJlbEl0ZW1zPW51bGwsdGhpcy5iZWZvcmVTZXREaW1lbnNpb25zKCksdGhpcy5zZXREaW1lbnNpb25zKCksdGhpcy5hZnRlclNldERpbWVuc2lvbnMoKSx0aGlzLl9tYXhMZW5ndGg9dGhpcy5pc0hvcml6b250YWwoKT90aGlzLndpZHRoK2kubGVmdCtpLnJpZ2h0OnRoaXMuaGVpZ2h0K2kudG9wK2kuYm90dG9tLHRoaXMuX2RhdGFMaW1pdHNDYWNoZWR8fCh0aGlzLmJlZm9yZURhdGFMaW1pdHMoKSx0aGlzLmRldGVybWluZURhdGFMaW1pdHMoKSx0aGlzLmFmdGVyRGF0YUxpbWl0cygpLHRoaXMuX3JhbmdlPURpKHRoaXMsbixzKSx0aGlzLl9kYXRhTGltaXRzQ2FjaGVkPSEwKSx0aGlzLmJlZm9yZUJ1aWxkVGlja3MoKSx0aGlzLnRpY2tzPXRoaXMuYnVpbGRUaWNrcygpfHxbXSx0aGlzLmFmdGVyQnVpbGRUaWNrcygpO2NvbnN0IHI9YTx0aGlzLnRpY2tzLmxlbmd0aDt0aGlzLl9jb252ZXJ0VGlja3NUb0xhYmVscyhyP0tzKHRoaXMudGlja3MsYSk6dGhpcy50aWNrcyksdGhpcy5jb25maWd1cmUoKSx0aGlzLmJlZm9yZUNhbGN1bGF0ZUxhYmVsUm90YXRpb24oKSx0aGlzLmNhbGN1bGF0ZUxhYmVsUm90YXRpb24oKSx0aGlzLmFmdGVyQ2FsY3VsYXRlTGFiZWxSb3RhdGlvbigpLG8uZGlzcGxheSYmKG8uYXV0b1NraXB8fCJhdXRvIj09PW8uc291cmNlKSYmKHRoaXMudGlja3M9WXModGhpcyx0aGlzLnRpY2tzKSx0aGlzLl9sYWJlbFNpemVzPW51bGwsdGhpcy5hZnRlckF1dG9Ta2lwKCkpLHImJnRoaXMuX2NvbnZlcnRUaWNrc1RvTGFiZWxzKHRoaXMudGlja3MpLHRoaXMuYmVmb3JlRml0KCksdGhpcy5maXQoKSx0aGlzLmFmdGVyRml0KCksdGhpcy5hZnRlclVwZGF0ZSgpfWNvbmZpZ3VyZSgpe2xldCB0LGUsaT10aGlzLm9wdGlvbnMucmV2ZXJzZTt0aGlzLmlzSG9yaXpvbnRhbCgpPyh0PXRoaXMubGVmdCxlPXRoaXMucmlnaHQpOih0PXRoaXMudG9wLGU9dGhpcy5ib3R0b20saT0haSksdGhpcy5fc3RhcnRQaXhlbD10LHRoaXMuX2VuZFBpeGVsPWUsdGhpcy5fcmV2ZXJzZVBpeGVscz1pLHRoaXMuX2xlbmd0aD1lLXQsdGhpcy5fYWxpZ25Ub1BpeGVscz10aGlzLm9wdGlvbnMuYWxpZ25Ub1BpeGVsc31hZnRlclVwZGF0ZSgpe2QodGhpcy5vcHRpb25zLmFmdGVyVXBkYXRlLFt0aGlzXSl9YmVmb3JlU2V0RGltZW5zaW9ucygpe2QodGhpcy5vcHRpb25zLmJlZm9yZVNldERpbWVuc2lvbnMsW3RoaXNdKX1zZXREaW1lbnNpb25zKCl7dGhpcy5pc0hvcml6b250YWwoKT8odGhpcy53aWR0aD10aGlzLm1heFdpZHRoLHRoaXMubGVmdD0wLHRoaXMucmlnaHQ9dGhpcy53aWR0aCk6KHRoaXMuaGVpZ2h0PXRoaXMubWF4SGVpZ2h0LHRoaXMudG9wPTAsdGhpcy5ib3R0b209dGhpcy5oZWlnaHQpLHRoaXMucGFkZGluZ0xlZnQ9MCx0aGlzLnBhZGRpbmdUb3A9MCx0aGlzLnBhZGRpbmdSaWdodD0wLHRoaXMucGFkZGluZ0JvdHRvbT0wfWFmdGVyU2V0RGltZW5zaW9ucygpe2QodGhpcy5vcHRpb25zLmFmdGVyU2V0RGltZW5zaW9ucyxbdGhpc10pfV9jYWxsSG9va3ModCl7dGhpcy5jaGFydC5ub3RpZnlQbHVnaW5zKHQsdGhpcy5nZXRDb250ZXh0KCkpLGQodGhpcy5vcHRpb25zW3RdLFt0aGlzXSl9YmVmb3JlRGF0YUxpbWl0cygpe3RoaXMuX2NhbGxIb29rcygiYmVmb3JlRGF0YUxpbWl0cyIpfWRldGVybWluZURhdGFMaW1pdHMoKXt9YWZ0ZXJEYXRhTGltaXRzKCl7dGhpcy5fY2FsbEhvb2tzKCJhZnRlckRhdGFMaW1pdHMiKX1iZWZvcmVCdWlsZFRpY2tzKCl7dGhpcy5fY2FsbEhvb2tzKCJiZWZvcmVCdWlsZFRpY2tzIil9YnVpbGRUaWNrcygpe3JldHVybltdfWFmdGVyQnVpbGRUaWNrcygpe3RoaXMuX2NhbGxIb29rcygiYWZ0ZXJCdWlsZFRpY2tzIil9YmVmb3JlVGlja1RvTGFiZWxDb252ZXJzaW9uKCl7ZCh0aGlzLm9wdGlvbnMuYmVmb3JlVGlja1RvTGFiZWxDb252ZXJzaW9uLFt0aGlzXSl9Z2VuZXJhdGVUaWNrTGFiZWxzKHQpe2NvbnN0IGU9dGhpcy5vcHRpb25zLnRpY2tzO2xldCBpLHMsbjtmb3IoaT0wLHM9dC5sZW5ndGg7aTxzO2krKyluPXRbaV0sbi5sYWJlbD1kKGUuY2FsbGJhY2ssW24udmFsdWUsaSx0XSx0aGlzKX1hZnRlclRpY2tUb0xhYmVsQ29udmVyc2lvbigpe2QodGhpcy5vcHRpb25zLmFmdGVyVGlja1RvTGFiZWxDb252ZXJzaW9uLFt0aGlzXSl9YmVmb3JlQ2FsY3VsYXRlTGFiZWxSb3RhdGlvbigpe2QodGhpcy5vcHRpb25zLmJlZm9yZUNhbGN1bGF0ZUxhYmVsUm90YXRpb24sW3RoaXNdKX1jYWxjdWxhdGVMYWJlbFJvdGF0aW9uKCl7Y29uc3QgdD10aGlzLm9wdGlvbnMsZT10LnRpY2tzLGk9cXModGhpcy50aWNrcy5sZW5ndGgsdC50aWNrcy5tYXhUaWNrc0xpbWl0KSxzPWUubWluUm90YXRpb258fDAsbj1lLm1heFJvdGF0aW9uO2xldCBvLGEscixsPXM7aWYoIXRoaXMuX2lzVmlzaWJsZSgpfHwhZS5kaXNwbGF5fHxzPj1ufHxpPD0xfHwhdGhpcy5pc0hvcml6b250YWwoKSlyZXR1cm4gdm9pZCh0aGlzLmxhYmVsUm90YXRpb249cyk7Y29uc3QgaD10aGlzLl9nZXRMYWJlbFNpemVzKCksYz1oLndpZGVzdC53aWR0aCxkPWguaGlnaGVzdC5oZWlnaHQsdT1aKHRoaXMuY2hhcnQud2lkdGgtYywwLHRoaXMubWF4V2lkdGgpO289dC5vZmZzZXQ/dGhpcy5tYXhXaWR0aC9pOnUvKGktMSksYys2Pm8mJihvPXUvKGktKHQub2Zmc2V0Py41OjEpKSxhPXRoaXMubWF4SGVpZ2h0LUpzKHQuZ3JpZCktZS5wYWRkaW5nLVpzKHQudGl0bGUsdGhpcy5jaGFydC5vcHRpb25zLmZvbnQpLHI9TWF0aC5zcXJ0KGMqYytkKmQpLGw9WShNYXRoLm1pbihNYXRoLmFzaW4oWigoaC5oaWdoZXN0LmhlaWdodCs2KS9vLC0xLDEpKSxNYXRoLmFzaW4oWihhL3IsLTEsMSkpLU1hdGguYXNpbihaKGQvciwtMSwxKSkpKSxsPU1hdGgubWF4KHMsTWF0aC5taW4obixsKSkpLHRoaXMubGFiZWxSb3RhdGlvbj1sfWFmdGVyQ2FsY3VsYXRlTGFiZWxSb3RhdGlvbigpe2QodGhpcy5vcHRpb25zLmFmdGVyQ2FsY3VsYXRlTGFiZWxSb3RhdGlvbixbdGhpc10pfWFmdGVyQXV0b1NraXAoKXt9YmVmb3JlRml0KCl7ZCh0aGlzLm9wdGlvbnMuYmVmb3JlRml0LFt0aGlzXSl9Zml0KCl7Y29uc3QgdD17d2lkdGg6MCxoZWlnaHQ6MH0se2NoYXJ0OmUsb3B0aW9uczp7dGlja3M6aSx0aXRsZTpzLGdyaWQ6bn19PXRoaXMsbz10aGlzLl9pc1Zpc2libGUoKSxhPXRoaXMuaXNIb3Jpem9udGFsKCk7aWYobyl7Y29uc3Qgbz1acyhzLGUub3B0aW9ucy5mb250KTtpZihhPyh0LndpZHRoPXRoaXMubWF4V2lkdGgsdC5oZWlnaHQ9SnMobikrbyk6KHQuaGVpZ2h0PXRoaXMubWF4SGVpZ2h0LHQud2lkdGg9SnMobikrbyksaS5kaXNwbGF5JiZ0aGlzLnRpY2tzLmxlbmd0aCl7Y29uc3R7Zmlyc3Q6ZSxsYXN0OnMsd2lkZXN0Om4saGlnaGVzdDpvfT10aGlzLl9nZXRMYWJlbFNpemVzKCkscj0yKmkucGFkZGluZyxsPSQodGhpcy5sYWJlbFJvdGF0aW9uKSxoPU1hdGguY29zKGwpLGM9TWF0aC5zaW4obCk7aWYoYSl7Y29uc3QgZT1pLm1pcnJvcj8wOmMqbi53aWR0aCtoKm8uaGVpZ2h0O3QuaGVpZ2h0PU1hdGgubWluKHRoaXMubWF4SGVpZ2h0LHQuaGVpZ2h0K2Urcil9ZWxzZXtjb25zdCBlPWkubWlycm9yPzA6aCpuLndpZHRoK2Mqby5oZWlnaHQ7dC53aWR0aD1NYXRoLm1pbih0aGlzLm1heFdpZHRoLHQud2lkdGgrZStyKX10aGlzLl9jYWxjdWxhdGVQYWRkaW5nKGUscyxjLGgpfX10aGlzLl9oYW5kbGVNYXJnaW5zKCksYT8odGhpcy53aWR0aD10aGlzLl9sZW5ndGg9ZS53aWR0aC10aGlzLl9tYXJnaW5zLmxlZnQtdGhpcy5fbWFyZ2lucy5yaWdodCx0aGlzLmhlaWdodD10LmhlaWdodCk6KHRoaXMud2lkdGg9dC53aWR0aCx0aGlzLmhlaWdodD10aGlzLl9sZW5ndGg9ZS5oZWlnaHQtdGhpcy5fbWFyZ2lucy50b3AtdGhpcy5fbWFyZ2lucy5ib3R0b20pfV9jYWxjdWxhdGVQYWRkaW5nKHQsZSxpLHMpe2NvbnN0e3RpY2tzOnthbGlnbjpuLHBhZGRpbmc6b30scG9zaXRpb246YX09dGhpcy5vcHRpb25zLHI9MCE9PXRoaXMubGFiZWxSb3RhdGlvbixsPSJ0b3AiIT09YSYmIngiPT09dGhpcy5heGlzO2lmKHRoaXMuaXNIb3Jpem9udGFsKCkpe2NvbnN0IGE9dGhpcy5nZXRQaXhlbEZvclRpY2soMCktdGhpcy5sZWZ0LGg9dGhpcy5yaWdodC10aGlzLmdldFBpeGVsRm9yVGljayh0aGlzLnRpY2tzLmxlbmd0aC0xKTtsZXQgYz0wLGQ9MDtyP2w/KGM9cyp0LndpZHRoLGQ9aSplLmhlaWdodCk6KGM9aSp0LmhlaWdodCxkPXMqZS53aWR0aCk6InN0YXJ0Ij09PW4/ZD1lLndpZHRoOiJlbmQiPT09bj9jPXQud2lkdGg6ImlubmVyIiE9PW4mJihjPXQud2lkdGgvMixkPWUud2lkdGgvMiksdGhpcy5wYWRkaW5nTGVmdD1NYXRoLm1heCgoYy1hK28pKnRoaXMud2lkdGgvKHRoaXMud2lkdGgtYSksMCksdGhpcy5wYWRkaW5nUmlnaHQ9TWF0aC5tYXgoKGQtaCtvKSp0aGlzLndpZHRoLyh0aGlzLndpZHRoLWgpLDApfWVsc2V7bGV0IGk9ZS5oZWlnaHQvMixzPXQuaGVpZ2h0LzI7InN0YXJ0Ij09PW4/KGk9MCxzPXQuaGVpZ2h0KToiZW5kIj09PW4mJihpPWUuaGVpZ2h0LHM9MCksdGhpcy5wYWRkaW5nVG9wPWkrbyx0aGlzLnBhZGRpbmdCb3R0b209cytvfX1faGFuZGxlTWFyZ2lucygpe3RoaXMuX21hcmdpbnMmJih0aGlzLl9tYXJnaW5zLmxlZnQ9TWF0aC5tYXgodGhpcy5wYWRkaW5nTGVmdCx0aGlzLl9tYXJnaW5zLmxlZnQpLHRoaXMuX21hcmdpbnMudG9wPU1hdGgubWF4KHRoaXMucGFkZGluZ1RvcCx0aGlzLl9tYXJnaW5zLnRvcCksdGhpcy5fbWFyZ2lucy5yaWdodD1NYXRoLm1heCh0aGlzLnBhZGRpbmdSaWdodCx0aGlzLl9tYXJnaW5zLnJpZ2h0KSx0aGlzLl9tYXJnaW5zLmJvdHRvbT1NYXRoLm1heCh0aGlzLnBhZGRpbmdCb3R0b20sdGhpcy5fbWFyZ2lucy5ib3R0b20pKX1hZnRlckZpdCgpe2QodGhpcy5vcHRpb25zLmFmdGVyRml0LFt0aGlzXSl9aXNIb3Jpem9udGFsKCl7Y29uc3R7YXhpczp0LHBvc2l0aW9uOmV9PXRoaXMub3B0aW9ucztyZXR1cm4idG9wIj09PWV8fCJib3R0b20iPT09ZXx8IngiPT09dH1pc0Z1bGxTaXplKCl7cmV0dXJuIHRoaXMub3B0aW9ucy5mdWxsU2l6ZX1fY29udmVydFRpY2tzVG9MYWJlbHModCl7bGV0IGUsaTtmb3IodGhpcy5iZWZvcmVUaWNrVG9MYWJlbENvbnZlcnNpb24oKSx0aGlzLmdlbmVyYXRlVGlja0xhYmVscyh0KSxlPTAsaT10Lmxlbmd0aDtlPGk7ZSsrKXModFtlXS5sYWJlbCkmJih0LnNwbGljZShlLDEpLGktLSxlLS0pO3RoaXMuYWZ0ZXJUaWNrVG9MYWJlbENvbnZlcnNpb24oKX1fZ2V0TGFiZWxTaXplcygpe2xldCB0PXRoaXMuX2xhYmVsU2l6ZXM7aWYoIXQpe2NvbnN0IGU9dGhpcy5vcHRpb25zLnRpY2tzLnNhbXBsZVNpemU7bGV0IGk9dGhpcy50aWNrcztlPGkubGVuZ3RoJiYoaT1LcyhpLGUpKSx0aGlzLl9sYWJlbFNpemVzPXQ9dGhpcy5fY29tcHV0ZUxhYmVsU2l6ZXMoaSxpLmxlbmd0aCx0aGlzLm9wdGlvbnMudGlja3MubWF4VGlja3NMaW1pdCl9cmV0dXJuIHR9X2NvbXB1dGVMYWJlbFNpemVzKHQsZSxpKXtjb25zdHtjdHg6byxfbG9uZ2VzdFRleHRDYWNoZTphfT10aGlzLHI9W10sbD1bXSxoPU1hdGguZmxvb3IoZS9xcyhlLGkpKTtsZXQgYyxkLGYsZyxwLG0seCxiLF8seSx2LE09MCx3PTA7Zm9yKGM9MDtjPGU7Yys9aCl7aWYoZz10W2NdLmxhYmVsLHA9dGhpcy5fcmVzb2x2ZVRpY2tGb250T3B0aW9ucyhjKSxvLmZvbnQ9bT1wLnN0cmluZyx4PWFbbV09YVttXXx8e2RhdGE6e30sZ2M6W119LGI9cC5saW5lSGVpZ2h0LF89eT0wLHMoZyl8fG4oZykpe2lmKG4oZykpZm9yKGQ9MCxmPWcubGVuZ3RoO2Q8ZjsrK2Qpdj1nW2RdLHModil8fG4odil8fChfPUNlKG8seC5kYXRhLHguZ2MsXyx2KSx5Kz1iKX1lbHNlIF89Q2Uobyx4LmRhdGEseC5nYyxfLGcpLHk9YjtyLnB1c2goXyksbC5wdXNoKHkpLE09TWF0aC5tYXgoXyxNKSx3PU1hdGgubWF4KHksdyl9IWZ1bmN0aW9uKHQsZSl7dSh0LCh0PT57Y29uc3QgaT10LmdjLHM9aS5sZW5ndGgvMjtsZXQgbjtpZihzPmUpe2ZvcihuPTA7bjxzOysrbilkZWxldGUgdC5kYXRhW2lbbl1dO2kuc3BsaWNlKDAscyl9fSkpfShhLGUpO2NvbnN0IGs9ci5pbmRleE9mKE0pLFM9bC5pbmRleE9mKHcpLFA9dD0+KHt3aWR0aDpyW3RdfHwwLGhlaWdodDpsW3RdfHwwfSk7cmV0dXJue2ZpcnN0OlAoMCksbGFzdDpQKGUtMSksd2lkZXN0OlAoayksaGlnaGVzdDpQKFMpLHdpZHRoczpyLGhlaWdodHM6bH19Z2V0TGFiZWxGb3JWYWx1ZSh0KXtyZXR1cm4gdH1nZXRQaXhlbEZvclZhbHVlKHQsZSl7cmV0dXJuIE5hTn1nZXRWYWx1ZUZvclBpeGVsKHQpe31nZXRQaXhlbEZvclRpY2sodCl7Y29uc3QgZT10aGlzLnRpY2tzO3JldHVybiB0PDB8fHQ+ZS5sZW5ndGgtMT9udWxsOnRoaXMuZ2V0UGl4ZWxGb3JWYWx1ZShlW3RdLnZhbHVlKX1nZXRQaXhlbEZvckRlY2ltYWwodCl7dGhpcy5fcmV2ZXJzZVBpeGVscyYmKHQ9MS10KTtjb25zdCBlPXRoaXMuX3N0YXJ0UGl4ZWwrdCp0aGlzLl9sZW5ndGg7cmV0dXJuIFEodGhpcy5fYWxpZ25Ub1BpeGVscz9BZSh0aGlzLmNoYXJ0LGUsMCk6ZSl9Z2V0RGVjaW1hbEZvclBpeGVsKHQpe2NvbnN0IGU9KHQtdGhpcy5fc3RhcnRQaXhlbCkvdGhpcy5fbGVuZ3RoO3JldHVybiB0aGlzLl9yZXZlcnNlUGl4ZWxzPzEtZTplfWdldEJhc2VQaXhlbCgpe3JldHVybiB0aGlzLmdldFBpeGVsRm9yVmFsdWUodGhpcy5nZXRCYXNlVmFsdWUoKSl9Z2V0QmFzZVZhbHVlKCl7Y29uc3R7bWluOnQsbWF4OmV9PXRoaXM7cmV0dXJuIHQ8MCYmZTwwP2U6dD4wJiZlPjA/dDowfWdldENvbnRleHQodCl7Y29uc3QgZT10aGlzLnRpY2tzfHxbXTtpZih0Pj0wJiZ0PGUubGVuZ3RoKXtjb25zdCBpPWVbdF07cmV0dXJuIGkuJGNvbnRleHR8fChpLiRjb250ZXh0PWZ1bmN0aW9uKHQsZSxpKXtyZXR1cm4gQ2kodCx7dGljazppLGluZGV4OmUsdHlwZToidGljayJ9KX0odGhpcy5nZXRDb250ZXh0KCksdCxpKSl9cmV0dXJuIHRoaXMuJGNvbnRleHR8fCh0aGlzLiRjb250ZXh0PUNpKHRoaXMuY2hhcnQuZ2V0Q29udGV4dCgpLHtzY2FsZTp0aGlzLHR5cGU6InNjYWxlIn0pKX1fdGlja1NpemUoKXtjb25zdCB0PXRoaXMub3B0aW9ucy50aWNrcyxlPSQodGhpcy5sYWJlbFJvdGF0aW9uKSxpPU1hdGguYWJzKE1hdGguY29zKGUpKSxzPU1hdGguYWJzKE1hdGguc2luKGUpKSxuPXRoaXMuX2dldExhYmVsU2l6ZXMoKSxvPXQuYXV0b1NraXBQYWRkaW5nfHwwLGE9bj9uLndpZGVzdC53aWR0aCtvOjAscj1uP24uaGlnaGVzdC5oZWlnaHQrbzowO3JldHVybiB0aGlzLmlzSG9yaXpvbnRhbCgpP3IqaT5hKnM/YS9pOnIvczpyKnM8YSppP3IvaTphL3N9X2lzVmlzaWJsZSgpe2NvbnN0IHQ9dGhpcy5vcHRpb25zLmRpc3BsYXk7cmV0dXJuImF1dG8iIT09dD8hIXQ6dGhpcy5nZXRNYXRjaGluZ1Zpc2libGVNZXRhcygpLmxlbmd0aD4wfV9jb21wdXRlR3JpZExpbmVJdGVtcyh0KXtjb25zdCBlPXRoaXMuYXhpcyxpPXRoaXMuY2hhcnQscz10aGlzLm9wdGlvbnMse2dyaWQ6bixwb3NpdGlvbjphLGJvcmRlcjpyfT1zLGg9bi5vZmZzZXQsYz10aGlzLmlzSG9yaXpvbnRhbCgpLGQ9dGhpcy50aWNrcy5sZW5ndGgrKGg/MTowKSx1PUpzKG4pLGY9W10sZz1yLnNldENvbnRleHQodGhpcy5nZXRDb250ZXh0KCkpLHA9Zy5kaXNwbGF5P2cud2lkdGg6MCxtPXAvMix4PWZ1bmN0aW9uKHQpe3JldHVybiBBZShpLHQscCl9O2xldCBiLF8seSx2LE0sdyxrLFMsUCxELEMsTztpZigidG9wIj09PWEpYj14KHRoaXMuYm90dG9tKSx3PXRoaXMuYm90dG9tLXUsUz1iLW0sRD14KHQudG9wKSttLE89dC5ib3R0b207ZWxzZSBpZigiYm90dG9tIj09PWEpYj14KHRoaXMudG9wKSxEPXQudG9wLE89eCh0LmJvdHRvbSktbSx3PWIrbSxTPXRoaXMudG9wK3U7ZWxzZSBpZigibGVmdCI9PT1hKWI9eCh0aGlzLnJpZ2h0KSxNPXRoaXMucmlnaHQtdSxrPWItbSxQPXgodC5sZWZ0KSttLEM9dC5yaWdodDtlbHNlIGlmKCJyaWdodCI9PT1hKWI9eCh0aGlzLmxlZnQpLFA9dC5sZWZ0LEM9eCh0LnJpZ2h0KS1tLE09YittLGs9dGhpcy5sZWZ0K3U7ZWxzZSBpZigieCI9PT1lKXtpZigiY2VudGVyIj09PWEpYj14KCh0LnRvcCt0LmJvdHRvbSkvMisuNSk7ZWxzZSBpZihvKGEpKXtjb25zdCB0PU9iamVjdC5rZXlzKGEpWzBdLGU9YVt0XTtiPXgodGhpcy5jaGFydC5zY2FsZXNbdF0uZ2V0UGl4ZWxGb3JWYWx1ZShlKSl9RD10LnRvcCxPPXQuYm90dG9tLHc9YittLFM9dyt1fWVsc2UgaWYoInkiPT09ZSl7aWYoImNlbnRlciI9PT1hKWI9eCgodC5sZWZ0K3QucmlnaHQpLzIpO2Vsc2UgaWYobyhhKSl7Y29uc3QgdD1PYmplY3Qua2V5cyhhKVswXSxlPWFbdF07Yj14KHRoaXMuY2hhcnQuc2NhbGVzW3RdLmdldFBpeGVsRm9yVmFsdWUoZSkpfU09Yi1tLGs9TS11LFA9dC5sZWZ0LEM9dC5yaWdodH1jb25zdCBBPWwocy50aWNrcy5tYXhUaWNrc0xpbWl0LGQpLFQ9TWF0aC5tYXgoMSxNYXRoLmNlaWwoZC9BKSk7Zm9yKF89MDtfPGQ7Xys9VCl7Y29uc3QgdD10aGlzLmdldENvbnRleHQoXyksZT1uLnNldENvbnRleHQodCkscz1yLnNldENvbnRleHQodCksbz1lLmxpbmVXaWR0aCxhPWUuY29sb3IsbD1zLmRhc2h8fFtdLGQ9cy5kYXNoT2Zmc2V0LHU9ZS50aWNrV2lkdGgsZz1lLnRpY2tDb2xvcixwPWUudGlja0JvcmRlckRhc2h8fFtdLG09ZS50aWNrQm9yZGVyRGFzaE9mZnNldDt5PUdzKHRoaXMsXyxoKSx2b2lkIDAhPT15JiYodj1BZShpLHksbyksYz9NPWs9UD1DPXY6dz1TPUQ9Tz12LGYucHVzaCh7dHgxOk0sdHkxOncsdHgyOmssdHkyOlMseDE6UCx5MTpELHgyOkMseTI6Tyx3aWR0aDpvLGNvbG9yOmEsYm9yZGVyRGFzaDpsLGJvcmRlckRhc2hPZmZzZXQ6ZCx0aWNrV2lkdGg6dSx0aWNrQ29sb3I6Zyx0aWNrQm9yZGVyRGFzaDpwLHRpY2tCb3JkZXJEYXNoT2Zmc2V0Om19KSl9cmV0dXJuIHRoaXMuX3RpY2tzTGVuZ3RoPWQsdGhpcy5fYm9yZGVyVmFsdWU9YixmfV9jb21wdXRlTGFiZWxJdGVtcyh0KXtjb25zdCBlPXRoaXMuYXhpcyxpPXRoaXMub3B0aW9ucyx7cG9zaXRpb246cyx0aWNrczphfT1pLHI9dGhpcy5pc0hvcml6b250YWwoKSxsPXRoaXMudGlja3Mse2FsaWduOmgsY3Jvc3NBbGlnbjpjLHBhZGRpbmc6ZCxtaXJyb3I6dX09YSxmPUpzKGkuZ3JpZCksZz1mK2QscD11Py1kOmcsbT0tJCh0aGlzLmxhYmVsUm90YXRpb24pLHg9W107bGV0IGIsXyx5LHYsTSx3LGssUyxQLEQsQyxPLEE9Im1pZGRsZSI7aWYoInRvcCI9PT1zKXc9dGhpcy5ib3R0b20tcCxrPXRoaXMuX2dldFhBeGlzTGFiZWxBbGlnbm1lbnQoKTtlbHNlIGlmKCJib3R0b20iPT09cyl3PXRoaXMudG9wK3Asaz10aGlzLl9nZXRYQXhpc0xhYmVsQWxpZ25tZW50KCk7ZWxzZSBpZigibGVmdCI9PT1zKXtjb25zdCB0PXRoaXMuX2dldFlBeGlzTGFiZWxBbGlnbm1lbnQoZik7az10LnRleHRBbGlnbixNPXQueH1lbHNlIGlmKCJyaWdodCI9PT1zKXtjb25zdCB0PXRoaXMuX2dldFlBeGlzTGFiZWxBbGlnbm1lbnQoZik7az10LnRleHRBbGlnbixNPXQueH1lbHNlIGlmKCJ4Ij09PWUpe2lmKCJjZW50ZXIiPT09cyl3PSh0LnRvcCt0LmJvdHRvbSkvMitnO2Vsc2UgaWYobyhzKSl7Y29uc3QgdD1PYmplY3Qua2V5cyhzKVswXSxlPXNbdF07dz10aGlzLmNoYXJ0LnNjYWxlc1t0XS5nZXRQaXhlbEZvclZhbHVlKGUpK2d9az10aGlzLl9nZXRYQXhpc0xhYmVsQWxpZ25tZW50KCl9ZWxzZSBpZigieSI9PT1lKXtpZigiY2VudGVyIj09PXMpTT0odC5sZWZ0K3QucmlnaHQpLzItZztlbHNlIGlmKG8ocykpe2NvbnN0IHQ9T2JqZWN0LmtleXMocylbMF0sZT1zW3RdO009dGhpcy5jaGFydC5zY2FsZXNbdF0uZ2V0UGl4ZWxGb3JWYWx1ZShlKX1rPXRoaXMuX2dldFlBeGlzTGFiZWxBbGlnbm1lbnQoZikudGV4dEFsaWdufSJ5Ij09PWUmJigic3RhcnQiPT09aD9BPSJ0b3AiOiJlbmQiPT09aCYmKEE9ImJvdHRvbSIpKTtjb25zdCBUPXRoaXMuX2dldExhYmVsU2l6ZXMoKTtmb3IoYj0wLF89bC5sZW5ndGg7YjxfOysrYil7eT1sW2JdLHY9eS5sYWJlbDtjb25zdCB0PWEuc2V0Q29udGV4dCh0aGlzLmdldENvbnRleHQoYikpO1M9dGhpcy5nZXRQaXhlbEZvclRpY2soYikrYS5sYWJlbE9mZnNldCxQPXRoaXMuX3Jlc29sdmVUaWNrRm9udE9wdGlvbnMoYiksRD1QLmxpbmVIZWlnaHQsQz1uKHYpP3YubGVuZ3RoOjE7Y29uc3QgZT1DLzIsaT10LmNvbG9yLG89dC50ZXh0U3Ryb2tlQ29sb3IsaD10LnRleHRTdHJva2VXaWR0aDtsZXQgZCxmPWs7aWYocj8oTT1TLCJpbm5lciI9PT1rJiYoZj1iPT09Xy0xP3RoaXMub3B0aW9ucy5yZXZlcnNlPyJsZWZ0IjoicmlnaHQiOjA9PT1iP3RoaXMub3B0aW9ucy5yZXZlcnNlPyJyaWdodCI6ImxlZnQiOiJjZW50ZXIiKSxPPSJ0b3AiPT09cz8ibmVhciI9PT1jfHwwIT09bT8tQypEK0QvMjoiY2VudGVyIj09PWM/LVQuaGlnaGVzdC5oZWlnaHQvMi1lKkQrRDotVC5oaWdoZXN0LmhlaWdodCtELzI6Im5lYXIiPT09Y3x8MCE9PW0/RC8yOiJjZW50ZXIiPT09Yz9ULmhpZ2hlc3QuaGVpZ2h0LzItZSpEOlQuaGlnaGVzdC5oZWlnaHQtQypELHUmJihPKj0tMSksMD09PW18fHQuc2hvd0xhYmVsQmFja2Ryb3B8fChNKz1ELzIqTWF0aC5zaW4obSkpKToodz1TLE89KDEtQykqRC8yKSx0LnNob3dMYWJlbEJhY2tkcm9wKXtjb25zdCBlPWtpKHQuYmFja2Ryb3BQYWRkaW5nKSxpPVQuaGVpZ2h0c1tiXSxzPVQud2lkdGhzW2JdO2xldCBuPU8tZS50b3Asbz0wLWUubGVmdDtzd2l0Y2goQSl7Y2FzZSJtaWRkbGUiOm4tPWkvMjticmVhaztjYXNlImJvdHRvbSI6bi09aX1zd2l0Y2goayl7Y2FzZSJjZW50ZXIiOm8tPXMvMjticmVhaztjYXNlInJpZ2h0IjpvLT1zO2JyZWFrO2Nhc2UiaW5uZXIiOmI9PT1fLTE/by09czpiPjAmJihvLT1zLzIpfWQ9e2xlZnQ6byx0b3A6bix3aWR0aDpzK2Uud2lkdGgsaGVpZ2h0OmkrZS5oZWlnaHQsY29sb3I6dC5iYWNrZHJvcENvbG9yfX14LnB1c2goe2xhYmVsOnYsZm9udDpQLHRleHRPZmZzZXQ6TyxvcHRpb25zOntyb3RhdGlvbjptLGNvbG9yOmksc3Ryb2tlQ29sb3I6byxzdHJva2VXaWR0aDpoLHRleHRBbGlnbjpmLHRleHRCYXNlbGluZTpBLHRyYW5zbGF0aW9uOltNLHddLGJhY2tkcm9wOmR9fSl9cmV0dXJuIHh9X2dldFhBeGlzTGFiZWxBbGlnbm1lbnQoKXtjb25zdHtwb3NpdGlvbjp0LHRpY2tzOmV9PXRoaXMub3B0aW9ucztpZigtJCh0aGlzLmxhYmVsUm90YXRpb24pKXJldHVybiJ0b3AiPT09dD8ibGVmdCI6InJpZ2h0IjtsZXQgaT0iY2VudGVyIjtyZXR1cm4ic3RhcnQiPT09ZS5hbGlnbj9pPSJsZWZ0IjoiZW5kIj09PWUuYWxpZ24/aT0icmlnaHQiOiJpbm5lciI9PT1lLmFsaWduJiYoaT0iaW5uZXIiKSxpfV9nZXRZQXhpc0xhYmVsQWxpZ25tZW50KHQpe2NvbnN0e3Bvc2l0aW9uOmUsdGlja3M6e2Nyb3NzQWxpZ246aSxtaXJyb3I6cyxwYWRkaW5nOm59fT10aGlzLm9wdGlvbnMsbz10K24sYT10aGlzLl9nZXRMYWJlbFNpemVzKCkud2lkZXN0LndpZHRoO2xldCByLGw7cmV0dXJuImxlZnQiPT09ZT9zPyhsPXRoaXMucmlnaHQrbiwibmVhciI9PT1pP3I9ImxlZnQiOiJjZW50ZXIiPT09aT8ocj0iY2VudGVyIixsKz1hLzIpOihyPSJyaWdodCIsbCs9YSkpOihsPXRoaXMucmlnaHQtbywibmVhciI9PT1pP3I9InJpZ2h0IjoiY2VudGVyIj09PWk/KHI9ImNlbnRlciIsbC09YS8yKToocj0ibGVmdCIsbD10aGlzLmxlZnQpKToicmlnaHQiPT09ZT9zPyhsPXRoaXMubGVmdCtuLCJuZWFyIj09PWk/cj0icmlnaHQiOiJjZW50ZXIiPT09aT8ocj0iY2VudGVyIixsLT1hLzIpOihyPSJsZWZ0IixsLT1hKSk6KGw9dGhpcy5sZWZ0K28sIm5lYXIiPT09aT9yPSJsZWZ0IjoiY2VudGVyIj09PWk/KHI9ImNlbnRlciIsbCs9YS8yKToocj0icmlnaHQiLGw9dGhpcy5yaWdodCkpOnI9InJpZ2h0Iix7dGV4dEFsaWduOnIseDpsfX1fY29tcHV0ZUxhYmVsQXJlYSgpe2lmKHRoaXMub3B0aW9ucy50aWNrcy5taXJyb3IpcmV0dXJuO2NvbnN0IHQ9dGhpcy5jaGFydCxlPXRoaXMub3B0aW9ucy5wb3NpdGlvbjtyZXR1cm4ibGVmdCI9PT1lfHwicmlnaHQiPT09ZT97dG9wOjAsbGVmdDp0aGlzLmxlZnQsYm90dG9tOnQuaGVpZ2h0LHJpZ2h0OnRoaXMucmlnaHR9OiJ0b3AiPT09ZXx8ImJvdHRvbSI9PT1lP3t0b3A6dGhpcy50b3AsbGVmdDowLGJvdHRvbTp0aGlzLmJvdHRvbSxyaWdodDp0LndpZHRofTp2b2lkIDB9ZHJhd0JhY2tncm91bmQoKXtjb25zdHtjdHg6dCxvcHRpb25zOntiYWNrZ3JvdW5kQ29sb3I6ZX0sbGVmdDppLHRvcDpzLHdpZHRoOm4saGVpZ2h0Om99PXRoaXM7ZSYmKHQuc2F2ZSgpLHQuZmlsbFN0eWxlPWUsdC5maWxsUmVjdChpLHMsbixvKSx0LnJlc3RvcmUoKSl9Z2V0TGluZVdpZHRoRm9yVmFsdWUodCl7Y29uc3QgZT10aGlzLm9wdGlvbnMuZ3JpZDtpZighdGhpcy5faXNWaXNpYmxlKCl8fCFlLmRpc3BsYXkpcmV0dXJuIDA7Y29uc3QgaT10aGlzLnRpY2tzLmZpbmRJbmRleCgoZT0+ZS52YWx1ZT09PXQpKTtpZihpPj0wKXtyZXR1cm4gZS5zZXRDb250ZXh0KHRoaXMuZ2V0Q29udGV4dChpKSkubGluZVdpZHRofXJldHVybiAwfWRyYXdHcmlkKHQpe2NvbnN0IGU9dGhpcy5vcHRpb25zLmdyaWQsaT10aGlzLmN0eCxzPXRoaXMuX2dyaWRMaW5lSXRlbXN8fCh0aGlzLl9ncmlkTGluZUl0ZW1zPXRoaXMuX2NvbXB1dGVHcmlkTGluZUl0ZW1zKHQpKTtsZXQgbixvO2NvbnN0IGE9KHQsZSxzKT0+e3Mud2lkdGgmJnMuY29sb3ImJihpLnNhdmUoKSxpLmxpbmVXaWR0aD1zLndpZHRoLGkuc3Ryb2tlU3R5bGU9cy5jb2xvcixpLnNldExpbmVEYXNoKHMuYm9yZGVyRGFzaHx8W10pLGkubGluZURhc2hPZmZzZXQ9cy5ib3JkZXJEYXNoT2Zmc2V0LGkuYmVnaW5QYXRoKCksaS5tb3ZlVG8odC54LHQueSksaS5saW5lVG8oZS54LGUueSksaS5zdHJva2UoKSxpLnJlc3RvcmUoKSl9O2lmKGUuZGlzcGxheSlmb3Iobj0wLG89cy5sZW5ndGg7bjxvOysrbil7Y29uc3QgdD1zW25dO2UuZHJhd09uQ2hhcnRBcmVhJiZhKHt4OnQueDEseTp0LnkxfSx7eDp0LngyLHk6dC55Mn0sdCksZS5kcmF3VGlja3MmJmEoe3g6dC50eDEseTp0LnR5MX0se3g6dC50eDIseTp0LnR5Mn0se2NvbG9yOnQudGlja0NvbG9yLHdpZHRoOnQudGlja1dpZHRoLGJvcmRlckRhc2g6dC50aWNrQm9yZGVyRGFzaCxib3JkZXJEYXNoT2Zmc2V0OnQudGlja0JvcmRlckRhc2hPZmZzZXR9KX19ZHJhd0JvcmRlcigpe2NvbnN0e2NoYXJ0OnQsY3R4OmUsb3B0aW9uczp7Ym9yZGVyOmksZ3JpZDpzfX09dGhpcyxuPWkuc2V0Q29udGV4dCh0aGlzLmdldENvbnRleHQoKSksbz1pLmRpc3BsYXk/bi53aWR0aDowO2lmKCFvKXJldHVybjtjb25zdCBhPXMuc2V0Q29udGV4dCh0aGlzLmdldENvbnRleHQoMCkpLmxpbmVXaWR0aCxyPXRoaXMuX2JvcmRlclZhbHVlO2xldCBsLGgsYyxkO3RoaXMuaXNIb3Jpem9udGFsKCk/KGw9QWUodCx0aGlzLmxlZnQsbyktby8yLGg9QWUodCx0aGlzLnJpZ2h0LGEpK2EvMixjPWQ9cik6KGM9QWUodCx0aGlzLnRvcCxvKS1vLzIsZD1BZSh0LHRoaXMuYm90dG9tLGEpK2EvMixsPWg9ciksZS5zYXZlKCksZS5saW5lV2lkdGg9bi53aWR0aCxlLnN0cm9rZVN0eWxlPW4uY29sb3IsZS5iZWdpblBhdGgoKSxlLm1vdmVUbyhsLGMpLGUubGluZVRvKGgsZCksZS5zdHJva2UoKSxlLnJlc3RvcmUoKX1kcmF3TGFiZWxzKHQpe2lmKCF0aGlzLm9wdGlvbnMudGlja3MuZGlzcGxheSlyZXR1cm47Y29uc3QgZT10aGlzLmN0eCxpPXRoaXMuX2NvbXB1dGVMYWJlbEFyZWEoKTtpJiZJZShlLGkpO2NvbnN0IHM9dGhpcy5nZXRMYWJlbEl0ZW1zKHQpO2Zvcihjb25zdCB0IG9mIHMpe2NvbnN0IGk9dC5vcHRpb25zLHM9dC5mb250O05lKGUsdC5sYWJlbCwwLHQudGV4dE9mZnNldCxzLGkpfWkmJnplKGUpfWRyYXdUaXRsZSgpe2NvbnN0e2N0eDp0LG9wdGlvbnM6e3Bvc2l0aW9uOmUsdGl0bGU6aSxyZXZlcnNlOnN9fT10aGlzO2lmKCFpLmRpc3BsYXkpcmV0dXJuO2NvbnN0IGE9U2koaS5mb250KSxyPWtpKGkucGFkZGluZyksbD1pLmFsaWduO2xldCBoPWEubGluZUhlaWdodC8yOyJib3R0b20iPT09ZXx8ImNlbnRlciI9PT1lfHxvKGUpPyhoKz1yLmJvdHRvbSxuKGkudGV4dCkmJihoKz1hLmxpbmVIZWlnaHQqKGkudGV4dC5sZW5ndGgtMSkpKTpoKz1yLnRvcDtjb25zdHt0aXRsZVg6Yyx0aXRsZVk6ZCxtYXhXaWR0aDp1LHJvdGF0aW9uOmZ9PWZ1bmN0aW9uKHQsZSxpLHMpe2NvbnN0e3RvcDpuLGxlZnQ6YSxib3R0b206cixyaWdodDpsLGNoYXJ0Omh9PXQse2NoYXJ0QXJlYTpjLHNjYWxlczpkfT1oO2xldCB1LGYsZyxwPTA7Y29uc3QgbT1yLW4seD1sLWE7aWYodC5pc0hvcml6b250YWwoKSl7aWYoZj1mdChzLGEsbCksbyhpKSl7Y29uc3QgdD1PYmplY3Qua2V5cyhpKVswXSxzPWlbdF07Zz1kW3RdLmdldFBpeGVsRm9yVmFsdWUocykrbS1lfWVsc2UgZz0iY2VudGVyIj09PWk/KGMuYm90dG9tK2MudG9wKS8yK20tZTpYcyh0LGksZSk7dT1sLWF9ZWxzZXtpZihvKGkpKXtjb25zdCB0PU9iamVjdC5rZXlzKGkpWzBdLHM9aVt0XTtmPWRbdF0uZ2V0UGl4ZWxGb3JWYWx1ZShzKS14K2V9ZWxzZSBmPSJjZW50ZXIiPT09aT8oYy5sZWZ0K2MucmlnaHQpLzIteCtlOlhzKHQsaSxlKTtnPWZ0KHMscixuKSxwPSJsZWZ0Ij09PWk/LUU6RX1yZXR1cm57dGl0bGVYOmYsdGl0bGVZOmcsbWF4V2lkdGg6dSxyb3RhdGlvbjpwfX0odGhpcyxoLGUsbCk7TmUodCxpLnRleHQsMCwwLGEse2NvbG9yOmkuY29sb3IsbWF4V2lkdGg6dSxyb3RhdGlvbjpmLHRleHRBbGlnbjpRcyhsLGUscyksdGV4dEJhc2VsaW5lOiJtaWRkbGUiLHRyYW5zbGF0aW9uOltjLGRdfSl9ZHJhdyh0KXt0aGlzLl9pc1Zpc2libGUoKSYmKHRoaXMuZHJhd0JhY2tncm91bmQoKSx0aGlzLmRyYXdHcmlkKHQpLHRoaXMuZHJhd0JvcmRlcigpLHRoaXMuZHJhd1RpdGxlKCksdGhpcy5kcmF3TGFiZWxzKHQpKX1fbGF5ZXJzKCl7Y29uc3QgdD10aGlzLm9wdGlvbnMsZT10LnRpY2tzJiZ0LnRpY2tzLnp8fDAsaT1sKHQuZ3JpZCYmdC5ncmlkLnosLTEpLHM9bCh0LmJvcmRlciYmdC5ib3JkZXIueiwwKTtyZXR1cm4gdGhpcy5faXNWaXNpYmxlKCkmJnRoaXMuZHJhdz09PXRuLnByb3RvdHlwZS5kcmF3P1t7ejppLGRyYXc6dD0+e3RoaXMuZHJhd0JhY2tncm91bmQoKSx0aGlzLmRyYXdHcmlkKHQpLHRoaXMuZHJhd1RpdGxlKCl9fSx7ejpzLGRyYXc6KCk9Pnt0aGlzLmRyYXdCb3JkZXIoKX19LHt6OmUsZHJhdzp0PT57dGhpcy5kcmF3TGFiZWxzKHQpfX1dOlt7ejplLGRyYXc6dD0+e3RoaXMuZHJhdyh0KX19XX1nZXRNYXRjaGluZ1Zpc2libGVNZXRhcyh0KXtjb25zdCBlPXRoaXMuY2hhcnQuZ2V0U29ydGVkVmlzaWJsZURhdGFzZXRNZXRhcygpLGk9dGhpcy5heGlzKyJBeGlzSUQiLHM9W107bGV0IG4sbztmb3Iobj0wLG89ZS5sZW5ndGg7bjxvOysrbil7Y29uc3Qgbz1lW25dO29baV0hPT10aGlzLmlkfHx0JiZvLnR5cGUhPT10fHxzLnB1c2gobyl9cmV0dXJuIHN9X3Jlc29sdmVUaWNrRm9udE9wdGlvbnModCl7cmV0dXJuIFNpKHRoaXMub3B0aW9ucy50aWNrcy5zZXRDb250ZXh0KHRoaXMuZ2V0Q29udGV4dCh0KSkuZm9udCl9X21heERpZ2l0cygpe2NvbnN0IHQ9dGhpcy5fcmVzb2x2ZVRpY2tGb250T3B0aW9ucygwKS5saW5lSGVpZ2h0O3JldHVybih0aGlzLmlzSG9yaXpvbnRhbCgpP3RoaXMud2lkdGg6dGhpcy5oZWlnaHQpL3R9fWNsYXNzIGVue2NvbnN0cnVjdG9yKHQsZSxpKXt0aGlzLnR5cGU9dCx0aGlzLnNjb3BlPWUsdGhpcy5vdmVycmlkZT1pLHRoaXMuaXRlbXM9T2JqZWN0LmNyZWF0ZShudWxsKX1pc0ZvclR5cGUodCl7cmV0dXJuIE9iamVjdC5wcm90b3R5cGUuaXNQcm90b3R5cGVPZi5jYWxsKHRoaXMudHlwZS5wcm90b3R5cGUsdC5wcm90b3R5cGUpfXJlZ2lzdGVyKHQpe2NvbnN0IGU9T2JqZWN0LmdldFByb3RvdHlwZU9mKHQpO2xldCBpOyhmdW5jdGlvbih0KXtyZXR1cm4iaWQiaW4gdCYmImRlZmF1bHRzImluIHR9KShlKSYmKGk9dGhpcy5yZWdpc3RlcihlKSk7Y29uc3Qgcz10aGlzLml0ZW1zLG49dC5pZCxvPXRoaXMuc2NvcGUrIi4iK247aWYoIW4pdGhyb3cgbmV3IEVycm9yKCJjbGFzcyBkb2VzIG5vdCBoYXZlIGlkOiAiK3QpO3JldHVybiBuIGluIHN8fChzW25dPXQsZnVuY3Rpb24odCxlLGkpe2NvbnN0IHM9eChPYmplY3QuY3JlYXRlKG51bGwpLFtpP3VlLmdldChpKTp7fSx1ZS5nZXQoZSksdC5kZWZhdWx0c10pO3VlLnNldChlLHMpLHQuZGVmYXVsdFJvdXRlcyYmZnVuY3Rpb24odCxlKXtPYmplY3Qua2V5cyhlKS5mb3JFYWNoKChpPT57Y29uc3Qgcz1pLnNwbGl0KCIuIiksbj1zLnBvcCgpLG89W3RdLmNvbmNhdChzKS5qb2luKCIuIiksYT1lW2ldLnNwbGl0KCIuIikscj1hLnBvcCgpLGw9YS5qb2luKCIuIik7dWUucm91dGUobyxuLGwscil9KSl9KGUsdC5kZWZhdWx0Um91dGVzKTt0LmRlc2NyaXB0b3JzJiZ1ZS5kZXNjcmliZShlLHQuZGVzY3JpcHRvcnMpfSh0LG8saSksdGhpcy5vdmVycmlkZSYmdWUub3ZlcnJpZGUodC5pZCx0Lm92ZXJyaWRlcykpLG99Z2V0KHQpe3JldHVybiB0aGlzLml0ZW1zW3RdfXVucmVnaXN0ZXIodCl7Y29uc3QgZT10aGlzLml0ZW1zLGk9dC5pZCxzPXRoaXMuc2NvcGU7aSBpbiBlJiZkZWxldGUgZVtpXSxzJiZpIGluIHVlW3NdJiYoZGVsZXRlIHVlW3NdW2ldLHRoaXMub3ZlcnJpZGUmJmRlbGV0ZSByZVtpXSl9fWNsYXNzIHNue2NvbnN0cnVjdG9yKCl7dGhpcy5jb250cm9sbGVycz1uZXcgZW4oanMsImRhdGFzZXRzIiwhMCksdGhpcy5lbGVtZW50cz1uZXcgZW4oJHMsImVsZW1lbnRzIiksdGhpcy5wbHVnaW5zPW5ldyBlbihPYmplY3QsInBsdWdpbnMiKSx0aGlzLnNjYWxlcz1uZXcgZW4odG4sInNjYWxlcyIpLHRoaXMuX3R5cGVkUmVnaXN0cmllcz1bdGhpcy5jb250cm9sbGVycyx0aGlzLnNjYWxlcyx0aGlzLmVsZW1lbnRzXX1hZGQoLi4udCl7dGhpcy5fZWFjaCgicmVnaXN0ZXIiLHQpfXJlbW92ZSguLi50KXt0aGlzLl9lYWNoKCJ1bnJlZ2lzdGVyIix0KX1hZGRDb250cm9sbGVycyguLi50KXt0aGlzLl9lYWNoKCJyZWdpc3RlciIsdCx0aGlzLmNvbnRyb2xsZXJzKX1hZGRFbGVtZW50cyguLi50KXt0aGlzLl9lYWNoKCJyZWdpc3RlciIsdCx0aGlzLmVsZW1lbnRzKX1hZGRQbHVnaW5zKC4uLnQpe3RoaXMuX2VhY2goInJlZ2lzdGVyIix0LHRoaXMucGx1Z2lucyl9YWRkU2NhbGVzKC4uLnQpe3RoaXMuX2VhY2goInJlZ2lzdGVyIix0LHRoaXMuc2NhbGVzKX1nZXRDb250cm9sbGVyKHQpe3JldHVybiB0aGlzLl9nZXQodCx0aGlzLmNvbnRyb2xsZXJzLCJjb250cm9sbGVyIil9Z2V0RWxlbWVudCh0KXtyZXR1cm4gdGhpcy5fZ2V0KHQsdGhpcy5lbGVtZW50cywiZWxlbWVudCIpfWdldFBsdWdpbih0KXtyZXR1cm4gdGhpcy5fZ2V0KHQsdGhpcy5wbHVnaW5zLCJwbHVnaW4iKX1nZXRTY2FsZSh0KXtyZXR1cm4gdGhpcy5fZ2V0KHQsdGhpcy5zY2FsZXMsInNjYWxlIil9cmVtb3ZlQ29udHJvbGxlcnMoLi4udCl7dGhpcy5fZWFjaCgidW5yZWdpc3RlciIsdCx0aGlzLmNvbnRyb2xsZXJzKX1yZW1vdmVFbGVtZW50cyguLi50KXt0aGlzLl9lYWNoKCJ1bnJlZ2lzdGVyIix0LHRoaXMuZWxlbWVudHMpfXJlbW92ZVBsdWdpbnMoLi4udCl7dGhpcy5fZWFjaCgidW5yZWdpc3RlciIsdCx0aGlzLnBsdWdpbnMpfXJlbW92ZVNjYWxlcyguLi50KXt0aGlzLl9lYWNoKCJ1bnJlZ2lzdGVyIix0LHRoaXMuc2NhbGVzKX1fZWFjaCh0LGUsaSl7Wy4uLmVdLmZvckVhY2goKGU9Pntjb25zdCBzPWl8fHRoaXMuX2dldFJlZ2lzdHJ5Rm9yVHlwZShlKTtpfHxzLmlzRm9yVHlwZShlKXx8cz09PXRoaXMucGx1Z2lucyYmZS5pZD90aGlzLl9leGVjKHQscyxlKTp1KGUsKGU9Pntjb25zdCBzPWl8fHRoaXMuX2dldFJlZ2lzdHJ5Rm9yVHlwZShlKTt0aGlzLl9leGVjKHQscyxlKX0pKX0pKX1fZXhlYyh0LGUsaSl7Y29uc3Qgcz13KHQpO2QoaVsiYmVmb3JlIitzXSxbXSxpKSxlW3RdKGkpLGQoaVsiYWZ0ZXIiK3NdLFtdLGkpfV9nZXRSZWdpc3RyeUZvclR5cGUodCl7Zm9yKGxldCBlPTA7ZTx0aGlzLl90eXBlZFJlZ2lzdHJpZXMubGVuZ3RoO2UrKyl7Y29uc3QgaT10aGlzLl90eXBlZFJlZ2lzdHJpZXNbZV07aWYoaS5pc0ZvclR5cGUodCkpcmV0dXJuIGl9cmV0dXJuIHRoaXMucGx1Z2luc31fZ2V0KHQsZSxpKXtjb25zdCBzPWUuZ2V0KHQpO2lmKHZvaWQgMD09PXMpdGhyb3cgbmV3IEVycm9yKCciJyt0KyciIGlzIG5vdCBhIHJlZ2lzdGVyZWQgJytpKyIuIik7cmV0dXJuIHN9fXZhciBubj1uZXcgc247Y2xhc3Mgb257Y29uc3RydWN0b3IoKXt0aGlzLl9pbml0PXZvaWQgMH1ub3RpZnkodCxlLGkscyl7aWYoImJlZm9yZUluaXQiPT09ZSYmKHRoaXMuX2luaXQ9dGhpcy5fY3JlYXRlRGVzY3JpcHRvcnModCwhMCksdGhpcy5fbm90aWZ5KHRoaXMuX2luaXQsdCwiaW5zdGFsbCIpKSx2b2lkIDA9PT10aGlzLl9pbml0KXJldHVybjtjb25zdCBuPXM/dGhpcy5fZGVzY3JpcHRvcnModCkuZmlsdGVyKHMpOnRoaXMuX2Rlc2NyaXB0b3JzKHQpLG89dGhpcy5fbm90aWZ5KG4sdCxlLGkpO3JldHVybiJhZnRlckRlc3Ryb3kiPT09ZSYmKHRoaXMuX25vdGlmeShuLHQsInN0b3AiKSx0aGlzLl9ub3RpZnkodGhpcy5faW5pdCx0LCJ1bmluc3RhbGwiKSx0aGlzLl9pbml0PXZvaWQgMCksb31fbm90aWZ5KHQsZSxpLHMpe3M9c3x8e307Zm9yKGNvbnN0IG4gb2YgdCl7Y29uc3QgdD1uLnBsdWdpbjtpZighMT09PWQodFtpXSxbZSxzLG4ub3B0aW9uc10sdCkmJnMuY2FuY2VsYWJsZSlyZXR1cm4hMX1yZXR1cm4hMH1pbnZhbGlkYXRlKCl7cyh0aGlzLl9jYWNoZSl8fCh0aGlzLl9vbGRDYWNoZT10aGlzLl9jYWNoZSx0aGlzLl9jYWNoZT12b2lkIDApfV9kZXNjcmlwdG9ycyh0KXtpZih0aGlzLl9jYWNoZSlyZXR1cm4gdGhpcy5fY2FjaGU7Y29uc3QgZT10aGlzLl9jYWNoZT10aGlzLl9jcmVhdGVEZXNjcmlwdG9ycyh0KTtyZXR1cm4gdGhpcy5fbm90aWZ5U3RhdGVDaGFuZ2VzKHQpLGV9X2NyZWF0ZURlc2NyaXB0b3JzKHQsZSl7Y29uc3QgaT10JiZ0LmNvbmZpZyxzPWwoaS5vcHRpb25zJiZpLm9wdGlvbnMucGx1Z2lucyx7fSksbj1mdW5jdGlvbih0KXtjb25zdCBlPXt9LGk9W10scz1PYmplY3Qua2V5cyhubi5wbHVnaW5zLml0ZW1zKTtmb3IobGV0IHQ9MDt0PHMubGVuZ3RoO3QrKylpLnB1c2gobm4uZ2V0UGx1Z2luKHNbdF0pKTtjb25zdCBuPXQucGx1Z2luc3x8W107Zm9yKGxldCB0PTA7dDxuLmxlbmd0aDt0Kyspe2NvbnN0IHM9blt0XTstMT09PWkuaW5kZXhPZihzKSYmKGkucHVzaChzKSxlW3MuaWRdPSEwKX1yZXR1cm57cGx1Z2luczppLGxvY2FsSWRzOmV9fShpKTtyZXR1cm4hMSE9PXN8fGU/ZnVuY3Rpb24odCx7cGx1Z2luczplLGxvY2FsSWRzOml9LHMsbil7Y29uc3Qgbz1bXSxhPXQuZ2V0Q29udGV4dCgpO2Zvcihjb25zdCByIG9mIGUpe2NvbnN0IGU9ci5pZCxsPWFuKHNbZV0sbik7bnVsbCE9PWwmJm8ucHVzaCh7cGx1Z2luOnIsb3B0aW9uczpybih0LmNvbmZpZyx7cGx1Z2luOnIsbG9jYWw6aVtlXX0sbCxhKX0pfXJldHVybiBvfSh0LG4scyxlKTpbXX1fbm90aWZ5U3RhdGVDaGFuZ2VzKHQpe2NvbnN0IGU9dGhpcy5fb2xkQ2FjaGV8fFtdLGk9dGhpcy5fY2FjaGUscz0odCxlKT0+dC5maWx0ZXIoKHQ9PiFlLnNvbWUoKGU9PnQucGx1Z2luLmlkPT09ZS5wbHVnaW4uaWQpKSkpO3RoaXMuX25vdGlmeShzKGUsaSksdCwic3RvcCIpLHRoaXMuX25vdGlmeShzKGksZSksdCwic3RhcnQiKX19ZnVuY3Rpb24gYW4odCxlKXtyZXR1cm4gZXx8ITEhPT10PyEwPT09dD97fTp0Om51bGx9ZnVuY3Rpb24gcm4odCx7cGx1Z2luOmUsbG9jYWw6aX0scyxuKXtjb25zdCBvPXQucGx1Z2luU2NvcGVLZXlzKGUpLGE9dC5nZXRPcHRpb25TY29wZXMocyxvKTtyZXR1cm4gaSYmZS5kZWZhdWx0cyYmYS5wdXNoKGUuZGVmYXVsdHMpLHQuY3JlYXRlUmVzb2x2ZXIoYSxuLFsiIl0se3NjcmlwdGFibGU6ITEsaW5kZXhhYmxlOiExLGFsbEtleXM6ITB9KX1mdW5jdGlvbiBsbih0LGUpe2NvbnN0IGk9dWUuZGF0YXNldHNbdF18fHt9O3JldHVybigoZS5kYXRhc2V0c3x8e30pW3RdfHx7fSkuaW5kZXhBeGlzfHxlLmluZGV4QXhpc3x8aS5pbmRleEF4aXN8fCJ4In1mdW5jdGlvbiBobih0KXtpZigieCI9PT10fHwieSI9PT10fHwiciI9PT10KXJldHVybiB0fWZ1bmN0aW9uIGNuKHQsLi4uZSl7aWYoaG4odCkpcmV0dXJuIHQ7Zm9yKGNvbnN0IHMgb2YgZSl7Y29uc3QgZT1zLmF4aXN8fCgidG9wIj09PShpPXMucG9zaXRpb24pfHwiYm90dG9tIj09PWk/IngiOiJsZWZ0Ij09PWl8fCJyaWdodCI9PT1pPyJ5Ijp2b2lkIDApfHx0Lmxlbmd0aD4xJiZobih0WzBdLnRvTG93ZXJDYXNlKCkpO2lmKGUpcmV0dXJuIGV9dmFyIGk7dGhyb3cgbmV3IEVycm9yKGBDYW5ub3QgZGV0ZXJtaW5lIHR5cGUgb2YgJyR7dH0nIGF4aXMuIFBsZWFzZSBwcm92aWRlICdheGlzJyBvciAncG9zaXRpb24nIG9wdGlvbi5gKX1mdW5jdGlvbiBkbih0LGUsaSl7aWYoaVtlKyJBeGlzSUQiXT09PXQpcmV0dXJue2F4aXM6ZX19ZnVuY3Rpb24gdW4odCxlKXtjb25zdCBpPXJlW3QudHlwZV18fHtzY2FsZXM6e319LHM9ZS5zY2FsZXN8fHt9LG49bG4odC50eXBlLGUpLGE9T2JqZWN0LmNyZWF0ZShudWxsKTtyZXR1cm4gT2JqZWN0LmtleXMocykuZm9yRWFjaCgoZT0+e2NvbnN0IHI9c1tlXTtpZighbyhyKSlyZXR1cm4gY29uc29sZS5lcnJvcihgSW52YWxpZCBzY2FsZSBjb25maWd1cmF0aW9uIGZvciBzY2FsZTogJHtlfWApO2lmKHIuX3Byb3h5KXJldHVybiBjb25zb2xlLndhcm4oYElnbm9yaW5nIHJlc29sdmVyIHBhc3NlZCBhcyBvcHRpb25zIGZvciBzY2FsZTogJHtlfWApO2NvbnN0IGw9Y24oZSxyLGZ1bmN0aW9uKHQsZSl7aWYoZS5kYXRhJiZlLmRhdGEuZGF0YXNldHMpe2NvbnN0IGk9ZS5kYXRhLmRhdGFzZXRzLmZpbHRlcigoZT0+ZS54QXhpc0lEPT09dHx8ZS55QXhpc0lEPT09dCkpO2lmKGkubGVuZ3RoKXJldHVybiBkbih0LCJ4IixpWzBdKXx8ZG4odCwieSIsaVswXSl9cmV0dXJue319KGUsdCksdWUuc2NhbGVzW3IudHlwZV0pLGg9ZnVuY3Rpb24odCxlKXtyZXR1cm4gdD09PWU/Il9pbmRleF8iOiJfdmFsdWVfIn0obCxuKSxjPWkuc2NhbGVzfHx7fTthW2VdPWIoT2JqZWN0LmNyZWF0ZShudWxsKSxbe2F4aXM6bH0scixjW2xdLGNbaF1dKX0pKSx0LmRhdGEuZGF0YXNldHMuZm9yRWFjaCgoaT0+e2NvbnN0IG49aS50eXBlfHx0LnR5cGUsbz1pLmluZGV4QXhpc3x8bG4obixlKSxyPShyZVtuXXx8e30pLnNjYWxlc3x8e307T2JqZWN0LmtleXMocikuZm9yRWFjaCgodD0+e2NvbnN0IGU9ZnVuY3Rpb24odCxlKXtsZXQgaT10O3JldHVybiJfaW5kZXhfIj09PXQ/aT1lOiJfdmFsdWVfIj09PXQmJihpPSJ4Ij09PWU/InkiOiJ4IiksaX0odCxvKSxuPWlbZSsiQXhpc0lEIl18fGU7YVtuXT1hW25dfHxPYmplY3QuY3JlYXRlKG51bGwpLGIoYVtuXSxbe2F4aXM6ZX0sc1tuXSxyW3RdXSl9KSl9KSksT2JqZWN0LmtleXMoYSkuZm9yRWFjaCgodD0+e2NvbnN0IGU9YVt0XTtiKGUsW3VlLnNjYWxlc1tlLnR5cGVdLHVlLnNjYWxlXSl9KSksYX1mdW5jdGlvbiBmbih0KXtjb25zdCBlPXQub3B0aW9uc3x8KHQub3B0aW9ucz17fSk7ZS5wbHVnaW5zPWwoZS5wbHVnaW5zLHt9KSxlLnNjYWxlcz11bih0LGUpfWZ1bmN0aW9uIGduKHQpe3JldHVybih0PXR8fHt9KS5kYXRhc2V0cz10LmRhdGFzZXRzfHxbXSx0LmxhYmVscz10LmxhYmVsc3x8W10sdH1jb25zdCBwbj1uZXcgTWFwLG1uPW5ldyBTZXQ7ZnVuY3Rpb24geG4odCxlKXtsZXQgaT1wbi5nZXQodCk7cmV0dXJuIGl8fChpPWUoKSxwbi5zZXQodCxpKSxtbi5hZGQoaSkpLGl9Y29uc3QgYm49KHQsZSxpKT0+e2NvbnN0IHM9TShlLGkpO3ZvaWQgMCE9PXMmJnQuYWRkKHMpfTtjbGFzcyBfbntjb25zdHJ1Y3Rvcih0KXt0aGlzLl9jb25maWc9ZnVuY3Rpb24odCl7cmV0dXJuKHQ9dHx8e30pLmRhdGE9Z24odC5kYXRhKSxmbih0KSx0fSh0KSx0aGlzLl9zY29wZUNhY2hlPW5ldyBNYXAsdGhpcy5fcmVzb2x2ZXJDYWNoZT1uZXcgTWFwfWdldCBwbGF0Zm9ybSgpe3JldHVybiB0aGlzLl9jb25maWcucGxhdGZvcm19Z2V0IHR5cGUoKXtyZXR1cm4gdGhpcy5fY29uZmlnLnR5cGV9c2V0IHR5cGUodCl7dGhpcy5fY29uZmlnLnR5cGU9dH1nZXQgZGF0YSgpe3JldHVybiB0aGlzLl9jb25maWcuZGF0YX1zZXQgZGF0YSh0KXt0aGlzLl9jb25maWcuZGF0YT1nbih0KX1nZXQgb3B0aW9ucygpe3JldHVybiB0aGlzLl9jb25maWcub3B0aW9uc31zZXQgb3B0aW9ucyh0KXt0aGlzLl9jb25maWcub3B0aW9ucz10fWdldCBwbHVnaW5zKCl7cmV0dXJuIHRoaXMuX2NvbmZpZy5wbHVnaW5zfXVwZGF0ZSgpe2NvbnN0IHQ9dGhpcy5fY29uZmlnO3RoaXMuY2xlYXJDYWNoZSgpLGZuKHQpfWNsZWFyQ2FjaGUoKXt0aGlzLl9zY29wZUNhY2hlLmNsZWFyKCksdGhpcy5fcmVzb2x2ZXJDYWNoZS5jbGVhcigpfWRhdGFzZXRTY29wZUtleXModCl7cmV0dXJuIHhuKHQsKCgpPT5bW2BkYXRhc2V0cy4ke3R9YCwiIl1dKSl9ZGF0YXNldEFuaW1hdGlvblNjb3BlS2V5cyh0LGUpe3JldHVybiB4bihgJHt0fS50cmFuc2l0aW9uLiR7ZX1gLCgoKT0+W1tgZGF0YXNldHMuJHt0fS50cmFuc2l0aW9ucy4ke2V9YCxgdHJhbnNpdGlvbnMuJHtlfWBdLFtgZGF0YXNldHMuJHt0fWAsIiJdXSkpfWRhdGFzZXRFbGVtZW50U2NvcGVLZXlzKHQsZSl7cmV0dXJuIHhuKGAke3R9LSR7ZX1gLCgoKT0+W1tgZGF0YXNldHMuJHt0fS5lbGVtZW50cy4ke2V9YCxgZGF0YXNldHMuJHt0fWAsYGVsZW1lbnRzLiR7ZX1gLCIiXV0pKX1wbHVnaW5TY29wZUtleXModCl7Y29uc3QgZT10LmlkO3JldHVybiB4bihgJHt0aGlzLnR5cGV9LXBsdWdpbi0ke2V9YCwoKCk9PltbYHBsdWdpbnMuJHtlfWAsLi4udC5hZGRpdGlvbmFsT3B0aW9uU2NvcGVzfHxbXV1dKSl9X2NhY2hlZFNjb3Blcyh0LGUpe2NvbnN0IGk9dGhpcy5fc2NvcGVDYWNoZTtsZXQgcz1pLmdldCh0KTtyZXR1cm4gcyYmIWV8fChzPW5ldyBNYXAsaS5zZXQodCxzKSksc31nZXRPcHRpb25TY29wZXModCxlLGkpe2NvbnN0e29wdGlvbnM6cyx0eXBlOm59PXRoaXMsbz10aGlzLl9jYWNoZWRTY29wZXModCxpKSxhPW8uZ2V0KGUpO2lmKGEpcmV0dXJuIGE7Y29uc3Qgcj1uZXcgU2V0O2UuZm9yRWFjaCgoZT0+e3QmJihyLmFkZCh0KSxlLmZvckVhY2goKGU9PmJuKHIsdCxlKSkpKSxlLmZvckVhY2goKHQ9PmJuKHIscyx0KSkpLGUuZm9yRWFjaCgodD0+Ym4ocixyZVtuXXx8e30sdCkpKSxlLmZvckVhY2goKHQ9PmJuKHIsdWUsdCkpKSxlLmZvckVhY2goKHQ9PmJuKHIsbGUsdCkpKX0pKTtjb25zdCBsPUFycmF5LmZyb20ocik7cmV0dXJuIDA9PT1sLmxlbmd0aCYmbC5wdXNoKE9iamVjdC5jcmVhdGUobnVsbCkpLG1uLmhhcyhlKSYmby5zZXQoZSxsKSxsfWNoYXJ0T3B0aW9uU2NvcGVzKCl7Y29uc3R7b3B0aW9uczp0LHR5cGU6ZX09dGhpcztyZXR1cm5bdCxyZVtlXXx8e30sdWUuZGF0YXNldHNbZV18fHt9LHt0eXBlOmV9LHVlLGxlXX1yZXNvbHZlTmFtZWRPcHRpb25zKHQsZSxpLHM9WyIiXSl7Y29uc3Qgbz17JHNoYXJlZDohMH0se3Jlc29sdmVyOmEsc3ViUHJlZml4ZXM6cn09eW4odGhpcy5fcmVzb2x2ZXJDYWNoZSx0LHMpO2xldCBsPWE7aWYoZnVuY3Rpb24odCxlKXtjb25zdHtpc1NjcmlwdGFibGU6aSxpc0luZGV4YWJsZTpzfT1ZZSh0KTtmb3IoY29uc3QgbyBvZiBlKXtjb25zdCBlPWkobyksYT1zKG8pLHI9KGF8fGUpJiZ0W29dO2lmKGUmJihTKHIpfHx2bihyKSl8fGEmJm4ocikpcmV0dXJuITB9cmV0dXJuITF9KGEsZSkpe28uJHNoYXJlZD0hMTtsPSRlKGEsaT1TKGkpP2koKTppLHRoaXMuY3JlYXRlUmVzb2x2ZXIodCxpLHIpKX1mb3IoY29uc3QgdCBvZiBlKW9bdF09bFt0XTtyZXR1cm4gb31jcmVhdGVSZXNvbHZlcih0LGUsaT1bIiJdLHMpe2NvbnN0e3Jlc29sdmVyOm59PXluKHRoaXMuX3Jlc29sdmVyQ2FjaGUsdCxpKTtyZXR1cm4gbyhlKT8kZShuLGUsdm9pZCAwLHMpOm59fWZ1bmN0aW9uIHluKHQsZSxpKXtsZXQgcz10LmdldChlKTtzfHwocz1uZXcgTWFwLHQuc2V0KGUscykpO2NvbnN0IG49aS5qb2luKCk7bGV0IG89cy5nZXQobik7aWYoIW8pe289e3Jlc29sdmVyOmplKGUsaSksc3ViUHJlZml4ZXM6aS5maWx0ZXIoKHQ9PiF0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoImhvdmVyIikpKX0scy5zZXQobixvKX1yZXR1cm4gb31jb25zdCB2bj10PT5vKHQpJiZPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh0KS5zb21lKChlPT5TKHRbZV0pKSk7Y29uc3QgTW49WyJ0b3AiLCJib3R0b20iLCJsZWZ0IiwicmlnaHQiLCJjaGFydEFyZWEiXTtmdW5jdGlvbiB3bih0LGUpe3JldHVybiJ0b3AiPT09dHx8ImJvdHRvbSI9PT10fHwtMT09PU1uLmluZGV4T2YodCkmJiJ4Ij09PWV9ZnVuY3Rpb24ga24odCxlKXtyZXR1cm4gZnVuY3Rpb24oaSxzKXtyZXR1cm4gaVt0XT09PXNbdF0/aVtlXS1zW2VdOmlbdF0tc1t0XX19ZnVuY3Rpb24gU24odCl7Y29uc3QgZT10LmNoYXJ0LGk9ZS5vcHRpb25zLmFuaW1hdGlvbjtlLm5vdGlmeVBsdWdpbnMoImFmdGVyUmVuZGVyIiksZChpJiZpLm9uQ29tcGxldGUsW3RdLGUpfWZ1bmN0aW9uIFBuKHQpe2NvbnN0IGU9dC5jaGFydCxpPWUub3B0aW9ucy5hbmltYXRpb247ZChpJiZpLm9uUHJvZ3Jlc3MsW3RdLGUpfWZ1bmN0aW9uIERuKHQpe3JldHVybiBmZSgpJiYic3RyaW5nIj09dHlwZW9mIHQ/dD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCh0KTp0JiZ0Lmxlbmd0aCYmKHQ9dFswXSksdCYmdC5jYW52YXMmJih0PXQuY2FudmFzKSx0fWNvbnN0IENuPXt9LE9uPXQ9Pntjb25zdCBlPURuKHQpO3JldHVybiBPYmplY3QudmFsdWVzKENuKS5maWx0ZXIoKHQ9PnQuY2FudmFzPT09ZSkpLnBvcCgpfTtmdW5jdGlvbiBBbih0LGUsaSl7Y29uc3Qgcz1PYmplY3Qua2V5cyh0KTtmb3IoY29uc3QgbiBvZiBzKXtjb25zdCBzPStuO2lmKHM+PWUpe2NvbnN0IG89dFtuXTtkZWxldGUgdFtuXSwoaT4wfHxzPmUpJiYodFtzK2ldPW8pfX19Y2xhc3MgVG57c3RhdGljIGRlZmF1bHRzPXVlO3N0YXRpYyBpbnN0YW5jZXM9Q247c3RhdGljIG92ZXJyaWRlcz1yZTtzdGF0aWMgcmVnaXN0cnk9bm47c3RhdGljIHZlcnNpb249IjQuNS4xIjtzdGF0aWMgZ2V0Q2hhcnQ9T247c3RhdGljIHJlZ2lzdGVyKC4uLnQpe25uLmFkZCguLi50KSxMbigpfXN0YXRpYyB1bnJlZ2lzdGVyKC4uLnQpe25uLnJlbW92ZSguLi50KSxMbigpfWNvbnN0cnVjdG9yKHQsZSl7Y29uc3Qgcz10aGlzLmNvbmZpZz1uZXcgX24oZSksbj1Ebih0KSxvPU9uKG4pO2lmKG8pdGhyb3cgbmV3IEVycm9yKCJDYW52YXMgaXMgYWxyZWFkeSBpbiB1c2UuIENoYXJ0IHdpdGggSUQgJyIrby5pZCsiJyBtdXN0IGJlIGRlc3Ryb3llZCBiZWZvcmUgdGhlIGNhbnZhcyB3aXRoIElEICciK28uY2FudmFzLmlkKyInIGNhbiBiZSByZXVzZWQuIik7Y29uc3QgYT1zLmNyZWF0ZVJlc29sdmVyKHMuY2hhcnRPcHRpb25TY29wZXMoKSx0aGlzLmdldENvbnRleHQoKSk7dGhpcy5wbGF0Zm9ybT1uZXcocy5wbGF0Zm9ybXx8UHMobikpLHRoaXMucGxhdGZvcm0udXBkYXRlQ29uZmlnKHMpO2NvbnN0IHI9dGhpcy5wbGF0Zm9ybS5hY3F1aXJlQ29udGV4dChuLGEuYXNwZWN0UmF0aW8pLGw9ciYmci5jYW52YXMsaD1sJiZsLmhlaWdodCxjPWwmJmwud2lkdGg7dGhpcy5pZD1pKCksdGhpcy5jdHg9cix0aGlzLmNhbnZhcz1sLHRoaXMud2lkdGg9Yyx0aGlzLmhlaWdodD1oLHRoaXMuX29wdGlvbnM9YSx0aGlzLl9hc3BlY3RSYXRpbz10aGlzLmFzcGVjdFJhdGlvLHRoaXMuX2xheWVycz1bXSx0aGlzLl9tZXRhc2V0cz1bXSx0aGlzLl9zdGFja3M9dm9pZCAwLHRoaXMuYm94ZXM9W10sdGhpcy5jdXJyZW50RGV2aWNlUGl4ZWxSYXRpbz12b2lkIDAsdGhpcy5jaGFydEFyZWE9dm9pZCAwLHRoaXMuX2FjdGl2ZT1bXSx0aGlzLl9sYXN0RXZlbnQ9dm9pZCAwLHRoaXMuX2xpc3RlbmVycz17fSx0aGlzLl9yZXNwb25zaXZlTGlzdGVuZXJzPXZvaWQgMCx0aGlzLl9zb3J0ZWRNZXRhc2V0cz1bXSx0aGlzLnNjYWxlcz17fSx0aGlzLl9wbHVnaW5zPW5ldyBvbix0aGlzLiRwcm94aWVzPXt9LHRoaXMuX2hpZGRlbkluZGljZXM9e30sdGhpcy5hdHRhY2hlZD0hMSx0aGlzLl9hbmltYXRpb25zRGlzYWJsZWQ9dm9pZCAwLHRoaXMuJGNvbnRleHQ9dm9pZCAwLHRoaXMuX2RvUmVzaXplPWR0KCh0PT50aGlzLnVwZGF0ZSh0KSksYS5yZXNpemVEZWxheXx8MCksdGhpcy5fZGF0YUNoYW5nZXM9W10sQ25bdGhpcy5pZF09dGhpcyxyJiZsPyhidC5saXN0ZW4odGhpcywiY29tcGxldGUiLFNuKSxidC5saXN0ZW4odGhpcywicHJvZ3Jlc3MiLFBuKSx0aGlzLl9pbml0aWFsaXplKCksdGhpcy5hdHRhY2hlZCYmdGhpcy51cGRhdGUoKSk6Y29uc29sZS5lcnJvcigiRmFpbGVkIHRvIGNyZWF0ZSBjaGFydDogY2FuJ3QgYWNxdWlyZSBjb250ZXh0IGZyb20gdGhlIGdpdmVuIGl0ZW0iKX1nZXQgYXNwZWN0UmF0aW8oKXtjb25zdHtvcHRpb25zOnthc3BlY3RSYXRpbzp0LG1haW50YWluQXNwZWN0UmF0aW86ZX0sd2lkdGg6aSxoZWlnaHQ6bixfYXNwZWN0UmF0aW86b309dGhpcztyZXR1cm4gcyh0KT9lJiZvP286bj9pL246bnVsbDp0fWdldCBkYXRhKCl7cmV0dXJuIHRoaXMuY29uZmlnLmRhdGF9c2V0IGRhdGEodCl7dGhpcy5jb25maWcuZGF0YT10fWdldCBvcHRpb25zKCl7cmV0dXJuIHRoaXMuX29wdGlvbnN9c2V0IG9wdGlvbnModCl7dGhpcy5jb25maWcub3B0aW9ucz10fWdldCByZWdpc3RyeSgpe3JldHVybiBubn1faW5pdGlhbGl6ZSgpe3JldHVybiB0aGlzLm5vdGlmeVBsdWdpbnMoImJlZm9yZUluaXQiKSx0aGlzLm9wdGlvbnMucmVzcG9uc2l2ZT90aGlzLnJlc2l6ZSgpOmtlKHRoaXMsdGhpcy5vcHRpb25zLmRldmljZVBpeGVsUmF0aW8pLHRoaXMuYmluZEV2ZW50cygpLHRoaXMubm90aWZ5UGx1Z2lucygiYWZ0ZXJJbml0IiksdGhpc31jbGVhcigpe3JldHVybiBUZSh0aGlzLmNhbnZhcyx0aGlzLmN0eCksdGhpc31zdG9wKCl7cmV0dXJuIGJ0LnN0b3AodGhpcyksdGhpc31yZXNpemUodCxlKXtidC5ydW5uaW5nKHRoaXMpP3RoaXMuX3Jlc2l6ZUJlZm9yZURyYXc9e3dpZHRoOnQsaGVpZ2h0OmV9OnRoaXMuX3Jlc2l6ZSh0LGUpfV9yZXNpemUodCxlKXtjb25zdCBpPXRoaXMub3B0aW9ucyxzPXRoaXMuY2FudmFzLG49aS5tYWludGFpbkFzcGVjdFJhdGlvJiZ0aGlzLmFzcGVjdFJhdGlvLG89dGhpcy5wbGF0Zm9ybS5nZXRNYXhpbXVtU2l6ZShzLHQsZSxuKSxhPWkuZGV2aWNlUGl4ZWxSYXRpb3x8dGhpcy5wbGF0Zm9ybS5nZXREZXZpY2VQaXhlbFJhdGlvKCkscj10aGlzLndpZHRoPyJyZXNpemUiOiJhdHRhY2giO3RoaXMud2lkdGg9by53aWR0aCx0aGlzLmhlaWdodD1vLmhlaWdodCx0aGlzLl9hc3BlY3RSYXRpbz10aGlzLmFzcGVjdFJhdGlvLGtlKHRoaXMsYSwhMCkmJih0aGlzLm5vdGlmeVBsdWdpbnMoInJlc2l6ZSIse3NpemU6b30pLGQoaS5vblJlc2l6ZSxbdGhpcyxvXSx0aGlzKSx0aGlzLmF0dGFjaGVkJiZ0aGlzLl9kb1Jlc2l6ZShyKSYmdGhpcy5yZW5kZXIoKSl9ZW5zdXJlU2NhbGVzSGF2ZUlEcygpe3UodGhpcy5vcHRpb25zLnNjYWxlc3x8e30sKCh0LGUpPT57dC5pZD1lfSkpfWJ1aWxkT3JVcGRhdGVTY2FsZXMoKXtjb25zdCB0PXRoaXMub3B0aW9ucyxlPXQuc2NhbGVzLGk9dGhpcy5zY2FsZXMscz1PYmplY3Qua2V5cyhpKS5yZWR1Y2UoKCh0LGUpPT4odFtlXT0hMSx0KSkse30pO2xldCBuPVtdO2UmJihuPW4uY29uY2F0KE9iamVjdC5rZXlzKGUpLm1hcCgodD0+e2NvbnN0IGk9ZVt0XSxzPWNuKHQsaSksbj0iciI9PT1zLG89IngiPT09cztyZXR1cm57b3B0aW9uczppLGRwb3NpdGlvbjpuPyJjaGFydEFyZWEiOm8/ImJvdHRvbSI6ImxlZnQiLGR0eXBlOm4/InJhZGlhbExpbmVhciI6bz8iY2F0ZWdvcnkiOiJsaW5lYXIifX0pKSkpLHUobiwoZT0+e2NvbnN0IG49ZS5vcHRpb25zLG89bi5pZCxhPWNuKG8sbikscj1sKG4udHlwZSxlLmR0eXBlKTt2b2lkIDAhPT1uLnBvc2l0aW9uJiZ3bihuLnBvc2l0aW9uLGEpPT09d24oZS5kcG9zaXRpb24pfHwobi5wb3NpdGlvbj1lLmRwb3NpdGlvbiksc1tvXT0hMDtsZXQgaD1udWxsO2lmKG8gaW4gaSYmaVtvXS50eXBlPT09ciloPWlbb107ZWxzZXtoPW5ldyhubi5nZXRTY2FsZShyKSkoe2lkOm8sdHlwZTpyLGN0eDp0aGlzLmN0eCxjaGFydDp0aGlzfSksaVtoLmlkXT1ofWguaW5pdChuLHQpfSkpLHUocywoKHQsZSk9Pnt0fHxkZWxldGUgaVtlXX0pKSx1KGksKHQ9Pntscy5jb25maWd1cmUodGhpcyx0LHQub3B0aW9ucyksbHMuYWRkQm94KHRoaXMsdCl9KSl9X3VwZGF0ZU1ldGFzZXRzKCl7Y29uc3QgdD10aGlzLl9tZXRhc2V0cyxlPXRoaXMuZGF0YS5kYXRhc2V0cy5sZW5ndGgsaT10Lmxlbmd0aDtpZih0LnNvcnQoKCh0LGUpPT50LmluZGV4LWUuaW5kZXgpKSxpPmUpe2ZvcihsZXQgdD1lO3Q8aTsrK3QpdGhpcy5fZGVzdHJveURhdGFzZXRNZXRhKHQpO3Quc3BsaWNlKGUsaS1lKX10aGlzLl9zb3J0ZWRNZXRhc2V0cz10LnNsaWNlKDApLnNvcnQoa24oIm9yZGVyIiwiaW5kZXgiKSl9X3JlbW92ZVVucmVmZXJlbmNlZE1ldGFzZXRzKCl7Y29uc3R7X21ldGFzZXRzOnQsZGF0YTp7ZGF0YXNldHM6ZX19PXRoaXM7dC5sZW5ndGg+ZS5sZW5ndGgmJmRlbGV0ZSB0aGlzLl9zdGFja3MsdC5mb3JFYWNoKCgodCxpKT0+ezA9PT1lLmZpbHRlcigoZT0+ZT09PXQuX2RhdGFzZXQpKS5sZW5ndGgmJnRoaXMuX2Rlc3Ryb3lEYXRhc2V0TWV0YShpKX0pKX1idWlsZE9yVXBkYXRlQ29udHJvbGxlcnMoKXtjb25zdCB0PVtdLGU9dGhpcy5kYXRhLmRhdGFzZXRzO2xldCBpLHM7Zm9yKHRoaXMuX3JlbW92ZVVucmVmZXJlbmNlZE1ldGFzZXRzKCksaT0wLHM9ZS5sZW5ndGg7aTxzO2krKyl7Y29uc3Qgcz1lW2ldO2xldCBuPXRoaXMuZ2V0RGF0YXNldE1ldGEoaSk7Y29uc3Qgbz1zLnR5cGV8fHRoaXMuY29uZmlnLnR5cGU7aWYobi50eXBlJiZuLnR5cGUhPT1vJiYodGhpcy5fZGVzdHJveURhdGFzZXRNZXRhKGkpLG49dGhpcy5nZXREYXRhc2V0TWV0YShpKSksbi50eXBlPW8sbi5pbmRleEF4aXM9cy5pbmRleEF4aXN8fGxuKG8sdGhpcy5vcHRpb25zKSxuLm9yZGVyPXMub3JkZXJ8fDAsbi5pbmRleD1pLG4ubGFiZWw9IiIrcy5sYWJlbCxuLnZpc2libGU9dGhpcy5pc0RhdGFzZXRWaXNpYmxlKGkpLG4uY29udHJvbGxlciluLmNvbnRyb2xsZXIudXBkYXRlSW5kZXgoaSksbi5jb250cm9sbGVyLmxpbmtTY2FsZXMoKTtlbHNle2NvbnN0IGU9bm4uZ2V0Q29udHJvbGxlcihvKSx7ZGF0YXNldEVsZW1lbnRUeXBlOnMsZGF0YUVsZW1lbnRUeXBlOmF9PXVlLmRhdGFzZXRzW29dO09iamVjdC5hc3NpZ24oZSx7ZGF0YUVsZW1lbnRUeXBlOm5uLmdldEVsZW1lbnQoYSksZGF0YXNldEVsZW1lbnRUeXBlOnMmJm5uLmdldEVsZW1lbnQocyl9KSxuLmNvbnRyb2xsZXI9bmV3IGUodGhpcyxpKSx0LnB1c2gobi5jb250cm9sbGVyKX19cmV0dXJuIHRoaXMuX3VwZGF0ZU1ldGFzZXRzKCksdH1fcmVzZXRFbGVtZW50cygpe3UodGhpcy5kYXRhLmRhdGFzZXRzLCgodCxlKT0+e3RoaXMuZ2V0RGF0YXNldE1ldGEoZSkuY29udHJvbGxlci5yZXNldCgpfSksdGhpcyl9cmVzZXQoKXt0aGlzLl9yZXNldEVsZW1lbnRzKCksdGhpcy5ub3RpZnlQbHVnaW5zKCJyZXNldCIpfXVwZGF0ZSh0KXtjb25zdCBlPXRoaXMuY29uZmlnO2UudXBkYXRlKCk7Y29uc3QgaT10aGlzLl9vcHRpb25zPWUuY3JlYXRlUmVzb2x2ZXIoZS5jaGFydE9wdGlvblNjb3BlcygpLHRoaXMuZ2V0Q29udGV4dCgpKSxzPXRoaXMuX2FuaW1hdGlvbnNEaXNhYmxlZD0haS5hbmltYXRpb247aWYodGhpcy5fdXBkYXRlU2NhbGVzKCksdGhpcy5fY2hlY2tFdmVudEJpbmRpbmdzKCksdGhpcy5fdXBkYXRlSGlkZGVuSW5kaWNlcygpLHRoaXMuX3BsdWdpbnMuaW52YWxpZGF0ZSgpLCExPT09dGhpcy5ub3RpZnlQbHVnaW5zKCJiZWZvcmVVcGRhdGUiLHttb2RlOnQsY2FuY2VsYWJsZTohMH0pKXJldHVybjtjb25zdCBuPXRoaXMuYnVpbGRPclVwZGF0ZUNvbnRyb2xsZXJzKCk7dGhpcy5ub3RpZnlQbHVnaW5zKCJiZWZvcmVFbGVtZW50c1VwZGF0ZSIpO2xldCBvPTA7Zm9yKGxldCB0PTAsZT10aGlzLmRhdGEuZGF0YXNldHMubGVuZ3RoO3Q8ZTt0Kyspe2NvbnN0e2NvbnRyb2xsZXI6ZX09dGhpcy5nZXREYXRhc2V0TWV0YSh0KSxpPSFzJiYtMT09PW4uaW5kZXhPZihlKTtlLmJ1aWxkT3JVcGRhdGVFbGVtZW50cyhpKSxvPU1hdGgubWF4KCtlLmdldE1heE92ZXJmbG93KCksbyl9bz10aGlzLl9taW5QYWRkaW5nPWkubGF5b3V0LmF1dG9QYWRkaW5nP286MCx0aGlzLl91cGRhdGVMYXlvdXQobyksc3x8dShuLCh0PT57dC5yZXNldCgpfSkpLHRoaXMuX3VwZGF0ZURhdGFzZXRzKHQpLHRoaXMubm90aWZ5UGx1Z2lucygiYWZ0ZXJVcGRhdGUiLHttb2RlOnR9KSx0aGlzLl9sYXllcnMuc29ydChrbigieiIsIl9pZHgiKSk7Y29uc3R7X2FjdGl2ZTphLF9sYXN0RXZlbnQ6cn09dGhpcztyP3RoaXMuX2V2ZW50SGFuZGxlcihyLCEwKTphLmxlbmd0aCYmdGhpcy5fdXBkYXRlSG92ZXJTdHlsZXMoYSxhLCEwKSx0aGlzLnJlbmRlcigpfV91cGRhdGVTY2FsZXMoKXt1KHRoaXMuc2NhbGVzLCh0PT57bHMucmVtb3ZlQm94KHRoaXMsdCl9KSksdGhpcy5lbnN1cmVTY2FsZXNIYXZlSURzKCksdGhpcy5idWlsZE9yVXBkYXRlU2NhbGVzKCl9X2NoZWNrRXZlbnRCaW5kaW5ncygpe2NvbnN0IHQ9dGhpcy5vcHRpb25zLGU9bmV3IFNldChPYmplY3Qua2V5cyh0aGlzLl9saXN0ZW5lcnMpKSxpPW5ldyBTZXQodC5ldmVudHMpO1AoZSxpKSYmISF0aGlzLl9yZXNwb25zaXZlTGlzdGVuZXJzPT09dC5yZXNwb25zaXZlfHwodGhpcy51bmJpbmRFdmVudHMoKSx0aGlzLmJpbmRFdmVudHMoKSl9X3VwZGF0ZUhpZGRlbkluZGljZXMoKXtjb25zdHtfaGlkZGVuSW5kaWNlczp0fT10aGlzLGU9dGhpcy5fZ2V0VW5pZm9ybURhdGFDaGFuZ2VzKCl8fFtdO2Zvcihjb25zdHttZXRob2Q6aSxzdGFydDpzLGNvdW50Om59b2YgZSl7QW4odCxzLCJfcmVtb3ZlRWxlbWVudHMiPT09aT8tbjpuKX19X2dldFVuaWZvcm1EYXRhQ2hhbmdlcygpe2NvbnN0IHQ9dGhpcy5fZGF0YUNoYW5nZXM7aWYoIXR8fCF0Lmxlbmd0aClyZXR1cm47dGhpcy5fZGF0YUNoYW5nZXM9W107Y29uc3QgZT10aGlzLmRhdGEuZGF0YXNldHMubGVuZ3RoLGk9ZT0+bmV3IFNldCh0LmZpbHRlcigodD0+dFswXT09PWUpKS5tYXAoKCh0LGUpPT5lKyIsIit0LnNwbGljZSgxKS5qb2luKCIsIikpKSkscz1pKDApO2ZvcihsZXQgdD0xO3Q8ZTt0KyspaWYoIVAocyxpKHQpKSlyZXR1cm47cmV0dXJuIEFycmF5LmZyb20ocykubWFwKCh0PT50LnNwbGl0KCIsIikpKS5tYXAoKHQ9Pih7bWV0aG9kOnRbMV0sc3RhcnQ6K3RbMl0sY291bnQ6K3RbM119KSkpfV91cGRhdGVMYXlvdXQodCl7aWYoITE9PT10aGlzLm5vdGlmeVBsdWdpbnMoImJlZm9yZUxheW91dCIse2NhbmNlbGFibGU6ITB9KSlyZXR1cm47bHMudXBkYXRlKHRoaXMsdGhpcy53aWR0aCx0aGlzLmhlaWdodCx0KTtjb25zdCBlPXRoaXMuY2hhcnRBcmVhLGk9ZS53aWR0aDw9MHx8ZS5oZWlnaHQ8PTA7dGhpcy5fbGF5ZXJzPVtdLHUodGhpcy5ib3hlcywodD0+e2kmJiJjaGFydEFyZWEiPT09dC5wb3NpdGlvbnx8KHQuY29uZmlndXJlJiZ0LmNvbmZpZ3VyZSgpLHRoaXMuX2xheWVycy5wdXNoKC4uLnQuX2xheWVycygpKSl9KSx0aGlzKSx0aGlzLl9sYXllcnMuZm9yRWFjaCgoKHQsZSk9Pnt0Ll9pZHg9ZX0pKSx0aGlzLm5vdGlmeVBsdWdpbnMoImFmdGVyTGF5b3V0Iil9X3VwZGF0ZURhdGFzZXRzKHQpe2lmKCExIT09dGhpcy5ub3RpZnlQbHVnaW5zKCJiZWZvcmVEYXRhc2V0c1VwZGF0ZSIse21vZGU6dCxjYW5jZWxhYmxlOiEwfSkpe2ZvcihsZXQgdD0wLGU9dGhpcy5kYXRhLmRhdGFzZXRzLmxlbmd0aDt0PGU7Kyt0KXRoaXMuZ2V0RGF0YXNldE1ldGEodCkuY29udHJvbGxlci5jb25maWd1cmUoKTtmb3IobGV0IGU9MCxpPXRoaXMuZGF0YS5kYXRhc2V0cy5sZW5ndGg7ZTxpOysrZSl0aGlzLl91cGRhdGVEYXRhc2V0KGUsUyh0KT90KHtkYXRhc2V0SW5kZXg6ZX0pOnQpO3RoaXMubm90aWZ5UGx1Z2lucygiYWZ0ZXJEYXRhc2V0c1VwZGF0ZSIse21vZGU6dH0pfX1fdXBkYXRlRGF0YXNldCh0LGUpe2NvbnN0IGk9dGhpcy5nZXREYXRhc2V0TWV0YSh0KSxzPXttZXRhOmksaW5kZXg6dCxtb2RlOmUsY2FuY2VsYWJsZTohMH07ITEhPT10aGlzLm5vdGlmeVBsdWdpbnMoImJlZm9yZURhdGFzZXRVcGRhdGUiLHMpJiYoaS5jb250cm9sbGVyLl91cGRhdGUoZSkscy5jYW5jZWxhYmxlPSExLHRoaXMubm90aWZ5UGx1Z2lucygiYWZ0ZXJEYXRhc2V0VXBkYXRlIixzKSl9cmVuZGVyKCl7ITEhPT10aGlzLm5vdGlmeVBsdWdpbnMoImJlZm9yZVJlbmRlciIse2NhbmNlbGFibGU6ITB9KSYmKGJ0Lmhhcyh0aGlzKT90aGlzLmF0dGFjaGVkJiYhYnQucnVubmluZyh0aGlzKSYmYnQuc3RhcnQodGhpcyk6KHRoaXMuZHJhdygpLFNuKHtjaGFydDp0aGlzfSkpKX1kcmF3KCl7bGV0IHQ7aWYodGhpcy5fcmVzaXplQmVmb3JlRHJhdyl7Y29uc3R7d2lkdGg6dCxoZWlnaHQ6ZX09dGhpcy5fcmVzaXplQmVmb3JlRHJhdzt0aGlzLl9yZXNpemVCZWZvcmVEcmF3PW51bGwsdGhpcy5fcmVzaXplKHQsZSl9aWYodGhpcy5jbGVhcigpLHRoaXMud2lkdGg8PTB8fHRoaXMuaGVpZ2h0PD0wKXJldHVybjtpZighMT09PXRoaXMubm90aWZ5UGx1Z2lucygiYmVmb3JlRHJhdyIse2NhbmNlbGFibGU6ITB9KSlyZXR1cm47Y29uc3QgZT10aGlzLl9sYXllcnM7Zm9yKHQ9MDt0PGUubGVuZ3RoJiZlW3RdLno8PTA7Kyt0KWVbdF0uZHJhdyh0aGlzLmNoYXJ0QXJlYSk7Zm9yKHRoaXMuX2RyYXdEYXRhc2V0cygpO3Q8ZS5sZW5ndGg7Kyt0KWVbdF0uZHJhdyh0aGlzLmNoYXJ0QXJlYSk7dGhpcy5ub3RpZnlQbHVnaW5zKCJhZnRlckRyYXciKX1fZ2V0U29ydGVkRGF0YXNldE1ldGFzKHQpe2NvbnN0IGU9dGhpcy5fc29ydGVkTWV0YXNldHMsaT1bXTtsZXQgcyxuO2ZvcihzPTAsbj1lLmxlbmd0aDtzPG47KytzKXtjb25zdCBuPWVbc107dCYmIW4udmlzaWJsZXx8aS5wdXNoKG4pfXJldHVybiBpfWdldFNvcnRlZFZpc2libGVEYXRhc2V0TWV0YXMoKXtyZXR1cm4gdGhpcy5fZ2V0U29ydGVkRGF0YXNldE1ldGFzKCEwKX1fZHJhd0RhdGFzZXRzKCl7aWYoITE9PT10aGlzLm5vdGlmeVBsdWdpbnMoImJlZm9yZURhdGFzZXRzRHJhdyIse2NhbmNlbGFibGU6ITB9KSlyZXR1cm47Y29uc3QgdD10aGlzLmdldFNvcnRlZFZpc2libGVEYXRhc2V0TWV0YXMoKTtmb3IobGV0IGU9dC5sZW5ndGgtMTtlPj0wOy0tZSl0aGlzLl9kcmF3RGF0YXNldCh0W2VdKTt0aGlzLm5vdGlmeVBsdWdpbnMoImFmdGVyRGF0YXNldHNEcmF3Iil9X2RyYXdEYXRhc2V0KHQpe2NvbnN0IGU9dGhpcy5jdHgsaT17bWV0YTp0LGluZGV4OnQuaW5kZXgsY2FuY2VsYWJsZTohMH0scz1OaSh0aGlzLHQpOyExIT09dGhpcy5ub3RpZnlQbHVnaW5zKCJiZWZvcmVEYXRhc2V0RHJhdyIsaSkmJihzJiZJZShlLHMpLHQuY29udHJvbGxlci5kcmF3KCkscyYmemUoZSksaS5jYW5jZWxhYmxlPSExLHRoaXMubm90aWZ5UGx1Z2lucygiYWZ0ZXJEYXRhc2V0RHJhdyIsaSkpfWlzUG9pbnRJbkFyZWEodCl7cmV0dXJuIFJlKHQsdGhpcy5jaGFydEFyZWEsdGhpcy5fbWluUGFkZGluZyl9Z2V0RWxlbWVudHNBdEV2ZW50Rm9yTW9kZSh0LGUsaSxzKXtjb25zdCBuPUtpLm1vZGVzW2VdO3JldHVybiJmdW5jdGlvbiI9PXR5cGVvZiBuP24odGhpcyx0LGkscyk6W119Z2V0RGF0YXNldE1ldGEodCl7Y29uc3QgZT10aGlzLmRhdGEuZGF0YXNldHNbdF0saT10aGlzLl9tZXRhc2V0cztsZXQgcz1pLmZpbHRlcigodD0+dCYmdC5fZGF0YXNldD09PWUpKS5wb3AoKTtyZXR1cm4gc3x8KHM9e3R5cGU6bnVsbCxkYXRhOltdLGRhdGFzZXQ6bnVsbCxjb250cm9sbGVyOm51bGwsaGlkZGVuOm51bGwseEF4aXNJRDpudWxsLHlBeGlzSUQ6bnVsbCxvcmRlcjplJiZlLm9yZGVyfHwwLGluZGV4OnQsX2RhdGFzZXQ6ZSxfcGFyc2VkOltdLF9zb3J0ZWQ6ITF9LGkucHVzaChzKSksc31nZXRDb250ZXh0KCl7cmV0dXJuIHRoaXMuJGNvbnRleHR8fCh0aGlzLiRjb250ZXh0PUNpKG51bGwse2NoYXJ0OnRoaXMsdHlwZToiY2hhcnQifSkpfWdldFZpc2libGVEYXRhc2V0Q291bnQoKXtyZXR1cm4gdGhpcy5nZXRTb3J0ZWRWaXNpYmxlRGF0YXNldE1ldGFzKCkubGVuZ3RofWlzRGF0YXNldFZpc2libGUodCl7Y29uc3QgZT10aGlzLmRhdGEuZGF0YXNldHNbdF07aWYoIWUpcmV0dXJuITE7Y29uc3QgaT10aGlzLmdldERhdGFzZXRNZXRhKHQpO3JldHVybiJib29sZWFuIj09dHlwZW9mIGkuaGlkZGVuPyFpLmhpZGRlbjohZS5oaWRkZW59c2V0RGF0YXNldFZpc2liaWxpdHkodCxlKXt0aGlzLmdldERhdGFzZXRNZXRhKHQpLmhpZGRlbj0hZX10b2dnbGVEYXRhVmlzaWJpbGl0eSh0KXt0aGlzLl9oaWRkZW5JbmRpY2VzW3RdPSF0aGlzLl9oaWRkZW5JbmRpY2VzW3RdfWdldERhdGFWaXNpYmlsaXR5KHQpe3JldHVybiF0aGlzLl9oaWRkZW5JbmRpY2VzW3RdfV91cGRhdGVWaXNpYmlsaXR5KHQsZSxpKXtjb25zdCBzPWk/InNob3ciOiJoaWRlIixuPXRoaXMuZ2V0RGF0YXNldE1ldGEodCksbz1uLmNvbnRyb2xsZXIuX3Jlc29sdmVBbmltYXRpb25zKHZvaWQgMCxzKTtrKGUpPyhuLmRhdGFbZV0uaGlkZGVuPSFpLHRoaXMudXBkYXRlKCkpOih0aGlzLnNldERhdGFzZXRWaXNpYmlsaXR5KHQsaSksby51cGRhdGUobix7dmlzaWJsZTppfSksdGhpcy51cGRhdGUoKGU9PmUuZGF0YXNldEluZGV4PT09dD9zOnZvaWQgMCkpKX1oaWRlKHQsZSl7dGhpcy5fdXBkYXRlVmlzaWJpbGl0eSh0LGUsITEpfXNob3codCxlKXt0aGlzLl91cGRhdGVWaXNpYmlsaXR5KHQsZSwhMCl9X2Rlc3Ryb3lEYXRhc2V0TWV0YSh0KXtjb25zdCBlPXRoaXMuX21ldGFzZXRzW3RdO2UmJmUuY29udHJvbGxlciYmZS5jb250cm9sbGVyLl9kZXN0cm95KCksZGVsZXRlIHRoaXMuX21ldGFzZXRzW3RdfV9zdG9wKCl7bGV0IHQsZTtmb3IodGhpcy5zdG9wKCksYnQucmVtb3ZlKHRoaXMpLHQ9MCxlPXRoaXMuZGF0YS5kYXRhc2V0cy5sZW5ndGg7dDxlOysrdCl0aGlzLl9kZXN0cm95RGF0YXNldE1ldGEodCl9ZGVzdHJveSgpe3RoaXMubm90aWZ5UGx1Z2lucygiYmVmb3JlRGVzdHJveSIpO2NvbnN0e2NhbnZhczp0LGN0eDplfT10aGlzO3RoaXMuX3N0b3AoKSx0aGlzLmNvbmZpZy5jbGVhckNhY2hlKCksdCYmKHRoaXMudW5iaW5kRXZlbnRzKCksVGUodCxlKSx0aGlzLnBsYXRmb3JtLnJlbGVhc2VDb250ZXh0KGUpLHRoaXMuY2FudmFzPW51bGwsdGhpcy5jdHg9bnVsbCksZGVsZXRlIENuW3RoaXMuaWRdLHRoaXMubm90aWZ5UGx1Z2lucygiYWZ0ZXJEZXN0cm95Iil9dG9CYXNlNjRJbWFnZSguLi50KXtyZXR1cm4gdGhpcy5jYW52YXMudG9EYXRhVVJMKC4uLnQpfWJpbmRFdmVudHMoKXt0aGlzLmJpbmRVc2VyRXZlbnRzKCksdGhpcy5vcHRpb25zLnJlc3BvbnNpdmU/dGhpcy5iaW5kUmVzcG9uc2l2ZUV2ZW50cygpOnRoaXMuYXR0YWNoZWQ9ITB9YmluZFVzZXJFdmVudHMoKXtjb25zdCB0PXRoaXMuX2xpc3RlbmVycyxlPXRoaXMucGxhdGZvcm0saT0oaSxzKT0+e2UuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLGkscyksdFtpXT1zfSxzPSh0LGUsaSk9Pnt0Lm9mZnNldFg9ZSx0Lm9mZnNldFk9aSx0aGlzLl9ldmVudEhhbmRsZXIodCl9O3UodGhpcy5vcHRpb25zLmV2ZW50cywodD0+aSh0LHMpKSl9YmluZFJlc3BvbnNpdmVFdmVudHMoKXt0aGlzLl9yZXNwb25zaXZlTGlzdGVuZXJzfHwodGhpcy5fcmVzcG9uc2l2ZUxpc3RlbmVycz17fSk7Y29uc3QgdD10aGlzLl9yZXNwb25zaXZlTGlzdGVuZXJzLGU9dGhpcy5wbGF0Zm9ybSxpPShpLHMpPT57ZS5hZGRFdmVudExpc3RlbmVyKHRoaXMsaSxzKSx0W2ldPXN9LHM9KGkscyk9Pnt0W2ldJiYoZS5yZW1vdmVFdmVudExpc3RlbmVyKHRoaXMsaSxzKSxkZWxldGUgdFtpXSl9LG49KHQsZSk9Pnt0aGlzLmNhbnZhcyYmdGhpcy5yZXNpemUodCxlKX07bGV0IG87Y29uc3QgYT0oKT0+e3MoImF0dGFjaCIsYSksdGhpcy5hdHRhY2hlZD0hMCx0aGlzLnJlc2l6ZSgpLGkoInJlc2l6ZSIsbiksaSgiZGV0YWNoIixvKX07bz0oKT0+e3RoaXMuYXR0YWNoZWQ9ITEscygicmVzaXplIixuKSx0aGlzLl9zdG9wKCksdGhpcy5fcmVzaXplKDAsMCksaSgiYXR0YWNoIixhKX0sZS5pc0F0dGFjaGVkKHRoaXMuY2FudmFzKT9hKCk6bygpfXVuYmluZEV2ZW50cygpe3UodGhpcy5fbGlzdGVuZXJzLCgodCxlKT0+e3RoaXMucGxhdGZvcm0ucmVtb3ZlRXZlbnRMaXN0ZW5lcih0aGlzLGUsdCl9KSksdGhpcy5fbGlzdGVuZXJzPXt9LHUodGhpcy5fcmVzcG9uc2l2ZUxpc3RlbmVycywoKHQsZSk9Pnt0aGlzLnBsYXRmb3JtLnJlbW92ZUV2ZW50TGlzdGVuZXIodGhpcyxlLHQpfSkpLHRoaXMuX3Jlc3BvbnNpdmVMaXN0ZW5lcnM9dm9pZCAwfXVwZGF0ZUhvdmVyU3R5bGUodCxlLGkpe2NvbnN0IHM9aT8ic2V0IjoicmVtb3ZlIjtsZXQgbixvLGEscjtmb3IoImRhdGFzZXQiPT09ZSYmKG49dGhpcy5nZXREYXRhc2V0TWV0YSh0WzBdLmRhdGFzZXRJbmRleCksbi5jb250cm9sbGVyWyJfIitzKyJEYXRhc2V0SG92ZXJTdHlsZSJdKCkpLGE9MCxyPXQubGVuZ3RoO2E8cjsrK2Epe289dFthXTtjb25zdCBlPW8mJnRoaXMuZ2V0RGF0YXNldE1ldGEoby5kYXRhc2V0SW5kZXgpLmNvbnRyb2xsZXI7ZSYmZVtzKyJIb3ZlclN0eWxlIl0oby5lbGVtZW50LG8uZGF0YXNldEluZGV4LG8uaW5kZXgpfX1nZXRBY3RpdmVFbGVtZW50cygpe3JldHVybiB0aGlzLl9hY3RpdmV8fFtdfXNldEFjdGl2ZUVsZW1lbnRzKHQpe2NvbnN0IGU9dGhpcy5fYWN0aXZlfHxbXSxpPXQubWFwKCgoe2RhdGFzZXRJbmRleDp0LGluZGV4OmV9KT0+e2NvbnN0IGk9dGhpcy5nZXREYXRhc2V0TWV0YSh0KTtpZighaSl0aHJvdyBuZXcgRXJyb3IoIk5vIGRhdGFzZXQgZm91bmQgYXQgaW5kZXggIit0KTtyZXR1cm57ZGF0YXNldEluZGV4OnQsZWxlbWVudDppLmRhdGFbZV0saW5kZXg6ZX19KSk7IWYoaSxlKSYmKHRoaXMuX2FjdGl2ZT1pLHRoaXMuX2xhc3RFdmVudD1udWxsLHRoaXMuX3VwZGF0ZUhvdmVyU3R5bGVzKGksZSkpfW5vdGlmeVBsdWdpbnModCxlLGkpe3JldHVybiB0aGlzLl9wbHVnaW5zLm5vdGlmeSh0aGlzLHQsZSxpKX1pc1BsdWdpbkVuYWJsZWQodCl7cmV0dXJuIDE9PT10aGlzLl9wbHVnaW5zLl9jYWNoZS5maWx0ZXIoKGU9PmUucGx1Z2luLmlkPT09dCkpLmxlbmd0aH1fdXBkYXRlSG92ZXJTdHlsZXModCxlLGkpe2NvbnN0IHM9dGhpcy5vcHRpb25zLmhvdmVyLG49KHQsZSk9PnQuZmlsdGVyKCh0PT4hZS5zb21lKChlPT50LmRhdGFzZXRJbmRleD09PWUuZGF0YXNldEluZGV4JiZ0LmluZGV4PT09ZS5pbmRleCkpKSksbz1uKGUsdCksYT1pP3Q6bih0LGUpO28ubGVuZ3RoJiZ0aGlzLnVwZGF0ZUhvdmVyU3R5bGUobyxzLm1vZGUsITEpLGEubGVuZ3RoJiZzLm1vZGUmJnRoaXMudXBkYXRlSG92ZXJTdHlsZShhLHMubW9kZSwhMCl9X2V2ZW50SGFuZGxlcih0LGUpe2NvbnN0IGk9e2V2ZW50OnQscmVwbGF5OmUsY2FuY2VsYWJsZTohMCxpbkNoYXJ0QXJlYTp0aGlzLmlzUG9pbnRJbkFyZWEodCl9LHM9ZT0+KGUub3B0aW9ucy5ldmVudHN8fHRoaXMub3B0aW9ucy5ldmVudHMpLmluY2x1ZGVzKHQubmF0aXZlLnR5cGUpO2lmKCExPT09dGhpcy5ub3RpZnlQbHVnaW5zKCJiZWZvcmVFdmVudCIsaSxzKSlyZXR1cm47Y29uc3Qgbj10aGlzLl9oYW5kbGVFdmVudCh0LGUsaS5pbkNoYXJ0QXJlYSk7cmV0dXJuIGkuY2FuY2VsYWJsZT0hMSx0aGlzLm5vdGlmeVBsdWdpbnMoImFmdGVyRXZlbnQiLGkscyksKG58fGkuY2hhbmdlZCkmJnRoaXMucmVuZGVyKCksdGhpc31faGFuZGxlRXZlbnQodCxlLGkpe2NvbnN0e19hY3RpdmU6cz1bXSxvcHRpb25zOm59PXRoaXMsbz1lLGE9dGhpcy5fZ2V0QWN0aXZlRWxlbWVudHModCxzLGksbykscj1EKHQpLGw9ZnVuY3Rpb24odCxlLGkscyl7cmV0dXJuIGkmJiJtb3VzZW91dCIhPT10LnR5cGU/cz9lOnQ6bnVsbH0odCx0aGlzLl9sYXN0RXZlbnQsaSxyKTtpJiYodGhpcy5fbGFzdEV2ZW50PW51bGwsZChuLm9uSG92ZXIsW3QsYSx0aGlzXSx0aGlzKSxyJiZkKG4ub25DbGljayxbdCxhLHRoaXNdLHRoaXMpKTtjb25zdCBoPSFmKGEscyk7cmV0dXJuKGh8fGUpJiYodGhpcy5fYWN0aXZlPWEsdGhpcy5fdXBkYXRlSG92ZXJTdHlsZXMoYSxzLGUpKSx0aGlzLl9sYXN0RXZlbnQ9bCxofV9nZXRBY3RpdmVFbGVtZW50cyh0LGUsaSxzKXtpZigibW91c2VvdXQiPT09dC50eXBlKXJldHVybltdO2lmKCFpKXJldHVybiBlO2NvbnN0IG49dGhpcy5vcHRpb25zLmhvdmVyO3JldHVybiB0aGlzLmdldEVsZW1lbnRzQXRFdmVudEZvck1vZGUodCxuLm1vZGUsbixzKX19ZnVuY3Rpb24gTG4oKXtyZXR1cm4gdShUbi5pbnN0YW5jZXMsKHQ9PnQuX3BsdWdpbnMuaW52YWxpZGF0ZSgpKSl9ZnVuY3Rpb24gRW4oKXt0aHJvdyBuZXcgRXJyb3IoIlRoaXMgbWV0aG9kIGlzIG5vdCBpbXBsZW1lbnRlZDogQ2hlY2sgdGhhdCBhIGNvbXBsZXRlIGRhdGUgYWRhcHRlciBpcyBwcm92aWRlZC4iKX1jbGFzcyBSbntzdGF0aWMgb3ZlcnJpZGUodCl7T2JqZWN0LmFzc2lnbihSbi5wcm90b3R5cGUsdCl9b3B0aW9ucztjb25zdHJ1Y3Rvcih0KXt0aGlzLm9wdGlvbnM9dHx8e319aW5pdCgpe31mb3JtYXRzKCl7cmV0dXJuIEVuKCl9cGFyc2UoKXtyZXR1cm4gRW4oKX1mb3JtYXQoKXtyZXR1cm4gRW4oKX1hZGQoKXtyZXR1cm4gRW4oKX1kaWZmKCl7cmV0dXJuIEVuKCl9c3RhcnRPZigpe3JldHVybiBFbigpfWVuZE9mKCl7cmV0dXJuIEVuKCl9fXZhciBJbj17X2RhdGU6Um59O2Z1bmN0aW9uIHpuKHQpe2NvbnN0IGU9dC5pU2NhbGUsaT1mdW5jdGlvbih0LGUpe2lmKCF0Ll9jYWNoZS4kYmFyKXtjb25zdCBpPXQuZ2V0TWF0Y2hpbmdWaXNpYmxlTWV0YXMoZSk7bGV0IHM9W107Zm9yKGxldCBlPTAsbj1pLmxlbmd0aDtlPG47ZSsrKXM9cy5jb25jYXQoaVtlXS5jb250cm9sbGVyLmdldEFsbFBhcnNlZFZhbHVlcyh0KSk7dC5fY2FjaGUuJGJhcj1sdChzLnNvcnQoKCh0LGUpPT50LWUpKSl9cmV0dXJuIHQuX2NhY2hlLiRiYXJ9KGUsdC50eXBlKTtsZXQgcyxuLG8sYSxyPWUuX2xlbmd0aDtjb25zdCBsPSgpPT57MzI3NjchPT1vJiYtMzI3NjghPT1vJiYoayhhKSYmKHI9TWF0aC5taW4ocixNYXRoLmFicyhvLWEpfHxyKSksYT1vKX07Zm9yKHM9MCxuPWkubGVuZ3RoO3M8bjsrK3Mpbz1lLmdldFBpeGVsRm9yVmFsdWUoaVtzXSksbCgpO2ZvcihhPXZvaWQgMCxzPTAsbj1lLnRpY2tzLmxlbmd0aDtzPG47KytzKW89ZS5nZXRQaXhlbEZvclRpY2socyksbCgpO3JldHVybiByfWZ1bmN0aW9uIEZuKHQsZSxpLHMpe3JldHVybiBuKHQpP2Z1bmN0aW9uKHQsZSxpLHMpe2NvbnN0IG49aS5wYXJzZSh0WzBdLHMpLG89aS5wYXJzZSh0WzFdLHMpLGE9TWF0aC5taW4obixvKSxyPU1hdGgubWF4KG4sbyk7bGV0IGw9YSxoPXI7TWF0aC5hYnMoYSk+TWF0aC5hYnMocikmJihsPXIsaD1hKSxlW2kuYXhpc109aCxlLl9jdXN0b209e2JhclN0YXJ0OmwsYmFyRW5kOmgsc3RhcnQ6bixlbmQ6byxtaW46YSxtYXg6cn19KHQsZSxpLHMpOmVbaS5heGlzXT1pLnBhcnNlKHQscyksZX1mdW5jdGlvbiBWbih0LGUsaSxzKXtjb25zdCBuPXQuaVNjYWxlLG89dC52U2NhbGUsYT1uLmdldExhYmVscygpLHI9bj09PW8sbD1bXTtsZXQgaCxjLGQsdTtmb3IoaD1pLGM9aStzO2g8YzsrK2gpdT1lW2hdLGQ9e30sZFtuLmF4aXNdPXJ8fG4ucGFyc2UoYVtoXSxoKSxsLnB1c2goRm4odSxkLG8saCkpO3JldHVybiBsfWZ1bmN0aW9uIEJuKHQpe3JldHVybiB0JiZ2b2lkIDAhPT10LmJhclN0YXJ0JiZ2b2lkIDAhPT10LmJhckVuZH1mdW5jdGlvbiBXbih0LGUsaSxzKXtsZXQgbj1lLmJvcmRlclNraXBwZWQ7Y29uc3Qgbz17fTtpZighbilyZXR1cm4gdm9pZCh0LmJvcmRlclNraXBwZWQ9byk7aWYoITA9PT1uKXJldHVybiB2b2lkKHQuYm9yZGVyU2tpcHBlZD17dG9wOiEwLHJpZ2h0OiEwLGJvdHRvbTohMCxsZWZ0OiEwfSk7Y29uc3R7c3RhcnQ6YSxlbmQ6cixyZXZlcnNlOmwsdG9wOmgsYm90dG9tOmN9PWZ1bmN0aW9uKHQpe2xldCBlLGkscyxuLG87cmV0dXJuIHQuaG9yaXpvbnRhbD8oZT10LmJhc2U+dC54LGk9ImxlZnQiLHM9InJpZ2h0Iik6KGU9dC5iYXNlPHQueSxpPSJib3R0b20iLHM9InRvcCIpLGU/KG49ImVuZCIsbz0ic3RhcnQiKToobj0ic3RhcnQiLG89ImVuZCIpLHtzdGFydDppLGVuZDpzLHJldmVyc2U6ZSx0b3A6bixib3R0b206b319KHQpOyJtaWRkbGUiPT09biYmaSYmKHQuZW5hYmxlQm9yZGVyUmFkaXVzPSEwLChpLl90b3B8fDApPT09cz9uPWg6KGkuX2JvdHRvbXx8MCk9PT1zP249Yzoob1tObihjLGEscixsKV09ITAsbj1oKSksb1tObihuLGEscixsKV09ITAsdC5ib3JkZXJTa2lwcGVkPW99ZnVuY3Rpb24gTm4odCxlLGkscyl7dmFyIG4sbyxhO3JldHVybiBzPyhhPWksdD1Ibih0PShuPXQpPT09KG89ZSk/YTpuPT09YT9vOm4saSxlKSk6dD1Ibih0LGUsaSksdH1mdW5jdGlvbiBIbih0LGUsaSl7cmV0dXJuInN0YXJ0Ij09PXQ/ZToiZW5kIj09PXQ/aTp0fWZ1bmN0aW9uIGpuKHQse2luZmxhdGVBbW91bnQ6ZX0saSl7dC5pbmZsYXRlQW1vdW50PSJhdXRvIj09PWU/MT09PWk/LjMzOjA6ZX1jbGFzcyAkbiBleHRlbmRzIGpze3N0YXRpYyBpZD0iZG91Z2hudXQiO3N0YXRpYyBkZWZhdWx0cz17ZGF0YXNldEVsZW1lbnRUeXBlOiExLGRhdGFFbGVtZW50VHlwZToiYXJjIixhbmltYXRpb246e2FuaW1hdGVSb3RhdGU6ITAsYW5pbWF0ZVNjYWxlOiExfSxhbmltYXRpb25zOntudW1iZXJzOnt0eXBlOiJudW1iZXIiLHByb3BlcnRpZXM6WyJjaXJjdW1mZXJlbmNlIiwiZW5kQW5nbGUiLCJpbm5lclJhZGl1cyIsIm91dGVyUmFkaXVzIiwic3RhcnRBbmdsZSIsIngiLCJ5Iiwib2Zmc2V0IiwiYm9yZGVyV2lkdGgiLCJzcGFjaW5nIl19fSxjdXRvdXQ6IjUwJSIscm90YXRpb246MCxjaXJjdW1mZXJlbmNlOjM2MCxyYWRpdXM6IjEwMCUiLHNwYWNpbmc6MCxpbmRleEF4aXM6InIifTtzdGF0aWMgZGVzY3JpcHRvcnM9e19zY3JpcHRhYmxlOnQ9PiJzcGFjaW5nIiE9PXQsX2luZGV4YWJsZTp0PT4ic3BhY2luZyIhPT10JiYhdC5zdGFydHNXaXRoKCJib3JkZXJEYXNoIikmJiF0LnN0YXJ0c1dpdGgoImhvdmVyQm9yZGVyRGFzaCIpfTtzdGF0aWMgb3ZlcnJpZGVzPXthc3BlY3RSYXRpbzoxLHBsdWdpbnM6e2xlZ2VuZDp7bGFiZWxzOntnZW5lcmF0ZUxhYmVscyh0KXtjb25zdCBlPXQuZGF0YSx7bGFiZWxzOntwb2ludFN0eWxlOmksdGV4dEFsaWduOnMsY29sb3I6bix1c2VCb3JkZXJSYWRpdXM6byxib3JkZXJSYWRpdXM6YX19PXQubGVnZW5kLm9wdGlvbnM7cmV0dXJuIGUubGFiZWxzLmxlbmd0aCYmZS5kYXRhc2V0cy5sZW5ndGg/ZS5sYWJlbHMubWFwKCgoZSxyKT0+e2NvbnN0IGw9dC5nZXREYXRhc2V0TWV0YSgwKS5jb250cm9sbGVyLmdldFN0eWxlKHIpO3JldHVybnt0ZXh0OmUsZmlsbFN0eWxlOmwuYmFja2dyb3VuZENvbG9yLGZvbnRDb2xvcjpuLGhpZGRlbjohdC5nZXREYXRhVmlzaWJpbGl0eShyKSxsaW5lRGFzaDpsLmJvcmRlckRhc2gsbGluZURhc2hPZmZzZXQ6bC5ib3JkZXJEYXNoT2Zmc2V0LGxpbmVKb2luOmwuYm9yZGVySm9pblN0eWxlLGxpbmVXaWR0aDpsLmJvcmRlcldpZHRoLHN0cm9rZVN0eWxlOmwuYm9yZGVyQ29sb3IsdGV4dEFsaWduOnMscG9pbnRTdHlsZTppLGJvcmRlclJhZGl1czpvJiYoYXx8bC5ib3JkZXJSYWRpdXMpLGluZGV4OnJ9fSkpOltdfX0sb25DbGljayh0LGUsaSl7aS5jaGFydC50b2dnbGVEYXRhVmlzaWJpbGl0eShlLmluZGV4KSxpLmNoYXJ0LnVwZGF0ZSgpfX19fTtjb25zdHJ1Y3Rvcih0LGUpe3N1cGVyKHQsZSksdGhpcy5lbmFibGVPcHRpb25TaGFyaW5nPSEwLHRoaXMuaW5uZXJSYWRpdXM9dm9pZCAwLHRoaXMub3V0ZXJSYWRpdXM9dm9pZCAwLHRoaXMub2Zmc2V0WD12b2lkIDAsdGhpcy5vZmZzZXRZPXZvaWQgMH1saW5rU2NhbGVzKCl7fXBhcnNlKHQsZSl7Y29uc3QgaT10aGlzLmdldERhdGFzZXQoKS5kYXRhLHM9dGhpcy5fY2FjaGVkTWV0YTtpZighMT09PXRoaXMuX3BhcnNpbmcpcy5fcGFyc2VkPWk7ZWxzZXtsZXQgbixhLHI9dD0+K2lbdF07aWYobyhpW3RdKSl7Y29uc3R7a2V5OnQ9InZhbHVlIn09dGhpcy5fcGFyc2luZztyPWU9PitNKGlbZV0sdCl9Zm9yKG49dCxhPXQrZTtuPGE7KytuKXMuX3BhcnNlZFtuXT1yKG4pfX1fZ2V0Um90YXRpb24oKXtyZXR1cm4gJCh0aGlzLm9wdGlvbnMucm90YXRpb24tOTApfV9nZXRDaXJjdW1mZXJlbmNlKCl7cmV0dXJuICQodGhpcy5vcHRpb25zLmNpcmN1bWZlcmVuY2UpfV9nZXRSb3RhdGlvbkV4dGVudHMoKXtsZXQgdD1PLGU9LU87Zm9yKGxldCBpPTA7aTx0aGlzLmNoYXJ0LmRhdGEuZGF0YXNldHMubGVuZ3RoOysraSlpZih0aGlzLmNoYXJ0LmlzRGF0YXNldFZpc2libGUoaSkmJnRoaXMuY2hhcnQuZ2V0RGF0YXNldE1ldGEoaSkudHlwZT09PXRoaXMuX3R5cGUpe2NvbnN0IHM9dGhpcy5jaGFydC5nZXREYXRhc2V0TWV0YShpKS5jb250cm9sbGVyLG49cy5fZ2V0Um90YXRpb24oKSxvPXMuX2dldENpcmN1bWZlcmVuY2UoKTt0PU1hdGgubWluKHQsbiksZT1NYXRoLm1heChlLG4rbyl9cmV0dXJue3JvdGF0aW9uOnQsY2lyY3VtZmVyZW5jZTplLXR9fXVwZGF0ZSh0KXtjb25zdCBlPXRoaXMuY2hhcnQse2NoYXJ0QXJlYTppfT1lLHM9dGhpcy5fY2FjaGVkTWV0YSxuPXMuZGF0YSxvPXRoaXMuZ2V0TWF4Qm9yZGVyV2lkdGgoKSt0aGlzLmdldE1heE9mZnNldChuKSt0aGlzLm9wdGlvbnMuc3BhY2luZyxhPU1hdGgubWF4KChNYXRoLm1pbihpLndpZHRoLGkuaGVpZ2h0KS1vKS8yLDApLHI9TWF0aC5taW4oaCh0aGlzLm9wdGlvbnMuY3V0b3V0LGEpLDEpLGw9dGhpcy5fZ2V0UmluZ1dlaWdodCh0aGlzLmluZGV4KSx7Y2lyY3VtZmVyZW5jZTpkLHJvdGF0aW9uOnV9PXRoaXMuX2dldFJvdGF0aW9uRXh0ZW50cygpLHtyYXRpb1g6ZixyYXRpb1k6ZyxvZmZzZXRYOnAsb2Zmc2V0WTptfT1mdW5jdGlvbih0LGUsaSl7bGV0IHM9MSxuPTEsbz0wLGE9MDtpZihlPE8pe2NvbnN0IHI9dCxsPXIrZSxoPU1hdGguY29zKHIpLGM9TWF0aC5zaW4ociksZD1NYXRoLmNvcyhsKSx1PU1hdGguc2luKGwpLGY9KHQsZSxzKT0+Sih0LHIsbCwhMCk/MTpNYXRoLm1heChlLGUqaSxzLHMqaSksZz0odCxlLHMpPT5KKHQscixsLCEwKT8tMTpNYXRoLm1pbihlLGUqaSxzLHMqaSkscD1mKDAsaCxkKSxtPWYoRSxjLHUpLHg9ZyhDLGgsZCksYj1nKEMrRSxjLHUpO3M9KHAteCkvMixuPShtLWIpLzIsbz0tKHAreCkvMixhPS0obStiKS8yfXJldHVybntyYXRpb1g6cyxyYXRpb1k6bixvZmZzZXRYOm8sb2Zmc2V0WTphfX0odSxkLHIpLHg9KGkud2lkdGgtbykvZixiPShpLmhlaWdodC1vKS9nLF89TWF0aC5tYXgoTWF0aC5taW4oeCxiKS8yLDApLHk9Yyh0aGlzLm9wdGlvbnMucmFkaXVzLF8pLHY9KHktTWF0aC5tYXgoeSpyLDApKS90aGlzLl9nZXRWaXNpYmxlRGF0YXNldFdlaWdodFRvdGFsKCk7dGhpcy5vZmZzZXRYPXAqeSx0aGlzLm9mZnNldFk9bSp5LHMudG90YWw9dGhpcy5jYWxjdWxhdGVUb3RhbCgpLHRoaXMub3V0ZXJSYWRpdXM9eS12KnRoaXMuX2dldFJpbmdXZWlnaHRPZmZzZXQodGhpcy5pbmRleCksdGhpcy5pbm5lclJhZGl1cz1NYXRoLm1heCh0aGlzLm91dGVyUmFkaXVzLXYqbCwwKSx0aGlzLnVwZGF0ZUVsZW1lbnRzKG4sMCxuLmxlbmd0aCx0KX1fY2lyY3VtZmVyZW5jZSh0LGUpe2NvbnN0IGk9dGhpcy5vcHRpb25zLHM9dGhpcy5fY2FjaGVkTWV0YSxuPXRoaXMuX2dldENpcmN1bWZlcmVuY2UoKTtyZXR1cm4gZSYmaS5hbmltYXRpb24uYW5pbWF0ZVJvdGF0ZXx8IXRoaXMuY2hhcnQuZ2V0RGF0YVZpc2liaWxpdHkodCl8fG51bGw9PT1zLl9wYXJzZWRbdF18fHMuZGF0YVt0XS5oaWRkZW4/MDp0aGlzLmNhbGN1bGF0ZUNpcmN1bWZlcmVuY2Uocy5fcGFyc2VkW3RdKm4vTyl9dXBkYXRlRWxlbWVudHModCxlLGkscyl7Y29uc3Qgbj0icmVzZXQiPT09cyxvPXRoaXMuY2hhcnQsYT1vLmNoYXJ0QXJlYSxyPW8ub3B0aW9ucy5hbmltYXRpb24sbD0oYS5sZWZ0K2EucmlnaHQpLzIsaD0oYS50b3ArYS5ib3R0b20pLzIsYz1uJiZyLmFuaW1hdGVTY2FsZSxkPWM/MDp0aGlzLmlubmVyUmFkaXVzLHU9Yz8wOnRoaXMub3V0ZXJSYWRpdXMse3NoYXJlZE9wdGlvbnM6ZixpbmNsdWRlT3B0aW9uczpnfT10aGlzLl9nZXRTaGFyZWRPcHRpb25zKGUscyk7bGV0IHAsbT10aGlzLl9nZXRSb3RhdGlvbigpO2ZvcihwPTA7cDxlOysrcCltKz10aGlzLl9jaXJjdW1mZXJlbmNlKHAsbik7Zm9yKHA9ZTtwPGUraTsrK3Ape2NvbnN0IGU9dGhpcy5fY2lyY3VtZmVyZW5jZShwLG4pLGk9dFtwXSxvPXt4OmwrdGhpcy5vZmZzZXRYLHk6aCt0aGlzLm9mZnNldFksc3RhcnRBbmdsZTptLGVuZEFuZ2xlOm0rZSxjaXJjdW1mZXJlbmNlOmUsb3V0ZXJSYWRpdXM6dSxpbm5lclJhZGl1czpkfTtnJiYoby5vcHRpb25zPWZ8fHRoaXMucmVzb2x2ZURhdGFFbGVtZW50T3B0aW9ucyhwLGkuYWN0aXZlPyJhY3RpdmUiOnMpKSxtKz1lLHRoaXMudXBkYXRlRWxlbWVudChpLHAsbyxzKX19Y2FsY3VsYXRlVG90YWwoKXtjb25zdCB0PXRoaXMuX2NhY2hlZE1ldGEsZT10LmRhdGE7bGV0IGkscz0wO2ZvcihpPTA7aTxlLmxlbmd0aDtpKyspe2NvbnN0IG49dC5fcGFyc2VkW2ldO251bGw9PT1ufHxpc05hTihuKXx8IXRoaXMuY2hhcnQuZ2V0RGF0YVZpc2liaWxpdHkoaSl8fGVbaV0uaGlkZGVufHwocys9TWF0aC5hYnMobikpfXJldHVybiBzfWNhbGN1bGF0ZUNpcmN1bWZlcmVuY2UodCl7Y29uc3QgZT10aGlzLl9jYWNoZWRNZXRhLnRvdGFsO3JldHVybiBlPjAmJiFpc05hTih0KT9PKihNYXRoLmFicyh0KS9lKTowfWdldExhYmVsQW5kVmFsdWUodCl7Y29uc3QgZT10aGlzLl9jYWNoZWRNZXRhLGk9dGhpcy5jaGFydCxzPWkuZGF0YS5sYWJlbHN8fFtdLG49bmUoZS5fcGFyc2VkW3RdLGkub3B0aW9ucy5sb2NhbGUpO3JldHVybntsYWJlbDpzW3RdfHwiIix2YWx1ZTpufX1nZXRNYXhCb3JkZXJXaWR0aCh0KXtsZXQgZT0wO2NvbnN0IGk9dGhpcy5jaGFydDtsZXQgcyxuLG8sYSxyO2lmKCF0KWZvcihzPTAsbj1pLmRhdGEuZGF0YXNldHMubGVuZ3RoO3M8bjsrK3MpaWYoaS5pc0RhdGFzZXRWaXNpYmxlKHMpKXtvPWkuZ2V0RGF0YXNldE1ldGEocyksdD1vLmRhdGEsYT1vLmNvbnRyb2xsZXI7YnJlYWt9aWYoIXQpcmV0dXJuIDA7Zm9yKHM9MCxuPXQubGVuZ3RoO3M8bjsrK3Mpcj1hLnJlc29sdmVEYXRhRWxlbWVudE9wdGlvbnMocyksImlubmVyIiE9PXIuYm9yZGVyQWxpZ24mJihlPU1hdGgubWF4KGUsci5ib3JkZXJXaWR0aHx8MCxyLmhvdmVyQm9yZGVyV2lkdGh8fDApKTtyZXR1cm4gZX1nZXRNYXhPZmZzZXQodCl7bGV0IGU9MDtmb3IobGV0IGk9MCxzPXQubGVuZ3RoO2k8czsrK2kpe2NvbnN0IHQ9dGhpcy5yZXNvbHZlRGF0YUVsZW1lbnRPcHRpb25zKGkpO2U9TWF0aC5tYXgoZSx0Lm9mZnNldHx8MCx0LmhvdmVyT2Zmc2V0fHwwKX1yZXR1cm4gZX1fZ2V0UmluZ1dlaWdodE9mZnNldCh0KXtsZXQgZT0wO2ZvcihsZXQgaT0wO2k8dDsrK2kpdGhpcy5jaGFydC5pc0RhdGFzZXRWaXNpYmxlKGkpJiYoZSs9dGhpcy5fZ2V0UmluZ1dlaWdodChpKSk7cmV0dXJuIGV9X2dldFJpbmdXZWlnaHQodCl7cmV0dXJuIE1hdGgubWF4KGwodGhpcy5jaGFydC5kYXRhLmRhdGFzZXRzW3RdLndlaWdodCwxKSwwKX1fZ2V0VmlzaWJsZURhdGFzZXRXZWlnaHRUb3RhbCgpe3JldHVybiB0aGlzLl9nZXRSaW5nV2VpZ2h0T2Zmc2V0KHRoaXMuY2hhcnQuZGF0YS5kYXRhc2V0cy5sZW5ndGgpfHwxfX1jbGFzcyBZbiBleHRlbmRzIGpze3N0YXRpYyBpZD0icG9sYXJBcmVhIjtzdGF0aWMgZGVmYXVsdHM9e2RhdGFFbGVtZW50VHlwZToiYXJjIixhbmltYXRpb246e2FuaW1hdGVSb3RhdGU6ITAsYW5pbWF0ZVNjYWxlOiEwfSxhbmltYXRpb25zOntudW1iZXJzOnt0eXBlOiJudW1iZXIiLHByb3BlcnRpZXM6WyJ4IiwieSIsInN0YXJ0QW5nbGUiLCJlbmRBbmdsZSIsImlubmVyUmFkaXVzIiwib3V0ZXJSYWRpdXMiXX19LGluZGV4QXhpczoiciIsc3RhcnRBbmdsZTowfTtzdGF0aWMgb3ZlcnJpZGVzPXthc3BlY3RSYXRpbzoxLHBsdWdpbnM6e2xlZ2VuZDp7bGFiZWxzOntnZW5lcmF0ZUxhYmVscyh0KXtjb25zdCBlPXQuZGF0YTtpZihlLmxhYmVscy5sZW5ndGgmJmUuZGF0YXNldHMubGVuZ3RoKXtjb25zdHtsYWJlbHM6e3BvaW50U3R5bGU6aSxjb2xvcjpzfX09dC5sZWdlbmQub3B0aW9ucztyZXR1cm4gZS5sYWJlbHMubWFwKCgoZSxuKT0+e2NvbnN0IG89dC5nZXREYXRhc2V0TWV0YSgwKS5jb250cm9sbGVyLmdldFN0eWxlKG4pO3JldHVybnt0ZXh0OmUsZmlsbFN0eWxlOm8uYmFja2dyb3VuZENvbG9yLHN0cm9rZVN0eWxlOm8uYm9yZGVyQ29sb3IsZm9udENvbG9yOnMsbGluZVdpZHRoOm8uYm9yZGVyV2lkdGgscG9pbnRTdHlsZTppLGhpZGRlbjohdC5nZXREYXRhVmlzaWJpbGl0eShuKSxpbmRleDpufX0pKX1yZXR1cm5bXX19LG9uQ2xpY2sodCxlLGkpe2kuY2hhcnQudG9nZ2xlRGF0YVZpc2liaWxpdHkoZS5pbmRleCksaS5jaGFydC51cGRhdGUoKX19fSxzY2FsZXM6e3I6e3R5cGU6InJhZGlhbExpbmVhciIsYW5nbGVMaW5lczp7ZGlzcGxheTohMX0sYmVnaW5BdFplcm86ITAsZ3JpZDp7Y2lyY3VsYXI6ITB9LHBvaW50TGFiZWxzOntkaXNwbGF5OiExfSxzdGFydEFuZ2xlOjB9fX07Y29uc3RydWN0b3IodCxlKXtzdXBlcih0LGUpLHRoaXMuaW5uZXJSYWRpdXM9dm9pZCAwLHRoaXMub3V0ZXJSYWRpdXM9dm9pZCAwfWdldExhYmVsQW5kVmFsdWUodCl7Y29uc3QgZT10aGlzLl9jYWNoZWRNZXRhLGk9dGhpcy5jaGFydCxzPWkuZGF0YS5sYWJlbHN8fFtdLG49bmUoZS5fcGFyc2VkW3RdLnIsaS5vcHRpb25zLmxvY2FsZSk7cmV0dXJue2xhYmVsOnNbdF18fCIiLHZhbHVlOm59fXBhcnNlT2JqZWN0RGF0YSh0LGUsaSxzKXtyZXR1cm4gaWkuYmluZCh0aGlzKSh0LGUsaSxzKX11cGRhdGUodCl7Y29uc3QgZT10aGlzLl9jYWNoZWRNZXRhLmRhdGE7dGhpcy5fdXBkYXRlUmFkaXVzKCksdGhpcy51cGRhdGVFbGVtZW50cyhlLDAsZS5sZW5ndGgsdCl9Z2V0TWluTWF4KCl7Y29uc3QgdD10aGlzLl9jYWNoZWRNZXRhLGU9e21pbjpOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFksbWF4Ok51bWJlci5ORUdBVElWRV9JTkZJTklUWX07cmV0dXJuIHQuZGF0YS5mb3JFYWNoKCgodCxpKT0+e2NvbnN0IHM9dGhpcy5nZXRQYXJzZWQoaSkucjshaXNOYU4ocykmJnRoaXMuY2hhcnQuZ2V0RGF0YVZpc2liaWxpdHkoaSkmJihzPGUubWluJiYoZS5taW49cykscz5lLm1heCYmKGUubWF4PXMpKX0pKSxlfV91cGRhdGVSYWRpdXMoKXtjb25zdCB0PXRoaXMuY2hhcnQsZT10LmNoYXJ0QXJlYSxpPXQub3B0aW9ucyxzPU1hdGgubWluKGUucmlnaHQtZS5sZWZ0LGUuYm90dG9tLWUudG9wKSxuPU1hdGgubWF4KHMvMiwwKSxvPShuLU1hdGgubWF4KGkuY3V0b3V0UGVyY2VudGFnZT9uLzEwMCppLmN1dG91dFBlcmNlbnRhZ2U6MSwwKSkvdC5nZXRWaXNpYmxlRGF0YXNldENvdW50KCk7dGhpcy5vdXRlclJhZGl1cz1uLW8qdGhpcy5pbmRleCx0aGlzLmlubmVyUmFkaXVzPXRoaXMub3V0ZXJSYWRpdXMtb311cGRhdGVFbGVtZW50cyh0LGUsaSxzKXtjb25zdCBuPSJyZXNldCI9PT1zLG89dGhpcy5jaGFydCxhPW8ub3B0aW9ucy5hbmltYXRpb24scj10aGlzLl9jYWNoZWRNZXRhLnJTY2FsZSxsPXIueENlbnRlcixoPXIueUNlbnRlcixjPXIuZ2V0SW5kZXhBbmdsZSgwKS0uNSpDO2xldCBkLHU9Yztjb25zdCBmPTM2MC90aGlzLmNvdW50VmlzaWJsZUVsZW1lbnRzKCk7Zm9yKGQ9MDtkPGU7KytkKXUrPXRoaXMuX2NvbXB1dGVBbmdsZShkLHMsZik7Zm9yKGQ9ZTtkPGUraTtkKyspe2NvbnN0IGU9dFtkXTtsZXQgaT11LGc9dSt0aGlzLl9jb21wdXRlQW5nbGUoZCxzLGYpLHA9by5nZXREYXRhVmlzaWJpbGl0eShkKT9yLmdldERpc3RhbmNlRnJvbUNlbnRlckZvclZhbHVlKHRoaXMuZ2V0UGFyc2VkKGQpLnIpOjA7dT1nLG4mJihhLmFuaW1hdGVTY2FsZSYmKHA9MCksYS5hbmltYXRlUm90YXRlJiYoaT1nPWMpKTtjb25zdCBtPXt4OmwseTpoLGlubmVyUmFkaXVzOjAsb3V0ZXJSYWRpdXM6cCxzdGFydEFuZ2xlOmksZW5kQW5nbGU6ZyxvcHRpb25zOnRoaXMucmVzb2x2ZURhdGFFbGVtZW50T3B0aW9ucyhkLGUuYWN0aXZlPyJhY3RpdmUiOnMpfTt0aGlzLnVwZGF0ZUVsZW1lbnQoZSxkLG0scyl9fWNvdW50VmlzaWJsZUVsZW1lbnRzKCl7Y29uc3QgdD10aGlzLl9jYWNoZWRNZXRhO2xldCBlPTA7cmV0dXJuIHQuZGF0YS5mb3JFYWNoKCgodCxpKT0+eyFpc05hTih0aGlzLmdldFBhcnNlZChpKS5yKSYmdGhpcy5jaGFydC5nZXREYXRhVmlzaWJpbGl0eShpKSYmZSsrfSkpLGV9X2NvbXB1dGVBbmdsZSh0LGUsaSl7cmV0dXJuIHRoaXMuY2hhcnQuZ2V0RGF0YVZpc2liaWxpdHkodCk/JCh0aGlzLnJlc29sdmVEYXRhRWxlbWVudE9wdGlvbnModCxlKS5hbmdsZXx8aSk6MH19dmFyIFVuPU9iamVjdC5mcmVlemUoe19fcHJvdG9fXzpudWxsLEJhckNvbnRyb2xsZXI6Y2xhc3MgZXh0ZW5kcyBqc3tzdGF0aWMgaWQ9ImJhciI7c3RhdGljIGRlZmF1bHRzPXtkYXRhc2V0RWxlbWVudFR5cGU6ITEsZGF0YUVsZW1lbnRUeXBlOiJiYXIiLGNhdGVnb3J5UGVyY2VudGFnZTouOCxiYXJQZXJjZW50YWdlOi45LGdyb3VwZWQ6ITAsYW5pbWF0aW9uczp7bnVtYmVyczp7dHlwZToibnVtYmVyIixwcm9wZXJ0aWVzOlsieCIsInkiLCJiYXNlIiwid2lkdGgiLCJoZWlnaHQiXX19fTtzdGF0aWMgb3ZlcnJpZGVzPXtzY2FsZXM6e19pbmRleF86e3R5cGU6ImNhdGVnb3J5IixvZmZzZXQ6ITAsZ3JpZDp7b2Zmc2V0OiEwfX0sX3ZhbHVlXzp7dHlwZToibGluZWFyIixiZWdpbkF0WmVybzohMH19fTtwYXJzZVByaW1pdGl2ZURhdGEodCxlLGkscyl7cmV0dXJuIFZuKHQsZSxpLHMpfXBhcnNlQXJyYXlEYXRhKHQsZSxpLHMpe3JldHVybiBWbih0LGUsaSxzKX1wYXJzZU9iamVjdERhdGEodCxlLGkscyl7Y29uc3R7aVNjYWxlOm4sdlNjYWxlOm99PXQse3hBeGlzS2V5OmE9IngiLHlBeGlzS2V5OnI9InkifT10aGlzLl9wYXJzaW5nLGw9IngiPT09bi5heGlzP2E6cixoPSJ4Ij09PW8uYXhpcz9hOnIsYz1bXTtsZXQgZCx1LGYsZztmb3IoZD1pLHU9aStzO2Q8dTsrK2QpZz1lW2RdLGY9e30sZltuLmF4aXNdPW4ucGFyc2UoTShnLGwpLGQpLGMucHVzaChGbihNKGcsaCksZixvLGQpKTtyZXR1cm4gY311cGRhdGVSYW5nZUZyb21QYXJzZWQodCxlLGkscyl7c3VwZXIudXBkYXRlUmFuZ2VGcm9tUGFyc2VkKHQsZSxpLHMpO2NvbnN0IG49aS5fY3VzdG9tO24mJmU9PT10aGlzLl9jYWNoZWRNZXRhLnZTY2FsZSYmKHQubWluPU1hdGgubWluKHQubWluLG4ubWluKSx0Lm1heD1NYXRoLm1heCh0Lm1heCxuLm1heCkpfWdldE1heE92ZXJmbG93KCl7cmV0dXJuIDB9Z2V0TGFiZWxBbmRWYWx1ZSh0KXtjb25zdCBlPXRoaXMuX2NhY2hlZE1ldGEse2lTY2FsZTppLHZTY2FsZTpzfT1lLG49dGhpcy5nZXRQYXJzZWQodCksbz1uLl9jdXN0b20sYT1CbihvKT8iWyIrby5zdGFydCsiLCAiK28uZW5kKyJdIjoiIitzLmdldExhYmVsRm9yVmFsdWUobltzLmF4aXNdKTtyZXR1cm57bGFiZWw6IiIraS5nZXRMYWJlbEZvclZhbHVlKG5baS5heGlzXSksdmFsdWU6YX19aW5pdGlhbGl6ZSgpe3RoaXMuZW5hYmxlT3B0aW9uU2hhcmluZz0hMCxzdXBlci5pbml0aWFsaXplKCk7dGhpcy5fY2FjaGVkTWV0YS5zdGFjaz10aGlzLmdldERhdGFzZXQoKS5zdGFja311cGRhdGUodCl7Y29uc3QgZT10aGlzLl9jYWNoZWRNZXRhO3RoaXMudXBkYXRlRWxlbWVudHMoZS5kYXRhLDAsZS5kYXRhLmxlbmd0aCx0KX11cGRhdGVFbGVtZW50cyh0LGUsaSxuKXtjb25zdCBvPSJyZXNldCI9PT1uLHtpbmRleDphLF9jYWNoZWRNZXRhOnt2U2NhbGU6cn19PXRoaXMsbD1yLmdldEJhc2VQaXhlbCgpLGg9ci5pc0hvcml6b250YWwoKSxjPXRoaXMuX2dldFJ1bGVyKCkse3NoYXJlZE9wdGlvbnM6ZCxpbmNsdWRlT3B0aW9uczp1fT10aGlzLl9nZXRTaGFyZWRPcHRpb25zKGUsbik7Zm9yKGxldCBmPWU7ZjxlK2k7ZisrKXtjb25zdCBlPXRoaXMuZ2V0UGFyc2VkKGYpLGk9b3x8cyhlW3IuYXhpc10pP3tiYXNlOmwsaGVhZDpsfTp0aGlzLl9jYWxjdWxhdGVCYXJWYWx1ZVBpeGVscyhmKSxnPXRoaXMuX2NhbGN1bGF0ZUJhckluZGV4UGl4ZWxzKGYsYykscD0oZS5fc3RhY2tzfHx7fSlbci5heGlzXSxtPXtob3Jpem9udGFsOmgsYmFzZTppLmJhc2UsZW5hYmxlQm9yZGVyUmFkaXVzOiFwfHxCbihlLl9jdXN0b20pfHxhPT09cC5fdG9wfHxhPT09cC5fYm90dG9tLHg6aD9pLmhlYWQ6Zy5jZW50ZXIseTpoP2cuY2VudGVyOmkuaGVhZCxoZWlnaHQ6aD9nLnNpemU6TWF0aC5hYnMoaS5zaXplKSx3aWR0aDpoP01hdGguYWJzKGkuc2l6ZSk6Zy5zaXplfTt1JiYobS5vcHRpb25zPWR8fHRoaXMucmVzb2x2ZURhdGFFbGVtZW50T3B0aW9ucyhmLHRbZl0uYWN0aXZlPyJhY3RpdmUiOm4pKTtjb25zdCB4PW0ub3B0aW9uc3x8dFtmXS5vcHRpb25zO1duKG0seCxwLGEpLGpuKG0seCxjLnJhdGlvKSx0aGlzLnVwZGF0ZUVsZW1lbnQodFtmXSxmLG0sbil9fV9nZXRTdGFja3ModCxlKXtjb25zdHtpU2NhbGU6aX09dGhpcy5fY2FjaGVkTWV0YSxuPWkuZ2V0TWF0Y2hpbmdWaXNpYmxlTWV0YXModGhpcy5fdHlwZSkuZmlsdGVyKCh0PT50LmNvbnRyb2xsZXIub3B0aW9ucy5ncm91cGVkKSksbz1pLm9wdGlvbnMuc3RhY2tlZCxhPVtdLHI9dGhpcy5fY2FjaGVkTWV0YS5jb250cm9sbGVyLmdldFBhcnNlZChlKSxsPXImJnJbaS5heGlzXSxoPXQ9Pntjb25zdCBlPXQuX3BhcnNlZC5maW5kKCh0PT50W2kuYXhpc109PT1sKSksbj1lJiZlW3QudlNjYWxlLmF4aXNdO2lmKHMobil8fGlzTmFOKG4pKXJldHVybiEwfTtmb3IoY29uc3QgaSBvZiBuKWlmKCh2b2lkIDA9PT1lfHwhaChpKSkmJigoITE9PT1vfHwtMT09PWEuaW5kZXhPZihpLnN0YWNrKXx8dm9pZCAwPT09byYmdm9pZCAwPT09aS5zdGFjaykmJmEucHVzaChpLnN0YWNrKSxpLmluZGV4PT09dCkpYnJlYWs7cmV0dXJuIGEubGVuZ3RofHxhLnB1c2godm9pZCAwKSxhfV9nZXRTdGFja0NvdW50KHQpe3JldHVybiB0aGlzLl9nZXRTdGFja3Modm9pZCAwLHQpLmxlbmd0aH1fZ2V0QXhpc0NvdW50KCl7cmV0dXJuIHRoaXMuX2dldEF4aXMoKS5sZW5ndGh9Z2V0Rmlyc3RTY2FsZUlkRm9ySW5kZXhBeGlzKCl7Y29uc3QgdD10aGlzLmNoYXJ0LnNjYWxlcyxlPXRoaXMuY2hhcnQub3B0aW9ucy5pbmRleEF4aXM7cmV0dXJuIE9iamVjdC5rZXlzKHQpLmZpbHRlcigoaT0+dFtpXS5heGlzPT09ZSkpLnNoaWZ0KCl9X2dldEF4aXMoKXtjb25zdCB0PXt9LGU9dGhpcy5nZXRGaXJzdFNjYWxlSWRGb3JJbmRleEF4aXMoKTtmb3IoY29uc3QgaSBvZiB0aGlzLmNoYXJ0LmRhdGEuZGF0YXNldHMpdFtsKCJ4Ij09PXRoaXMuY2hhcnQub3B0aW9ucy5pbmRleEF4aXM/aS54QXhpc0lEOmkueUF4aXNJRCxlKV09ITA7cmV0dXJuIE9iamVjdC5rZXlzKHQpfV9nZXRTdGFja0luZGV4KHQsZSxpKXtjb25zdCBzPXRoaXMuX2dldFN0YWNrcyh0LGkpLG49dm9pZCAwIT09ZT9zLmluZGV4T2YoZSk6LTE7cmV0dXJuLTE9PT1uP3MubGVuZ3RoLTE6bn1fZ2V0UnVsZXIoKXtjb25zdCB0PXRoaXMub3B0aW9ucyxlPXRoaXMuX2NhY2hlZE1ldGEsaT1lLmlTY2FsZSxzPVtdO2xldCBuLG87Zm9yKG49MCxvPWUuZGF0YS5sZW5ndGg7bjxvOysrbilzLnB1c2goaS5nZXRQaXhlbEZvclZhbHVlKHRoaXMuZ2V0UGFyc2VkKG4pW2kuYXhpc10sbikpO2NvbnN0IGE9dC5iYXJUaGlja25lc3M7cmV0dXJue21pbjphfHx6bihlKSxwaXhlbHM6cyxzdGFydDppLl9zdGFydFBpeGVsLGVuZDppLl9lbmRQaXhlbCxzdGFja0NvdW50OnRoaXMuX2dldFN0YWNrQ291bnQoKSxzY2FsZTppLGdyb3VwZWQ6dC5ncm91cGVkLHJhdGlvOmE/MTp0LmNhdGVnb3J5UGVyY2VudGFnZSp0LmJhclBlcmNlbnRhZ2V9fV9jYWxjdWxhdGVCYXJWYWx1ZVBpeGVscyh0KXtjb25zdHtfY2FjaGVkTWV0YTp7dlNjYWxlOmUsX3N0YWNrZWQ6aSxpbmRleDpufSxvcHRpb25zOntiYXNlOm8sbWluQmFyTGVuZ3RoOmF9fT10aGlzLHI9b3x8MCxsPXRoaXMuZ2V0UGFyc2VkKHQpLGg9bC5fY3VzdG9tLGM9Qm4oaCk7bGV0IGQsdSxmPWxbZS5heGlzXSxnPTAscD1pP3RoaXMuYXBwbHlTdGFjayhlLGwsaSk6ZjtwIT09ZiYmKGc9cC1mLHA9ZiksYyYmKGY9aC5iYXJTdGFydCxwPWguYmFyRW5kLWguYmFyU3RhcnQsMCE9PWYmJkYoZikhPT1GKGguYmFyRW5kKSYmKGc9MCksZys9Zik7Y29uc3QgbT1zKG8pfHxjP2c6bztsZXQgeD1lLmdldFBpeGVsRm9yVmFsdWUobSk7aWYoZD10aGlzLmNoYXJ0LmdldERhdGFWaXNpYmlsaXR5KHQpP2UuZ2V0UGl4ZWxGb3JWYWx1ZShnK3ApOngsdT1kLXgsTWF0aC5hYnModSk8YSl7dT1mdW5jdGlvbih0LGUsaSl7cmV0dXJuIDAhPT10P0YodCk6KGUuaXNIb3Jpem9udGFsKCk/MTotMSkqKGUubWluPj1pPzE6LTEpfSh1LGUscikqYSxmPT09ciYmKHgtPXUvMik7Y29uc3QgdD1lLmdldFBpeGVsRm9yRGVjaW1hbCgwKSxzPWUuZ2V0UGl4ZWxGb3JEZWNpbWFsKDEpLG89TWF0aC5taW4odCxzKSxoPU1hdGgubWF4KHQscyk7eD1NYXRoLm1heChNYXRoLm1pbih4LGgpLG8pLGQ9eCt1LGkmJiFjJiYobC5fc3RhY2tzW2UuYXhpc10uX3Zpc3VhbFZhbHVlc1tuXT1lLmdldFZhbHVlRm9yUGl4ZWwoZCktZS5nZXRWYWx1ZUZvclBpeGVsKHgpKX1pZih4PT09ZS5nZXRQaXhlbEZvclZhbHVlKHIpKXtjb25zdCB0PUYodSkqZS5nZXRMaW5lV2lkdGhGb3JWYWx1ZShyKS8yO3grPXQsdS09dH1yZXR1cm57c2l6ZTp1LGJhc2U6eCxoZWFkOmQsY2VudGVyOmQrdS8yfX1fY2FsY3VsYXRlQmFySW5kZXhQaXhlbHModCxlKXtjb25zdCBpPWUuc2NhbGUsbj10aGlzLm9wdGlvbnMsbz1uLnNraXBOdWxsLGE9bChuLm1heEJhclRoaWNrbmVzcywxLzApO2xldCByLGg7Y29uc3QgYz10aGlzLl9nZXRBeGlzQ291bnQoKTtpZihlLmdyb3VwZWQpe2NvbnN0IGk9bz90aGlzLl9nZXRTdGFja0NvdW50KHQpOmUuc3RhY2tDb3VudCxkPSJmbGV4Ij09PW4uYmFyVGhpY2tuZXNzP2Z1bmN0aW9uKHQsZSxpLHMpe2NvbnN0IG49ZS5waXhlbHMsbz1uW3RdO2xldCBhPXQ+MD9uW3QtMV06bnVsbCxyPXQ8bi5sZW5ndGgtMT9uW3QrMV06bnVsbDtjb25zdCBsPWkuY2F0ZWdvcnlQZXJjZW50YWdlO251bGw9PT1hJiYoYT1vLShudWxsPT09cj9lLmVuZC1lLnN0YXJ0OnItbykpLG51bGw9PT1yJiYocj1vK28tYSk7Y29uc3QgaD1vLShvLU1hdGgubWluKGEscikpLzIqbDtyZXR1cm57Y2h1bms6TWF0aC5hYnMoci1hKS8yKmwvcyxyYXRpbzppLmJhclBlcmNlbnRhZ2Usc3RhcnQ6aH19KHQsZSxuLGkqYyk6ZnVuY3Rpb24odCxlLGksbil7Y29uc3Qgbz1pLmJhclRoaWNrbmVzcztsZXQgYSxyO3JldHVybiBzKG8pPyhhPWUubWluKmkuY2F0ZWdvcnlQZXJjZW50YWdlLHI9aS5iYXJQZXJjZW50YWdlKTooYT1vKm4scj0xKSx7Y2h1bms6YS9uLHJhdGlvOnIsc3RhcnQ6ZS5waXhlbHNbdF0tYS8yfX0odCxlLG4saSpjKSx1PSJ4Ij09PXRoaXMuY2hhcnQub3B0aW9ucy5pbmRleEF4aXM/dGhpcy5nZXREYXRhc2V0KCkueEF4aXNJRDp0aGlzLmdldERhdGFzZXQoKS55QXhpc0lELGY9dGhpcy5fZ2V0QXhpcygpLmluZGV4T2YobCh1LHRoaXMuZ2V0Rmlyc3RTY2FsZUlkRm9ySW5kZXhBeGlzKCkpKSxnPXRoaXMuX2dldFN0YWNrSW5kZXgodGhpcy5pbmRleCx0aGlzLl9jYWNoZWRNZXRhLnN0YWNrLG8/dDp2b2lkIDApK2Y7cj1kLnN0YXJ0K2QuY2h1bmsqZytkLmNodW5rLzIsaD1NYXRoLm1pbihhLGQuY2h1bmsqZC5yYXRpbyl9ZWxzZSByPWkuZ2V0UGl4ZWxGb3JWYWx1ZSh0aGlzLmdldFBhcnNlZCh0KVtpLmF4aXNdLHQpLGg9TWF0aC5taW4oYSxlLm1pbiplLnJhdGlvKTtyZXR1cm57YmFzZTpyLWgvMixoZWFkOnIraC8yLGNlbnRlcjpyLHNpemU6aH19ZHJhdygpe2NvbnN0IHQ9dGhpcy5fY2FjaGVkTWV0YSxlPXQudlNjYWxlLGk9dC5kYXRhLHM9aS5sZW5ndGg7bGV0IG49MDtmb3IoO248czsrK24pbnVsbD09PXRoaXMuZ2V0UGFyc2VkKG4pW2UuYXhpc118fGlbbl0uaGlkZGVufHxpW25dLmRyYXcodGhpcy5fY3R4KX19LEJ1YmJsZUNvbnRyb2xsZXI6Y2xhc3MgZXh0ZW5kcyBqc3tzdGF0aWMgaWQ9ImJ1YmJsZSI7c3RhdGljIGRlZmF1bHRzPXtkYXRhc2V0RWxlbWVudFR5cGU6ITEsZGF0YUVsZW1lbnRUeXBlOiJwb2ludCIsYW5pbWF0aW9uczp7bnVtYmVyczp7dHlwZToibnVtYmVyIixwcm9wZXJ0aWVzOlsieCIsInkiLCJib3JkZXJXaWR0aCIsInJhZGl1cyJdfX19O3N0YXRpYyBvdmVycmlkZXM9e3NjYWxlczp7eDp7dHlwZToibGluZWFyIn0seTp7dHlwZToibGluZWFyIn19fTtpbml0aWFsaXplKCl7dGhpcy5lbmFibGVPcHRpb25TaGFyaW5nPSEwLHN1cGVyLmluaXRpYWxpemUoKX1wYXJzZVByaW1pdGl2ZURhdGEodCxlLGkscyl7Y29uc3Qgbj1zdXBlci5wYXJzZVByaW1pdGl2ZURhdGEodCxlLGkscyk7Zm9yKGxldCB0PTA7dDxuLmxlbmd0aDt0Kyspblt0XS5fY3VzdG9tPXRoaXMucmVzb2x2ZURhdGFFbGVtZW50T3B0aW9ucyh0K2kpLnJhZGl1cztyZXR1cm4gbn1wYXJzZUFycmF5RGF0YSh0LGUsaSxzKXtjb25zdCBuPXN1cGVyLnBhcnNlQXJyYXlEYXRhKHQsZSxpLHMpO2ZvcihsZXQgdD0wO3Q8bi5sZW5ndGg7dCsrKXtjb25zdCBzPWVbaSt0XTtuW3RdLl9jdXN0b209bChzWzJdLHRoaXMucmVzb2x2ZURhdGFFbGVtZW50T3B0aW9ucyh0K2kpLnJhZGl1cyl9cmV0dXJuIG59cGFyc2VPYmplY3REYXRhKHQsZSxpLHMpe2NvbnN0IG49c3VwZXIucGFyc2VPYmplY3REYXRhKHQsZSxpLHMpO2ZvcihsZXQgdD0wO3Q8bi5sZW5ndGg7dCsrKXtjb25zdCBzPWVbaSt0XTtuW3RdLl9jdXN0b209bChzJiZzLnImJitzLnIsdGhpcy5yZXNvbHZlRGF0YUVsZW1lbnRPcHRpb25zKHQraSkucmFkaXVzKX1yZXR1cm4gbn1nZXRNYXhPdmVyZmxvdygpe2NvbnN0IHQ9dGhpcy5fY2FjaGVkTWV0YS5kYXRhO2xldCBlPTA7Zm9yKGxldCBpPXQubGVuZ3RoLTE7aT49MDstLWkpZT1NYXRoLm1heChlLHRbaV0uc2l6ZSh0aGlzLnJlc29sdmVEYXRhRWxlbWVudE9wdGlvbnMoaSkpLzIpO3JldHVybiBlPjAmJmV9Z2V0TGFiZWxBbmRWYWx1ZSh0KXtjb25zdCBlPXRoaXMuX2NhY2hlZE1ldGEsaT10aGlzLmNoYXJ0LmRhdGEubGFiZWxzfHxbXSx7eFNjYWxlOnMseVNjYWxlOm59PWUsbz10aGlzLmdldFBhcnNlZCh0KSxhPXMuZ2V0TGFiZWxGb3JWYWx1ZShvLngpLHI9bi5nZXRMYWJlbEZvclZhbHVlKG8ueSksbD1vLl9jdXN0b207cmV0dXJue2xhYmVsOmlbdF18fCIiLHZhbHVlOiIoIithKyIsICIrcisobD8iLCAiK2w6IiIpKyIpIn19dXBkYXRlKHQpe2NvbnN0IGU9dGhpcy5fY2FjaGVkTWV0YS5kYXRhO3RoaXMudXBkYXRlRWxlbWVudHMoZSwwLGUubGVuZ3RoLHQpfXVwZGF0ZUVsZW1lbnRzKHQsZSxpLHMpe2NvbnN0IG49InJlc2V0Ij09PXMse2lTY2FsZTpvLHZTY2FsZTphfT10aGlzLl9jYWNoZWRNZXRhLHtzaGFyZWRPcHRpb25zOnIsaW5jbHVkZU9wdGlvbnM6bH09dGhpcy5fZ2V0U2hhcmVkT3B0aW9ucyhlLHMpLGg9by5heGlzLGM9YS5heGlzO2ZvcihsZXQgZD1lO2Q8ZStpO2QrKyl7Y29uc3QgZT10W2RdLGk9IW4mJnRoaXMuZ2V0UGFyc2VkKGQpLHU9e30sZj11W2hdPW4/by5nZXRQaXhlbEZvckRlY2ltYWwoLjUpOm8uZ2V0UGl4ZWxGb3JWYWx1ZShpW2hdKSxnPXVbY109bj9hLmdldEJhc2VQaXhlbCgpOmEuZ2V0UGl4ZWxGb3JWYWx1ZShpW2NdKTt1LnNraXA9aXNOYU4oZil8fGlzTmFOKGcpLGwmJih1Lm9wdGlvbnM9cnx8dGhpcy5yZXNvbHZlRGF0YUVsZW1lbnRPcHRpb25zKGQsZS5hY3RpdmU/ImFjdGl2ZSI6cyksbiYmKHUub3B0aW9ucy5yYWRpdXM9MCkpLHRoaXMudXBkYXRlRWxlbWVudChlLGQsdSxzKX19cmVzb2x2ZURhdGFFbGVtZW50T3B0aW9ucyh0LGUpe2NvbnN0IGk9dGhpcy5nZXRQYXJzZWQodCk7bGV0IHM9c3VwZXIucmVzb2x2ZURhdGFFbGVtZW50T3B0aW9ucyh0LGUpO3MuJHNoYXJlZCYmKHM9T2JqZWN0LmFzc2lnbih7fSxzLHskc2hhcmVkOiExfSkpO2NvbnN0IG49cy5yYWRpdXM7cmV0dXJuImFjdGl2ZSIhPT1lJiYocy5yYWRpdXM9MCkscy5yYWRpdXMrPWwoaSYmaS5fY3VzdG9tLG4pLHN9fSxEb3VnaG51dENvbnRyb2xsZXI6JG4sTGluZUNvbnRyb2xsZXI6Y2xhc3MgZXh0ZW5kcyBqc3tzdGF0aWMgaWQ9ImxpbmUiO3N0YXRpYyBkZWZhdWx0cz17ZGF0YXNldEVsZW1lbnRUeXBlOiJsaW5lIixkYXRhRWxlbWVudFR5cGU6InBvaW50IixzaG93TGluZTohMCxzcGFuR2FwczohMX07c3RhdGljIG92ZXJyaWRlcz17c2NhbGVzOntfaW5kZXhfOnt0eXBlOiJjYXRlZ29yeSJ9LF92YWx1ZV86e3R5cGU6ImxpbmVhciJ9fX07aW5pdGlhbGl6ZSgpe3RoaXMuZW5hYmxlT3B0aW9uU2hhcmluZz0hMCx0aGlzLnN1cHBvcnRzRGVjaW1hdGlvbj0hMCxzdXBlci5pbml0aWFsaXplKCl9dXBkYXRlKHQpe2NvbnN0IGU9dGhpcy5fY2FjaGVkTWV0YSx7ZGF0YXNldDppLGRhdGE6cz1bXSxfZGF0YXNldDpufT1lLG89dGhpcy5jaGFydC5fYW5pbWF0aW9uc0Rpc2FibGVkO2xldHtzdGFydDphLGNvdW50OnJ9PXB0KGUscyxvKTt0aGlzLl9kcmF3U3RhcnQ9YSx0aGlzLl9kcmF3Q291bnQ9cixtdChlKSYmKGE9MCxyPXMubGVuZ3RoKSxpLl9jaGFydD10aGlzLmNoYXJ0LGkuX2RhdGFzZXRJbmRleD10aGlzLmluZGV4LGkuX2RlY2ltYXRlZD0hIW4uX2RlY2ltYXRlZCxpLnBvaW50cz1zO2NvbnN0IGw9dGhpcy5yZXNvbHZlRGF0YXNldEVsZW1lbnRPcHRpb25zKHQpO3RoaXMub3B0aW9ucy5zaG93TGluZXx8KGwuYm9yZGVyV2lkdGg9MCksbC5zZWdtZW50PXRoaXMub3B0aW9ucy5zZWdtZW50LHRoaXMudXBkYXRlRWxlbWVudChpLHZvaWQgMCx7YW5pbWF0ZWQ6IW8sb3B0aW9uczpsfSx0KSx0aGlzLnVwZGF0ZUVsZW1lbnRzKHMsYSxyLHQpfXVwZGF0ZUVsZW1lbnRzKHQsZSxpLG4pe2NvbnN0IG89InJlc2V0Ij09PW4se2lTY2FsZTphLHZTY2FsZTpyLF9zdGFja2VkOmwsX2RhdGFzZXQ6aH09dGhpcy5fY2FjaGVkTWV0YSx7c2hhcmVkT3B0aW9uczpjLGluY2x1ZGVPcHRpb25zOmR9PXRoaXMuX2dldFNoYXJlZE9wdGlvbnMoZSxuKSx1PWEuYXhpcyxmPXIuYXhpcyx7c3BhbkdhcHM6ZyxzZWdtZW50OnB9PXRoaXMub3B0aW9ucyxtPU4oZyk/ZzpOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkseD10aGlzLmNoYXJ0Ll9hbmltYXRpb25zRGlzYWJsZWR8fG98fCJub25lIj09PW4sYj1lK2ksXz10Lmxlbmd0aDtsZXQgeT1lPjAmJnRoaXMuZ2V0UGFyc2VkKGUtMSk7Zm9yKGxldCBpPTA7aTxfOysraSl7Y29uc3QgZz10W2ldLF89eD9nOnt9O2lmKGk8ZXx8aT49Yil7Xy5za2lwPSEwO2NvbnRpbnVlfWNvbnN0IHY9dGhpcy5nZXRQYXJzZWQoaSksTT1zKHZbZl0pLHc9X1t1XT1hLmdldFBpeGVsRm9yVmFsdWUodlt1XSxpKSxrPV9bZl09b3x8TT9yLmdldEJhc2VQaXhlbCgpOnIuZ2V0UGl4ZWxGb3JWYWx1ZShsP3RoaXMuYXBwbHlTdGFjayhyLHYsbCk6dltmXSxpKTtfLnNraXA9aXNOYU4odyl8fGlzTmFOKGspfHxNLF8uc3RvcD1pPjAmJk1hdGguYWJzKHZbdV0teVt1XSk+bSxwJiYoXy5wYXJzZWQ9dixfLnJhdz1oLmRhdGFbaV0pLGQmJihfLm9wdGlvbnM9Y3x8dGhpcy5yZXNvbHZlRGF0YUVsZW1lbnRPcHRpb25zKGksZy5hY3RpdmU/ImFjdGl2ZSI6bikpLHh8fHRoaXMudXBkYXRlRWxlbWVudChnLGksXyxuKSx5PXZ9fWdldE1heE92ZXJmbG93KCl7Y29uc3QgdD10aGlzLl9jYWNoZWRNZXRhLGU9dC5kYXRhc2V0LGk9ZS5vcHRpb25zJiZlLm9wdGlvbnMuYm9yZGVyV2lkdGh8fDAscz10LmRhdGF8fFtdO2lmKCFzLmxlbmd0aClyZXR1cm4gaTtjb25zdCBuPXNbMF0uc2l6ZSh0aGlzLnJlc29sdmVEYXRhRWxlbWVudE9wdGlvbnMoMCkpLG89c1tzLmxlbmd0aC0xXS5zaXplKHRoaXMucmVzb2x2ZURhdGFFbGVtZW50T3B0aW9ucyhzLmxlbmd0aC0xKSk7cmV0dXJuIE1hdGgubWF4KGksbixvKS8yfWRyYXcoKXtjb25zdCB0PXRoaXMuX2NhY2hlZE1ldGE7dC5kYXRhc2V0LnVwZGF0ZUNvbnRyb2xQb2ludHModGhpcy5jaGFydC5jaGFydEFyZWEsdC5pU2NhbGUuYXhpcyksc3VwZXIuZHJhdygpfX0sUGllQ29udHJvbGxlcjpjbGFzcyBleHRlbmRzICRue3N0YXRpYyBpZD0icGllIjtzdGF0aWMgZGVmYXVsdHM9e2N1dG91dDowLHJvdGF0aW9uOjAsY2lyY3VtZmVyZW5jZTozNjAscmFkaXVzOiIxMDAlIn19LFBvbGFyQXJlYUNvbnRyb2xsZXI6WW4sUmFkYXJDb250cm9sbGVyOmNsYXNzIGV4dGVuZHMganN7c3RhdGljIGlkPSJyYWRhciI7c3RhdGljIGRlZmF1bHRzPXtkYXRhc2V0RWxlbWVudFR5cGU6ImxpbmUiLGRhdGFFbGVtZW50VHlwZToicG9pbnQiLGluZGV4QXhpczoiciIsc2hvd0xpbmU6ITAsZWxlbWVudHM6e2xpbmU6e2ZpbGw6InN0YXJ0In19fTtzdGF0aWMgb3ZlcnJpZGVzPXthc3BlY3RSYXRpbzoxLHNjYWxlczp7cjp7dHlwZToicmFkaWFsTGluZWFyIn19fTtnZXRMYWJlbEFuZFZhbHVlKHQpe2NvbnN0IGU9dGhpcy5fY2FjaGVkTWV0YS52U2NhbGUsaT10aGlzLmdldFBhcnNlZCh0KTtyZXR1cm57bGFiZWw6ZS5nZXRMYWJlbHMoKVt0XSx2YWx1ZToiIitlLmdldExhYmVsRm9yVmFsdWUoaVtlLmF4aXNdKX19cGFyc2VPYmplY3REYXRhKHQsZSxpLHMpe3JldHVybiBpaS5iaW5kKHRoaXMpKHQsZSxpLHMpfXVwZGF0ZSh0KXtjb25zdCBlPXRoaXMuX2NhY2hlZE1ldGEsaT1lLmRhdGFzZXQscz1lLmRhdGF8fFtdLG49ZS5pU2NhbGUuZ2V0TGFiZWxzKCk7aWYoaS5wb2ludHM9cywicmVzaXplIiE9PXQpe2NvbnN0IGU9dGhpcy5yZXNvbHZlRGF0YXNldEVsZW1lbnRPcHRpb25zKHQpO3RoaXMub3B0aW9ucy5zaG93TGluZXx8KGUuYm9yZGVyV2lkdGg9MCk7Y29uc3Qgbz17X2xvb3A6ITAsX2Z1bGxMb29wOm4ubGVuZ3RoPT09cy5sZW5ndGgsb3B0aW9uczplfTt0aGlzLnVwZGF0ZUVsZW1lbnQoaSx2b2lkIDAsbyx0KX10aGlzLnVwZGF0ZUVsZW1lbnRzKHMsMCxzLmxlbmd0aCx0KX11cGRhdGVFbGVtZW50cyh0LGUsaSxzKXtjb25zdCBuPXRoaXMuX2NhY2hlZE1ldGEuclNjYWxlLG89InJlc2V0Ij09PXM7Zm9yKGxldCBhPWU7YTxlK2k7YSsrKXtjb25zdCBlPXRbYV0saT10aGlzLnJlc29sdmVEYXRhRWxlbWVudE9wdGlvbnMoYSxlLmFjdGl2ZT8iYWN0aXZlIjpzKSxyPW4uZ2V0UG9pbnRQb3NpdGlvbkZvclZhbHVlKGEsdGhpcy5nZXRQYXJzZWQoYSkuciksbD1vP24ueENlbnRlcjpyLngsaD1vP24ueUNlbnRlcjpyLnksYz17eDpsLHk6aCxhbmdsZTpyLmFuZ2xlLHNraXA6aXNOYU4obCl8fGlzTmFOKGgpLG9wdGlvbnM6aX07dGhpcy51cGRhdGVFbGVtZW50KGUsYSxjLHMpfX19LFNjYXR0ZXJDb250cm9sbGVyOmNsYXNzIGV4dGVuZHMganN7c3RhdGljIGlkPSJzY2F0dGVyIjtzdGF0aWMgZGVmYXVsdHM9e2RhdGFzZXRFbGVtZW50VHlwZTohMSxkYXRhRWxlbWVudFR5cGU6InBvaW50IixzaG93TGluZTohMSxmaWxsOiExfTtzdGF0aWMgb3ZlcnJpZGVzPXtpbnRlcmFjdGlvbjp7bW9kZToicG9pbnQifSxzY2FsZXM6e3g6e3R5cGU6ImxpbmVhciJ9LHk6e3R5cGU6ImxpbmVhciJ9fX07Z2V0TGFiZWxBbmRWYWx1ZSh0KXtjb25zdCBlPXRoaXMuX2NhY2hlZE1ldGEsaT10aGlzLmNoYXJ0LmRhdGEubGFiZWxzfHxbXSx7eFNjYWxlOnMseVNjYWxlOm59PWUsbz10aGlzLmdldFBhcnNlZCh0KSxhPXMuZ2V0TGFiZWxGb3JWYWx1ZShvLngpLHI9bi5nZXRMYWJlbEZvclZhbHVlKG8ueSk7cmV0dXJue2xhYmVsOmlbdF18fCIiLHZhbHVlOiIoIithKyIsICIrcisiKSJ9fXVwZGF0ZSh0KXtjb25zdCBlPXRoaXMuX2NhY2hlZE1ldGEse2RhdGE6aT1bXX09ZSxzPXRoaXMuY2hhcnQuX2FuaW1hdGlvbnNEaXNhYmxlZDtsZXR7c3RhcnQ6bixjb3VudDpvfT1wdChlLGkscyk7aWYodGhpcy5fZHJhd1N0YXJ0PW4sdGhpcy5fZHJhd0NvdW50PW8sbXQoZSkmJihuPTAsbz1pLmxlbmd0aCksdGhpcy5vcHRpb25zLnNob3dMaW5lKXt0aGlzLmRhdGFzZXRFbGVtZW50VHlwZXx8dGhpcy5hZGRFbGVtZW50cygpO2NvbnN0e2RhdGFzZXQ6bixfZGF0YXNldDpvfT1lO24uX2NoYXJ0PXRoaXMuY2hhcnQsbi5fZGF0YXNldEluZGV4PXRoaXMuaW5kZXgsbi5fZGVjaW1hdGVkPSEhby5fZGVjaW1hdGVkLG4ucG9pbnRzPWk7Y29uc3QgYT10aGlzLnJlc29sdmVEYXRhc2V0RWxlbWVudE9wdGlvbnModCk7YS5zZWdtZW50PXRoaXMub3B0aW9ucy5zZWdtZW50LHRoaXMudXBkYXRlRWxlbWVudChuLHZvaWQgMCx7YW5pbWF0ZWQ6IXMsb3B0aW9uczphfSx0KX1lbHNlIHRoaXMuZGF0YXNldEVsZW1lbnRUeXBlJiYoZGVsZXRlIGUuZGF0YXNldCx0aGlzLmRhdGFzZXRFbGVtZW50VHlwZT0hMSk7dGhpcy51cGRhdGVFbGVtZW50cyhpLG4sbyx0KX1hZGRFbGVtZW50cygpe2NvbnN0e3Nob3dMaW5lOnR9PXRoaXMub3B0aW9uczshdGhpcy5kYXRhc2V0RWxlbWVudFR5cGUmJnQmJih0aGlzLmRhdGFzZXRFbGVtZW50VHlwZT10aGlzLmNoYXJ0LnJlZ2lzdHJ5LmdldEVsZW1lbnQoImxpbmUiKSksc3VwZXIuYWRkRWxlbWVudHMoKX11cGRhdGVFbGVtZW50cyh0LGUsaSxuKXtjb25zdCBvPSJyZXNldCI9PT1uLHtpU2NhbGU6YSx2U2NhbGU6cixfc3RhY2tlZDpsLF9kYXRhc2V0Omh9PXRoaXMuX2NhY2hlZE1ldGEsYz10aGlzLnJlc29sdmVEYXRhRWxlbWVudE9wdGlvbnMoZSxuKSxkPXRoaXMuZ2V0U2hhcmVkT3B0aW9ucyhjKSx1PXRoaXMuaW5jbHVkZU9wdGlvbnMobixkKSxmPWEuYXhpcyxnPXIuYXhpcyx7c3BhbkdhcHM6cCxzZWdtZW50Om19PXRoaXMub3B0aW9ucyx4PU4ocCk/cDpOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFksYj10aGlzLmNoYXJ0Ll9hbmltYXRpb25zRGlzYWJsZWR8fG98fCJub25lIj09PW47bGV0IF89ZT4wJiZ0aGlzLmdldFBhcnNlZChlLTEpO2ZvcihsZXQgYz1lO2M8ZStpOysrYyl7Y29uc3QgZT10W2NdLGk9dGhpcy5nZXRQYXJzZWQoYykscD1iP2U6e30seT1zKGlbZ10pLHY9cFtmXT1hLmdldFBpeGVsRm9yVmFsdWUoaVtmXSxjKSxNPXBbZ109b3x8eT9yLmdldEJhc2VQaXhlbCgpOnIuZ2V0UGl4ZWxGb3JWYWx1ZShsP3RoaXMuYXBwbHlTdGFjayhyLGksbCk6aVtnXSxjKTtwLnNraXA9aXNOYU4odil8fGlzTmFOKE0pfHx5LHAuc3RvcD1jPjAmJk1hdGguYWJzKGlbZl0tX1tmXSk+eCxtJiYocC5wYXJzZWQ9aSxwLnJhdz1oLmRhdGFbY10pLHUmJihwLm9wdGlvbnM9ZHx8dGhpcy5yZXNvbHZlRGF0YUVsZW1lbnRPcHRpb25zKGMsZS5hY3RpdmU/ImFjdGl2ZSI6bikpLGJ8fHRoaXMudXBkYXRlRWxlbWVudChlLGMscCxuKSxfPWl9dGhpcy51cGRhdGVTaGFyZWRPcHRpb25zKGQsbixjKX1nZXRNYXhPdmVyZmxvdygpe2NvbnN0IHQ9dGhpcy5fY2FjaGVkTWV0YSxlPXQuZGF0YXx8W107aWYoIXRoaXMub3B0aW9ucy5zaG93TGluZSl7bGV0IHQ9MDtmb3IobGV0IGk9ZS5sZW5ndGgtMTtpPj0wOy0taSl0PU1hdGgubWF4KHQsZVtpXS5zaXplKHRoaXMucmVzb2x2ZURhdGFFbGVtZW50T3B0aW9ucyhpKSkvMik7cmV0dXJuIHQ+MCYmdH1jb25zdCBpPXQuZGF0YXNldCxzPWkub3B0aW9ucyYmaS5vcHRpb25zLmJvcmRlcldpZHRofHwwO2lmKCFlLmxlbmd0aClyZXR1cm4gcztjb25zdCBuPWVbMF0uc2l6ZSh0aGlzLnJlc29sdmVEYXRhRWxlbWVudE9wdGlvbnMoMCkpLG89ZVtlLmxlbmd0aC0xXS5zaXplKHRoaXMucmVzb2x2ZURhdGFFbGVtZW50T3B0aW9ucyhlLmxlbmd0aC0xKSk7cmV0dXJuIE1hdGgubWF4KHMsbixvKS8yfX19KTtmdW5jdGlvbiBYbih0LGUsaSxzKXtjb25zdCBuPXZpKHQub3B0aW9ucy5ib3JkZXJSYWRpdXMsWyJvdXRlclN0YXJ0Iiwib3V0ZXJFbmQiLCJpbm5lclN0YXJ0IiwiaW5uZXJFbmQiXSk7Y29uc3Qgbz0oaS1lKS8yLGE9TWF0aC5taW4obyxzKmUvMikscj10PT57Y29uc3QgZT0oaS1NYXRoLm1pbihvLHQpKSpzLzI7cmV0dXJuIFoodCwwLE1hdGgubWluKG8sZSkpfTtyZXR1cm57b3V0ZXJTdGFydDpyKG4ub3V0ZXJTdGFydCksb3V0ZXJFbmQ6cihuLm91dGVyRW5kKSxpbm5lclN0YXJ0Oloobi5pbm5lclN0YXJ0LDAsYSksaW5uZXJFbmQ6WihuLmlubmVyRW5kLDAsYSl9fWZ1bmN0aW9uIHFuKHQsZSxpLHMpe3JldHVybnt4OmkrdCpNYXRoLmNvcyhlKSx5OnMrdCpNYXRoLnNpbihlKX19ZnVuY3Rpb24gS24odCxlLGkscyxuLG8pe2NvbnN0e3g6YSx5OnIsc3RhcnRBbmdsZTpsLHBpeGVsTWFyZ2luOmgsaW5uZXJSYWRpdXM6Y309ZSxkPU1hdGgubWF4KGUub3V0ZXJSYWRpdXMrcytpLWgsMCksdT1jPjA/YytzK2kraDowO2xldCBmPTA7Y29uc3QgZz1uLWw7aWYocyl7Y29uc3QgdD0oKGM+MD9jLXM6MCkrKGQ+MD9kLXM6MCkpLzI7Zj0oZy0oMCE9PXQ/Zyp0Lyh0K3MpOmcpKS8yfWNvbnN0IHA9KGctTWF0aC5tYXgoLjAwMSxnKmQtaS9DKS9kKS8yLG09bCtwK2YseD1uLXAtZix7b3V0ZXJTdGFydDpiLG91dGVyRW5kOl8saW5uZXJTdGFydDp5LGlubmVyRW5kOnZ9PVhuKGUsdSxkLHgtbSksTT1kLWIsdz1kLV8saz1tK2IvTSxTPXgtXy93LFA9dSt5LEQ9dSt2LE89bSt5L1AsQT14LXYvRDtpZih0LmJlZ2luUGF0aCgpLG8pe2NvbnN0IGU9KGsrUykvMjtpZih0LmFyYyhhLHIsZCxrLGUpLHQuYXJjKGEscixkLGUsUyksXz4wKXtjb25zdCBlPXFuKHcsUyxhLHIpO3QuYXJjKGUueCxlLnksXyxTLHgrRSl9Y29uc3QgaT1xbihELHgsYSxyKTtpZih0LmxpbmVUbyhpLngsaS55KSx2PjApe2NvbnN0IGU9cW4oRCxBLGEscik7dC5hcmMoZS54LGUueSx2LHgrRSxBK01hdGguUEkpfWNvbnN0IHM9KHgtdi91KyhtK3kvdSkpLzI7aWYodC5hcmMoYSxyLHUseC12L3UscywhMCksdC5hcmMoYSxyLHUscyxtK3kvdSwhMCkseT4wKXtjb25zdCBlPXFuKFAsTyxhLHIpO3QuYXJjKGUueCxlLnkseSxPK01hdGguUEksbS1FKX1jb25zdCBuPXFuKE0sbSxhLHIpO2lmKHQubGluZVRvKG4ueCxuLnkpLGI+MCl7Y29uc3QgZT1xbihNLGssYSxyKTt0LmFyYyhlLngsZS55LGIsbS1FLGspfX1lbHNle3QubW92ZVRvKGEscik7Y29uc3QgZT1NYXRoLmNvcyhrKSpkK2EsaT1NYXRoLnNpbihrKSpkK3I7dC5saW5lVG8oZSxpKTtjb25zdCBzPU1hdGguY29zKFMpKmQrYSxuPU1hdGguc2luKFMpKmQrcjt0LmxpbmVUbyhzLG4pfXQuY2xvc2VQYXRoKCl9ZnVuY3Rpb24gR24odCxlLGkscyxuKXtjb25zdHtmdWxsQ2lyY2xlczpvLHN0YXJ0QW5nbGU6YSxjaXJjdW1mZXJlbmNlOnIsb3B0aW9uczpsfT1lLHtib3JkZXJXaWR0aDpoLGJvcmRlckpvaW5TdHlsZTpjLGJvcmRlckRhc2g6ZCxib3JkZXJEYXNoT2Zmc2V0OnUsYm9yZGVyUmFkaXVzOmZ9PWwsZz0iaW5uZXIiPT09bC5ib3JkZXJBbGlnbjtpZighaClyZXR1cm47dC5zZXRMaW5lRGFzaChkfHxbXSksdC5saW5lRGFzaE9mZnNldD11LGc/KHQubGluZVdpZHRoPTIqaCx0LmxpbmVKb2luPWN8fCJyb3VuZCIpOih0LmxpbmVXaWR0aD1oLHQubGluZUpvaW49Y3x8ImJldmVsIik7bGV0IHA9ZS5lbmRBbmdsZTtpZihvKXtLbih0LGUsaSxzLHAsbik7Zm9yKGxldCBlPTA7ZTxvOysrZSl0LnN0cm9rZSgpO2lzTmFOKHIpfHwocD1hKyhyJU98fE8pKX1nJiZmdW5jdGlvbih0LGUsaSl7Y29uc3R7c3RhcnRBbmdsZTpzLHBpeGVsTWFyZ2luOm4seDpvLHk6YSxvdXRlclJhZGl1czpyLGlubmVyUmFkaXVzOmx9PWU7bGV0IGg9bi9yO3QuYmVnaW5QYXRoKCksdC5hcmMobyxhLHIscy1oLGkraCksbD5uPyhoPW4vbCx0LmFyYyhvLGEsbCxpK2gscy1oLCEwKSk6dC5hcmMobyxhLG4saStFLHMtRSksdC5jbG9zZVBhdGgoKSx0LmNsaXAoKX0odCxlLHApLGwuc2VsZkpvaW4mJnAtYT49QyYmMD09PWYmJiJtaXRlciIhPT1jJiZmdW5jdGlvbih0LGUsaSl7Y29uc3R7c3RhcnRBbmdsZTpzLHg6bix5Om8sb3V0ZXJSYWRpdXM6YSxpbm5lclJhZGl1czpyLG9wdGlvbnM6bH09ZSx7Ym9yZGVyV2lkdGg6aCxib3JkZXJKb2luU3R5bGU6Y309bCxkPU1hdGgubWluKGgvYSxHKHMtaSkpO2lmKHQuYmVnaW5QYXRoKCksdC5hcmMobixvLGEtaC8yLHMrZC8yLGktZC8yKSxyPjApe2NvbnN0IGU9TWF0aC5taW4oaC9yLEcocy1pKSk7dC5hcmMobixvLHIraC8yLGktZS8yLHMrZS8yLCEwKX1lbHNle2NvbnN0IGU9TWF0aC5taW4oaC8yLGEqRyhzLWkpKTtpZigicm91bmQiPT09Yyl0LmFyYyhuLG8sZSxpLUMvMixzK0MvMiwhMCk7ZWxzZSBpZigiYmV2ZWwiPT09Yyl7Y29uc3QgYT0yKmUqZSxyPS1hKk1hdGguY29zKGkrQy8yKStuLGw9LWEqTWF0aC5zaW4oaStDLzIpK28saD1hKk1hdGguY29zKHMrQy8yKStuLGM9YSpNYXRoLnNpbihzK0MvMikrbzt0LmxpbmVUbyhyLGwpLHQubGluZVRvKGgsYyl9fXQuY2xvc2VQYXRoKCksdC5tb3ZlVG8oMCwwKSx0LnJlY3QoMCwwLHQuY2FudmFzLndpZHRoLHQuY2FudmFzLmhlaWdodCksdC5jbGlwKCJldmVub2RkIil9KHQsZSxwKSxvfHwoS24odCxlLGkscyxwLG4pLHQuc3Ryb2tlKCkpfWZ1bmN0aW9uIEpuKHQsZSxpPWUpe3QubGluZUNhcD1sKGkuYm9yZGVyQ2FwU3R5bGUsZS5ib3JkZXJDYXBTdHlsZSksdC5zZXRMaW5lRGFzaChsKGkuYm9yZGVyRGFzaCxlLmJvcmRlckRhc2gpKSx0LmxpbmVEYXNoT2Zmc2V0PWwoaS5ib3JkZXJEYXNoT2Zmc2V0LGUuYm9yZGVyRGFzaE9mZnNldCksdC5saW5lSm9pbj1sKGkuYm9yZGVySm9pblN0eWxlLGUuYm9yZGVySm9pblN0eWxlKSx0LmxpbmVXaWR0aD1sKGkuYm9yZGVyV2lkdGgsZS5ib3JkZXJXaWR0aCksdC5zdHJva2VTdHlsZT1sKGkuYm9yZGVyQ29sb3IsZS5ib3JkZXJDb2xvcil9ZnVuY3Rpb24gWm4odCxlLGkpe3QubGluZVRvKGkueCxpLnkpfWZ1bmN0aW9uIFFuKHQsZSxpPXt9KXtjb25zdCBzPXQubGVuZ3RoLHtzdGFydDpuPTAsZW5kOm89cy0xfT1pLHtzdGFydDphLGVuZDpyfT1lLGw9TWF0aC5tYXgobixhKSxoPU1hdGgubWluKG8sciksYz1uPGEmJm88YXx8bj5yJiZvPnI7cmV0dXJue2NvdW50OnMsc3RhcnQ6bCxsb29wOmUubG9vcCxpbGVuOmg8bCYmIWM/cytoLWw6aC1sfX1mdW5jdGlvbiB0byh0LGUsaSxzKXtjb25zdHtwb2ludHM6bixvcHRpb25zOm99PWUse2NvdW50OmEsc3RhcnQ6cixsb29wOmwsaWxlbjpofT1RbihuLGkscyksYz1mdW5jdGlvbih0KXtyZXR1cm4gdC5zdGVwcGVkP0ZlOnQudGVuc2lvbnx8Im1vbm90b25lIj09PXQuY3ViaWNJbnRlcnBvbGF0aW9uTW9kZT9WZTpabn0obyk7bGV0IGQsdSxmLHttb3ZlOmc9ITAscmV2ZXJzZTpwfT1zfHx7fTtmb3IoZD0wO2Q8PWg7KytkKXU9blsocisocD9oLWQ6ZCkpJWFdLHUuc2tpcHx8KGc/KHQubW92ZVRvKHUueCx1LnkpLGc9ITEpOmModCxmLHUscCxvLnN0ZXBwZWQpLGY9dSk7cmV0dXJuIGwmJih1PW5bKHIrKHA/aDowKSklYV0sYyh0LGYsdSxwLG8uc3RlcHBlZCkpLCEhbH1mdW5jdGlvbiBlbyh0LGUsaSxzKXtjb25zdCBuPWUucG9pbnRzLHtjb3VudDpvLHN0YXJ0OmEsaWxlbjpyfT1RbihuLGkscykse21vdmU6bD0hMCxyZXZlcnNlOmh9PXN8fHt9O2xldCBjLGQsdSxmLGcscCxtPTAseD0wO2NvbnN0IGI9dD0+KGErKGg/ci10OnQpKSVvLF89KCk9PntmIT09ZyYmKHQubGluZVRvKG0sZyksdC5saW5lVG8obSxmKSx0LmxpbmVUbyhtLHApKX07Zm9yKGwmJihkPW5bYigwKV0sdC5tb3ZlVG8oZC54LGQueSkpLGM9MDtjPD1yOysrYyl7aWYoZD1uW2IoYyldLGQuc2tpcCljb250aW51ZTtjb25zdCBlPWQueCxpPWQueSxzPTB8ZTtzPT09dT8oaTxmP2Y9aTppPmcmJihnPWkpLG09KHgqbStlKS8rK3gpOihfKCksdC5saW5lVG8oZSxpKSx1PXMseD0wLGY9Zz1pKSxwPWl9XygpfWZ1bmN0aW9uIGlvKHQpe2NvbnN0IGU9dC5vcHRpb25zLGk9ZS5ib3JkZXJEYXNoJiZlLmJvcmRlckRhc2gubGVuZ3RoO3JldHVybiEodC5fZGVjaW1hdGVkfHx0Ll9sb29wfHxlLnRlbnNpb258fCJtb25vdG9uZSI9PT1lLmN1YmljSW50ZXJwb2xhdGlvbk1vZGV8fGUuc3RlcHBlZHx8aSk/ZW86dG99Y29uc3Qgc289ImZ1bmN0aW9uIj09dHlwZW9mIFBhdGgyRDtmdW5jdGlvbiBubyh0LGUsaSxzKXtzbyYmIWUub3B0aW9ucy5zZWdtZW50P2Z1bmN0aW9uKHQsZSxpLHMpe2xldCBuPWUuX3BhdGg7bnx8KG49ZS5fcGF0aD1uZXcgUGF0aDJELGUucGF0aChuLGkscykmJm4uY2xvc2VQYXRoKCkpLEpuKHQsZS5vcHRpb25zKSx0LnN0cm9rZShuKX0odCxlLGkscyk6ZnVuY3Rpb24odCxlLGkscyl7Y29uc3R7c2VnbWVudHM6bixvcHRpb25zOm99PWUsYT1pbyhlKTtmb3IoY29uc3QgciBvZiBuKUpuKHQsbyxyLnN0eWxlKSx0LmJlZ2luUGF0aCgpLGEodCxlLHIse3N0YXJ0OmksZW5kOmkrcy0xfSkmJnQuY2xvc2VQYXRoKCksdC5zdHJva2UoKX0odCxlLGkscyl9Y2xhc3Mgb28gZXh0ZW5kcyAkc3tzdGF0aWMgaWQ9ImxpbmUiO3N0YXRpYyBkZWZhdWx0cz17Ym9yZGVyQ2FwU3R5bGU6ImJ1dHQiLGJvcmRlckRhc2g6W10sYm9yZGVyRGFzaE9mZnNldDowLGJvcmRlckpvaW5TdHlsZToibWl0ZXIiLGJvcmRlcldpZHRoOjMsY2FwQmV6aWVyUG9pbnRzOiEwLGN1YmljSW50ZXJwb2xhdGlvbk1vZGU6ImRlZmF1bHQiLGZpbGw6ITEsc3BhbkdhcHM6ITEsc3RlcHBlZDohMSx0ZW5zaW9uOjB9O3N0YXRpYyBkZWZhdWx0Um91dGVzPXtiYWNrZ3JvdW5kQ29sb3I6ImJhY2tncm91bmRDb2xvciIsYm9yZGVyQ29sb3I6ImJvcmRlckNvbG9yIn07c3RhdGljIGRlc2NyaXB0b3JzPXtfc2NyaXB0YWJsZTohMCxfaW5kZXhhYmxlOnQ9PiJib3JkZXJEYXNoIiE9PXQmJiJmaWxsIiE9PXR9O2NvbnN0cnVjdG9yKHQpe3N1cGVyKCksdGhpcy5hbmltYXRlZD0hMCx0aGlzLm9wdGlvbnM9dm9pZCAwLHRoaXMuX2NoYXJ0PXZvaWQgMCx0aGlzLl9sb29wPXZvaWQgMCx0aGlzLl9mdWxsTG9vcD12b2lkIDAsdGhpcy5fcGF0aD12b2lkIDAsdGhpcy5fcG9pbnRzPXZvaWQgMCx0aGlzLl9zZWdtZW50cz12b2lkIDAsdGhpcy5fZGVjaW1hdGVkPSExLHRoaXMuX3BvaW50c1VwZGF0ZWQ9ITEsdGhpcy5fZGF0YXNldEluZGV4PXZvaWQgMCx0JiZPYmplY3QuYXNzaWduKHRoaXMsdCl9dXBkYXRlQ29udHJvbFBvaW50cyh0LGUpe2NvbnN0IGk9dGhpcy5vcHRpb25zO2lmKChpLnRlbnNpb258fCJtb25vdG9uZSI9PT1pLmN1YmljSW50ZXJwb2xhdGlvbk1vZGUpJiYhaS5zdGVwcGVkJiYhdGhpcy5fcG9pbnRzVXBkYXRlZCl7Y29uc3Qgcz1pLnNwYW5HYXBzP3RoaXMuX2xvb3A6dGhpcy5fZnVsbExvb3A7aGkodGhpcy5fcG9pbnRzLGksdCxzLGUpLHRoaXMuX3BvaW50c1VwZGF0ZWQ9ITB9fXNldCBwb2ludHModCl7dGhpcy5fcG9pbnRzPXQsZGVsZXRlIHRoaXMuX3NlZ21lbnRzLGRlbGV0ZSB0aGlzLl9wYXRoLHRoaXMuX3BvaW50c1VwZGF0ZWQ9ITF9Z2V0IHBvaW50cygpe3JldHVybiB0aGlzLl9wb2ludHN9Z2V0IHNlZ21lbnRzKCl7cmV0dXJuIHRoaXMuX3NlZ21lbnRzfHwodGhpcy5fc2VnbWVudHM9emkodGhpcyx0aGlzLm9wdGlvbnMuc2VnbWVudCkpfWZpcnN0KCl7Y29uc3QgdD10aGlzLnNlZ21lbnRzLGU9dGhpcy5wb2ludHM7cmV0dXJuIHQubGVuZ3RoJiZlW3RbMF0uc3RhcnRdfWxhc3QoKXtjb25zdCB0PXRoaXMuc2VnbWVudHMsZT10aGlzLnBvaW50cyxpPXQubGVuZ3RoO3JldHVybiBpJiZlW3RbaS0xXS5lbmRdfWludGVycG9sYXRlKHQsZSl7Y29uc3QgaT10aGlzLm9wdGlvbnMscz10W2VdLG49dGhpcy5wb2ludHMsbz1JaSh0aGlzLHtwcm9wZXJ0eTplLHN0YXJ0OnMsZW5kOnN9KTtpZighby5sZW5ndGgpcmV0dXJuO2NvbnN0IGE9W10scj1mdW5jdGlvbih0KXtyZXR1cm4gdC5zdGVwcGVkP3BpOnQudGVuc2lvbnx8Im1vbm90b25lIj09PXQuY3ViaWNJbnRlcnBvbGF0aW9uTW9kZT9taTpnaX0oaSk7bGV0IGwsaDtmb3IobD0wLGg9by5sZW5ndGg7bDxoOysrbCl7Y29uc3R7c3RhcnQ6aCxlbmQ6Y309b1tsXSxkPW5baF0sdT1uW2NdO2lmKGQ9PT11KXthLnB1c2goZCk7Y29udGludWV9Y29uc3QgZj1yKGQsdSxNYXRoLmFicygocy1kW2VdKS8odVtlXS1kW2VdKSksaS5zdGVwcGVkKTtmW2VdPXRbZV0sYS5wdXNoKGYpfXJldHVybiAxPT09YS5sZW5ndGg/YVswXTphfXBhdGhTZWdtZW50KHQsZSxpKXtyZXR1cm4gaW8odGhpcykodCx0aGlzLGUsaSl9cGF0aCh0LGUsaSl7Y29uc3Qgcz10aGlzLnNlZ21lbnRzLG49aW8odGhpcyk7bGV0IG89dGhpcy5fbG9vcDtlPWV8fDAsaT1pfHx0aGlzLnBvaW50cy5sZW5ndGgtZTtmb3IoY29uc3QgYSBvZiBzKW8mPW4odCx0aGlzLGEse3N0YXJ0OmUsZW5kOmUraS0xfSk7cmV0dXJuISFvfWRyYXcodCxlLGkscyl7Y29uc3Qgbj10aGlzLm9wdGlvbnN8fHt9Oyh0aGlzLnBvaW50c3x8W10pLmxlbmd0aCYmbi5ib3JkZXJXaWR0aCYmKHQuc2F2ZSgpLG5vKHQsdGhpcyxpLHMpLHQucmVzdG9yZSgpKSx0aGlzLmFuaW1hdGVkJiYodGhpcy5fcG9pbnRzVXBkYXRlZD0hMSx0aGlzLl9wYXRoPXZvaWQgMCl9fWZ1bmN0aW9uIGFvKHQsZSxpLHMpe2NvbnN0IG49dC5vcHRpb25zLHtbaV06b309dC5nZXRQcm9wcyhbaV0scyk7cmV0dXJuIE1hdGguYWJzKGUtbyk8bi5yYWRpdXMrbi5oaXRSYWRpdXN9ZnVuY3Rpb24gcm8odCxlKXtjb25zdHt4OmkseTpzLGJhc2U6bix3aWR0aDpvLGhlaWdodDphfT10LmdldFByb3BzKFsieCIsInkiLCJiYXNlIiwid2lkdGgiLCJoZWlnaHQiXSxlKTtsZXQgcixsLGgsYyxkO3JldHVybiB0Lmhvcml6b250YWw/KGQ9YS8yLHI9TWF0aC5taW4oaSxuKSxsPU1hdGgubWF4KGksbiksaD1zLWQsYz1zK2QpOihkPW8vMixyPWktZCxsPWkrZCxoPU1hdGgubWluKHMsbiksYz1NYXRoLm1heChzLG4pKSx7bGVmdDpyLHRvcDpoLHJpZ2h0OmwsYm90dG9tOmN9fWZ1bmN0aW9uIGxvKHQsZSxpLHMpe3JldHVybiB0PzA6WihlLGkscyl9ZnVuY3Rpb24gaG8odCl7Y29uc3QgZT1ybyh0KSxpPWUucmlnaHQtZS5sZWZ0LHM9ZS5ib3R0b20tZS50b3Asbj1mdW5jdGlvbih0LGUsaSl7Y29uc3Qgcz10Lm9wdGlvbnMuYm9yZGVyV2lkdGgsbj10LmJvcmRlclNraXBwZWQsbz1NaShzKTtyZXR1cm57dDpsbyhuLnRvcCxvLnRvcCwwLGkpLHI6bG8obi5yaWdodCxvLnJpZ2h0LDAsZSksYjpsbyhuLmJvdHRvbSxvLmJvdHRvbSwwLGkpLGw6bG8obi5sZWZ0LG8ubGVmdCwwLGUpfX0odCxpLzIscy8yKSxhPWZ1bmN0aW9uKHQsZSxpKXtjb25zdHtlbmFibGVCb3JkZXJSYWRpdXM6c309dC5nZXRQcm9wcyhbImVuYWJsZUJvcmRlclJhZGl1cyJdKSxuPXQub3B0aW9ucy5ib3JkZXJSYWRpdXMsYT13aShuKSxyPU1hdGgubWluKGUsaSksbD10LmJvcmRlclNraXBwZWQsaD1zfHxvKG4pO3JldHVybnt0b3BMZWZ0OmxvKCFofHxsLnRvcHx8bC5sZWZ0LGEudG9wTGVmdCwwLHIpLHRvcFJpZ2h0OmxvKCFofHxsLnRvcHx8bC5yaWdodCxhLnRvcFJpZ2h0LDAsciksYm90dG9tTGVmdDpsbyghaHx8bC5ib3R0b218fGwubGVmdCxhLmJvdHRvbUxlZnQsMCxyKSxib3R0b21SaWdodDpsbyghaHx8bC5ib3R0b218fGwucmlnaHQsYS5ib3R0b21SaWdodCwwLHIpfX0odCxpLzIscy8yKTtyZXR1cm57b3V0ZXI6e3g6ZS5sZWZ0LHk6ZS50b3AsdzppLGg6cyxyYWRpdXM6YX0saW5uZXI6e3g6ZS5sZWZ0K24ubCx5OmUudG9wK24udCx3Omktbi5sLW4ucixoOnMtbi50LW4uYixyYWRpdXM6e3RvcExlZnQ6TWF0aC5tYXgoMCxhLnRvcExlZnQtTWF0aC5tYXgobi50LG4ubCkpLHRvcFJpZ2h0Ok1hdGgubWF4KDAsYS50b3BSaWdodC1NYXRoLm1heChuLnQsbi5yKSksYm90dG9tTGVmdDpNYXRoLm1heCgwLGEuYm90dG9tTGVmdC1NYXRoLm1heChuLmIsbi5sKSksYm90dG9tUmlnaHQ6TWF0aC5tYXgoMCxhLmJvdHRvbVJpZ2h0LU1hdGgubWF4KG4uYixuLnIpKX19fX1mdW5jdGlvbiBjbyh0LGUsaSxzKXtjb25zdCBuPW51bGw9PT1lLG89bnVsbD09PWksYT10JiYhKG4mJm8pJiZybyh0LHMpO3JldHVybiBhJiYobnx8dHQoZSxhLmxlZnQsYS5yaWdodCkpJiYob3x8dHQoaSxhLnRvcCxhLmJvdHRvbSkpfWZ1bmN0aW9uIHVvKHQsZSl7dC5yZWN0KGUueCxlLnksZS53LGUuaCl9ZnVuY3Rpb24gZm8odCxlLGk9e30pe2NvbnN0IHM9dC54IT09aS54Py1lOjAsbj10LnkhPT1pLnk/LWU6MCxvPSh0LngrdC53IT09aS54K2kudz9lOjApLXMsYT0odC55K3QuaCE9PWkueStpLmg/ZTowKS1uO3JldHVybnt4OnQueCtzLHk6dC55K24sdzp0LncrbyxoOnQuaCthLHJhZGl1czp0LnJhZGl1c319dmFyIGdvPU9iamVjdC5mcmVlemUoe19fcHJvdG9fXzpudWxsLEFyY0VsZW1lbnQ6Y2xhc3MgZXh0ZW5kcyAkc3tzdGF0aWMgaWQ9ImFyYyI7c3RhdGljIGRlZmF1bHRzPXtib3JkZXJBbGlnbjoiY2VudGVyIixib3JkZXJDb2xvcjoiI2ZmZiIsYm9yZGVyRGFzaDpbXSxib3JkZXJEYXNoT2Zmc2V0OjAsYm9yZGVySm9pblN0eWxlOnZvaWQgMCxib3JkZXJSYWRpdXM6MCxib3JkZXJXaWR0aDoyLG9mZnNldDowLHNwYWNpbmc6MCxhbmdsZTp2b2lkIDAsY2lyY3VsYXI6ITAsc2VsZkpvaW46ITF9O3N0YXRpYyBkZWZhdWx0Um91dGVzPXtiYWNrZ3JvdW5kQ29sb3I6ImJhY2tncm91bmRDb2xvciJ9O3N0YXRpYyBkZXNjcmlwdG9ycz17X3NjcmlwdGFibGU6ITAsX2luZGV4YWJsZTp0PT4iYm9yZGVyRGFzaCIhPT10fTtjaXJjdW1mZXJlbmNlO2VuZEFuZ2xlO2Z1bGxDaXJjbGVzO2lubmVyUmFkaXVzO291dGVyUmFkaXVzO3BpeGVsTWFyZ2luO3N0YXJ0QW5nbGU7Y29uc3RydWN0b3IodCl7c3VwZXIoKSx0aGlzLm9wdGlvbnM9dm9pZCAwLHRoaXMuY2lyY3VtZmVyZW5jZT12b2lkIDAsdGhpcy5zdGFydEFuZ2xlPXZvaWQgMCx0aGlzLmVuZEFuZ2xlPXZvaWQgMCx0aGlzLmlubmVyUmFkaXVzPXZvaWQgMCx0aGlzLm91dGVyUmFkaXVzPXZvaWQgMCx0aGlzLnBpeGVsTWFyZ2luPTAsdGhpcy5mdWxsQ2lyY2xlcz0wLHQmJk9iamVjdC5hc3NpZ24odGhpcyx0KX1pblJhbmdlKHQsZSxpKXtjb25zdCBzPXRoaXMuZ2V0UHJvcHMoWyJ4IiwieSJdLGkpLHthbmdsZTpuLGRpc3RhbmNlOm99PVgocyx7eDp0LHk6ZX0pLHtzdGFydEFuZ2xlOmEsZW5kQW5nbGU6cixpbm5lclJhZGl1czpoLG91dGVyUmFkaXVzOmMsY2lyY3VtZmVyZW5jZTpkfT10aGlzLmdldFByb3BzKFsic3RhcnRBbmdsZSIsImVuZEFuZ2xlIiwiaW5uZXJSYWRpdXMiLCJvdXRlclJhZGl1cyIsImNpcmN1bWZlcmVuY2UiXSxpKSx1PSh0aGlzLm9wdGlvbnMuc3BhY2luZyt0aGlzLm9wdGlvbnMuYm9yZGVyV2lkdGgpLzIsZj1sKGQsci1hKSxnPUoobixhLHIpJiZhIT09cixwPWY+PU98fGcsbT10dChvLGgrdSxjK3UpO3JldHVybiBwJiZtfWdldENlbnRlclBvaW50KHQpe2NvbnN0e3g6ZSx5Omksc3RhcnRBbmdsZTpzLGVuZEFuZ2xlOm4saW5uZXJSYWRpdXM6byxvdXRlclJhZGl1czphfT10aGlzLmdldFByb3BzKFsieCIsInkiLCJzdGFydEFuZ2xlIiwiZW5kQW5nbGUiLCJpbm5lclJhZGl1cyIsIm91dGVyUmFkaXVzIl0sdCkse29mZnNldDpyLHNwYWNpbmc6bH09dGhpcy5vcHRpb25zLGg9KHMrbikvMixjPShvK2ErbCtyKS8yO3JldHVybnt4OmUrTWF0aC5jb3MoaCkqYyx5OmkrTWF0aC5zaW4oaCkqY319dG9vbHRpcFBvc2l0aW9uKHQpe3JldHVybiB0aGlzLmdldENlbnRlclBvaW50KHQpfWRyYXcodCl7Y29uc3R7b3B0aW9uczplLGNpcmN1bWZlcmVuY2U6aX09dGhpcyxzPShlLm9mZnNldHx8MCkvNCxuPShlLnNwYWNpbmd8fDApLzIsbz1lLmNpcmN1bGFyO2lmKHRoaXMucGl4ZWxNYXJnaW49ImlubmVyIj09PWUuYm9yZGVyQWxpZ24/LjMzOjAsdGhpcy5mdWxsQ2lyY2xlcz1pPk8/TWF0aC5mbG9vcihpL08pOjAsMD09PWl8fHRoaXMuaW5uZXJSYWRpdXM8MHx8dGhpcy5vdXRlclJhZGl1czwwKXJldHVybjt0LnNhdmUoKTtjb25zdCBhPSh0aGlzLnN0YXJ0QW5nbGUrdGhpcy5lbmRBbmdsZSkvMjt0LnRyYW5zbGF0ZShNYXRoLmNvcyhhKSpzLE1hdGguc2luKGEpKnMpO2NvbnN0IHI9cyooMS1NYXRoLnNpbihNYXRoLm1pbihDLGl8fDApKSk7dC5maWxsU3R5bGU9ZS5iYWNrZ3JvdW5kQ29sb3IsdC5zdHJva2VTdHlsZT1lLmJvcmRlckNvbG9yLGZ1bmN0aW9uKHQsZSxpLHMsbil7Y29uc3R7ZnVsbENpcmNsZXM6byxzdGFydEFuZ2xlOmEsY2lyY3VtZmVyZW5jZTpyfT1lO2xldCBsPWUuZW5kQW5nbGU7aWYobyl7S24odCxlLGkscyxsLG4pO2ZvcihsZXQgZT0wO2U8bzsrK2UpdC5maWxsKCk7aXNOYU4ocil8fChsPWErKHIlT3x8TykpfUtuKHQsZSxpLHMsbCxuKSx0LmZpbGwoKX0odCx0aGlzLHIsbixvKSxHbih0LHRoaXMscixuLG8pLHQucmVzdG9yZSgpfX0sQmFyRWxlbWVudDpjbGFzcyBleHRlbmRzICRze3N0YXRpYyBpZD0iYmFyIjtzdGF0aWMgZGVmYXVsdHM9e2JvcmRlclNraXBwZWQ6InN0YXJ0Iixib3JkZXJXaWR0aDowLGJvcmRlclJhZGl1czowLGluZmxhdGVBbW91bnQ6ImF1dG8iLHBvaW50U3R5bGU6dm9pZCAwfTtzdGF0aWMgZGVmYXVsdFJvdXRlcz17YmFja2dyb3VuZENvbG9yOiJiYWNrZ3JvdW5kQ29sb3IiLGJvcmRlckNvbG9yOiJib3JkZXJDb2xvciJ9O2NvbnN0cnVjdG9yKHQpe3N1cGVyKCksdGhpcy5vcHRpb25zPXZvaWQgMCx0aGlzLmhvcml6b250YWw9dm9pZCAwLHRoaXMuYmFzZT12b2lkIDAsdGhpcy53aWR0aD12b2lkIDAsdGhpcy5oZWlnaHQ9dm9pZCAwLHRoaXMuaW5mbGF0ZUFtb3VudD12b2lkIDAsdCYmT2JqZWN0LmFzc2lnbih0aGlzLHQpfWRyYXcodCl7Y29uc3R7aW5mbGF0ZUFtb3VudDplLG9wdGlvbnM6e2JvcmRlckNvbG9yOmksYmFja2dyb3VuZENvbG9yOnN9fT10aGlzLHtpbm5lcjpuLG91dGVyOm99PWhvKHRoaXMpLGE9KHI9by5yYWRpdXMpLnRvcExlZnR8fHIudG9wUmlnaHR8fHIuYm90dG9tTGVmdHx8ci5ib3R0b21SaWdodD9IZTp1bzt2YXIgcjt0LnNhdmUoKSxvLnc9PT1uLncmJm8uaD09PW4uaHx8KHQuYmVnaW5QYXRoKCksYSh0LGZvKG8sZSxuKSksdC5jbGlwKCksYSh0LGZvKG4sLWUsbykpLHQuZmlsbFN0eWxlPWksdC5maWxsKCJldmVub2RkIikpLHQuYmVnaW5QYXRoKCksYSh0LGZvKG4sZSkpLHQuZmlsbFN0eWxlPXMsdC5maWxsKCksdC5yZXN0b3JlKCl9aW5SYW5nZSh0LGUsaSl7cmV0dXJuIGNvKHRoaXMsdCxlLGkpfWluWFJhbmdlKHQsZSl7cmV0dXJuIGNvKHRoaXMsdCxudWxsLGUpfWluWVJhbmdlKHQsZSl7cmV0dXJuIGNvKHRoaXMsbnVsbCx0LGUpfWdldENlbnRlclBvaW50KHQpe2NvbnN0e3g6ZSx5OmksYmFzZTpzLGhvcml6b250YWw6bn09dGhpcy5nZXRQcm9wcyhbIngiLCJ5IiwiYmFzZSIsImhvcml6b250YWwiXSx0KTtyZXR1cm57eDpuPyhlK3MpLzI6ZSx5Om4/aTooaStzKS8yfX1nZXRSYW5nZSh0KXtyZXR1cm4ieCI9PT10P3RoaXMud2lkdGgvMjp0aGlzLmhlaWdodC8yfX0sTGluZUVsZW1lbnQ6b28sUG9pbnRFbGVtZW50OmNsYXNzIGV4dGVuZHMgJHN7c3RhdGljIGlkPSJwb2ludCI7cGFyc2VkO3NraXA7c3RvcDtzdGF0aWMgZGVmYXVsdHM9e2JvcmRlcldpZHRoOjEsaGl0UmFkaXVzOjEsaG92ZXJCb3JkZXJXaWR0aDoxLGhvdmVyUmFkaXVzOjQscG9pbnRTdHlsZToiY2lyY2xlIixyYWRpdXM6Myxyb3RhdGlvbjowfTtzdGF0aWMgZGVmYXVsdFJvdXRlcz17YmFja2dyb3VuZENvbG9yOiJiYWNrZ3JvdW5kQ29sb3IiLGJvcmRlckNvbG9yOiJib3JkZXJDb2xvciJ9O2NvbnN0cnVjdG9yKHQpe3N1cGVyKCksdGhpcy5vcHRpb25zPXZvaWQgMCx0aGlzLnBhcnNlZD12b2lkIDAsdGhpcy5za2lwPXZvaWQgMCx0aGlzLnN0b3A9dm9pZCAwLHQmJk9iamVjdC5hc3NpZ24odGhpcyx0KX1pblJhbmdlKHQsZSxpKXtjb25zdCBzPXRoaXMub3B0aW9ucyx7eDpuLHk6b309dGhpcy5nZXRQcm9wcyhbIngiLCJ5Il0saSk7cmV0dXJuIE1hdGgucG93KHQtbiwyKStNYXRoLnBvdyhlLW8sMik8TWF0aC5wb3cocy5oaXRSYWRpdXMrcy5yYWRpdXMsMil9aW5YUmFuZ2UodCxlKXtyZXR1cm4gYW8odGhpcyx0LCJ4IixlKX1pbllSYW5nZSh0LGUpe3JldHVybiBhbyh0aGlzLHQsInkiLGUpfWdldENlbnRlclBvaW50KHQpe2NvbnN0e3g6ZSx5Oml9PXRoaXMuZ2V0UHJvcHMoWyJ4IiwieSJdLHQpO3JldHVybnt4OmUseTppfX1zaXplKHQpe2xldCBlPSh0PXR8fHRoaXMub3B0aW9uc3x8e30pLnJhZGl1c3x8MDtlPU1hdGgubWF4KGUsZSYmdC5ob3ZlclJhZGl1c3x8MCk7cmV0dXJuIDIqKGUrKGUmJnQuYm9yZGVyV2lkdGh8fDApKX1kcmF3KHQsZSl7Y29uc3QgaT10aGlzLm9wdGlvbnM7dGhpcy5za2lwfHxpLnJhZGl1czwuMXx8IVJlKHRoaXMsZSx0aGlzLnNpemUoaSkvMil8fCh0LnN0cm9rZVN0eWxlPWkuYm9yZGVyQ29sb3IsdC5saW5lV2lkdGg9aS5ib3JkZXJXaWR0aCx0LmZpbGxTdHlsZT1pLmJhY2tncm91bmRDb2xvcixMZSh0LGksdGhpcy54LHRoaXMueSkpfWdldFJhbmdlKCl7Y29uc3QgdD10aGlzLm9wdGlvbnN8fHt9O3JldHVybiB0LnJhZGl1cyt0LmhpdFJhZGl1c319fSk7ZnVuY3Rpb24gcG8odCxlLGkscyl7Y29uc3Qgbj10LmluZGV4T2YoZSk7aWYoLTE9PT1uKXJldHVybigodCxlLGkscyk9Pigic3RyaW5nIj09dHlwZW9mIGU/KGk9dC5wdXNoKGUpLTEscy51bnNoaWZ0KHtpbmRleDppLGxhYmVsOmV9KSk6aXNOYU4oZSkmJihpPW51bGwpLGkpKSh0LGUsaSxzKTtyZXR1cm4gbiE9PXQubGFzdEluZGV4T2YoZSk/aTpufWZ1bmN0aW9uIG1vKHQpe2NvbnN0IGU9dGhpcy5nZXRMYWJlbHMoKTtyZXR1cm4gdD49MCYmdDxlLmxlbmd0aD9lW3RdOnR9ZnVuY3Rpb24geG8odCxlLHtob3Jpem9udGFsOmksbWluUm90YXRpb246c30pe2NvbnN0IG49JChzKSxvPShpP01hdGguc2luKG4pOk1hdGguY29zKG4pKXx8LjAwMSxhPS43NSplKigiIit0KS5sZW5ndGg7cmV0dXJuIE1hdGgubWluKGUvbyxhKX1jbGFzcyBibyBleHRlbmRzIHRue2NvbnN0cnVjdG9yKHQpe3N1cGVyKHQpLHRoaXMuc3RhcnQ9dm9pZCAwLHRoaXMuZW5kPXZvaWQgMCx0aGlzLl9zdGFydFZhbHVlPXZvaWQgMCx0aGlzLl9lbmRWYWx1ZT12b2lkIDAsdGhpcy5fdmFsdWVSYW5nZT0wfXBhcnNlKHQsZSl7cmV0dXJuIHModCl8fCgibnVtYmVyIj09dHlwZW9mIHR8fHQgaW5zdGFuY2VvZiBOdW1iZXIpJiYhaXNGaW5pdGUoK3QpP251bGw6K3R9aGFuZGxlVGlja1JhbmdlT3B0aW9ucygpe2NvbnN0e2JlZ2luQXRaZXJvOnR9PXRoaXMub3B0aW9ucyx7bWluRGVmaW5lZDplLG1heERlZmluZWQ6aX09dGhpcy5nZXRVc2VyQm91bmRzKCk7bGV0e21pbjpzLG1heDpufT10aGlzO2NvbnN0IG89dD0+cz1lP3M6dCxhPXQ9Pm49aT9uOnQ7aWYodCl7Y29uc3QgdD1GKHMpLGU9RihuKTt0PDAmJmU8MD9hKDApOnQ+MCYmZT4wJiZvKDApfWlmKHM9PT1uKXtsZXQgZT0wPT09bj8xOk1hdGguYWJzKC4wNSpuKTthKG4rZSksdHx8byhzLWUpfXRoaXMubWluPXMsdGhpcy5tYXg9bn1nZXRUaWNrTGltaXQoKXtjb25zdCB0PXRoaXMub3B0aW9ucy50aWNrcztsZXQgZSx7bWF4VGlja3NMaW1pdDppLHN0ZXBTaXplOnN9PXQ7cmV0dXJuIHM/KGU9TWF0aC5jZWlsKHRoaXMubWF4L3MpLU1hdGguZmxvb3IodGhpcy5taW4vcykrMSxlPjFlMyYmKGNvbnNvbGUud2Fybihgc2NhbGVzLiR7dGhpcy5pZH0udGlja3Muc3RlcFNpemU6ICR7c30gd291bGQgcmVzdWx0IGdlbmVyYXRpbmcgdXAgdG8gJHtlfSB0aWNrcy4gTGltaXRpbmcgdG8gMTAwMC5gKSxlPTFlMykpOihlPXRoaXMuY29tcHV0ZVRpY2tMaW1pdCgpLGk9aXx8MTEpLGkmJihlPU1hdGgubWluKGksZSkpLGV9Y29tcHV0ZVRpY2tMaW1pdCgpe3JldHVybiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFl9YnVpbGRUaWNrcygpe2NvbnN0IHQ9dGhpcy5vcHRpb25zLGU9dC50aWNrcztsZXQgaT10aGlzLmdldFRpY2tMaW1pdCgpO2k9TWF0aC5tYXgoMixpKTtjb25zdCBuPWZ1bmN0aW9uKHQsZSl7Y29uc3QgaT1bXSx7Ym91bmRzOm4sc3RlcDpvLG1pbjphLG1heDpyLHByZWNpc2lvbjpsLGNvdW50OmgsbWF4VGlja3M6YyxtYXhEaWdpdHM6ZCxpbmNsdWRlQm91bmRzOnV9PXQsZj1vfHwxLGc9Yy0xLHttaW46cCxtYXg6bX09ZSx4PSFzKGEpLGI9IXMociksXz0hcyhoKSx5PShtLXApLyhkKzEpO2xldCB2LE0sdyxrLFM9QigobS1wKS9nL2YpKmY7aWYoUzwxZS0xNCYmIXgmJiFiKXJldHVyblt7dmFsdWU6cH0se3ZhbHVlOm19XTtrPU1hdGguY2VpbChtL1MpLU1hdGguZmxvb3IocC9TKSxrPmcmJihTPUIoaypTL2cvZikqZikscyhsKXx8KHY9TWF0aC5wb3coMTAsbCksUz1NYXRoLmNlaWwoUyp2KS92KSwidGlja3MiPT09bj8oTT1NYXRoLmZsb29yKHAvUykqUyx3PU1hdGguY2VpbChtL1MpKlMpOihNPXAsdz1tKSx4JiZiJiZvJiZIKChyLWEpL28sUy8xZTMpPyhrPU1hdGgucm91bmQoTWF0aC5taW4oKHItYSkvUyxjKSksUz0oci1hKS9rLE09YSx3PXIpOl8/KE09eD9hOk0sdz1iP3I6dyxrPWgtMSxTPSh3LU0pL2spOihrPSh3LU0pL1Msaz1WKGssTWF0aC5yb3VuZChrKSxTLzFlMyk/TWF0aC5yb3VuZChrKTpNYXRoLmNlaWwoaykpO2NvbnN0IFA9TWF0aC5tYXgoVShTKSxVKE0pKTt2PU1hdGgucG93KDEwLHMobCk/UDpsKSxNPU1hdGgucm91bmQoTSp2KS92LHc9TWF0aC5yb3VuZCh3KnYpL3Y7bGV0IEQ9MDtmb3IoeCYmKHUmJk0hPT1hPyhpLnB1c2goe3ZhbHVlOmF9KSxNPGEmJkQrKyxWKE1hdGgucm91bmQoKE0rRCpTKSp2KS92LGEseG8oYSx5LHQpKSYmRCsrKTpNPGEmJkQrKyk7RDxrOysrRCl7Y29uc3QgdD1NYXRoLnJvdW5kKChNK0QqUykqdikvdjtpZihiJiZ0PnIpYnJlYWs7aS5wdXNoKHt2YWx1ZTp0fSl9cmV0dXJuIGImJnUmJnchPT1yP2kubGVuZ3RoJiZWKGlbaS5sZW5ndGgtMV0udmFsdWUscix4byhyLHksdCkpP2lbaS5sZW5ndGgtMV0udmFsdWU9cjppLnB1c2goe3ZhbHVlOnJ9KTpiJiZ3IT09cnx8aS5wdXNoKHt2YWx1ZTp3fSksaX0oe21heFRpY2tzOmksYm91bmRzOnQuYm91bmRzLG1pbjp0Lm1pbixtYXg6dC5tYXgscHJlY2lzaW9uOmUucHJlY2lzaW9uLHN0ZXA6ZS5zdGVwU2l6ZSxjb3VudDplLmNvdW50LG1heERpZ2l0czp0aGlzLl9tYXhEaWdpdHMoKSxob3Jpem9udGFsOnRoaXMuaXNIb3Jpem9udGFsKCksbWluUm90YXRpb246ZS5taW5Sb3RhdGlvbnx8MCxpbmNsdWRlQm91bmRzOiExIT09ZS5pbmNsdWRlQm91bmRzfSx0aGlzLl9yYW5nZXx8dGhpcyk7cmV0dXJuInRpY2tzIj09PXQuYm91bmRzJiZqKG4sdGhpcywidmFsdWUiKSx0LnJldmVyc2U/KG4ucmV2ZXJzZSgpLHRoaXMuc3RhcnQ9dGhpcy5tYXgsdGhpcy5lbmQ9dGhpcy5taW4pOih0aGlzLnN0YXJ0PXRoaXMubWluLHRoaXMuZW5kPXRoaXMubWF4KSxufWNvbmZpZ3VyZSgpe2NvbnN0IHQ9dGhpcy50aWNrcztsZXQgZT10aGlzLm1pbixpPXRoaXMubWF4O2lmKHN1cGVyLmNvbmZpZ3VyZSgpLHRoaXMub3B0aW9ucy5vZmZzZXQmJnQubGVuZ3RoKXtjb25zdCBzPShpLWUpL01hdGgubWF4KHQubGVuZ3RoLTEsMSkvMjtlLT1zLGkrPXN9dGhpcy5fc3RhcnRWYWx1ZT1lLHRoaXMuX2VuZFZhbHVlPWksdGhpcy5fdmFsdWVSYW5nZT1pLWV9Z2V0TGFiZWxGb3JWYWx1ZSh0KXtyZXR1cm4gbmUodCx0aGlzLmNoYXJ0Lm9wdGlvbnMubG9jYWxlLHRoaXMub3B0aW9ucy50aWNrcy5mb3JtYXQpfX1jbGFzcyBfbyBleHRlbmRzIGJve3N0YXRpYyBpZD0ibGluZWFyIjtzdGF0aWMgZGVmYXVsdHM9e3RpY2tzOntjYWxsYmFjazphZS5mb3JtYXR0ZXJzLm51bWVyaWN9fTtkZXRlcm1pbmVEYXRhTGltaXRzKCl7Y29uc3R7bWluOnQsbWF4OmV9PXRoaXMuZ2V0TWluTWF4KCEwKTt0aGlzLm1pbj1hKHQpP3Q6MCx0aGlzLm1heD1hKGUpP2U6MSx0aGlzLmhhbmRsZVRpY2tSYW5nZU9wdGlvbnMoKX1jb21wdXRlVGlja0xpbWl0KCl7Y29uc3QgdD10aGlzLmlzSG9yaXpvbnRhbCgpLGU9dD90aGlzLndpZHRoOnRoaXMuaGVpZ2h0LGk9JCh0aGlzLm9wdGlvbnMudGlja3MubWluUm90YXRpb24pLHM9KHQ/TWF0aC5zaW4oaSk6TWF0aC5jb3MoaSkpfHwuMDAxLG49dGhpcy5fcmVzb2x2ZVRpY2tGb250T3B0aW9ucygwKTtyZXR1cm4gTWF0aC5jZWlsKGUvTWF0aC5taW4oNDAsbi5saW5lSGVpZ2h0L3MpKX1nZXRQaXhlbEZvclZhbHVlKHQpe3JldHVybiBudWxsPT09dD9OYU46dGhpcy5nZXRQaXhlbEZvckRlY2ltYWwoKHQtdGhpcy5fc3RhcnRWYWx1ZSkvdGhpcy5fdmFsdWVSYW5nZSl9Z2V0VmFsdWVGb3JQaXhlbCh0KXtyZXR1cm4gdGhpcy5fc3RhcnRWYWx1ZSt0aGlzLmdldERlY2ltYWxGb3JQaXhlbCh0KSp0aGlzLl92YWx1ZVJhbmdlfX1jb25zdCB5bz10PT5NYXRoLmZsb29yKHoodCkpLHZvPSh0LGUpPT5NYXRoLnBvdygxMCx5byh0KStlKTtmdW5jdGlvbiBNbyh0KXtyZXR1cm4gMT09PXQvTWF0aC5wb3coMTAseW8odCkpfWZ1bmN0aW9uIHdvKHQsZSxpKXtjb25zdCBzPU1hdGgucG93KDEwLGkpLG49TWF0aC5mbG9vcih0L3MpO3JldHVybiBNYXRoLmNlaWwoZS9zKS1ufWZ1bmN0aW9uIGtvKHQse21pbjplLG1heDppfSl7ZT1yKHQubWluLGUpO2NvbnN0IHM9W10sbj15byhlKTtsZXQgbz1mdW5jdGlvbih0LGUpe2xldCBpPXlvKGUtdCk7Zm9yKDt3byh0LGUsaSk+MTA7KWkrKztmb3IoO3dvKHQsZSxpKTwxMDspaS0tO3JldHVybiBNYXRoLm1pbihpLHlvKHQpKX0oZSxpKSxhPW88MD9NYXRoLnBvdygxMCxNYXRoLmFicyhvKSk6MTtjb25zdCBsPU1hdGgucG93KDEwLG8pLGg9bj5vP01hdGgucG93KDEwLG4pOjAsYz1NYXRoLnJvdW5kKChlLWgpKmEpL2EsZD1NYXRoLmZsb29yKChlLWgpL2wvMTApKmwqMTA7bGV0IHU9TWF0aC5mbG9vcigoYy1kKS9NYXRoLnBvdygxMCxvKSksZj1yKHQubWluLE1hdGgucm91bmQoKGgrZCt1Kk1hdGgucG93KDEwLG8pKSphKS9hKTtmb3IoO2Y8aTspcy5wdXNoKHt2YWx1ZTpmLG1ham9yOk1vKGYpLHNpZ25pZmljYW5kOnV9KSx1Pj0xMD91PXU8MTU/MTU6MjA6dSsrLHU+PTIwJiYobysrLHU9MixhPW8+PTA/MTphKSxmPU1hdGgucm91bmQoKGgrZCt1Kk1hdGgucG93KDEwLG8pKSphKS9hO2NvbnN0IGc9cih0Lm1heCxmKTtyZXR1cm4gcy5wdXNoKHt2YWx1ZTpnLG1ham9yOk1vKGcpLHNpZ25pZmljYW5kOnV9KSxzfWNsYXNzIFNvIGV4dGVuZHMgdG57c3RhdGljIGlkPSJsb2dhcml0aG1pYyI7c3RhdGljIGRlZmF1bHRzPXt0aWNrczp7Y2FsbGJhY2s6YWUuZm9ybWF0dGVycy5sb2dhcml0aG1pYyxtYWpvcjp7ZW5hYmxlZDohMH19fTtjb25zdHJ1Y3Rvcih0KXtzdXBlcih0KSx0aGlzLnN0YXJ0PXZvaWQgMCx0aGlzLmVuZD12b2lkIDAsdGhpcy5fc3RhcnRWYWx1ZT12b2lkIDAsdGhpcy5fdmFsdWVSYW5nZT0wfXBhcnNlKHQsZSl7Y29uc3QgaT1iby5wcm90b3R5cGUucGFyc2UuYXBwbHkodGhpcyxbdCxlXSk7aWYoMCE9PWkpcmV0dXJuIGEoaSkmJmk+MD9pOm51bGw7dGhpcy5femVybz0hMH1kZXRlcm1pbmVEYXRhTGltaXRzKCl7Y29uc3R7bWluOnQsbWF4OmV9PXRoaXMuZ2V0TWluTWF4KCEwKTt0aGlzLm1pbj1hKHQpP01hdGgubWF4KDAsdCk6bnVsbCx0aGlzLm1heD1hKGUpP01hdGgubWF4KDAsZSk6bnVsbCx0aGlzLm9wdGlvbnMuYmVnaW5BdFplcm8mJih0aGlzLl96ZXJvPSEwKSx0aGlzLl96ZXJvJiZ0aGlzLm1pbiE9PXRoaXMuX3N1Z2dlc3RlZE1pbiYmIWEodGhpcy5fdXNlck1pbikmJih0aGlzLm1pbj10PT09dm8odGhpcy5taW4sMCk/dm8odGhpcy5taW4sLTEpOnZvKHRoaXMubWluLDApKSx0aGlzLmhhbmRsZVRpY2tSYW5nZU9wdGlvbnMoKX1oYW5kbGVUaWNrUmFuZ2VPcHRpb25zKCl7Y29uc3R7bWluRGVmaW5lZDp0LG1heERlZmluZWQ6ZX09dGhpcy5nZXRVc2VyQm91bmRzKCk7bGV0IGk9dGhpcy5taW4scz10aGlzLm1heDtjb25zdCBuPWU9Pmk9dD9pOmUsbz10PT5zPWU/czp0O2k9PT1zJiYoaTw9MD8obigxKSxvKDEwKSk6KG4odm8oaSwtMSkpLG8odm8ocywxKSkpKSxpPD0wJiZuKHZvKHMsLTEpKSxzPD0wJiZvKHZvKGksMSkpLHRoaXMubWluPWksdGhpcy5tYXg9c31idWlsZFRpY2tzKCl7Y29uc3QgdD10aGlzLm9wdGlvbnMsZT1rbyh7bWluOnRoaXMuX3VzZXJNaW4sbWF4OnRoaXMuX3VzZXJNYXh9LHRoaXMpO3JldHVybiJ0aWNrcyI9PT10LmJvdW5kcyYmaihlLHRoaXMsInZhbHVlIiksdC5yZXZlcnNlPyhlLnJldmVyc2UoKSx0aGlzLnN0YXJ0PXRoaXMubWF4LHRoaXMuZW5kPXRoaXMubWluKToodGhpcy5zdGFydD10aGlzLm1pbix0aGlzLmVuZD10aGlzLm1heCksZX1nZXRMYWJlbEZvclZhbHVlKHQpe3JldHVybiB2b2lkIDA9PT10PyIwIjpuZSh0LHRoaXMuY2hhcnQub3B0aW9ucy5sb2NhbGUsdGhpcy5vcHRpb25zLnRpY2tzLmZvcm1hdCl9Y29uZmlndXJlKCl7Y29uc3QgdD10aGlzLm1pbjtzdXBlci5jb25maWd1cmUoKSx0aGlzLl9zdGFydFZhbHVlPXoodCksdGhpcy5fdmFsdWVSYW5nZT16KHRoaXMubWF4KS16KHQpfWdldFBpeGVsRm9yVmFsdWUodCl7cmV0dXJuIHZvaWQgMCE9PXQmJjAhPT10fHwodD10aGlzLm1pbiksbnVsbD09PXR8fGlzTmFOKHQpP05hTjp0aGlzLmdldFBpeGVsRm9yRGVjaW1hbCh0PT09dGhpcy5taW4/MDooeih0KS10aGlzLl9zdGFydFZhbHVlKS90aGlzLl92YWx1ZVJhbmdlKX1nZXRWYWx1ZUZvclBpeGVsKHQpe2NvbnN0IGU9dGhpcy5nZXREZWNpbWFsRm9yUGl4ZWwodCk7cmV0dXJuIE1hdGgucG93KDEwLHRoaXMuX3N0YXJ0VmFsdWUrZSp0aGlzLl92YWx1ZVJhbmdlKX19ZnVuY3Rpb24gUG8odCl7Y29uc3QgZT10LnRpY2tzO2lmKGUuZGlzcGxheSYmdC5kaXNwbGF5KXtjb25zdCB0PWtpKGUuYmFja2Ryb3BQYWRkaW5nKTtyZXR1cm4gbChlLmZvbnQmJmUuZm9udC5zaXplLHVlLmZvbnQuc2l6ZSkrdC5oZWlnaHR9cmV0dXJuIDB9ZnVuY3Rpb24gRG8odCxlLGkscyxuKXtyZXR1cm4gdD09PXN8fHQ9PT1uP3tzdGFydDplLWkvMixlbmQ6ZStpLzJ9OnQ8c3x8dD5uP3tzdGFydDplLWksZW5kOmV9OntzdGFydDplLGVuZDplK2l9fWZ1bmN0aW9uIENvKHQpe2NvbnN0IGU9e2w6dC5sZWZ0K3QuX3BhZGRpbmcubGVmdCxyOnQucmlnaHQtdC5fcGFkZGluZy5yaWdodCx0OnQudG9wK3QuX3BhZGRpbmcudG9wLGI6dC5ib3R0b20tdC5fcGFkZGluZy5ib3R0b219LGk9T2JqZWN0LmFzc2lnbih7fSxlKSxzPVtdLG89W10sYT10Ll9wb2ludExhYmVscy5sZW5ndGgscj10Lm9wdGlvbnMucG9pbnRMYWJlbHMsbD1yLmNlbnRlclBvaW50TGFiZWxzP0MvYTowO2ZvcihsZXQgdT0wO3U8YTt1Kyspe2NvbnN0IGE9ci5zZXRDb250ZXh0KHQuZ2V0UG9pbnRMYWJlbENvbnRleHQodSkpO29bdV09YS5wYWRkaW5nO2NvbnN0IGY9dC5nZXRQb2ludFBvc2l0aW9uKHUsdC5kcmF3aW5nQXJlYStvW3VdLGwpLGc9U2koYS5mb250KSxwPShoPXQuY3R4LGM9ZyxkPW4oZD10Ll9wb2ludExhYmVsc1t1XSk/ZDpbZF0se3c6T2UoaCxjLnN0cmluZyxkKSxoOmQubGVuZ3RoKmMubGluZUhlaWdodH0pO3NbdV09cDtjb25zdCBtPUcodC5nZXRJbmRleEFuZ2xlKHUpK2wpLHg9TWF0aC5yb3VuZChZKG0pKTtPbyhpLGUsbSxEbyh4LGYueCxwLncsMCwxODApLERvKHgsZi55LHAuaCw5MCwyNzApKX12YXIgaCxjLGQ7dC5zZXRDZW50ZXJQb2ludChlLmwtaS5sLGkuci1lLnIsZS50LWkudCxpLmItZS5iKSx0Ll9wb2ludExhYmVsSXRlbXM9ZnVuY3Rpb24odCxlLGkpe2NvbnN0IHM9W10sbj10Ll9wb2ludExhYmVscy5sZW5ndGgsbz10Lm9wdGlvbnMse2NlbnRlclBvaW50TGFiZWxzOmEsZGlzcGxheTpyfT1vLnBvaW50TGFiZWxzLGw9e2V4dHJhOlBvKG8pLzIsYWRkaXRpb25hbEFuZ2xlOmE/Qy9uOjB9O2xldCBoO2ZvcihsZXQgbz0wO288bjtvKyspe2wucGFkZGluZz1pW29dLGwuc2l6ZT1lW29dO2NvbnN0IG49QW8odCxvLGwpO3MucHVzaChuKSwiYXV0byI9PT1yJiYobi52aXNpYmxlPVRvKG4saCksbi52aXNpYmxlJiYoaD1uKSl9cmV0dXJuIHN9KHQscyxvKX1mdW5jdGlvbiBPbyh0LGUsaSxzLG4pe2NvbnN0IG89TWF0aC5hYnMoTWF0aC5zaW4oaSkpLGE9TWF0aC5hYnMoTWF0aC5jb3MoaSkpO2xldCByPTAsbD0wO3Muc3RhcnQ8ZS5sPyhyPShlLmwtcy5zdGFydCkvbyx0Lmw9TWF0aC5taW4odC5sLGUubC1yKSk6cy5lbmQ+ZS5yJiYocj0ocy5lbmQtZS5yKS9vLHQucj1NYXRoLm1heCh0LnIsZS5yK3IpKSxuLnN0YXJ0PGUudD8obD0oZS50LW4uc3RhcnQpL2EsdC50PU1hdGgubWluKHQudCxlLnQtbCkpOm4uZW5kPmUuYiYmKGw9KG4uZW5kLWUuYikvYSx0LmI9TWF0aC5tYXgodC5iLGUuYitsKSl9ZnVuY3Rpb24gQW8odCxlLGkpe2NvbnN0IHM9dC5kcmF3aW5nQXJlYSx7ZXh0cmE6bixhZGRpdGlvbmFsQW5nbGU6byxwYWRkaW5nOmEsc2l6ZTpyfT1pLGw9dC5nZXRQb2ludFBvc2l0aW9uKGUscytuK2EsbyksaD1NYXRoLnJvdW5kKFkoRyhsLmFuZ2xlK0UpKSksYz1mdW5jdGlvbih0LGUsaSl7OTA9PT1pfHwyNzA9PT1pP3QtPWUvMjooaT4yNzB8fGk8OTApJiYodC09ZSk7cmV0dXJuIHR9KGwueSxyLmgsaCksZD1mdW5jdGlvbih0KXtpZigwPT09dHx8MTgwPT09dClyZXR1cm4iY2VudGVyIjtpZih0PDE4MClyZXR1cm4ibGVmdCI7cmV0dXJuInJpZ2h0In0oaCksdT1mdW5jdGlvbih0LGUsaSl7InJpZ2h0Ij09PWk/dC09ZToiY2VudGVyIj09PWkmJih0LT1lLzIpO3JldHVybiB0fShsLngsci53LGQpO3JldHVybnt2aXNpYmxlOiEwLHg6bC54LHk6Yyx0ZXh0QWxpZ246ZCxsZWZ0OnUsdG9wOmMscmlnaHQ6dStyLncsYm90dG9tOmMrci5ofX1mdW5jdGlvbiBUbyh0LGUpe2lmKCFlKXJldHVybiEwO2NvbnN0e2xlZnQ6aSx0b3A6cyxyaWdodDpuLGJvdHRvbTpvfT10O3JldHVybiEoUmUoe3g6aSx5OnN9LGUpfHxSZSh7eDppLHk6b30sZSl8fFJlKHt4Om4seTpzfSxlKXx8UmUoe3g6bix5Om99LGUpKX1mdW5jdGlvbiBMbyh0LGUsaSl7Y29uc3R7bGVmdDpuLHRvcDpvLHJpZ2h0OmEsYm90dG9tOnJ9PWkse2JhY2tkcm9wQ29sb3I6bH09ZTtpZighcyhsKSl7Y29uc3QgaT13aShlLmJvcmRlclJhZGl1cykscz1raShlLmJhY2tkcm9wUGFkZGluZyk7dC5maWxsU3R5bGU9bDtjb25zdCBoPW4tcy5sZWZ0LGM9by1zLnRvcCxkPWEtbitzLndpZHRoLHU9ci1vK3MuaGVpZ2h0O09iamVjdC52YWx1ZXMoaSkuc29tZSgodD0+MCE9PXQpKT8odC5iZWdpblBhdGgoKSxIZSh0LHt4OmgseTpjLHc6ZCxoOnUscmFkaXVzOml9KSx0LmZpbGwoKSk6dC5maWxsUmVjdChoLGMsZCx1KX19ZnVuY3Rpb24gRW8odCxlLGkscyl7Y29uc3R7Y3R4Om59PXQ7aWYoaSluLmFyYyh0LnhDZW50ZXIsdC55Q2VudGVyLGUsMCxPKTtlbHNle2xldCBpPXQuZ2V0UG9pbnRQb3NpdGlvbigwLGUpO24ubW92ZVRvKGkueCxpLnkpO2ZvcihsZXQgbz0xO288cztvKyspaT10LmdldFBvaW50UG9zaXRpb24obyxlKSxuLmxpbmVUbyhpLngsaS55KX19Y2xhc3MgUm8gZXh0ZW5kcyBib3tzdGF0aWMgaWQ9InJhZGlhbExpbmVhciI7c3RhdGljIGRlZmF1bHRzPXtkaXNwbGF5OiEwLGFuaW1hdGU6ITAscG9zaXRpb246ImNoYXJ0QXJlYSIsYW5nbGVMaW5lczp7ZGlzcGxheTohMCxsaW5lV2lkdGg6MSxib3JkZXJEYXNoOltdLGJvcmRlckRhc2hPZmZzZXQ6MH0sZ3JpZDp7Y2lyY3VsYXI6ITF9LHN0YXJ0QW5nbGU6MCx0aWNrczp7c2hvd0xhYmVsQmFja2Ryb3A6ITAsY2FsbGJhY2s6YWUuZm9ybWF0dGVycy5udW1lcmljfSxwb2ludExhYmVsczp7YmFja2Ryb3BDb2xvcjp2b2lkIDAsYmFja2Ryb3BQYWRkaW5nOjIsZGlzcGxheTohMCxmb250OntzaXplOjEwfSxjYWxsYmFjazp0PT50LHBhZGRpbmc6NSxjZW50ZXJQb2ludExhYmVsczohMX19O3N0YXRpYyBkZWZhdWx0Um91dGVzPXsiYW5nbGVMaW5lcy5jb2xvciI6ImJvcmRlckNvbG9yIiwicG9pbnRMYWJlbHMuY29sb3IiOiJjb2xvciIsInRpY2tzLmNvbG9yIjoiY29sb3IifTtzdGF0aWMgZGVzY3JpcHRvcnM9e2FuZ2xlTGluZXM6e19mYWxsYmFjazoiZ3JpZCJ9fTtjb25zdHJ1Y3Rvcih0KXtzdXBlcih0KSx0aGlzLnhDZW50ZXI9dm9pZCAwLHRoaXMueUNlbnRlcj12b2lkIDAsdGhpcy5kcmF3aW5nQXJlYT12b2lkIDAsdGhpcy5fcG9pbnRMYWJlbHM9W10sdGhpcy5fcG9pbnRMYWJlbEl0ZW1zPVtdfXNldERpbWVuc2lvbnMoKXtjb25zdCB0PXRoaXMuX3BhZGRpbmc9a2koUG8odGhpcy5vcHRpb25zKS8yKSxlPXRoaXMud2lkdGg9dGhpcy5tYXhXaWR0aC10LndpZHRoLGk9dGhpcy5oZWlnaHQ9dGhpcy5tYXhIZWlnaHQtdC5oZWlnaHQ7dGhpcy54Q2VudGVyPU1hdGguZmxvb3IodGhpcy5sZWZ0K2UvMit0LmxlZnQpLHRoaXMueUNlbnRlcj1NYXRoLmZsb29yKHRoaXMudG9wK2kvMit0LnRvcCksdGhpcy5kcmF3aW5nQXJlYT1NYXRoLmZsb29yKE1hdGgubWluKGUsaSkvMil9ZGV0ZXJtaW5lRGF0YUxpbWl0cygpe2NvbnN0e21pbjp0LG1heDplfT10aGlzLmdldE1pbk1heCghMSk7dGhpcy5taW49YSh0KSYmIWlzTmFOKHQpP3Q6MCx0aGlzLm1heD1hKGUpJiYhaXNOYU4oZSk/ZTowLHRoaXMuaGFuZGxlVGlja1JhbmdlT3B0aW9ucygpfWNvbXB1dGVUaWNrTGltaXQoKXtyZXR1cm4gTWF0aC5jZWlsKHRoaXMuZHJhd2luZ0FyZWEvUG8odGhpcy5vcHRpb25zKSl9Z2VuZXJhdGVUaWNrTGFiZWxzKHQpe2JvLnByb3RvdHlwZS5nZW5lcmF0ZVRpY2tMYWJlbHMuY2FsbCh0aGlzLHQpLHRoaXMuX3BvaW50TGFiZWxzPXRoaXMuZ2V0TGFiZWxzKCkubWFwKCgodCxlKT0+e2NvbnN0IGk9ZCh0aGlzLm9wdGlvbnMucG9pbnRMYWJlbHMuY2FsbGJhY2ssW3QsZV0sdGhpcyk7cmV0dXJuIGl8fDA9PT1pP2k6IiJ9KSkuZmlsdGVyKCgodCxlKT0+dGhpcy5jaGFydC5nZXREYXRhVmlzaWJpbGl0eShlKSkpfWZpdCgpe2NvbnN0IHQ9dGhpcy5vcHRpb25zO3QuZGlzcGxheSYmdC5wb2ludExhYmVscy5kaXNwbGF5P0NvKHRoaXMpOnRoaXMuc2V0Q2VudGVyUG9pbnQoMCwwLDAsMCl9c2V0Q2VudGVyUG9pbnQodCxlLGkscyl7dGhpcy54Q2VudGVyKz1NYXRoLmZsb29yKCh0LWUpLzIpLHRoaXMueUNlbnRlcis9TWF0aC5mbG9vcigoaS1zKS8yKSx0aGlzLmRyYXdpbmdBcmVhLT1NYXRoLm1pbih0aGlzLmRyYXdpbmdBcmVhLzIsTWF0aC5tYXgodCxlLGkscykpfWdldEluZGV4QW5nbGUodCl7cmV0dXJuIEcodCooTy8odGhpcy5fcG9pbnRMYWJlbHMubGVuZ3RofHwxKSkrJCh0aGlzLm9wdGlvbnMuc3RhcnRBbmdsZXx8MCkpfWdldERpc3RhbmNlRnJvbUNlbnRlckZvclZhbHVlKHQpe2lmKHModCkpcmV0dXJuIE5hTjtjb25zdCBlPXRoaXMuZHJhd2luZ0FyZWEvKHRoaXMubWF4LXRoaXMubWluKTtyZXR1cm4gdGhpcy5vcHRpb25zLnJldmVyc2U/KHRoaXMubWF4LXQpKmU6KHQtdGhpcy5taW4pKmV9Z2V0VmFsdWVGb3JEaXN0YW5jZUZyb21DZW50ZXIodCl7aWYocyh0KSlyZXR1cm4gTmFOO2NvbnN0IGU9dC8odGhpcy5kcmF3aW5nQXJlYS8odGhpcy5tYXgtdGhpcy5taW4pKTtyZXR1cm4gdGhpcy5vcHRpb25zLnJldmVyc2U/dGhpcy5tYXgtZTp0aGlzLm1pbitlfWdldFBvaW50TGFiZWxDb250ZXh0KHQpe2NvbnN0IGU9dGhpcy5fcG9pbnRMYWJlbHN8fFtdO2lmKHQ+PTAmJnQ8ZS5sZW5ndGgpe2NvbnN0IGk9ZVt0XTtyZXR1cm4gZnVuY3Rpb24odCxlLGkpe3JldHVybiBDaSh0LHtsYWJlbDppLGluZGV4OmUsdHlwZToicG9pbnRMYWJlbCJ9KX0odGhpcy5nZXRDb250ZXh0KCksdCxpKX19Z2V0UG9pbnRQb3NpdGlvbih0LGUsaT0wKXtjb25zdCBzPXRoaXMuZ2V0SW5kZXhBbmdsZSh0KS1FK2k7cmV0dXJue3g6TWF0aC5jb3MocykqZSt0aGlzLnhDZW50ZXIseTpNYXRoLnNpbihzKSplK3RoaXMueUNlbnRlcixhbmdsZTpzfX1nZXRQb2ludFBvc2l0aW9uRm9yVmFsdWUodCxlKXtyZXR1cm4gdGhpcy5nZXRQb2ludFBvc2l0aW9uKHQsdGhpcy5nZXREaXN0YW5jZUZyb21DZW50ZXJGb3JWYWx1ZShlKSl9Z2V0QmFzZVBvc2l0aW9uKHQpe3JldHVybiB0aGlzLmdldFBvaW50UG9zaXRpb25Gb3JWYWx1ZSh0fHwwLHRoaXMuZ2V0QmFzZVZhbHVlKCkpfWdldFBvaW50TGFiZWxQb3NpdGlvbih0KXtjb25zdHtsZWZ0OmUsdG9wOmkscmlnaHQ6cyxib3R0b206bn09dGhpcy5fcG9pbnRMYWJlbEl0ZW1zW3RdO3JldHVybntsZWZ0OmUsdG9wOmkscmlnaHQ6cyxib3R0b206bn19ZHJhd0JhY2tncm91bmQoKXtjb25zdHtiYWNrZ3JvdW5kQ29sb3I6dCxncmlkOntjaXJjdWxhcjplfX09dGhpcy5vcHRpb25zO2lmKHQpe2NvbnN0IGk9dGhpcy5jdHg7aS5zYXZlKCksaS5iZWdpblBhdGgoKSxFbyh0aGlzLHRoaXMuZ2V0RGlzdGFuY2VGcm9tQ2VudGVyRm9yVmFsdWUodGhpcy5fZW5kVmFsdWUpLGUsdGhpcy5fcG9pbnRMYWJlbHMubGVuZ3RoKSxpLmNsb3NlUGF0aCgpLGkuZmlsbFN0eWxlPXQsaS5maWxsKCksaS5yZXN0b3JlKCl9fWRyYXdHcmlkKCl7Y29uc3QgdD10aGlzLmN0eCxlPXRoaXMub3B0aW9ucyx7YW5nbGVMaW5lczppLGdyaWQ6cyxib3JkZXI6bn09ZSxvPXRoaXMuX3BvaW50TGFiZWxzLmxlbmd0aDtsZXQgYSxyLGw7aWYoZS5wb2ludExhYmVscy5kaXNwbGF5JiZmdW5jdGlvbih0LGUpe2NvbnN0e2N0eDppLG9wdGlvbnM6e3BvaW50TGFiZWxzOnN9fT10O2ZvcihsZXQgbj1lLTE7bj49MDtuLS0pe2NvbnN0IGU9dC5fcG9pbnRMYWJlbEl0ZW1zW25dO2lmKCFlLnZpc2libGUpY29udGludWU7Y29uc3Qgbz1zLnNldENvbnRleHQodC5nZXRQb2ludExhYmVsQ29udGV4dChuKSk7TG8oaSxvLGUpO2NvbnN0IGE9U2koby5mb250KSx7eDpyLHk6bCx0ZXh0QWxpZ246aH09ZTtOZShpLHQuX3BvaW50TGFiZWxzW25dLHIsbCthLmxpbmVIZWlnaHQvMixhLHtjb2xvcjpvLmNvbG9yLHRleHRBbGlnbjpoLHRleHRCYXNlbGluZToibWlkZGxlIn0pfX0odGhpcyxvKSxzLmRpc3BsYXkmJnRoaXMudGlja3MuZm9yRWFjaCgoKHQsZSk9PntpZigwIT09ZXx8MD09PWUmJnRoaXMubWluPDApe3I9dGhpcy5nZXREaXN0YW5jZUZyb21DZW50ZXJGb3JWYWx1ZSh0LnZhbHVlKTtjb25zdCBpPXRoaXMuZ2V0Q29udGV4dChlKSxhPXMuc2V0Q29udGV4dChpKSxsPW4uc2V0Q29udGV4dChpKTshZnVuY3Rpb24odCxlLGkscyxuKXtjb25zdCBvPXQuY3R4LGE9ZS5jaXJjdWxhcix7Y29sb3I6cixsaW5lV2lkdGg6bH09ZTshYSYmIXN8fCFyfHwhbHx8aTwwfHwoby5zYXZlKCksby5zdHJva2VTdHlsZT1yLG8ubGluZVdpZHRoPWwsby5zZXRMaW5lRGFzaChuLmRhc2h8fFtdKSxvLmxpbmVEYXNoT2Zmc2V0PW4uZGFzaE9mZnNldCxvLmJlZ2luUGF0aCgpLEVvKHQsaSxhLHMpLG8uY2xvc2VQYXRoKCksby5zdHJva2UoKSxvLnJlc3RvcmUoKSl9KHRoaXMsYSxyLG8sbCl9fSkpLGkuZGlzcGxheSl7Zm9yKHQuc2F2ZSgpLGE9by0xO2E+PTA7YS0tKXtjb25zdCBzPWkuc2V0Q29udGV4dCh0aGlzLmdldFBvaW50TGFiZWxDb250ZXh0KGEpKSx7Y29sb3I6bixsaW5lV2lkdGg6b309cztvJiZuJiYodC5saW5lV2lkdGg9byx0LnN0cm9rZVN0eWxlPW4sdC5zZXRMaW5lRGFzaChzLmJvcmRlckRhc2gpLHQubGluZURhc2hPZmZzZXQ9cy5ib3JkZXJEYXNoT2Zmc2V0LHI9dGhpcy5nZXREaXN0YW5jZUZyb21DZW50ZXJGb3JWYWx1ZShlLnJldmVyc2U/dGhpcy5taW46dGhpcy5tYXgpLGw9dGhpcy5nZXRQb2ludFBvc2l0aW9uKGEsciksdC5iZWdpblBhdGgoKSx0Lm1vdmVUbyh0aGlzLnhDZW50ZXIsdGhpcy55Q2VudGVyKSx0LmxpbmVUbyhsLngsbC55KSx0LnN0cm9rZSgpKX10LnJlc3RvcmUoKX19ZHJhd0JvcmRlcigpe31kcmF3TGFiZWxzKCl7Y29uc3QgdD10aGlzLmN0eCxlPXRoaXMub3B0aW9ucyxpPWUudGlja3M7aWYoIWkuZGlzcGxheSlyZXR1cm47Y29uc3Qgcz10aGlzLmdldEluZGV4QW5nbGUoMCk7bGV0IG4sbzt0LnNhdmUoKSx0LnRyYW5zbGF0ZSh0aGlzLnhDZW50ZXIsdGhpcy55Q2VudGVyKSx0LnJvdGF0ZShzKSx0LnRleHRBbGlnbj0iY2VudGVyIix0LnRleHRCYXNlbGluZT0ibWlkZGxlIix0aGlzLnRpY2tzLmZvckVhY2goKChzLGEpPT57aWYoMD09PWEmJnRoaXMubWluPj0wJiYhZS5yZXZlcnNlKXJldHVybjtjb25zdCByPWkuc2V0Q29udGV4dCh0aGlzLmdldENvbnRleHQoYSkpLGw9U2koci5mb250KTtpZihuPXRoaXMuZ2V0RGlzdGFuY2VGcm9tQ2VudGVyRm9yVmFsdWUodGhpcy50aWNrc1thXS52YWx1ZSksci5zaG93TGFiZWxCYWNrZHJvcCl7dC5mb250PWwuc3RyaW5nLG89dC5tZWFzdXJlVGV4dChzLmxhYmVsKS53aWR0aCx0LmZpbGxTdHlsZT1yLmJhY2tkcm9wQ29sb3I7Y29uc3QgZT1raShyLmJhY2tkcm9wUGFkZGluZyk7dC5maWxsUmVjdCgtby8yLWUubGVmdCwtbi1sLnNpemUvMi1lLnRvcCxvK2Uud2lkdGgsbC5zaXplK2UuaGVpZ2h0KX1OZSh0LHMubGFiZWwsMCwtbixsLHtjb2xvcjpyLmNvbG9yLHN0cm9rZUNvbG9yOnIudGV4dFN0cm9rZUNvbG9yLHN0cm9rZVdpZHRoOnIudGV4dFN0cm9rZVdpZHRofSl9KSksdC5yZXN0b3JlKCl9ZHJhd1RpdGxlKCl7fX1jb25zdCBJbz17bWlsbGlzZWNvbmQ6e2NvbW1vbjohMCxzaXplOjEsc3RlcHM6MWUzfSxzZWNvbmQ6e2NvbW1vbjohMCxzaXplOjFlMyxzdGVwczo2MH0sbWludXRlOntjb21tb246ITAsc2l6ZTo2ZTQsc3RlcHM6NjB9LGhvdXI6e2NvbW1vbjohMCxzaXplOjM2ZTUsc3RlcHM6MjR9LGRheTp7Y29tbW9uOiEwLHNpemU6ODY0ZTUsc3RlcHM6MzB9LHdlZWs6e2NvbW1vbjohMSxzaXplOjYwNDhlNSxzdGVwczo0fSxtb250aDp7Y29tbW9uOiEwLHNpemU6MjYyOGU2LHN0ZXBzOjEyfSxxdWFydGVyOntjb21tb246ITEsc2l6ZTo3ODg0ZTYsc3RlcHM6NH0seWVhcjp7Y29tbW9uOiEwLHNpemU6MzE1NGU3fX0sem89T2JqZWN0LmtleXMoSW8pO2Z1bmN0aW9uIEZvKHQsZSl7cmV0dXJuIHQtZX1mdW5jdGlvbiBWbyh0LGUpe2lmKHMoZSkpcmV0dXJuIG51bGw7Y29uc3QgaT10Ll9hZGFwdGVyLHtwYXJzZXI6bixyb3VuZDpvLGlzb1dlZWtkYXk6cn09dC5fcGFyc2VPcHRzO2xldCBsPWU7cmV0dXJuImZ1bmN0aW9uIj09dHlwZW9mIG4mJihsPW4obCkpLGEobCl8fChsPSJzdHJpbmciPT10eXBlb2Ygbj9pLnBhcnNlKGwsbik6aS5wYXJzZShsKSksbnVsbD09PWw/bnVsbDoobyYmKGw9IndlZWsiIT09b3x8IU4ocikmJiEwIT09cj9pLnN0YXJ0T2YobCxvKTppLnN0YXJ0T2YobCwiaXNvV2VlayIscikpLCtsKX1mdW5jdGlvbiBCbyh0LGUsaSxzKXtjb25zdCBuPXpvLmxlbmd0aDtmb3IobGV0IG89em8uaW5kZXhPZih0KTtvPG4tMTsrK28pe2NvbnN0IHQ9SW9bem9bb11dLG49dC5zdGVwcz90LnN0ZXBzOk51bWJlci5NQVhfU0FGRV9JTlRFR0VSO2lmKHQuY29tbW9uJiZNYXRoLmNlaWwoKGktZSkvKG4qdC5zaXplKSk8PXMpcmV0dXJuIHpvW29dfXJldHVybiB6b1tuLTFdfWZ1bmN0aW9uIFdvKHQsZSxpKXtpZihpKXtpZihpLmxlbmd0aCl7Y29uc3R7bG86cyxoaTpufT1ldChpLGUpO3RbaVtzXT49ZT9pW3NdOmlbbl1dPSEwfX1lbHNlIHRbZV09ITB9ZnVuY3Rpb24gTm8odCxlLGkpe2NvbnN0IHM9W10sbj17fSxvPWUubGVuZ3RoO2xldCBhLHI7Zm9yKGE9MDthPG87KythKXI9ZVthXSxuW3JdPWEscy5wdXNoKHt2YWx1ZTpyLG1ham9yOiExfSk7cmV0dXJuIDAhPT1vJiZpP2Z1bmN0aW9uKHQsZSxpLHMpe2NvbnN0IG49dC5fYWRhcHRlcixvPStuLnN0YXJ0T2YoZVswXS52YWx1ZSxzKSxhPWVbZS5sZW5ndGgtMV0udmFsdWU7bGV0IHIsbDtmb3Iocj1vO3I8PWE7cj0rbi5hZGQociwxLHMpKWw9aVtyXSxsPj0wJiYoZVtsXS5tYWpvcj0hMCk7cmV0dXJuIGV9KHQscyxuLGkpOnN9Y2xhc3MgSG8gZXh0ZW5kcyB0bntzdGF0aWMgaWQ9InRpbWUiO3N0YXRpYyBkZWZhdWx0cz17Ym91bmRzOiJkYXRhIixhZGFwdGVyczp7fSx0aW1lOntwYXJzZXI6ITEsdW5pdDohMSxyb3VuZDohMSxpc29XZWVrZGF5OiExLG1pblVuaXQ6Im1pbGxpc2Vjb25kIixkaXNwbGF5Rm9ybWF0czp7fX0sdGlja3M6e3NvdXJjZToiYXV0byIsY2FsbGJhY2s6ITEsbWFqb3I6e2VuYWJsZWQ6ITF9fX07Y29uc3RydWN0b3IodCl7c3VwZXIodCksdGhpcy5fY2FjaGU9e2RhdGE6W10sbGFiZWxzOltdLGFsbDpbXX0sdGhpcy5fdW5pdD0iZGF5Iix0aGlzLl9tYWpvclVuaXQ9dm9pZCAwLHRoaXMuX29mZnNldHM9e30sdGhpcy5fbm9ybWFsaXplZD0hMSx0aGlzLl9wYXJzZU9wdHM9dm9pZCAwfWluaXQodCxlPXt9KXtjb25zdCBpPXQudGltZXx8KHQudGltZT17fSkscz10aGlzLl9hZGFwdGVyPW5ldyBJbi5fZGF0ZSh0LmFkYXB0ZXJzLmRhdGUpO3MuaW5pdChlKSxiKGkuZGlzcGxheUZvcm1hdHMscy5mb3JtYXRzKCkpLHRoaXMuX3BhcnNlT3B0cz17cGFyc2VyOmkucGFyc2VyLHJvdW5kOmkucm91bmQsaXNvV2Vla2RheTppLmlzb1dlZWtkYXl9LHN1cGVyLmluaXQodCksdGhpcy5fbm9ybWFsaXplZD1lLm5vcm1hbGl6ZWR9cGFyc2UodCxlKXtyZXR1cm4gdm9pZCAwPT09dD9udWxsOlZvKHRoaXMsdCl9YmVmb3JlTGF5b3V0KCl7c3VwZXIuYmVmb3JlTGF5b3V0KCksdGhpcy5fY2FjaGU9e2RhdGE6W10sbGFiZWxzOltdLGFsbDpbXX19ZGV0ZXJtaW5lRGF0YUxpbWl0cygpe2NvbnN0IHQ9dGhpcy5vcHRpb25zLGU9dGhpcy5fYWRhcHRlcixpPXQudGltZS51bml0fHwiZGF5IjtsZXR7bWluOnMsbWF4Om4sbWluRGVmaW5lZDpvLG1heERlZmluZWQ6cn09dGhpcy5nZXRVc2VyQm91bmRzKCk7ZnVuY3Rpb24gbCh0KXtvfHxpc05hTih0Lm1pbil8fChzPU1hdGgubWluKHMsdC5taW4pKSxyfHxpc05hTih0Lm1heCl8fChuPU1hdGgubWF4KG4sdC5tYXgpKX1vJiZyfHwobCh0aGlzLl9nZXRMYWJlbEJvdW5kcygpKSwidGlja3MiPT09dC5ib3VuZHMmJiJsYWJlbHMiPT09dC50aWNrcy5zb3VyY2V8fGwodGhpcy5nZXRNaW5NYXgoITEpKSkscz1hKHMpJiYhaXNOYU4ocyk/czorZS5zdGFydE9mKERhdGUubm93KCksaSksbj1hKG4pJiYhaXNOYU4obik/bjorZS5lbmRPZihEYXRlLm5vdygpLGkpKzEsdGhpcy5taW49TWF0aC5taW4ocyxuLTEpLHRoaXMubWF4PU1hdGgubWF4KHMrMSxuKX1fZ2V0TGFiZWxCb3VuZHMoKXtjb25zdCB0PXRoaXMuZ2V0TGFiZWxUaW1lc3RhbXBzKCk7bGV0IGU9TnVtYmVyLlBPU0lUSVZFX0lORklOSVRZLGk9TnVtYmVyLk5FR0FUSVZFX0lORklOSVRZO3JldHVybiB0Lmxlbmd0aCYmKGU9dFswXSxpPXRbdC5sZW5ndGgtMV0pLHttaW46ZSxtYXg6aX19YnVpbGRUaWNrcygpe2NvbnN0IHQ9dGhpcy5vcHRpb25zLGU9dC50aW1lLGk9dC50aWNrcyxzPSJsYWJlbHMiPT09aS5zb3VyY2U/dGhpcy5nZXRMYWJlbFRpbWVzdGFtcHMoKTp0aGlzLl9nZW5lcmF0ZSgpOyJ0aWNrcyI9PT10LmJvdW5kcyYmcy5sZW5ndGgmJih0aGlzLm1pbj10aGlzLl91c2VyTWlufHxzWzBdLHRoaXMubWF4PXRoaXMuX3VzZXJNYXh8fHNbcy5sZW5ndGgtMV0pO2NvbnN0IG49dGhpcy5taW4sbz1udChzLG4sdGhpcy5tYXgpO3JldHVybiB0aGlzLl91bml0PWUudW5pdHx8KGkuYXV0b1NraXA/Qm8oZS5taW5Vbml0LHRoaXMubWluLHRoaXMubWF4LHRoaXMuX2dldExhYmVsQ2FwYWNpdHkobikpOmZ1bmN0aW9uKHQsZSxpLHMsbil7Zm9yKGxldCBvPXpvLmxlbmd0aC0xO28+PXpvLmluZGV4T2YoaSk7by0tKXtjb25zdCBpPXpvW29dO2lmKElvW2ldLmNvbW1vbiYmdC5fYWRhcHRlci5kaWZmKG4scyxpKT49ZS0xKXJldHVybiBpfXJldHVybiB6b1tpP3pvLmluZGV4T2YoaSk6MF19KHRoaXMsby5sZW5ndGgsZS5taW5Vbml0LHRoaXMubWluLHRoaXMubWF4KSksdGhpcy5fbWFqb3JVbml0PWkubWFqb3IuZW5hYmxlZCYmInllYXIiIT09dGhpcy5fdW5pdD9mdW5jdGlvbih0KXtmb3IobGV0IGU9em8uaW5kZXhPZih0KSsxLGk9em8ubGVuZ3RoO2U8aTsrK2UpaWYoSW9bem9bZV1dLmNvbW1vbilyZXR1cm4gem9bZV19KHRoaXMuX3VuaXQpOnZvaWQgMCx0aGlzLmluaXRPZmZzZXRzKHMpLHQucmV2ZXJzZSYmby5yZXZlcnNlKCksTm8odGhpcyxvLHRoaXMuX21ham9yVW5pdCl9YWZ0ZXJBdXRvU2tpcCgpe3RoaXMub3B0aW9ucy5vZmZzZXRBZnRlckF1dG9za2lwJiZ0aGlzLmluaXRPZmZzZXRzKHRoaXMudGlja3MubWFwKCh0PT4rdC52YWx1ZSkpKX1pbml0T2Zmc2V0cyh0PVtdKXtsZXQgZSxpLHM9MCxuPTA7dGhpcy5vcHRpb25zLm9mZnNldCYmdC5sZW5ndGgmJihlPXRoaXMuZ2V0RGVjaW1hbEZvclZhbHVlKHRbMF0pLHM9MT09PXQubGVuZ3RoPzEtZToodGhpcy5nZXREZWNpbWFsRm9yVmFsdWUodFsxXSktZSkvMixpPXRoaXMuZ2V0RGVjaW1hbEZvclZhbHVlKHRbdC5sZW5ndGgtMV0pLG49MT09PXQubGVuZ3RoP2k6KGktdGhpcy5nZXREZWNpbWFsRm9yVmFsdWUodFt0Lmxlbmd0aC0yXSkpLzIpO2NvbnN0IG89dC5sZW5ndGg8Mz8uNTouMjU7cz1aKHMsMCxvKSxuPVoobiwwLG8pLHRoaXMuX29mZnNldHM9e3N0YXJ0OnMsZW5kOm4sZmFjdG9yOjEvKHMrMStuKX19X2dlbmVyYXRlKCl7Y29uc3QgdD10aGlzLl9hZGFwdGVyLGU9dGhpcy5taW4saT10aGlzLm1heCxzPXRoaXMub3B0aW9ucyxuPXMudGltZSxvPW4udW5pdHx8Qm8obi5taW5Vbml0LGUsaSx0aGlzLl9nZXRMYWJlbENhcGFjaXR5KGUpKSxhPWwocy50aWNrcy5zdGVwU2l6ZSwxKSxyPSJ3ZWVrIj09PW8mJm4uaXNvV2Vla2RheSxoPU4ocil8fCEwPT09cixjPXt9O2xldCBkLHUsZj1lO2lmKGgmJihmPSt0LnN0YXJ0T2YoZiwiaXNvV2VlayIscikpLGY9K3Quc3RhcnRPZihmLGg/ImRheSI6byksdC5kaWZmKGksZSxvKT4xZTUqYSl0aHJvdyBuZXcgRXJyb3IoZSsiIGFuZCAiK2krIiBhcmUgdG9vIGZhciBhcGFydCB3aXRoIHN0ZXBTaXplIG9mICIrYSsiICIrbyk7Y29uc3QgZz0iZGF0YSI9PT1zLnRpY2tzLnNvdXJjZSYmdGhpcy5nZXREYXRhVGltZXN0YW1wcygpO2ZvcihkPWYsdT0wO2Q8aTtkPSt0LmFkZChkLGEsbyksdSsrKVdvKGMsZCxnKTtyZXR1cm4gZCE9PWkmJiJ0aWNrcyIhPT1zLmJvdW5kcyYmMSE9PXV8fFdvKGMsZCxnKSxPYmplY3Qua2V5cyhjKS5zb3J0KEZvKS5tYXAoKHQ9Pit0KSl9Z2V0TGFiZWxGb3JWYWx1ZSh0KXtjb25zdCBlPXRoaXMuX2FkYXB0ZXIsaT10aGlzLm9wdGlvbnMudGltZTtyZXR1cm4gaS50b29sdGlwRm9ybWF0P2UuZm9ybWF0KHQsaS50b29sdGlwRm9ybWF0KTplLmZvcm1hdCh0LGkuZGlzcGxheUZvcm1hdHMuZGF0ZXRpbWUpfWZvcm1hdCh0LGUpe2NvbnN0IGk9dGhpcy5vcHRpb25zLnRpbWUuZGlzcGxheUZvcm1hdHMscz10aGlzLl91bml0LG49ZXx8aVtzXTtyZXR1cm4gdGhpcy5fYWRhcHRlci5mb3JtYXQodCxuKX1fdGlja0Zvcm1hdEZ1bmN0aW9uKHQsZSxpLHMpe2NvbnN0IG49dGhpcy5vcHRpb25zLG89bi50aWNrcy5jYWxsYmFjaztpZihvKXJldHVybiBkKG8sW3QsZSxpXSx0aGlzKTtjb25zdCBhPW4udGltZS5kaXNwbGF5Rm9ybWF0cyxyPXRoaXMuX3VuaXQsbD10aGlzLl9tYWpvclVuaXQsaD1yJiZhW3JdLGM9bCYmYVtsXSx1PWlbZV0sZj1sJiZjJiZ1JiZ1Lm1ham9yO3JldHVybiB0aGlzLl9hZGFwdGVyLmZvcm1hdCh0LHN8fChmP2M6aCkpfWdlbmVyYXRlVGlja0xhYmVscyh0KXtsZXQgZSxpLHM7Zm9yKGU9MCxpPXQubGVuZ3RoO2U8aTsrK2Upcz10W2VdLHMubGFiZWw9dGhpcy5fdGlja0Zvcm1hdEZ1bmN0aW9uKHMudmFsdWUsZSx0KX1nZXREZWNpbWFsRm9yVmFsdWUodCl7cmV0dXJuIG51bGw9PT10P05hTjoodC10aGlzLm1pbikvKHRoaXMubWF4LXRoaXMubWluKX1nZXRQaXhlbEZvclZhbHVlKHQpe2NvbnN0IGU9dGhpcy5fb2Zmc2V0cyxpPXRoaXMuZ2V0RGVjaW1hbEZvclZhbHVlKHQpO3JldHVybiB0aGlzLmdldFBpeGVsRm9yRGVjaW1hbCgoZS5zdGFydCtpKSplLmZhY3Rvcil9Z2V0VmFsdWVGb3JQaXhlbCh0KXtjb25zdCBlPXRoaXMuX29mZnNldHMsaT10aGlzLmdldERlY2ltYWxGb3JQaXhlbCh0KS9lLmZhY3Rvci1lLmVuZDtyZXR1cm4gdGhpcy5taW4raSoodGhpcy5tYXgtdGhpcy5taW4pfV9nZXRMYWJlbFNpemUodCl7Y29uc3QgZT10aGlzLm9wdGlvbnMudGlja3MsaT10aGlzLmN0eC5tZWFzdXJlVGV4dCh0KS53aWR0aCxzPSQodGhpcy5pc0hvcml6b250YWwoKT9lLm1heFJvdGF0aW9uOmUubWluUm90YXRpb24pLG49TWF0aC5jb3Mocyksbz1NYXRoLnNpbihzKSxhPXRoaXMuX3Jlc29sdmVUaWNrRm9udE9wdGlvbnMoMCkuc2l6ZTtyZXR1cm57dzppKm4rYSpvLGg6aSpvK2Eqbn19X2dldExhYmVsQ2FwYWNpdHkodCl7Y29uc3QgZT10aGlzLm9wdGlvbnMudGltZSxpPWUuZGlzcGxheUZvcm1hdHMscz1pW2UudW5pdF18fGkubWlsbGlzZWNvbmQsbj10aGlzLl90aWNrRm9ybWF0RnVuY3Rpb24odCwwLE5vKHRoaXMsW3RdLHRoaXMuX21ham9yVW5pdCkscyksbz10aGlzLl9nZXRMYWJlbFNpemUobiksYT1NYXRoLmZsb29yKHRoaXMuaXNIb3Jpem9udGFsKCk/dGhpcy53aWR0aC9vLnc6dGhpcy5oZWlnaHQvby5oKS0xO3JldHVybiBhPjA/YToxfWdldERhdGFUaW1lc3RhbXBzKCl7bGV0IHQsZSxpPXRoaXMuX2NhY2hlLmRhdGF8fFtdO2lmKGkubGVuZ3RoKXJldHVybiBpO2NvbnN0IHM9dGhpcy5nZXRNYXRjaGluZ1Zpc2libGVNZXRhcygpO2lmKHRoaXMuX25vcm1hbGl6ZWQmJnMubGVuZ3RoKXJldHVybiB0aGlzLl9jYWNoZS5kYXRhPXNbMF0uY29udHJvbGxlci5nZXRBbGxQYXJzZWRWYWx1ZXModGhpcyk7Zm9yKHQ9MCxlPXMubGVuZ3RoO3Q8ZTsrK3QpaT1pLmNvbmNhdChzW3RdLmNvbnRyb2xsZXIuZ2V0QWxsUGFyc2VkVmFsdWVzKHRoaXMpKTtyZXR1cm4gdGhpcy5fY2FjaGUuZGF0YT10aGlzLm5vcm1hbGl6ZShpKX1nZXRMYWJlbFRpbWVzdGFtcHMoKXtjb25zdCB0PXRoaXMuX2NhY2hlLmxhYmVsc3x8W107bGV0IGUsaTtpZih0Lmxlbmd0aClyZXR1cm4gdDtjb25zdCBzPXRoaXMuZ2V0TGFiZWxzKCk7Zm9yKGU9MCxpPXMubGVuZ3RoO2U8aTsrK2UpdC5wdXNoKFZvKHRoaXMsc1tlXSkpO3JldHVybiB0aGlzLl9jYWNoZS5sYWJlbHM9dGhpcy5fbm9ybWFsaXplZD90OnRoaXMubm9ybWFsaXplKHQpfW5vcm1hbGl6ZSh0KXtyZXR1cm4gbHQodC5zb3J0KEZvKSl9fWZ1bmN0aW9uIGpvKHQsZSxpKXtsZXQgcyxuLG8sYSxyPTAsbD10Lmxlbmd0aC0xO2k/KGU+PXRbcl0ucG9zJiZlPD10W2xdLnBvcyYmKHtsbzpyLGhpOmx9PWl0KHQsInBvcyIsZSkpLCh7cG9zOnMsdGltZTpvfT10W3JdKSwoe3BvczpuLHRpbWU6YX09dFtsXSkpOihlPj10W3JdLnRpbWUmJmU8PXRbbF0udGltZSYmKHtsbzpyLGhpOmx9PWl0KHQsInRpbWUiLGUpKSwoe3RpbWU6cyxwb3M6b309dFtyXSksKHt0aW1lOm4scG9zOmF9PXRbbF0pKTtjb25zdCBoPW4tcztyZXR1cm4gaD9vKyhhLW8pKihlLXMpL2g6b312YXIgJG89T2JqZWN0LmZyZWV6ZSh7X19wcm90b19fOm51bGwsQ2F0ZWdvcnlTY2FsZTpjbGFzcyBleHRlbmRzIHRue3N0YXRpYyBpZD0iY2F0ZWdvcnkiO3N0YXRpYyBkZWZhdWx0cz17dGlja3M6e2NhbGxiYWNrOm1vfX07Y29uc3RydWN0b3IodCl7c3VwZXIodCksdGhpcy5fc3RhcnRWYWx1ZT12b2lkIDAsdGhpcy5fdmFsdWVSYW5nZT0wLHRoaXMuX2FkZGVkTGFiZWxzPVtdfWluaXQodCl7Y29uc3QgZT10aGlzLl9hZGRlZExhYmVscztpZihlLmxlbmd0aCl7Y29uc3QgdD10aGlzLmdldExhYmVscygpO2Zvcihjb25zdHtpbmRleDppLGxhYmVsOnN9b2YgZSl0W2ldPT09cyYmdC5zcGxpY2UoaSwxKTt0aGlzLl9hZGRlZExhYmVscz1bXX1zdXBlci5pbml0KHQpfXBhcnNlKHQsZSl7aWYocyh0KSlyZXR1cm4gbnVsbDtjb25zdCBpPXRoaXMuZ2V0TGFiZWxzKCk7cmV0dXJuKCh0LGUpPT5udWxsPT09dD9udWxsOlooTWF0aC5yb3VuZCh0KSwwLGUpKShlPWlzRmluaXRlKGUpJiZpW2VdPT09dD9lOnBvKGksdCxsKGUsdCksdGhpcy5fYWRkZWRMYWJlbHMpLGkubGVuZ3RoLTEpfWRldGVybWluZURhdGFMaW1pdHMoKXtjb25zdHttaW5EZWZpbmVkOnQsbWF4RGVmaW5lZDplfT10aGlzLmdldFVzZXJCb3VuZHMoKTtsZXR7bWluOmksbWF4OnN9PXRoaXMuZ2V0TWluTWF4KCEwKTsidGlja3MiPT09dGhpcy5vcHRpb25zLmJvdW5kcyYmKHR8fChpPTApLGV8fChzPXRoaXMuZ2V0TGFiZWxzKCkubGVuZ3RoLTEpKSx0aGlzLm1pbj1pLHRoaXMubWF4PXN9YnVpbGRUaWNrcygpe2NvbnN0IHQ9dGhpcy5taW4sZT10aGlzLm1heCxpPXRoaXMub3B0aW9ucy5vZmZzZXQscz1bXTtsZXQgbj10aGlzLmdldExhYmVscygpO249MD09PXQmJmU9PT1uLmxlbmd0aC0xP246bi5zbGljZSh0LGUrMSksdGhpcy5fdmFsdWVSYW5nZT1NYXRoLm1heChuLmxlbmd0aC0oaT8wOjEpLDEpLHRoaXMuX3N0YXJ0VmFsdWU9dGhpcy5taW4tKGk/LjU6MCk7Zm9yKGxldCBpPXQ7aTw9ZTtpKyspcy5wdXNoKHt2YWx1ZTppfSk7cmV0dXJuIHN9Z2V0TGFiZWxGb3JWYWx1ZSh0KXtyZXR1cm4gbW8uY2FsbCh0aGlzLHQpfWNvbmZpZ3VyZSgpe3N1cGVyLmNvbmZpZ3VyZSgpLHRoaXMuaXNIb3Jpem9udGFsKCl8fCh0aGlzLl9yZXZlcnNlUGl4ZWxzPSF0aGlzLl9yZXZlcnNlUGl4ZWxzKX1nZXRQaXhlbEZvclZhbHVlKHQpe3JldHVybiJudW1iZXIiIT10eXBlb2YgdCYmKHQ9dGhpcy5wYXJzZSh0KSksbnVsbD09PXQ/TmFOOnRoaXMuZ2V0UGl4ZWxGb3JEZWNpbWFsKCh0LXRoaXMuX3N0YXJ0VmFsdWUpL3RoaXMuX3ZhbHVlUmFuZ2UpfWdldFBpeGVsRm9yVGljayh0KXtjb25zdCBlPXRoaXMudGlja3M7cmV0dXJuIHQ8MHx8dD5lLmxlbmd0aC0xP251bGw6dGhpcy5nZXRQaXhlbEZvclZhbHVlKGVbdF0udmFsdWUpfWdldFZhbHVlRm9yUGl4ZWwodCl7cmV0dXJuIE1hdGgucm91bmQodGhpcy5fc3RhcnRWYWx1ZSt0aGlzLmdldERlY2ltYWxGb3JQaXhlbCh0KSp0aGlzLl92YWx1ZVJhbmdlKX1nZXRCYXNlUGl4ZWwoKXtyZXR1cm4gdGhpcy5ib3R0b219fSxMaW5lYXJTY2FsZTpfbyxMb2dhcml0aG1pY1NjYWxlOlNvLFJhZGlhbExpbmVhclNjYWxlOlJvLFRpbWVTY2FsZTpIbyxUaW1lU2VyaWVzU2NhbGU6Y2xhc3MgZXh0ZW5kcyBIb3tzdGF0aWMgaWQ9InRpbWVzZXJpZXMiO3N0YXRpYyBkZWZhdWx0cz1Iby5kZWZhdWx0cztjb25zdHJ1Y3Rvcih0KXtzdXBlcih0KSx0aGlzLl90YWJsZT1bXSx0aGlzLl9taW5Qb3M9dm9pZCAwLHRoaXMuX3RhYmxlUmFuZ2U9dm9pZCAwfWluaXRPZmZzZXRzKCl7Y29uc3QgdD10aGlzLl9nZXRUaW1lc3RhbXBzRm9yVGFibGUoKSxlPXRoaXMuX3RhYmxlPXRoaXMuYnVpbGRMb29rdXBUYWJsZSh0KTt0aGlzLl9taW5Qb3M9am8oZSx0aGlzLm1pbiksdGhpcy5fdGFibGVSYW5nZT1qbyhlLHRoaXMubWF4KS10aGlzLl9taW5Qb3Msc3VwZXIuaW5pdE9mZnNldHModCl9YnVpbGRMb29rdXBUYWJsZSh0KXtjb25zdHttaW46ZSxtYXg6aX09dGhpcyxzPVtdLG49W107bGV0IG8sYSxyLGwsaDtmb3Iobz0wLGE9dC5sZW5ndGg7bzxhOysrbylsPXRbb10sbD49ZSYmbDw9aSYmcy5wdXNoKGwpO2lmKHMubGVuZ3RoPDIpcmV0dXJuW3t0aW1lOmUscG9zOjB9LHt0aW1lOmkscG9zOjF9XTtmb3Iobz0wLGE9cy5sZW5ndGg7bzxhOysrbyloPXNbbysxXSxyPXNbby0xXSxsPXNbb10sTWF0aC5yb3VuZCgoaCtyKS8yKSE9PWwmJm4ucHVzaCh7dGltZTpsLHBvczpvLyhhLTEpfSk7cmV0dXJuIG59X2dlbmVyYXRlKCl7Y29uc3QgdD10aGlzLm1pbixlPXRoaXMubWF4O2xldCBpPXN1cGVyLmdldERhdGFUaW1lc3RhbXBzKCk7cmV0dXJuIGkuaW5jbHVkZXModCkmJmkubGVuZ3RofHxpLnNwbGljZSgwLDAsdCksaS5pbmNsdWRlcyhlKSYmMSE9PWkubGVuZ3RofHxpLnB1c2goZSksaS5zb3J0KCgodCxlKT0+dC1lKSl9X2dldFRpbWVzdGFtcHNGb3JUYWJsZSgpe2xldCB0PXRoaXMuX2NhY2hlLmFsbHx8W107aWYodC5sZW5ndGgpcmV0dXJuIHQ7Y29uc3QgZT10aGlzLmdldERhdGFUaW1lc3RhbXBzKCksaT10aGlzLmdldExhYmVsVGltZXN0YW1wcygpO3JldHVybiB0PWUubGVuZ3RoJiZpLmxlbmd0aD90aGlzLm5vcm1hbGl6ZShlLmNvbmNhdChpKSk6ZS5sZW5ndGg/ZTppLHQ9dGhpcy5fY2FjaGUuYWxsPXQsdH1nZXREZWNpbWFsRm9yVmFsdWUodCl7cmV0dXJuKGpvKHRoaXMuX3RhYmxlLHQpLXRoaXMuX21pblBvcykvdGhpcy5fdGFibGVSYW5nZX1nZXRWYWx1ZUZvclBpeGVsKHQpe2NvbnN0IGU9dGhpcy5fb2Zmc2V0cyxpPXRoaXMuZ2V0RGVjaW1hbEZvclBpeGVsKHQpL2UuZmFjdG9yLWUuZW5kO3JldHVybiBqbyh0aGlzLl90YWJsZSxpKnRoaXMuX3RhYmxlUmFuZ2UrdGhpcy5fbWluUG9zLCEwKX19fSk7Y29uc3QgWW89WyJyZ2IoNTQsIDE2MiwgMjM1KSIsInJnYigyNTUsIDk5LCAxMzIpIiwicmdiKDI1NSwgMTU5LCA2NCkiLCJyZ2IoMjU1LCAyMDUsIDg2KSIsInJnYig3NSwgMTkyLCAxOTIpIiwicmdiKDE1MywgMTAyLCAyNTUpIiwicmdiKDIwMSwgMjAzLCAyMDcpIl0sVW89WW8ubWFwKCh0PT50LnJlcGxhY2UoInJnYigiLCJyZ2JhKCIpLnJlcGxhY2UoIikiLCIsIDAuNSkiKSkpO2Z1bmN0aW9uIFhvKHQpe3JldHVybiBZb1t0JVlvLmxlbmd0aF19ZnVuY3Rpb24gcW8odCl7cmV0dXJuIFVvW3QlVW8ubGVuZ3RoXX1mdW5jdGlvbiBLbyh0KXtsZXQgZT0wO3JldHVybihpLHMpPT57Y29uc3Qgbj10LmdldERhdGFzZXRNZXRhKHMpLmNvbnRyb2xsZXI7biBpbnN0YW5jZW9mICRuP2U9ZnVuY3Rpb24odCxlKXtyZXR1cm4gdC5iYWNrZ3JvdW5kQ29sb3I9dC5kYXRhLm1hcCgoKCk9PlhvKGUrKykpKSxlfShpLGUpOm4gaW5zdGFuY2VvZiBZbj9lPWZ1bmN0aW9uKHQsZSl7cmV0dXJuIHQuYmFja2dyb3VuZENvbG9yPXQuZGF0YS5tYXAoKCgpPT5xbyhlKyspKSksZX0oaSxlKTpuJiYoZT1mdW5jdGlvbih0LGUpe3JldHVybiB0LmJvcmRlckNvbG9yPVhvKGUpLHQuYmFja2dyb3VuZENvbG9yPXFvKGUpLCsrZX0oaSxlKSl9fWZ1bmN0aW9uIEdvKHQpe2xldCBlO2ZvcihlIGluIHQpaWYodFtlXS5ib3JkZXJDb2xvcnx8dFtlXS5iYWNrZ3JvdW5kQ29sb3IpcmV0dXJuITA7cmV0dXJuITF9dmFyIEpvPXtpZDoiY29sb3JzIixkZWZhdWx0czp7ZW5hYmxlZDohMCxmb3JjZU92ZXJyaWRlOiExfSxiZWZvcmVMYXlvdXQodCxlLGkpe2lmKCFpLmVuYWJsZWQpcmV0dXJuO2NvbnN0e2RhdGE6e2RhdGFzZXRzOnN9LG9wdGlvbnM6bn09dC5jb25maWcse2VsZW1lbnRzOm99PW4sYT1HbyhzKXx8KHI9bikmJihyLmJvcmRlckNvbG9yfHxyLmJhY2tncm91bmRDb2xvcil8fG8mJkdvKG8pfHwicmdiYSgwLDAsMCwwLjEpIiE9PXVlLmJvcmRlckNvbG9yfHwicmdiYSgwLDAsMCwwLjEpIiE9PXVlLmJhY2tncm91bmRDb2xvcjt2YXIgcjtpZighaS5mb3JjZU92ZXJyaWRlJiZhKXJldHVybjtjb25zdCBsPUtvKHQpO3MuZm9yRWFjaChsKX19O2Z1bmN0aW9uIFpvKHQpe2lmKHQuX2RlY2ltYXRlZCl7Y29uc3QgZT10Ll9kYXRhO2RlbGV0ZSB0Ll9kZWNpbWF0ZWQsZGVsZXRlIHQuX2RhdGEsT2JqZWN0LmRlZmluZVByb3BlcnR5KHQsImRhdGEiLHtjb25maWd1cmFibGU6ITAsZW51bWVyYWJsZTohMCx3cml0YWJsZTohMCx2YWx1ZTplfSl9fWZ1bmN0aW9uIFFvKHQpe3QuZGF0YS5kYXRhc2V0cy5mb3JFYWNoKCh0PT57Wm8odCl9KSl9dmFyIHRhPXtpZDoiZGVjaW1hdGlvbiIsZGVmYXVsdHM6e2FsZ29yaXRobToibWluLW1heCIsZW5hYmxlZDohMX0sYmVmb3JlRWxlbWVudHNVcGRhdGU6KHQsZSxpKT0+e2lmKCFpLmVuYWJsZWQpcmV0dXJuIHZvaWQgUW8odCk7Y29uc3Qgbj10LndpZHRoO3QuZGF0YS5kYXRhc2V0cy5mb3JFYWNoKCgoZSxvKT0+e2NvbnN0e19kYXRhOmEsaW5kZXhBeGlzOnJ9PWUsbD10LmdldERhdGFzZXRNZXRhKG8pLGg9YXx8ZS5kYXRhO2lmKCJ5Ij09PVBpKFtyLHQub3B0aW9ucy5pbmRleEF4aXNdKSlyZXR1cm47aWYoIWwuY29udHJvbGxlci5zdXBwb3J0c0RlY2ltYXRpb24pcmV0dXJuO2NvbnN0IGM9dC5zY2FsZXNbbC54QXhpc0lEXTtpZigibGluZWFyIiE9PWMudHlwZSYmInRpbWUiIT09Yy50eXBlKXJldHVybjtpZih0Lm9wdGlvbnMucGFyc2luZylyZXR1cm47bGV0e3N0YXJ0OmQsY291bnQ6dX09ZnVuY3Rpb24odCxlKXtjb25zdCBpPWUubGVuZ3RoO2xldCBzLG49MDtjb25zdHtpU2NhbGU6b309dCx7bWluOmEsbWF4OnIsbWluRGVmaW5lZDpsLG1heERlZmluZWQ6aH09by5nZXRVc2VyQm91bmRzKCk7cmV0dXJuIGwmJihuPVooaXQoZSxvLmF4aXMsYSkubG8sMCxpLTEpKSxzPWg/WihpdChlLG8uYXhpcyxyKS5oaSsxLG4saSktbjppLW4se3N0YXJ0Om4sY291bnQ6c319KGwsaCk7aWYodTw9KGkudGhyZXNob2xkfHw0Km4pKXJldHVybiB2b2lkIFpvKGUpO2xldCBmO3N3aXRjaChzKGEpJiYoZS5fZGF0YT1oLGRlbGV0ZSBlLmRhdGEsT2JqZWN0LmRlZmluZVByb3BlcnR5KGUsImRhdGEiLHtjb25maWd1cmFibGU6ITAsZW51bWVyYWJsZTohMCxnZXQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5fZGVjaW1hdGVkfSxzZXQ6ZnVuY3Rpb24odCl7dGhpcy5fZGF0YT10fX0pKSxpLmFsZ29yaXRobSl7Y2FzZSJsdHRiIjpmPWZ1bmN0aW9uKHQsZSxpLHMsbil7Y29uc3Qgbz1uLnNhbXBsZXN8fHM7aWYobz49aSlyZXR1cm4gdC5zbGljZShlLGUraSk7Y29uc3QgYT1bXSxyPShpLTIpLyhvLTIpO2xldCBsPTA7Y29uc3QgaD1lK2ktMTtsZXQgYyxkLHUsZixnLHA9ZTtmb3IoYVtsKytdPXRbcF0sYz0wO2M8by0yO2MrKyl7bGV0IHMsbj0wLG89MDtjb25zdCBoPU1hdGguZmxvb3IoKGMrMSkqcikrMStlLG09TWF0aC5taW4oTWF0aC5mbG9vcigoYysyKSpyKSsxLGkpK2UseD1tLWg7Zm9yKHM9aDtzPG07cysrKW4rPXRbc10ueCxvKz10W3NdLnk7bi89eCxvLz14O2NvbnN0IGI9TWF0aC5mbG9vcihjKnIpKzErZSxfPU1hdGgubWluKE1hdGguZmxvb3IoKGMrMSkqcikrMSxpKStlLHt4OnkseTp2fT10W3BdO2Zvcih1PWY9LTEscz1iO3M8XztzKyspZj0uNSpNYXRoLmFicygoeS1uKSoodFtzXS55LXYpLSh5LXRbc10ueCkqKG8tdikpLGY+dSYmKHU9ZixkPXRbc10sZz1zKTthW2wrK109ZCxwPWd9cmV0dXJuIGFbbCsrXT10W2hdLGF9KGgsZCx1LG4saSk7YnJlYWs7Y2FzZSJtaW4tbWF4IjpmPWZ1bmN0aW9uKHQsZSxpLG4pe2xldCBvLGEscixsLGgsYyxkLHUsZixnLHA9MCxtPTA7Y29uc3QgeD1bXSxiPWUraS0xLF89dFtlXS54LHk9dFtiXS54LV87Zm9yKG89ZTtvPGUraTsrK28pe2E9dFtvXSxyPShhLngtXykveSpuLGw9YS55O2NvbnN0IGU9MHxyO2lmKGU9PT1oKWw8Zj8oZj1sLGM9byk6bD5nJiYoZz1sLGQ9bykscD0obSpwK2EueCkvKyttO2Vsc2V7Y29uc3QgaT1vLTE7aWYoIXMoYykmJiFzKGQpKXtjb25zdCBlPU1hdGgubWluKGMsZCkscz1NYXRoLm1heChjLGQpO2UhPT11JiZlIT09aSYmeC5wdXNoKHsuLi50W2VdLHg6cH0pLHMhPT11JiZzIT09aSYmeC5wdXNoKHsuLi50W3NdLHg6cH0pfW8+MCYmaSE9PXUmJngucHVzaCh0W2ldKSx4LnB1c2goYSksaD1lLG09MCxmPWc9bCxjPWQ9dT1vfX1yZXR1cm4geH0oaCxkLHUsbik7YnJlYWs7ZGVmYXVsdDp0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIGRlY2ltYXRpb24gYWxnb3JpdGhtICcke2kuYWxnb3JpdGhtfSdgKX1lLl9kZWNpbWF0ZWQ9Zn0pKX0sZGVzdHJveSh0KXtRbyh0KX19O2Z1bmN0aW9uIGVhKHQsZSxpLHMpe2lmKHMpcmV0dXJuO2xldCBuPWVbdF0sbz1pW3RdO3JldHVybiJhbmdsZSI9PT10JiYobj1HKG4pLG89RyhvKSkse3Byb3BlcnR5OnQsc3RhcnQ6bixlbmQ6b319ZnVuY3Rpb24gaWEodCxlLGkpe2Zvcig7ZT50O2UtLSl7Y29uc3QgdD1pW2VdO2lmKCFpc05hTih0LngpJiYhaXNOYU4odC55KSlicmVha31yZXR1cm4gZX1mdW5jdGlvbiBzYSh0LGUsaSxzKXtyZXR1cm4gdCYmZT9zKHRbaV0sZVtpXSk6dD90W2ldOmU/ZVtpXTowfWZ1bmN0aW9uIG5hKHQsZSl7bGV0IGk9W10scz0hMTtyZXR1cm4gbih0KT8ocz0hMCxpPXQpOmk9ZnVuY3Rpb24odCxlKXtjb25zdHt4Omk9bnVsbCx5OnM9bnVsbH09dHx8e30sbj1lLnBvaW50cyxvPVtdO3JldHVybiBlLnNlZ21lbnRzLmZvckVhY2goKCh7c3RhcnQ6dCxlbmQ6ZX0pPT57ZT1pYSh0LGUsbik7Y29uc3QgYT1uW3RdLHI9bltlXTtudWxsIT09cz8oby5wdXNoKHt4OmEueCx5OnN9KSxvLnB1c2goe3g6ci54LHk6c30pKTpudWxsIT09aSYmKG8ucHVzaCh7eDppLHk6YS55fSksby5wdXNoKHt4OmkseTpyLnl9KSl9KSksb30odCxlKSxpLmxlbmd0aD9uZXcgb28oe3BvaW50czppLG9wdGlvbnM6e3RlbnNpb246MH0sX2xvb3A6cyxfZnVsbExvb3A6c30pOm51bGx9ZnVuY3Rpb24gb2EodCl7cmV0dXJuIHQmJiExIT09dC5maWxsfWZ1bmN0aW9uIGFhKHQsZSxpKXtsZXQgcz10W2VdLmZpbGw7Y29uc3Qgbj1bZV07bGV0IG87aWYoIWkpcmV0dXJuIHM7Zm9yKDshMSE9PXMmJi0xPT09bi5pbmRleE9mKHMpOyl7aWYoIWEocykpcmV0dXJuIHM7aWYobz10W3NdLCFvKXJldHVybiExO2lmKG8udmlzaWJsZSlyZXR1cm4gcztuLnB1c2gocykscz1vLmZpbGx9cmV0dXJuITF9ZnVuY3Rpb24gcmEodCxlLGkpe2NvbnN0IHM9ZnVuY3Rpb24odCl7Y29uc3QgZT10Lm9wdGlvbnMsaT1lLmZpbGw7bGV0IHM9bChpJiZpLnRhcmdldCxpKTt2b2lkIDA9PT1zJiYocz0hIWUuYmFja2dyb3VuZENvbG9yKTtpZighMT09PXN8fG51bGw9PT1zKXJldHVybiExO2lmKCEwPT09cylyZXR1cm4ib3JpZ2luIjtyZXR1cm4gc30odCk7aWYobyhzKSlyZXR1cm4haXNOYU4ocy52YWx1ZSkmJnM7bGV0IG49cGFyc2VGbG9hdChzKTtyZXR1cm4gYShuKSYmTWF0aC5mbG9vcihuKT09PW4/ZnVuY3Rpb24odCxlLGkscyl7Ii0iIT09dCYmIisiIT09dHx8KGk9ZStpKTtpZihpPT09ZXx8aTwwfHxpPj1zKXJldHVybiExO3JldHVybiBpfShzWzBdLGUsbixpKTpbIm9yaWdpbiIsInN0YXJ0IiwiZW5kIiwic3RhY2siLCJzaGFwZSJdLmluZGV4T2Yocyk+PTAmJnN9ZnVuY3Rpb24gbGEodCxlLGkpe2NvbnN0IHM9W107Zm9yKGxldCBuPTA7bjxpLmxlbmd0aDtuKyspe2NvbnN0IG89aVtuXSx7Zmlyc3Q6YSxsYXN0OnIscG9pbnQ6bH09aGEobyxlLCJ4Iik7aWYoISghbHx8YSYmcikpaWYoYSlzLnVuc2hpZnQobCk7ZWxzZSBpZih0LnB1c2gobCksIXIpYnJlYWt9dC5wdXNoKC4uLnMpfWZ1bmN0aW9uIGhhKHQsZSxpKXtjb25zdCBzPXQuaW50ZXJwb2xhdGUoZSxpKTtpZighcylyZXR1cm57fTtjb25zdCBuPXNbaV0sbz10LnNlZ21lbnRzLGE9dC5wb2ludHM7bGV0IHI9ITEsbD0hMTtmb3IobGV0IHQ9MDt0PG8ubGVuZ3RoO3QrKyl7Y29uc3QgZT1vW3RdLHM9YVtlLnN0YXJ0XVtpXSxoPWFbZS5lbmRdW2ldO2lmKHR0KG4scyxoKSl7cj1uPT09cyxsPW49PT1oO2JyZWFrfX1yZXR1cm57Zmlyc3Q6cixsYXN0OmwscG9pbnQ6c319Y2xhc3MgY2F7Y29uc3RydWN0b3IodCl7dGhpcy54PXQueCx0aGlzLnk9dC55LHRoaXMucmFkaXVzPXQucmFkaXVzfXBhdGhTZWdtZW50KHQsZSxpKXtjb25zdHt4OnMseTpuLHJhZGl1czpvfT10aGlzO3JldHVybiBlPWV8fHtzdGFydDowLGVuZDpPfSx0LmFyYyhzLG4sbyxlLmVuZCxlLnN0YXJ0LCEwKSwhaS5ib3VuZHN9aW50ZXJwb2xhdGUodCl7Y29uc3R7eDplLHk6aSxyYWRpdXM6c309dGhpcyxuPXQuYW5nbGU7cmV0dXJue3g6ZStNYXRoLmNvcyhuKSpzLHk6aStNYXRoLnNpbihuKSpzLGFuZ2xlOm59fX1mdW5jdGlvbiBkYSh0KXtjb25zdHtjaGFydDplLGZpbGw6aSxsaW5lOnN9PXQ7aWYoYShpKSlyZXR1cm4gZnVuY3Rpb24odCxlKXtjb25zdCBpPXQuZ2V0RGF0YXNldE1ldGEoZSkscz1pJiZ0LmlzRGF0YXNldFZpc2libGUoZSk7cmV0dXJuIHM/aS5kYXRhc2V0Om51bGx9KGUsaSk7aWYoInN0YWNrIj09PWkpcmV0dXJuIGZ1bmN0aW9uKHQpe2NvbnN0e3NjYWxlOmUsaW5kZXg6aSxsaW5lOnN9PXQsbj1bXSxvPXMuc2VnbWVudHMsYT1zLnBvaW50cyxyPWZ1bmN0aW9uKHQsZSl7Y29uc3QgaT1bXSxzPXQuZ2V0TWF0Y2hpbmdWaXNpYmxlTWV0YXMoImxpbmUiKTtmb3IobGV0IHQ9MDt0PHMubGVuZ3RoO3QrKyl7Y29uc3Qgbj1zW3RdO2lmKG4uaW5kZXg9PT1lKWJyZWFrO24uaGlkZGVufHxpLnVuc2hpZnQobi5kYXRhc2V0KX1yZXR1cm4gaX0oZSxpKTtyLnB1c2gobmEoe3g6bnVsbCx5OmUuYm90dG9tfSxzKSk7Zm9yKGxldCB0PTA7dDxvLmxlbmd0aDt0Kyspe2NvbnN0IGU9b1t0XTtmb3IobGV0IHQ9ZS5zdGFydDt0PD1lLmVuZDt0KyspbGEobixhW3RdLHIpfXJldHVybiBuZXcgb28oe3BvaW50czpuLG9wdGlvbnM6e319KX0odCk7aWYoInNoYXBlIj09PWkpcmV0dXJuITA7Y29uc3Qgbj1mdW5jdGlvbih0KXtjb25zdCBlPXQuc2NhbGV8fHt9O2lmKGUuZ2V0UG9pbnRQb3NpdGlvbkZvclZhbHVlKXJldHVybiBmdW5jdGlvbih0KXtjb25zdHtzY2FsZTplLGZpbGw6aX09dCxzPWUub3B0aW9ucyxuPWUuZ2V0TGFiZWxzKCkubGVuZ3RoLGE9cy5yZXZlcnNlP2UubWF4OmUubWluLHI9ZnVuY3Rpb24odCxlLGkpe2xldCBzO3JldHVybiBzPSJzdGFydCI9PT10P2k6ImVuZCI9PT10P2Uub3B0aW9ucy5yZXZlcnNlP2UubWluOmUubWF4Om8odCk/dC52YWx1ZTplLmdldEJhc2VWYWx1ZSgpLHN9KGksZSxhKSxsPVtdO2lmKHMuZ3JpZC5jaXJjdWxhcil7Y29uc3QgdD1lLmdldFBvaW50UG9zaXRpb25Gb3JWYWx1ZSgwLGEpO3JldHVybiBuZXcgY2Eoe3g6dC54LHk6dC55LHJhZGl1czplLmdldERpc3RhbmNlRnJvbUNlbnRlckZvclZhbHVlKHIpfSl9Zm9yKGxldCB0PTA7dDxuOysrdClsLnB1c2goZS5nZXRQb2ludFBvc2l0aW9uRm9yVmFsdWUodCxyKSk7cmV0dXJuIGx9KHQpO3JldHVybiBmdW5jdGlvbih0KXtjb25zdHtzY2FsZTplPXt9LGZpbGw6aX09dCxzPWZ1bmN0aW9uKHQsZSl7bGV0IGk9bnVsbDtyZXR1cm4ic3RhcnQiPT09dD9pPWUuYm90dG9tOiJlbmQiPT09dD9pPWUudG9wOm8odCk/aT1lLmdldFBpeGVsRm9yVmFsdWUodC52YWx1ZSk6ZS5nZXRCYXNlUGl4ZWwmJihpPWUuZ2V0QmFzZVBpeGVsKCkpLGl9KGksZSk7aWYoYShzKSl7Y29uc3QgdD1lLmlzSG9yaXpvbnRhbCgpO3JldHVybnt4OnQ/czpudWxsLHk6dD9udWxsOnN9fXJldHVybiBudWxsfSh0KX0odCk7cmV0dXJuIG4gaW5zdGFuY2VvZiBjYT9uOm5hKG4scyl9ZnVuY3Rpb24gdWEodCxlLGkpe2NvbnN0IHM9ZGEoZSkse2NoYXJ0Om4saW5kZXg6byxsaW5lOmEsc2NhbGU6cixheGlzOmx9PWUsaD1hLm9wdGlvbnMsYz1oLmZpbGwsZD1oLmJhY2tncm91bmRDb2xvcix7YWJvdmU6dT1kLGJlbG93OmY9ZH09Y3x8e30sZz1uLmdldERhdGFzZXRNZXRhKG8pLHA9TmkobixnKTtzJiZhLnBvaW50cy5sZW5ndGgmJihJZSh0LGkpLGZ1bmN0aW9uKHQsZSl7Y29uc3R7bGluZTppLHRhcmdldDpzLGFib3ZlOm4sYmVsb3c6byxhcmVhOmEsc2NhbGU6cixjbGlwOmx9PWUsaD1pLl9sb29wPyJhbmdsZSI6ZS5heGlzO3Quc2F2ZSgpO2xldCBjPW87byE9PW4mJigieCI9PT1oPyhmYSh0LHMsYS50b3ApLHBhKHQse2xpbmU6aSx0YXJnZXQ6cyxjb2xvcjpuLHNjYWxlOnIscHJvcGVydHk6aCxjbGlwOmx9KSx0LnJlc3RvcmUoKSx0LnNhdmUoKSxmYSh0LHMsYS5ib3R0b20pKToieSI9PT1oJiYoZ2EodCxzLGEubGVmdCkscGEodCx7bGluZTppLHRhcmdldDpzLGNvbG9yOm8sc2NhbGU6cixwcm9wZXJ0eTpoLGNsaXA6bH0pLHQucmVzdG9yZSgpLHQuc2F2ZSgpLGdhKHQscyxhLnJpZ2h0KSxjPW4pKTtwYSh0LHtsaW5lOmksdGFyZ2V0OnMsY29sb3I6YyxzY2FsZTpyLHByb3BlcnR5OmgsY2xpcDpsfSksdC5yZXN0b3JlKCl9KHQse2xpbmU6YSx0YXJnZXQ6cyxhYm92ZTp1LGJlbG93OmYsYXJlYTppLHNjYWxlOnIsYXhpczpsLGNsaXA6cH0pLHplKHQpKX1mdW5jdGlvbiBmYSh0LGUsaSl7Y29uc3R7c2VnbWVudHM6cyxwb2ludHM6bn09ZTtsZXQgbz0hMCxhPSExO3QuYmVnaW5QYXRoKCk7Zm9yKGNvbnN0IHIgb2Ygcyl7Y29uc3R7c3RhcnQ6cyxlbmQ6bH09cixoPW5bc10sYz1uW2lhKHMsbCxuKV07bz8odC5tb3ZlVG8oaC54LGgueSksbz0hMSk6KHQubGluZVRvKGgueCxpKSx0LmxpbmVUbyhoLngsaC55KSksYT0hIWUucGF0aFNlZ21lbnQodCxyLHttb3ZlOmF9KSxhP3QuY2xvc2VQYXRoKCk6dC5saW5lVG8oYy54LGkpfXQubGluZVRvKGUuZmlyc3QoKS54LGkpLHQuY2xvc2VQYXRoKCksdC5jbGlwKCl9ZnVuY3Rpb24gZ2EodCxlLGkpe2NvbnN0e3NlZ21lbnRzOnMscG9pbnRzOm59PWU7bGV0IG89ITAsYT0hMTt0LmJlZ2luUGF0aCgpO2Zvcihjb25zdCByIG9mIHMpe2NvbnN0e3N0YXJ0OnMsZW5kOmx9PXIsaD1uW3NdLGM9bltpYShzLGwsbildO28/KHQubW92ZVRvKGgueCxoLnkpLG89ITEpOih0LmxpbmVUbyhpLGgueSksdC5saW5lVG8oaC54LGgueSkpLGE9ISFlLnBhdGhTZWdtZW50KHQscix7bW92ZTphfSksYT90LmNsb3NlUGF0aCgpOnQubGluZVRvKGksYy55KX10LmxpbmVUbyhpLGUuZmlyc3QoKS55KSx0LmNsb3NlUGF0aCgpLHQuY2xpcCgpfWZ1bmN0aW9uIHBhKHQsZSl7Y29uc3R7bGluZTppLHRhcmdldDpzLHByb3BlcnR5Om4sY29sb3I6byxzY2FsZTphLGNsaXA6cn09ZSxsPWZ1bmN0aW9uKHQsZSxpKXtjb25zdCBzPXQuc2VnbWVudHMsbj10LnBvaW50cyxvPWUucG9pbnRzLGE9W107Zm9yKGNvbnN0IHQgb2Ygcyl7bGV0e3N0YXJ0OnMsZW5kOnJ9PXQ7cj1pYShzLHIsbik7Y29uc3QgbD1lYShpLG5bc10sbltyXSx0Lmxvb3ApO2lmKCFlLnNlZ21lbnRzKXthLnB1c2goe3NvdXJjZTp0LHRhcmdldDpsLHN0YXJ0Om5bc10sZW5kOm5bcl19KTtjb250aW51ZX1jb25zdCBoPUlpKGUsbCk7Zm9yKGNvbnN0IGUgb2YgaCl7Y29uc3Qgcz1lYShpLG9bZS5zdGFydF0sb1tlLmVuZF0sZS5sb29wKSxyPVJpKHQsbixzKTtmb3IoY29uc3QgdCBvZiByKWEucHVzaCh7c291cmNlOnQsdGFyZ2V0OmUsc3RhcnQ6e1tpXTpzYShsLHMsInN0YXJ0IixNYXRoLm1heCl9LGVuZDp7W2ldOnNhKGwscywiZW5kIixNYXRoLm1pbil9fSl9fXJldHVybiBhfShpLHMsbik7Zm9yKGNvbnN0e3NvdXJjZTplLHRhcmdldDpoLHN0YXJ0OmMsZW5kOmR9b2YgbCl7Y29uc3R7c3R5bGU6e2JhY2tncm91bmRDb2xvcjpsPW99PXt9fT1lLHU9ITAhPT1zO3Quc2F2ZSgpLHQuZmlsbFN0eWxlPWwsbWEodCxhLHIsdSYmZWEobixjLGQpKSx0LmJlZ2luUGF0aCgpO2NvbnN0IGY9ISFpLnBhdGhTZWdtZW50KHQsZSk7bGV0IGc7aWYodSl7Zj90LmNsb3NlUGF0aCgpOnhhKHQscyxkLG4pO2NvbnN0IGU9ISFzLnBhdGhTZWdtZW50KHQsaCx7bW92ZTpmLHJldmVyc2U6ITB9KTtnPWYmJmUsZ3x8eGEodCxzLGMsbil9dC5jbG9zZVBhdGgoKSx0LmZpbGwoZz8iZXZlbm9kZCI6Im5vbnplcm8iKSx0LnJlc3RvcmUoKX19ZnVuY3Rpb24gbWEodCxlLGkscyl7Y29uc3Qgbj1lLmNoYXJ0LmNoYXJ0QXJlYSx7cHJvcGVydHk6byxzdGFydDphLGVuZDpyfT1zfHx7fTtpZigieCI9PT1vfHwieSI9PT1vKXtsZXQgZSxzLGwsaDsieCI9PT1vPyhlPWEscz1uLnRvcCxsPXIsaD1uLmJvdHRvbSk6KGU9bi5sZWZ0LHM9YSxsPW4ucmlnaHQsaD1yKSx0LmJlZ2luUGF0aCgpLGkmJihlPU1hdGgubWF4KGUsaS5sZWZ0KSxsPU1hdGgubWluKGwsaS5yaWdodCkscz1NYXRoLm1heChzLGkudG9wKSxoPU1hdGgubWluKGgsaS5ib3R0b20pKSx0LnJlY3QoZSxzLGwtZSxoLXMpLHQuY2xpcCgpfX1mdW5jdGlvbiB4YSh0LGUsaSxzKXtjb25zdCBuPWUuaW50ZXJwb2xhdGUoaSxzKTtuJiZ0LmxpbmVUbyhuLngsbi55KX12YXIgYmE9e2lkOiJmaWxsZXIiLGFmdGVyRGF0YXNldHNVcGRhdGUodCxlLGkpe2NvbnN0IHM9KHQuZGF0YS5kYXRhc2V0c3x8W10pLmxlbmd0aCxuPVtdO2xldCBvLGEscixsO2ZvcihhPTA7YTxzOysrYSlvPXQuZ2V0RGF0YXNldE1ldGEoYSkscj1vLmRhdGFzZXQsbD1udWxsLHImJnIub3B0aW9ucyYmciBpbnN0YW5jZW9mIG9vJiYobD17dmlzaWJsZTp0LmlzRGF0YXNldFZpc2libGUoYSksaW5kZXg6YSxmaWxsOnJhKHIsYSxzKSxjaGFydDp0LGF4aXM6by5jb250cm9sbGVyLm9wdGlvbnMuaW5kZXhBeGlzLHNjYWxlOm8udlNjYWxlLGxpbmU6cn0pLG8uJGZpbGxlcj1sLG4ucHVzaChsKTtmb3IoYT0wO2E8czsrK2EpbD1uW2FdLGwmJiExIT09bC5maWxsJiYobC5maWxsPWFhKG4sYSxpLnByb3BhZ2F0ZSkpfSxiZWZvcmVEcmF3KHQsZSxpKXtjb25zdCBzPSJiZWZvcmVEcmF3Ij09PWkuZHJhd1RpbWUsbj10LmdldFNvcnRlZFZpc2libGVEYXRhc2V0TWV0YXMoKSxvPXQuY2hhcnRBcmVhO2ZvcihsZXQgZT1uLmxlbmd0aC0xO2U+PTA7LS1lKXtjb25zdCBpPW5bZV0uJGZpbGxlcjtpJiYoaS5saW5lLnVwZGF0ZUNvbnRyb2xQb2ludHMobyxpLmF4aXMpLHMmJmkuZmlsbCYmdWEodC5jdHgsaSxvKSl9fSxiZWZvcmVEYXRhc2V0c0RyYXcodCxlLGkpe2lmKCJiZWZvcmVEYXRhc2V0c0RyYXciIT09aS5kcmF3VGltZSlyZXR1cm47Y29uc3Qgcz10LmdldFNvcnRlZFZpc2libGVEYXRhc2V0TWV0YXMoKTtmb3IobGV0IGU9cy5sZW5ndGgtMTtlPj0wOy0tZSl7Y29uc3QgaT1zW2VdLiRmaWxsZXI7b2EoaSkmJnVhKHQuY3R4LGksdC5jaGFydEFyZWEpfX0sYmVmb3JlRGF0YXNldERyYXcodCxlLGkpe2NvbnN0IHM9ZS5tZXRhLiRmaWxsZXI7b2EocykmJiJiZWZvcmVEYXRhc2V0RHJhdyI9PT1pLmRyYXdUaW1lJiZ1YSh0LmN0eCxzLHQuY2hhcnRBcmVhKX0sZGVmYXVsdHM6e3Byb3BhZ2F0ZTohMCxkcmF3VGltZToiYmVmb3JlRGF0YXNldERyYXcifX07Y29uc3QgX2E9KHQsZSk9PntsZXR7Ym94SGVpZ2h0Omk9ZSxib3hXaWR0aDpzPWV9PXQ7cmV0dXJuIHQudXNlUG9pbnRTdHlsZSYmKGk9TWF0aC5taW4oaSxlKSxzPXQucG9pbnRTdHlsZVdpZHRofHxNYXRoLm1pbihzLGUpKSx7Ym94V2lkdGg6cyxib3hIZWlnaHQ6aSxpdGVtSGVpZ2h0Ok1hdGgubWF4KGUsaSl9fTtjbGFzcyB5YSBleHRlbmRzICRze2NvbnN0cnVjdG9yKHQpe3N1cGVyKCksdGhpcy5fYWRkZWQ9ITEsdGhpcy5sZWdlbmRIaXRCb3hlcz1bXSx0aGlzLl9ob3ZlcmVkSXRlbT1udWxsLHRoaXMuZG91Z2hudXRNb2RlPSExLHRoaXMuY2hhcnQ9dC5jaGFydCx0aGlzLm9wdGlvbnM9dC5vcHRpb25zLHRoaXMuY3R4PXQuY3R4LHRoaXMubGVnZW5kSXRlbXM9dm9pZCAwLHRoaXMuY29sdW1uU2l6ZXM9dm9pZCAwLHRoaXMubGluZVdpZHRocz12b2lkIDAsdGhpcy5tYXhIZWlnaHQ9dm9pZCAwLHRoaXMubWF4V2lkdGg9dm9pZCAwLHRoaXMudG9wPXZvaWQgMCx0aGlzLmJvdHRvbT12b2lkIDAsdGhpcy5sZWZ0PXZvaWQgMCx0aGlzLnJpZ2h0PXZvaWQgMCx0aGlzLmhlaWdodD12b2lkIDAsdGhpcy53aWR0aD12b2lkIDAsdGhpcy5fbWFyZ2lucz12b2lkIDAsdGhpcy5wb3NpdGlvbj12b2lkIDAsdGhpcy53ZWlnaHQ9dm9pZCAwLHRoaXMuZnVsbFNpemU9dm9pZCAwfXVwZGF0ZSh0LGUsaSl7dGhpcy5tYXhXaWR0aD10LHRoaXMubWF4SGVpZ2h0PWUsdGhpcy5fbWFyZ2lucz1pLHRoaXMuc2V0RGltZW5zaW9ucygpLHRoaXMuYnVpbGRMYWJlbHMoKSx0aGlzLmZpdCgpfXNldERpbWVuc2lvbnMoKXt0aGlzLmlzSG9yaXpvbnRhbCgpPyh0aGlzLndpZHRoPXRoaXMubWF4V2lkdGgsdGhpcy5sZWZ0PXRoaXMuX21hcmdpbnMubGVmdCx0aGlzLnJpZ2h0PXRoaXMud2lkdGgpOih0aGlzLmhlaWdodD10aGlzLm1heEhlaWdodCx0aGlzLnRvcD10aGlzLl9tYXJnaW5zLnRvcCx0aGlzLmJvdHRvbT10aGlzLmhlaWdodCl9YnVpbGRMYWJlbHMoKXtjb25zdCB0PXRoaXMub3B0aW9ucy5sYWJlbHN8fHt9O2xldCBlPWQodC5nZW5lcmF0ZUxhYmVscyxbdGhpcy5jaGFydF0sdGhpcyl8fFtdO3QuZmlsdGVyJiYoZT1lLmZpbHRlcigoZT0+dC5maWx0ZXIoZSx0aGlzLmNoYXJ0LmRhdGEpKSkpLHQuc29ydCYmKGU9ZS5zb3J0KCgoZSxpKT0+dC5zb3J0KGUsaSx0aGlzLmNoYXJ0LmRhdGEpKSkpLHRoaXMub3B0aW9ucy5yZXZlcnNlJiZlLnJldmVyc2UoKSx0aGlzLmxlZ2VuZEl0ZW1zPWV9Zml0KCl7Y29uc3R7b3B0aW9uczp0LGN0eDplfT10aGlzO2lmKCF0LmRpc3BsYXkpcmV0dXJuIHZvaWQodGhpcy53aWR0aD10aGlzLmhlaWdodD0wKTtjb25zdCBpPXQubGFiZWxzLHM9U2koaS5mb250KSxuPXMuc2l6ZSxvPXRoaXMuX2NvbXB1dGVUaXRsZUhlaWdodCgpLHtib3hXaWR0aDphLGl0ZW1IZWlnaHQ6cn09X2EoaSxuKTtsZXQgbCxoO2UuZm9udD1zLnN0cmluZyx0aGlzLmlzSG9yaXpvbnRhbCgpPyhsPXRoaXMubWF4V2lkdGgsaD10aGlzLl9maXRSb3dzKG8sbixhLHIpKzEwKTooaD10aGlzLm1heEhlaWdodCxsPXRoaXMuX2ZpdENvbHMobyxzLGEscikrMTApLHRoaXMud2lkdGg9TWF0aC5taW4obCx0Lm1heFdpZHRofHx0aGlzLm1heFdpZHRoKSx0aGlzLmhlaWdodD1NYXRoLm1pbihoLHQubWF4SGVpZ2h0fHx0aGlzLm1heEhlaWdodCl9X2ZpdFJvd3ModCxlLGkscyl7Y29uc3R7Y3R4Om4sbWF4V2lkdGg6byxvcHRpb25zOntsYWJlbHM6e3BhZGRpbmc6YX19fT10aGlzLHI9dGhpcy5sZWdlbmRIaXRCb3hlcz1bXSxsPXRoaXMubGluZVdpZHRocz1bMF0saD1zK2E7bGV0IGM9dDtuLnRleHRBbGlnbj0ibGVmdCIsbi50ZXh0QmFzZWxpbmU9Im1pZGRsZSI7bGV0IGQ9LTEsdT0taDtyZXR1cm4gdGhpcy5sZWdlbmRJdGVtcy5mb3JFYWNoKCgodCxmKT0+e2NvbnN0IGc9aStlLzIrbi5tZWFzdXJlVGV4dCh0LnRleHQpLndpZHRoOygwPT09Znx8bFtsLmxlbmd0aC0xXStnKzIqYT5vKSYmKGMrPWgsbFtsLmxlbmd0aC0oZj4wPzA6MSldPTAsdSs9aCxkKyspLHJbZl09e2xlZnQ6MCx0b3A6dSxyb3c6ZCx3aWR0aDpnLGhlaWdodDpzfSxsW2wubGVuZ3RoLTFdKz1nK2F9KSksY31fZml0Q29scyh0LGUsaSxzKXtjb25zdHtjdHg6bixtYXhIZWlnaHQ6byxvcHRpb25zOntsYWJlbHM6e3BhZGRpbmc6YX19fT10aGlzLHI9dGhpcy5sZWdlbmRIaXRCb3hlcz1bXSxsPXRoaXMuY29sdW1uU2l6ZXM9W10saD1vLXQ7bGV0IGM9YSxkPTAsdT0wLGY9MCxnPTA7cmV0dXJuIHRoaXMubGVnZW5kSXRlbXMuZm9yRWFjaCgoKHQsbyk9Pntjb25zdHtpdGVtV2lkdGg6cCxpdGVtSGVpZ2h0Om19PWZ1bmN0aW9uKHQsZSxpLHMsbil7Y29uc3Qgbz1mdW5jdGlvbih0LGUsaSxzKXtsZXQgbj10LnRleHQ7biYmInN0cmluZyIhPXR5cGVvZiBuJiYobj1uLnJlZHVjZSgoKHQsZSk9PnQubGVuZ3RoPmUubGVuZ3RoP3Q6ZSkpKTtyZXR1cm4gZStpLnNpemUvMitzLm1lYXN1cmVUZXh0KG4pLndpZHRofShzLHQsZSxpKSxhPWZ1bmN0aW9uKHQsZSxpKXtsZXQgcz10OyJzdHJpbmciIT10eXBlb2YgZS50ZXh0JiYocz12YShlLGkpKTtyZXR1cm4gc30obixzLGUubGluZUhlaWdodCk7cmV0dXJue2l0ZW1XaWR0aDpvLGl0ZW1IZWlnaHQ6YX19KGksZSxuLHQscyk7bz4wJiZ1K20rMiphPmgmJihjKz1kK2EsbC5wdXNoKHt3aWR0aDpkLGhlaWdodDp1fSksZis9ZCthLGcrKyxkPXU9MCkscltvXT17bGVmdDpmLHRvcDp1LGNvbDpnLHdpZHRoOnAsaGVpZ2h0Om19LGQ9TWF0aC5tYXgoZCxwKSx1Kz1tK2F9KSksYys9ZCxsLnB1c2goe3dpZHRoOmQsaGVpZ2h0OnV9KSxjfWFkanVzdEhpdEJveGVzKCl7aWYoIXRoaXMub3B0aW9ucy5kaXNwbGF5KXJldHVybjtjb25zdCB0PXRoaXMuX2NvbXB1dGVUaXRsZUhlaWdodCgpLHtsZWdlbmRIaXRCb3hlczplLG9wdGlvbnM6e2FsaWduOmksbGFiZWxzOntwYWRkaW5nOnN9LHJ0bDpufX09dGhpcyxvPU9pKG4sdGhpcy5sZWZ0LHRoaXMud2lkdGgpO2lmKHRoaXMuaXNIb3Jpem9udGFsKCkpe2xldCBuPTAsYT1mdChpLHRoaXMubGVmdCtzLHRoaXMucmlnaHQtdGhpcy5saW5lV2lkdGhzW25dKTtmb3IoY29uc3QgciBvZiBlKW4hPT1yLnJvdyYmKG49ci5yb3csYT1mdChpLHRoaXMubGVmdCtzLHRoaXMucmlnaHQtdGhpcy5saW5lV2lkdGhzW25dKSksci50b3ArPXRoaXMudG9wK3QrcyxyLmxlZnQ9by5sZWZ0Rm9yTHRyKG8ueChhKSxyLndpZHRoKSxhKz1yLndpZHRoK3N9ZWxzZXtsZXQgbj0wLGE9ZnQoaSx0aGlzLnRvcCt0K3MsdGhpcy5ib3R0b20tdGhpcy5jb2x1bW5TaXplc1tuXS5oZWlnaHQpO2Zvcihjb25zdCByIG9mIGUpci5jb2whPT1uJiYobj1yLmNvbCxhPWZ0KGksdGhpcy50b3ArdCtzLHRoaXMuYm90dG9tLXRoaXMuY29sdW1uU2l6ZXNbbl0uaGVpZ2h0KSksci50b3A9YSxyLmxlZnQrPXRoaXMubGVmdCtzLHIubGVmdD1vLmxlZnRGb3JMdHIoby54KHIubGVmdCksci53aWR0aCksYSs9ci5oZWlnaHQrc319aXNIb3Jpem9udGFsKCl7cmV0dXJuInRvcCI9PT10aGlzLm9wdGlvbnMucG9zaXRpb258fCJib3R0b20iPT09dGhpcy5vcHRpb25zLnBvc2l0aW9ufWRyYXcoKXtpZih0aGlzLm9wdGlvbnMuZGlzcGxheSl7Y29uc3QgdD10aGlzLmN0eDtJZSh0LHRoaXMpLHRoaXMuX2RyYXcoKSx6ZSh0KX19X2RyYXcoKXtjb25zdHtvcHRpb25zOnQsY29sdW1uU2l6ZXM6ZSxsaW5lV2lkdGhzOmksY3R4OnN9PXRoaXMse2FsaWduOm4sbGFiZWxzOm99PXQsYT11ZS5jb2xvcixyPU9pKHQucnRsLHRoaXMubGVmdCx0aGlzLndpZHRoKSxoPVNpKG8uZm9udCkse3BhZGRpbmc6Y309byxkPWguc2l6ZSx1PWQvMjtsZXQgZjt0aGlzLmRyYXdUaXRsZSgpLHMudGV4dEFsaWduPXIudGV4dEFsaWduKCJsZWZ0Iikscy50ZXh0QmFzZWxpbmU9Im1pZGRsZSIscy5saW5lV2lkdGg9LjUscy5mb250PWguc3RyaW5nO2NvbnN0e2JveFdpZHRoOmcsYm94SGVpZ2h0OnAsaXRlbUhlaWdodDptfT1fYShvLGQpLHg9dGhpcy5pc0hvcml6b250YWwoKSxiPXRoaXMuX2NvbXB1dGVUaXRsZUhlaWdodCgpO2Y9eD97eDpmdChuLHRoaXMubGVmdCtjLHRoaXMucmlnaHQtaVswXSkseTp0aGlzLnRvcCtjK2IsbGluZTowfTp7eDp0aGlzLmxlZnQrYyx5OmZ0KG4sdGhpcy50b3ArYitjLHRoaXMuYm90dG9tLWVbMF0uaGVpZ2h0KSxsaW5lOjB9LEFpKHRoaXMuY3R4LHQudGV4dERpcmVjdGlvbik7Y29uc3QgXz1tK2M7dGhpcy5sZWdlbmRJdGVtcy5mb3JFYWNoKCgoeSx2KT0+e3Muc3Ryb2tlU3R5bGU9eS5mb250Q29sb3Iscy5maWxsU3R5bGU9eS5mb250Q29sb3I7Y29uc3QgTT1zLm1lYXN1cmVUZXh0KHkudGV4dCkud2lkdGgsdz1yLnRleHRBbGlnbih5LnRleHRBbGlnbnx8KHkudGV4dEFsaWduPW8udGV4dEFsaWduKSksaz1nK3UrTTtsZXQgUz1mLngsUD1mLnk7ci5zZXRXaWR0aCh0aGlzLndpZHRoKSx4P3Y+MCYmUytrK2M+dGhpcy5yaWdodCYmKFA9Zi55Kz1fLGYubGluZSsrLFM9Zi54PWZ0KG4sdGhpcy5sZWZ0K2MsdGhpcy5yaWdodC1pW2YubGluZV0pKTp2PjAmJlArXz50aGlzLmJvdHRvbSYmKFM9Zi54PVMrZVtmLmxpbmVdLndpZHRoK2MsZi5saW5lKyssUD1mLnk9ZnQobix0aGlzLnRvcCtiK2MsdGhpcy5ib3R0b20tZVtmLmxpbmVdLmhlaWdodCkpO2lmKGZ1bmN0aW9uKHQsZSxpKXtpZihpc05hTihnKXx8Zzw9MHx8aXNOYU4ocCl8fHA8MClyZXR1cm47cy5zYXZlKCk7Y29uc3Qgbj1sKGkubGluZVdpZHRoLDEpO2lmKHMuZmlsbFN0eWxlPWwoaS5maWxsU3R5bGUsYSkscy5saW5lQ2FwPWwoaS5saW5lQ2FwLCJidXR0Iikscy5saW5lRGFzaE9mZnNldD1sKGkubGluZURhc2hPZmZzZXQsMCkscy5saW5lSm9pbj1sKGkubGluZUpvaW4sIm1pdGVyIikscy5saW5lV2lkdGg9bixzLnN0cm9rZVN0eWxlPWwoaS5zdHJva2VTdHlsZSxhKSxzLnNldExpbmVEYXNoKGwoaS5saW5lRGFzaCxbXSkpLG8udXNlUG9pbnRTdHlsZSl7Y29uc3QgYT17cmFkaXVzOnAqTWF0aC5TUVJUMi8yLHBvaW50U3R5bGU6aS5wb2ludFN0eWxlLHJvdGF0aW9uOmkucm90YXRpb24sYm9yZGVyV2lkdGg6bn0sbD1yLnhQbHVzKHQsZy8yKTtFZShzLGEsbCxlK3Usby5wb2ludFN0eWxlV2lkdGgmJmcpfWVsc2V7Y29uc3Qgbz1lK01hdGgubWF4KChkLXApLzIsMCksYT1yLmxlZnRGb3JMdHIodCxnKSxsPXdpKGkuYm9yZGVyUmFkaXVzKTtzLmJlZ2luUGF0aCgpLE9iamVjdC52YWx1ZXMobCkuc29tZSgodD0+MCE9PXQpKT9IZShzLHt4OmEseTpvLHc6ZyxoOnAscmFkaXVzOmx9KTpzLnJlY3QoYSxvLGcscCkscy5maWxsKCksMCE9PW4mJnMuc3Ryb2tlKCl9cy5yZXN0b3JlKCl9KHIueChTKSxQLHkpLFM9Z3QodyxTK2crdSx4P1Mrazp0aGlzLnJpZ2h0LHQucnRsKSxmdW5jdGlvbih0LGUsaSl7TmUocyxpLnRleHQsdCxlK20vMixoLHtzdHJpa2V0aHJvdWdoOmkuaGlkZGVuLHRleHRBbGlnbjpyLnRleHRBbGlnbihpLnRleHRBbGlnbil9KX0oci54KFMpLFAseSkseClmLngrPWsrYztlbHNlIGlmKCJzdHJpbmciIT10eXBlb2YgeS50ZXh0KXtjb25zdCB0PWgubGluZUhlaWdodDtmLnkrPXZhKHksdCkrY31lbHNlIGYueSs9X30pKSxUaSh0aGlzLmN0eCx0LnRleHREaXJlY3Rpb24pfWRyYXdUaXRsZSgpe2NvbnN0IHQ9dGhpcy5vcHRpb25zLGU9dC50aXRsZSxpPVNpKGUuZm9udCkscz1raShlLnBhZGRpbmcpO2lmKCFlLmRpc3BsYXkpcmV0dXJuO2NvbnN0IG49T2kodC5ydGwsdGhpcy5sZWZ0LHRoaXMud2lkdGgpLG89dGhpcy5jdHgsYT1lLnBvc2l0aW9uLHI9aS5zaXplLzIsbD1zLnRvcCtyO2xldCBoLGM9dGhpcy5sZWZ0LGQ9dGhpcy53aWR0aDtpZih0aGlzLmlzSG9yaXpvbnRhbCgpKWQ9TWF0aC5tYXgoLi4udGhpcy5saW5lV2lkdGhzKSxoPXRoaXMudG9wK2wsYz1mdCh0LmFsaWduLGMsdGhpcy5yaWdodC1kKTtlbHNle2NvbnN0IGU9dGhpcy5jb2x1bW5TaXplcy5yZWR1Y2UoKCh0LGUpPT5NYXRoLm1heCh0LGUuaGVpZ2h0KSksMCk7aD1sK2Z0KHQuYWxpZ24sdGhpcy50b3AsdGhpcy5ib3R0b20tZS10LmxhYmVscy5wYWRkaW5nLXRoaXMuX2NvbXB1dGVUaXRsZUhlaWdodCgpKX1jb25zdCB1PWZ0KGEsYyxjK2QpO28udGV4dEFsaWduPW4udGV4dEFsaWduKHV0KGEpKSxvLnRleHRCYXNlbGluZT0ibWlkZGxlIixvLnN0cm9rZVN0eWxlPWUuY29sb3Isby5maWxsU3R5bGU9ZS5jb2xvcixvLmZvbnQ9aS5zdHJpbmcsTmUobyxlLnRleHQsdSxoLGkpfV9jb21wdXRlVGl0bGVIZWlnaHQoKXtjb25zdCB0PXRoaXMub3B0aW9ucy50aXRsZSxlPVNpKHQuZm9udCksaT1raSh0LnBhZGRpbmcpO3JldHVybiB0LmRpc3BsYXk/ZS5saW5lSGVpZ2h0K2kuaGVpZ2h0OjB9X2dldExlZ2VuZEl0ZW1BdCh0LGUpe2xldCBpLHMsbjtpZih0dCh0LHRoaXMubGVmdCx0aGlzLnJpZ2h0KSYmdHQoZSx0aGlzLnRvcCx0aGlzLmJvdHRvbSkpZm9yKG49dGhpcy5sZWdlbmRIaXRCb3hlcyxpPTA7aTxuLmxlbmd0aDsrK2kpaWYocz1uW2ldLHR0KHQscy5sZWZ0LHMubGVmdCtzLndpZHRoKSYmdHQoZSxzLnRvcCxzLnRvcCtzLmhlaWdodCkpcmV0dXJuIHRoaXMubGVnZW5kSXRlbXNbaV07cmV0dXJuIG51bGx9aGFuZGxlRXZlbnQodCl7Y29uc3QgZT10aGlzLm9wdGlvbnM7aWYoIWZ1bmN0aW9uKHQsZSl7aWYoKCJtb3VzZW1vdmUiPT09dHx8Im1vdXNlb3V0Ij09PXQpJiYoZS5vbkhvdmVyfHxlLm9uTGVhdmUpKXJldHVybiEwO2lmKGUub25DbGljayYmKCJjbGljayI9PT10fHwibW91c2V1cCI9PT10KSlyZXR1cm4hMDtyZXR1cm4hMX0odC50eXBlLGUpKXJldHVybjtjb25zdCBpPXRoaXMuX2dldExlZ2VuZEl0ZW1BdCh0LngsdC55KTtpZigibW91c2Vtb3ZlIj09PXQudHlwZXx8Im1vdXNlb3V0Ij09PXQudHlwZSl7Y29uc3Qgbz10aGlzLl9ob3ZlcmVkSXRlbSxhPShuPWksbnVsbCE9PShzPW8pJiZudWxsIT09biYmcy5kYXRhc2V0SW5kZXg9PT1uLmRhdGFzZXRJbmRleCYmcy5pbmRleD09PW4uaW5kZXgpO28mJiFhJiZkKGUub25MZWF2ZSxbdCxvLHRoaXNdLHRoaXMpLHRoaXMuX2hvdmVyZWRJdGVtPWksaSYmIWEmJmQoZS5vbkhvdmVyLFt0LGksdGhpc10sdGhpcyl9ZWxzZSBpJiZkKGUub25DbGljayxbdCxpLHRoaXNdLHRoaXMpO3ZhciBzLG59fWZ1bmN0aW9uIHZhKHQsZSl7cmV0dXJuIGUqKHQudGV4dD90LnRleHQubGVuZ3RoOjApfXZhciBNYT17aWQ6ImxlZ2VuZCIsX2VsZW1lbnQ6eWEsc3RhcnQodCxlLGkpe2NvbnN0IHM9dC5sZWdlbmQ9bmV3IHlhKHtjdHg6dC5jdHgsb3B0aW9uczppLGNoYXJ0OnR9KTtscy5jb25maWd1cmUodCxzLGkpLGxzLmFkZEJveCh0LHMpfSxzdG9wKHQpe2xzLnJlbW92ZUJveCh0LHQubGVnZW5kKSxkZWxldGUgdC5sZWdlbmR9LGJlZm9yZVVwZGF0ZSh0LGUsaSl7Y29uc3Qgcz10LmxlZ2VuZDtscy5jb25maWd1cmUodCxzLGkpLHMub3B0aW9ucz1pfSxhZnRlclVwZGF0ZSh0KXtjb25zdCBlPXQubGVnZW5kO2UuYnVpbGRMYWJlbHMoKSxlLmFkanVzdEhpdEJveGVzKCl9LGFmdGVyRXZlbnQodCxlKXtlLnJlcGxheXx8dC5sZWdlbmQuaGFuZGxlRXZlbnQoZS5ldmVudCl9LGRlZmF1bHRzOntkaXNwbGF5OiEwLHBvc2l0aW9uOiJ0b3AiLGFsaWduOiJjZW50ZXIiLGZ1bGxTaXplOiEwLHJldmVyc2U6ITEsd2VpZ2h0OjFlMyxvbkNsaWNrKHQsZSxpKXtjb25zdCBzPWUuZGF0YXNldEluZGV4LG49aS5jaGFydDtuLmlzRGF0YXNldFZpc2libGUocyk/KG4uaGlkZShzKSxlLmhpZGRlbj0hMCk6KG4uc2hvdyhzKSxlLmhpZGRlbj0hMSl9LG9uSG92ZXI6bnVsbCxvbkxlYXZlOm51bGwsbGFiZWxzOntjb2xvcjp0PT50LmNoYXJ0Lm9wdGlvbnMuY29sb3IsYm94V2lkdGg6NDAscGFkZGluZzoxMCxnZW5lcmF0ZUxhYmVscyh0KXtjb25zdCBlPXQuZGF0YS5kYXRhc2V0cyx7bGFiZWxzOnt1c2VQb2ludFN0eWxlOmkscG9pbnRTdHlsZTpzLHRleHRBbGlnbjpuLGNvbG9yOm8sdXNlQm9yZGVyUmFkaXVzOmEsYm9yZGVyUmFkaXVzOnJ9fT10LmxlZ2VuZC5vcHRpb25zO3JldHVybiB0Ll9nZXRTb3J0ZWREYXRhc2V0TWV0YXMoKS5tYXAoKHQ9Pntjb25zdCBsPXQuY29udHJvbGxlci5nZXRTdHlsZShpPzA6dm9pZCAwKSxoPWtpKGwuYm9yZGVyV2lkdGgpO3JldHVybnt0ZXh0OmVbdC5pbmRleF0ubGFiZWwsZmlsbFN0eWxlOmwuYmFja2dyb3VuZENvbG9yLGZvbnRDb2xvcjpvLGhpZGRlbjohdC52aXNpYmxlLGxpbmVDYXA6bC5ib3JkZXJDYXBTdHlsZSxsaW5lRGFzaDpsLmJvcmRlckRhc2gsbGluZURhc2hPZmZzZXQ6bC5ib3JkZXJEYXNoT2Zmc2V0LGxpbmVKb2luOmwuYm9yZGVySm9pblN0eWxlLGxpbmVXaWR0aDooaC53aWR0aCtoLmhlaWdodCkvNCxzdHJva2VTdHlsZTpsLmJvcmRlckNvbG9yLHBvaW50U3R5bGU6c3x8bC5wb2ludFN0eWxlLHJvdGF0aW9uOmwucm90YXRpb24sdGV4dEFsaWduOm58fGwudGV4dEFsaWduLGJvcmRlclJhZGl1czphJiYocnx8bC5ib3JkZXJSYWRpdXMpLGRhdGFzZXRJbmRleDp0LmluZGV4fX0pLHRoaXMpfX0sdGl0bGU6e2NvbG9yOnQ9PnQuY2hhcnQub3B0aW9ucy5jb2xvcixkaXNwbGF5OiExLHBvc2l0aW9uOiJjZW50ZXIiLHRleHQ6IiJ9fSxkZXNjcmlwdG9yczp7X3NjcmlwdGFibGU6dD0+IXQuc3RhcnRzV2l0aCgib24iKSxsYWJlbHM6e19zY3JpcHRhYmxlOnQ9PiFbImdlbmVyYXRlTGFiZWxzIiwiZmlsdGVyIiwic29ydCJdLmluY2x1ZGVzKHQpfX19O2NsYXNzIHdhIGV4dGVuZHMgJHN7Y29uc3RydWN0b3IodCl7c3VwZXIoKSx0aGlzLmNoYXJ0PXQuY2hhcnQsdGhpcy5vcHRpb25zPXQub3B0aW9ucyx0aGlzLmN0eD10LmN0eCx0aGlzLl9wYWRkaW5nPXZvaWQgMCx0aGlzLnRvcD12b2lkIDAsdGhpcy5ib3R0b209dm9pZCAwLHRoaXMubGVmdD12b2lkIDAsdGhpcy5yaWdodD12b2lkIDAsdGhpcy53aWR0aD12b2lkIDAsdGhpcy5oZWlnaHQ9dm9pZCAwLHRoaXMucG9zaXRpb249dm9pZCAwLHRoaXMud2VpZ2h0PXZvaWQgMCx0aGlzLmZ1bGxTaXplPXZvaWQgMH11cGRhdGUodCxlKXtjb25zdCBpPXRoaXMub3B0aW9ucztpZih0aGlzLmxlZnQ9MCx0aGlzLnRvcD0wLCFpLmRpc3BsYXkpcmV0dXJuIHZvaWQodGhpcy53aWR0aD10aGlzLmhlaWdodD10aGlzLnJpZ2h0PXRoaXMuYm90dG9tPTApO3RoaXMud2lkdGg9dGhpcy5yaWdodD10LHRoaXMuaGVpZ2h0PXRoaXMuYm90dG9tPWU7Y29uc3Qgcz1uKGkudGV4dCk/aS50ZXh0Lmxlbmd0aDoxO3RoaXMuX3BhZGRpbmc9a2koaS5wYWRkaW5nKTtjb25zdCBvPXMqU2koaS5mb250KS5saW5lSGVpZ2h0K3RoaXMuX3BhZGRpbmcuaGVpZ2h0O3RoaXMuaXNIb3Jpem9udGFsKCk/dGhpcy5oZWlnaHQ9bzp0aGlzLndpZHRoPW99aXNIb3Jpem9udGFsKCl7Y29uc3QgdD10aGlzLm9wdGlvbnMucG9zaXRpb247cmV0dXJuInRvcCI9PT10fHwiYm90dG9tIj09PXR9X2RyYXdBcmdzKHQpe2NvbnN0e3RvcDplLGxlZnQ6aSxib3R0b206cyxyaWdodDpuLG9wdGlvbnM6b309dGhpcyxhPW8uYWxpZ247bGV0IHIsbCxoLGM9MDtyZXR1cm4gdGhpcy5pc0hvcml6b250YWwoKT8obD1mdChhLGksbiksaD1lK3Qscj1uLWkpOigibGVmdCI9PT1vLnBvc2l0aW9uPyhsPWkrdCxoPWZ0KGEscyxlKSxjPS0uNSpDKToobD1uLXQsaD1mdChhLGUscyksYz0uNSpDKSxyPXMtZSkse3RpdGxlWDpsLHRpdGxlWTpoLG1heFdpZHRoOnIscm90YXRpb246Y319ZHJhdygpe2NvbnN0IHQ9dGhpcy5jdHgsZT10aGlzLm9wdGlvbnM7aWYoIWUuZGlzcGxheSlyZXR1cm47Y29uc3QgaT1TaShlLmZvbnQpLHM9aS5saW5lSGVpZ2h0LzIrdGhpcy5fcGFkZGluZy50b3Ase3RpdGxlWDpuLHRpdGxlWTpvLG1heFdpZHRoOmEscm90YXRpb246cn09dGhpcy5fZHJhd0FyZ3Mocyk7TmUodCxlLnRleHQsMCwwLGkse2NvbG9yOmUuY29sb3IsbWF4V2lkdGg6YSxyb3RhdGlvbjpyLHRleHRBbGlnbjp1dChlLmFsaWduKSx0ZXh0QmFzZWxpbmU6Im1pZGRsZSIsdHJhbnNsYXRpb246W24sb119KX19dmFyIGthPXtpZDoidGl0bGUiLF9lbGVtZW50OndhLHN0YXJ0KHQsZSxpKXshZnVuY3Rpb24odCxlKXtjb25zdCBpPW5ldyB3YSh7Y3R4OnQuY3R4LG9wdGlvbnM6ZSxjaGFydDp0fSk7bHMuY29uZmlndXJlKHQsaSxlKSxscy5hZGRCb3godCxpKSx0LnRpdGxlQmxvY2s9aX0odCxpKX0sc3RvcCh0KXtjb25zdCBlPXQudGl0bGVCbG9jaztscy5yZW1vdmVCb3godCxlKSxkZWxldGUgdC50aXRsZUJsb2NrfSxiZWZvcmVVcGRhdGUodCxlLGkpe2NvbnN0IHM9dC50aXRsZUJsb2NrO2xzLmNvbmZpZ3VyZSh0LHMsaSkscy5vcHRpb25zPWl9LGRlZmF1bHRzOnthbGlnbjoiY2VudGVyIixkaXNwbGF5OiExLGZvbnQ6e3dlaWdodDoiYm9sZCJ9LGZ1bGxTaXplOiEwLHBhZGRpbmc6MTAscG9zaXRpb246InRvcCIsdGV4dDoiIix3ZWlnaHQ6MmUzfSxkZWZhdWx0Um91dGVzOntjb2xvcjoiY29sb3IifSxkZXNjcmlwdG9yczp7X3NjcmlwdGFibGU6ITAsX2luZGV4YWJsZTohMX19O2NvbnN0IFNhPW5ldyBXZWFrTWFwO3ZhciBQYT17aWQ6InN1YnRpdGxlIixzdGFydCh0LGUsaSl7Y29uc3Qgcz1uZXcgd2Eoe2N0eDp0LmN0eCxvcHRpb25zOmksY2hhcnQ6dH0pO2xzLmNvbmZpZ3VyZSh0LHMsaSksbHMuYWRkQm94KHQscyksU2Euc2V0KHQscyl9LHN0b3AodCl7bHMucmVtb3ZlQm94KHQsU2EuZ2V0KHQpKSxTYS5kZWxldGUodCl9LGJlZm9yZVVwZGF0ZSh0LGUsaSl7Y29uc3Qgcz1TYS5nZXQodCk7bHMuY29uZmlndXJlKHQscyxpKSxzLm9wdGlvbnM9aX0sZGVmYXVsdHM6e2FsaWduOiJjZW50ZXIiLGRpc3BsYXk6ITEsZm9udDp7d2VpZ2h0OiJub3JtYWwifSxmdWxsU2l6ZTohMCxwYWRkaW5nOjAscG9zaXRpb246InRvcCIsdGV4dDoiIix3ZWlnaHQ6MTUwMH0sZGVmYXVsdFJvdXRlczp7Y29sb3I6ImNvbG9yIn0sZGVzY3JpcHRvcnM6e19zY3JpcHRhYmxlOiEwLF9pbmRleGFibGU6ITF9fTtjb25zdCBEYT17YXZlcmFnZSh0KXtpZighdC5sZW5ndGgpcmV0dXJuITE7bGV0IGUsaSxzPW5ldyBTZXQsbj0wLG89MDtmb3IoZT0wLGk9dC5sZW5ndGg7ZTxpOysrZSl7Y29uc3QgaT10W2VdLmVsZW1lbnQ7aWYoaSYmaS5oYXNWYWx1ZSgpKXtjb25zdCB0PWkudG9vbHRpcFBvc2l0aW9uKCk7cy5hZGQodC54KSxuKz10LnksKytvfX1pZigwPT09b3x8MD09PXMuc2l6ZSlyZXR1cm4hMTtyZXR1cm57eDpbLi4uc10ucmVkdWNlKCgodCxlKT0+dCtlKSkvcy5zaXplLHk6bi9vfX0sbmVhcmVzdCh0LGUpe2lmKCF0Lmxlbmd0aClyZXR1cm4hMTtsZXQgaSxzLG4sbz1lLngsYT1lLnkscj1OdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7Zm9yKGk9MCxzPXQubGVuZ3RoO2k8czsrK2kpe2NvbnN0IHM9dFtpXS5lbGVtZW50O2lmKHMmJnMuaGFzVmFsdWUoKSl7Y29uc3QgdD1xKGUscy5nZXRDZW50ZXJQb2ludCgpKTt0PHImJihyPXQsbj1zKX19aWYobil7Y29uc3QgdD1uLnRvb2x0aXBQb3NpdGlvbigpO289dC54LGE9dC55fXJldHVybnt4Om8seTphfX19O2Z1bmN0aW9uIENhKHQsZSl7cmV0dXJuIGUmJihuKGUpP0FycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KHQsZSk6dC5wdXNoKGUpKSx0fWZ1bmN0aW9uIE9hKHQpe3JldHVybigic3RyaW5nIj09dHlwZW9mIHR8fHQgaW5zdGFuY2VvZiBTdHJpbmcpJiZ0LmluZGV4T2YoIlxuIik+LTE/dC5zcGxpdCgiXG4iKTp0fWZ1bmN0aW9uIEFhKHQsZSl7Y29uc3R7ZWxlbWVudDppLGRhdGFzZXRJbmRleDpzLGluZGV4Om59PWUsbz10LmdldERhdGFzZXRNZXRhKHMpLmNvbnRyb2xsZXIse2xhYmVsOmEsdmFsdWU6cn09by5nZXRMYWJlbEFuZFZhbHVlKG4pO3JldHVybntjaGFydDp0LGxhYmVsOmEscGFyc2VkOm8uZ2V0UGFyc2VkKG4pLHJhdzp0LmRhdGEuZGF0YXNldHNbc10uZGF0YVtuXSxmb3JtYXR0ZWRWYWx1ZTpyLGRhdGFzZXQ6by5nZXREYXRhc2V0KCksZGF0YUluZGV4Om4sZGF0YXNldEluZGV4OnMsZWxlbWVudDppfX1mdW5jdGlvbiBUYSh0LGUpe2NvbnN0IGk9dC5jaGFydC5jdHgse2JvZHk6cyxmb290ZXI6bix0aXRsZTpvfT10LHtib3hXaWR0aDphLGJveEhlaWdodDpyfT1lLGw9U2koZS5ib2R5Rm9udCksaD1TaShlLnRpdGxlRm9udCksYz1TaShlLmZvb3RlckZvbnQpLGQ9by5sZW5ndGgsZj1uLmxlbmd0aCxnPXMubGVuZ3RoLHA9a2koZS5wYWRkaW5nKTtsZXQgbT1wLmhlaWdodCx4PTAsYj1zLnJlZHVjZSgoKHQsZSk9PnQrZS5iZWZvcmUubGVuZ3RoK2UubGluZXMubGVuZ3RoK2UuYWZ0ZXIubGVuZ3RoKSwwKTtpZihiKz10LmJlZm9yZUJvZHkubGVuZ3RoK3QuYWZ0ZXJCb2R5Lmxlbmd0aCxkJiYobSs9ZCpoLmxpbmVIZWlnaHQrKGQtMSkqZS50aXRsZVNwYWNpbmcrZS50aXRsZU1hcmdpbkJvdHRvbSksYil7bSs9ZyooZS5kaXNwbGF5Q29sb3JzP01hdGgubWF4KHIsbC5saW5lSGVpZ2h0KTpsLmxpbmVIZWlnaHQpKyhiLWcpKmwubGluZUhlaWdodCsoYi0xKSplLmJvZHlTcGFjaW5nfWYmJihtKz1lLmZvb3Rlck1hcmdpblRvcCtmKmMubGluZUhlaWdodCsoZi0xKSplLmZvb3RlclNwYWNpbmcpO2xldCBfPTA7Y29uc3QgeT1mdW5jdGlvbih0KXt4PU1hdGgubWF4KHgsaS5tZWFzdXJlVGV4dCh0KS53aWR0aCtfKX07cmV0dXJuIGkuc2F2ZSgpLGkuZm9udD1oLnN0cmluZyx1KHQudGl0bGUseSksaS5mb250PWwuc3RyaW5nLHUodC5iZWZvcmVCb2R5LmNvbmNhdCh0LmFmdGVyQm9keSkseSksXz1lLmRpc3BsYXlDb2xvcnM/YSsyK2UuYm94UGFkZGluZzowLHUocywodD0+e3UodC5iZWZvcmUseSksdSh0LmxpbmVzLHkpLHUodC5hZnRlcix5KX0pKSxfPTAsaS5mb250PWMuc3RyaW5nLHUodC5mb290ZXIseSksaS5yZXN0b3JlKCkseCs9cC53aWR0aCx7d2lkdGg6eCxoZWlnaHQ6bX19ZnVuY3Rpb24gTGEodCxlLGkscyl7Y29uc3R7eDpuLHdpZHRoOm99PWkse3dpZHRoOmEsY2hhcnRBcmVhOntsZWZ0OnIscmlnaHQ6bH19PXQ7bGV0IGg9ImNlbnRlciI7cmV0dXJuImNlbnRlciI9PT1zP2g9bjw9KHIrbCkvMj8ibGVmdCI6InJpZ2h0IjpuPD1vLzI/aD0ibGVmdCI6bj49YS1vLzImJihoPSJyaWdodCIpLGZ1bmN0aW9uKHQsZSxpLHMpe2NvbnN0e3g6bix3aWR0aDpvfT1zLGE9aS5jYXJldFNpemUraS5jYXJldFBhZGRpbmc7cmV0dXJuImxlZnQiPT09dCYmbitvK2E+ZS53aWR0aHx8InJpZ2h0Ij09PXQmJm4tby1hPDB8fHZvaWQgMH0oaCx0LGUsaSkmJihoPSJjZW50ZXIiKSxofWZ1bmN0aW9uIEVhKHQsZSxpKXtjb25zdCBzPWkueUFsaWdufHxlLnlBbGlnbnx8ZnVuY3Rpb24odCxlKXtjb25zdHt5OmksaGVpZ2h0OnN9PWU7cmV0dXJuIGk8cy8yPyJ0b3AiOmk+dC5oZWlnaHQtcy8yPyJib3R0b20iOiJjZW50ZXIifSh0LGkpO3JldHVybnt4QWxpZ246aS54QWxpZ258fGUueEFsaWdufHxMYSh0LGUsaSxzKSx5QWxpZ246c319ZnVuY3Rpb24gUmEodCxlLGkscyl7Y29uc3R7Y2FyZXRTaXplOm4sY2FyZXRQYWRkaW5nOm8sY29ybmVyUmFkaXVzOmF9PXQse3hBbGlnbjpyLHlBbGlnbjpsfT1pLGg9bitvLHt0b3BMZWZ0OmMsdG9wUmlnaHQ6ZCxib3R0b21MZWZ0OnUsYm90dG9tUmlnaHQ6Zn09d2koYSk7bGV0IGc9ZnVuY3Rpb24odCxlKXtsZXR7eDppLHdpZHRoOnN9PXQ7cmV0dXJuInJpZ2h0Ij09PWU/aS09czoiY2VudGVyIj09PWUmJihpLT1zLzIpLGl9KGUscik7Y29uc3QgcD1mdW5jdGlvbih0LGUsaSl7bGV0e3k6cyxoZWlnaHQ6bn09dDtyZXR1cm4idG9wIj09PWU/cys9aTpzLT0iYm90dG9tIj09PWU/bitpOm4vMixzfShlLGwsaCk7cmV0dXJuImNlbnRlciI9PT1sPyJsZWZ0Ij09PXI/Zys9aDoicmlnaHQiPT09ciYmKGctPWgpOiJsZWZ0Ij09PXI/Zy09TWF0aC5tYXgoYyx1KStuOiJyaWdodCI9PT1yJiYoZys9TWF0aC5tYXgoZCxmKStuKSx7eDpaKGcsMCxzLndpZHRoLWUud2lkdGgpLHk6WihwLDAscy5oZWlnaHQtZS5oZWlnaHQpfX1mdW5jdGlvbiBJYSh0LGUsaSl7Y29uc3Qgcz1raShpLnBhZGRpbmcpO3JldHVybiJjZW50ZXIiPT09ZT90LngrdC53aWR0aC8yOiJyaWdodCI9PT1lP3QueCt0LndpZHRoLXMucmlnaHQ6dC54K3MubGVmdH1mdW5jdGlvbiB6YSh0KXtyZXR1cm4gQ2EoW10sT2EodCkpfWZ1bmN0aW9uIEZhKHQsZSl7Y29uc3QgaT1lJiZlLmRhdGFzZXQmJmUuZGF0YXNldC50b29sdGlwJiZlLmRhdGFzZXQudG9vbHRpcC5jYWxsYmFja3M7cmV0dXJuIGk/dC5vdmVycmlkZShpKTp0fWNvbnN0IFZhPXtiZWZvcmVUaXRsZTplLHRpdGxlKHQpe2lmKHQubGVuZ3RoPjApe2NvbnN0IGU9dFswXSxpPWUuY2hhcnQuZGF0YS5sYWJlbHMscz1pP2kubGVuZ3RoOjA7aWYodGhpcyYmdGhpcy5vcHRpb25zJiYiZGF0YXNldCI9PT10aGlzLm9wdGlvbnMubW9kZSlyZXR1cm4gZS5kYXRhc2V0LmxhYmVsfHwiIjtpZihlLmxhYmVsKXJldHVybiBlLmxhYmVsO2lmKHM+MCYmZS5kYXRhSW5kZXg8cylyZXR1cm4gaVtlLmRhdGFJbmRleF19cmV0dXJuIiJ9LGFmdGVyVGl0bGU6ZSxiZWZvcmVCb2R5OmUsYmVmb3JlTGFiZWw6ZSxsYWJlbCh0KXtpZih0aGlzJiZ0aGlzLm9wdGlvbnMmJiJkYXRhc2V0Ij09PXRoaXMub3B0aW9ucy5tb2RlKXJldHVybiB0LmxhYmVsKyI6ICIrdC5mb3JtYXR0ZWRWYWx1ZXx8dC5mb3JtYXR0ZWRWYWx1ZTtsZXQgZT10LmRhdGFzZXQubGFiZWx8fCIiO2UmJihlKz0iOiAiKTtjb25zdCBpPXQuZm9ybWF0dGVkVmFsdWU7cmV0dXJuIHMoaSl8fChlKz1pKSxlfSxsYWJlbENvbG9yKHQpe2NvbnN0IGU9dC5jaGFydC5nZXREYXRhc2V0TWV0YSh0LmRhdGFzZXRJbmRleCkuY29udHJvbGxlci5nZXRTdHlsZSh0LmRhdGFJbmRleCk7cmV0dXJue2JvcmRlckNvbG9yOmUuYm9yZGVyQ29sb3IsYmFja2dyb3VuZENvbG9yOmUuYmFja2dyb3VuZENvbG9yLGJvcmRlcldpZHRoOmUuYm9yZGVyV2lkdGgsYm9yZGVyRGFzaDplLmJvcmRlckRhc2gsYm9yZGVyRGFzaE9mZnNldDplLmJvcmRlckRhc2hPZmZzZXQsYm9yZGVyUmFkaXVzOjB9fSxsYWJlbFRleHRDb2xvcigpe3JldHVybiB0aGlzLm9wdGlvbnMuYm9keUNvbG9yfSxsYWJlbFBvaW50U3R5bGUodCl7Y29uc3QgZT10LmNoYXJ0LmdldERhdGFzZXRNZXRhKHQuZGF0YXNldEluZGV4KS5jb250cm9sbGVyLmdldFN0eWxlKHQuZGF0YUluZGV4KTtyZXR1cm57cG9pbnRTdHlsZTplLnBvaW50U3R5bGUscm90YXRpb246ZS5yb3RhdGlvbn19LGFmdGVyTGFiZWw6ZSxhZnRlckJvZHk6ZSxiZWZvcmVGb290ZXI6ZSxmb290ZXI6ZSxhZnRlckZvb3RlcjplfTtmdW5jdGlvbiBCYSh0LGUsaSxzKXtjb25zdCBuPXRbZV0uY2FsbChpLHMpO3JldHVybiB2b2lkIDA9PT1uP1ZhW2VdLmNhbGwoaSxzKTpufWNsYXNzIFdhIGV4dGVuZHMgJHN7c3RhdGljIHBvc2l0aW9uZXJzPURhO2NvbnN0cnVjdG9yKHQpe3N1cGVyKCksdGhpcy5vcGFjaXR5PTAsdGhpcy5fYWN0aXZlPVtdLHRoaXMuX2V2ZW50UG9zaXRpb249dm9pZCAwLHRoaXMuX3NpemU9dm9pZCAwLHRoaXMuX2NhY2hlZEFuaW1hdGlvbnM9dm9pZCAwLHRoaXMuX3Rvb2x0aXBJdGVtcz1bXSx0aGlzLiRhbmltYXRpb25zPXZvaWQgMCx0aGlzLiRjb250ZXh0PXZvaWQgMCx0aGlzLmNoYXJ0PXQuY2hhcnQsdGhpcy5vcHRpb25zPXQub3B0aW9ucyx0aGlzLmRhdGFQb2ludHM9dm9pZCAwLHRoaXMudGl0bGU9dm9pZCAwLHRoaXMuYmVmb3JlQm9keT12b2lkIDAsdGhpcy5ib2R5PXZvaWQgMCx0aGlzLmFmdGVyQm9keT12b2lkIDAsdGhpcy5mb290ZXI9dm9pZCAwLHRoaXMueEFsaWduPXZvaWQgMCx0aGlzLnlBbGlnbj12b2lkIDAsdGhpcy54PXZvaWQgMCx0aGlzLnk9dm9pZCAwLHRoaXMuaGVpZ2h0PXZvaWQgMCx0aGlzLndpZHRoPXZvaWQgMCx0aGlzLmNhcmV0WD12b2lkIDAsdGhpcy5jYXJldFk9dm9pZCAwLHRoaXMubGFiZWxDb2xvcnM9dm9pZCAwLHRoaXMubGFiZWxQb2ludFN0eWxlcz12b2lkIDAsdGhpcy5sYWJlbFRleHRDb2xvcnM9dm9pZCAwfWluaXRpYWxpemUodCl7dGhpcy5vcHRpb25zPXQsdGhpcy5fY2FjaGVkQW5pbWF0aW9ucz12b2lkIDAsdGhpcy4kY29udGV4dD12b2lkIDB9X3Jlc29sdmVBbmltYXRpb25zKCl7Y29uc3QgdD10aGlzLl9jYWNoZWRBbmltYXRpb25zO2lmKHQpcmV0dXJuIHQ7Y29uc3QgZT10aGlzLmNoYXJ0LGk9dGhpcy5vcHRpb25zLnNldENvbnRleHQodGhpcy5nZXRDb250ZXh0KCkpLHM9aS5lbmFibGVkJiZlLm9wdGlvbnMuYW5pbWF0aW9uJiZpLmFuaW1hdGlvbnMsbj1uZXcgVHModGhpcy5jaGFydCxzKTtyZXR1cm4gcy5fY2FjaGVhYmxlJiYodGhpcy5fY2FjaGVkQW5pbWF0aW9ucz1PYmplY3QuZnJlZXplKG4pKSxufWdldENvbnRleHQoKXtyZXR1cm4gdGhpcy4kY29udGV4dHx8KHRoaXMuJGNvbnRleHQ9KHQ9dGhpcy5jaGFydC5nZXRDb250ZXh0KCksZT10aGlzLGk9dGhpcy5fdG9vbHRpcEl0ZW1zLENpKHQse3Rvb2x0aXA6ZSx0b29sdGlwSXRlbXM6aSx0eXBlOiJ0b29sdGlwIn0pKSk7dmFyIHQsZSxpfWdldFRpdGxlKHQsZSl7Y29uc3R7Y2FsbGJhY2tzOml9PWUscz1CYShpLCJiZWZvcmVUaXRsZSIsdGhpcyx0KSxuPUJhKGksInRpdGxlIix0aGlzLHQpLG89QmEoaSwiYWZ0ZXJUaXRsZSIsdGhpcyx0KTtsZXQgYT1bXTtyZXR1cm4gYT1DYShhLE9hKHMpKSxhPUNhKGEsT2EobikpLGE9Q2EoYSxPYShvKSksYX1nZXRCZWZvcmVCb2R5KHQsZSl7cmV0dXJuIHphKEJhKGUuY2FsbGJhY2tzLCJiZWZvcmVCb2R5Iix0aGlzLHQpKX1nZXRCb2R5KHQsZSl7Y29uc3R7Y2FsbGJhY2tzOml9PWUscz1bXTtyZXR1cm4gdSh0LCh0PT57Y29uc3QgZT17YmVmb3JlOltdLGxpbmVzOltdLGFmdGVyOltdfSxuPUZhKGksdCk7Q2EoZS5iZWZvcmUsT2EoQmEobiwiYmVmb3JlTGFiZWwiLHRoaXMsdCkpKSxDYShlLmxpbmVzLEJhKG4sImxhYmVsIix0aGlzLHQpKSxDYShlLmFmdGVyLE9hKEJhKG4sImFmdGVyTGFiZWwiLHRoaXMsdCkpKSxzLnB1c2goZSl9KSksc31nZXRBZnRlckJvZHkodCxlKXtyZXR1cm4gemEoQmEoZS5jYWxsYmFja3MsImFmdGVyQm9keSIsdGhpcyx0KSl9Z2V0Rm9vdGVyKHQsZSl7Y29uc3R7Y2FsbGJhY2tzOml9PWUscz1CYShpLCJiZWZvcmVGb290ZXIiLHRoaXMsdCksbj1CYShpLCJmb290ZXIiLHRoaXMsdCksbz1CYShpLCJhZnRlckZvb3RlciIsdGhpcyx0KTtsZXQgYT1bXTtyZXR1cm4gYT1DYShhLE9hKHMpKSxhPUNhKGEsT2EobikpLGE9Q2EoYSxPYShvKSksYX1fY3JlYXRlSXRlbXModCl7Y29uc3QgZT10aGlzLl9hY3RpdmUsaT10aGlzLmNoYXJ0LmRhdGEscz1bXSxuPVtdLG89W107bGV0IGEscixsPVtdO2ZvcihhPTAscj1lLmxlbmd0aDthPHI7KythKWwucHVzaChBYSh0aGlzLmNoYXJ0LGVbYV0pKTtyZXR1cm4gdC5maWx0ZXImJihsPWwuZmlsdGVyKCgoZSxzLG4pPT50LmZpbHRlcihlLHMsbixpKSkpKSx0Lml0ZW1Tb3J0JiYobD1sLnNvcnQoKChlLHMpPT50Lml0ZW1Tb3J0KGUscyxpKSkpKSx1KGwsKGU9Pntjb25zdCBpPUZhKHQuY2FsbGJhY2tzLGUpO3MucHVzaChCYShpLCJsYWJlbENvbG9yIix0aGlzLGUpKSxuLnB1c2goQmEoaSwibGFiZWxQb2ludFN0eWxlIix0aGlzLGUpKSxvLnB1c2goQmEoaSwibGFiZWxUZXh0Q29sb3IiLHRoaXMsZSkpfSkpLHRoaXMubGFiZWxDb2xvcnM9cyx0aGlzLmxhYmVsUG9pbnRTdHlsZXM9bix0aGlzLmxhYmVsVGV4dENvbG9ycz1vLHRoaXMuZGF0YVBvaW50cz1sLGx9dXBkYXRlKHQsZSl7Y29uc3QgaT10aGlzLm9wdGlvbnMuc2V0Q29udGV4dCh0aGlzLmdldENvbnRleHQoKSkscz10aGlzLl9hY3RpdmU7bGV0IG4sbz1bXTtpZihzLmxlbmd0aCl7Y29uc3QgdD1EYVtpLnBvc2l0aW9uXS5jYWxsKHRoaXMscyx0aGlzLl9ldmVudFBvc2l0aW9uKTtvPXRoaXMuX2NyZWF0ZUl0ZW1zKGkpLHRoaXMudGl0bGU9dGhpcy5nZXRUaXRsZShvLGkpLHRoaXMuYmVmb3JlQm9keT10aGlzLmdldEJlZm9yZUJvZHkobyxpKSx0aGlzLmJvZHk9dGhpcy5nZXRCb2R5KG8saSksdGhpcy5hZnRlckJvZHk9dGhpcy5nZXRBZnRlckJvZHkobyxpKSx0aGlzLmZvb3Rlcj10aGlzLmdldEZvb3RlcihvLGkpO2NvbnN0IGU9dGhpcy5fc2l6ZT1UYSh0aGlzLGkpLGE9T2JqZWN0LmFzc2lnbih7fSx0LGUpLHI9RWEodGhpcy5jaGFydCxpLGEpLGw9UmEoaSxhLHIsdGhpcy5jaGFydCk7dGhpcy54QWxpZ249ci54QWxpZ24sdGhpcy55QWxpZ249ci55QWxpZ24sbj17b3BhY2l0eToxLHg6bC54LHk6bC55LHdpZHRoOmUud2lkdGgsaGVpZ2h0OmUuaGVpZ2h0LGNhcmV0WDp0LngsY2FyZXRZOnQueX19ZWxzZSAwIT09dGhpcy5vcGFjaXR5JiYobj17b3BhY2l0eTowfSk7dGhpcy5fdG9vbHRpcEl0ZW1zPW8sdGhpcy4kY29udGV4dD12b2lkIDAsbiYmdGhpcy5fcmVzb2x2ZUFuaW1hdGlvbnMoKS51cGRhdGUodGhpcyxuKSx0JiZpLmV4dGVybmFsJiZpLmV4dGVybmFsLmNhbGwodGhpcyx7Y2hhcnQ6dGhpcy5jaGFydCx0b29sdGlwOnRoaXMscmVwbGF5OmV9KX1kcmF3Q2FyZXQodCxlLGkscyl7Y29uc3Qgbj10aGlzLmdldENhcmV0UG9zaXRpb24odCxpLHMpO2UubGluZVRvKG4ueDEsbi55MSksZS5saW5lVG8obi54MixuLnkyKSxlLmxpbmVUbyhuLngzLG4ueTMpfWdldENhcmV0UG9zaXRpb24odCxlLGkpe2NvbnN0e3hBbGlnbjpzLHlBbGlnbjpufT10aGlzLHtjYXJldFNpemU6byxjb3JuZXJSYWRpdXM6YX09aSx7dG9wTGVmdDpyLHRvcFJpZ2h0OmwsYm90dG9tTGVmdDpoLGJvdHRvbVJpZ2h0OmN9PXdpKGEpLHt4OmQseTp1fT10LHt3aWR0aDpmLGhlaWdodDpnfT1lO2xldCBwLG0seCxiLF8seTtyZXR1cm4iY2VudGVyIj09PW4/KF89dStnLzIsImxlZnQiPT09cz8ocD1kLG09cC1vLGI9XytvLHk9Xy1vKToocD1kK2YsbT1wK28sYj1fLW8seT1fK28pLHg9cCk6KG09ImxlZnQiPT09cz9kK01hdGgubWF4KHIsaCkrbzoicmlnaHQiPT09cz9kK2YtTWF0aC5tYXgobCxjKS1vOnRoaXMuY2FyZXRYLCJ0b3AiPT09bj8oYj11LF89Yi1vLHA9bS1vLHg9bStvKTooYj11K2csXz1iK28scD1tK28seD1tLW8pLHk9Yikse3gxOnAseDI6bSx4Mzp4LHkxOmIseTI6Xyx5Mzp5fX1kcmF3VGl0bGUodCxlLGkpe2NvbnN0IHM9dGhpcy50aXRsZSxuPXMubGVuZ3RoO2xldCBvLGEscjtpZihuKXtjb25zdCBsPU9pKGkucnRsLHRoaXMueCx0aGlzLndpZHRoKTtmb3IodC54PUlhKHRoaXMsaS50aXRsZUFsaWduLGkpLGUudGV4dEFsaWduPWwudGV4dEFsaWduKGkudGl0bGVBbGlnbiksZS50ZXh0QmFzZWxpbmU9Im1pZGRsZSIsbz1TaShpLnRpdGxlRm9udCksYT1pLnRpdGxlU3BhY2luZyxlLmZpbGxTdHlsZT1pLnRpdGxlQ29sb3IsZS5mb250PW8uc3RyaW5nLHI9MDtyPG47KytyKWUuZmlsbFRleHQoc1tyXSxsLngodC54KSx0Lnkrby5saW5lSGVpZ2h0LzIpLHQueSs9by5saW5lSGVpZ2h0K2EscisxPT09biYmKHQueSs9aS50aXRsZU1hcmdpbkJvdHRvbS1hKX19X2RyYXdDb2xvckJveCh0LGUsaSxzLG4pe2NvbnN0IGE9dGhpcy5sYWJlbENvbG9yc1tpXSxyPXRoaXMubGFiZWxQb2ludFN0eWxlc1tpXSx7Ym94SGVpZ2h0OmwsYm94V2lkdGg6aH09bixjPVNpKG4uYm9keUZvbnQpLGQ9SWEodGhpcywibGVmdCIsbiksdT1zLngoZCksZj1sPGMubGluZUhlaWdodD8oYy5saW5lSGVpZ2h0LWwpLzI6MCxnPWUueStmO2lmKG4udXNlUG9pbnRTdHlsZSl7Y29uc3QgZT17cmFkaXVzOk1hdGgubWluKGgsbCkvMixwb2ludFN0eWxlOnIucG9pbnRTdHlsZSxyb3RhdGlvbjpyLnJvdGF0aW9uLGJvcmRlcldpZHRoOjF9LGk9cy5sZWZ0Rm9yTHRyKHUsaCkraC8yLG89ZytsLzI7dC5zdHJva2VTdHlsZT1uLm11bHRpS2V5QmFja2dyb3VuZCx0LmZpbGxTdHlsZT1uLm11bHRpS2V5QmFja2dyb3VuZCxMZSh0LGUsaSxvKSx0LnN0cm9rZVN0eWxlPWEuYm9yZGVyQ29sb3IsdC5maWxsU3R5bGU9YS5iYWNrZ3JvdW5kQ29sb3IsTGUodCxlLGksbyl9ZWxzZXt0LmxpbmVXaWR0aD1vKGEuYm9yZGVyV2lkdGgpP01hdGgubWF4KC4uLk9iamVjdC52YWx1ZXMoYS5ib3JkZXJXaWR0aCkpOmEuYm9yZGVyV2lkdGh8fDEsdC5zdHJva2VTdHlsZT1hLmJvcmRlckNvbG9yLHQuc2V0TGluZURhc2goYS5ib3JkZXJEYXNofHxbXSksdC5saW5lRGFzaE9mZnNldD1hLmJvcmRlckRhc2hPZmZzZXR8fDA7Y29uc3QgZT1zLmxlZnRGb3JMdHIodSxoKSxpPXMubGVmdEZvckx0cihzLnhQbHVzKHUsMSksaC0yKSxyPXdpKGEuYm9yZGVyUmFkaXVzKTtPYmplY3QudmFsdWVzKHIpLnNvbWUoKHQ9PjAhPT10KSk/KHQuYmVnaW5QYXRoKCksdC5maWxsU3R5bGU9bi5tdWx0aUtleUJhY2tncm91bmQsSGUodCx7eDplLHk6Zyx3OmgsaDpsLHJhZGl1czpyfSksdC5maWxsKCksdC5zdHJva2UoKSx0LmZpbGxTdHlsZT1hLmJhY2tncm91bmRDb2xvcix0LmJlZ2luUGF0aCgpLEhlKHQse3g6aSx5OmcrMSx3OmgtMixoOmwtMixyYWRpdXM6cn0pLHQuZmlsbCgpKToodC5maWxsU3R5bGU9bi5tdWx0aUtleUJhY2tncm91bmQsdC5maWxsUmVjdChlLGcsaCxsKSx0LnN0cm9rZVJlY3QoZSxnLGgsbCksdC5maWxsU3R5bGU9YS5iYWNrZ3JvdW5kQ29sb3IsdC5maWxsUmVjdChpLGcrMSxoLTIsbC0yKSl9dC5maWxsU3R5bGU9dGhpcy5sYWJlbFRleHRDb2xvcnNbaV19ZHJhd0JvZHkodCxlLGkpe2NvbnN0e2JvZHk6c309dGhpcyx7Ym9keVNwYWNpbmc6bixib2R5QWxpZ246byxkaXNwbGF5Q29sb3JzOmEsYm94SGVpZ2h0OnIsYm94V2lkdGg6bCxib3hQYWRkaW5nOmh9PWksYz1TaShpLmJvZHlGb250KTtsZXQgZD1jLmxpbmVIZWlnaHQsZj0wO2NvbnN0IGc9T2koaS5ydGwsdGhpcy54LHRoaXMud2lkdGgpLHA9ZnVuY3Rpb24oaSl7ZS5maWxsVGV4dChpLGcueCh0LngrZiksdC55K2QvMiksdC55Kz1kK259LG09Zy50ZXh0QWxpZ24obyk7bGV0IHgsYixfLHksdixNLHc7Zm9yKGUudGV4dEFsaWduPW8sZS50ZXh0QmFzZWxpbmU9Im1pZGRsZSIsZS5mb250PWMuc3RyaW5nLHQueD1JYSh0aGlzLG0saSksZS5maWxsU3R5bGU9aS5ib2R5Q29sb3IsdSh0aGlzLmJlZm9yZUJvZHkscCksZj1hJiYicmlnaHQiIT09bT8iY2VudGVyIj09PW8/bC8yK2g6bCsyK2g6MCx5PTAsTT1zLmxlbmd0aDt5PE07Kyt5KXtmb3IoeD1zW3ldLGI9dGhpcy5sYWJlbFRleHRDb2xvcnNbeV0sZS5maWxsU3R5bGU9Yix1KHguYmVmb3JlLHApLF89eC5saW5lcyxhJiZfLmxlbmd0aCYmKHRoaXMuX2RyYXdDb2xvckJveChlLHQseSxnLGkpLGQ9TWF0aC5tYXgoYy5saW5lSGVpZ2h0LHIpKSx2PTAsdz1fLmxlbmd0aDt2PHc7Kyt2KXAoX1t2XSksZD1jLmxpbmVIZWlnaHQ7dSh4LmFmdGVyLHApfWY9MCxkPWMubGluZUhlaWdodCx1KHRoaXMuYWZ0ZXJCb2R5LHApLHQueS09bn1kcmF3Rm9vdGVyKHQsZSxpKXtjb25zdCBzPXRoaXMuZm9vdGVyLG49cy5sZW5ndGg7bGV0IG8sYTtpZihuKXtjb25zdCByPU9pKGkucnRsLHRoaXMueCx0aGlzLndpZHRoKTtmb3IodC54PUlhKHRoaXMsaS5mb290ZXJBbGlnbixpKSx0LnkrPWkuZm9vdGVyTWFyZ2luVG9wLGUudGV4dEFsaWduPXIudGV4dEFsaWduKGkuZm9vdGVyQWxpZ24pLGUudGV4dEJhc2VsaW5lPSJtaWRkbGUiLG89U2koaS5mb290ZXJGb250KSxlLmZpbGxTdHlsZT1pLmZvb3RlckNvbG9yLGUuZm9udD1vLnN0cmluZyxhPTA7YTxuOysrYSllLmZpbGxUZXh0KHNbYV0sci54KHQueCksdC55K28ubGluZUhlaWdodC8yKSx0LnkrPW8ubGluZUhlaWdodCtpLmZvb3RlclNwYWNpbmd9fWRyYXdCYWNrZ3JvdW5kKHQsZSxpLHMpe2NvbnN0e3hBbGlnbjpuLHlBbGlnbjpvfT10aGlzLHt4OmEseTpyfT10LHt3aWR0aDpsLGhlaWdodDpofT1pLHt0b3BMZWZ0OmMsdG9wUmlnaHQ6ZCxib3R0b21MZWZ0OnUsYm90dG9tUmlnaHQ6Zn09d2kocy5jb3JuZXJSYWRpdXMpO2UuZmlsbFN0eWxlPXMuYmFja2dyb3VuZENvbG9yLGUuc3Ryb2tlU3R5bGU9cy5ib3JkZXJDb2xvcixlLmxpbmVXaWR0aD1zLmJvcmRlcldpZHRoLGUuYmVnaW5QYXRoKCksZS5tb3ZlVG8oYStjLHIpLCJ0b3AiPT09byYmdGhpcy5kcmF3Q2FyZXQodCxlLGkscyksZS5saW5lVG8oYStsLWQsciksZS5xdWFkcmF0aWNDdXJ2ZVRvKGErbCxyLGErbCxyK2QpLCJjZW50ZXIiPT09byYmInJpZ2h0Ij09PW4mJnRoaXMuZHJhd0NhcmV0KHQsZSxpLHMpLGUubGluZVRvKGErbCxyK2gtZiksZS5xdWFkcmF0aWNDdXJ2ZVRvKGErbCxyK2gsYStsLWYscitoKSwiYm90dG9tIj09PW8mJnRoaXMuZHJhd0NhcmV0KHQsZSxpLHMpLGUubGluZVRvKGErdSxyK2gpLGUucXVhZHJhdGljQ3VydmVUbyhhLHIraCxhLHIraC11KSwiY2VudGVyIj09PW8mJiJsZWZ0Ij09PW4mJnRoaXMuZHJhd0NhcmV0KHQsZSxpLHMpLGUubGluZVRvKGEscitjKSxlLnF1YWRyYXRpY0N1cnZlVG8oYSxyLGErYyxyKSxlLmNsb3NlUGF0aCgpLGUuZmlsbCgpLHMuYm9yZGVyV2lkdGg+MCYmZS5zdHJva2UoKX1fdXBkYXRlQW5pbWF0aW9uVGFyZ2V0KHQpe2NvbnN0IGU9dGhpcy5jaGFydCxpPXRoaXMuJGFuaW1hdGlvbnMscz1pJiZpLngsbj1pJiZpLnk7aWYoc3x8bil7Y29uc3QgaT1EYVt0LnBvc2l0aW9uXS5jYWxsKHRoaXMsdGhpcy5fYWN0aXZlLHRoaXMuX2V2ZW50UG9zaXRpb24pO2lmKCFpKXJldHVybjtjb25zdCBvPXRoaXMuX3NpemU9VGEodGhpcyx0KSxhPU9iamVjdC5hc3NpZ24oe30saSx0aGlzLl9zaXplKSxyPUVhKGUsdCxhKSxsPVJhKHQsYSxyLGUpO3MuX3RvPT09bC54JiZuLl90bz09PWwueXx8KHRoaXMueEFsaWduPXIueEFsaWduLHRoaXMueUFsaWduPXIueUFsaWduLHRoaXMud2lkdGg9by53aWR0aCx0aGlzLmhlaWdodD1vLmhlaWdodCx0aGlzLmNhcmV0WD1pLngsdGhpcy5jYXJldFk9aS55LHRoaXMuX3Jlc29sdmVBbmltYXRpb25zKCkudXBkYXRlKHRoaXMsbCkpfX1fd2lsbFJlbmRlcigpe3JldHVybiEhdGhpcy5vcGFjaXR5fWRyYXcodCl7Y29uc3QgZT10aGlzLm9wdGlvbnMuc2V0Q29udGV4dCh0aGlzLmdldENvbnRleHQoKSk7bGV0IGk9dGhpcy5vcGFjaXR5O2lmKCFpKXJldHVybjt0aGlzLl91cGRhdGVBbmltYXRpb25UYXJnZXQoZSk7Y29uc3Qgcz17d2lkdGg6dGhpcy53aWR0aCxoZWlnaHQ6dGhpcy5oZWlnaHR9LG49e3g6dGhpcy54LHk6dGhpcy55fTtpPU1hdGguYWJzKGkpPC4wMDE/MDppO2NvbnN0IG89a2koZS5wYWRkaW5nKSxhPXRoaXMudGl0bGUubGVuZ3RofHx0aGlzLmJlZm9yZUJvZHkubGVuZ3RofHx0aGlzLmJvZHkubGVuZ3RofHx0aGlzLmFmdGVyQm9keS5sZW5ndGh8fHRoaXMuZm9vdGVyLmxlbmd0aDtlLmVuYWJsZWQmJmEmJih0LnNhdmUoKSx0Lmdsb2JhbEFscGhhPWksdGhpcy5kcmF3QmFja2dyb3VuZChuLHQscyxlKSxBaSh0LGUudGV4dERpcmVjdGlvbiksbi55Kz1vLnRvcCx0aGlzLmRyYXdUaXRsZShuLHQsZSksdGhpcy5kcmF3Qm9keShuLHQsZSksdGhpcy5kcmF3Rm9vdGVyKG4sdCxlKSxUaSh0LGUudGV4dERpcmVjdGlvbiksdC5yZXN0b3JlKCkpfWdldEFjdGl2ZUVsZW1lbnRzKCl7cmV0dXJuIHRoaXMuX2FjdGl2ZXx8W119c2V0QWN0aXZlRWxlbWVudHModCxlKXtjb25zdCBpPXRoaXMuX2FjdGl2ZSxzPXQubWFwKCgoe2RhdGFzZXRJbmRleDp0LGluZGV4OmV9KT0+e2NvbnN0IGk9dGhpcy5jaGFydC5nZXREYXRhc2V0TWV0YSh0KTtpZighaSl0aHJvdyBuZXcgRXJyb3IoIkNhbm5vdCBmaW5kIGEgZGF0YXNldCBhdCBpbmRleCAiK3QpO3JldHVybntkYXRhc2V0SW5kZXg6dCxlbGVtZW50OmkuZGF0YVtlXSxpbmRleDplfX0pKSxuPSFmKGkscyksbz10aGlzLl9wb3NpdGlvbkNoYW5nZWQocyxlKTsobnx8bykmJih0aGlzLl9hY3RpdmU9cyx0aGlzLl9ldmVudFBvc2l0aW9uPWUsdGhpcy5faWdub3JlUmVwbGF5RXZlbnRzPSEwLHRoaXMudXBkYXRlKCEwKSl9aGFuZGxlRXZlbnQodCxlLGk9ITApe2lmKGUmJnRoaXMuX2lnbm9yZVJlcGxheUV2ZW50cylyZXR1cm4hMTt0aGlzLl9pZ25vcmVSZXBsYXlFdmVudHM9ITE7Y29uc3Qgcz10aGlzLm9wdGlvbnMsbj10aGlzLl9hY3RpdmV8fFtdLG89dGhpcy5fZ2V0QWN0aXZlRWxlbWVudHModCxuLGUsaSksYT10aGlzLl9wb3NpdGlvbkNoYW5nZWQobyx0KSxyPWV8fCFmKG8sbil8fGE7cmV0dXJuIHImJih0aGlzLl9hY3RpdmU9bywocy5lbmFibGVkfHxzLmV4dGVybmFsKSYmKHRoaXMuX2V2ZW50UG9zaXRpb249e3g6dC54LHk6dC55fSx0aGlzLnVwZGF0ZSghMCxlKSkpLHJ9X2dldEFjdGl2ZUVsZW1lbnRzKHQsZSxpLHMpe2NvbnN0IG49dGhpcy5vcHRpb25zO2lmKCJtb3VzZW91dCI9PT10LnR5cGUpcmV0dXJuW107aWYoIXMpcmV0dXJuIGUuZmlsdGVyKCh0PT50aGlzLmNoYXJ0LmRhdGEuZGF0YXNldHNbdC5kYXRhc2V0SW5kZXhdJiZ2b2lkIDAhPT10aGlzLmNoYXJ0LmdldERhdGFzZXRNZXRhKHQuZGF0YXNldEluZGV4KS5jb250cm9sbGVyLmdldFBhcnNlZCh0LmluZGV4KSkpO2NvbnN0IG89dGhpcy5jaGFydC5nZXRFbGVtZW50c0F0RXZlbnRGb3JNb2RlKHQsbi5tb2RlLG4saSk7cmV0dXJuIG4ucmV2ZXJzZSYmby5yZXZlcnNlKCksb31fcG9zaXRpb25DaGFuZ2VkKHQsZSl7Y29uc3R7Y2FyZXRYOmksY2FyZXRZOnMsb3B0aW9uczpufT10aGlzLG89RGFbbi5wb3NpdGlvbl0uY2FsbCh0aGlzLHQsZSk7cmV0dXJuITEhPT1vJiYoaSE9PW8ueHx8cyE9PW8ueSl9fXZhciBOYT17aWQ6InRvb2x0aXAiLF9lbGVtZW50OldhLHBvc2l0aW9uZXJzOkRhLGFmdGVySW5pdCh0LGUsaSl7aSYmKHQudG9vbHRpcD1uZXcgV2Eoe2NoYXJ0OnQsb3B0aW9uczppfSkpfSxiZWZvcmVVcGRhdGUodCxlLGkpe3QudG9vbHRpcCYmdC50b29sdGlwLmluaXRpYWxpemUoaSl9LHJlc2V0KHQsZSxpKXt0LnRvb2x0aXAmJnQudG9vbHRpcC5pbml0aWFsaXplKGkpfSxhZnRlckRyYXcodCl7Y29uc3QgZT10LnRvb2x0aXA7aWYoZSYmZS5fd2lsbFJlbmRlcigpKXtjb25zdCBpPXt0b29sdGlwOmV9O2lmKCExPT09dC5ub3RpZnlQbHVnaW5zKCJiZWZvcmVUb29sdGlwRHJhdyIsey4uLmksY2FuY2VsYWJsZTohMH0pKXJldHVybjtlLmRyYXcodC5jdHgpLHQubm90aWZ5UGx1Z2lucygiYWZ0ZXJUb29sdGlwRHJhdyIsaSl9fSxhZnRlckV2ZW50KHQsZSl7aWYodC50b29sdGlwKXtjb25zdCBpPWUucmVwbGF5O3QudG9vbHRpcC5oYW5kbGVFdmVudChlLmV2ZW50LGksZS5pbkNoYXJ0QXJlYSkmJihlLmNoYW5nZWQ9ITApfX0sZGVmYXVsdHM6e2VuYWJsZWQ6ITAsZXh0ZXJuYWw6bnVsbCxwb3NpdGlvbjoiYXZlcmFnZSIsYmFja2dyb3VuZENvbG9yOiJyZ2JhKDAsMCwwLDAuOCkiLHRpdGxlQ29sb3I6IiNmZmYiLHRpdGxlRm9udDp7d2VpZ2h0OiJib2xkIn0sdGl0bGVTcGFjaW5nOjIsdGl0bGVNYXJnaW5Cb3R0b206Nix0aXRsZUFsaWduOiJsZWZ0Iixib2R5Q29sb3I6IiNmZmYiLGJvZHlTcGFjaW5nOjIsYm9keUZvbnQ6e30sYm9keUFsaWduOiJsZWZ0Iixmb290ZXJDb2xvcjoiI2ZmZiIsZm9vdGVyU3BhY2luZzoyLGZvb3Rlck1hcmdpblRvcDo2LGZvb3RlckZvbnQ6e3dlaWdodDoiYm9sZCJ9LGZvb3RlckFsaWduOiJsZWZ0IixwYWRkaW5nOjYsY2FyZXRQYWRkaW5nOjIsY2FyZXRTaXplOjUsY29ybmVyUmFkaXVzOjYsYm94SGVpZ2h0Oih0LGUpPT5lLmJvZHlGb250LnNpemUsYm94V2lkdGg6KHQsZSk9PmUuYm9keUZvbnQuc2l6ZSxtdWx0aUtleUJhY2tncm91bmQ6IiNmZmYiLGRpc3BsYXlDb2xvcnM6ITAsYm94UGFkZGluZzowLGJvcmRlckNvbG9yOiJyZ2JhKDAsMCwwLDApIixib3JkZXJXaWR0aDowLGFuaW1hdGlvbjp7ZHVyYXRpb246NDAwLGVhc2luZzoiZWFzZU91dFF1YXJ0In0sYW5pbWF0aW9uczp7bnVtYmVyczp7dHlwZToibnVtYmVyIixwcm9wZXJ0aWVzOlsieCIsInkiLCJ3aWR0aCIsImhlaWdodCIsImNhcmV0WCIsImNhcmV0WSJdfSxvcGFjaXR5OntlYXNpbmc6ImxpbmVhciIsZHVyYXRpb246MjAwfX0sY2FsbGJhY2tzOlZhfSxkZWZhdWx0Um91dGVzOntib2R5Rm9udDoiZm9udCIsZm9vdGVyRm9udDoiZm9udCIsdGl0bGVGb250OiJmb250In0sZGVzY3JpcHRvcnM6e19zY3JpcHRhYmxlOnQ9PiJmaWx0ZXIiIT09dCYmIml0ZW1Tb3J0IiE9PXQmJiJleHRlcm5hbCIhPT10LF9pbmRleGFibGU6ITEsY2FsbGJhY2tzOntfc2NyaXB0YWJsZTohMSxfaW5kZXhhYmxlOiExfSxhbmltYXRpb246e19mYWxsYmFjazohMX0sYW5pbWF0aW9uczp7X2ZhbGxiYWNrOiJhbmltYXRpb24ifX0sYWRkaXRpb25hbE9wdGlvblNjb3BlczpbImludGVyYWN0aW9uIl19O3JldHVybiBUbi5yZWdpc3RlcihVbiwkbyxnbyx0KSxUbi5oZWxwZXJzPXsuLi5IaX0sVG4uX2FkYXB0ZXJzPUluLFRuLkFuaW1hdGlvbj1BcyxUbi5BbmltYXRpb25zPVRzLFRuLmFuaW1hdG9yPWJ0LFRuLmNvbnRyb2xsZXJzPW5uLmNvbnRyb2xsZXJzLml0ZW1zLFRuLkRhdGFzZXRDb250cm9sbGVyPWpzLFRuLkVsZW1lbnQ9JHMsVG4uZWxlbWVudHM9Z28sVG4uSW50ZXJhY3Rpb249S2ksVG4ubGF5b3V0cz1scyxUbi5wbGF0Zm9ybXM9RHMsVG4uU2NhbGU9dG4sVG4uVGlja3M9YWUsT2JqZWN0LmFzc2lnbihUbixVbiwkbyxnbyx0LERzKSxUbi5DaGFydD1UbiwidW5kZWZpbmVkIiE9dHlwZW9mIHdpbmRvdyYmKHdpbmRvdy5DaGFydD1UbiksVG59KSk7Ci8vIyBzb3VyY2VNYXBwaW5nVVJMPWNoYXJ0LnVtZC5qcy5tYXAK";
function buildReportHtml(mode) {
  const keys = Object.keys(DB).sort();

  // Build per-month data payload for the report
  const monthsData = keys.map(mk => {
    const periods = buildPeriods(mk);
    const finalTotals = getTotals(mk, '__all__', periods.length-1)
      .sort((a,b)=>b.total-a.total);
    const allDepts = Object.keys(DB[mk].depts||{}).sort();
    const deptStats = allDepts.map((d,i) => {
      const tots = getTotals(mk, d).map(t=>t.total);
      const total = Math.round(tots.reduce((a,b)=>a+b,0)*10)/10;
      const over = tots.filter(t=>t>70).length;
      return { name:d, total, over, nv:tots.length, overPct: tots.length?Math.round(over/tots.length*100):0 };
    });
    // trend for top 5 employees across periods
    const top5 = finalTotals.slice(0,5);
    const trend = top5.map(t => ({
      name: t.name, staffCode: t.staffCode,
      data: periods.map((p,pi) => getTotals(mk,'__all__',pi).find(x=>x.name===t.name)?.total ?? null)
    }));
    return {
      mk, label: fmtMK(mk),
      periodLabels: periods.map(p=>p.label),
      totals: finalTotals,
      deptStats,
      trend,
      over: finalTotals.filter(t=>t.total>70).length,
      avg: finalTotals.length ? Math.round(finalTotals.reduce((a,b)=>a+b.total,0)/finalTotals.length*10)/10 : 0
    };
  });

  const DEPT_COLORS_JSON = JSON.stringify(DEPT_COLORS);
  const NV_COLORS_JSON = JSON.stringify(NV_COLORS);
  const dataJson = JSON.stringify(monthsData);
  const numCharts = monthsData.length * 4; // bar, trend, dept, deptover per month

  const autoprintScript = mode === 'print' ? `
window.__chartsRendered = 0;
window.__totalCharts = ${numCharts};
function __maybePrint() {
  window.__chartsRendered++;
  if (window.__chartsRendered >= window.__totalCharts) {
    setTimeout(() => window.print(), 400);
  }
}
` : mode === 'pdf' ? `
window.__chartsRendered = 0;
window.__totalCharts = ${numCharts};
window.__pdfReady = false;
function __maybePrint() {
  window.__chartsRendered++;
  if (window.__chartsRendered >= window.__totalCharts) {
    setTimeout(() => { window.__pdfReady = true; }, 250);
  }
}
` : `
function __maybePrint() {}
`;

  const html = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="UTF-8">
<title>Báo cáo OT — ${new Date().toLocaleDateString('vi-VN')}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<script>${atob(CHART_JS_B64_FOR_REPORT)}<\/script>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:14px; color:#211F1C; background:#F0EAE0; padding:20px; -webkit-font-smoothing:antialiased; }
  .num, .mv { font-family:'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace; font-feature-settings:"tnum" 1; }
  .shell { max-width:1000px; margin:0 auto; }
  h1 { font-size:22px; font-weight:700; margin-bottom:4px; letter-spacing:-0.01em; }
  .sub { font-size:12px; color:#8A8378; margin-bottom:24px; font-family:'JetBrains Mono', monospace; }
  .month-section { background:#fff; border:1px solid rgba(33,31,28,.09); border-radius:14px; padding:20px; margin-bottom:24px; page-break-inside: avoid; }
  .month-title { font-size:17px; font-weight:700; margin-bottom:12px; border-bottom:1px solid rgba(33,31,28,.09); padding-bottom:10px; }
  .metrics { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:8px; margin-bottom:16px; }
  .mc { background:#F7F3EC; border-left:3px solid rgba(33,31,28,.16); border-radius:10px; padding:10px 14px; }
  .mc .ml { font-size:10.5px; color:#8A8378; margin-bottom:3px; text-transform:uppercase; letter-spacing:.06em; font-weight:600; }
  .mc .mv { font-size:20px; font-weight:700; }
  .mc.red { border-left-color:#B14B3F; } .mc.red .mv { color:#B14B3F; }
  .mc.amber { border-left-color:#B5731E; } .mc.amber .mv { color:#B5731E; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
  @media (max-width:700px){ .grid2{grid-template-columns:1fr;} }
  .chart-card { background:#F7F3EC; border-radius:10px; padding:12px; }
  .chart-card .ct { font-size:13px; font-weight:600; margin-bottom:8px; }
  canvas { max-height:260px; }
  table { width:100%; border-collapse:collapse; font-size:12px; margin-top:8px; }
  th { text-align:left; padding:6px 8px; color:#8A8378; font-weight:600; border-bottom:1px solid rgba(33,31,28,.09); font-size:10.5px; text-transform:uppercase; letter-spacing:.05em; }
  td { padding:6px 8px; border-bottom:1px solid rgba(33,31,28,.09); }
  .badge { display:inline-block; padding:2px 9px; border-radius:999px; font-size:10px; font-weight:700; }
  .bd{background:#FBEDE9;color:#B14B3F;} .bw{background:#FCEFDD;color:#B5731E;} .bo{background:#EAF1E3;color:#5E7A4F;}
  .legend { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px; font-size:11px; color:#8A8378; font-family:'JetBrains Mono', monospace; }
  .legend span { display:flex; align-items:center; gap:3px; }
  .ldot { width:9px; height:9px; border-radius:2px; flex-shrink:0; }
  @media print {
    body{background:#fff; padding:0;}
    .shell{max-width:100%;}
    .month-section{border:none; box-shadow:none; page-break-after: always;}
    .month-section:last-child{page-break-after: auto;}
  }
</style></head>
<body>
<div class="shell">
  <div class="cover" style="background:#fff;border:1px solid rgba(33,31,28,.09);border-radius:14px;padding:24px 20px;margin-bottom:24px;">
    <h1>Báo cáo OT</h1>
    <div class="sub" style="margin-bottom:0">Xuất ngày ${new Date().toLocaleString('vi-VN')} &middot; Giới hạn 70h/tháng (chu kỳ 16 &rarr; 15)</div>
  </div>
  <div id="root"></div>
</div>
<script>
${autoprintScript}
const MONTHS = ${dataJson};
const DEPT_COLORS = ${DEPT_COLORS_JSON};
const NV_COLORS = ${NV_COLORS_JSON};
function stOf(t){ return t>70?'d':'o'; }
function stBadge(t){ const s=stOf(t); return s==='d'?'<span class="badge bd">Vượt mức</span>':'<span class="badge bo">Bình thường</span>'; }

const root = document.getElementById('root');
if (!MONTHS.length) {
  root.innerHTML = '<div class="month-section">Không có dữ liệu.</div>';
  __maybePrint(); __maybePrint(); __maybePrint(); __maybePrint();
}
MONTHS.forEach((m, idx) => {
  const sec = document.createElement('div');
  sec.className = 'month-section';
  sec.innerHTML = \`
    <div class="month-title">\${m.label}</div>
    <div class="metrics">
      <div class="mc"><div class="ml">Nhân viên</div><div class="mv">\${m.totals.length}</div></div>
      <div class="mc red"><div class="ml">Vượt 70h</div><div class="mv">\${m.over}</div></div>
      <div class="mc"><div class="ml">OT trung bình</div><div class="mv">\${m.avg}h</div></div>
    </div>
    <div class="grid2">
      <div class="chart-card">
        <div class="ct">Tổng OT cả tháng — từng nhân viên</div>
        <canvas id="bar_\${idx}"></canvas>
      </div>
      <div class="chart-card">
        <div class="ct">Xu hướng luỹ kế (top 5 NV)</div>
        <div class="legend" id="leg_\${idx}"></div>
        <canvas id="trend_\${idx}"></canvas>
      </div>
    </div>
    <div class="grid2">
      <div class="chart-card">
        <div class="ct">Tổng OT luỹ kế theo phòng ban</div>
        <canvas id="dept_\${idx}"></canvas>
      </div>
      <div class="chart-card">
        <div class="ct">% nhân viên vượt 70h / phòng ban</div>
        <canvas id="deptover_\${idx}"></canvas>
      </div>
    </div>
    <table>
      <thead><tr><th>Nhân viên</th><th>Phòng ban</th><th>Tổng OT</th><th>% Giới hạn</th><th>Trạng thái</th></tr></thead>
      <tbody>
        \${m.totals.map(t => \`<tr>
          <td style="font-weight:500">\${t.name}</td>
          <td style="color:#6b6b67">\${t.dept}</td>
          <td style="font-weight:500">\${t.total}h</td>
          <td>\${Math.min(100,Math.round(t.total/70*100))}%</td>
          <td>\${stBadge(t.total)}</td>
        </tr>\`).join('')}
      </tbody>
    </table>
  \`;
  root.appendChild(sec);

  // Bar chart: final totals
  const cols = m.totals.map(t => t.total>70?'#C0392B':'#7A9468');
  new Chart(document.getElementById('bar_'+idx), {
    type:'bar',
    data:{ labels: m.totals.map(t=>t.staffCode?(t.staffCode+' - '+t.name):t.name),
           datasets:[{data:m.totals.map(t=>t.total), backgroundColor:cols, borderWidth:0, borderRadius:4}]},
    options:{ responsive:true, maintainAspectRatio:true,
      plugins:{legend:{display:false}},
      scales:{x:{ticks:{font:{size:9},autoSkip:true,maxRotation:40}}, y:{ticks:{font:{size:10}}}},
      animation:{onComplete:__maybePrint}}
  });

  // Trend chart
  document.getElementById('leg_'+idx).innerHTML = m.trend.map((t,i)=>
    \`<span><span class="ldot" style="background:\${NV_COLORS[i%NV_COLORS.length]}"></span>\${t.staffCode?(t.staffCode+' - '+t.name):t.name}</span>\`).join('');
  new Chart(document.getElementById('trend_'+idx), {
    type:'line',
    data:{ labels: m.periodLabels.map(l=>l.replace(/^Week \d+ · /,'')),
           datasets: m.trend.map((t,i)=>({ label:t.staffCode?(t.staffCode+' - '+t.name):t.name, data:t.data,
             borderColor:NV_COLORS[i%NV_COLORS.length], backgroundColor:'transparent',
             tension:.3, borderWidth:2, pointRadius:3 })) },
    options:{ responsive:true, maintainAspectRatio:true,
      plugins:{legend:{display:false}},
      scales:{x:{ticks:{font:{size:9}}}, y:{ticks:{font:{size:10}}}},
      animation:{onComplete:__maybePrint}}
  });

  // Dept avg chart
  new Chart(document.getElementById('dept_'+idx), {
    type:'bar',
    data:{ labels: m.deptStats.map(d=>d.name),
           datasets:[{data:m.deptStats.map(d=>d.total),
             backgroundColor:m.deptStats.map((_,i)=>DEPT_COLORS[i%DEPT_COLORS.length]), borderWidth:0, borderRadius:4}]},
    options:{ responsive:true, maintainAspectRatio:true,
      plugins:{legend:{display:false}},
      scales:{y:{max:80,ticks:{font:{size:10}}}, x:{ticks:{font:{size:10}}}},
      animation:{onComplete:__maybePrint}}
  });

  // Dept over% doughnut
  new Chart(document.getElementById('deptover_'+idx), {
    type:'doughnut',
    data:{ labels: m.deptStats.map(d=>d.name),
           datasets:[{data:m.deptStats.map(d=>Math.max(d.overPct,0.5)),
             backgroundColor:m.deptStats.map((_,i)=>DEPT_COLORS[i%DEPT_COLORS.length]), borderWidth:2, borderColor:'#fff'}]},
    options:{ responsive:true, maintainAspectRatio:true, cutout:'55%',
      plugins:{legend:{position:'bottom', labels:{font:{size:10}}}},
      animation:{onComplete:__maybePrint}}
  });
});
<\/script>
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
    const sectionEls = Array.from(doc.querySelectorAll('.month-section'));
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
      body: JSON.stringify({ action: 'save', data: { ot: DB, late: LATE_DB, off: OFF_DB, projects: PROJECTS_DB } })
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

const WLB_THRESHOLD = 10;
function wlbRatio(off, ot) { return ot ? Math.round((off/ot)*10)/10 : null; }
function wlbColor(v) { return v===null?'var(--text3)':v>WLB_THRESHOLD?'var(--green)':'var(--red)'; }
function wlbBadge(v) { return v===null?'<span style="color:var(--text3)">—</span>':v>WLB_THRESHOLD?'<span class="badge bo">✅ Đạt</span>':'<span class="badge bd">⚠️ Không đạt</span>'; }

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
    <td style="font-family:var(--font-mono);font-weight:700;color:${wlbColor(r.wlb)}" title="${r.ot===0 ? 'Không có OT trong kỳ này nên không tính được tỷ lệ WLB (chia cho 0)' : ''}">${r.wlb??(r.ot===0?'N/A':'—')}</td>
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
      <div class="mc ${ok?'green':'red'}"><div class="ml">WLB = off ÷ OT</div><div class="mv">${ratio??'—'}</div><div class="ms">${ok?'✅ Đạt (>10)':'⚠️ Không đạt (≤10)'}</div></div>`;

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
            tooltip:{callbacks:{label:c=>` ${c.dataset.label}: ${c.raw}${c.datasetIndex<2?'':'  ('+((c.raw??'—')>THRESHOLD?'Đạt':'Không đạt')+')'}`}} },
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
      const projEntries = projectsInGroup('HCM-EC').sort().map(proj => {
        const w = getProjectWlbForMonth('HCM-EC', proj, monthNumP);
        return { name: proj.replace(/^HCM\s+/i,''), value: w.wlb };
      }).filter(e => e.value !== null && e.value !== undefined);
      renderGenericProjectBarChart(WLB_CH, killWlbChart, 'cWlbProjMonth',
        document.getElementById('cWlbProjMonth'), document.getElementById('cWlbProjMonthEmpty'),
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
            { label:'Ngưỡng 10', data:cmpMks.map(()=>THRESHOLD),
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
          <td style="font-family:var(--font-mono);font-weight:700;color:${wlbColor(v)}">${v??'—'}</td>
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
          <td style="font-family:var(--font-mono);font-weight:700;color:${wlbColor(v)}">${v??'—'}</td>
          <td>${wlbBadge(v)}</td></tr>`);
        if (d === 'HCM-EC') {
          const monthNum = parseInt(mk.split('-')[1], 10);
          const projRows = projectsInGroup('HCM-EC').sort().map(proj => {
            const w = getProjectWlbForMonth('HCM-EC', proj, monthNum);
            return { name: proj, display: w.wlb ?? '—', nv: PROJECTS_DB['HCM-EC'][proj].employees.length };
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
      const projEntriesQ = projectsInGroup('HCM-EC').sort().map(proj => {
        const w = getProjectWlbForMonths('HCM-EC', proj, monthNumsQ);
        return { name: proj.replace(/^HCM\s+/i,''), value: w.wlb };
      }).filter(e => e.value !== null && e.value !== undefined);
      renderGenericProjectBarChart(WLB_CH, killWlbChart, 'cWlbProjQtr',
        document.getElementById('cWlbProjQtr'), document.getElementById('cWlbProjQtrEmpty'),
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
            { label:'Ngưỡng 10', data:qKeys.map(()=>THRESHOLD),
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
          <td style="font-family:var(--font-mono);font-weight:700;color:${wlbColor(v)}">${v??'—'}</td>
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
          <td style="font-family:var(--font-mono);font-weight:700;color:${wlbColor(v)}">${v??'—'}</td>
          <td>${wlbBadge(v)}</td></tr>`);
        if (d === 'HCM-EC') {
          const monthNums = mks.map(mk => parseInt(mk.split('-')[1], 10));
          const projRows = projectsInGroup('HCM-EC').sort().map(proj => {
            const w = getProjectWlbForMonths('HCM-EC', proj, monthNums);
            return { name: proj, display: w.wlb ?? '—', nv: PROJECTS_DB['HCM-EC'][proj].employees.length };
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
    rebuildLateUI();
    renderWlbSummary();
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('appBody').style.display = 'block';
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
