// ── Xuất Tiến độ dự án ra PDF (khổ ngang, bảng chi tiết + Gantt, tuỳ chọn định dạng) ──
// Dựng từng trang bằng HTML (đúng font tiếng Việt) rồi chụp bằng html2canvas → jsPDF.
const PGP = { W: 1400, H: 990, PAD: 22, RH: 22 };   // px / trang (tỉ lệ A4 ngang, dùng chung cho A3)
const PGP_COLS = [['who', 'Người thực hiện', 120], ['dur', 'Duration', 62], ['st', 'Start', 84], ['fn', 'Finish', 84], ['pc', '% HT', 46], ['stat', 'Trạng thái', 92], ['pred', 'Predecessors', 110]];

function progPdfDialog() {
  const pr = PROG_DB[progSel]; if (!pr) return;
  const maxL = Math.max(...pr.tasks.map(t => t.lvl)) + 1;
  const ov = document.createElement('div'); ov.id = 'progModal'; ov.className = 'pg-modal';
  ov.innerHTML = `<div class="pg-mbox" style="max-width:560px"><div style="font-size:18px;font-weight:800;margin-bottom:4px">Xuất tiến độ ra PDF</div>
    <div style="font-size:12.5px;color:#6b7280;margin-bottom:10px">Khổ ngang · ${pgEsc(pr.name)} · ${pr.tasks.length} công việc</div>
    <label>Nội dung<select id="pgpMode"><option value="both">Bảng chi tiết + biểu đồ Gantt</option><option value="table">Chỉ bảng chi tiết</option><option value="gantt">Chỉ Gantt (tên việc + thanh tiến độ)</option></select></label>
    <label>Khổ giấy<select id="pgpSize"><option value="a4">A4 ngang</option><option value="a3">A3 ngang (dự án nhiều việc, chữ to rõ)</option></select></label>
    <label>Hiển thị đến cấp<select id="pgpLvl">${Array.from({ length: maxL }, (_, i) => `<option value="${i}"${i === maxL - 1 ? ' selected' : ''}>${i === maxL - 1 ? 'Tất cả các cấp' : 'Đến cấp ' + (i + 1)}</option>`).join('')}</select></label>
    <div style="margin-top:10px;font-weight:700;font-size:13px">Cột trong bảng</div>
    <div class="pg-perm-grid" style="margin-top:4px">${PGP_COLS.map(c => `<label class="pg-perm"><input type="checkbox" class="pgpCol" value="${c[0]}" checked> ${c[1]}</label>`).join('')}</div>
    <div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">
      <label class="pg-perm"><input type="checkbox" id="pgpHideDone"> Ẩn công việc đã hoàn thành 100%</label>
      <label class="pg-perm"><input type="checkbox" id="pgpToday" checked> Hiện đường "Hôm nay" và % thực tế trên Gantt</label></div>
    <label style="margin-top:8px">Tiêu đề báo cáo<input id="pgpTitle" value="${pgEsc('TIẾN ĐỘ DỰ ÁN — ' + pr.name)}"></label>
    <label>Người lập (hiện ở chân trang)<input id="pgpBy" placeholder="Tên người lập (tuỳ chọn)"></label>
    <div class="action-row" style="justify-content:flex-end;margin-top:12px"><button class="btn" onclick="progCloseModal()">Huỷ</button><button class="btn btn-primary" id="pgpGo" onclick="progPdfRun()">⬇ Xuất PDF</button></div></div>`;
  document.body.appendChild(ov);
}

