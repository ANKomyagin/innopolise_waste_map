from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from app.core.auth import create_access_token
from app.config.settings import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Проверка логина/пароля и выдача токена"""
    
    username = form_data.username
    password = form_data.password
    
    # Проверяем на Админа
    if username == settings.ADMIN_USERNAME and password == settings.ADMIN_PASSWORD:
        role = "admin"
    # Проверяем на Подрядчика
    elif username == settings.CONTRACTOR_USERNAME and password == settings.CONTRACTOR_PASSWORD:
        role = "contractor"
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Генерируем токен, вшивая туда имя и роль
    access_token = create_access_token(data={"sub": username, "role": role})
    
    return {"access_token": access_token, "token_type": "bearer", "role": role}
