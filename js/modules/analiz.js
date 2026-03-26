// ─────────────────────────────────────────────
// ANALİZ
// ─────────────────────────────────────────────

function renderAnaliz() {
  const tId = document.getElementById('an-tmpl').value;
  const sd  = document.getElementById('an-start').value;
  const ed  = document.getElementById('an-end').value;

  let list = D.sessions.filter(s => s.status === 'final');

  if (tId) list = list.filter(s => s.templateId === tId);
  if (sd) { const st=new Date(sd).setHours(0,0,0,0); list = list.filter(s => s.startedAt >= st); }
  if (ed) { const en=new Date(ed).setHours(23,59,59,999); list = list.filter(s => s.startedAt <= en); }

  const resEl = document.getElementById('an-res');

  if (!tId && !sd && !ed) {
    resEl.innerHTML = '<div class="empty"><div class="empty-ico"><span class="material-symbols-rounded" style="font-size:48px;color:var(--muted)">search</span></div><p>Kriterleri seçip "Analiz Et" butonuna basın.</p></div>';
    return;
  }

  if (!list.length) {
    resEl.innerHTML = '<div class="empty"><div class="empty-ico"><span class="material-symbols-rounded" style="font-size:48px;color:var(--muted)">inbox</span></div><p>Bu kriterlere uygun kayıt bulunamadı.</p></div>';
    return;
  }

  const tot = list.length;
  const ok  = list.filter(s => s.finalStatus === 'ok').length;
  const nok = list.filter(s => s.finalStatus === 'nok').length;
  const rate = tot ? Math.round((nok / tot) * 100) : 0;

  let html = `
    <div class="stats-grid" style="margin-bottom:20px;margin-top:20px">
      <div class="stat-card" style="padding:12px 15px">
        <h3 style="display:flex;align-items:center;gap:6px"><span class="material-symbols-rounded" style="color:var(--primary)">bar_chart</span> Toplam Form</h3>
        <div class="val" style="font-size:1.4rem">${tot}</div>
      </div>
      <div class="stat-card" style="padding:12px 15px;border-bottom:3px solid var(--success)">
        <h3 style="display:flex;align-items:center;gap:6px"><span class="material-symbols-rounded" style="color:var(--success)">check_circle</span> OK (Kabul)</h3>
        <div class="val" style="font-size:1.4rem;color:var(--success)">${ok}</div>
      </div>
      <div class="stat-card" style="padding:12px 15px;border-bottom:3px solid var(--danger)">
        <h3 style="display:flex;align-items:center;gap:6px"><span class="material-symbols-rounded" style="color:var(--danger)">cancel</span> NOK (Red)</h3>
        <div class="val" style="font-size:1.4rem;color:var(--danger)">${nok}</div>
      </div>
      <div class="stat-card" style="padding:12px 15px;background:var(--warning-bg)">
        <h3 style="display:flex;align-items:center;gap:6px"><span class="material-symbols-rounded" style="color:var(--warning)">trending_down</span> Hata Oranı</h3>
        <div class="val" style="font-size:1.4rem;color:#92400e">%${rate}</div>
      </div>
    </div>`;

  const reasons = {};
  list.forEach(s => {
    if (s.formType === 'measurement') {
      const rows = s.measRowsSnapshot || [];
      const resp = s.measResponses || {};
      rows.forEach(r => {
        const ans = resp[r.id];
        if (ans && ans.result === 'nok') {
          const key = `[Ölçüm] ${r.seqNo||r.seq}`;
          reasons[key] = (reasons[key] || 0) + 1;
        }
      });
    } else {
      const resp = s.responses || {};
      Object.keys(resp).forEach(k => {
        if (resp[k].value === 'nok' || resp[k].value === 'dev') {
          const txt = resp[k].reason || 'Belirtilmemiş';
          reasons[txt] = (reasons[txt] || 0) + 1;
        }
      });
    }
  });

  const sortedR = Object.entries(reasons).sort((a,b)=>b[1]-a[1]);

  if (sortedR.length) {
    html += '<div class="fill-sec" style="background:var(--surface);border:1px solid var(--border)">' +
      '<div style="font-weight:700;font-size:.9rem;color:var(--navy);margin-bottom:12px;display:flex;align-items:center;gap:6px"><span class="material-symbols-rounded" style="color:var(--warning)">warning</span> En Sık Karşılaşılan Hatalar / Red Sebepleri</div>';
    sortedR.forEach(r => {
      html += '<div style="font-size:.85rem;padding:6px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:6px">' +
        '<span class="material-symbols-rounded" style="font-size:16px;color:var(--danger)">cancel</span> <span style="flex:1">' + esc(r[0]) + '</span> <strong style="color:var(--navy)">' + r[1] + ' kez</strong></div>';
    });
    html += '</div>';
  }

  resEl.innerHTML = html;
}
