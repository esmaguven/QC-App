// ─────────────────────────────────────────────
// SESSIONS (Kayıtlar)
// ─────────────────────────────────────────────

function _renderSessions() {
  const el = document.getElementById('sessions-list');
  const q = document.getElementById('s-search').value.toLowerCase().trim();
  const f = document.getElementById('s-filter-status').value;

  let list = [...D.sessions];
  
  if (q) {
    list = list.filter(s => 
      (s.chassis||'').toLowerCase().includes(q) ||
      (s.customer||'').toLowerCase().includes(q) ||
      (s.templateName||'').toLowerCase().includes(q)
    );
  }
  
  if (f) {
    list = list.filter(s => s.status === f);
  }

  list.sort((a,b) => b.startedAt - a.startedAt);

  if (!list.length) {
    el.innerHTML = '<div class="empty"><div class="empty-ico"><span class="material-symbols-rounded" style="font-size:48px;color:var(--muted)">folder_off</span></div><p>Henüz kayıt yok.</p></div>';
    return;
  }

  el.innerHTML = list.map(s => {
    let stBadge = '';
    if (s.status === 'draft') stBadge = '<span style="background:var(--warning-bg);color:var(--warning);padding:2px 6px;border-radius:6px;font-size:.7rem;font-weight:700;display:flex;align-items:center;gap:2px"><span class="material-symbols-rounded" style="font-size:14px">edit_note</span> Taslak</span>';
    else if (s.finalStatus === 'ok') stBadge = '<span style="background:var(--success-bg);color:var(--success);padding:2px 6px;border-radius:6px;font-size:.7rem;font-weight:700;display:flex;align-items:center;gap:2px"><span class="material-symbols-rounded" style="font-size:14px">check_circle</span> OK</span>';
    else if (s.finalStatus === 'nok') stBadge = '<span style="background:var(--danger-bg);color:var(--danger);padding:2px 6px;border-radius:6px;font-size:.7rem;font-weight:700;display:flex;align-items:center;gap:2px"><span class="material-symbols-rounded" style="font-size:14px">cancel</span> NOK</span>';
    else stBadge = '<span style="background:#e2e8f0;color:var(--muted);padding:2px 6px;border-radius:6px;font-size:.7rem;font-weight:700;display:flex;align-items:center;gap:2px"><span class="material-symbols-rounded" style="font-size:14px">help</span> Belirsiz</span>';

    return `
    <div class="li" style="flex-wrap:wrap">
      <div class="li-i" style="min-width:200px">
        <div class="li-n" style="display:flex;align-items:center;gap:4px">
          <span class="material-symbols-rounded" style="color:var(--primary);font-size:18px">${s.formType==='measurement'?'architecture':'description'}</span> ${esc(s.templateName)} ${stBadge}
        </div>
        <div class="li-m" style="margin-top:4px">
          <div style="font-weight:600;color:var(--text)">Şasi: ${esc(s.chassis)}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:2px;flex-wrap:wrap">
            <span style="display:flex;align-items:center;gap:2px"><span class="material-symbols-rounded" style="font-size:14px;color:var(--muted)">engineering</span> ${esc(s.operator)}</span>
            <span style="display:flex;align-items:center;gap:2px"><span class="material-symbols-rounded" style="font-size:14px;color:var(--muted)">schedule</span> ${fmtDt(s.startedAt)}</span>
          </div>
        </div>
      </div>
      <div class="li-a" style="gap:4px">
        ${s.status==='final' ? `<button class="btn btn-ghost sm" onclick="downloadPDF('${s.id}')" title="PDF İndir"><span class="material-symbols-rounded" style="font-size:20px;color:var(--primary)">picture_as_pdf</span></button>` : ''}
        <button class="btn btn-ghost sm" onclick="fillFromSession('${s.templateId}','${s.chassis}')" title="Yeni form (Aynı şasi)"><span class="material-symbols-rounded" style="font-size:20px">add_box</span></button>
        <button class="btn btn-ghost sm" onclick="editSession('${s.id}')
