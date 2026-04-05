from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class SensorData(BaseModel):
    fill_percent: int
    temperature_status: str
    tilt_status: str
    battery_status: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class Container(BaseModel):
    id: str
    address: str
    coords: str
    sensor_data: Optional[SensorData] = None
    
    @property
    def lat_lon(self) -> tuple[float, float]:
        """Parse coordinates string and return (lat, lon) tuple"""
        parts = self.coords.split(",")
        return float(parts[0].strip()), float(parts[1].strip())

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
