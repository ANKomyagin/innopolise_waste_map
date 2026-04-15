# app/api/routers/frontend.py
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
import os
from app.config.settings import settings

router = APIRouter(tags=["frontend"])

# Setup Jinja2 templates
# Use absolute path from project root
template_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend")
templates = Jinja2Templates(directory=template_dir)


@router.get("/")
async def serve_landing_page(request: Request):
    """Serve landing page with guest access and login"""
    return templates.TemplateResponse(
        request=request,
        name="landing.html"
    )


@router.get("/qr-scan")
async def serve_qr_page(request: Request):
    """Serve mobile QR scanning page"""
    return templates.TemplateResponse(
        request=request,
        name="qr_scan.html"
    )


@router.get("/admin.html")
async def serve_admin_page(request: Request):
    """Serve admin panel page"""
    return templates.TemplateResponse(
        request=request,
        name="admin.html"
    )


@router.get("/truck.html")
async def serve_truck_page(request: Request):
    """Serve truck driver page"""
    return templates.TemplateResponse(
        request=request,
        name="truck.html"
    )


@router.get("/resident.html")
async def serve_resident_page(request: Request):
    """Serve resident page"""
    return templates.TemplateResponse(
        request=request,
        name="resident.html"
    )


