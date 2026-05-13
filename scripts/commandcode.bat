@echo off
REM commandcode.bat — Bridge between DevPulse agent dispatch and the actual Codex CLI.
REM If Codex is installed (commandcode in PATH), uses it directly.
REM Otherwise falls back to invoke-agent.js which uses the DevPulse LLM gateway.
REM
REM Usage: commandcode --agent AGENTNAME --prompt "task" --non-interactive

setlocal

REM Try the real CommandCode CLI first
where commandcode >nul 2>&1
if %errorlevel% equ 0 (
    REM Check if this IS the real Codex (not this bridge)
    for %%I in (commandcode.bat) do set "BRIDGE=%%~fI"
    for %%I in (commandcode.cmd) do set "BRIDGE=%%~fI"
    REM Get the first commandcode in PATH that isn't us
    for /f "delims=" %%A in ('where commandcode 2^>nul') do (
        if /i not "%%~fA"=="%BRIDGE%" (
            commandcode %*
            goto :end
        )
    )
)

REM Fallback: use DevPulse's own invoke-agent.js
set DEV_HOME=C:\Users\aksha\Downloads\DevPulse_Complete_Codebase

if "%1"=="--agent" (
    set AGENT=%2
    set REST=%3 %4 %5 %6 %7 %8 %9
    set TASK=
    for /f "tokens=1* delims=" %%a in ('echo %REST% ^| findstr /r /c:"--prompt"') do (
        for /f "tokens=2*" %%b in ("%REST%") do set TASK=%%c
    )
    REM Extract task from --prompt flag
    set "TASK=%REST:*--prompt =%"
    set "TASK=%TASK:"=%"
    node "%DEV_HOME%\scripts\invoke-agent.js" "%AGENT%" "%TASK%"
    goto :end
)

if "%1"=="/parallel" (
    shift
    node "%DEV_HOME%\scripts\invoke-agent.js" --parallel "%*"
    goto :end
)

REM Default: pass through any other args
node "%DEV_HOME%\scripts\invoke-agent.js" %*
goto :end

:end
endlocal
