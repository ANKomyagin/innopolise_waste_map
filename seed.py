import asyncio
from sqlalchemy import select
from app.infrastructure.database.database import SessionLocal
from app.infrastructure.database.models import DBContainer


async def seed_containers():
    """Seed database with test containers in Innopolis"""
    containers = [
        {
            "id": "BIN-001",
            "address": "Университетская, 1",
            "coords": "55.753, 48.743",
            "sensor_data": {
                "fill_percent": 80,
                "temperature_status": "норм.",
                "tilt_status": "норм.",
                "battery_status": "норм."
            }
        },
        {
            "id": "BIN-002",
            "address": "Спортивная, 10",
            "coords": "55.755, 48.740",
            "sensor_data": {
                "fill_percent": 30,
                "temperature_status": "норм.",
                "tilt_status": "норм.",
                "battery_status": "норм."
            }
        },
        {
            "id": "BIN-003",
            "address": "Квантовый бульвар, 2",
            "coords": "55.751, 48.747",
            "sensor_data": {
                "fill_percent": 60,
                "temperature_status": "норм.",
                "tilt_status": "норм.",
                "battery_status": "норм."
            }
        }
    ]
    
    async with SessionLocal() as db:
        for container_data in containers:
            # Check if container already exists
            result = await db.execute(
                select(DBContainer).filter(DBContainer.id == container_data["id"])
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                print(f"Container {container_data['id']} already exists, skipping...")
                continue
            
            # Create new container
            container = DBContainer(
                id=container_data["id"],
                address=container_data["address"],
                coords=container_data["coords"],
                sensor_data=container_data["sensor_data"]
            )
            db.add(container)
            print(f"Added container {container_data['id']}: {container_data['address']}")
        
        await db.commit()
        print("Database seeding completed!")


if __name__ == "__main__":
    asyncio.run(seed_containers())
