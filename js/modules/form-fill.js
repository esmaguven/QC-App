// ─────────────────────────────────────────────
// FILL — Operator multi-select
// ─────────────────────────────────────────────
let _selOps = [];

function _redrawChips() {
  const wrap = document.getElementById('chip-wrap');
  const ph   = document.getElementById('chip-ph');
  wrap.querySelectorAll('.chip').forEach(c=>c.remove());
  if (ph) ph.style.display = _selOps.length ? 'none' : '';
  _selOps.forEach(id => {
    const o = D.operators.find(x=>x.id===id); if(!o) return;
    const sp = document.createElement('span');
    sp.className = 'chip';
    sp.innerHTML = `[${esc(o.sicil)}] ${esc(o.name)} ${esc(o.surname)}<button class="chip-rm" onclick="event.stopPropagation();_rmOp('${id}')"><span class="material-symbols-rounded" style="font-size:14px">close</span></button>`;
    wrap.insertBefore(sp, ph);
  });
}

function _rmOp(id) { _selOps=_selOps.filter(x=>x!==id); _redrawChips(); _redrawDD(); }

function _redrawDD() {
  const ul = document.getElementById('op-dd');
  const sorted = [...D.operators].sort((a,b)=>(a.sicil||'').localeCompare(b.sicil||''));
  ul.innerHTML = sorted.map(o=>{
    const sel=_selOps.includes(o.id);
    return `<li class="${sel?'sel':''}" onclick="_togOp('${o.id}')">[${esc(o.sicil)}] ${esc(o.name)} ${esc(o.surname)}${sel?' <span class="material-symbols-rounded" style="font-size:16px;vertical-align:middle;margin-left:4px">check</span>':''}</li>`;
  }).join('') || '<li style="color:var(--muted);pointer-events:none;font-size:.8rem">Operatör bulunamadı</li>';
}

function _togOp(id) { const i=_selOps.indexOf(id); if(i>=0) _selOps.splice(i,1); else _selOps.push(id); _redrawChips(); _redrawDD(); }

function toggleOpDD() {
  const dd = document.getElementById('op-dd');
  const open = dd.style.display==='block';
  dd.style.display = open?'none':'block';
  if (!open) _redrawDD();
}

// ─────────────────────────────────────────────
// FILL — Form logic
// ─────────────────────────────────────────────
let _fillD  = null;
let _editSid = null;
let _asTimer = null;

function initFill() {
  _fillGSel('f-grp', null);
  document.getElementById('f-tmpl').innerHTML = '<option value="">— Önce grup seçin —</option>';
  document.getElementById('f-tmpl').disabled = true;
  if (!_editSid) {
    document.getElementById('f-chassis').value  = '';
    document.getElementById('f-customer').value = '';
    document.getElementById('f-order').value    = '';
    document.getElementById('f-location').value = '';
    document.getElementById('f-note').value     = '';
    _selOps = []; _redrawChips();
  }
  document.getElementById('fs-select').style.display = '';
  document.getElementById('fs-form').style.display   = 'none';
  document.getElementById('fill-banner').style.display = 'none';
}

function onFGrpChange() {
  const gId = document.getElementById('f-grp').value;
  const sel  = document.getElementById('f-tmpl');
  const tmpls = D.templates.filter(t=>t.groupId===gId);
  sel.innerHTML = '<option value="">— Form seçin —</option>' +
    tmpls.map(t=>'<option value="'+t.id+'">'+(t.formType==='measurement'?'📐 ':'📋 ')+esc(t.name)+'</option>').join('');
  sel.disabled = !gId;
}

