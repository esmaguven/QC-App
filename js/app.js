// ─────────────────────────────────────────────
// APP STATE & NAV
// ─────────────────────────────────────────────
async function loadAll() {
  document.getElementById('loader').style.display = 'flex';

  const [g, t, o, s] = await Promise.all([
    dbGetAll('groups').catch(e    => { console.error('groups:', e);    return []; }),
    dbGetAll('templates').catch(e => { console.error('templates:', e); return []; }),
    dbGetAll('operators').catch(e => { console.error('operators:', e); return []; }),
    dbGetAll('sessions').catch(e  => { console.error('sessions:', e);  return []; }),
  ]);
  D.groups=g; D.templates=t; D.operators=o; D.sessions=s;
  document.getElementById('loader').style.display = 'none';

  if (!navigator.onLine) {
    toast('📵 Offline mod — yerel veriler yüklendi', 'inf', 3500);
  }

  console.log(`[QC] Yüklendi — groups:${g.length} templates:${t.length} operators:${o.length} sessions:${s.length}`);

  // Başlangıçta bekleyen kuyruk var mı?
  const queue = await idbQueueGetAll();
  if (queue.length && navigator.onLine) {
    toast(`☁️ ${queue.length} bekleyen kayıt senkronize ediliyor...`, 'inf', 3000);
    syncQueue();
  } else if (queue.length) {
    _showSyncBadge(queue.length);
  }

  if (typeof renderDash === 'function') renderDash();
}

function goto(pg) {
  const adminOnly = ['groups','templates','operators','analiz'];
  if (APP_USER && APP_USER.role !== 'admin' && adminOnly.includes(pg)) {
    toast('⛔ Bu sayfaya erişim yetkiniz yok.','err',3000);
    return;
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  document.getElementById('pg-'+pg).classList.add('on');
  document.querySelectorAll('.ntab, #mnav button').forEach(b => b.classList.toggle('on', b.dataset.pg===pg));
  
  if (pg==='dash'      && typeof renderDash === 'function')      renderDash();
  if (pg==='groups'    && typeof renderGroups === 'function')    renderGroups();
  if (pg==='templates' && typeof renderTemplates === 'function') renderTemplates();
  if (pg==='operators' && typeof renderOperators === 'function') renderOperators();
  if (pg==='fill'      && typeof initFill === 'function')        initFill();
  if (pg==='sessions'  && typeof renderSessions === 'function')  renderSessions();
  if (pg==='analiz'    && typeof initAnalizPage === 'function')  initAnalizPage();
}

function toggleMenu() { document.getElementById('mnav').classList.toggle('open'); }
function closeMenu()  { document.getElementById('mnav').classList.remove('open'); }

function openOv(id) {
  const el = document.getElementById(id);
  el.classList.add('open');
  if (!el._ovHandler) {
    el._ovHandler = function(e) {
      if (e.target !== el) return;
      if (id === 'ov-tmpl') {
        toast('💡 Formu kapatmak için İptal butonunu kullanın','inf',2500);
      } else {
        closeOv(id);
      }
    };
    el.addEventListener('click', el._ovHandler);
  }
}
function closeOv(id) { document.getElementById(id).classList.remove('open'); }

// ─────────────────────────────────────────────
// DASHBOARD (APP ENTRY)
// ─────────────────────────────────────────────
function renderDash() {
  const today = new Date(); today.setHours(0,0,0,0);
  const set = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  const mySessions = typeof _filterSessionsForUser === 'function' ? _filterSessionsForUser(D.sessions) : D.sessions;
  
  set('st-all', mySessions.length);
  set('st-fin', mySessions.filter(s=>s.status==='final').length);
  set('st-dft', mySessions.filter(s=>s.status==='draft').length);
  set('st-tdy', mySessions.filter(s=>{
    const d=new Date(s.savedAt||s.startedAt||0); d.setHours(0,0,0,0);
    return d.getTime()===today.getTime();
  }).length);

  const recent = [...mySessions].reverse().slice(0,5);
  const dashRecent = document.getElementById('dash-recent');
  if (dashRecent) {
    dashRecent.innerHTML = recent.length
      ? recent.map(s=>`
          <div style="padding:5px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:8px">
            <div>
              <div style="font-weight:600;font-size:.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px">${esc(s.templateName)}</div>
              <div style="font-size:.7rem;color:var(--muted)">${esc(s.chassis||'—')} · ${fmtDt(s.savedAt||s.startedAt)}</div>
            </div>
            <span class="badge ${s.status==='final'?'b-final':'b-draft'}">${s.status==='final'?'Kayıtlı':'Taslak'}</span>
          </div>`).join('')
      : '<div style="color:var(--muted);font-size:.8rem">Henüz kayıt yok.</div>';
  }
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Daha önce giriş yapıldıysa sessionStorage'dan al
  const savedUser = sessionStorage.getItem('qc_user');
  if (savedUser) {
    try {
      APP_USER = JSON.parse(savedUser);
      applyAuthUI();
      document.getElementById('login-screen').style.display = 'none';
    } catch(e) {
      sessionStorage.removeItem('qc_user');
    }
  }

  // Enter ile login
  ['li-sicil','li-pass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key==='Enter') doLogin(); });
  });

  // Overlay → close on background click
  document.querySelectorAll('.ov').forEach(ov=>{
    ov.addEventListener('click', e=>{ if(e.target===ov) ov.classList.remove('open'); });
  });

  // Operator dropdown → close on outside click
  document.addEventListener('click', e=>{
    const wrap  = document.getElementById('op-dd-wrap');
    const chips = document.getElementById('chip-wrap');
    const dd    = document.getElementById('op-dd');
    if (!wrap||!dd) return;
    if (!wrap.contains(e.target) && !chips.contains(e.target)) {
      dd.style.display = 'none';
    }
  });

  // Mobile nav → close on outside click
  document.addEventListener('click', e=>{
    const nav = document.getElementById('mnav');
    const btn = document.getElementById('hmbg-btn');
    if (nav&&nav.classList.contains('open')&&!nav.contains(e.target)&&!btn.contains(e.target)) {
      closeMenu();
    }
  });

  // Enter keys on modals
  const enter = (id, fn) => {
    const el=document.getElementById(id);
    if(el) el.addEventListener('keydown',e=>{ if(e.key==='Enter') fn(); });
  };
  enter('gm-name', saveGroup);
  enter('om-sicil', ()=>document.getElementById('om-name').focus());
  enter('om-name',  ()=>document.getElementById('om-surname').focus());
  enter('om-surname', saveOperator);
  if (typeof _confirmManual === 'function') enter('scan-manual', _confirmManual);

  // Service Worker kaydı (PWA offline desteği)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('[QC] Service Worker kayıtlı:', reg.scope);
    }).catch(e => console.warn('[QC] SW kayıt hatası:', e));

    // SW'den gelen sync mesajını dinle
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data && e.data.type === 'SYNC_QUEUE') syncQueue();
    });
  }

  // Sadece giriş yapıldıysa yükle
  if (APP_USER) loadAll();
});
