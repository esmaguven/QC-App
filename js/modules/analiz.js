// ══════════════════════════════════════════════════════════
// ANALİZ MODÜLü
// ══════════════════════════════════════════════════════════

function _onAnalizFilter() {
  const gId  = document.getElementById('af-group').value;
  const tSel = document.getElementById('af-tmpl');
  const prev = tSel.value;
  const tmpls = gId ? D.templates.filter(t => t.groupId === gId) : D.templates;
  tSel.innerHTML = '<option value="">Tümü</option>' +
    tmpls.map(t => `<option value="${t.id}"${t.id===prev?' selected':''}>${esc(t.name)}</option>`).join('');
  renderAnaliz();
}

function _populateAnalizFilters() {
  const gSel = document.getElementById('af-group');
  const prev = gSel.value;
  gSel.innerHTML = '<option value="">Tümü</option>' +
    D.groups.map(g => `<option value="${g.id}"${g.id===prev?' selected':''}>${esc(g.name)}</option>`).join('');
  _onAnalizFilter();
}

function _getFilteredSessions() {
  const gId    = document.getElementById('af-group').value;
  const tId    = document.getElementById('af-tmpl').value;
  const days   = parseInt(document.getElementById('af-period').value || '0');
  const cutoff = days ? Date.now() - days * 86400000 : 0;

  return D.sessions.filter(s => {
    if (s.status !== 'final') return false;
    if (cutoff && (s.savedAt || s.startedAt || 0) < cutoff) return false;
    if (tId && s.templateId !== tId) return false;
    if (gId) {
      const t = D.templates.find(x => x.id === s.templateId);
      if (!t || t.groupId !== gId) return false;
    }
    return true;
  });
}

function _itemMap(session) {
  const m = {};
  (session.templateSnapshot || []).forEach(i => { m[i.id] = i.text; });
  return m;
}

function initAnalizPage() {
  _populateAnalizFilters();
  renderAnaliz();
}

function renderAnaliz() {
  const sessions = _getFilteredSessions();
  _renderSummary(sessions);
  _renderTopNokDev(sessions);
  _renderTopCombined(sessions);
  _renderByGroup(sessions);
  _renderTrend(sessions);
  renderAnalizTable();
}

function _renderSummary(sessions) {
  let nok=0, dev=0, ok=0, total=0;
  sessions.forEach(s => {
    Object.values(s.responses || {}).forEach(r => {
      total++;
      if (r.value==='nok') nok++;
      else if (r.value==='dev') dev++;
      else if (r.value==='ok') ok++;
    });
  });
  const errRate = total ? Math.round((nok+dev)/total*100) : 0;
  const rateColor = errRate > 20 ? '#dc2626' : errRate > 10 ? '#d97706' : '#059669';
  document.getElementById('az-summary').innerHTML = `
    <div class="az-scard"><div class="az-snum" style="color:var(--navy)">${sessions.length}</div><div class="az-slbl">Final Kayıt</div></div>
    <div class="az-scard"><div class="az-snum" style="color:#dc2626">${nok}</div><div class="az-slbl">Uygun Değil</div></div>
    <div class="az-scard"><div class="az-snum" style="color:#d97706">${dev}</div><div class="az-slbl">Sapmalı</div></div>
    <div class="az-scard"><div class="az-snum" style="color:${rateColor}">${errRate}%</div><div class="az-slbl">Hata Oranı</div></div>`;
}

function _renderTopNokDev(sessions) {
  const nokMap = {}, devMap = {};
  sessions.forEach(s => {
    const imap = _itemMap(s);
    Object.entries(s.responses || {}).forEach(([id, r]) => {
      const name = imap[id] || id;
      if (r.value === 'nok') {
        if (!nokMap[name]) nokMap[name] = { count:0, reasons:[] };
        nokMap[name].count++;
        if (r.reason) nokMap[name].reasons.push(r.reason);
      }
      if (r.value === 'dev') {
        if (!devMap[name]) devMap[name] = { count:0, reasons:[] };
        devMap[name].count++;
        if (r.reason) devMap[name].reasons.push(r.reason);
      }
    });
  });
  _renderBarList('az-top-nok', nokMap, 'nok', 5);
  _renderBarList('az-top-dev', devMap, 'dev', 5);
}