function startFill() {
  const tmplId  = document.getElementById('f-tmpl').value;
  const chassis = document.getElementById('f-chassis').value.trim().toUpperCase();
  if (!tmplId)         { toast('⚠️ Form seçmelisiniz!','err'); return; }
  if (!_selOps.length) { toast('⚠️ En az bir operatör seçin!','err'); return; }
  if (!chassis)        { toast('⚠️ Şasi No zorunlu!','err'); document.getElementById('f-chassis').focus(); return; }

  const tmpl    = D.templates.find(x=>x.id===tmplId);
  const ops     = _selOps.map(id=>D.operators.find(x=>x.id===id)).filter(Boolean);
  const opLabel = ops.map(o=>'['+o.sicil+'] '+o.name+' '+o.surname).join(', ');

  let prevResp = {};
  let prevMeasResp = {};
  let prevToolSN = '';
  if (_editSid) {
    const es = D.sessions.find(s=>s.id===_editSid);
    if (es) { prevResp=es.responses||{}; prevMeasResp=es.measResponses||{}; prevToolSN=es.toolSN||''; }
  }

  _fillD = {
    id: _editSid||uid(),
    templateId: tmpl.id, templateName: tmpl.name,
    templateVersion: tmpl.version||1,
    formType: tmpl.formType||'standard',
    templateSnapshot: JSON.parse(JSON.stringify(tmpl.items||[])),
    measRowsSnapshot: JSON.parse(JSON.stringify(tmpl.measRows||[])),
    drawNo: tmpl.drawNo||'',
    tolStd: tmpl.tolStd||'',
    refImage: tmpl.refImage||null,
    operatorIds: [..._selOps], operatorId: _selOps[0],
    operator: opLabel,
    chassis,
    customer: document.getElementById('f-customer').value.trim(),
    order:    document.getElementById('f-order').value.trim(),
    location: document.getElementById('f-location').value.trim(),
    note:     document.getElementById('f-note').value.trim(),
    startedAt: _editSid ? (D.sessions.find(s=>s.id===_editSid)||{}).startedAt||Date.now() : Date.now(),
    status: 'draft',
    responses: prevResp,
    measResponses: prevMeasResp,
    toolSN: prevToolSN,
    finalStatus: _editSid ? (D.sessions.find(s=>s.id===_editSid)||{}).finalStatus||'' : '',
    formNote: _editSid ? (D.sessions.find(s=>s.id===_editSid)||{}).formNote||'' : ''
  };
  _editSid = null;

  document.getElementById('bn-tmpl').textContent = tmpl.name;
  document.getElementById('bn-op').textContent   = opLabel;
  document.getElementById('bn-ch').textContent   = chassis;
  document.getElementById('fill-banner').style.display = '';
  document.getElementById('fs-select').style.display   = 'none';
  document.getElementById('fs-form').style.display     = '';

  _buildFillUI();
  _updProg();
  _startAS();
}

