# app/api/routers/frontend.py
from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["frontend"])


@router.get("/")
async def serve_frontend():
    """Serve main frontend page"""
    with open("app/frontend/index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())


@router.get("/qr-scan")
async def serve_qr_page():
    """Serve mobile QR scanning page"""
    with open("app/frontend/qr_scan.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())
