// ─────────────────────────────────────────────
// INDEXEDDB (offline storage)
// ─────────────────────────────────────────────
let _idb = null;

function openIDB() {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((res, rej) => {
    const req = indexedDB.open('kalite-kontrol', 2);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      TABLES.forEach(t => {
        if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, {keyPath:'id'});
      });
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', {keyPath:'qid', autoIncrement:true});
      }
    };
    req.onsuccess = e => { _idb = e.target.result; res(_idb); };
    req.onerror   = e => rej(e.target.error);
  });
}

async function idbGetAll(table) {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx  = db.transaction(table, 'readonly');
    const req = tx.objectStore(table).getAll();
    req.onsuccess = e => res(e.target.result || []);
    req.onerror   = e => rej(e.target.error);
  });
}

async function idbPut(table, record) {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx  = db.transaction(table, 'readwrite');
    const req = tx.objectStore(table).put(record);
    req.onsuccess = () => res();
    req.onerror   = e => rej(e.target.error);
  });
}

async function idbDelete(table, id) {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx  = db.transaction(table, 'readwrite');
    const req = tx.objectStore(table).delete(id);
    req.onsuccess = () => res();
    req.onerror   = e => rej(e.target.error);
  });
}

async function idbQueueAdd(op) {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx  = db.transaction('sync_queue', 'readwrite');
    const req = tx.objectStore('sync_queue').add(op);
    req.onsuccess = () => res();
    req.onerror   = e => rej(e.target.error);
  });
}

async function idbQueueGetAll() {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx  = db.transaction('sync_queue', 'readonly');
    const req = tx.objectStore('sync_queue').getAll();
    req.onsuccess = e => res(e.target.result || []);
    req.onerror   = e => rej(e.target.error);
  });
}

async function idbQueueDelete(qid) {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx  = db.transaction('sync_queue', 'readwrite');
    const req = tx.objectStore('sync_queue').delete(qid);
    req.onsuccess = () => res();
    req.onerror   = e => rej(e.target.error);
  });
}

