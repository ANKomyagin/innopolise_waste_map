from sqlalchemy import Column, String, JSON, Integer, DateTime, Float
from datetime import datetime
from .database import Base

class DBContainer(Base):
    __tablename__ = "containers"

    id = Column(String, primary_key=True, index=True)
    address = Column(String)
    coords = Column(String)
    # Сохраняем все данные датчика в виде JSON-объекта
    sensor_data = Column(JSON, nullable=True)


class DBScanLog(Base):
    __tablename__ = "scan_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    container_id = Column(String, index=True, nullable=False)
    fill_percent = Column(Integer, nullable=False)
    device_id = Column(String, nullable=True)
    role = Column(String, nullable=True)
    scanned_at = Column(DateTime, default=datetime.utcnow, nullable=False)