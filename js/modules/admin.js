// ─────────────────────────────────────────────
// GROUPS
// ─────────────────────────────────────────────
let _egid = null;

function renderGroups() {
  const el = document.getElementById('groups-list');
  if (!D.groups.length) {
    el.innerHTML = '<div class="empty"><div class="empty-ico">📁</div><p>Henüz grup yok.<br>Yeni Grup butonuyla başlayın.</p></div>';
    return;
  }
  el.innerHTML = D.groups.map(g => `
    <div class="li">
      <div class="li-i">
        <div class="li-n">📁 ${esc(g.name)}</div>
        <div class="li-m">${esc(g.desc||'')}${g.desc?' · ':''}${D.templates.filter(t=>t.groupId===g.id).length} şablon</div>
      </div>
      <div class="li-a">
        <button class="btn btn-ghost sm" onclick="openGM('${g.id}')">✏️</button>
        <button class="btn btn-danger sm" onclick="delGroup('${g.id}')">🗑️</button>
      </div>
    </div>`).join('');
}

function openGM(id=null) {
  _egid = id;
  document.getElementById('gm-title').textContent = id ? 'Grubu Düzenle' : 'Yeni Grup';
  document.getElementById('gm-name').value = '';
  document.getElementById('gm-desc').value = '';
  if (id) {
    const g = D.groups.find(x=>x.id===id);
    if (g) { document.getElementById('gm-name').value=g.name||''; document.getElementById('gm-desc').value=g.desc||''; }
  }
  openOv('ov-grp');
  setTimeout(() => document.getElementById('gm-name').focus(), 60);
}

function saveGroup() {
  const name = document.getElementById('gm-name').value.trim();
  if (!name) { toast('⚠️ Grup adı zorunlu!', 'err'); return; }
  const desc = document.getElementById('gm-desc').value.trim();
  if (_egid) {
    const g = D.groups.find(x=>x.id===_egid);
    g.name=name; g.desc=desc; g.updatedAt=Date.now();
    dbSave('groups', g.id, g).catch(e=>toast('Hata: '+e.message,'err'));
  } else {
    const g = { id:uid(), name, desc, createdAt:Date.now() };
    D.groups.push(g);
    dbSave('groups', g.id, g).catch(e=>toast('Hata: '+e.message,'err'));
  }
  closeOv('ov-grp'); renderGroups();
  toast('✅ Grup kaydedildi', 'ok');
}

function delGroup(id) {
  const g = D.groups.find(x=>x.id===id);
  const cnt = D.templates.filter(t=>t.groupId===id).length;
  if (!confirm(`"${g.name}" grubunu silmek istiyor musunuz?${cnt?'\n\n⚠️ '+cnt+' form gruptan ayrılacak.':''}`)) return;
  D.templates.filter(t=>t.groupId===id).forEach(t=>{t.groupId=null; dbSave('templates',t.id,t).catch(()=>{});});
  D.groups = D.groups.filter(x=>x.id!==id);
  dbDel('groups', id).catch(e=>toast('Hata: '+e.message,'err'));
  renderGroups(); if(document.getElementById('pg-templates').classList.contains('on')) renderTemplates();
  toast('🗑️ Grup silindi');
}

// ─────────────────────────────────────────────
// TEMPLATES
// ─────────────────────────────────────────────
let _etid = null;
let _topen = {};

