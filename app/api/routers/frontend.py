# app/api/routers/frontend.py
from fastapi import APIRouter
from fastapi.responses import HTMLResponse
import os

router = APIRouter(tags=["frontend"])


@router.get("/")
async def serve_frontend():
    """Serve main frontend page"""
    frontend_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "index.html")
    
    if not os.path.exists(frontend_path):
        return HTMLResponse(content="<h1>Frontend not found</h1>", status_code=404)
    
    with open(frontend_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    return HTMLResponse(content=content)


@router.get("/qr-scan")
async def serve_qr_page():
    """Serve mobile QR scanning page"""
    frontend_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "qr_scan.html")
    
    if not os.path.exists(frontend_path):
        return HTMLResponse(content="<h1>QR Scan page not found</h1>", status_code=404)
    
    with open(frontend_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    return HTMLResponse(content=content)