function progPdfPages(pr, o) {
  const C = progCalc(pr), td = pgToday(), sm = progSummary(pr), T = pr.tasks;
  // chọn dòng
  let idx = T.map((t, i) => i).filter(i => T[i].lvl <= o.lvl);
  if (o.hideDone) idx = idx.filter(i => !(C[i].pct >= 100 && !C[i].sum));
  if (o.hideDone) { const keep = new Set(idx); idx = idx.filter(i => !C[i].sum || [...Array(C.end[i] - i - 1).keys()].some(k => keep.has(i + 1 + k) && !C[i + 1 + k].sum)); }
  if (!idx.length) throw new Error('Không có công việc nào để xuất.');
  const cols = PGP_COLS.filter(c => o.cols.includes(c[0]));
  const showT = o.mode !== 'gantt', showG = o.mode !== 'table';
  const IDW = 34, colsW = o.mode === 'gantt' ? 0 : cols.reduce((a, c) => a + c[2], 0), NMW = o.mode === 'table' ? PGP.W - PGP.PAD * 2 - IDW - colsW : (o.mode === 'gantt' ? 380 : 330);
  const tblW = IDW + NMW + (showT ? cols.reduce((a, c) => a + c[2], 0) : 0);
  const gW = showG ? PGP.W - PGP.PAD * 2 - tblW : 0;
  let minN = Infinity, maxN = -Infinity; idx.forEach(i => { minN = Math.min(minN, C[i].s); maxN = Math.max(maxN, C[i].f); });
  if (o.today && td >= minN - 30 && td <= maxN + 30) { minN = Math.min(minN, td); maxN = Math.max(maxN, td); }
  minN -= 2; maxN += 3; const days = maxN - minN + 1, pxd = showG ? gW / days : 0, X = n => (n - minN) * pxd;
  const perPage = Math.floor((PGP.H - PGP.PAD * 2 - 92 - 46 - 34) / PGP.RH);
  const pages = []; for (let k = 0; k < idx.length; k += perPage) pages.push(idx.slice(k, k + perPage));
  const hl = sm.health, st = n => pgFmt(n, true);
  // thang thời gian (tháng + tuần)
  const head = (() => {
    if (!showG) return '';
    let m = '', w = '';
    for (let n = minN; n <= maxN;) {
      const d = new Date(n * 864e5), y = d.getUTCFullYear(), mo = d.getUTCMonth(), me = Date.UTC(y, mo + 1, 1) / 864e5 - 1, b = Math.min(maxN, me);
      m += `<div class="gp-hm" style="left:${X(n)}px;width:${(b - n + 1) * pxd}px">${pxd * (b - n + 1) > 46 ? `T${mo + 1}/${y}` : mo + 1}</div>`; n = me + 1;
    }
    if (pxd * 7 >= 22) for (let n = minN; n <= maxN; n++) if (pgDow(n) === 1) w += `<div class="gp-hw" style="left:${X(n)}px;width:${7 * pxd}px">${new Date(n * 864e5).getUTCDate()}</div>`;
    return `<div class="gp-gh" style="width:${gW}px">${m}${w}</div>`;
  })();
  const grid = (() => { if (!showG) return ''; let g = ''; for (let n = minN; n <= maxN; n++) { const d = new Date(n * 864e5); if (d.getUTCDate() === 1) g += `<i class="gp-vl" style="left:${X(n)}px"></i>`; } return g; })();
  const out = [];
  pages.forEach((rows, pi) => {
    let body = '';
    rows.forEach((i, r) => {
      const t = T[i], c = C[i], sum = c.sum, ms = !sum && c.dur === 0, stt = PG_ST[progStat(t, c, td)], pad = t.lvl * 14;
      const cells = { who: t.who || '', dur: sum ? c.dur + ' ngày' : (ms ? 'Mốc' : c.dur + (c.dur === 1 ? ' day' : ' days')), st: st(c.s), fn: st(c.f), pc: c.pct + '%', stat: sum ? '' : stt[0], pred: pgPredText(pr, t) };
      let bar = '';
      if (showG) {
        const x = X(c.s), w = Math.max(3, (c.f - c.s + 1) * pxd);
        if (ms) bar = `<i class="gp-ms" style="left:${X(c.s) + pxd / 2 - 6}px"></i>`;
        else if (sum) bar = `<i class="gp-sum" style="left:${x}px;width:${w}px"></i>`;
        else bar = `<i class="gp-bar" style="left:${x}px;width:${w}px;background:${stt[1]}55;border-color:${stt[1]}"><b style="width:${c.pct}%;background:${stt[1]}"></b></i>`;
        if (!ms && w > 30 && o.today) bar += `<span class="gp-pc" style="left:${x + w + 3}px">${c.pct}%</span>`;
      }
      body += `<div class="gp-r${sum ? ' s' : ''}${r % 2 ? ' z' : ''}"><div class="gp-c gp-id" style="width:${IDW}px">${i + 1}</div><div class="gp-c gp-nm" style="width:${NMW}px;padding-left:${6 + pad}px">${pgEsc(t.name)}</div>`
        + (showT ? cols.map(cc => `<div class="gp-c${cc[0] === 'stat' ? ' gp-st' : ''}" style="width:${cc[2]}px;${cc[0] === 'stat' && !sum ? 'color:' + stt[1] + ';font-weight:700' : ''}">${pgEsc(cells[cc[0]])}</div>`).join('') : '')
        + (showG ? `<div class="gp-g" style="width:${gW}px">${grid}${bar}</div>` : '') + '</div>';
    });
    const th = `<div class="gp-r gp-th"><div class="gp-c gp-id" style="width:${IDW}px">ID</div><div class="gp-c gp-nm" style="width:${NMW}px">Task Name</div>${showT ? cols.map(cc => `<div class="gp-c" style="width:${cc[2]}px">${cc[1]}</div>`).join('') : ''}${head}</div>`;
    const todayLine = showG && o.today && td >= minN && td <= maxN ? `<i class="gp-today" style="left:${tblW + X(td) + pxd / 2}px;top:46px;height:${rows.length * PGP.RH}px"></i>` : '';
    out.push(`<div class="gp-pg" style="width:${PGP.W}px;height:${PGP.H}px;padding:${PGP.PAD}px">
      <div class="gp-top"><div><div class="gp-ttl">${pgEsc(o.title)}</div><div class="gp-sub">${pgFmt(sm.root.s)} → ${pgFmt(sm.root.f)} · ${sm.root.f - sm.root.s + 1} ngày · ${T.length} công việc · ${pgEsc(sm.label)}</div></div>
        <div class="gp-kpi"><span style="background:${hl[1]}">${pgEsc(hl[0])}</span><div><b>${sm.root.pct}%</b> thực tế<br><b>${Math.round((sm.root.plan || 0) * 100)}%</b> kế hoạch</div></div></div>
      <div class="gp-tbl" style="position:relative">${th}${body}${todayLine}</div>
      <div class="gp-leg">${Object.values(PG_ST).map(s => `<span><i style="background:${s[1]}"></i>${s[0]}</span>`).join('')}<span><i class="sm"></i>Nhóm</span><span><i class="ms2"></i>Mốc</span>${o.today ? '<span><i class="td"></i>Hôm nay</span>' : ''}</div>
      <div class="gp-ft"><span>${pgEsc(o.by ? 'Người lập: ' + o.by + ' · ' : '')}Xuất ngày ${pgFmt(td)} · HCM Management Dashboard</span><span>Trang ${pi + 1}/${pages.length}</span></div></div>`);
  });
  return out;
}

