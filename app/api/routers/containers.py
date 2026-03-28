# app/api/routers/containers.py
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List
from app.api.dependencies import get_db_repo
from app.core.auth import verify_admin_key

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
    _: str = Depends(verify_admin_key)
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
    _: str = Depends(verify_admin_key)
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
    _: str = Depends(verify_admin_key)
):
    """Delete a container (admin only)"""
    success = await db_repo.delete_container(container_id)
    if not success:
        raise HTTPException(status_code=404, detail="Container not found")
    return {"status": "ok"}