// ─────────────────────────────────────────────
// SUPABASE RAW
// ─────────────────────────────────────────────
async function sbReq(method, table, body, qs='') {
  const r = await fetch(`${SB}/rest/v1/${table}${qs}`, {
    method,
    headers: {
      'apikey': SK, 'Authorization': 'Bearer '+SK,
      'Content-Type': 'application/json',
      'Prefer': method==='POST'
        ? 'resolution=merge-duplicates,return=representation'
        : 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) throw new Error(`[${r.status}] ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

// ─────────────────────────────────────────────
// OFFLINE-FIRST DB API
// ─────────────────────────────────────────────

// Yükle: online → Supabase + IDB mirror, offline → IDB
async function dbGetAll(table) {
  const local = await idbGetAll(table);

  if (navigator.onLine) {
    sbReq('GET', table, null, '?select=id,data&order=created_at.asc')
      .then(async rows => {
        const items = (rows||[]).map(r => ({id:r.id, ...r.data}));
        await Promise.all(items.map(item => idbPut(table, item)));
        const remoteIds = new Set(items.map(i=>i.id));
        for (const loc of local) {
          if (!remoteIds.has(loc.id)) await idbDelete(table, loc.id);
        }
        D[table] = items;
        _refreshUI(table);
      })
      .catch(e => console.warn(`[QC] Supabase arka plan sync hatası (${table}):`, e));
  }
  return local;
}

// Tablo güncellenince ilgili UI'ı yenile
function _refreshUI(table) {
  const pg = document.querySelector('.page.on');
  if (!pg) return;
  const id = pg.id;
  // NOTE: renderGroups, renderTemplates vb global scope'ta olmalıdır
  if (table==='groups'    && (id==='pg-groups'||id==='pg-templates'||id==='pg-fill')) { if(typeof renderGroups==='function') renderGroups(); if(typeof renderTemplates==='function') renderTemplates(); if(typeof initFill==='function') initFill(); }
  if (table==='templates' && (id==='pg-templates'||id==='pg-fill'))                   { if(typeof renderTemplates==='function') renderTemplates(); if(id==='pg-fill'&&typeof initFill==='function') initFill(); }
  if (table==='operators' && (id==='pg-operators'||id==='pg-fill'))                   { if(typeof renderOperators==='function') renderOperators(); }
  if (table==='sessions'  && id==='pg-sessions')                                       { if(typeof renderSessions==='function') renderSessions(); }
  if (id==='pg-dash') { if(typeof renderDash==='function') renderDash(); }
}

async function dbSave(table, id, data) {
  const record = {id, ...data};
  await idbPut(table, record);

  if (navigator.onLine) {
    try {
      await sbReq('POST', table, {id, data, updated_at: new Date().toISOString()});
    } catch(e) {
      console.warn(`[QC] Supabase yazma hatası, kuyruğa alındı:`, e);
      await idbQueueAdd({op:'save', table, id, data, ts: Date.now()});
      _showSyncBadge();
    }
  } else {
    await idbQueueAdd({op:'save', table, id, data, ts: Date.now()});
    _showSyncBadge();
  }
}

async function dbDel(table, id) {
  await idbDelete(table, id);

  if (navigator.onLine) {
    try {
      await sbReq('DELETE', table, null, `?id=eq.${encodeURIComponent(id)}`);
    } catch(e) {
      await idbQueueAdd({op:'delete', table, id, ts: Date.now()});
      _showSyncBadge();
    }
  } else {
    await idbQueueAdd({op:'delete', table, id, ts: Date.now()});
    _showSyncBadge();
  }
}

// ─────────────────────────────────────────────
// SYNC ENGINE
// ─────────────────────────────────────────────
let _syncing = false;

async function syncQueue() {
  if (_syncing || !navigator.onLine) return;
  _syncing = true;
  const queue = await idbQueueGetAll();
  if (!queue.length) { _syncing=false; _hideSyncBadge(); return; }

  console.log(`[QC] Sync: ${queue.length} işlem kuyruğu boşaltılıyor...`);
  let failed = 0;

  for (const item of queue) {
    try {
      if (item.op==='save') {
        await sbReq('POST', item.table, {id:item.id, data:item.data, updated_at: new Date().toISOString()});
      } else if (item.op==='delete') {
        await sbReq('DELETE', item.table, null, `?id=eq.${encodeURIComponent(item.id)}`);
      }
      await idbQueueDelete(item.qid);
    } catch(e) {
      console.warn(`[QC] Sync başarısız (qid:${item.qid}):`, e);
      failed++;
    }
  }

  _syncing = false;
  const remaining = await idbQueueGetAll();
  if (remaining.length) {
    _showSyncBadge(remaining.length);
    toast(`⚠️ ${remaining.length} işlem senkronize edilemedi, tekrar denenecek.`, 'err', 4000);
  } else {
    _hideSyncBadge();
    toast('☁️ Tüm veriler senkronize edildi!', 'ok', 3000);
  }
}

function _showSyncBadge(n='') {
  let badge = document.getElementById('sync-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'sync-badge';
    badge.style.cssText = 'background:#d97706;color:#fff;font-size:.68rem;font-weight:700;padding:2px 7px;border-radius:10px;cursor:pointer;white-space:nowrap';
    badge.title = 'Bekleyen kayıtlar — tıkla senkronize et';
    badge.onclick = syncQueue;
    document.getElementById('topbar').appendChild(badge);
  }
  badge.textContent = n ? `⏳ ${n} bekliyor` : '⏳ Senkronize ediliyor...';
  badge.style.display = '';
}

function _hideSyncBadge() {
  const b = document.getElementById('sync-badge'); if(b) b.style.display='none';
}

window.addEventListener('online', async () => {
  if(typeof toast === 'function') toast('🌐 Bağlantı sağlandı! Veriler senkronize ediliyor...', 'inf', 3000);
  await syncQueue();
});
window.addEventListener('offline', () => {
  if(typeof toast === 'function') toast('📵 İnternet bağlantısı kesildi. Veriler cihaza kaydedilmeye devam ediyor.', 'err', 4000);
});