async function progPdfRun() {
  const pr = PROG_DB[progSel]; if (!pr) return;
  const g = id => document.getElementById(id), btn = g('pgpGo');
  const o = { mode: g('pgpMode').value, size: g('pgpSize').value, lvl: +g('pgpLvl').value, cols: [...document.querySelectorAll('.pgpCol:checked')].map(x => x.value), hideDone: g('pgpHideDone').checked, today: g('pgpToday').checked, title: g('pgpTitle').value.trim() || pr.name, by: g('pgpBy').value.trim() };
  btn.disabled = true; btn.textContent = 'Đang dựng…';
  let host;
  try {
    const pages = progPdfPages(pr, o);
    host = document.createElement('div'); host.style.cssText = `position:fixed;left:-99999px;top:0;width:${PGP.W}px;background:#fff`;
    host.innerHTML = `<style>${PGP_CSS}</style>` + pages.join(''); document.body.appendChild(host);
    const { jsPDF } = window.jspdf, A = o.size === 'a3' ? [420, 297] : [297, 210];
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: o.size });
    const els = [...host.querySelectorAll('.gp-pg')];
    for (let k = 0; k < els.length; k++) {
      btn.textContent = `Trang ${k + 1}/${els.length}…`; await new Promise(r => setTimeout(r, 30));
      const cv = await html2canvas(els[k], { scale: o.size === 'a3' ? 2 : 2, backgroundColor: '#fff', logging: false });
      if (k) pdf.addPage(o.size, 'landscape');
      pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, A[0], A[1]);
    }
    pdf.save(`Tien-do-${pr.name.replace(/[^\w-]+/g, '_')}-${puToday()}.pdf`);
    progCloseModal(); toast('✅ Đã xuất PDF ' + els.length + ' trang.');
  } catch (e) { console.error(e); toast('⚠️ Lỗi xuất PDF: ' + (e.message || e)); btn.disabled = false; btn.textContent = '⬇ Xuất PDF'; }
  finally { if (host) host.remove(); }
}

