@echo off
REM rakshex-memory-add.bat — Add memory to existing project
REM Usage: rakshex-memory-add

echo Adding Rakshex memory to %CD%

mkdir .team\inbox 2>nul
mkdir .team\outbox 2>nul
mkdir .team\plans 2>nul
mkdir .team\reviews 2>nul
mkdir .team\memory 2>nul
mkdir .team\errors 2>nul
mkdir .team\queue 2>nul

REM Create session memory
echo # Session %DATE% %TIME% > .team\memory\session_%DATE:~-4%%DATE:~4,2%%DATE:~7,2%.md
echo Project: %CD% >> .team\memory\session_%DATE:~-4%%DATE:~4,2%%DATE:~7,2%.md

echo Memory active. Team structure ready.
