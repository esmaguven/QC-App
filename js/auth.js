// ─────────────────────────────────────────────
// AUTH — Kullanıcı Oturumu
// ─────────────────────────────────────────────

// ŞİFRE HASH — PBKDF2 (100.000 tur, salt'lı)
async function _pbkdf2Hash(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return Array.from(new Uint8Array(bits)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// Yeni şifre hashle → "salt:hash" formatında döner
async function _hashNewPassword(password) {
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b=>b.toString(16).padStart(2,'0')).join('');
  const hash = await _pbkdf2Hash(password, salt);
  return salt + ':' + hash;
}

// Giriş sırasında doğrula → "salt:hash" ile karşılaştır
async function _verifyPassword(password, stored) {
  if (!stored.includes(':')) {
    const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
    const hex  = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
    return hex === stored;
  }
  const [salt, hash] = stored.split(':');
  const computed = await _pbkdf2Hash(password, salt);
  return computed === hash;
}

async function doLogin() {
  const sicil = (document.getElementById('li-sicil').value || '').trim().toUpperCase();
  const pass  = (document.getElementById('li-pass').value  || '').trim();
  const btn   = document.getElementById('li-btn');
  if (!sicil || !pass) { showLoginErr('Sicil no ve şifre zorunludur.'); return; }

  btn.disabled = true; btn.textContent = 'Kontrol ediliyor...';
  try {
    const ADMIN_STORED = 'cd28f74f4db1465282d832df1355e5ce:494058d5bf74f51f1053132b5659e22364336350b3b00c239c9cecc0ec7b3446'; // Admin123
    if (sicil === 'ADMIN') {
      const ok = await _verifyPassword(pass, ADMIN_STORED);
      if (!ok) { showLoginErr('Şifre yanlış.'); return; }
      APP_USER = { id: 'admin', sicil: 'ADMIN', name: 'Yönetici', role: 'admin' };
      sessionStorage.setItem('qc_user', JSON.stringify(APP_USER));
      applyAuthUI();
      document.getElementById('login-screen').style.display = 'none';
      loadAll();
      return;
    }

    const qs = `?select=id,data&order=created_at.asc`;
    const r  = await fetch(`${SB}/rest/v1/operators${qs}`, { headers: _authHeader() });
    const rows = await r.json();
    if (!Array.isArray(rows)) { showLoginErr('Sunucu hatası, tekrar deneyin.'); return; }

    const match = rows.find(row => (row.data?.sicil || '').toUpperCase() === sicil);
    if (!match) { showLoginErr('Sicil no bulunamadı.'); return; }

    const opData = match.data || {};
    if (!opData.password_hash) {
      showLoginErr('Bu operatör için şifre tanımlanmamış.\nYöneticiye başvurun.'); return;
    }
    const ok = await _verifyPassword(pass, opData.password_hash);
    if (!ok) { showLoginErr('Şifre yanlış.'); return; }

    APP_USER = {
      id:    match.id,
      sicil: opData.sicil,
      name:  (opData.name || '') + ' ' + (opData.surname || ''),
      role:  'operator'
    };
    sessionStorage.setItem('qc_user', JSON.stringify(APP_USER));
    applyAuthUI();
    document.getElementById('login-screen').style.display = 'none';
    loadAll();

  } catch(e) {
    showLoginErr('Bağlantı hatası: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Giriş Yap';
  }
}

function showLoginErr(msg) {
  const el = document.getElementById('login-err');
  el.textContent = msg; el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
  document.getElementById('li-btn').disabled = false;
  document.getElementById('li-btn').textContent = 'Giriş Yap';
}

function doLogout() {
  APP_USER = null;
  sessionStorage.removeItem('qc_user');
  location.reload();
}

function applyAuthUI() {
  if (!APP_USER) return;
  const isAdmin = APP_USER.role === 'admin';
  const label = APP_USER.name + (isAdmin ? ' 🔑' : ' 👷');
  document.getElementById('topbar-user').textContent = label;

  const adminOnly = ['groups','templates','operators','analiz'];
  document.querySelectorAll('.ntab, #mnav button').forEach(btn => {
    const pg = btn.dataset.pg;
    if (!pg) return;
    if (adminOnly.includes(pg)) {
      btn.style.display = isAdmin ? '' : 'none';
    }
  });
}

function _filterSessionsForUser(sessions) {
  if (!APP_USER || APP_USER.role === 'admin') return sessions;
  return sessions.filter(s => {
    const ops = s.operatorIds || (s.operatorId ? [s.operatorId] : []);
    const myOp = D.operators.find(o => o.sicil === APP_USER.sicil);
    if (!myOp) return false;
    return ops.includes(myOp.id);
  });
}
