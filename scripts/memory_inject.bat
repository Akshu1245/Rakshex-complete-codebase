@echo off
REM Memory injection fallback - searches codemem store
REM Usage: memory_inject.bat "query"

set "MEM_DIR=%USERPROFILE%\.commandcode\codemem\data"

if "%1"=="" (
    echo [] No query provided
    exit /b 0
)

set "QUERY=%1"

REM Search decisions first
echo [MEMORY] Searching for: %QUERY%
powershell -Command "$q=$Env:QUERY; $m=Get-Content '%MEM_DIR%\memory.json' -Raw | ConvertFrom-Json; $m.decisions | Where-Object { $_.text -match $q } | ForEach-Object { Write-Host ('  [' + $_.ts + '] ' + $_.text) }"

REM File search fallback
powershell -Command "$q=$Env:QUERY; Get-ChildItem 'C:\Users\aksha\devpulse-complete-codebase' -Recurse -Include *.ts,*.tsx,*.js -Exclude node_modules,*test* 2>$null | Select-String -Pattern $q -SimpleMatch 2>$null | Select-Object -First 3 | ForEach-Object { Write-Host ('  [' + $_.Filename + ':' + $_.LineNumber + '] ' + $_.Line.Substring(0, [Math]::Min(120, $_.Line.Length))) }"
