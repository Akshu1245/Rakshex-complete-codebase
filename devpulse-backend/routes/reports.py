"""
Reports Routes - Export reports as JSON or CSV.

Endpoints:
- GET /api/reports/export - Export analytics/health/security data
- GET /api/reports/summary - Quick summary report
"""
import io
import csv
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from services.analytics_engine import get_usage_trends, get_api_breakdown
from services.health_monitor import get_health_data, get_api_details_list
from services.database import get_security_scans, get_incidents_db

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/reports/export")
async def export_report(
    report_type: str = Query("analytics", description="analytics, health, security, incidents"),
    format: str = Query("json", description="json or csv"),
    days: int = Query(30, ge=1, le=365),
) -> Any:
    """Export data as JSON or CSV."""
    try:
        data: Any = {}
        filename = f"devpulse_{report_type}_{datetime.now(timezone.utc).strftime('%Y%m%d')}"

        if report_type == "analytics":
            data = await get_usage_trends(days)
        elif report_type == "health":
            api_list = get_api_details_list()
            data = {"apis": api_list}
        elif report_type == "security":
            scans = await get_security_scans(limit=100)
            data = {"scans": scans}
        elif report_type == "incidents":
            incidents = await get_incidents_db(limit=100)
            data = {"incidents": incidents}
        else:
            return {"status": "error", "error": f"Unknown report type: {report_type}"}

        if format == "csv":
            output = io.StringIO()
            writer = csv.writer(output)

            # Flatten data into rows
            if report_type == "analytics":
                daily = data.get("daily", [])
                if daily:
                    writer.writerow(daily[0].keys() if daily else ["date", "calls"])
                    for row in daily:
                        writer.writerow(row.values())
            elif report_type == "health":
                apis = data.get("apis", [])
                if apis:
                    writer.writerow(apis[0].keys() if apis else ["name", "status"])
                    for row in apis:
                        writer.writerow(row.values())
            elif report_type == "security":
                scans = data.get("scans", [])
                if scans:
                    writer.writerow(["id", "scan_type", "target", "score", "grade", "created_at"])
                    for s in scans:
                        writer.writerow([s.get("id"), s.get("scan_type"), s.get("target"),
                                         s.get("score"), s.get("grade"), s.get("created_at")])
            elif report_type == "incidents":
                incidents = data.get("incidents", [])
                if incidents:
                    writer.writerow(["id", "title", "status", "severity", "created_at"])
                    for inc in incidents:
                        writer.writerow([inc.get("id") or inc.get("incident_id"),
                                         inc.get("title"), inc.get("status"),
                                         inc.get("severity"), inc.get("created_at")])

            output.seek(0)
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename={filename}.csv"},
            )

        # Default: JSON
        return {"status": "success", "report_type": report_type, "data": data,
                "generated_at": datetime.now(timezone.utc).isoformat()}

    except Exception as e:
        logger.error(f"Report export error: {e}")
        return {"status": "error", "error": "Failed to export report"}


@router.get("/api/reports/summary")
async def summary_report() -> Dict[str, Any]:
    """Quick summary report across all domains."""
    try:
        trends = await get_usage_trends(7)
        breakdown = await get_api_breakdown(7)
        health_data = get_health_data()
        api_list = get_api_details_list()
        scans = await get_security_scans(limit=5)
        incidents = await get_incidents_db(limit=5)

        total_apis = len(api_list)
        healthy = sum(1 for a in api_list if a.get("status") == "healthy")

        return {
            "status": "success",
            "summary": {
                "health": {"total_apis": total_apis, "healthy": healthy,
                           "degraded": total_apis - healthy},
                "usage_7d": {"total_calls": trends.get("total_calls", 0),
                             "avg_response_time": trends.get("avg_response_time", 0)},
                "api_breakdown": breakdown.get("breakdown", [])[:5],
                "recent_scans": len(scans),
                "active_incidents": len([i for i in incidents if i.get("status") != "resolved"]),
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
        }
    except Exception as e:
        logger.error(f"Summary report error: {e}")
        return {"status": "error", "error": "Failed to generate summary"}