function _buildFillUI() {
  if (_fillD.formType === 'measurement') {
    _buildMeasFillUI();
    return;
  }
  const items    = _fillD.templateSnapshot;
  const prevFS   = _fillD.finalStatus || '';
  const prevNote = _fillD.formNote    || '';
  let html = '';

  if (_fillD.refImage) {
    html += '<div class="fill-sec" style="text-align:center">' +
      '<div style="font-weight:700;font-size:.83rem;color:var(--navy);margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:4px"><span class="material-symbols-rounded">attach_file</span> Referans Fotoğraf</div>' +
      '<img src="'+_fillD.refImage+'" style="max-width:100%;max-height:280px;border-radius:8px;border:1px solid var(--border);object-fit:contain">' +
      '</div>';
  }

  let n = 0;
  html += items.map(item => {
    if (item.type==='heading') return '<div class="fheading" style="display:flex;align-items:center;gap:6px"><span class="material-symbols-rounded" style="color:var(--primary)">push_pin</span> '+esc(item.text)+'</div>';
    n++;
    const r = (_fillD.responses||{})[item.id]||{};
    const sc = v => r.value===v ? ' r-'+v : '';
    return '<div class="fitem'+(r.value?' '+r.value:'')+'" id="fi-'+item.id+'">' +
      '<div class="fitem-hdr"><span class="fitem-n">'+n+'.</span><span class="fitem-t">'+esc(item.text)+'</span></div>' +
      '<div class="rg">' +
        '<label class="ropt'+sc('ok')+'" onclick="_pick(\''+item.id+'\',\'ok\',this)"><input type="radio" name="r-'+item.id+'" value="ok" '+(r.value==='ok'?'checked':'')+' > <span class="material-symbols-rounded">check_circle</span> Uygun</label>' +
        '<label class="ropt'+sc('nok')+'" onclick="_pick(\''+item.id+'\',\'nok\',this)"><input type="radio" name="r-'+item.id+'" value="nok" '+(r.value==='nok'?'checked':'')+' > <span class="material-symbols-rounded">cancel</span> Uygun Değil</label>' +
        '<label class="ropt'+sc('dev')+'" onclick="_pick(\''+item.id+'\',\'dev\',this)"><input type="radio" name="r-'+item.id+'" value="dev" '+(r.value==='dev'?'checked':'')+' > <span class="material-symbols-rounded">warning</span> Sapmalı</label>' +
      '</div>' +
      '<div class="reason" id="rb-'+item.id+'" style="display:'+((r.value==='nok'||r.value==='dev')?'':'none')+'">' +
        '<label>Sebep / Açıklama *</label>' +
        '<textarea rows="2" id="rs-'+item.id+'" placeholder="Lütfen açıklayın...">'+esc(r.reason||'')+'</textarea>' +
      '</div></div>';
  }).join('');

  const okSty  = prevFS==='ok'  ? 'background:var(--success-bg);border-color:var(--success);color:#065f46;' : '';
  const nokSty = prevFS==='nok' ? 'background:var(--danger-bg);border-color:var(--danger);color:#991b1b;' : '';
  html += '<div class="fill-sec" style="border:2px solid var(--border);border-radius:10px;padding:14px;background:var(--surface);margin-top:4px">' +
    '<div style="font-weight:800;font-size:.9rem;color:var(--navy);margin-bottom:12px;display:flex;align-items:center;gap:6px"><span class="material-symbols-rounded">assignment_turned_in</span> Kabul Durumu</div>' +
    '<div style="display:flex;gap:10px;margin-bottom:14px">' +
      '<label id="fs-ok-lbl" style="display:flex;align-items:center;gap:8px;padding:10px 20px;border:2px solid var(--border);border-radius:9px;cursor:pointer;flex:1;font-size:.9rem;font-weight:700;transition:all .15s;'+okSty+'">' +
        '<input type="radio" name="final-status" value="ok" '+(prevFS==='ok'?'checked':'')+' onchange="_onFinalStatus()" style="accent-color:var(--success);width:16px;height:16px"> <span class="material-symbols-rounded">check_circle</span> OK — Kabul' +
      '</label>' +
      '<label id="fs-nok-lbl" style="display:flex;align-items:center;gap:8px;padding:10px 20px;border:2px solid var(--border);border-radius:9px;cursor:pointer;flex:1;font-size:.9rem;font-weight:700;transition:all .15s;'+nokSty+'">' +
        '<input type="radio" name="final-status" value="nok" '+(prevFS==='nok'?'checked':'')+' onchange="_onFinalStatus()" style="accent-color:var(--danger);width:16px;height:16px"> <span class="material-symbols-rounded">cancel</span> NOK — Red' +
      '</label>' +
    '</div>' +
    '<div class="fg" style="margin-bottom:0">' +
      '<label style="display:flex;align-items:center;gap:4px"><span class="material-symbols-rounded" style="font-size:16px">notes</span> Genel Not <span style="font-weight:400;color:var(--muted)">(opsiyonel)</span></label>' +
      '<textarea id="std-form-note" rows="3" placeholder="Genel not ekleyin..." style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:7px;font-size:.84rem;font-family:inherit;resize:vertical;box-sizing:border-box">'+esc(prevNote)+'</textarea>' +
    '</div>' +
  '</div>';

  document.getElementById('fill-items').innerHTML = html;
}

function _onFinalStatus() {
  const val = document.querySelector('input[name="final-status"]:checked')?.value || null;
  const okLbl  = document.getElementById('fs-ok-lbl');
  const nokLbl = document.getElementById('fs-nok-lbl');
  if (okLbl) {
    okLbl.style.background  = val==='ok'  ? 'var(--success-bg)' : '';
    okLbl.style.borderColor = val==='ok'  ? 'var(--success)' : 'var(--border)';
    okLbl.style.color       = val==='ok'  ? '#065f46' : '';
  }
  if (nokLbl) {
    nokLbl.style.background  = val==='nok' ? 'var(--danger-bg)' : '';
    nokLbl.style.borderColor = val==='nok' ? 'var(--danger)' : 'var(--border)';
    nokLbl.style.color       = val==='nok' ? '#991b1b' : '';
  }
}