function renderTemplates() {
  const el = document.getElementById('templates-list');
  _fillGSel('tm-grp', null);

  const groups = D.groups.map(g=>({...g, tmpls: D.templates.filter(t=>t.groupId===g.id)}));
  const ungrouped = D.templates.filter(t=>!t.groupId);
  let html = '';

  groups.forEach(g => {
    const open = _topen[g.id] !== false;
    html += `<div class="acc-wrap">
      <div class="acc-hdr" onclick="_topen['${g.id}']=!(_topen['${g.id}']!==false);renderTemplates()">
        <div style="display:flex;align-items:center;gap:2px">
          <span class="acc-chev ${open?'open':''}">▶</span>
          <span style="font-weight:700;font-size:.87rem">📁 ${esc(g.name)}</span>
          <span style="font-size:.72rem;opacity:.65;margin-left:6px">(${g.tmpls.length})</span>
        </div>
        <div style="display:flex;gap:5px" onclick="event.stopPropagation()">
          <button class="btn btn-ghost sm" style="color:#fff;border-color:rgba(255,255,255,.3)" onclick="openGM('${g.id}')">✏️</button>
          <button class="btn btn-danger sm" onclick="delGroup('${g.id}')">🗑️</button>
        </div>
      </div>
      <div class="acc-body ${open?'open':''}">
        ${g.tmpls.length ? g.tmpls.map(t=>_tmplHtml(t)).join('') : '<div style="padding:9px 11px;color:var(--muted);font-size:.81rem">Bu grupta şablon yok.</div>'}
      </div>
    </div>`;
  });

  if (ungrouped.length) {
    const open = _topen.__none !== false;
    html += `<div class="acc-wrap">
      <div class="acc-hdr" onclick="_topen.__none=!(_topen.__none!==false);renderTemplates()">
        <div style="display:flex;align-items:center;gap:2px">
          <span class="acc-chev ${open?'open':''}">▶</span>
          <span style="font-weight:700;font-size:.87rem">📋 Grupsuz Formlar</span>
        </div>
      </div>
      <div class="acc-body ${open?'open':''}">${ungrouped.map(t=>_tmplHtml(t)).join('')}</div>
    </div>`;
  }

  if (!html) {
    el.innerHTML = '<div class="empty"><div class="empty-ico">📋</div><p>Önce grup oluşturun, sonra form ekleyin.</p></div>';
    return;
  }
  el.innerHTML = html;
}

function _tmplHtml(t) {
  const vb = (t.version||1)>1
    ? '<span style="background:#dbeafe;color:#1e40af;padding:1px 5px;border-radius:8px;font-size:.68rem;font-weight:700">v'+t.version+'</span>' : '';
  const ftBadge = t.formType==='measurement'
    ? '<span style="background:#f0fdf4;color:#065f46;padding:1px 6px;border-radius:8px;font-size:.67rem;font-weight:700;border:1px solid #bbf7d0">📐 Ölçüm</span>'
    : '<span style="background:#eff6ff;color:#1e40af;padding:1px 6px;border-radius:8px;font-size:.67rem;font-weight:700;border:1px solid #bfdbfe">📋 Standart</span>';
  const itemCnt = t.formType==='measurement'
    ? (t.measRows||[]).length+' ölçüm noktası'
    : (t.items||[]).filter(i=>i.type!=='heading').length+' madde';
  return '<div class="tmpl-li">' +
    '<div style="flex:1;min-width:0">' +
      '<div style="font-weight:700;font-size:.84rem;display:flex;align-items:center;gap:6px;flex-wrap:wrap">'+esc(t.name)+' '+vb+' '+ftBadge+'</div>' +
      '<div style="font-size:.72rem;color:var(--muted)">'+itemCnt+(t.updatedAt?' · '+fmtDt(t.updatedAt):'')+
        (t.drawNo?' · Res: '+esc(t.drawNo):'')+
      '</div>' +
    '</div>' +
    '<div style="display:flex;gap:4px">' +
      '<button class="btn btn-ghost sm" onclick="showHistory(\''+t.id+'\')" title="Versiyon geçmişi">🕐</button>' +
      '<button class="btn btn-ghost sm" onclick="openTM(\''+t.id+'\')">✏️</button>' +
      '<button class="btn btn-danger sm" onclick="delTemplate(\''+t.id+'\')">🗑️</button>' +
    '</div></div>';
}

function _fillGSel(selId, curVal) {
  const s = document.getElementById(selId); if(!s) return;
  s.innerHTML = '<option value="">— Grup seçin —</option>' +
    D.groups.map(g=>`<option value="${g.id}"${g.id===curVal?' selected':''}>${esc(g.name)}</option>`).join('');
}

function _onFTypeChange() {
  const isMeas = document.getElementById('ftype-meas').checked;
  document.getElementById('tm-std-section').style.display  = isMeas ? 'none' : '';
  document.getElementById('tm-meas-section').style.display = isMeas ? ''     : 'none';
  document.getElementById('ftype-std-lbl').style.borderColor  = isMeas ? 'var(--border)' : 'var(--navy)';
  document.getElementById('ftype-meas-lbl').style.borderColor = isMeas ? 'var(--navy)'   : 'var(--border)';
}

