// ============================================================
//  TIẾN ĐỘ DỰ ÁN — các giao diện trong trang dự án (mở ở tab riêng):
//  Tổng quan · Danh sách · Gantt (trong progress.js) · Bảng (Kanban) · Nguồn lực · Lịch biểu · Giao hàng PU
// ============================================================
let progCharts = [], progChartJobs = [];
function progDestroyCharts() { progCharts.forEach(c => { try { c.destroy(); } catch (e) {} }); progCharts = []; progChartJobs = []; }
function progAfterView() {
  try {
    if (progView === 'gantt') progAfterGantt();
    progChartJobs.forEach(j => { const cv = document.getElementById(j.id); if (cv && typeof Chart !== 'undefined') progCharts.push(new Chart(cv, j.cfg)); });
  } catch (e) { console.error(e); }
}
const pgStPill = k => `<span class="pg-pill" style="background:${PG_ST[k][1]}">${PG_ST[k][0]}</span>`;
const pgCan = () => canEditProgress();
const pgTaskLi = (pr, C, i, extra) => `<li class="pg-li"${pgCan() ? ` onclick="progEdit(${i})" style="cursor:pointer"` : ''}><span class="pg-li-n">${pgEsc(pr.tasks[i].name)}</span><span class="pg-li-d">${extra || (pgFmt(C[i].s) + ' → ' + pgFmt(C[i].f))}${pr.tasks[i].who ? ' · ' + pgEsc(pr.tasks[i].who) : ''}</span></li>`;
const pgTile = (v, l, col) => `<div class="mk"><b style="${col ? 'color:' + col : ''}">${v}</b><span>${l}</span></div>`;

