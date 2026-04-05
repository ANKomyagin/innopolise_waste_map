# app/api/routers/containers.py
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List
from datetime import datetime
from app.api.dependencies import get_db_repo
from app.core.auth import verify_admin, verify_contractor

router = APIRouter(prefix="/api/containers", tags=["containers"])


class NewContainer(BaseModel):
    id: str
    address: str
    coords: str


class EditContainer(BaseModel):
    address: str
    coords: str


class ContainerResponse(BaseModel):
    id: str
    lat: float
    lon: float
    fill_percent: int


@router.get("/", response_model=List[ContainerResponse])
async def get_containers(db_repo = Depends(get_db_repo)):
    """Get all containers with their current fill status"""
    containers = await db_repo.get_all()
    
    result = []
    for c in containers:
        lat, lon = c.lat_lon
        result.append({
            "id": c.id,
            "lat": lat,
            "lon": lon,
            "fill_percent": c.sensor_data.fill_percent if c.sensor_data else 0
        })
    
    return result


@router.post("/")
async def create_container(
    data: NewContainer, 
    db_repo = Depends(get_db_repo),
    current_user: dict = Depends(verify_admin)
):
    """Create a new container (admin only)"""
    await db_repo.upsert_container(
        container_id=data.id,
        address=data.address,
        coords=data.coords,
        sensor_data=None
    )
    return {"status": "ok", "id": data.id}


@router.put("/{container_id}")
async def edit_container(
    container_id: str, 
    data: EditContainer, 
    db_repo = Depends(get_db_repo),
    current_user: dict = Depends(verify_admin)
):
    """Edit container information (admin only)"""
    success = await db_repo.edit_container(container_id, data.address, data.coords)
    if not success:
        raise HTTPException(status_code=404, detail="Container not found")
    return {"status": "ok"}


@router.delete("/{container_id}")
async def delete_container(
    container_id: str, 
    db_repo = Depends(get_db_repo),
    current_user: dict = Depends(verify_admin)
):
    """Delete a container (admin only)"""
    success = await db_repo.delete_container(container_id)
    if not success:
        raise HTTPException(status_code=404, detail="Container not found")
    return {"status": "ok"}


class EmptyContainersRequest(BaseModel):
    container_ids: List[str]


@router.post("/empty")
async def empty_containers(
    request: EmptyContainersRequest,
    db_repo = Depends(get_db_repo),
    current_user: dict = Depends(verify_contractor)
):
    """Mark selected containers as empty (contractor/driver only)"""
    for cid in request.container_ids:
        sensor_dict = {
            "fill_percent": 0,
            "temperature_status": "норм. (Сброс водителем)",
            "tilt_status": "норм.",
            "battery_status": "норм.",
            "timestamp": datetime.utcnow().isoformat()
        }
        await db_repo.update_sensor_data(cid, sensor_dict)
    return {"status": "ok", "emptied": len(request.container_ids)}