function _buildMeasFillUI() {
  const rows    = _fillD.measRowsSnapshot || [];
  const resp    = _fillD.measResponses || {};
  const toolSN  = _fillD.toolSN || '';
  const formNote = _fillD.formNote || '';

  let html = '<div class="fill-sec" style="background:var(--primary-soft);border-color:var(--border)">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px 14px;font-size:.82rem">' +
    '<div><span style="font-weight:700;color:var(--navy)">Resim No:</span> <span style="color:var(--text)">'+esc(_fillD.drawNo||'—')+'</span></div>' +
    '<div><span style="font-weight:700;color:var(--navy)">Tolerans Std:</span> <span style="color:var(--text)">'+esc(_fillD.tolStd||'—')+'</span></div>' +
    '<div><span style="font-weight:700;color:var(--navy)">Tarih:</span> <span style="color:var(--text)">'+new Date().toLocaleDateString('tr-TR')+'</span></div>' +
    '</div></div>';

  html += '<div class="fill-sec">' +
    '<div class="fg" style="margin-bottom:0">' +
    '<label>Ölçü Aleti Seri No *</label>' +
    '<input type="text" id="meas-tool-sn" value="'+esc(toolSN)+'" placeholder="Ölçü aleti seri/kalibrasyon no...">' +
    '</div></div>';

  if (_fillD.refImage) {
    html += '<div class="fill-sec" style="text-align:center">' +
      '<div style="font-weight:700;font-size:.83rem;color:var(--navy);margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:4px"><span class="material-symbols-rounded">architecture</span> Referans Resim / Çizim</div>' +
      '<img src="'+_fillD.refImage+'" style="max-width:100%;max-height:300px;border-radius:8px;border:1px solid var(--border);object-fit:contain">' +
      '</div>';
  }

  html += '<div class="fill-sec">' +
    '<div style="font-weight:700;font-size:.86rem;color:var(--navy);margin-bottom:10px;display:flex;align-items:center;gap:6px"><span class="material-symbols-rounded">straighten</span> Ölçüm Tablosu</div>' +
    '<div style="overflow-x:auto">' +
    '<table style="width:100%;border-collapse:collapse;font-size:.8rem">' +
    '<thead><tr style="background:var(--navy);color:#fff">' +
    '<th style="padding:7px 8px;text-align:center;white-space:nowrap;min-width:46px">Sıra No</th>' +
    '<th style="padding:7px 8px;text-align:center;white-space:nowrap;min-width:62px">S-S Farkı</th>' +
    '<th style="padding:7px 8px;text-align:center;white-space:nowrap;background:#064e3b">Nominal</th>' +
    '<th style="padding:7px 8px;text-align:center;white-space:nowrap;background:#78350f">± Tol.</th>' +
    '<th style="padding:7px 8px;text-align:center;white-space:nowrap">Min / Max</th>' +
    '<th style="padding:7px 8px;text-align:center;white-space:nowrap;min-width:90px">Fiili Ölçü</th>' +
    '<th style="padding:7px 8px;text-align:center;white-space:nowrap;min-width:80px">Sonuç</th>' +
    '</tr></thead><tbody>';

  rows.forEach((row, i) => {
    const r = resp[row.id] || {};
    html += '<tr style="background:'+(i%2?'#fff':'#f8fafc')+';border-bottom:1px solid var(--border)">' +
      '<td style="padding:6px 8px;text-align:center;font-weight:700;color:var(--navy)">'+esc(row.seqNo||String(i+1))+'</td>' +
      '<td style="padding:6px 8px;text-align:center;color:#1d4ed8;font-weight:600;background:#eff6ff">'+(row.ssGap!=null?row.ssGap:'—')+'</td>' +
      '<td style="padding:6px 8px;text-align:center;font-weight:700;color:#065f46;background:#f0fdf4">'+(row.nominal!=null?row.nominal:'—')+'</td>' +
      '<td style="padding:6px 8px;text-align:center;font-weight:700;color:#92400e;background:#fffbeb">'+(row.tol!=null?('±'+row.tol):'—')+'</td>' +
      '<td style="padding:6px 8px;text-align:center;font-size:.75rem;color:var(--muted)">'+(row.min!=null&&row.max!=null?(row.min+' / '+row.max):'—')+'</td>' +
      '<td style="padding:4px 6px;text-align:center">' +
        '<input type="number" step="0.01" id="mv-'+row.id+'" value="'+(r.measured!=null?r.measured:'')+'"' +
        ' onchange="_measAutoResult(\''+row.id+'\','+row.min+','+row.max+')" ' +
        ' style="width:84px;padding:4px 6px;border:1.5px solid var(--border);border-radius:6px;font-size:.82rem;text-align:center;font-family:inherit">' +
      '</td>' +
      '<td style="padding:4px 6px;text-align:center">' +
        '<div style="display:flex;gap:4px;justify-content:center">' +
          '<label style="display:flex;align-items:center;gap:3px;padding:4px 9px;border-radius:5px;border:1.5px solid var(--border);cursor:pointer;font-size:.75rem;font-weight:700;'+(r.result==='ok'?'background:var(--success-bg);border-color:var(--success);color:#065f46':'')+'">' +
            '<input type="radio" name="mr-'+row.id+'" value="ok" '+(r.result==='ok'?'checked':'')+' onchange="_onMeasResult(\''+row.id+'\')"> K</label>' +
          '<label style="display:flex;align-items:center;gap:3px;padding:4px 9px;border-radius:5px;border:1.5px solid var(--border);cursor:pointer;font-size:.75rem;font-weight:700;'+(r.result==='nok'?'background:var(--danger-bg);border-color:var(--danger);color:#991b1b':'')+'">' +
            '<input type="radio" name="mr-'+row.id+'" value="nok" '+(r.result==='nok'?'checked':'')+' onchange="_onMeasResult(\''+row.id+'\')"> R</label>' +
        '</div>' +
      '</td>' +
    '</tr>';
  });

  html += '</tbody></table></div></div>';

  html += '<div class="fill-sec">' +
    '<div class="fg" style="margin-bottom:0">' +
    '<label style="display:flex;align-items:center;gap:4px"><span class="material-symbols-rounded" style="font-size:16px">notes</span> Genel Not (opsiyonel)</label>' +
    '<textarea id="meas-form-note" rows="3" placeholder="Forma genel not ekleyin..." style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:7px;font-size:.84rem;font-family:inherit;resize:vertical;box-sizing:border-box">'+esc(formNote)+'</textarea>' +
    '</div></div>';

  document.getElementById('fill-items').innerHTML = html;

  rows.forEach(row => {
    const r = resp[row.id];
    if (r && r.result) _highlightMeasRow(row.id, r.result);
  });
}

