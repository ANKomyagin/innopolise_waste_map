from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt

from app.config.settings import settings

# Говорим FastAPI, где находится URL для получения токена (логина)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def create_access_token(data: dict):
    """Создает зашифрованный JWT токен"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Расшифровывает токен и возвращает данные пользователя"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None or role is None:
            raise credentials_exception
        return {"username": username, "role": role}
    except jwt.PyJWTError:
        raise credentials_exception

# --- ЗАЩИТНЫЕ ФИЛЬТРЫ ДЛЯ ЭНДПОИНТОВ ---

async def verify_admin(current_user: dict = Depends(get_current_user)):
    """Пропускает только Мэрию (Админа)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user

async def verify_contractor(current_user: dict = Depends(get_current_user)):
    """Пропускает Подрядчика (водителя) ИЛИ Админа"""
    if current_user["role"] not in ["contractor", "admin"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user
