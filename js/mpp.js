// DataView an toàn: đọc ngoài phạm vi trả về 0 thay vì ném lỗi (file .mpp lạ/biến thể)
function safeDV(buf, off, len) {
  var d = new DataView(buf, off, len);
  function w(f) { return function (p, le) { try { return d[f](p, le); } catch (e) { return 0; } }; }
  return { getUint8: w('getUint8'), getUint16: w('getUint16'), getUint32: w('getUint32'), getInt32: w('getInt32') };
}
// Minimal OLE2 compound file reader (browser+node)
(function(root){
function readOle(buf){
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = safeDV(u8.buffer,u8.byteOffset,u8.byteLength);
  const sig=[0xD0,0xCF,0x11,0xE0,0xA1,0xB1,0x1A,0xE1];
  for(let i=0;i<8;i++) if(u8[i]!==sig[i]) throw new Error('File không phải định dạng .mpp hợp lệ (hoặc bị hỏng)');
  const ssz=1<<dv.getUint16(30,true), mssz=1<<dv.getUint16(32,true);
  const nFat=dv.getUint32(44,true), dirStart=dv.getUint32(48,true), cutoff=dv.getUint32(56,true);
  const miniStart=dv.getUint32(60,true), nMini=dv.getUint32(64,true), difStart=dv.getUint32(68,true), nDif=dv.getUint32(72,true);
  const sec=n=>(n+1)*ssz;
  const per=ssz/4;
  const fatSecs=[];
  for(let i=0;i<109&&fatSecs.length<nFat;i++){const s=dv.getUint32(76+i*4,true); if(s<0xFFFFFFFA) fatSecs.push(s);}
  let d=difStart;
  for(let k=0;k<nDif&&d<0xFFFFFFFA;k++){
    const o=sec(d);
    for(let i=0;i<per-1&&fatSecs.length<nFat;i++){const s=dv.getUint32(o+i*4,true); if(s<0xFFFFFFFA) fatSecs.push(s);}
    d=dv.getUint32(o+(per-1)*4,true);
  }
  const fat=new Uint32Array(fatSecs.length*per);
  fatSecs.forEach((s,i)=>{const o=sec(s);for(let j=0;j<per;j++)fat[i*per+j]=dv.getUint32(o+j*4,true);});
  function chain(start){const r=[];let s=start,g=0;while(s<0xFFFFFFFA&&g++<=fat.length){r.push(s);s=fat[s];}return r;}
  function readStream(start,size){
    const ch=chain(start);const out=new Uint8Array(ch.length*ssz);
    ch.forEach((s,i)=>out.set(u8.subarray(sec(s),sec(s)+ssz),i*ssz));
    return size==null?out:out.subarray(0,size);
  }
  const dirData=readStream(dirStart);
  const ents=[];
  for(let o=0;o+128<=dirData.length;o+=128){
    const dd=safeDV(dirData.buffer,dirData.byteOffset+o,128);
    const nl=dd.getUint16(64,true);
    let name='';for(let i=0;i<nl/2-1;i++)name+=String.fromCharCode(dd.getUint16(i*2,true));
    ents.push({name,type:dirData[o+66],left:dd.getInt32(68,true),right:dd.getInt32(72,true),child:dd.getInt32(76,true),start:dd.getUint32(116,true),size:dd.getUint32(120,true)});
  }
  // mini stream
  let mini=null, miniFat=null;
  function ensureMini(){
    if(mini) return;
    mini=readStream(ents[0].start,ents[0].size);
    const ch=chain(miniStart);miniFat=new Uint32Array(ch.length*per);
    ch.forEach((s,i)=>{const o=sec(s);for(let j=0;j<per;j++)miniFat[i*per+j]=dv.getUint32(o+j*4,true);});
  }
  function readMini(start,size){
    ensureMini();const parts=[];let s=start,g=0;
    while(s<0xFFFFFFFA&&g++<=miniFat.length){parts.push(mini.subarray(s*mssz,s*mssz+mssz));s=miniFat[s];}
    const out=new Uint8Array(parts.length*mssz);parts.forEach((p,i)=>out.set(p,i*mssz));return out.subarray(0,size);
  }
  function content(e){return e.size<cutoff?readMini(e.start,e.size):readStream(e.start,e.size);}
  function children(i){ // in-order traversal of sibling tree
    const out=[];(function w(n){if(n<0)return;w(ents[n].left);out.push(n);w(ents[n].right);})(ents[i].child);return out;
  }
  function find(path){
    let cur=0;
    for(const p of path.split('/').filter(Boolean)){
      const k=children(cur).find(n=>ents[n].name===p);
      if(k==null) return null; cur=k;
    }
    return cur;
  }
  return {
    ents, children, find,
    list(path){const i=path?find(path):0; return i==null?[]:children(i).map(n=>ents[n].name+(ents[n].type===1?'/':''));},
    read(path){const i=find(path);return i==null?null:content(ents[i]);}
  };
}
root.readOle=readOle;
})(typeof window!=='undefined'?window:globalThis);

