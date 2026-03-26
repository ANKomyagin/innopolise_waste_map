# app/api/routers/frontend.py
from fastapi import APIRouter, Request, Response
from fastapi.responses import HTMLResponse
from app.config.settings import settings
from app.frontend.template import render_template
import os

router = APIRouter(tags=["frontend"])


@router.get("/")
async def serve_frontend():
    """Serve main frontend page with template variables"""
    template_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "index_clean.html")
    
    if not os.path.exists(template_path):
        # Fallback to static HTML if template not found
        static_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "index.html")
        with open(static_path, "r", encoding="utf-8") as f:
            content = f.read()
        return HTMLResponse(content=content)
    
    content = render_template(template_path)
    return HTMLResponse(content=content)


@router.get("/qr-scan")
async def serve_qr_page():
    """Serve mobile QR scanning page"""
    template_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "qr_scan.html")
    
    if not os.path.exists(template_path):
        return HTMLResponse(content="<h1>QR Scan page not found</h1>", status_code=404)
    
    with open(template_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    return HTMLResponse(content=content)
