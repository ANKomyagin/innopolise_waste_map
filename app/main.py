# app/main.py
import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

from app.infrastructure.database.database import engine, Base
from app.api.routers import containers, sensors, logistics, analytics, map, frontend

# Database setup (only create tables if database is available)
try:
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully")
except Exception as e:
    print(f"⚠️ Database connection failed: {e}")
    print("🔄 Continuing without database - some features may not work")

# FastAPI app initialization
app = FastAPI(title="Innopolis Smart Waste API")

# Static files setup
os.makedirs("app/frontend", exist_ok=True)
app.mount("/static", StaticFiles(directory="app/frontend"), name="static")

# Include API routers (they handle their own dependencies)
app.include_router(containers.router)
app.include_router(sensors.router)
app.include_router(logistics.router)
app.include_router(analytics.router)
app.include_router(map.router)
app.include_router(frontend.router)
