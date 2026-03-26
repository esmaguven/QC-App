// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function esc(s) {
  return String(s||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDt(ts) {
  if (!ts) return '—';
  const d = new Date(typeof ts==='number' ? ts : ts);
  if (isNaN(d)) return '—';
  return d.toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

let _tt;
function toast(msg, type='', dur=2800) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' '+type : '');
  clearTimeout(_tt);
  _tt = setTimeout(() => el.classList.remove('show'), dur);
}