const PGP_CSS = `.gp-pg{box-sizing:border-box;background:#fff;font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;position:relative;overflow:hidden}
.gp-pg *{box-sizing:border-box}.gp-top{height:92px;display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #2D6CDF;padding-bottom:10px;margin-bottom:0}
.gp-ttl{font-size:24px;font-weight:800;color:#12254a}.gp-sub{margin-top:6px;font-size:13px;color:#5b6b8a}
.gp-kpi{display:flex;align-items:center;gap:12px;font-size:12.5px;line-height:1.5;color:#374151;text-align:right}.gp-kpi span{color:#fff;font-weight:700;padding:5px 14px;border-radius:20px;font-size:13px}
.gp-tbl{margin-top:0;border-top:none}.gp-r{display:flex;height:${PGP.RH}px;border-bottom:1px solid #e5e9f2;font-size:11.5px;align-items:stretch}.gp-r.z{background:#f7f9fd}.gp-r.s{font-weight:700;background:#eef3fc}
.gp-c{padding:0 6px;display:flex;align-items:center;white-space:nowrap;overflow:hidden;border-right:1px solid #eef1f7;text-overflow:ellipsis;flex:none}.gp-id{justify-content:center;color:#8a93a6;padding:0}.gp-nm{display:block;line-height:${PGP.RH}px;overflow:hidden;text-overflow:ellipsis}
.gp-th{height:46px;background:#12254a;color:#fff;font-weight:700;font-size:11.5px;margin-top:0;border-bottom:none}.gp-th .gp-c{border-right:1px solid #2a3f6b;color:#fff}
.gp-gh{position:relative;height:46px;flex:none;border-left:1px solid #2a3f6b}.gp-hm{position:absolute;top:0;height:23px;line-height:23px;text-align:center;border-right:1px solid #2a3f6b;font-size:11px;overflow:hidden;white-space:nowrap}
.gp-hw{position:absolute;top:23px;height:23px;line-height:23px;text-align:center;font-size:9px;border-right:1px solid #2a3f6b55;color:#cdd8ee;overflow:hidden}
.gp-g{position:relative;flex:none;overflow:visible}.gp-vl{position:absolute;top:0;bottom:0;width:1px;background:#dfe5f1}
.gp-bar{position:absolute;top:5px;height:12px;border:1px solid;border-radius:3px;overflow:hidden}.gp-bar b{display:block;height:100%}
.gp-sum{position:absolute;top:8px;height:6px;background:#111827;border-radius:1px}.gp-ms{position:absolute;top:5px;width:12px;height:12px;background:#111827;transform:rotate(45deg)}
.gp-pc{position:absolute;top:4px;font-size:9.5px;color:#374151;white-space:nowrap}.gp-today{position:absolute;width:2px;background:#E5322D;z-index:3}
.gp-leg{display:flex;gap:16px;margin-top:8px;font-size:11px;color:#4b5563;align-items:center}.gp-leg i{display:inline-block;width:14px;height:9px;border-radius:2px;margin-right:5px;vertical-align:middle}.gp-leg .sm{background:#111827;height:5px}.gp-leg .ms2{background:#111827;width:9px;height:9px;transform:rotate(45deg)}.gp-leg .td{background:#E5322D;width:3px;height:12px}
.gp-ft{position:absolute;left:${PGP.PAD}px;right:${PGP.PAD}px;bottom:14px;display:flex;justify-content:space-between;font-size:10.5px;color:#8a93a6;border-top:1px solid #e5e9f2;padding-top:6px}`;
