# app/api/routers/frontend.py
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
import os
from app.config.settings import settings

router = APIRouter(tags=["frontend"])

# Setup Jinja2 templates
template_dir = os.path.join(os.path.dirname(__file__), "..", "..", "frontend")
templates = Jinja2Templates(directory=template_dir)


@router.get("/")
async def serve_frontend(request: Request):
    """Serve main frontend page"""
    return templates.TemplateResponse("index_template.html", {
        "request": request,
        "YANDEX_API_KEY": settings.YANDEX_API_KEY,
        "DEFAULT_LAT": settings.DEFAULT_LAT,
        "DEFAULT_LON": settings.DEFAULT_LON,
        "DEFAULT_ZOOM": settings.DEFAULT_ZOOM,
        "PUBLIC_SERVER_URL": settings.PUBLIC_SERVER_URL
    })


@router.get("/qr-scan")
async def serve_qr_page(request: Request):
    """Serve mobile QR scanning page"""
    return templates.TemplateResponse("qr_scan.html", {
        "request": request
    })
