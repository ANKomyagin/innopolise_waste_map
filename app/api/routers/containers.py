# app/api/routers/containers.py
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from urllib.parse import unquote
from app.api.dependencies import get_db_repo
from app.core.auth import verify_admin, verify_contractor

router = APIRouter(prefix="/api/containers", tags=["containers"])


class NewContainer(BaseModel):
    id: str
    address: str
    coords: str


class EditContainer(BaseModel):
    new_id: Optional[str] = None
    address: Optional[str] = None
    coords: Optional[str] = None
    fill_percent: Optional[int] = None


class UpdateLocationRequest(BaseModel):
    new_address: str
    new_coords: str


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
    # Validate coordinates format
    coords_str = str(data.coords).strip()
    if ',' not in coords_str:
        raise HTTPException(status_code=400, detail="Coordinates must be in format 'lat, lon'")
    
    try:
        parts = coords_str.split(',')
        if len(parts) != 2:
            raise ValueError()
        float(parts[0].strip())
        float(parts[1].strip())
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid coordinates format. Expected 'lat, lon' with numeric values")
    
    await db_repo.upsert_container(
        container_id=data.id,
        address=data.address,
        coords=coords_str,
        sensor_data=None
    )
    return {"status": "ok", "id": data.id}


@router.put("/{container_id:path}")
async def edit_container(
    container_id: str, 
    data: EditContainer, 
    db_repo = Depends(get_db_repo),
    current_user: dict = Depends(verify_admin)
):
    """Edit container information (admin only)"""
    success = await db_repo.edit_container(
        old_id=container_id,
        new_id=data.new_id,
        new_address=data.address,
        new_coords=data.coords,
        fill_percent=data.fill_percent
    )
    if not success:
        raise HTTPException(status_code=404, detail="Container not found or new ID already exists")
    return {"status": "ok"}


@router.delete("/{container_id:path}")
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


@router.put("/location/{encoded_address}")
async def update_location(
    encoded_address: str,
    data: UpdateLocationRequest,
    db_repo = Depends(get_db_repo),
    current_user: dict = Depends(verify_admin)
):
    """Update address and coordinates for all containers at a location (admin only)"""
    # Validate coordinates format
    coords_str = str(data.new_coords).strip()
    if ',' not in coords_str:
        raise HTTPException(status_code=400, detail="Coordinates must be in format 'lat, lon'")
    
    try:
        parts = coords_str.split(',')
        if len(parts) != 2:
            raise ValueError()
        float(parts[0].strip())
        float(parts[1].strip())
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid coordinates format. Expected 'lat, lon' with numeric values")
    
    old_address = unquote(encoded_address)
    try:
        updated_count = await db_repo.update_location_coords(old_address, data.new_address, coords_str)
        if updated_count == 0:
            raise HTTPException(status_code=404, detail="No containers found at this location")
        return {"status": "ok", "updated": updated_count}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
