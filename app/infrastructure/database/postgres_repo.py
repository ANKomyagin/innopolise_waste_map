from typing import List
from app.core.interfaces import ContainerRepository
from app.domain.models import Container, SensorData
from .database import SessionLocal
from .models import DBContainer


class PostgresContainerRepo(ContainerRepository):

    def get_all(self) -> List[Container]:
        with SessionLocal() as db:
            db_containers = db.query(DBContainer).all()
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

    def upsert_container(self, container_id: str, address: str, coords: str, sensor_data: dict):
        """
        Upsert: Если контейнера нет - создаем. Если есть - обновляем его данные.
        Это решает кейс 'Учесть что контейнеры могут появляться в новых локациях'
        """
        with SessionLocal() as db:
            container = db.query(DBContainer).filter(DBContainer.id == container_id).first()

            if not container:
                # Контейнер новый! Создаем
                container = DBContainer(id=container_id, address=address, coords=coords)
                db.add(container)
            else:
                # Контейнер существует! Обновляем адрес и координаты на случай перемещения
                container.address = address
                container.coords = coords

            # Обновляем показания датчика
            container.sensor_data = sensor_data

            db.commit()
    def delete_container(self, container_id: str):
        with SessionLocal() as db:
            container = db.query(DBContainer).filter(DBContainer.id == container_id).first()
            if container:
                db.delete(container)
                db.commit()
                return True
            return False

    def update_sensor_data(self, container_id: str, sensor_data: dict):
        """Обновление только данных датчика (для QR-сканирования)"""
        with SessionLocal() as db:
            container = db.query(DBContainer).filter(DBContainer.id == container_id).first()
            if container:
                container.sensor_data = sensor_data
                db.commit()
                return True
            return False
