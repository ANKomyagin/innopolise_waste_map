from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class SensorData(BaseModel):
    fill_percent: int
    temperature_status: str
    tilt_status: str
    battery_status: str
    timestamp: datetime

class Container(BaseModel):
    id: str
    address: str
    coords: str
    sensor_data: Optional[SensorData] = None

class RoutePath(BaseModel):
    route_geojson: dict
    distance_km: float
    duration_min: float
    optimized_waypoints_order: List[str]

class WebhookPayload(BaseModel):
    container_id: str
    address: str
    coords: str
    sensor_data: SensorData
