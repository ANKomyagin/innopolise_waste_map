# app/api/routers/analytics.py
from fastapi import APIRouter, Depends
from app.api.dependencies import get_db_repo

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/dashboard")
async def get_dashboard(db_repo = Depends(get_db_repo)):
    """Get dashboard statistics for city administration"""
    containers = db_repo.get_all()
    
    # Фильтруем только те, у которых есть данные датчиков
    active_containers = [c for c in containers if c.sensor_data]
    
    if not active_containers:
        return {"message": "Нет данных для аналитики"}
    
    # Сортируем: от самых заполненных к самым пустым
    sorted_by_fill = sorted(active_containers, key=lambda x: x.sensor_data.fill_percent, reverse=True)
    
    top_3_full = [{"id": c.id, "fill": c.sensor_data.fill_percent, "address": c.address} for c in sorted_by_fill[:3]]
    top_3_empty = [{"id": c.id, "fill": c.sensor_data.fill_percent, "address": c.address} for c in
                   reversed(sorted_by_fill[-3:])]
    
    # Считаем контейнеры с проблемами (села батарейка, упали, возгорание)
    alerts = [c.id for c in active_containers if
              c.sensor_data.battery_status != "норм." or c.sensor_data.tilt_status != "норм."]
    
    return {
        "total_containers": len(containers),
        "needs_collection_now": len([c for c in active_containers if c.sensor_data.fill_percent >= 70]),
        "top_fastest_filling": top_3_full,
        "least_used": top_3_empty,
        "hardware_alerts_count": len(alerts),
        "problematic_containers": alerts
    }
