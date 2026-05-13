@echo off
REM devpulse-memory-watch.bat — Start/stop the session memory watchdog daemon
REM Auto-saves session state every 30s, survives crashes

cd /d "%~dp0.."

if "%1"=="stop" (
    node scripts\session-watch.js stop
    goto :eof
)

if "%1"=="status" (
    node scripts\session-watch.js status
    goto :eof
)

echo Starting DevPulse Memory Watchdog...
node scripts\session-watch.js start

echo.
echo ┌─────────────────────────────────────────┐
echo │  Memory Watchdog ACTIVE                │
echo │  Auto-saving every 30 seconds          │
echo │                                       │
echo │  Stop:  devpulse-memory-watch stop    │
echo │  Check: devpulse-memory-watch status  │
echo └─────────────────────────────────────────┘
