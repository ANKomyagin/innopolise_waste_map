@app.get("/api/integration/digital-twin", tags=["Digital Twin"])
async def export_for_digital_twin():
    """
    Отдает полные слепки данных всех датчиков для загрузки в 3D Цифровой Двойник Иннополиса.
    """
    containers = db_repo.get_all()
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "total_active_sensors": len([c for c in containers if c.sensor_data]),
        "assets": [
            {
                "asset_id": c.id,
                "type": "smart_waste_bin",
                "location": {"lat": float(c.coords.split(',')[0]), "lon": float(c.coords.split(',')[1])},
                "telemetry": c.sensor_data.dict() if c.sensor_data else None
            } for c in containers
        ]
    }