function _measAutoResult(rowId, min, max) {
  const inp = document.getElementById('mv-'+rowId);
  if (!inp || inp.value === '') return;
  const val = parseFloat(inp.value);
  if (isNaN(val)) return;
  const minV = min != null ? min : -Infinity;
  const maxV = max != null ? max : Infinity;
  const result = (val >= minV && val <= maxV) ? 'ok' : 'nok';
  const radio = document.querySelector('input[name="mr-'+rowId+'"][value="'+result+'"]');
  if (radio) { radio.checked = true; _onMeasResult(rowId); }
}

function _onMeasResult(rowId) {
  const radio = document.querySelector('input[name="mr-'+rowId+'"]:checked');
  const result = radio ? radio.value : null;
  _highlightMeasRow(rowId, result);
  _updProg();
}

function _highlightMeasRow(rowId, result) {
  ['ok','nok'].forEach(v => {
    const lbl = document.querySelector('input[name="mr-'+rowId+'"][value="'+v+'"]')?.closest('label');
    if (!lbl) return;
    if (result === v) {
      lbl.style.background = v==='ok'?'var(--success-bg)':'var(--danger-bg)';
      lbl.style.borderColor = v==='ok'?'var(--success)':'var(--danger)';
      lbl.style.color = v==='ok'?'#065f46':'#991b1b';
    } else {
      lbl.style.background=''; lbl.style.borderColor='var(--border)'; lbl.style.color='';
    }
  });
}

