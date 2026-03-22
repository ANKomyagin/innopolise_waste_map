import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Получаем URL из переменных окружения Docker
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/waste_db")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
