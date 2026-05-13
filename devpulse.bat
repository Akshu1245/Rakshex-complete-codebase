@echo off
REM DevPulse Universal CLI — Works from any directory, any project.
REM Usage: devpulse [watch|discover|list|status|scan|help|sprint|deploy|audit|...] [path|args]
REM Install: Copy this file to a directory in your PATH, or add this directory to PATH.

set DEV_HOME=C:\Users\aksha\Downloads\DevPulse_Complete_Codebase
set TASK_GEN=%DEV_HOME%\scripts\task_generator.py
set HERMES=%DEV_HOME%\hermes

if "%1"=="" goto :status
if "%1"=="watch" goto :watch
if "%1"=="discover" goto :discover
if "%1"=="list" goto :list
if "%1"=="scan" goto :scan
if "%1"=="status" goto :status
if "%1"=="help" goto :help
if "%1"=="start" goto :start
if "%1"=="register" goto :register
if "%1"=="init" goto :init
if "%1"=="sprint" goto :sprint
if "%1"=="health-check" goto :health
if "%1"=="competitive-brief" goto :competitive
if "%1"=="deploy" goto :deploy
if "%1"=="audit" goto :audit
if "%1"=="review" goto :review
if "%1"=="docs" goto :docs
if "%1"=="onboard" goto :onboard
if "%1"=="research" goto :research
if "%1"=="fix" goto :fix
if "%1"=="meeting" goto :meeting
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
if "%2"=="" (
    python "%TASK_GEN%" --once
) else (
    python "%TASK_GEN%" --path "%2" --once
)
goto :end

:init
python "%DEV_HOME%\scripts\generate_devpulse_md.py" "%2"
goto :end

:sprint
python -c "from hermes.workflow_router import resolve, execute; import asyncio, sys; sys.path.insert(0, r'%DEV_HOME%'); from hermes.agent_loop import HermesAgent; agent = HermesAgent(); plan = resolve('/sprint'); print(asyncio.run(execute(plan, agent))); agent.memory.close()"
goto :end

:health
python -c "from hermes.workflow_router import resolve, execute; import asyncio, sys; sys.path.insert(0, r'%DEV_HOME%'); from hermes.agent_loop import HermesAgent; agent = HermesAgent(); plan = resolve('/health-check'); print(asyncio.run(execute(plan, agent))); agent.memory.close()"
goto :end

:competitive
python -c "from hermes.workflow_router import resolve, execute; import asyncio, sys; sys.path.insert(0, r'%DEV_HOME%'); from hermes.agent_loop import HermesAgent; agent = HermesAgent(); plan = resolve('/competitive-brief'); print(asyncio.run(execute(plan, agent))); agent.memory.close()"
goto :end

:deploy
python -c "from hermes.workflow_router import resolve, execute; import asyncio, sys; sys.path.insert(0, r'%DEV_HOME%'); from hermes.agent_loop import HermesAgent; agent = HermesAgent(); plan = resolve('/deploy'); print(asyncio.run(execute(plan, agent))); agent.memory.close()"
goto :end

:audit
python -c "from hermes.workflow_router import resolve, execute; import asyncio, sys; sys.path.insert(0, r'%DEV_HOME%'); from hermes.agent_loop import HermesAgent; agent = HermesAgent(); plan = resolve('/audit'); print(asyncio.run(execute(plan, agent))); agent.memory.close()"
goto :end

:review
python -c "from hermes.workflow_router import resolve, execute; import asyncio, sys; sys.path.insert(0, r'%DEV_HOME%'); from hermes.agent_loop import HermesAgent; agent = HermesAgent(); plan = resolve('/review'); print(asyncio.run(execute(plan, agent))); agent.memory.close()"
goto :end

:docs
python -c "from hermes.workflow_router import resolve, execute; import asyncio, sys; sys.path.insert(0, r'%DEV_HOME%'); from hermes.agent_loop import HermesAgent; agent = HermesAgent(); plan = resolve('/docs'); print(asyncio.run(execute(plan, agent))); agent.memory.close()"
goto :end

