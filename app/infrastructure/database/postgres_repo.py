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
        """Обновление данных с QR-кода с логикой УСРЕДНЕНИЯ (защита от выбросов)"""
        with SessionLocal() as db:
            container = db.query(DBContainer).filter(DBContainer.id == container_id).first()
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
                db.commit()
                return True
            return False

    def edit_container(self, old_id: str, new_address: str, new_coords: str):
        """Обновление адреса и координат контейнера"""
        with SessionLocal() as db:
            container = db.query(DBContainer).filter(DBContainer.id == old_id).first()
            if container:
                container.address = new_address
                container.coords = new_coords
                db.commit()
                return True
            return False
