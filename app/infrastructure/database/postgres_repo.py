from typing import List
from sqlalchemy import select
from app.core.interfaces import ContainerRepository
from app.domain.models import Container, SensorData
from .database import SessionLocal
from .models import DBContainer


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
        """Обновление данных с QR-кода с логикой УСРЕДНЕНИЯ (защита от выбросов)"""
        async with SessionLocal() as db:
            result = await db.execute(select(DBContainer).filter(DBContainer.id == container_id))
            container = result.scalar_one_or_none()
            if container:
                # Берем старые данные, если они есть
                old_data = container.sensor_data or {}

                # Достаем историю последних сканирований (сохраняем до 5 последних оценок)
                history = old_data.get("qr_history", [])

                # Добавляем новую оценку
                new_fill = sensor_data["fill_percent"]
                history.append(new_fill)

                # Храним только последние 4 оценки (чтобы старые данные забывались)
                if len(history) > 4:
                    history.pop(0)

                # Считаем среднее арифметическое
                avg_fill = int(sum(history) / len(history))

                # Обновляем словарь
                sensor_data["fill_percent"] = avg_fill
                sensor_data["qr_history"] = history

                container.sensor_data = sensor_data
                await db.commit()
                return True
            return False

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