:onboard
python -c "from hermes.workflow_router import resolve, execute; import asyncio, sys; sys.path.insert(0, r'%DEV_HOME%'); from hermes.agent_loop import HermesAgent; agent = HermesAgent(); plan = resolve('/onboard'); print(asyncio.run(execute(plan, agent))); agent.memory.close()"
goto :end

:research
python -c "from hermes.workflow_router import resolve, execute; import asyncio, sys; sys.path.insert(0, r'%DEV_HOME%'); from hermes.agent_loop import HermesAgent; agent = HermesAgent(); plan = resolve('/research %2'); print(asyncio.run(execute(plan, agent))); agent.memory.close()"
goto :end

:fix
python -c "from hermes.workflow_router import resolve, execute; import asyncio, sys; sys.path.insert(0, r'%DEV_HOME%'); from hermes.agent_loop import HermesAgent; agent = HermesAgent(); plan = resolve('/fix'); print(asyncio.run(execute(plan, agent))); agent.memory.close()"
goto :end

:meeting
python -c "from hermes.workflow_router import resolve, execute; import asyncio, sys; sys.path.insert(0, r'%DEV_HOME%'); from hermes.agent_loop import HermesAgent; agent = HermesAgent(); plan = resolve('/meeting'); print(asyncio.run(execute(plan, agent))); agent.memory.close()"
goto :end

:status
echo DevPulse Autonomous Swarm — Status
echo ===================================
python "%TASK_GEN%" --list
echo.
echo Config: %USERPROFILE%\.devpulse\projects.json
echo Agents: %DEV_HOME%\agents\ (28 agents + knowledge graph)
echo Skills: %DEV_HOME%\hermes\skills\ (auto-generated + pipelines)
echo Memory: %DEV_HOME%\hermes\memory\hermes_memory.db
echo.
echo Commands: devpulse [watch^|discover^|list^|scan^|status^|help^|init^|sprint^|deploy^|audit^|health-check^|competitive-brief^|review^|docs^|onboard^|research^|fix^|meeting^|register]
goto :end

:start
pwsh -ExecutionPolicy Bypass -File "%DEV_HOME%\scripts\auto_start.ps1"
goto :end

:register
pwsh -ExecutionPolicy Bypass -File "%DEV_HOME%\scripts\register_swarm_task.ps1"
goto :end

:help
echo DevPulse — Universal AI Engineering Swarm
echo ==========================================
echo.
echo   devpulse watch ^<path^>            Add a project to monitor
echo   devpulse discover                  Auto-find all git repos on your machine
echo   devpulse list                      Show all monitored projects
echo   devpulse scan [path]               Discover tasks in all/specific project
echo   devpulse status                    Show current status
echo   devpulse start                     Launch autonomous swarm
echo   devpulse init [path]              Generate DEVPULSE.md for a project
echo   devpulse help                      Show this help
echo.
echo   Slash Commands (workflow pipelines):
echo   devpulse sprint                   Plan and execute a sprint from backlog
echo   devpulse health-check             Run full system health check
echo   devpulse competitive-brief        Generate competitive intelligence brief
echo   devpulse deploy                   Run full CI/CD deployment (needs handoff)
echo   devpulse audit                    Full security + dependency + perf audit
echo   devpulse review                   Review all open PRs and auto-merge
echo   devpulse docs                     Regenerate all documentation
echo   devpulse onboard                  Onboard a new project
echo   devpulse research ^<query^>        Deep web research on a topic
echo   devpulse fix                      Fix all known bugs
echo   devpulse meeting                  Trigger team sync (28 agents report)
echo.
echo After "devpulse watch", DevPulse AUTOMATICALLY:
echo   - Scans that project every 5 minutes
echo   - Finds TODOs, untested code, outdated deps, security vulns
echo   - Fixes issues, writes tests, updates docs
echo   - Commits and pushes changes
echo   - Learns from results
echo.
echo Zero human input required. Ever.
goto :end

:end