function _renderBarList(elId, dataMap, type, topN) {
  const sorted = Object.entries(dataMap).sort((a,b)=>b[1].count-a[1].count).slice(0,topN);
  const max    = sorted[0]?.[1].count || 1;
  const fillCls = type === 'nok' ? 'az-fill-nok' : 'az-fill-dev';
  const el     = document.getElementById(elId);
  if (!sorted.length) { el.innerHTML = '<div class="az-empty">Bu kategoride hata kaydı yok.</div>'; return; }
  el.innerHTML = sorted.map(([name, data], idx) => {
    const pct    = Math.round(data.count / max * 100);
    const uniq   = [...new Set(data.reasons)].slice(0, 2);
    return `<div class="az-bar-wrap">
      <div class="az-bar-row">
        <span class="az-rank">${idx+1}.</span>
        <span class="az-item-name" title="${esc(name)}">${esc(name)}</span>
        <div class="az-track"><div class="az-fill ${fillCls}" style="width:${pct}%"></div></div>
        <span style="font-size:.76rem;font-weight:800;color:var(--navy);min-width:24px;text-align:right">${data.count}</span>
      </div>
      ${uniq.length ? `<div class="az-reason">${uniq.map(r=>`"${esc(r)}"`).join(' &nbsp;·&nbsp; ')}</div>` : ''}
    </div>`;
  }).join('');
}

function _renderTopCombined(sessions) {
  const map = {};
  sessions.forEach(s => {
    const imap = _itemMap(s);
    Object.entries(s.responses || {}).forEach(([id, r]) => {
      if (r.value !== 'nok' && r.value !== 'dev') return;
      const name = imap[id] || id;
      if (!map[name]) map[name] = { nok:0, dev:0, reasons:[] };
      map[name][r.value]++;
      if (r.reason) map[name].reasons.push(r.reason);
    });
  });
  const sorted = Object.entries(map)
    .map(([n,d]) => ({ name:n, total:d.nok+d.dev, nok:d.nok, dev:d.dev, reasons:d.reasons }))
    .sort((a,b) => b.total - a.total).slice(0, 10);
  const max = sorted[0]?.total || 1;
  const el  = document.getElementById('az-top-combined');
  if (!sorted.length) { el.innerHTML = '<div class="az-empty">Hata kaydı bulunamadı.</div>'; return; }
  el.innerHTML = sorted.map((row, idx) => {
    const pct    = Math.round(row.total / max * 100);
    const uniq   = [...new Set(row.reasons)].slice(0, 3);
    return `<div class="az-bar-wrap" style="padding:6px 0;border-bottom:1px solid var(--border)">
      <div class="az-bar-row">
        <span class="az-rank">${idx+1}.</span>
        <span class="az-item-name" title="${esc(row.name)}">${esc(row.name)}</span>
        <span style="display:flex;gap:5px;flex-shrink:0;margin:0 6px">
          <span class="az-badge-nok">❌ ${row.nok}</span>
          <span class="az-badge-dev">⚠️ ${row.dev}</span>
        </span>
        <div class="az-track"><div class="az-fill az-fill-mix" style="width:${pct}%"></div></div>
        <span style="font-size:.78rem;font-weight:900;color:var(--navy);min-width:28px;text-align:right">${row.total}</span>
      </div>
      ${uniq.length ? `<div class="az-reason">${uniq.map(r=>`"${esc(r)}"`).join(' &nbsp;·&nbsp; ')}</div>` : ''}
    </div>`;
  }).join('');
}

function _renderByGroup(sessions) {
  const map = {};
  sessions.forEach(s => {
    const t  = D.templates.find(x => x.id === s.templateId);
    const g  = t ? (D.groups.find(x => x.id === t.groupId) || { name:'Grupsuz' }) : { name:'Grupsuz' };
    const gn = g.name;
    if (!map[gn]) map[gn] = { sessions:0, ok:0, nok:0, dev:0, total:0 };
    map[gn].sessions++;
    Object.values(s.responses || {}).forEach(r => {
      map[gn].total++;
      if (r.value==='nok') map[gn].nok++;
      else if (r.value==='dev') map[gn].dev++;
      else map[gn].ok++;
    });
  });
  const sorted = Object.entries(map)
    .map(([n,d]) => ({ name:n, ...d, rate: d.total ? Math.round((d.nok+d.dev)/d.total*100) : 0 }))
    .sort((a,b) => b.rate - a.rate);
  const el = document.getElementById('az-by-group');
  if (!sorted.length) { el.innerHTML = '<div class="az-empty">Veri yok.</div>'; return; }
  el.innerHTML = `
    <div style="margin-bottom:8px;font-size:.72rem;color:var(--muted)">Hata oranı = (NOK + Sapmalı) / toplam madde yanıtı</div>
    ${sorted.map(row => {
      const rateColor = row.rate>20?'#dc2626':row.rate>10?'#d97706':'#059669';
      return `<div class="az-op-row">
        <div style="font-weight:700;font-size:.81rem;min-width:140px">📁 ${esc(row.name)}</div>
        <div style="flex:1;min-width:80px">
          <div class="az-track" style="height:7px"><div class="az-fill az-fill-grp" style="width:${row.rate}%"></div></div>
        </div>
        <div style="font-size:.77rem;font-weight:800;min-width:38px;text-align:right;color:${rateColor}">${row.rate}%</div>
        <div style="font-size:.7rem;color:var(--muted);min-width:100px;text-align:right">${row.nok}❌ ${row.dev}⚠️ / ${row.total} madde</div>
        <div style="font-size:.7rem;color:var(--muted);min-width:60px;text-align:right">${row.sessions} kayıt</div>
      </div>`;
    }).join('')}`;
}

