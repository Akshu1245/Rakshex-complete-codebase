@echo off
REM rakshex-init.bat — Initialize any project with Rakshex memory + team structure
REM Usage: rakshex-init [project-name]
REM Drop this in a folder in your PATH

set PROJECT_DIR=%CD%
echo Initializing Rakshex for: %PROJECT_DIR%

REM Team structure
mkdir .team\inbox 2>nul
mkdir .team\outbox 2>nul
mkdir .team\plans 2>nul
mkdir .team\reviews 2>nul
mkdir .team\memory 2>nul
mkdir .team\errors 2>nul
mkdir .team\queue 2>nul
echo   Team structure created

REM Copy master prompt if it exists globally
if exist "%USERPROFILE%\.commandcode\master_prompt.md" (
    mkdir .commandcode 2>nul
    copy "%USERPROFILE%\.commandcode\master_prompt.md" .commandcode\ 2>nul
    echo   Master prompt copied
)

REM .env from home if not present
if not exist .env (
    if exist "%USERPROFILE%\.env" (
        copy "%USERPROFILE%\.env" .env 2>nul
        echo   .env created
    )
)

echo Rakshex ready in %PROJECT_DIR%
