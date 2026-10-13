from routes.dashboard import router as dashboard_router
from routes.compatibility import router as compatibility_router
from routes.generate import router as generate_router
from routes.docs import router as docs_router

__all__ = [
    "dashboard_router",
    "compatibility_router",
    "generate_router",
    "docs_router",
]
