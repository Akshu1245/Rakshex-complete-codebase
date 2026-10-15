# Removal of `devpulse-backend/services/database_sqlite_backup.py`

- **What:** a 1,473-line legacy copy of the old SQLite-only data layer, last touched in `e2a6d94` (#235).
- **Evidence it was dead:** `grep -rn database_sqlite_backup` across the repo (excluding `node_modules` and `.git`) found **no imports or references** in code, scripts, Dockerfiles, CI or docs. The live data layer is `services/database.py` (SQLAlchemy, PostgreSQL in production and SQLite in tests).
- **Risk it posed:** it held unscoped change-alert functions (`ack_change_alert_db` with no workspace or audit, and `get_change_alerts` with no tenant filter). Anyone importing it by mistake would bypass the new authorisation model.
- **Recovery:** `git show e2a6d94:devpulse-backend/services/database_sqlite_backup.py`
- Full backend test suite passes after removal.