function _pick(itemId, val, lbl) {
  const card = document.getElementById('fi-'+itemId);
  card.className = 'fitem '+val;
  card.querySelectorAll('.ropt').forEach(l=>l.classList.remove('r-ok','r-nok','r-dev'));
  lbl.classList.add('r-'+val);
  const rb = document.getElementById('rb-'+itemId);
  if (rb) rb.style.display = (val==='nok'||val==='dev') ? '' : 'none';
  _updProg();
}

function _collect() {
  if (!_fillD) return {ok:true, all:true};

  if (_fillD.formType === 'measurement') {
    return _collectMeas();
  }

  const items = (_fillD.templateSnapshot||[]).filter(i=>i.type!=='heading');
  let allAns=true, valid=true;
  items.forEach(item => {
    const radio  = document.querySelector('input[name="r-'+item.id+'"]:checked');
    const val    = radio ? radio.value : null;
    const reason = (document.getElementById('rs-'+item.id)||{}).value?.trim()||'';
    const card   = document.getElementById('fi-'+item.id);
    if (!val) { allAns=false; card&&card.classList.add('bad'); }
    else { card&&card.classList.remove('bad'); }
    if ((val==='nok'||val==='dev')&&!reason) valid=false;
    if (val) _fillD.responses[item.id] = {value:val, reason};
  });
  
  const fsRadio = document.querySelector('input[name="final-status"]:checked');
  _fillD.finalStatus = fsRadio ? fsRadio.value : '';
  if (!_fillD.finalStatus) { allAns = false; }
  
  const stdNote = document.getElementById('std-form-note');
  if (stdNote) _fillD.formNote = stdNote.value.trim();
  return {ok:valid, all:allAns};
}

function _collectMeas() {
  const rows = _fillD.measRowsSnapshot || [];
  let allAns = true;
  const toolSN = (document.getElementById('meas-tool-sn')||{}).value?.trim()||'';
  _fillD.toolSN = toolSN;
  
  const noteEl = document.getElementById('meas-form-note');
  if (noteEl) _fillD.formNote = noteEl.value.trim();

  rows.forEach(row => {
    const measInp = document.getElementById('mv-'+row.id);
    const measured = measInp && measInp.value !== '' ? parseFloat(measInp.value) : null;
    const radio  = document.querySelector('input[name="mr-'+row.id+'"]:checked');
    const result = radio ? radio.value : null;

    if (result === null) allAns = false;

    _fillD.measResponses[row.id] = { measured, result };
  });

  if (!toolSN) { allAns = false; }
  return {ok: true, all: allAns};
}

function _updProg() {
  if (!_fillD) return;

  if (_fillD.formType === 'measurement') {
    const rows = _fillD.measRowsSnapshot || [];
    const ans  = rows.filter(row => document.querySelector('input[name="mr-'+row.id+'"]:checked')).length;
    const pct  = rows.length ? Math.round(ans/rows.length*100) : 0;
    document.getElementById('pbar').style.width     = pct+'%';
    document.getElementById('pbar-txt').textContent = ans+' / '+rows.length+' ('+pct+'%)';
    return;
  }

  const items = (_fillD.templateSnapshot||[]).filter(i=>i.type!=='heading');
  const ans   = items.filter(i=>document.querySelector('input[name="r-'+i.id+'"]:checked')).length;
  const pct   = items.length ? Math.round(ans/items.length*100) : 0;
  document.getElementById('pbar').style.width     = pct+'%';
  document.getElementById('pbar-txt').textContent = ans+' / '+items.length+' ('+pct+'%)';
}

function _write(status) {
  if (!_fillD) return;
  _fillD.status=status; _fillD.savedAt=Date.now();
  const idx = D.sessions.findIndex(s=>s.id===_fillD.id);
  if (idx>=0) D.sessions[idx]={..._fillD}; else D.sessions.push({..._fillD});
  dbSave('sessions', _fillD.id, _fillD).catch(e=>toast('Kayıt hatası: '+e.message,'err'));
}

