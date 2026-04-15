# app/api/routers/sensors.py
from fastapi import APIRouter, Request, Depends
from pydantic import BaseModel
from datetime import datetime
from fastapi.responses import StreamingResponse
import qrcode
import io
from app.api.dependencies import get_db_repo, get_notifier, get_sensor_pipeline
from app.domain.models import WebhookPayload

router = APIRouter(prefix="/api/sensors", tags=["sensors"])


class QRManualReport(BaseModel):
    container_id: str
    fill_percent: int
    device_id: str
    role: str = "resident"


# Простой словарь для защиты от спама (в проде используют Redis)
anti_spam_cache = {}


@router.post("/webhook")
async def receive_sensor_data(payload: WebhookPayload, sensor_pipeline = Depends(get_sensor_pipeline)):
    """Receive sensor data from IoT devices"""
    await sensor_pipeline.process_new_data(payload)
    return {"status": "ok", "container_id": payload.container_id, "saved_to_db": True}


@router.post("/manual")
async def receive_qr_data(report: QRManualReport, db_repo = Depends(get_db_repo), notifier = Depends(get_notifier)):
    """Receive manual reports from residents/contractors via QR codes"""
    now = datetime.utcnow()
    spam_key = f"{report.device_id}_{report.container_id}"
    
    # 🛡 Антиспам: разрешаем отправлять статус не чаще раза в 5 минут
    if spam_key in anti_spam_cache:
        delta = (now - anti_spam_cache[spam_key]).total_seconds()
        if delta < 300:
            return {"status": "error", "message": "Вы уже отправляли данные недавно. Спасибо!"}
    
    anti_spam_cache[spam_key] = now
    
    # Формируем псевдо-данные "датчика"
    sensor_dict = {
        "fill_percent": report.fill_percent,
        "temperature_status": "норм. (QR)",
        "tilt_status": "норм. (QR)",
        "battery_status": "не применимо",
        "timestamp": now.isoformat()
    }
    
    success = await db_repo.update_sensor_data(report.container_id, sensor_dict)
    
    if success:
        # Логируем сканирование
        await db_repo.add_scan_log(
            container_id=report.container_id,
            fill_percent=report.fill_percent,
            device_id=report.device_id,
            role=report.role
        )
        
        # Если мусорка переполнена - запускаем оповещение подрядчику
        if report.fill_percent >= 70:
            await notifier.send_alert(
                f"📱 [QR-Crowdsourcing] Жители сообщают: Контейнер {report.container_id} переполнен ({report.fill_percent}%)!",
                role="Подрядчик")
        
        return {"status": "ok", "message": "Данные успешно обновлены!"}
    return {"status": "error", "message": "Контейнер не найден"}


@router.get("/logs")
async def get_scan_logs(container_id: str = None, limit: int = 50, db_repo = Depends(get_db_repo)):
    """Get scan logs for analysis"""
    logs = await db_repo.get_scan_logs(container_id=container_id, limit=limit)
    return {"logs": logs, "count": len(logs)}


@router.get("/{container_id:path}/qr")
async def generate_qr(container_id: str, request: Request):
    """Generate QR code for a specific container"""
    base_url = str(request.base_url).rstrip("/")
    target_url = f"{base_url}/qr-scan?id={container_id}"
    
    qr = qrcode.make(target_url)
    buf = io.BytesIO()
    qr.save(buf, format="PNG")
    buf.seek(0)
    
    return StreamingResponse(buf, media_type="image/png")
