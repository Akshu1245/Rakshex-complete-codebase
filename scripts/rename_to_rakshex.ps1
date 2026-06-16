$extensions = @('*.ts','*.tsx','*.json','*.md','*.toml','*.yaml','*.yml','*.sh','*.bat','*.sql')
$excludePatterns = @('node_modules','.git','pnpm-lock.yaml','package-lock.json')

function ShouldSkip($path) {
    foreach ($pat in $excludePatterns) {
        if ($path -like "*$pat*") { return $true }
    }
    return $false
}

$files = Get-ChildItem -Recurse -Include $extensions -ErrorAction SilentlyContinue | Where-Object { -not (ShouldSkip $_.FullName) }

$step1 = 0; $step2 = 0; $step3 = 0; $step4 = 0; $step5 = 0

foreach ($f in $files) {
    $content = Get-Content $f.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    if ($null -eq $content) { continue }
    $original = $content

    # Step 1: lowercase devpulse → rakshex
    $content = $content -creplace 'devpulse', 'rakshex'

    # Step 2: PascalCase DevPulse → Rakshex
    $content = $content -creplace 'DevPulse', 'Rakshex'

    # Step 3: UPPERCASE DEVPULSE → RAKSHEX
    $content = $content -creplace 'DEVPULSE', 'RAKSHEX'

    # Step 4: domain references
    $content = $content -replace 'rakshex\.in\.in', 'rakshex.in'   # prevent double-replace
    $content = $content -replace 'devpulse\.in', 'rakshex.in'
    $content = $content -replace 'devpulse\.com', 'rakshex.com'

    # Step 5: social handles
    $content = $content -replace '@devpulsehq', '@rakshexhq'
    $content = $content -replace 'devpulsehq', 'rakshexhq'

    if ($content -ne $original) {
        [System.IO.File]::WriteAllText($f.FullName, $content, [System.Text.UTF8Encoding]::new($false))
        $step1++
    }
}

Write-Host "Rename complete: $step1 files updated"
