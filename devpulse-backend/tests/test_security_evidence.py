"""Synthetic standalone regression suite; pytest runs it in an isolated process."""
if __name__ != "__main__":
    import subprocess
    import sys

    def test_standalone_security_regressions():
        # Keep unittest's event-loop policy and synthetic environment out of the
        # existing pytest session-scoped database/event-loop fixtures.
        result = subprocess.run([sys.executable, "-B", __file__], capture_output=True, text=True, timeout=90)
        assert result.returncode == 0, result.stdout + result.stderr
else:
    """Synthetic-only check: python tests/test_security_evidence.py. No provider or production DB."""
    import json
    import os
    import sys
    import unittest
    from pathlib import Path
    from types import SimpleNamespace
    from unittest.mock import patch, AsyncMock
    
    os.environ.update(DATABASE_URL="sqlite+aiosqlite:///:memory:", REDIS_URL="", ENV="test", GROQ_API_KEY="", XAI_API_KEY="")
    sys.path.insert(0, os.environ.get("RAKSHEX_TEST_SOURCE", str(Path(__file__).resolve().parents[1])))
    from services import ai_security_engine as ai, security_scanner as basic, database as db
    from routes import ai_security, security, reports
    from fastapi import FastAPI
    from httpx import AsyncClient, ASGITransport
    from sqlalchemy import select, text
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from models.tables import Base, User, SecurityScan, AiSecurityScan, CicdRun
    
    CANARY = "sk-proj-" + "SYNTHETIC1234567890" * 3
    CODE = 'openai_api_key = "' + CANARY + '"'
    LEGACY = {"vulnerabilities": [{"rule_id": "A02-001", "line_number": 1, "matched_text": CANARY}], "locations": [{"line": 1, "snippet": CODE}]}
    
    
    class ScannerEvidenceTests(unittest.TestCase):
        def test_both_scanners_preserve_location_without_source(self):
            for result, key in ((basic.scan_code(CODE), "vulnerabilities"), (ai.scan_token_leaks(CODE), "findings")):
                self.assertTrue(result[key], "canary must be detected")
                self.assertTrue(CANARY not in json.dumps(result), "raw synthetic canary reached scanner output")
                for finding in result[key]:
                    self.assertTrue(finding["rule_id"])
                    self.assertEqual(finding.get("line_number", finding.get("line")), 1)
                    self.assertEqual(finding["matched_text"], "[REDACTED]")
    
        def test_full_scan_and_inventory_do_not_echo_source(self):
            for result in (ai.full_security_scan(CODE), ai.scan_api_inventory(CODE)):
                self.assertTrue(CANARY not in json.dumps(result), "source reached full scan or inventory")
    
    
    class BoundaryTests(unittest.IsolatedAsyncioTestCase):
        async def asyncSetUp(self):
            self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
            self.session = async_sessionmaker(self.engine, expire_on_commit=False)
            self.db_patch = patch.object(db, "AsyncSessionLocal", self.session)
            self.db_patch.start()
            async with self.engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)
            async with self.session() as session:
                user = User(email="synthetic@invalid.test", username="synthetic", password_hash="not-a-real-hash")
                session.add(user)
                await session.commit()
                self.user_id = user.id
            self.app = FastAPI()
            for router in (ai_security.router, security.router, reports.router):
                self.app.include_router(router)
            self.app.dependency_overrides[ai_security.require_auth] = lambda: {"id": self.user_id}
    
        async def asyncTearDown(self):
            self.db_patch.stop()
            await self.engine.dispose()
    
        async def test_ai_persistence_redacts_new_writes(self):
            await db.save_ai_security_scan(self.user_id, "full", "submitted source", 50, "D", 1, results_json=LEGACY)
            async with self.session() as session:
                row = (await session.execute(select(AiSecurityScan))).scalar_one()
                self.assertTrue(CANARY not in json.dumps(row.results_json), "new persisted JSON contains canary")
    
        async def test_basic_and_cicd_storage_and_legacy_ci_reads(self):
            await db.save_security_scan(self.user_id, "code", "synthetic", "python", 50, "D", 1, json.dumps(LEGACY))
            await db.save_cicd_run("synthetic", "synthetic", "sample/repo", "main", "fail", 50, 0, False, LEGACY, "test")
            async with self.session() as session:
                scan = (await session.execute(select(SecurityScan))).scalar_one()
                ci = (await session.execute(select(CicdRun))).scalar_one()
                self.assertTrue(CANARY not in json.dumps([scan.results_json, ci.details_json]))
                ci.details_json = LEGACY
                await session.commit()
            history = await db.get_cicd_runs_db()
            self.assertTrue(CANARY not in json.dumps(history), "legacy CI details reached serialized history")
            async with self.session() as session:
                ci = (await session.execute(select(CicdRun))).scalar_one()
                self.assertEqual(ci.details_json, LEGACY)
    
        async def test_sql_error_hides_bound_source(self):
            engine = create_async_engine("sqlite+aiosqlite:///:memory:", hide_parameters=db.engine.sync_engine.hide_parameters)
            try:
                with self.assertRaises(Exception) as failure:
                    async with engine.begin() as connection:
                        await connection.execute(text("select :source from nonexistent_evidence_test"), {"source": CANARY})
                self.assertTrue(CANARY not in str(failure.exception), "SQL exception exposed bound source")
            finally:
                await engine.dispose()
    
        async def test_legacy_history_and_exports_redact_without_overwriting(self):
            async with self.session() as session:
                session.add(SecurityScan(user_id=self.user_id, target="synthetic source", scan_type="code", results_json=LEGACY))
                await session.commit()
            async with AsyncClient(transport=ASGITransport(app=self.app), base_url="http://synthetic") as client:
                for url in ("/api/security/scans", "/api/reports/export?report_type=security&format=json", "/api/reports/export?report_type=security&format=csv"):
                    response = await client.get(url)
                    self.assertEqual(response.status_code, 200)
                    self.assertTrue(CANARY not in response.text, "historical canary reached history/export")
            async with self.session() as session:
                row = (await session.execute(select(SecurityScan))).scalar_one()
                self.assertEqual(row.results_json, LEGACY, "read must not mutate historical evidence")
    
        async def test_cached_full_scan_response_is_redacted(self):
            legacy = ai.full_security_scan(CODE)
            legacy["all_findings"][0]["matched_text"] = CANARY
            with patch.object(ai_security, "cache_get", AsyncMock(return_value=legacy)):
                async with AsyncClient(transport=ASGITransport(app=self.app), base_url="http://synthetic") as client:
                    response = await client.post("/api/v1/security/scan/full", json={"code": CODE})
                    self.assertEqual(response.status_code, 200)
                    self.assertTrue(CANARY not in response.text, "old cache value reached HTTP response")
    
        async def test_failure_log_does_not_echo_sensitive_exception(self):
            with patch.object(ai_security, "save_ai_security_scan", AsyncMock(side_effect=RuntimeError(CANARY))):
                with self.assertLogs("routes.ai_security", level="ERROR") as logs:
                    with self.assertRaises(Exception):
                        await ai_security.full_scan_endpoint(ai_security.ScanRequest(code=CODE), {"id": self.user_id})
                self.assertTrue(CANARY not in "\n".join(logs.output), "exception text reached logs")
    
        async def test_fix_provider_receives_metadata_not_submitted_source(self):
            calls = []
            class FakeClient:
                def __init__(self, **kwargs):
                    pass
                async def __aenter__(self):
                    return self
                async def __aexit__(self, *args):
                    pass
                async def post(self, url, **kwargs):
                    calls.append(kwargs["json"])
                    return SimpleNamespace(status_code=200, json=lambda: {"choices": [{"message": {"content": "[]"}}]})
            finding = {"rule_id": ai.TOKEN_PATTERNS[0]["id"], "severity": "critical", "description": CANARY, "matched_text": CANARY, "line": 1}
            with patch.object(ai, "GROQ_API_KEY", "synthetic-provider-key"), patch("httpx.AsyncClient", FakeClient):
                result = await ai.generate_fix_suggestions([finding], CODE)
            self.assertEqual(len(calls), 1)
            self.assertTrue(CANARY not in json.dumps([calls, result]), "source or caller-provided prose reached provider/output")
    
    
    if __name__ == "__main__":
        unittest.main()
