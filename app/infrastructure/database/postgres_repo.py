from typing import List
from datetime import datetime
from sqlalchemy import select, desc
from app.core.interfaces import ContainerRepository
from app.domain.models import Container, SensorData
from .database import SessionLocal
from .models import DBContainer, DBScanLog


class PostgresContainerRepo(ContainerRepository):

    async def get_all(self) -> List[Container]:
        async with SessionLocal() as db:
            result_set = await db.execute(select(DBContainer))
            db_containers = result_set.scalars().all()
            result = []
            for db_c in db_containers:
                # Преобразуем данные из БД в наши чистые Pydantic модели
                sensor = SensorData(**db_c.sensor_data) if db_c.sensor_data else None
                result.append(
                    Container(
                        id=db_c.id,
                        address=db_c.address,
                        coords=db_c.coords,
                        sensor_data=sensor
                    )
                )
            return result

    async def upsert_container(self, container_id: str, address: str, coords: str, sensor_data: dict):
        """
        Upsert: Если контейнера нет - создаем. Если есть - обновляем его данные.
        Это решает кейс 'Учесть что контейнеры могут появляться в новых локациях'
        """
        async with SessionLocal() as db:
            result = await db.execute(select(DBContainer).filter(DBContainer.id == container_id))
            container = result.scalar_one_or_none()

            if not container:
                # Контейнер новый! Создаем
                container = DBContainer(id=container_id, address=address, coords=coords)
                db.add(container)
            else:
                # Контейнер существует! Обновляем адрес и координаты на случай перемещения
                container.address = address
                container.coords = coords

            # Обновляем показания датчика (только если переданы)
            if sensor_data is not None:
                container.sensor_data = sensor_data

            await db.commit()
            
    async def delete_container(self, container_id: str):
        async with SessionLocal() as db:
            result = await db.execute(select(DBContainer).filter(DBContainer.id == container_id))
            container = result.scalar_one_or_none()
            if container:
                await db.delete(container)
                await db.commit()
                return True
            return False

    async def update_sensor_data(self, container_id: str, sensor_data: dict):
        """Обновление данных с QR-кода с логикой УСРЕДНЕНИЯ последних 3 сканирований"""
        async with SessionLocal() as db:
            result = await db.execute(select(DBContainer).filter(DBContainer.id == container_id))
            container = result.scalar_one_or_none()
            if container:
                old_data = container.sensor_data or {}

                # Достаем историю последних сканирований
                history = old_data.get("qr_history", [])

                # Добавляем новую оценку
                new_fill = sensor_data["fill_percent"]
                history.append(new_fill)

                # Храним только последние 3 оценки
                if len(history) > 3:
                    history = history[-3:]

                # Считаем среднее арифметическое последних 3
                avg_fill = int(sum(history) / len(history))

                # Обновляем словарь
                sensor_data["fill_percent"] = avg_fill
                sensor_data["qr_history"] = history

                container.sensor_data = sensor_data
                await db.commit()
                return True
            return False

    async def add_scan_log(self, container_id: str, fill_percent: int, device_id: str = None, role: str = None):
        """Добавить запись о сканировании в лог"""
        async with SessionLocal() as db:
            log = DBScanLog(
                container_id=container_id,
                fill_percent=fill_percent,
                device_id=device_id,
                role=role,
                scanned_at=datetime.utcnow()
            )
            db.add(log)
            await db.commit()

    async def get_scan_logs(self, container_id: str = None, limit: int = 50):
        """Получить логи сканирований"""
        async with SessionLocal() as db:
            query = select(DBScanLog).order_by(desc(DBScanLog.scanned_at)).limit(limit)
            if container_id:
                query = query.filter(DBScanLog.container_id == container_id)
            result = await db.execute(query)
            logs = result.scalars().all()
            return [{
                "id": log.id,
                "container_id": log.container_id,
                "fill_percent": log.fill_percent,
                "device_id": log.device_id,
                "role": log.role,
                "scanned_at": log.scanned_at.isoformat() if log.scanned_at else None
            } for log in logs]

    async def edit_container(self, old_id: str, new_address: str, new_coords: str):
        """Обновление адреса и координат контейнера"""
        async with SessionLocal() as db:
            result = await db.execute(select(DBContainer).filter(DBContainer.id == old_id))
            container = result.scalar_one_or_none()
            if container:
                container.address = new_address
                container.coords = new_coords
                await db.commit()
                return True
            return False
