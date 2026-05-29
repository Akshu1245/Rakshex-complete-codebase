@echo off
setlocal enabledelayedexpansion
set "MEM_DIR=%USERPROFILE%\.commandcode\codemem\data"
set "PROJECT_DIR=C:\Users\aksha\devpulse-complete-codebase"

if "%1"=="" goto :usage

if "%1"=="--version" (echo codemem-cli v0.1.0 (local wrapper) & goto :eof)

if "%1"=="init" (
    echo {"status":"ok","store":"%MEM_DIR%"} > "%MEM_DIR%\store.json"
    echo {"decisions":[],"index":[],"history":[]} > "%MEM_DIR%\memory.json"
    echo INIT OK: %MEM_DIR%
    goto :eof
)

if "%1"=="index" (
    echo Indexing project...
    dir /s /b "%PROJECT_DIR%" 2>nul > "%MEM_DIR%\file_index.txt"
    powershell -Command "$c=(Get-Content '%MEM_DIR%\file_index.txt').Count; Write-Host 'INDEXED:' $c 'files'"
    goto :eof
)

if "%1"=="search" (
    set "QUERY=%2"
    echo [SEARCHING] !QUERY!
    powershell -Command "$q=$Env:QUERY; $n=5; Get-ChildItem '%PROJECT_DIR%' -Recurse -Include *.ts,*.tsx,*.js,*.json,*.md,*.py 2>$null | Where-Object { $_.FullName -notmatch 'node_modules' } | Select-String -Pattern $q -SimpleMatch 2>$null | Select-Object -First $n | ForEach-Object { Write-Host ('[' + $_.Filename + ':' + $_.LineNumber + '] ' + $_.Line) }"
    goto :eof
)

if "%1"=="add" (
    if "%2"=="decision" (
        powershell -Command "$m=Get-Content '%MEM_DIR%\memory.json' -Raw | ConvertFrom-Json; $d=@{text='%3';tags='%4';ts=(Get-Date -Format o)}; $m.decisions+=@($d); $m | ConvertTo-Json -Depth 5 | Out-File '%MEM_DIR%\memory.json' -Encoding utf8; Write-Host 'ADDED: %3'"
    )
    goto :eof
)

if "%1"=="history" (
    powershell -Command "$m=Get-Content '%MEM_DIR%\memory.json' -Raw | ConvertFrom-Json; $d=$m.decisions; if($d.Count -gt 10){$d=$d[-10..-1]}; $d | ForEach-Object { Write-Host '['$_.ts']' $_.text }"
    goto :eof
)

if "%1"=="stats" (
    powershell -Command "$m=Get-Content '%MEM_DIR%\memory.json' -Raw | ConvertFrom-Json; $fc=0; if(Test-Path '%MEM_DIR%\file_index.txt'){$fc=(Get-Content '%MEM_DIR%\file_index.txt').Count}; Write-Host 'decisions:' $m.decisions.Count '| files:' $fc"
    goto :eof
)

if "%1"=="serve" (echo {"error":"stdio mode unavailable"} & goto :eof)

:usage
echo USAGE: codemem [init index search add history stats]
