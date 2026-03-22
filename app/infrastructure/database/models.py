from sqlalchemy import Column, String, JSON
from .database import Base

class DBContainer(Base):
    __tablename__ = "containers"

    id = Column(String, primary_key=True, index=True)
    address = Column(String)
    coords = Column(String)
    # Сохраняем все данные датчика в виде JSON-объекта
    sensor_data = Column(JSON, nullable=True)