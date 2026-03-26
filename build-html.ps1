$ErrorActionPreference = "Stop"

$inPath = "C:\Users\Stajyergrup5\Downloads\quality-checklist-analiz (13).html"
$outPath = "C:\Users\Stajyergrup5\.gemini\antigravity\scratch\kalite-kontrol\index.html"

Write-Host "Reading $inPath"
$html = [System.IO.File]::ReadAllText($inPath, [System.Text.Encoding]::UTF8)

# Replace the style body (everything between the first <style> and </style>)
$html = [regex]::Replace($html, '(?is)<style>.*?</style>', '<link rel="stylesheet" href="css/style.css">', 1)

# Search for the gigantic scripts block and replace it
$replacement = @"
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
"@

# The main JS block is over 50000 characters
$html = [regex]::Replace($html, '(?is)<script>(?:(?!\</script\>).){50000,}\</script\>', $replacement)

[System.IO.File]::WriteAllText($outPath, $html, [System.Text.Encoding]::UTF8)
Write-Host "Created index.html"