let _tmImgData = null;

function _onImgFile(input) {
  const file = input.files[0]; if (!file) return;
  if (file.size > 3*1024*1024) { toast('⚠️ Dosya 3MB’dan büyük olamaz','err'); return; }
  const reader = new FileReader();
  reader.onload = e => { _setImgPreview(e.target.result); };
  reader.readAsDataURL(file);
}

function _onImgDrop(event) {
  event.preventDefault();
  event.currentTarget.style.borderColor = 'var(--border)';
  const file = event.dataTransfer.files[0]; if (!file) return;
  if (!file.type.startsWith('image/') && file.type !== 'application/pdf') { toast('⚠️ Sadece resim veya PDF','err'); return; }
  if (file.size > 3*1024*1024) { toast('⚠️ Dosya 3MB’dan büyük olamaz','err'); return; }
  const reader = new FileReader();
  reader.onload = e => { _setImgPreview(e.target.result); };
  reader.readAsDataURL(file);
}

function _imgPrefix() {
  // Aktif form tipine göre doğru ID prefix'ini döndür
  const isMeas = document.getElementById('ftype-meas') && document.getElementById('ftype-meas').checked;
  return isMeas ? 'tm-mimg' : 'tm-img';
}

function _setImgPreview(dataUrl) {
  _tmImgData = dataUrl;
  const p = _imgPrefix();
  const thumb = document.getElementById(p + '-thumb');
  const prev  = document.getElementById(p + '-preview');
  const ph    = document.getElementById(p + '-placeholder');
  const rm    = document.getElementById(p + '-rm');
  if (thumb) thumb.src = dataUrl;
  if (prev)  prev.style.display = '';
  if (ph)    ph.style.display = 'none';
  if (rm)    rm.style.display = '';
}

function _rmImg() {
  _tmImgData = null;
  // Temizle: her iki section'ı da sıfırla
  ['tm-img', 'tm-mimg'].forEach(p => {
    const thumb = document.getElementById(p + '-thumb');
    if (thumb) thumb.src = '';
    const prev = document.getElementById(p + '-preview');
    if (prev) prev.style.display = 'none';
    const ph = document.getElementById(p + '-placeholder');
    if (ph) ph.style.display = '';
    const rmBtn = document.getElementById(p + '-rm');
    if (rmBtn) rmBtn.style.display = 'none';
    const inp = document.getElementById(p + '-input');
    if (inp) inp.value = '';
  });
}

let _measRowCount = 0;
function addMeasRow(data=null) {
  _measRowCount++;
  const id = data && data.id ? data.id : uid();
  const d = document.createElement('div');
  d.dataset.id = id;
  d.style.cssText = 'display:grid;grid-template-columns:60px 80px 110px 110px 32px;gap:4px;margin-bottom:5px;align-items:center';
  let seqNo = data && data.seqNo != null ? data.seqNo : '';
  let ssGap = data && data.ssGap != null ? data.ssGap : '';
  if (ssGap === '' && data && data.desc) {
    const n = parseFloat(data.desc);
    if (!isNaN(n)) ssGap = n;
  }
  let nomVal = data && data.nominal != null ? data.nominal : '';
  let tolVal = data && data.tol != null ? data.tol : '';
  if (tolVal === '' && data && data.min != null && data.nominal != null) {
    tolVal = Math.abs(data.nominal - data.min).toFixed(4).replace(/\.?0+$/, '');
  }
  d.innerHTML =
    '<input type="text" value="' + esc(seqNo) + '" placeholder="örn: 1a" data-field="seqNo"' +
    ' style="padding:5px 6px;border:1.5px solid var(--border);border-radius:6px;font-size:.82rem;font-family:inherit;text-align:center;width:100%;box-sizing:border-box;font-weight:700">' +
    '<input type="number" value="' + (ssGap !== '' ? ssGap : '') + '" placeholder="0.00" data-field="ssGap" step="0.01"' +
    ' style="padding:5px 6px;border:1.5px solid #93c5fd;border-radius:6px;font-size:.8rem;font-family:inherit;text-align:center;width:100%;box-sizing:border-box;background:#eff6ff">' +
    '<input type="number" value="' + nomVal + '" placeholder="125.50" data-field="nominal" step="0.01"' +
    ' style="padding:5px 6px;border:1.5px solid #4ade80;border-radius:6px;font-size:.8rem;font-family:inherit;text-align:center;width:100%;box-sizing:border-box;background:#f0fdf4">' +
    '<input type="number" value="' + tolVal + '" placeholder="0.50" data-field="tol" step="0.001" min="0"' +
    ' style="padding:5px 6px;border:1.5px solid #fbbf24;border-radius:6px;font-size:.8rem;font-family:inherit;text-align:center;width:100%;box-sizing:border-box;background:#fffbeb">' +
    '<button onclick="this.parentElement.remove()" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:1rem;padding:2px">✕</button>';
  document.getElementById('tm-meas-rows').appendChild(d);
}

