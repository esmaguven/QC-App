// ─────────────────────────────────────────────
// SCANNER
// ─────────────────────────────────────────────
let _scanActive = false;

function openScanner() {
  openOv('ov-scan');
  document.getElementById('scan-res').textContent = '';
  document.getElementById('scan-ok').style.display = 'none';
  document.getElementById('scan-err').style.display = 'none';
  _scanActive = true;

  if (typeof Quagga === 'undefined') {
    _scanFallback('Barkod kütüphanesi yüklenemedi.');
    return;
  }

  _startQuagga();
}

function _startQuagga() {
  try { Quagga.stop(); } catch(e) {}
  try { Quagga.offDetected(); } catch(e) {}

  const vp = document.getElementById('scan-vp');
  vp.innerHTML = ''; 

  Quagga.init({
    inputStream: {
      name: 'Live',
      type: 'LiveStream',
      target: vp,
      constraints: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    },
    locator: {
      patchSize: 'medium',
      halfSample: true
    },
    numOfWorkers: 2,
    frequency: 10,
    decoder: {
      readers: [
        'code_128_reader',
        'code_39_reader',
        'code_39_vin_reader',
        'ean_reader',
        'ean_8_reader',
        'upc_reader',
        'upc_e_reader',
        'i2of5_reader'
      ],
      debug: { drawBoundingBox: true, showFrequency: false, drawScanline: true }
    },
    locate: true
  }, function(err) {
    if (!_scanActive) return;
    if (err) {
      console.error('[Scanner] Init hatası:', err);
      _scanFallback(err.message || String(err));
      return;
    }
    Quagga.start();
    console.log('[Scanner] Başlatıldı');

    Quagga.onDetected(function(result) {
      if (!_scanActive) return;
      const code = result.codeResult.code;
      if (!code || code.length < 3) return;

      if (!Quagga._lastCode) {
        Quagga._lastCode = code;
        return;
      }
      if (Quagga._lastCode !== code) {
        Quagga._lastCode = code;
        return;
      }

      console.log('[Scanner] Barkod okundu:', code);
      document.getElementById('scan-res').textContent = code;
      document.getElementById('scan-ok').style.display = '';
      try { Quagga.stop(); } catch(e) {}
      try { Quagga.offDetected(); } catch(e) {}
      _scanActive = false;
    });
  });
}

function _scanFallback(msg) {
  const err = document.getElementById('scan-err');
  err.textContent = '⚠️ ' + msg;
  err.style.display = '';
  console.warn('[Scanner] Fallback:', msg);
}

function closeScanner() {
  _scanActive = false;
  try{ Quagga._lastCode = null; }catch(e){}
  closeOv('ov-scan');
  if (typeof Quagga !== 'undefined') {
    try { Quagga.stop(); } catch(e) {}
    try { Quagga.offDetected(); } catch(e) {}
  }
  document.getElementById('scan-vp').innerHTML = '';
}

function _confirmManual() {
  const val = (document.getElementById('scan-manual').value||'').trim().toUpperCase();
  if (!val) { document.getElementById('scan-manual').focus(); return; }
  document.getElementById('f-chassis').value = val;
  toast('✅ Şasi No girildi: ' + val, 'ok');
  closeScanner();
}

function confirmScan() {
  const code = document.getElementById('scan-res').textContent.trim();
  if (code) {
    document.getElementById('f-chassis').value = code.toUpperCase();
    toast('✅ Barkod okundu: ' + code, 'ok');
  }
  closeScanner();
}

function retryScanner() {
  _scanActive = true;
  Quagga._lastCode = null;
  document.getElementById('scan-res').textContent = '';
  document.getElementById('scan-ok').style.display = 'none';
  document.getElementById('scan-err').style.display = 'none';
  _startQuagga();
}
