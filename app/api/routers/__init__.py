# app/api/routers/__init__.py
from fastapi import APIRouter
from app.api.routers import containers, sensors, logistics, analytics, map, frontend, telegram
from app.api.integration import digital_twin


def create_api_router():
    """Create and configure the main API router"""
    api_router = APIRouter()
    
    # Include all sub-routers
    api_router.include_router(containers.router)
    api_router.include_router(sensors.router)
    api_router.include_router(logistics.router)
    api_router.include_router(analytics.router)
    api_router.include_router(map.router)
    api_router.include_router(frontend.router)
    api_router.include_router(telegram.router, prefix="/telegram", tags=["telegram"])
    api_router.include_router(digital_twin.router)
    
    return api_router