function _renumberMeasRows() {
  document.querySelectorAll('#tm-meas-rows > div').forEach((row, i) => {
    const badge = row.querySelector('._meas-seq-badge');
    if (badge) badge.textContent = i + 1;
  });
  _measRowCount = document.querySelectorAll('#tm-meas-rows > div').length;
}

function _collectMeasRows() {
  const rows = document.querySelectorAll('#tm-meas-rows > div');
  return Array.from(rows).map((row, i) => {
    const nominal = row.querySelector('[data-field=nominal]').value !== ''
      ? parseFloat(row.querySelector('[data-field=nominal]').value) : null;
    const tol = row.querySelector('[data-field=tol]').value !== ''
      ? parseFloat(row.querySelector('[data-field=tol]').value) : null;
    const ssGapEl = row.querySelector('[data-field=ssGap]');
    const ssGap = ssGapEl && ssGapEl.value !== '' ? parseFloat(ssGapEl.value) : null;
    const seqNoEl = row.querySelector('[data-field=seqNo]');
    const seqNo = seqNoEl ? seqNoEl.value.trim() : String(i+1);
    return {
      id:      row.dataset.id || uid(),
      seq:     i + 1,
      seqNo,
      ssGap,
      nominal,
      tol,
      min:  (nominal != null && tol != null) ? Math.round((nominal - tol) * 10000) / 10000 : null,
      max:  (nominal != null && tol != null) ? Math.round((nominal + tol) * 10000) / 10000 : null
    };
  });
}

function openTM(id=null) {
  _etid = id;
  _measRowCount = 0;
  _tmImgData = null;
  _fillGSel('tm-grp', id ? (D.templates.find(x=>x.id===id)||{}).groupId : null);
  document.getElementById('tm-title').textContent = id ? 'Formu Düzenle' : 'Yeni Form';
  document.getElementById('tm-name').value = '';
  document.getElementById('tm-desc').value = '';
  document.getElementById('tm-items').innerHTML = '';
  document.getElementById('tm-meas-rows').innerHTML = '';
  document.getElementById('tm-drawno').value = '';
  document.getElementById('tm-tolstd').value = '';
  _rmImg();
  document.getElementById('ftype-std').checked = true;
  _onFTypeChange();

  if (id) {
    const t = D.templates.find(x=>x.id===id);
    document.getElementById('tm-name').value = t.name||'';
    document.getElementById('tm-desc').value = t.desc||'';
    document.getElementById('tm-grp').value  = t.groupId||'';

    if (t.formType === 'measurement') {
      document.getElementById('ftype-meas').checked = true;
      _onFTypeChange();
      document.getElementById('tm-drawno').value = t.drawNo||'';
      document.getElementById('tm-tolstd').value = t.tolStd||'';
      if (t.refImage) _setImgPreview(t.refImage);
      (t.measRows||[]).forEach(row => addMeasRow(row));
    } else {
      if (t.refImage) _setImgPreview(t.refImage);
      (t.items||[]).forEach(item => item.type==='heading' ? addHeading(item.text,item.id) : addItem(item.text,item.id));
    }
  }
  openOv('ov-tmpl');
}

