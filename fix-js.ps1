$dir = "C:\Users\Stajyergrup5\.gemini\antigravity\scratch\kalite-kontrol\js\modules"
$files = Get-ChildItem "$dir\*.js"
foreach ($f in $files) {
    $c = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    
    $c = $c.Replace('\`', '`')
    $c = $c.Replace('\$', '$')
    $c = $c.Replace('\\n', '\n')
    $c = $c.Replace('\''', '''')
    $c = $c.Replace('\"', '"')
    $c = $c.Replace('<\/', '</')
    
    [System.IO.File]::WriteAllText($f.FullName, $c, [System.Text.Encoding]::UTF8)
}
Write-Host "JS files fixed!"
