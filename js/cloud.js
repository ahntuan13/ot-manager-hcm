// ============================================================
//  CLOUD (Firebase) — đăng nhập thật + tự lưu từng bản ghi + cập nhật tức thời giữa nhiều máy
//  • Auth: Firebase Authentication (email/mật khẩu). Vai trò nằm ở Firestore users/{uid}.role.
//  • Dữ liệu: collection "data", mỗi doc = 1 phần nhỏ (tháng OT, 1 dự án, 1 NV...). Bấm Lưu → chỉ ghi
//    đúng doc bị đổi → 2 người sửa 2 dự án khác nhau không đè nhau. Máy khác nhận ngay qua onSnapshot.
//  • Quy tắc bảo mật thật nằm ở firestore.rules (dán vào Firebase Console).
// ============================================================
(function () {
  'use strict';
  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyD3yKcjqvx4Fm4jt6SxvQfV6ZWENwRcSeg',
    authDomain: 'ot-manager-hcm.firebaseapp.com',
    projectId: 'ot-manager-hcm',
    storageBucket: 'ot-manager-hcm.firebasestorage.app',
    messagingSenderId: '486381760217',
    appId: '1:486381760217:web:2fdd274268079d72b558c8'
  };
  // Tài khoản này đăng nhập lần đầu sẽ tự thành Admin (khớp với firestore.rules).
  const BOOTSTRAP_ADMIN_EMAIL = 'ahntuan13@gmail.com';

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const enc = s => encodeURIComponent(s).replace(/\./g, '%2E');
  const dec = s => decodeURIComponent(s);

  let auth = null, db = null, unsubData = null, unsubMe = null;
  let ready = false, cloudEmpty = false, applying = false, flushing = false, again = false;
  let pushTimer = null, saveTimer = null, loginMsg = '';
  const remote = {}; // id -> { j, ver }  (bản đã biết trên server)
  const GATE_PREFIXES_DELETE = ['ot_', 'late_', 'off_', 'proj_', 'mv_', 'hc_'];
  const FORCE_PREFIXES = ['ot_', 'late_', 'off_', 'wlb', 'nt_']; // ghi đè thẳng (không kiểm tra phiên bản)

  // ── Trạng thái hiển thị ở sidebar ───────────────────────────────
  function setStatus(kind, text) {
    const el = $('syncStatus'), tx = $('syncStatusText'); if (!el || !tx) return;
    const cls = { ok: 'sync-ok', busy: 'sync-busy', err: 'sync-err', off: 'sync-off' }[kind] || 'sync-off';
    el.className = 'sync-badge ' + cls; tx.textContent = text;
    el.title = 'Dữ liệu tự động lưu lên Cloud — nhiều người dùng cùng lúc.';
  }
  const hhmm = () => new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  // ── Màn hình đăng nhập ───────────────────────────────────────────
  function showLogin(msg) {
    const gate = $('roleGate'); if (gate) gate.style.display = 'flex';
    $('loginBusy').style.display = 'none'; $('loginForm').style.display = 'block';
    const er = $('loginError'); const m = msg || loginMsg; loginMsg = '';
    if (er) { er.style.display = m ? 'block' : 'none'; er.textContent = m || ''; }
    const b = $('loginBtn'); if (b) { b.disabled = false; b.textContent = 'Đăng nhập'; }
  }
  function showBusy(txt) {
    const gate = $('roleGate'); if (gate) gate.style.display = 'flex';
    $('loginForm').style.display = 'none'; const b = $('loginBusy'); b.style.display = 'block'; b.textContent = txt || 'Đang kiểm tra đăng nhập…';
  }
  const authMsg = e => {
    const c = (e && e.code) || '';
    if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(c)) return 'Sai email hoặc mật khẩu.';
    if (/too-many-requests/.test(c)) return 'Thử quá nhiều lần — vui lòng đợi vài phút rồi thử lại.';
    if (/network/.test(c)) return 'Không kết nối được mạng.';
    if (/email-already-in-use/.test(c)) return 'Email này đã có tài khoản.';
    if (/weak-password/.test(c)) return 'Mật khẩu quá yếu (tối thiểu 6 ký tự).';
    if (/requires-recent-login/.test(c)) return 'Cần đăng nhập lại rồi thử lại.';
    return (e && e.message) || 'Có lỗi xảy ra.';
  };
  window.cloudLogin = async function (ev) {
    if (ev) ev.preventDefault();
    const em = $('loginEmail').value.trim(), pw = $('loginPw').value;
    const b = $('loginBtn'); b.disabled = true; b.textContent = 'Đang đăng nhập…'; $('loginError').style.display = 'none';
    try { await auth.signInWithEmailAndPassword(em, pw); }
    catch (e) { showLogin(authMsg(e)); }
  };
  window.cloudForgotPassword = async function () {
    const em = $('loginEmail').value.trim();
    if (!em) { showLogin('Nhập email của bạn ở ô trên rồi bấm "Quên mật khẩu?".'); return; }
    try { await auth.sendPasswordResetEmail(em); showLogin('Đã gửi email đặt lại mật khẩu (nếu email tồn tại). Kiểm tra cả mục Spam.'); }
    catch (e) { showLogin(authMsg(e)); }
  };

  // ── Xử lý phiên đăng nhập ───────────────────────────────────────
  async function onAuth(user) {
    if (!user) { detach(); window.CLOUD_USER = null; sessionStorage.removeItem('ot_manager_role_v1'); sessionStorage.removeItem('ot_manager_username'); document.body.classList.remove('cloud-on'); setStatus('off', 'Chưa đăng nhập'); showLogin(); return; }
    showBusy();
    try {
      const ref = db.collection('users').doc(user.uid);
      let snap = await ref.get();
      if (!snap.exists && (user.email || '').toLowerCase() === BOOTSTRAP_ADMIN_EMAIL) {
        await ref.set({ email: user.email, name: 'Admin', role: 'admin', active: true, createdAt: Date.now() });
        snap = await ref.get();
      }
      if (!snap.exists) {
        try { await db.collection('pending').doc(user.uid).set({ email: user.email, name: user.displayName || '', at: Date.now() }); } catch (e) {}
        loginMsg = 'Tài khoản chưa được cấp quyền. Đã gửi yêu cầu cho Admin — vui lòng chờ được duyệt rồi đăng nhập lại.';
        await auth.signOut(); return;
      }
      const prof = snap.data();
      if (prof.active === false) { loginMsg = 'Tài khoản đã bị khoá. Liên hệ Admin.'; await auth.signOut(); return; }
      const role = prof.role === 'admin' ? 'admin' : prof.role === 'sub' ? 'sub' : 'user';
      window.CLOUD_USER = { uid: user.uid, email: user.email, name: prof.name || user.email, role };
      document.body.classList.add('cloud-on');
      enterAsRole(role, window.CLOUD_USER.name);
      watchMe(ref, role);
      startListen();
      if (role === 'admin') renderCloudAdmin();
    } catch (e) {
      loginMsg = 'Không đăng nhập được: ' + authMsg(e); try { await auth.signOut(); } catch (x) {}
    }
  }
  function watchMe(ref, role) {
    if (unsubMe) unsubMe();
    unsubMe = ref.onSnapshot(s => {
      if (!window.CLOUD_USER) return;
      const d = s.exists ? s.data() : null;
      if (!d || d.active === false) { loginMsg = 'Tài khoản đã bị khoá hoặc gỡ quyền.'; auth.signOut(); }
      else if ((d.role === 'admin' ? 'admin' : d.role === 'sub' ? 'sub' : 'user') !== role) { toast('Quyền của bạn vừa thay đổi — đang tải lại…'); setTimeout(() => location.reload(), 900); }
    }, () => {});
  }
  function detach() {
    if (unsubData) { unsubData(); unsubData = null; }
    if (unsubMe) { unsubMe(); unsubMe = null; }
    ready = false; cloudEmpty = false; Object.keys(remote).forEach(k => delete remote[k]);
  }
  window.cloudLogout = async function () { try { await auth.signOut(); } catch (e) {} location.reload(); };

  // ── Dữ liệu cục bộ ⇄ các doc ───────────────────────────────────
  function desired() {
    const d = {};
    const admin = isAdmin();
    Object.keys(DB || {}).forEach(k => { d['ot_' + k] = DB[k]; });
    Object.keys(LATE_DB || {}).forEach(k => { d['late_' + k] = LATE_DB[k]; });
    Object.keys(OFF_DB || {}).forEach(k => { d['off_' + k] = OFF_DB[k]; });
    if (admin && WLB_XLS && Object.keys(WLB_XLS.employees || {}).length) d['wlb'] = WLB_XLS;
    Object.keys(PROJECTS_DB || {}).forEach(g => Object.keys(PROJECTS_DB[g] || {}).forEach(p => { d['proj_' + enc(g + '::' + p)] = { g, p, v: PROJECTS_DB[g][p] }; }));
    Object.keys(PROJ_MOVES || {}).forEach(c => { d['mv_' + enc(c)] = PROJ_MOVES[c]; });
    Object.keys(HC_PLAN || {}).forEach(k => { d['hc_' + enc(k)] = HC_PLAN[k]; });
    (NOTIFS_DB || []).forEach(n => { if (n && n.id) d['nt_' + enc(n.id)] = n; });
    return d;
  }
  const isForce = id => FORCE_PREFIXES.some(p => id === p || id.startsWith(p));
  const canDelete = id => GATE_PREFIXES_DELETE.some(p => id.startsWith(p)) && (!/^(ot_|late_|off_)/.test(id) || isAdmin());

  function applyDoc(id, data) {
    let obj; try { obj = JSON.parse(data.j); } catch (e) { return; }
    remote[id] = { j: data.j, ver: data.ver || 0 };
    if (id.startsWith('ot_')) DB[id.slice(3)] = obj;
    else if (id.startsWith('late_')) LATE_DB[id.slice(5)] = obj;
    else if (id.startsWith('off_')) OFF_DB[id.slice(4)] = obj;
    else if (id === 'wlb') WLB_XLS = obj;
    else if (id.startsWith('proj_')) { (PROJECTS_DB[obj.g] = PROJECTS_DB[obj.g] || {})[obj.p] = obj.v; }
    else if (id.startsWith('mv_')) PROJ_MOVES[dec(id.slice(3))] = obj;
    else if (id.startsWith('hc_')) HC_PLAN[dec(id.slice(3))] = obj;
    else if (id.startsWith('nt_')) NOTIFS_DB = mergeNotifs(NOTIFS_DB, [obj]);
  }
  function removeDoc(id) {
    if (id.startsWith('ot_')) delete DB[id.slice(3)];
    else if (id.startsWith('late_')) delete LATE_DB[id.slice(5)];
    else if (id.startsWith('off_')) delete OFF_DB[id.slice(4)];
    else if (id.startsWith('proj_')) {
      const k = dec(id.slice(5)), i = k.indexOf('::'), g = k.slice(0, i), p = k.slice(i + 2);
      if (PROJECTS_DB[g]) delete PROJECTS_DB[g][p];
    }
    else if (id.startsWith('mv_')) delete PROJ_MOVES[dec(id.slice(3))];
    else if (id.startsWith('hc_')) delete HC_PLAN[dec(id.slice(3))];
  }
  function resetLocal(hasWlb) {
    DB = {}; LATE_DB = {}; OFF_DB = {};
    PROJECTS_DB = { 'HCM-EC': {}, 'S-ED': {} }; PROJ_MOVES = {}; HC_PLAN = {};
    if (!hasWlb) WLB_XLS = { year: new Date().getFullYear(), employees: {} };
    Object.keys(remote).forEach(k => delete remote[k]);
  }
  function ensureShape() {
    if (!PROJECTS_DB['HCM-EC']) PROJECTS_DB['HCM-EC'] = {};
    if (!PROJECTS_DB['S-ED']) PROJECTS_DB['S-ED'] = {};
  }

  function startListen() {
    if (unsubData) unsubData();
    setStatus('busy', 'Đang tải dữ liệu…');
    unsubData = db.collection('data').onSnapshot(onSnap, err => {
      console.error(err); setStatus('err', 'Lỗi kết nối');
      toast('⚠️ Không đọc được dữ liệu Cloud: ' + (err && err.message || err) + ' — kiểm tra Firestore Rules.');
    });
  }
  function onSnap(snap) {
    if (!ready) {
      if (snap.size === 0) { cloudEmpty = true; setStatus('off', 'Cloud trống'); renderCloudBanner(); return; }
      applying = true;
      try {
        resetLocal(snap.docs.some(d => d.id === 'wlb'));
        snap.docs.forEach(d => applyDoc(d.id, d.data()));
        ensureShape();
      } finally { applying = false; }
      ready = true; cloudEmpty = false; removeBanner();
      persistLocal(); rerender(); setStatus('ok', 'Đã đồng bộ · ' + hhmm());
      return;
    }
    let changed = false; applying = true;
    try {
      snap.docChanges().forEach(c => {
        const id = c.doc.id;
        if (c.doc.metadata.hasPendingWrites) return; // bản của chính mình, đã xử lý lúc ghi
        if (c.type === 'removed') { if (remote[id]) { delete remote[id]; removeDoc(id); changed = true; } return; }
        const data = c.doc.data();
        if (remote[id] && remote[id].j === data.j) { remote[id].ver = data.ver || 0; return; }
        applyDoc(id, data); changed = true;
      });
      ensureShape();
    } finally { applying = false; }
    if (changed) { persistLocal(); rerender(); setStatus('ok', 'Cập nhật · ' + hhmm()); }
  }
  function persistLocal() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      applying = true;
      try { saveDB(false); saveLateDB(); saveOffDB(); saveWlbXls(); saveProjectsDB(); saveProjMoves(); saveHcPlan(); saveNotifs(); } catch (e) {} finally { applying = false; }
    }, 600);
  }
  let rerenderTimer = null;
  function rerender() {
    clearTimeout(rerenderTimer);
    rerenderTimer = setTimeout(() => {
      const ae = document.activeElement;
      if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && ae.closest('.pg')) { ae.addEventListener('blur', () => rerender(), { once: true }); return; }
      try { rebuildUI(); } catch (e) { console.warn(e); }
      try { rebuildLateUI(); renderWlbSummary(); } catch (e) {}
      try { notifRefresh(); applyRoleUI(); } catch (e) {}
      const pg = document.querySelector('.pg.show'); const id = pg && pg.id.replace('pg-', '');
      try {
        if (id === 'action') renderActionPlan();
        else if (id === 'manpower' && typeof renderManpower === 'function') renderManpower();
        else if (['dept', 'compare', 'late', 'wlb'].includes(id)) goSub(id);
        else if (id === 'settings') { renderSavedMonths(); }
      } catch (e) { console.warn(e); }
    }, 350);
  }

  // ── Đẩy thay đổi lên Cloud ──────────────────────────────────────
  window.cloudPush = function () {
    if (applying || !ready) return;
    setStatus('busy', 'Đang lưu…');
    clearTimeout(pushTimer); pushTimer = setTimeout(() => flush(false), 450);
  };
  window.cloudFlushNow = function (manual) { clearTimeout(pushTimer); return flush(!!manual); };

  async function flush(manual) {
    if (!window.CLOUD_USER) return;
    if (!ready) { if (manual) toast(cloudEmpty ? 'Cloud đang trống — Admin cần nhập dữ liệu ban đầu trước (Cài đặt).' : 'Đang tải dữ liệu…'); return; }
    if (flushing) { again = true; return; }
    flushing = true;
    try {
      do {
        again = false;
        const d = desired(), ops = [];
        Object.keys(d).forEach(id => {
          const j = JSON.stringify(d[id]);
          if (!remote[id] || remote[id].j !== j) ops.push({ id, j, force: isForce(id) });
        });
        Object.keys(remote).forEach(id => { if (!(id in d) && canDelete(id)) ops.push({ id, del: true, force: isForce(id) }); });
        if (ops.length) await commit(ops);
      } while (again);
      setStatus('ok', 'Đã lưu · ' + hhmm());
      if (typeof apUnsynced !== 'undefined') apUnsynced = false;
      if (typeof DIRTY_PLAN_KEYS !== 'undefined') { DIRTY_PLAN_KEYS.clear(); try { saveDirtyPlanKeys(); } catch (e) {} }
      if (manual) toast('✅ Đã lưu — mọi người thấy ngay.');
    } catch (e) {
      console.error(e); setStatus('err', 'Lỗi lưu — sẽ thử lại');
      toast('⚠️ Chưa lưu được: ' + (e && e.message || e));
      clearTimeout(pushTimer); pushTimer = setTimeout(() => flush(false), 15000);
    } finally { flushing = false; }
  }
  const payload = (id, j) => ({ j, ver: ((remote[id] && remote[id].ver) || 0) + 1, by: window.CLOUD_USER.uid, byName: window.CLOUD_USER.name, at: Date.now() });

  async function commit(ops) {
    const forced = ops.filter(o => o.force), checked = ops.filter(o => !o.force);
    // 1) Ghi thẳng theo lô (OT/Đi trễ/Off/WLB/thông báo)
    let i = 0;
    while (i < forced.length) {
      const batch = db.batch(), grp = []; let size = 0;
      while (i < forced.length && grp.length < 200 && size < 3.5e6) {
        const o = forced[i++]; grp.push(o); size += (o.j ? o.j.length : 0);
        if (size > 900000) toast('⚠️ Dữ liệu "' + o.id + '" rất lớn (' + Math.round(size / 1024) + ' KB) — gần giới hạn 1MB của Firestore.');
        const ref = db.collection('data').doc(o.id);
        if (o.del) batch.delete(ref); else { o.pl = payload(o.id, o.j); batch.set(ref, o.pl); }
      }
      await batch.commit();
      grp.forEach(o => { if (o.del) delete remote[o.id]; else remote[o.id] = { j: o.j, ver: o.pl.ver }; });
    }
    // 2) Dự án / di chuyển / kế hoạch: kiểm tra phiên bản — nếu người khác vừa sửa thì tải bản của họ về
    for (const o of checked) {
      const ref = db.collection('data').doc(o.id);
      try {
        const res = await db.runTransaction(async tx => {
          const s = await tx.get(ref);
          const rv = s.exists ? (s.data().ver || 0) : 0, lv = (remote[o.id] && remote[o.id].ver) || 0;
          if (rv !== lv) { const e = new Error('conflict'); e.conflict = true; e.remote = s.exists ? s.data() : null; throw e; }
          if (o.del) { tx.delete(ref); return null; }
          const pl = payload(o.id, o.j); tx.set(ref, pl); return pl;
        });
        if (o.del) delete remote[o.id]; else remote[o.id] = { j: o.j, ver: res.ver };
      } catch (e) {
        if (!e.conflict) throw e;
        handleConflict(o, e.remote);
      }
    }
    if (ops.some(o => !o.id.startsWith('nt_'))) logChange(ops);
  }
  function handleConflict(o, rd) {
    applying = true;
    try {
      if (!rd) { if (!o.del) { removeDoc(o.id); } delete remote[o.id]; }
      else { const same = rd.j === o.j; applyDoc(o.id, rd); if (!same) toast('⚠️ ' + (rd.byName || 'Người khác') + ' vừa sửa mục này trước bạn — đã tải bản mới nhất. Vui lòng kiểm tra và nhập lại phần của bạn nếu cần.'); }
    } finally { applying = false; }
    persistLocal(); rerender(); again = true;
  }
  function logChange(ops) {
    try {
      db.collection('log').add({ at: Date.now(), by: window.CLOUD_USER.name, uid: window.CLOUD_USER.uid, n: ops.length, ids: ops.slice(0, 12).map(o => (o.del ? '−' : '') + o.id) }).catch(() => {});
    } catch (e) {}
  }

  // ── Cloud trống: banner nhập dữ liệu ban đầu (Admin) ────────────
  function removeBanner() { const b = $('cloudBanner'); if (b) b.remove(); }
  function renderCloudBanner() {
    removeBanner();
    const box = document.createElement('div'); box.id = 'cloudBanner';
    box.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:9000;max-width:560px;width:calc(100% - 32px);background:#fff8e1;border:1px solid #e0b100;color:#5a4500;border-radius:12px;padding:12px 14px;font-size:12.5px;box-shadow:0 8px 24px rgba(0,0,0,.2)';
    if (isAdmin()) box.innerHTML = `<b>Cloud đang trống.</b> Nhập dữ liệu ban đầu để mọi người cùng dùng:<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" onclick="cloudImportSheet()">📥 Nhập từ Google Sheet cũ</button><button class="btn" onclick="cloudPushLocal()">⬆️ Dùng dữ liệu đang có trên máy này</button></div>`;
    else box.innerHTML = '<b>Chưa có dữ liệu trên Cloud.</b> Vui lòng nhờ Admin nhập dữ liệu ban đầu.';
    document.body.appendChild(box);
  }
  async function startFromLocal(label) {
    ready = true; cloudEmpty = false; removeBanner(); ensureShape();
    Object.keys(remote).forEach(k => delete remote[k]);
    persistLocal();
    await flush(true);
    toast('✅ Đã đưa dữ liệu (' + label + ') lên Cloud.');
    rerender();
  }
  window.cloudPushLocal = async function () {
    if (!isAdmin()) return;
    if (!Object.keys(DB).length) { toast('Máy này chưa có dữ liệu OT để đưa lên.'); return; }
    if (!confirm('Đưa toàn bộ dữ liệu đang có trên máy này lên Cloud?')) return;
    await startFromLocal('trên máy này');
  };
  window.cloudImportSheet = async function () {
    if (!isAdmin()) return;
    const url = (typeof DEFAULT_SYNC_URL !== 'undefined') ? DEFAULT_SYNC_URL : '';
    if (!url) { toast('Không có URL Sheet cũ.'); return; }
    if (ready && !confirm('Cloud đã có dữ liệu. Nhập từ Sheet cũ sẽ GHI ĐÈ dữ liệu trên Cloud bằng dữ liệu của Sheet. Tiếp tục?')) return;
    try {
      toast('Đang tải dữ liệu từ Google Sheet cũ…');
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'load' }) });
      const j = await r.json(); if (!j.ok) throw new Error(j.error || 'load failed');
      const p = JSON.parse(j.data || '{}');
      downloadBackup('truoc-khi-nhap-sheet');
      if (p.ot) {
        DB = p.ot; LATE_DB = p.late || {}; OFF_DB = p.off || {};
        if (p.wlbXls && Object.keys(p.wlbXls.employees || {}).length) WLB_XLS = p.wlbXls;
        PROJECTS_DB = p.projects || { 'HCM-EC': {}, 'S-ED': {} }; PROJ_MOVES = p.projMoves || {}; HC_PLAN = p.hcPlan || {};
        if (p.notifs) NOTIFS_DB = mergeNotifs(NOTIFS_DB, p.notifs);
      } else { DB = p; }
      try { migrateOldFormat(); migrateOffDBKeys(); migrateUnassignedMoves(); } catch (e) {}
      if (!Object.keys(DB).length) throw new Error('Sheet không có dữ liệu OT');
      ensureShape();
      await startFromLocal('từ Google Sheet cũ');
    } catch (e) { toast('⚠️ Không nhập được: ' + (e.message || e)); }
  };
  function downloadBackup(tag) {
    const o = { exportedAt: new Date().toISOString(), ot: DB, late: LATE_DB, off: OFF_DB, wlbXls: WLB_XLS, projects: PROJECTS_DB, projMoves: PROJ_MOVES, hcPlan: HC_PLAN, notifs: NOTIFS_DB };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(o)], { type: 'application/json' }));
    a.download = `OT-backup-${tag || 'full'}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  window.cloudBackup = function () { if (!isAdmin()) return; downloadBackup('full'); toast('Đã tải bản sao lưu JSON.'); };

  // ── Setting (Admin): tài khoản, nhập/sao lưu, lịch sử ───────────
  const ROLE_LABEL = { admin: 'Admin', sub: 'Quản lý (Sub-admin)', user: 'User' };
  async function renderCloudAdmin() {
    const box = $('cloudAdminArea'); if (!box) return;
    if (!isAdmin()) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="card cloud-card"><div class="card-title">👥 Tài khoản &amp; Cloud</div><div style="font-size:12px;color:var(--text2)">Đang tải…</div></div>';
    let users = [], pend = [], logs = [];
    try {
      users = (await db.collection('users').get()).docs.map(d => ({ id: d.id, ...d.data() }));
      pend = (await db.collection('pending').get()).docs.map(d => ({ id: d.id, ...d.data() }));
      logs = (await db.collection('log').orderBy('at', 'desc').limit(40).get()).docs.map(d => d.data());
    } catch (e) { box.innerHTML = `<div class="card cloud-card"><div style="color:var(--red);font-size:12.5px">Không tải được danh sách: ${esc(e.message)}</div></div>`; return; }
    users.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const me = window.CLOUD_USER.uid;
    const roleSel = (id, cur, dis) => `<select ${dis ? 'disabled' : ''} onchange="cloudSetRole('${id}',this.value)">${['user', 'sub', 'admin'].map(r => `<option value="${r}" ${r === cur ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}</select>`;
    box.innerHTML = `
    <div class="card cloud-card ac-top ac-blue">
      <div class="card-title">👥 Tài khoản người dùng<i style="font-weight:400;font-size:11px;color:var(--text3)"> / Users</i></div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Mỗi người đăng nhập bằng email + mật khẩu riêng. Nhiều người dùng cùng lúc; mọi thay đổi tự lưu và hiện ngay cho người khác.</div>
      ${pend.length ? `<div style="background:var(--accent-bg);border-radius:8px;padding:10px 12px;margin-bottom:10px"><b style="font-size:12.5px">Đang chờ duyệt (${pend.length})</b>${pend.map(p => `<div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap"><span style="flex:1;min-width:160px">${esc(p.email)}</span><select id="pd_${p.id}"><option value="user">User</option><option value="sub">Quản lý (Sub-admin)</option></select><button class="btn btn-primary" style="padding:3px 10px;font-size:11px" onclick="cloudApprove('${p.id}','${esc(p.email)}')">Cấp quyền</button><button class="btn" style="padding:3px 10px;font-size:11px" onclick="cloudRejectPending('${p.id}')">Từ chối</button></div>`).join('')}</div>` : ''}
      <div style="overflow:auto"><table><thead><tr><th>Tên</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${users.map(u => `<tr><td>${esc(u.name || '')}</td><td>${esc(u.email || '')}</td><td>${roleSel(u.id, u.role, u.id === me)}</td>
        <td>${u.active === false ? '<span style="color:var(--red)">Đã khoá</span>' : '<span style="color:var(--green)">Hoạt động</span>'}</td>
        <td style="white-space:nowrap"><button class="btn" style="padding:3px 8px;font-size:11px" onclick="cloudRename('${u.id}')">Đổi tên</button>
        <button class="btn" style="padding:3px 8px;font-size:11px" onclick="cloudResetPw('${esc(u.email)}')">Gửi mail đặt lại MK</button>
        ${u.id === me ? '' : `<button class="btn" style="padding:3px 8px;font-size:11px" onclick="cloudToggleActive('${u.id}',${u.active === false})">${u.active === false ? 'Mở khoá' : 'Khoá'}</button>
        <button class="btn btn-danger" style="padding:3px 8px;font-size:11px" onclick="cloudRemoveUser('${u.id}','${esc(u.email)}')">Gỡ quyền</button>`}</td></tr>`).join('')}
      </tbody></table></div>
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border2)"><b style="font-size:12.5px">+ Tạo tài khoản mới</b>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center">
          <input id="nuEmail" type="email" placeholder="Email" style="flex:1;min-width:190px">
          <input id="nuName" type="text" placeholder="Tên hiển thị" style="flex:1;min-width:130px">
          <input id="nuPw" type="text" placeholder="Mật khẩu tạm (≥ 6 ký tự)" style="flex:1;min-width:150px">
          <select id="nuRole"><option value="user">User</option><option value="sub">Quản lý (Sub-admin)</option><option value="admin">Admin</option></select>
          <button class="btn btn-primary" onclick="cloudCreateUser()">Tạo</button></div>
        <div style="font-size:11px;color:var(--text3);margin-top:6px">Gửi email + mật khẩu tạm cho người dùng; họ đăng nhập rồi đổi mật khẩu ở menu tài khoản (bấm vào tên app ở góc trái). Người đã tự có tài khoản Firebase chỉ cần đăng nhập 1 lần → hiện ở mục "Đang chờ duyệt".</div></div>
    </div>
    <div class="card cloud-card">
      <div class="card-title">💾 Sao lưu &amp; nhập dữ liệu<i style="font-weight:400;font-size:11px;color:var(--text3)"> / Backup &amp; Import</i></div>
      <div class="action-row" style="gap:10px"><button class="btn btn-primary" onclick="cloudBackup()">⬇️ Tải bản sao lưu (JSON)</button><button class="btn" onclick="cloudImportSheet()">📥 Nhập lại từ Google Sheet cũ (ghi đè)</button></div>
    </div>
    <div class="card cloud-card">
      <div class="card-title">🕘 Lịch sử chỉnh sửa gần đây<i style="font-weight:400;font-size:11px;color:var(--text3)"> / Edit history</i></div>
      <div style="max-height:260px;overflow:auto"><table><thead><tr><th>Lúc</th><th>Ai</th><th>Nội dung</th></tr></thead><tbody>
      ${logs.map(l => `<tr><td>${new Date(l.at).toLocaleString('vi-VN')}</td><td>${esc(l.by)}</td><td style="font-size:11px">${esc((l.ids || []).map(x => decodeURIComponent(x.replace(/%(?![0-9A-F]{2})/g, '%25'))).join(', '))}${l.n > (l.ids || []).length ? ' …(+' + (l.n - l.ids.length) + ')' : ''}</td></tr>`).join('') || '<tr><td colspan="3" style="color:var(--text3)">Chưa có.</td></tr>'}
      </tbody></table></div>
    </div>`;
  }
  const refreshAdmin = () => renderCloudAdmin();
  window.cloudSetRole = async function (uid, role) { try { await db.collection('users').doc(uid).update({ role }); toast('Đã đổi vai trò.'); } catch (e) { toast('⚠️ ' + e.message); } refreshAdmin(); };
  window.cloudToggleActive = async function (uid, active) { try { await db.collection('users').doc(uid).update({ active }); toast(active ? 'Đã mở khoá.' : 'Đã khoá tài khoản.'); } catch (e) { toast('⚠️ ' + e.message); } refreshAdmin(); };
  window.cloudRename = async function (uid) { const n = prompt('Tên hiển thị mới:'); if (!n) return; try { await db.collection('users').doc(uid).update({ name: n.trim() }); } catch (e) { toast('⚠️ ' + e.message); } refreshAdmin(); };
  window.cloudRemoveUser = async function (uid, email) {
    if (!confirm(`Gỡ quyền của ${email}? Người này sẽ không vào được app nữa (tài khoản đăng nhập vẫn còn nhưng không có quyền).`)) return;
    try { await db.collection('users').doc(uid).delete(); toast('Đã gỡ quyền.'); } catch (e) { toast('⚠️ ' + e.message); } refreshAdmin();
  };
  window.cloudResetPw = async function (email) { try { await auth.sendPasswordResetEmail(email); toast('Đã gửi email đặt lại mật khẩu tới ' + email); } catch (e) { toast('⚠️ ' + authMsg(e)); } };
  window.cloudApprove = async function (uid, email) {
    const role = ($('pd_' + uid) || {}).value || 'user';
    const name = prompt('Tên hiển thị cho ' + email + ':', email.split('@')[0]); if (!name) return;
    try { await db.collection('users').doc(uid).set({ email, name: name.trim(), role, active: true, createdAt: Date.now() }); await db.collection('pending').doc(uid).delete(); toast('Đã cấp quyền cho ' + email); } catch (e) { toast('⚠️ ' + e.message); }
    refreshAdmin();
  };
  window.cloudRejectPending = async function (uid) { try { await db.collection('pending').doc(uid).delete(); } catch (e) { toast('⚠️ ' + e.message); } refreshAdmin(); };
  window.cloudCreateUser = async function () {
    const email = $('nuEmail').value.trim(), name = $('nuName').value.trim(), pw = $('nuPw').value, role = $('nuRole').value;
    if (!email || !name || pw.length < 6) { toast('Nhập đủ email, tên và mật khẩu tạm (≥ 6 ký tự).'); return; }
    try {
      const sec = firebase.apps.find(a => a.name === 'sec') || firebase.initializeApp(FIREBASE_CONFIG, 'sec');
      const a2 = sec.auth();
      const cred = await a2.createUserWithEmailAndPassword(email, pw);
      const uid = cred.user.uid; await a2.signOut();
      await db.collection('users').doc(uid).set({ email, name, role, active: true, createdAt: Date.now() });
      toast(`Đã tạo tài khoản ${email}. Gửi email + mật khẩu tạm cho người đó.`);
      refreshAdmin();
    } catch (e) { toast('⚠️ ' + authMsg(e)); }
  };

  // ── Menu tài khoản của chính mình (bấm vào tên app) ─────────────
  window.switchRole = function () {
    if (!window.CLOUD_USER) return;
    const u = window.CLOUD_USER; const m = document.createElement('div'); m.className = 'cloud-modal'; m.id = 'acctModal';
    m.innerHTML = `<div><div style="font-size:16px;font-weight:800;margin-bottom:2px">${esc(u.name)}</div><div style="font-size:12px;color:var(--text2);margin-bottom:14px">${esc(u.email)} · ${ROLE_LABEL[u.role]}</div>
      <div style="font-size:12.5px;font-weight:700;margin-bottom:6px">Đổi mật khẩu</div>
      <input id="pwCur" type="password" placeholder="Mật khẩu hiện tại" autocomplete="current-password">
      <input id="pwNew" type="password" placeholder="Mật khẩu mới (≥ 6 ký tự)" autocomplete="new-password">
      <input id="pwNew2" type="password" placeholder="Nhập lại mật khẩu mới" autocomplete="new-password">
      <div id="pwMsg" style="font-size:11.5px;margin-bottom:8px;min-height:14px"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" onclick="cloudChangePw()">Đổi mật khẩu</button><button class="btn btn-danger" onclick="cloudLogout()">Đăng xuất</button><button class="btn" style="margin-left:auto" onclick="document.getElementById('acctModal').remove()">Đóng</button></div></div>`;
    document.body.appendChild(m);
  };
  window.cloudChangePw = async function () {
    const cur = $('pwCur').value, n1 = $('pwNew').value, n2 = $('pwNew2').value, msg = $('pwMsg');
    const say = (t, bad) => { msg.textContent = t; msg.style.color = bad ? 'var(--red)' : 'var(--green)'; };
    if (n1.length < 6) return say('Mật khẩu mới tối thiểu 6 ký tự.', true);
    if (n1 !== n2) return say('2 lần nhập không khớp.', true);
    try {
      const user = auth.currentUser;
      await user.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(user.email, cur));
      await user.updatePassword(n1); say('Đã đổi mật khẩu.');
    } catch (e) { say(authMsg(e), true); }
  };

  // Ghi đè các hàm cũ của chế độ Google Sheet để Setting vẽ thêm khu Admin
  const _rs = window.renderSyncPage;
  window.renderSyncPage = function () { try { if (_rs) _rs(); } catch (e) {} renderCloudAdmin(); };
  window.refreshSyncBadgeIdle = function () {};
  window.updateSyncBadge = function () {};

  window.addEventListener('online', () => { if (ready) flush(false); else setStatus('busy', 'Đang kết nối…'); });
  window.addEventListener('offline', () => setStatus('err', 'Mất mạng — chưa lưu được'));

  // ── Khởi động ───────────────────────────────────────────────────
  function boot() {
    showBusy();
    if (typeof firebase === 'undefined') { loginMsg = 'Không tải được Firebase (kiểm tra mạng / chặn gstatic.com).'; showLogin(); return; }
    try {
      firebase.initializeApp(FIREBASE_CONFIG);
      auth = firebase.auth(); db = firebase.firestore();
      auth.onAuthStateChanged(onAuth);
    } catch (e) { loginMsg = 'Lỗi khởi tạo Firebase: ' + e.message; showLogin(); }
  }
  boot();
})();