function addItem(text='', eid=null) {
  const id = eid||uid();
  const d = document.createElement('div');
  d.className='drow'; d.dataset.id=id; d.dataset.type='item';
  d.innerHTML='<span class="dhandle" draggable="true">⠿</span>' +
    '<input type="text" value="' + esc(text) + '" placeholder="Kontrol maddesi..." style="flex:1;border:none;background:transparent;font-size:.84rem;outline:none;font-family:inherit">' +
    '<button class="btn btn-danger sm" onclick="this.closest(\'.drow,.heading\').remove()">✕</button>';
  document.getElementById('tm-items').appendChild(d);
  _drag(d); if(!text) d.querySelector('input').focus();
}

function addHeading(text='', eid=null) {
  const id = eid||uid();
  const d = document.createElement('div');
  d.className='drow heading'; d.dataset.id=id; d.dataset.type='heading';
  d.innerHTML='<span class="dhandle" draggable="true">⠿</span>' +
    '<input type="text" value="' + esc(text) + '" placeholder="Bölüm başlığı..." style="flex:1;border:none;background:transparent;font-size:.84rem;font-weight:700;color:var(--navy);outline:none;font-family:inherit">' +
    '<button class="btn btn-danger sm" onclick="this.closest(\'.drow,.heading\').remove()">✕</button>';
  document.getElementById('tm-items').appendChild(d);
  _drag(d); if(!text) d.querySelector('input').focus();
}

function _drag(el) {
  const h = el.querySelector('.dhandle');
  h.addEventListener('dragstart', e => { e.dataTransfer.effectAllowed='move'; el.classList.add('dragging'); window.__drag=el; });
  h.addEventListener('dragend', ()  => { el.classList.remove('dragging'); window.__drag=null; });
  el.addEventListener('dragover', e => {
    e.preventDefault(); if(!window.__drag||window.__drag===el) return;
    const r=el.getBoundingClientRect();
    el.parentElement.insertBefore(window.__drag, e.clientY>r.top+r.height/2 ? el.nextSibling : el);
  });
}

function saveTemplate() {
  const name    = document.getElementById('tm-name').value.trim();
  const groupId = document.getElementById('tm-grp').value;
  const isMeas  = document.getElementById('ftype-meas').checked;
  if (!name)    { toast('⚠️ Form adı zorunlu!','err'); return; }
  if (!groupId) { toast('⚠️ Grup seçmelisiniz!','err'); return; }

  let tData = { name, desc: document.getElementById('tm-desc').value.trim(), groupId };

  if (isMeas) {
    const drawNo = document.getElementById('tm-drawno').value.trim();
    const tolStd = document.getElementById('tm-tolstd').value.trim();
    if (!drawNo) { toast('⚠️ Resim No zorunlu!','err'); return; }
    if (!tolStd) { toast('⚠️ Tolerans Standardı zorunlu!','err'); return; }
    const measRows = _collectMeasRows();
    if (!measRows.length) { toast('⚠️ En az bir ölçüm noktası ekleyin!','err'); return; }
    tData.formType = 'measurement';
    tData.drawNo   = drawNo;
    tData.tolStd   = tolStd;
    tData.refImage = _tmImgData || null;
    tData.measRows = measRows;
    tData.items    = [];
  } else {
    const rows = document.querySelectorAll('#tm-items .drow');
    const items = [];
    rows.forEach(r => {
      const v = r.querySelector('input').value.trim();
      if (v) items.push({ id:r.dataset.id||uid(), type:r.dataset.type||'item', text:v });
    });
    if (!items.filter(i=>i.type!=='heading').length) { toast('⚠️ En az bir kontrol maddesi ekleyin!','err'); return; }
    tData.formType = 'standard';
    tData.items    = items;
    tData.refImage = _tmImgData || null;
  }

  if (_etid) {
    const t = D.templates.find(x=>x.id===_etid);
    const changed = JSON.stringify(t.items||[])!==JSON.stringify(tData.items||[]) || t.name!==name;
    if (changed) {
      t.versions = [...(t.versions||[]), {version:t.version||1, savedAt:t.updatedAt||t.createdAt||Date.now(), items:t.items, measRows:t.measRows}].slice(-10);
      t.version  = (t.version||1)+1;
      t.updatedAt = Date.now();
    }
    Object.assign(t, tData);
    dbSave('templates', t.id, t).catch(e=>toast('Hata: '+e.message,'err'));
  } else {
    const t = { id:uid(), ...tData, version:1, versions:[], createdAt:Date.now() };
    D.templates.push(t);
    dbSave('templates', t.id, t).catch(e=>toast('Hata: '+e.message,'err'));
  }
  closeOv('ov-tmpl'); renderTemplates();
  toast('✅ Form kaydedildi','ok');
}