function _startAS() { _stopAS(); _asTimer=setInterval(()=>{_collect();_write('draft');},30000); }
function _stopAS()  { clearInterval(_asTimer); _asTimer=null; }

function saveAsFinal() {
  const {ok, all} = _collect();
  if (_fillD && _fillD.formType === 'measurement') {
    if (!all) { toast('⚠️ Tüm ölçümleri doldurun ve Ölçü Aleti SN girin!','err',3500); return; }
    if (!ok)  { toast('⚠️ Ret olan ölçümler için not girin!','err',3500); return; }
  } else {
    if (!all) { toast('⚠️ Tüm maddeleri cevaplayın ve Kabul Durumu seçin!','err',3500); return; }
    if (!ok)  { toast('⚠️ Uygun Değil / Sapmalı maddeler için sebep girin!','err',3500); return; }
  }
  _write('final'); _stopAS();
  toast('✅ Kaydedildi','ok');
  setTimeout(()=>{ cancelFill(); goto('sessions'); }, 350);
}

function saveAsDraft() {
  _collect(); _write('draft'); _stopAS();
  toast('📋 Taslağa kaydedildi','ok');
  setTimeout(()=>{ cancelFill(); goto('sessions'); }, 350);
}

function saveAndPDF() {
  const {ok, all} = _collect();
  if (_fillD && _fillD.formType === 'measurement') {
    if (!all) { toast('⚠️ Tüm ölçümleri doldurun ve Ölçü Aleti SN girin!','err',3500); return; }
    if (!ok)  { toast('⚠️ Ret olan ölçümler için not girin!','err',3500); return; }
  } else {
    if (!all) { toast('⚠️ Tüm maddeleri cevaplayın ve Kabul Durumu seçin!','err',3500); return; }
    if (!ok)  { toast('⚠️ Uygun Değil / Sapmalı maddeler için sebep girin!','err',3500); return; }
  }
  _write('final'); _stopAS();
  const sid = _fillD.id;
  toast('✅ Kaydedildi, PDF açılıyor...','ok');
  setTimeout(()=>{ cancelFill(); goto('sessions'); downloadPDF(sid); }, 350);
}

function cancelFill() {
  _stopAS(); _fillD=null; _editSid=null;
  _selOps=[]; _redrawChips();
  document.getElementById('fs-select').style.display = '';
  document.getElementById('fs-form').style.display   = 'none';
  document.getElementById('fill-banner').style.display = 'none';
}

function fillFromSession(tmplId, chassis) {
  const t = D.templates.find(x=>x.id===tmplId); if(!t) return;
  goto('fill');
  setTimeout(()=>{
    document.getElementById('f-grp').value = t.groupId||'';
    onFGrpChange();
    setTimeout(()=>{
      document.getElementById('f-tmpl').value = tmplId;
      if(chassis) document.getElementById('f-chassis').value = chassis;
      toast("✏️ Form ve şasi seçildi — bilgileri tamamlayıp Başla'ya basın",'inf',3500);
    },100);
  },100);
}

function editSession(id) {
  const s = D.sessions.find(x=>x.id===id); if(!s) return;
  const t = D.templates.find(x=>x.id===s.templateId);
  if(!t){ toast('⚠️ Form bulunamadı','err'); return; }
  _editSid = id;
  _selOps  = [...(s.operatorIds||(s.operatorId?[s.operatorId]:[]))];
  document.getElementById('f-customer').value  = s.customer||'';
  document.getElementById('f-order').value     = s.order||'';
  document.getElementById('f-location').value  = s.location||'';
  document.getElementById('f-note').value      = s.note||'';
  document.getElementById('f-chassis').value   = s.chassis||'';
  goto('fill');
  setTimeout(()=>{
    document.getElementById('f-grp').value = t.groupId||'';
    onFGrpChange(); _redrawChips();
    setTimeout(()=>{ document.getElementById('f-tmpl').value = s.templateId; toast("✏️ Düzenleme modu — Başla'ya basın",'inf',3500); },100);
  },100);
}
