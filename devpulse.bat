@echo off
REM Rakshex Universal CLI
set DEV_HOME=C:\Users\aksha\Downloads\Rakshex_Complete_Codebase
set TASK_GEN=%DEV_HOME%\scripts\task_generator.py

if "%1"=="" goto :status
if "%1"=="watch" goto :watch
if "%1"=="discover" goto :discover
if "%1"=="list" goto :list
if "%1"=="scan" goto :scan
if "%1"=="status" goto :status
if "%1"=="help" goto :help
goto :status

:watch
python "%TASK_GEN%" --watch "%2"
goto :end

:discover
python "%TASK_GEN%" --discover
goto :end

:list
python "%TASK_GEN%" --list
goto :end

:scan
if "%2"=="" (python "%TASK_GEN%" --once) else (python "%TASK_GEN%" --path "%2" --once)
goto :end

:status
echo Rakshex — AI Runtime Governance Platform
echo ==========================================
python "%TASK_GEN%" --list 2>nul || echo No projects monitored. Run: rakshex watch ^<path^>
echo.
echo Commands: rakshex [watch^|discover^|list^|scan^|status^|help]
goto :end

:help
echo Rakshex — AI Runtime Governance Platform
echo ==========================================
echo   rakshex watch ^<path^>       Add a project to monitor
echo   rakshex discover             Auto-find all git repos on your machine
echo   rakshex list                 Show all monitored projects
echo   rakshex scan [path]          Discover tasks in all/specific project
echo   rakshex status               Show current status
echo   rakshex help                 Show this help
goto :end

:end