function delTemplate(id) {
  const t   = D.templates.find(x=>x.id===id);
  const cnt = D.sessions.filter(s=>s.templateId===id).length;
  if (!confirm('"' + t.name + '" formunu silmek istiyor musunuz?' + (cnt ? '\n\n⚠️ ' + cnt + ' kayıtta kullanılmış.' : ''))) return;
  D.templates = D.templates.filter(x=>x.id!==id);
  dbDel('templates', id).catch(e=>toast('Hata: '+e.message,'err'));
  renderTemplates(); toast('🗑️ Form silindi');
}

function showHistory(id) {
  const t = D.templates.find(x=>x.id===id);
  const vers = t.versions||[];
  document.getElementById('hm-title').textContent = t.name + ' — Geçmiş';
  document.getElementById('hm-body').innerHTML = !vers.length
    ? '<p style="color:var(--muted);font-size:.84rem">Henüz versiyon geçmişi yok.</p>'
    : vers.slice().reverse().map(v =>
        '<details style="margin-bottom:7px;border:1px solid var(--border);border-radius:8px;overflow:hidden">' +
        '<summary style="padding:8px 11px;background:var(--bg);cursor:pointer;font-weight:700;font-size:.81rem">v' + v.version + ' — ' + fmtDt(v.savedAt) + '</summary>' +
        '<div style="padding:9px 13px;font-size:.8rem;line-height:1.6">' +
        (v.items||[]).filter(i=>i.type!=='heading').map((i,n)=>'<div>'+(n+1)+'. '+esc(i.text)+'</div>').join('') +
        (v.measRows||[]).map((r,n)=>'<div>'+(n+1)+'. '+esc(r.desc)+' [min:'+r.min+' nom:'+r.nominal+' max:'+r.max+']</div>').join('') +
        '</div></details>'
      ).join('');
  openOv('ov-hist');
}

// ─────────────────────────────────────────────
// OPERATORS
// ─────────────────────────────────────────────
let _eoid = null;

function renderOperators() {
  const el = document.getElementById('operators-list');
  if (!D.operators.length) {
    el.innerHTML='<div class="empty"><div class="empty-ico">👷</div><p>Henüz operatör yok.</p></div>';
    return;
  }
  const sorted = [...D.operators].sort((a,b)=>(a.sicil||'').localeCompare(b.sicil||''));
  el.innerHTML = sorted.map(o=>`
    <div class="li">
      <div class="li-i">
        <div class="li-n">[${esc(o.sicil)}] ${esc(o.name)} ${esc(o.surname)}</div>
        <div class="li-m">Sicil: ${esc(o.sicil)} ${o.password_hash ? '🔑 Şifre var' : '⚠️ Şifre yok'}</div>
      </div>
      <div class="li-a">
        <button class="btn btn-ghost sm" onclick="openSetPass('${o.id}')" title="Şifre Belirle">🔑</button>
        <button class="btn btn-ghost sm" onclick="openOM('${o.id}')">✏️</button>
        <button class="btn btn-danger sm" onclick="delOperator('${o.id}')">🗑️</button>
      </div>
    </div>`).join('');
}

let _spOid = null;

function openSetPass(id) {
  _spOid = id;
  const o = D.operators.find(x=>x.id===id);
  document.getElementById('sp-opname').textContent = `[${o.sicil}] ${o.name} ${o.surname}`;
  document.getElementById('sp-pass1').value = '';
  document.getElementById('sp-pass2').value = '';
  document.getElementById('sp-err').style.display = 'none';
  openOv('ov-setpass');
}