// ── Đọc file Microsoft Project (.mpp, định dạng MPP14 = Project 2010 → 365) ngay trên trình duyệt ──
// Lấy: tên, cấp bậc, thời lượng, ngày bắt đầu, % hoàn thành, quan hệ Predecessor (FS/SS/FF/SF + lag).
(function(root){
  var EPOCH = Date.UTC(1983, 11, 31);
  function stamp(dv, p) {            // ngày giờ MS Project: 2 byte giờ (1/10 phút) + 2 byte số ngày kể từ 31/12/1983
    var v = dv.getUint32(p, true), d = v >>> 16, tm = v & 0xFFFF;
    return new Date(EPOCH + d * 864e5 + Math.round(tm / 10) * 6e4).toISOString().slice(0, 10);
  }
  function utf16(u8, p, n) {
    var s = '';
    for (var i = 0; i + 1 < n; i += 2) { var c = u8[p + i] | (u8[p + i + 1] << 8); if (!c) break; s += String.fromCharCode(c); }
    return s;
  }
  function fixedBlocks(meta, data, isz) {   // isz = kích thước 1 mục trong FixedMeta (công việc 47, liên kết 10); số mục tính theo độ dài, không tin tiêu đề
    var mdv = safeDV(meta.buffer, meta.byteOffset, meta.byteLength), n = Math.floor((meta.length - 16) / isz), offs = [];
    for (var i = 0; i < n; i++) offs.push(mdv.getUint32(16 + i * isz + 4, true));
    var sorted = offs.slice().sort(function (x, y) { return x - y; });
    return offs.map(function (o, i) {
      var nx = data.length; for (var k = 0; k < sorted.length; k++) if (sorted[k] > o) { nx = sorted[k]; break; }
      return { s: o, len: nx - o, flag: meta[16 + i * isz] };
    }).filter(function (b) { return b.s < data.length; });
  }
  function mppParse(buf) {
    var o = root.readOle(buf), top = o.list('').map(function (x) { return x.replace(/\/$/, ''); });
    var rootDir = top.filter(function (x) { return /^\s*1\d\d$/.test(x); })[0];
    if (!rootDir) throw new Error('Không nhận ra cấu trúc file .mpp');
    if (rootDir.trim() !== '114') throw new Error('File .mpp phiên bản cũ (Project 2007 trở về trước). Hãy mở bằng MS Project → Save As → định dạng XML, rồi upload file .xml.');
    var T = rootDir + '/TBkndTask/';
    var vm = o.read(T + 'VarMeta'), vd = o.read(T + 'Var2Data'), fm = o.read(T + 'FixedMeta'), fd = o.read(T + 'FixedData');
    if (!vm || !vd || !fm || !fd) throw new Error('File .mpp không có dữ liệu công việc.');
    // Var2Data: tên công việc + cột tuỳ chỉnh Text1 (thường là "Người/Trách nhiệm thực hiện")
    var texts = {};
    var vdv = safeDV(vm.buffer, vm.byteOffset, vm.byteLength), vcnt = vdv.getUint32(8, true), names = {};
    for (var i = 0; i < vcnt; i++) {
      var p = 24 + i * 12; if (p + 12 > vm.length) break;
      var uid = vdv.getUint32(p, true), off = vdv.getUint32(p + 4, true), field = vdv.getUint32(p + 8, true);
      if ((field & 0xFFFF) === 14 && ((field >>> 16) === 0x0B40 || (field >>> 16) === 0) && off + 4 <= vd.length) {
        var sz = safeDV(vd.buffer, vd.byteOffset, vd.byteLength).getUint32(off, true);
        names[uid] = utf16(vd, off + 4, Math.min(sz, vd.length - off - 4));
      } else if (field === 0x0B400033 && off + 4 <= vd.length) {
        var sz1 = safeDV(vd.buffer, vd.byteOffset, vd.byteLength).getUint32(off, true);
        var tx = utf16(vd, off + 4, Math.min(sz1, vd.length - off - 4)).trim(); if (tx) texts[uid] = tx;
      }
    }
    var dv = safeDV(fd.buffer, fd.byteOffset, fd.byteLength), seen = {}, tasks = [];
    fixedBlocks(fm, fd, 47).forEach(function (b) {
      if (b.flag !== 0 || b.len < 176 || b.s + 176 > fd.length) return;   // flag ≠ 0 = bản ghi đã xoá / không phải công việc
      var id = dv.getUint32(b.s, true), uid = dv.getUint32(b.s + 4, true);
      if (uid === 0 || seen[uid] || names[uid] == null || !names[uid].trim() || id > 100000) return;
      var st = stamp(dv, b.s + 96), fn = stamp(dv, b.s + 100);
      if (st > fn || st < '1990' || st > '2100') return;
      seen[uid] = 1;
      var dur = dv.getUint32(b.s + 84, true) / 4800;
      tasks.push({ id: id, uid: uid, lvl: dv.getUint16(b.s + 172, true), name: names[uid].trim(), dur: dur, start: st, finish: fn,
        pct: Math.min(100, dv.getUint16(b.s + 92, true)), summary: dv.getUint8(b.s + 140) === 1, preds: [] });
    });
    tasks.sort(function (a, b) { return a.id - b.id; });
    // TBkndCons: quan hệ Predecessor (20 byte / bản ghi)
    // Resource (Task ↔ Resource): TBkndRsc (tên) + TBkndAssn (task uid @4, resource uid @8; -65535 = chưa gán)
    var rname = {}, who = {};
    try {
      var rvm = o.read(rootDir + '/TBkndRsc/VarMeta'), rvd = o.read(rootDir + '/TBkndRsc/Var2Data');
      if (rvm && rvd) {
        var rdv = safeDV(rvm.buffer, rvm.byteOffset, rvm.byteLength), rn = rdv.getUint32(8, true);
        for (var ri = 0; ri < rn; ri++) {
          var rp = 24 + ri * 12; if (rp + 12 > rvm.length) break;
          if (rdv.getUint32(rp + 8, true) === 0x0C400001) {
            var ro = rdv.getUint32(rp + 4, true); if (ro + 4 > rvd.length) continue;
            var rs = safeDV(rvd.buffer, rvd.byteOffset, rvd.byteLength).getUint32(ro, true);
            var nm = utf16(rvd, ro + 4, Math.min(rs, rvd.length - ro - 4)).trim(); if (nm) rname[rdv.getUint32(rp, true)] = nm;
          }
        }
      }
      var am = o.read(rootDir + '/TBkndAssn/FixedMeta'), ad = o.read(rootDir + '/TBkndAssn/FixedData');
      if (am && ad && Object.keys(rname).length) {
        var adv = safeDV(ad.buffer, ad.byteOffset, ad.byteLength);
        fixedBlocks(am, ad, 34).forEach(function (b) {
          if (b.flag !== 0 || b.s + 12 > ad.length) return;
          var tu = adv.getUint32(b.s + 4, true), ru = adv.getUint32(b.s + 8, true);
          if (rname[ru]) { var l = who[tu] || (who[tu] = []); if (l.indexOf(rname[ru]) < 0) l.push(rname[ru]); }
        });
      }
    } catch (e) { /* bỏ qua phần Resource nếu file lạ */ }
    tasks.forEach(function (t) { var r = who[t.uid]; t.who = r ? r.join(', ') : (texts[t.uid] || ''); });
    var cons = o.read(rootDir + '/TBkndCons/FixedData'), byUid = {};
    tasks.forEach(function (t) { byUid[t.uid] = t; });
    if (cons) {
      var cd = safeDV(cons.buffer, cons.byteOffset, cons.byteLength), TY = ['FF', 'FS', 'SF', 'SS'];
      var cm = o.read(rootDir + '/TBkndCons/FixedMeta');
      fixedBlocks(cm, cons, 10).forEach(function (b) {
        if (b.flag !== 0 || b.s + 20 > cons.length) return;   // flag ≠ 0 = liên kết đã xoá
        var q = b.s, pu = cd.getUint32(q + 4, true), su = cd.getUint32(q + 8, true), ty = cd.getUint16(q + 12, true), lag = cd.getInt32(q + 14, true);
        if (byUid[pu] && byUid[su] && pu !== su && ty < 4 && !byUid[su].preds.some(function (x) { return x.uid === pu && x.t === TY[ty] && x.lag === Math.round(lag / 4800); })) byUid[su].preds.push({ uid: pu, t: TY[ty], lag: Math.round(lag / 4800) });
      });
    }
    return tasks;
  }
  root.mppParse = mppParse;
  if (typeof module !== 'undefined') module.exports = { mppParse: mppParse, readOle: root.readOle };
})(typeof window !== 'undefined' ? window : globalThis);
