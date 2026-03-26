const fs = require('fs');

const inPath = 'C:\\Users\\Stajyergrup5\\Downloads\\quality-checklist-analiz (13).html';
const outPath = 'C:\\Users\\Stajyergrup5\\.gemini\\antigravity\\scratch\\kalite-kontrol\\index.html';

let html = fs.readFileSync(inPath, 'utf8');

// Replace the main <style> block
// Find <style>...</style> that contains large CSS
html = html.replace(/<style>[\s\S]*?<\/style>/i, '<link rel="stylesheet" href="css/style.css">');

// We have multiple `<script>` blocks in the original file. 
// Mostly, external scripts like supabase, sweetalert, etc., and at the end there's the giant inline `<script>`.
// Let's find the large inline script and replace it. 
// A simple way is to find `<script>` that does NOT contain `src=` and is HUGE (>1000 lines or characters).
const rx = /<script>([\s\S]*?)<\/script>/gi;
html = html.replace(rx, (match, p1) => {
  if (p1.length > 50000) {
    // This is the huge script. Replace it with our module imports.
    return `
  <!-- Modüler JS Yüklemeleri -->
  <script src="js/config.js"></script>
  <script src="js/utils.js"></script>
  <script src="js/auth.js"></script>
  <script src="js/db.js"></script>
  
  <script src="js/modules/admin.js"></script>
  <script src="js/modules/form-fill.js"></script>
  <script src="js/modules/scanner.js"></script>
  <script src="js/modules/sessions.js"></script>
  <script src="js/modules/analiz.js"></script>
  
  <script src="js/app.js"></script>
`;
  }
  // Otherwise, keep the script
  return match;
});

// Since the huge inline script also had <script src="https://unpkg.com/@supabase/supabase-js@2"></script> etc right above it?
// They will remain intact.

fs.writeFileSync(outPath, html, 'utf8');
console.log('Clean index.html created successfully.');