async function savePass() {
  const p1 = document.getElementById('sp-pass1').value;
  const p2 = document.getElementById('sp-pass2').value;
  const errEl = document.getElementById('sp-err');
  if (!p1) { errEl.textContent='Şifre boş olamaz'; errEl.style.display='block'; return; }
  if (p1 !== p2) { errEl.textContent='Şifreler eşleşmiyor'; errEl.style.display='block'; return; }
  if (p1.length < 4) { errEl.textContent='Şifre en az 4 karakter olmalı'; errEl.style.display='block'; return; }

  const stored = await _hashNewPassword(p1);

  const o = D.operators.find(x=>x.id===_spOid);
  const updated = { ...o, password_hash: stored };
  D.operators = D.operators.map(x=>x.id===_spOid ? updated : x);
  dbSave('operators', _spOid, updated).catch(e=>toast('Hata: '+e.message,'err'));
  closeOv('ov-setpass');
  renderOperators();
  toast('✅ Şifre kaydedildi','ok');
}

function openOM(id=null) {
  _eoid = id;
  document.getElementById('om-title').textContent = id ? 'Operatör Düzenle' : 'Yeni Operatör';
  document.getElementById('om-sicil').value   = '';
  document.getElementById('om-name').value    = '';
  document.getElementById('om-surname').value = '';
  if (id) {
    const o = D.operators.find(x=>x.id===id);
    if (o) { document.getElementById('om-sicil').value=o.sicil||''; document.getElementById('om-name').value=o.name||''; document.getElementById('om-surname').value=o.surname||''; }
  }
  openOv('ov-op');
  setTimeout(() => document.getElementById('om-sicil').focus(), 60);
}

function saveOperator() {
  const sicil   = document.getElementById('om-sicil').value.trim();
  const name    = document.getElementById('om-name').value.trim();
  const surname = document.getElementById('om-surname').value.trim();
  if (!sicil)   { toast('⚠️ Sicil No zorunlu!','err'); return; }
  if (!name)    { toast('⚠️ Ad zorunlu!','err'); return; }
  if (!surname) { toast('⚠️ Soyad zorunlu!','err'); return; }
  if (D.operators.find(o=>o.sicil===sicil&&o.id!==_eoid)) { toast('⚠️ Bu sicil zaten kayıtlı!','err'); return; }

  if (_eoid) {
    const o = D.operators.find(x=>x.id===_eoid);
    const changed = o.sicil!==sicil||o.name!==name||o.surname!==surname;
    o.sicil=sicil; o.name=name; o.surname=surname; o.updatedAt=Date.now();
    if (changed) {
      D.sessions.forEach(s=>{
        const ids = s.operatorIds||(s.operatorId?[s.operatorId]:[]);
        if (ids.includes(_eoid)) {
          const ops = ids.map(id=>D.operators.find(x=>x.id===id)).filter(Boolean);
          s.operator = ops.map(op=>`[${op.sicil}] ${op.name} ${op.surname}`).join(', ');
          dbSave('sessions',s.id,s).catch(()=>{});
        }
      });
    }
    dbSave('operators', o.id, o).catch(e=>toast('Hata: '+e.message,'err'));
  } else {
    const o = { id:uid(), sicil, name, surname, createdAt:Date.now() };
    D.operators.push(o);
    dbSave('operators', o.id, o).catch(e=>toast('Hata: '+e.message,'err'));
  }
  closeOv('ov-op'); renderOperators();
  toast('✅ Operatör kaydedildi','ok');
}

function delOperator(id) {
  const o = D.operators.find(x=>x.id===id);
  const cnt = D.sessions.filter(s=>(s.operatorIds||[s.operatorId]).includes(id)).length;
  if (!confirm(`"${o.name} ${o.surname}" operatörünü silmek istiyor musunuz?${cnt?'\n\n⚠️ '+cnt+' kayıtta geçiyor.':''}`)) return;
  D.operators = D.operators.filter(x=>x.id!==id);
  dbDel('operators', id).catch(e=>toast('Hata: '+e.message,'err'));
  renderOperators(); toast('🗑️ Operatör silindi');
}