// ── 1. Tổng quan ──
function progViewDash(name, sm) {
  const pr = PROG_DB[name], T = pr.tasks, C = sm.C, today = pgToday(), root = sm.root, cn = sm.cnt, pu = sm.pu;
  const leaf = i => !C[i].sum && !C[i].nodata;
  const soon = T.map((t, i) => i).filter(i => leaf(i) && C[i].pct < 100 && C[i].s >= today && C[i].s <= today + 14).sort((a, b) => C[a].s - C[b].s).slice(0, 8);
  const acts = []; T.forEach((t, i) => (t.log || []).forEach(l => acts.push({ i, l }))); acts.sort((a, b) => b.l.at - a.l.at);
  const puList = pu.items.map(x => ({ x, s: puStatus(x) })).filter(o => ['late', 'soon7'].includes(o.s.k)).sort((a, b) => (puEst(a.x) || '9').localeCompare(puEst(b.x) || '9')).slice(0, 8);
  progChartJobs.push({ id: 'progChSt', cfg: { type: 'doughnut', data: { labels: Object.keys(PG_ST).map(k => PG_ST[k][0]), datasets: [{ data: Object.keys(PG_ST).map(k => cn[k]), backgroundColor: Object.keys(PG_ST).map(k => PG_ST[k][1]) }] }, options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'right' } } } } });
  const stg = sm.stages;
  progChartJobs.push({ id: 'progChStage', cfg: { type: 'bar', data: { labels: stg.map(i => T[i].name.length > 26 ? T[i].name.slice(0, 25) + '…' : T[i].name), datasets: [{ label: 'Kế hoạch %', data: stg.map(i => Math.round(C[i].plan * 100)), backgroundColor: '#2D6CDF' }, { label: 'Thực tế %', data: stg.map(i => C[i].pct), backgroundColor: '#F0A020' }] }, options: { maintainAspectRatio: false, indexAxis: 'y', scales: { x: { min: 0, max: 100 } } } } });
  const empty = '<li style="color:var(--text3);list-style:none">Không có</li>';
  return `<div class="mp-kpi">
    ${pgTile(root.pct + '%', 'Hoàn thành thực tế', '#F0A020')}${pgTile(sm.plan + '%', 'Kế hoạch (theo thời gian)', '#2D6CDF')}
    ${pgTile(sm.k === 'over' ? -sm.remain : sm.k === 'wait' ? '—' : sm.remain + 1, sm.k === 'over' ? 'Ngày trễ hạn' : sm.k === 'done' ? 'Đã hoàn thành' : 'Ngày còn lại', PG_COL[sm.k])}
    ${pgTile(cn.late, 'Việc trễ hạn', '#C0392B')}${pgTile(cn.run, 'Đang thực hiện', '#2D6CDF')}${pgTile(pu.total ? pu.done + '/' + pu.total : '—', 'Hàng PU đã giao' + (pu.late ? ' · ' + pu.late + ' trễ' : ''), pu.late ? '#C0392B' : '')}</div>
  <div class="pg-dgrid">
    <div class="card"><div class="card-title">Trạng thái công việc</div><div style="height:230px"><canvas id="progChSt"></canvas></div></div>
    <div class="card"><div class="card-title">Tiến độ theo giai đoạn — kế hoạch / thực tế</div><div style="height:230px"><canvas id="progChStage"></canvas></div></div>
    <div class="card"><div class="card-title">⚠ Việc trễ hạn (${sm.overdue.length})</div><ul class="pg-ul">${sm.overdue.slice(0, 10).map(i => pgTaskLi(pr, C, i, 'Hạn ' + pgFmt(C[i].f) + ' · ' + C[i].pct + '%')).join('') || empty}</ul></div>
    <div class="card"><div class="card-title">Sắp bắt đầu trong 14 ngày</div><ul class="pg-ul">${soon.map(i => pgTaskLi(pr, C, i)).join('') || empty}</ul></div>
    <div class="card"><div class="card-title">Đang thực hiện (${cn.run})</div><ul class="pg-ul">${sm.cur.slice(0, 10).map(i => pgTaskLi(pr, C, i, C[i].pct + '% · hạn ' + pgFmt(C[i].f))).join('') || empty}</ul></div>
    <div class="card"><div class="card-title">🚚 Hàng PU cần chú ý</div><ul class="pg-ul">${puList.map(o => `<li class="pg-li"><span class="pg-li-n">${pgEsc(o.x.name)}</span><span class="pg-li-d">${pgStPill(o.s.k === 'late' ? 'late' : 'run').replace(PG_ST[o.s.k === 'late' ? 'late' : 'run'][0], o.s.k === 'late' ? 'Trễ' : 'Sắp giao')} ${puFmt(puEst(o.x))}</span></li>`).join('') || empty}</ul></div>
    <div class="card" style="grid-column:1/-1"><div class="card-title">Hoạt động gần đây</div><ul class="pg-ul">${acts.slice(0, 12).map(a => { const d = new Date(a.l.at); return `<li class="pg-li"><span class="pg-li-n"><b>${pgEsc(a.l.by || '')}</b> cập nhật <i>${pgEsc(T[a.i].name)}</i> → ${a.l.pct}%${a.l.hold ? ' (tạm dừng)' : ''}${a.l.note ? ' — ' + pgEsc(a.l.note) : ''}</span><span class="pg-li-d">${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</span></li>`; }).join('') || empty}</ul></div>
  </div>`;
}

