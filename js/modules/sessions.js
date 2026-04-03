// sessions.js — Sessions, View, PDF

let _sfilt = 'all';
let _sview = 'grouped';
let _copen = {};

function setFilt(btn, f) {
  _sfilt = f;
  document.querySelectorAll('.fbtn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  renderSessions();
}

function setView(v) {
  _sview = v;
  document.getElementById('vbtn-g').classList.toggle('on', v==='grouped');
  document.getElementById('vbtn-l').classList.toggle('on', v==='list');
  renderSessions();
}

function renderSessions() {
  const el = document.getElementById('sessions-list');
  const q  = (document.getElementById('srch').value||'').trim().toLowerCase();
  let all  = [...D.sessions].filter(s=>s&&s.templateName).reverse();
  // Operatör: sadece kendi kayıtları
  all = _filterSessionsForUser(all);
  if (_sfilt!=='all') all=all.filter(s=>s.status===_sfilt);
  if (q) all=all.filter(s=>
    (s.operator||'').toLowerCase().includes(q)||
    (s.chassis||'').toLowerCase().includes(q)||
    (s.templateName||'').toLowerCase().includes(q)||
    (s.customer||'').toLowerCase().includes(q)
  );

  if (!all.length) {
    el.innerHTML='<div class="empty"><div class="empty-ico">📂</div><p>'+(q?'Aramanızla eşleşen kayıt yok.':'Henüz kayıt yok.')+'</p></div>';
    return;
  }

  // LIST view (or when filtering/searching)
  if (_sview==='list'||q||_sfilt!=='all') {
    el.innerHTML = all.map(s=>_sRowHtml(s)).join('');
    return;
  }

  // GROUPED view — group by (groupId, chassis)
  const combos=[]; const seen=new Set();
  all.forEach(s=>{
    const t  = D.templates.find(x=>x.id===s.templateId);
    const gId = t?(t.groupId||'__none__'):'__none__';
    const ch  = s.chassis||'__';
    const key = gId+'::'+ch;
    if (!seen.has(key)) {
      seen.add(key);
      const g = gId==='__none__'
        ? {id:'__none__',name:'Grupsuz'}
        : (D.groups.find(x=>x.id===gId)||{id:gId,name:'Bilinmeyen Grup'});
      combos.push({key,gId,g,chassis:s.chassis||null});
    }
  });

  el.innerHTML = combos.map(({key,gId,g,chassis})=>{
    const cSess = all.filter(s=>{
      const t=D.templates.find(x=>x.id===s.templateId);
      const sg=t?(t.groupId||'__none__'):'__none__';
      return sg+'::'+(s.chassis||'__')===key;
    });
    const gTmpls = gId==='__none__'
      ? D.templates.filter(t=>!t.groupId)
      : D.templates.filter(t=>t.groupId===gId);

    function tStat(tId) {
      const ss=cSess.filter(s=>s.templateId===tId);
      if(!ss.length)return'empty';
      if(ss.every(s=>s.status==='final'))return'ok';
      return'warn';
    }
    const allOk    = gTmpls.length && gTmpls.every(t=>tStat(t.id)==='ok');
    const anyEmpty = gTmpls.some(t=>tStat(t.id)==='empty');
    const hCls = allOk?'chdr-ok':anyEmpty?'chdr-warn':'chdr-part';
    const statBadge = allOk
      ? '<span class="badge b-final">✅ Tamamlandı</span>'
      : '<span class="badge b-draft">⚠️ Eksik / Taslak</span>';

    const isOpen = _copen[key]!==false;

    const tmplsHtml = gTmpls.map(t=>{
      const ts    = tStat(t.id);
      const tSess = cSess.filter(s=>s.templateId===t.id);
      const tBadge = ts==='ok'
        ? '<span class="badge b-final">✅ Tamam</span>'
        : ts==='warn'
        ? '<span class="badge b-draft">⚠️ Taslak</span>'
        : '<span class="badge b-empty">— Boş</span>';
      const dBtn = ts==='empty'
        ? `<button class="btn btn-primary sm" onclick="fillFromSession('${t.id}','${esc(chassis||'')}')">+ Doldur</button>` : '';
      return `<div class="tblock">
        <div class="tblock-hdr">
          <span>${esc(t.name)}</span>
          <div style="display:flex;gap:5px;align-items:center">${tBadge}${dBtn}</div>
        </div>
        ${tSess.length?`<div class="tblock-body">${tSess.map(s=>_sRowHtml(s)).join('')}</div>`:''}
      </div>`;
    }).join('');

    return `<div class="combo">
      <div class="combo-hdr ${hCls}" onclick="_copen['${key}']=!(_copen['${key}']!==false);renderSessions()">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="font-size:.76rem">${isOpen?'▾':'▸'}</span>
          <div>
            <div style="font-weight:700;font-size:.86rem">📁 ${esc(g.name)}</div>
            ${chassis?`<div style="font-size:.73rem;opacity:.78">${esc(chassis)}</div>`:''}
          </div>
          ${statBadge}
        </div>
        <span style="font-size:.72rem;opacity:.65">${gTmpls.length} form</span>
      </div>
      <div class="combo-body ${isOpen?'open':''}">${tmplsHtml}</div>
    </div>`;
  }).join('');
}

function _sRowHtml(s) {
  const vb=(s.templateVersion||1)>1
    ?`<span style="background:#dbeafe;color:#1e40af;padding:1px 5px;border-radius:8px;font-size:.67rem;font-weight:700">v${s.templateVersion}</span>`:'';
  return `<div class="srow">
    <div style="flex:1;min-width:0">
      <div style="font-weight:700;font-size:.81rem;display:flex;align-items:center;gap:5px;flex-wrap:wrap">${esc(s.templateName)} ${vb}</div>
      <div style="font-size:.71rem;color:var(--muted)">${esc(s.operator)} · ${fmtDt(s.savedAt||s.startedAt)}</div>
    </div>
    <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">
      <span class="badge ${s.status==='final'?'b-final':'b-draft'}">${s.status==='final'?'Kayıtlı':'Taslak'}</span>
      <button class="btn btn-ghost sm" onclick="viewSession('${s.id}')">👁</button>
      <button class="btn btn-amber sm"  onclick="editSession('${s.id}')">✏️</button>
      <button class="btn btn-primary sm" onclick="downloadPDF('${s.id}')">⬇</button>
      <button class="btn btn-danger sm" onclick="delSession('${s.id}')">🗑️</button>
    </div>
  </div>`;
}

function viewSession(id) {
  const s = D.sessions.find(x=>x.id===id); if(!s) return;
  document.getElementById('sm-title').textContent = s.templateName||'Kayıt';
  const stBg = s.status==='final'?'#d1fae5':'#fef3c7';
  const stC  = s.status==='final'?'#065f46':'#92400e';

  // Kabul durumu badge
  const fsBg = s.finalStatus==='ok' ? '#d1fae5' : s.finalStatus==='nok' ? '#fee2e2' : s.finalStatus==='cond' ? '#e0f2fe' : '#f1f5f9';
  const fsC  = s.finalStatus==='ok' ? '#065f46' : s.finalStatus==='nok' ? '#991b1b' : s.finalStatus==='cond' ? '#0c4a6e' : '#64748b';
  const fsT  = s.finalStatus==='ok' ? '✅ OK — Kabul' : s.finalStatus==='nok' ? '❌ NOK — Red' : s.finalStatus==='cond' ? '🔵 Şartlı Kabul' : '—';
  const metaHtml =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px 14px;background:#f5f7fc;border-radius:8px;padding:11px;margin-bottom:12px;font-size:.8rem">' +
    '<div><b>Operatör:</b> '+esc(s.operator)+'</div>' +
    '<div><b>Şasi:</b> '+esc(s.chassis||'—')+'</div>' +
    (s.formType==='measurement'
      ? '<div><b>Resim No:</b> '+esc(s.drawNo||'—')+'</div><div><b>Tolerans Std:</b> '+esc(s.tolStd||'—')+'</div>' +
        '<div><b>Ölçü Aleti SN:</b> '+esc(s.toolSN||'—')+'</div>'
      : '<div><b>Müşteri:</b> '+esc(s.customer||'—')+'</div><div><b>Sipariş:</b> '+esc(s.order||'—')+'</div>') +
    '<div><b>İstasyon:</b> '+esc(s.location||'—')+'</div>' +
    '<div><b>Tarih:</b> '+fmtDt(s.savedAt||s.startedAt)+'</div>' +
    '<div><b>Durum:</b> <span style="background:'+stBg+';color:'+stC+';padding:1px 7px;border-radius:4px;font-weight:700;font-size:.73rem">'+(s.status==='final'?'Kayıtlı':'Taslak')+'</span></div>' +
    (s.finalStatus ? '<div><b>Kabul:</b> <span style="background:'+fsBg+';color:'+fsC+';padding:1px 7px;border-radius:4px;font-weight:700;font-size:.73rem">'+fsT+'</span></div>' : '') +
    (s.note ? '<div style="grid-column:1/-1"><b>Not:</b> '+esc(s.note)+'</div>' : '') +
    (s.formNote ? '<div style="grid-column:1/-1"><b>Genel Not:</b> '+esc(s.formNote)+'</div>' : '') +
    (s.condNote ? '<div style="grid-column:1/-1;background:#e0f2fe;border-radius:5px;padding:4px 8px"><b style="color:#0284c7">🔵 Şartlı Kabul Koşulu:</b> '+esc(s.condNote)+'</div>' : '') +
    '</div>' +
    (s.refImage && s.formType!=='measurement' ? '<div style="text-align:center;margin-bottom:10px"><img src="'+s.refImage+'" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid var(--border);object-fit:contain"></div>' : '');

  let tableHtml = '';
  if (s.formType === 'measurement') {
    const measRows = s.measRowsSnapshot || [];
    const measResp = s.measResponses || {};
    tableHtml = '<table class="ptbl"><thead><tr>' +
      '<th style="width:46px;text-align:center">Sıra No</th>' +
      '<th style="width:60px;text-align:center">S-S Farkı</th>' +
      '<th style="width:65px;text-align:center">Nominal</th><th style="width:60px;text-align:center">± Tol.</th>' +
      '<th style="width:90px;text-align:center">Min / Max</th>' +
      '<th style="width:70px;text-align:center">Fiili</th><th style="width:60px;text-align:center">Sonuç</th>' +
      '</tr></thead><tbody>' +
      measRows.map((row, i) => {
        const r = measResp[row.id] || {};
        const rBg = r.result==='ok' ? '#d1fae5' : r.result==='nok' ? '#fee2e2' : '';
        const rC  = r.result==='ok' ? '#065f46' : r.result==='nok' ? '#991b1b' : '';
        const rT  = r.result==='ok' ? '✅ Kabul' : r.result==='nok' ? '❌ Ret' : '—';
        return '<tr><td style="text-align:center">'+(i+1)+'</td>' +
          '<td style="text-align:center;color:#1d4ed8;font-weight:600;background:#eff6ff">'+(row.ssGap!=null?row.ssGap:'—')+'</td>' +
          '<td style="text-align:center;font-weight:700;color:#065f46">'+(row.nominal!=null?row.nominal:'—')+'</td>' +
          '<td style="text-align:center;font-weight:700;color:#92400e">'+(row.tol!=null?('±'+row.tol):'—')+'</td>' +
          '<td style="text-align:center;font-size:.75rem;color:var(--muted)">'+(row.min!=null&&row.max!=null?(row.min+' / '+row.max):'—')+'</td>' +
          '<td style="text-align:center;font-weight:700">'+(r.measured!=null?r.measured:'—')+'</td>' +
          '<td style="text-align:center"><span style="background:'+rBg+';color:'+rC+';padding:1px 6px;border-radius:4px;font-size:.71rem;font-weight:700">'+rT+'</span></td>' +
          '<td style="font-size:.75rem;color:var(--muted)">'+esc(r.note||'—')+'</td></tr>';
      }).join('') +
      '</tbody></table>';
  } else {
    const items = s.templateSnapshot||(D.templates.find(x=>x.id===s.templateId)||{}).items||[];
    const lm = {ok:'✅ Uygun', nok:'❌ Uygun Değil', dev:'⚠️ Sapmalı'};
    let n=0;
    const rowsHtml = items.map(item => {
      if(item.type==='heading') return '<tr class="tbl-sec"><td colspan="4">📌 '+esc(item.text)+'</td></tr>';
      n++; const r=(s.responses||{})[item.id]||{};
      return '<tr><td>'+n+'</td><td>'+esc(item.text)+'</td><td>'+(lm[r.value]||'—')+'</td><td>'+(r.reason?esc(r.reason):'—')+'</td></tr>';
    }).join('');
    tableHtml = '<table class="ptbl"><thead><tr><th>#</th><th>Madde</th><th>Sonuç</th><th>Açıklama</th></tr></thead><tbody>'+rowsHtml+'</tbody></table>';
  }

  document.getElementById('sm-body').innerHTML = metaHtml + tableHtml;
  document.getElementById('sm-edit-btn').onclick = () => { closeOv('ov-sess'); editSession(id); };
  document.getElementById('sm-pdf-btn').onclick  = () => { downloadPDF(id); closeOv('ov-sess'); };
  openOv('ov-sess');
}

function delSession(id) {
  if (!confirm('Bu kaydı silmek istiyor musunuz?')) return;
  D.sessions = D.sessions.filter(s=>s.id!==id);
  dbDel('sessions', id).catch(e=>toast('Hata: '+e.message,'err'));
  renderSessions(); renderDash();
  toast('🗑️ Kayıt silindi');
}

function downloadPDF(id) {
  const s = D.sessions.find(x=>x.id===id);
  if (!s) { toast('⚠️ Kayıt bulunamadı','err'); return; }

  const stLbl = s.status==='final'?'Kayıtlı':'Taslak';
  const stBg  = s.status==='final'?'#d1fae5':'#fef3c7';
  const stC   = s.status==='final'?'#065f46':'#92400e';

  const mr = (lbl,val) => '<div style="display:flex;gap:4px;font-size:11px"><span style="font-weight:700;min-width:82px;color:#374151">'+lbl+':</span><span>'+esc(val||'—')+'</span></div>';

  let bodyHtml = '';

  if (s.formType === 'measurement') {
    // ── Ölçüm Kontrol PDF ──
    const measRows = s.measRowsSnapshot || [];
    const measResp = s.measResponses || {};
    const imgTag = s.refImage ? '<div style="text-align:center;margin:8px 14mm"><img src="'+s.refImage+'" style="max-width:100%;max-height:220px;border-radius:6px;border:1px solid #d0d9ee;object-fit:contain"></div>' : '';

    let rowsHtml = '';
    measRows.forEach((row, i) => {
      const r = measResp[row.id] || {};
      const rBg = r.result==='ok'?'#d1fae5':r.result==='nok'?'#fee2e2':'#f3f4f6';
      const rC  = r.result==='ok'?'#065f46':r.result==='nok'?'#991b1b':'#6b7280';
      const rT  = r.result==='ok'?'KABUL':r.result==='nok'?'RET':'—';
      rowsHtml += '<tr style="background:'+(i%2?'#fff':'#f8fafc')+'">' +
        '<td style="padding:5px 7px;border:1px solid #dce4f5;text-align:center;font-weight:700;color:var(--navy);font-size:11px">'+esc(row.seqNo||String(i+1))+'</td>' +
        '<td style="padding:5px 7px;border:1px solid #dce4f5;text-align:center;font-weight:600;color:#1d4ed8;background:#eff6ff;font-size:11px">'+(row.ssGap!=null?row.ssGap:'—')+'</td>' +
        '<td style="padding:5px 7px;border:1px solid #dce4f5;text-align:center;font-weight:700;color:#065f46;background:#f0fdf4;font-size:11px">'+(row.nominal!=null?row.nominal:'—')+'</td>' +
        '<td style="padding:5px 7px;border:1px solid #dce4f5;text-align:center;font-weight:700;color:#92400e;background:#fffbeb;font-size:11px">'+(row.tol!=null?('±'+row.tol):'—')+'</td>' +
        '<td style="padding:5px 7px;border:1px solid #dce4f5;text-align:center;font-size:10px;color:#64748b">'+(row.min!=null&&row.max!=null?(row.min+' / '+row.max):'—')+'</td>' +
        '<td style="padding:5px 7px;border:1px solid #dce4f5;text-align:center;font-weight:700;font-size:12px">'+(r.measured!=null?r.measured:'—')+'</td>' +
        '<td style="padding:5px 7px;border:1px solid #dce4f5;text-align:center"><span style="background:'+rBg+';color:'+rC+';padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700">'+rT+'</span></td>' +
        '<td style="padding:5px 7px;border:1px solid #dce4f5;font-size:10px;color:#6b7280">'+esc(r.note||'—')+'</td>' +
        '</tr>';
    });

    bodyHtml =
      '<div class="meta">' +
      mr('Operatör',s.operator)+mr('Şasi No',s.chassis) +
      mr('Resim No',s.drawNo)+mr('Tolerans Std',s.tolStd) +
      mr('Ölçü Aleti SN',s.toolSN)+mr('İstasyon',s.location) +
      '<div style="display:flex;gap:4px;font-size:11px"><span style="font-weight:700;min-width:82px;color:#374151">Durum:</span>' +
      '<span style="background:'+stBg+';color:'+stC+';padding:1px 7px;border-radius:4px;font-weight:700;font-size:10px">'+stLbl+'</span></div>' +
      (s.note ? '<div style="grid-column:1/-1">'+mr('Not',s.note)+'</div>' : '') +
      (s.formNote ? '<div style="grid-column:1/-1">'+mr('Genel Not',s.formNote)+'</div>' : '') +
      '</div>' +
      imgTag +
      '<div class="tbl"><table>' +
      '<thead><tr>' +
      '<th style="width:26px;text-align:center">#</th>' +
      '<th>Açıklama (Sağ-Sol / Ölçüm Farkı)</th>' +
      '<th style="width:46px;text-align:center">Sıra No</th>' +
      '<th style="width:52px;text-align:center">S-S Farkı</th>' +
      '<th style="width:62px;text-align:center">Nominal</th>' +
      '<th style="width:52px;text-align:center">± Tol.</th>' +
      '<th style="width:86px;text-align:center">Min / Max</th>' +
      '<th style="width:58px;text-align:center">Fiili Ölçü</th>' +
      '<th style="width:52px;text-align:center">Sonuç</th>' +
      '</tr></thead><tbody>'+rowsHtml+'</tbody></table></div>';

  } else {
    // ── Standart Kontrol PDF ──
    const items = s.templateSnapshot||(D.templates.find(x=>x.id===s.templateId)||{}).items||[];
    const lm = {ok:{t:'Uygun',c:'#065f46',b:'#d1fae5'},nok:{t:'Uygun Değil',c:'#991b1b',b:'#fee2e2'},dev:{t:'Sapmalı Uygun',c:'#92400e',b:'#fef3c7'}};
    let n=0;
    const rowsHtml = items.map(item => {
      if(item.type==='heading') return '<tr><td colspan="4" style="background:linear-gradient(135deg,#0c1e4a,#1a3272);color:#fff;font-weight:700;padding:6px 9px;font-size:11px">📌 '+esc(item.text)+'</td></tr>';
      n++; const r=(s.responses||{})[item.id]||{}; const lv=lm[r.value]||{t:'—',c:'#6b7280',b:'#f3f4f6'};
      return '<tr style="background:'+(n%2?'#fff':'#f8fafc')+'">' +
        '<td style="padding:5px 7px;border:1px solid #dce4f5;text-align:center;color:#64748b;font-size:11px">'+n+'</td>' +
        '<td style="padding:5px 7px;border:1px solid #dce4f5;font-size:11px">'+esc(item.text)+'</td>' +
        '<td style="padding:5px 7px;border:1px solid #dce4f5;text-align:center"><span style="background:'+lv.b+';color:'+lv.c+';padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700">'+lv.t+'</span></td>' +
        '<td style="padding:5px 7px;border:1px solid #dce4f5;font-size:11px">'+(r.reason?esc(r.reason):'—')+'</td></tr>';
    }).join('');

    bodyHtml =
      '<div class="meta">' +
      mr('Operatör',s.operator)+mr('Şasi No',s.chassis)+mr('Müşteri',s.customer)+mr('Sipariş No',s.order)+mr('İstasyon',s.location) +
      '<div style="display:flex;gap:4px;font-size:11px"><span style="font-weight:700;min-width:82px;color:#374151">Durum:</span>' +
      '<span style="background:'+stBg+';color:'+stC+';padding:1px 7px;border-radius:4px;font-weight:700;font-size:10px">'+stLbl+'</span></div>' +
      (s.finalStatus ? (() => { const fb=s.finalStatus==='ok'?'#d1fae5':s.finalStatus==='cond'?'#e0f2fe':'#fee2e2',fc=s.finalStatus==='ok'?'#065f46':s.finalStatus==='cond'?'#0c4a6e':'#991b1b',ft=s.finalStatus==='ok'?'✅ OK — KABUL':s.finalStatus==='cond'?'🔵 ŞARTLI KABUL':'❌ NOK — RED'; return '<div style="display:flex;gap:4px;font-size:11px"><span style="font-weight:700;min-width:82px;color:#374151">Kabul:</span><span style="background:'+fb+';color:'+fc+';padding:1px 7px;border-radius:4px;font-weight:700;font-size:10px">'+ft+'</span></div>'; })() : '') +
      (s.condNote ? '<div style="grid-column:1/-1;background:#e0f2fe;border-radius:4px;padding:3px 7px;font-size:11px"><span style="font-weight:700;color:#0284c7">🔵 Şartlı Kabul Koşulu:</span> '+esc(s.condNote)+'</div>' : '') +
      (s.note ? '<div style="grid-column:1/-1">'+mr('Not',s.note)+'</div>' : '') +
      (s.formNote ? '<div style="grid-column:1/-1">'+mr('Genel Not',s.formNote)+'</div>' : '') +
      '</div>' +
      (s.refImage && s.formType!=='measurement' ? '<div style="text-align:center;margin:8px 14mm"><img src="'+s.refImage+'" style="max-width:100%;max-height:180px;border-radius:6px;border:1px solid #d0d9ee;object-fit:contain"></div>' : '') +
      '<div class="tbl"><table>' +
      '<thead><tr><th style="width:26px;text-align:center">#</th><th>Kontrol Maddesi</th><th style="width:96px;text-align:center">Sonuç</th><th style="width:86px">Açıklama</th></tr></thead>' +
      '<tbody>'+rowsHtml+'</tbody></table></div>';
  }

  const pdfTitle = s.formType==='measurement' ? 'ÖLÇÜM KONTROL FORMU' : 'KALİTE KONTROL BELGESİ';
  const html = '<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">' +
    '<title>'+slugify(s.chassis||'NoSasi')+'_'+slugify(s.templateName||'Belge')+'</title>' +
    '<style>' +
    '@page{size:A4;margin:0}*{box-sizing:border-box;margin:0;padding:0}body{font-family:\'Segoe UI\',Arial,sans-serif}' +
    '.hdr{background:#0c1e4a;color:#fff;padding:13px 18px 11px}.acc{height:3px;background:#1d4ed8}' +
    '.meta{margin:10px 14mm;background:#f5f7fc;border:1px solid #d0d9ee;border-radius:6px;padding:10px 13px;display:grid;grid-template-columns:1fr 1fr;gap:5px 16px}' +
    '.tbl{margin:9px 14mm 0}table{width:100%;border-collapse:collapse}thead tr{background:#0c1e4a;color:#fff}' +
    'thead th{padding:6px 7px;font-size:10px;text-align:left;border:1px solid #091840}' +
    '.ftr{position:fixed;bottom:0;left:0;right:0;height:9mm;background:#0c1e4a;color:rgba(255,255,255,.58);display:flex;align-items:center;justify-content:space-between;padding:0 18px;font-size:9px}' +
    'tr{page-break-inside:avoid}@media print{.nop{display:none}}' +
    '</style></head><body>' +
    '<div class="hdr">' +
    '<div style="font-size:14px;font-weight:800">'+pdfTitle+'</div>' +
    '<div style="font-size:11px;opacity:.8;margin-top:2px">'+esc(s.templateName)+(s.templateVersion?' · v'+s.templateVersion:'')+'</div>' +
    '<div style="font-size:10px;opacity:.55;margin-top:1px">'+fmtDt(s.savedAt||s.startedAt)+'</div>' +
    '</div>' +
    '<div class="acc"></div>' +
    bodyHtml +
    '<div class="ftr"><span>Kalite Kontrol Sistemi</span><span>'+esc(s.operator)+' · '+esc(s.chassis||'')+'</span></div>' +
    '<div class="nop" style="position:fixed;top:10px;right:10px">' +
    '<button onclick="window.print()" style="background:#0c1e4a;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px">🖨️ PDF Kaydet</button>' +
    '</div>' +
    '<script>window.onload=function(){window.print()};<\/script>' +
    '</body></html>';

  function slugify(str) {
    return String(str||'').trim().replace(/[\s/\\:*?"<>|]+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'').substring(0,80)||'belge';
  }
  const fileName = slugify(s.chassis||'NoSasi')+'_'+slugify(s.templateName||'Belge')+'.html';
  const blob = new Blob([html], {type:'text/html;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (!win) {
    const a = document.createElement('a'); a.href=url; a.download=fileName; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 10000);
    toast('⬇ Dosya indiriliyor: '+fileName,'ok'); return;
  }
  try { win.document.title = fileName.replace('.html',''); } catch(e){}
  setTimeout(()=>URL.revokeObjectURL(url), 60000);
  toast('📄 PDF penceresi açıldı','ok',4000);
}