function _renderTrend(sessions) {
  if (!sessions.length) { document.getElementById('az-trend').innerHTML = '<div class="az-empty">Veri yok.</div>'; return; }

  const byDay = {};
  sessions.forEach(s => {
    const ts  = s.savedAt || s.startedAt || 0;
    const d   = new Date(ts);
    const key = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!byDay[key]) byDay[key] = { nok:0, dev:0, ok:0, total:0, ts };
    else if (ts < byDay[key].ts) byDay[key].ts = ts;
    Object.values(s.responses || {}).forEach(r => {
      byDay[key].total++;
      if (r.value==='nok') byDay[key].nok++;
      else if (r.value==='dev') byDay[key].dev++;
      else byDay[key].ok++;
    });
  });

  const days = Object.entries(byDay)
    .sort((a,b) => a[1].ts - b[1].ts)
    .slice(-30);

  const maxErr = Math.max(...days.map(([,d]) => d.nok+d.dev), 1);
  const BAR_H  = 72;

  document.getElementById('az-trend').innerHTML =
    `<div class="trend-wrap">` +
    days.map(([day, d]) => {
      const err  = d.nok + d.dev;
      const rate = d.total ? Math.round(err/d.total*100) : 0;
      const h    = Math.max(4, Math.round(err/maxErr * BAR_H));
      const color = rate>20?'#dc2626':rate>10?'#d97706':'#059669';
      return `<div class="trend-col" title="${day} — NOK: ${d.nok}, Sapmalı: ${d.dev}, Uygun: ${d.ok} | Hata oranı: ${rate}%">
        <div class="trend-pct" style="color:${color}">${rate ? rate+'%' : ''}</div>
        <div class="trend-bar" style="height:${h}px;background:${color};width:22px"></div>
        <div class="trend-day">${day}</div>
      </div>`;
    }).join('') +
    `</div>`;
}

function renderAnalizTable() {
  const sessions = _getFilteredSessions();
  const q        = (document.getElementById('az-search')?.value || '').trim().toLowerCase();
  const map      = {};

  sessions.forEach(s => {
    const imap = _itemMap(s);
    Object.entries(s.responses || {}).forEach(([id, r]) => {
      if (r.value !== 'nok' && r.value !== 'dev') return;
      const name = imap[id] || id;
      if (!map[name]) map[name] = { name, nok:0, dev:0, reasons:[], chassis:[] };
      map[name][r.value]++;
      if (r.reason) map[name].reasons.push(r.reason);
      if (s.chassis) map[name].chassis.push(s.chassis);
    });
  });

  let rows = Object.values(map).sort((a,b) => (b.nok+b.dev) - (a.nok+a.dev));

  if (q) {
    rows = rows.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.reasons.some(x => x.toLowerCase().includes(q))
    );
  }

  const el = document.getElementById('az-table');
  if (!rows.length) {
    el.innerHTML = '<div class="az-empty">Uygun Değil veya Sapmalı kayıt bulunamadı.</div>';
    return;
  }

  function topReasons(arr, n) {
    const freq = {};
    arr.forEach(r => { freq[r] = (freq[r]||0)+1; });
    return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,n).map(([r]) => r);
  }

  el.innerHTML = `
    <table class="az-tbl">
      <thead><tr>
        <th style="width:28px">#</th>
        <th style="min-width:200px">Kontrol Maddesi</th>
        <th style="width:72px;text-align:center">❌ NOK</th>
        <th style="width:72px;text-align:center">⚠️ Sapm.</th>
        <th style="width:72px;text-align:center">Toplam</th>
        <th style="min-width:210px">En Sık Açıklamalar</th>
        <th style="min-width:90px">Örnek Şasi</th>
      </tr></thead>
      <tbody>
        ${rows.map((r, idx) => {
          const total  = r.nok + r.dev;
          const tColor = total>5?'#dc2626':total>2?'#d97706':'var(--text)';
          const reasons = topReasons(r.reasons, 4);
          const chassis = [...new Set(r.chassis)].slice(0, 3);
          return `<tr>
            <td class="az-rank">${idx+1}</td>
            <td style="font-weight:600;font-size:.79rem">${esc(r.name)}</td>
            <td style="text-align:center"><span class="az-badge-nok">${r.nok}</span></td>
            <td style="text-align:center"><span class="az-badge-dev">${r.dev}</span></td>
            <td style="text-align:center;font-weight:900;color:${tColor}">${total}</td>
            <td class="az-reason-cell">
              ${reasons.map(x=>`<div>• ${esc(x)}</div>`).join('') || '<span style="color:#ccc">—</span>'}
            </td>
            <td style="font-size:.7rem;color:var(--muted)">${chassis.map(x=>esc(x)).join('<br>') || '—'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}