// ── 2. Danh sách ──
function progViewList(name, sm) {
  const pr = PROG_DB[name], T = pr.tasks, C = sm.C, today = pgToday(), edit = pgCan(), q = progQ.trim().toLowerCase();
  const filt = !!q || progStF !== 'all';
  let idxs;
  if (filt) idxs = T.map((t, i) => i).filter(i => !C[i].sum && !C[i].nodata && (progStF === 'all' || progStat(T[i], C[i], today) === progStF) && (!q || (T[i].name + ' ' + (T[i].who || '')).toLowerCase().includes(q)));
  else idxs = progVisible(pr);
  const rows = idxs.map(i => {
    const t = T[i], c = C[i], sum = c.sum, stt = progStat(t, c, today), pad = filt ? 6 : 6 + t.lvl * 14;
    const tg = (!filt && sum) ? `<span class="pg-tg" data-u="${pgEsc(t.u)}" onclick="progToggle(this.dataset.u)">${progCollapsed.has(t.u) ? '▸' : '▾'}</span>` : '<span class="pg-tg"></span>';
    const pc = (!sum && edit) ? `<input type="number" min="0" max="100" value="${c.pct}" class="pg-pcin" data-i="${i}" onchange="progSetPct(+this.dataset.i,this.value)">%` : c.pct + '%';
    const qty = t.qty ? `${t.qtyDone || 0}/${t.qty} ${pgEsc(t.unit || '')}` : '';
    return `<tr class="${sum ? 'pg-sumr' : ''}"><td class="c" style="color:var(--text3)">${i + 1}</td><td style="padding-left:${pad}px;white-space:nowrap">${tg}<span ${edit ? `class="pg-edit" data-i="${i}" onclick="progEdit(+this.dataset.i)"` : ''}>${t.puLink ? '🚚 ' : ''}${pgEsc(t.name)}</span></td>
      <td>${pgEsc(t.who || '')}</td><td class="c">${c.dur}</td>
      <td class="pg-pbar"><div class="pg-bb" style="width:90px;display:inline-block;vertical-align:middle"><i style="width:${c.pct}%;background:${PG_ST[stt][1]}"></i></div> ${pc}</td>
      <td class="c">${pgFmt(c.s)}</td><td class="c">${pgFmt(c.f)}</td><td class="c">${t.as ? puFmt(t.as) : ''}</td><td class="c">${t.af ? puFmt(t.af) : ''}</td><td class="c">${qty}</td>
      <td class="c">${c.nodata ? '' : pgStPill(stt)}</td>${edit ? `<td class="c" style="white-space:nowrap"><button class="pg-ib" onclick="progEdit(${i})" title="Sửa">✎</button> <button class="pg-ib" onclick="progInsert(${i})" title="Thêm bên dưới">＋</button></td>` : ''}</tr>`;
  }).join('');
  return `<div class="card"><div class="action-row" style="margin-bottom:8px">
    <input type="text" placeholder="Tìm công việc / người thực hiện…" value="${pgEsc(progQ)}" oninput="progQ=this.value;progListRefresh(this)" style="width:240px">
    <select onchange="progStF=this.value;renderProgress()"><option value="all">Tất cả trạng thái</option>${Object.keys(PG_ST).map(k => `<option value="${k}"${progStF === k ? ' selected' : ''}>${PG_ST[k][0]}</option>`).join('')}</select>
    <button class="btn" onclick="progCollapseAll(true)">Thu gọn</button><button class="btn" onclick="progCollapseAll(false)">Mở rộng</button>
    ${edit ? `<button class="btn btn-primary" onclick="progInsert(${T.length - 1})">＋ Công việc</button>` : ''}
    <span style="font-size:12px;color:var(--text2)">${idxs.length} dòng${filt ? ' (đang lọc)' : ''}</span></div>
    <div class="pg-tblw"><table class="pg-tbl"><thead><tr><th>ID</th><th style="text-align:left">Công việc</th><th>Người thực hiện</th><th>Ngày</th><th>Tiến độ</th><th>Bắt đầu KH</th><th>Kết thúc KH</th><th>Bắt đầu TT</th><th>Kết thúc TT</th><th>Khối lượng</th><th>Trạng thái</th>${edit ? '<th></th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function progListRefresh(inp) { const pos = inp.selectionStart; renderProgress(); const ni = document.querySelector('#progView input[type=text]'); if (ni) { ni.focus(); try { ni.setSelectionRange(pos, pos); } catch (e) {} } }

// ── 3. Bảng (Kanban) — kéo thả thẻ để đổi trạng thái ──
function progViewKanban(name, sm) {
  const pr = PROG_DB[name], T = pr.tasks, C = sm.C, today = pgToday(), edit = pgCan();
  const cols = ['wait', 'run', 'late', 'hold', 'done'], by = { wait: [], run: [], late: [], hold: [], done: [] };
  T.forEach((t, i) => { if (C[i].sum || C[i].nodata) return; by[progStat(t, C[i], today)].push(i); });
  const card = i => { const t = T[i], c = C[i], stt = progStat(t, c, today); return `<div class="pg-kc" ${edit ? `draggable="true" ondragstart="progDrag(event,${i})" onclick="progEdit(${i})"` : ''} style="border-left:4px solid ${PG_ST[stt][1]}">
    <b>${pgEsc(t.name)}</b><div class="pg-kd">${pgFmt(c.s)} → ${pgFmt(c.f)}${t.who ? ' · ' + pgEsc(t.who) : ''}</div><div class="pg-bb"><i style="width:${c.pct}%;background:${PG_ST[stt][1]}"></i></div><div class="pg-kd">${c.pct}%</div></div>`; };
  return `<div class="pg-kanban">${cols.map(k => `<div class="pg-kcol" ${edit && k !== 'late' ? `ondragover="event.preventDefault()" ondrop="progDrop(event,'${k}')"` : ''}>
    <div class="pg-kh" style="border-top:3px solid ${PG_ST[k][1]}">${PG_ST[k][0]} <span>${by[k].length}</span></div>${by[k].map(card).join('') || '<div style="color:var(--text3);font-size:12px;padding:6px">—</div>'}</div>`).join('')}</div>
    <div style="font-size:11px;color:var(--text3);margin-top:6px">${edit ? 'Kéo thẻ sang cột khác: <b>Đang thực hiện</b> (đặt ≥ 1%), <b>Hoàn thành</b> (100%), <b>Tạm dừng</b>, <b>Chưa bắt đầu</b> (0%). Cột <b>Trễ</b> tự tính theo ngày, không kéo vào được.' : ''}</div>`;
}
function progDrag(ev, i) { ev.dataTransfer.setData('text/plain', String(i)); }
function progDrop(ev, k) {
  ev.preventDefault(); const i = parseInt(ev.dataTransfer.getData('text/plain'), 10), pr = PROG_DB[progSel]; if (isNaN(i) || !pr) return;
  const cur = pr.tasks[i].pct || 0;
  if (k === 'done') progApply(pr, i, { pct: 100, hold: false, note: 'Chuyển sang Hoàn thành' });
  else if (k === 'run') progApply(pr, i, { pct: cur >= 100 || cur === 0 ? (cur >= 100 ? 90 : 10) : cur, hold: false, note: 'Chuyển sang Đang thực hiện' });
  else if (k === 'wait') progApply(pr, i, { pct: 0, hold: false, note: 'Chuyển về Chưa bắt đầu' });
  else if (k === 'hold') progApply(pr, i, { hold: true, note: 'Tạm dừng' });
  progTouch(pr);
}

// ── 4. Nguồn lực: khối lượng việc theo người, theo tuần ──
function progViewRes(name, sm) {
  const pr = PROG_DB[name], T = pr.tasks, C = sm.C, today = pgToday(), people = {};
  T.forEach((t, i) => {
    if (C[i].sum || C[i].nodata) return;
    const ws = String(t.who || '').split(/[,;]/).map(x => x.trim()).filter(Boolean); (ws.length ? ws : ['(Chưa giao)']).forEach(w => (people[w] = people[w] || []).push(i));
  });
  const names = Object.keys(people).sort((a, b) => a === '(Chưa giao)' ? 1 : b === '(Chưa giao)' ? -1 : a.localeCompare(b));
  if (!names.length) return '<div class="card" style="color:var(--text2)">Chưa có công việc nào.</div>';
  let mn = Infinity, mx = -Infinity; names.forEach(w => people[w].forEach(i => { mn = Math.min(mn, C[i].s); mx = Math.max(mx, C[i].f); }));
  mn -= (pgDow(mn) + 6) % 7; const weeks = []; for (let d = mn; d <= mx && weeks.length < 80; d += 7) weeks.push(d);
  const head = weeks.map(d => `<th class="pg-wk${today >= d && today < d + 7 ? ' now' : ''}" title="Tuần ${pgFmt(d)} – ${pgFmt(d + 6)}">${new Date(d * 86400000).getUTCDate()}/${new Date(d * 86400000).getUTCMonth() + 1}</th>`).join('');
  const body = names.map(w => {
    const ids = people[w], stc = { late: 0, run: 0, done: 0, wait: 0, hold: 0 }; let sum = 0, tot = 0;
    ids.forEach(i => { stc[progStat(T[i], C[i], today)]++; sum += C[i].pct * Math.max(1, C[i].dur); tot += Math.max(1, C[i].dur); });
    const cells = weeks.map(d => { const n = ids.filter(i => C[i].pct < 100 && C[i].s <= d + 6 && C[i].f >= d).length; const col = n === 0 ? '' : n >= 4 ? '#C0392B' : n === 3 ? '#E8A33D' : n === 2 ? '#8fb5f2' : '#cfe0fb'; return `<td class="pg-hc" style="${col ? `background:${col};color:${n >= 3 ? '#fff' : '#1a1d29'}` : ''}">${n || ''}</td>`; }).join('');
    return `<tr><td class="pg-who"><b>${pgEsc(w)}</b><div style="font-size:10.5px;color:var(--text2)">${ids.length} việc · ${stc.run} đang làm${stc.late ? ` · <span style="color:#C0392B">${stc.late} trễ</span>` : ''} · ${Math.round(sum / tot)}% TB</div></td>${cells}</tr>
      <tr><td colspan="${weeks.length + 1}" class="pg-wtasks">${ids.map(i => `<span class="pg-pill" style="background:${PG_ST[progStat(T[i], C[i], today)][1]}"${pgCan() ? ` onclick="progEdit(${i})" style="cursor:pointer"` : ''} title="${pgFmt(C[i].s)} → ${pgFmt(C[i].f)} · ${C[i].pct}%">${pgEsc(T[i].name.length > 34 ? T[i].name.slice(0, 33) + '…' : T[i].name)}</span>`).join(' ')}</td></tr>`;
  }).join('');
  return `<div class="card"><div class="card-title" style="margin-bottom:6px">Nguồn lực — số công việc chưa xong mỗi người theo tuần <span style="font-size:11px;font-weight:400;color:var(--text2)">(đậm = quá tải: ≥ 3 việc cùng tuần)</span></div>
    <div class="pg-tblw"><table class="pg-tbl pg-res"><thead><tr><th style="text-align:left;min-width:220px">Người thực hiện</th>${head}</tr></thead><tbody>${body}</tbody></table></div>
    <div style="font-size:11px;color:var(--text3);margin-top:6px">Điền cột "Người thực hiện" trong công việc (✎) để phân bổ nguồn lực.</div></div>`;
}

// ── 5. Lịch biểu ──
function progCalMove(d) { const [y, m] = (progCalM || pgIso(pgToday()).slice(0, 7)).split('-').map(Number); const n = new Date(Date.UTC(y, m - 1 + d, 1)); progCalM = n.toISOString().slice(0, 7); renderProgress(); }
function progViewCal(name, sm) {
  const pr = PROG_DB[name], T = pr.tasks, C = sm.C, today = pgToday(), mk = progCalM || pgIso(today).slice(0, 7), [y, m] = mk.split('-').map(Number);
  const first = Date.UTC(y, m - 1, 1) / 86400000, last = Date.UTC(y, m, 0) / 86400000, start = first - ((pgDow(first) + 6) % 7);
  const ev = {}; const add = (n, o) => (ev[n] = ev[n] || []).push(o);
  T.forEach((t, i) => {
    const c = C[i]; if (c.sum || c.nodata) return; const stt = progStat(t, c, today), col = PG_ST[stt][1];
    if (c.dur <= 1) add(c.s, { i, txt: '◆ ' + t.name, col }); else { add(c.s, { i, txt: '▶ ' + t.name, col }); add(c.f, { i, txt: '■ ' + t.name, col }); }
  });
  pgPuItems(name).forEach(x => { const n = pgN(x.actual || puEst(x)); if (!isNaN(n)) add(n, { txt: '🚚 ' + x.name, col: PU_STATUS_COLOR[puStatus(x).k] }); });
  let cells = '';
  for (let d = start; d <= last + ((7 - ((pgDow(last) + 6) % 7) - 1) % 7); d++) {
    const inM = d >= first && d <= last, es = ev[d] || [];
    cells += `<div class="pg-cd${inM ? '' : ' out'}${d === today ? ' today' : ''}"><div class="pg-cdn">${new Date(d * 86400000).getUTCDate()}</div>${es.slice(0, 4).map(e => `<div class="pg-ce" style="background:${e.col}22;border-left:3px solid ${e.col}"${e.i != null && pgCan() ? ` onclick="progEdit(${e.i})"` : ''} title="${pgEsc(e.txt)}">${pgEsc(e.txt)}</div>`).join('')}${es.length > 4 ? `<div class="pg-ce" style="color:var(--text2)">+${es.length - 4} nữa</div>` : ''}</div>`;
  }
  return `<div class="card"><div class="action-row" style="margin-bottom:8px"><button class="btn" onclick="progCalMove(-1)">‹</button><b style="min-width:120px;text-align:center">Tháng ${m}/${y}</b><button class="btn" onclick="progCalMove(1)">›</button><button class="btn" onclick="progCalM='';renderProgress()">Hôm nay</button>
    <span style="font-size:12px;color:var(--text2)">▶ bắt đầu · ■ kết thúc · ◆ mốc · 🚚 hàng PU về site</span></div>
    <div class="pg-cal"><div class="pg-cw">T2</div><div class="pg-cw">T3</div><div class="pg-cw">T4</div><div class="pg-cw">T5</div><div class="pg-cw">T6</div><div class="pg-cw">T7</div><div class="pg-cw">CN</div>${cells}</div></div>`;
}

// ── 6. Giao hàng PU (liên kết PU Delivery) ──
function progViewPu(name, sm) {
  const pu = sm.pu, items = pu.items.slice().sort((a, b) => (puEst(a) || '9').localeCompare(puEst(b) || '9'));
  if (!items.length) return `<div class="card" style="color:var(--text2)">Dự án "${pgEsc(name)}" chưa có hàng nào trong PU Delivery. Hàng được liên kết theo tên dự án (Action Plan / PU Delivery).</div>`;
  const stl = [['done', 'Đã giao'], ['late', 'Trễ tiến độ'], ['soon7', 'Sắp giao (≤ 2 ngày)'], ['make', 'Đang sản xuất'], ['wait', 'Chờ NCC'], ['miss', 'Thiếu KH đặt hàng']];
  const chips = stl.map(([k, l]) => { const n = items.filter(x => puStatus(x).k === k).length; return n ? `<span class="pg-chip" style="background:${PU_STATUS_COLOR[k]}22;color:${PU_STATUS_COLOR[k]}">${l}: ${n}</span>` : ''; }).join('');
  const rows = items.map((x, k) => { const s = puStatus(x), est = puEst(x), ref = x.actual || est, delay = x.e0 && ref && ref > x.e0 ? puDaysBetween(x.e0, ref) : 0;
    return `<tr><td class="c">${k + 1}</td><td style="white-space:nowrap"><span class="pg-pill" style="background:${PU_STATUS_COLOR[s.k]}">${pgEsc(x.name)}</span></td><td>${pgEsc(x.supplier || '')}</td><td>${pgEsc(x.po || '')}</td><td class="c">${puFmt(x.e0)}</td><td class="c">${puFmt(est)}</td><td class="c">${puFmt(x.actual)}</td><td class="c" style="color:${delay ? '#C0392B' : 'inherit'}">${delay ? '+' + delay + ' ngày' : ''}</td><td>${pgEsc(s.t)}</td><td style="font-size:11.5px;color:var(--text2)">${pgEsc(x.reason || '')}</td></tr>`; }).join('');
  return `<div class="card"><div class="card-title" style="margin-bottom:6px">🚚 Giao hàng thiết bị — ${pu.done}/${pu.total} đã giao${pu.lastEst ? ' · hàng cuối dự kiến về site ' + puFmt(pu.lastEst) : ''}</div><div class="pg-chips" style="margin:0 0 8px">${chips}</div>
    <div class="pg-tblw"><table class="pg-tbl"><thead><tr><th>No.</th><th style="text-align:left">Hạng mục</th><th>Nhà cung cấp</th><th>PO</th><th>As contract</th><th>Dự kiến về site</th><th>Thực tế</th><th>Trễ</th><th>Trạng thái</th><th style="text-align:left">Lý do đổi lịch</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div style="font-size:11px;color:var(--text3);margin-top:6px">Dữ liệu lấy trực tiếp từ mục PU Delivery; cập nhật ở đó thì tiến độ tự đổi theo. Trong Gantt, công việc đánh dấu 🚚 sẽ dời theo ngày hàng cuối cùng về site.</div></div>`;
}
