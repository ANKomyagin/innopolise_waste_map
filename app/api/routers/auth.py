# app/api/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.security import OAuth2PasswordRequestForm
from app.core.auth import create_access_token, get_current_user
from app.config.settings import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
async def login(response: Response, form_data: OAuth2PasswordRequestForm = Depends()):
    """Проверка логина/пароля, выдача токена в тело и в HttpOnly Cookie"""
    username = form_data.username
    password = form_data.password

    if username == settings.ADMIN_USERNAME and password == settings.ADMIN_PASSWORD:
        role = "admin"
    elif username == settings.CONTRACTOR_USERNAME and password == settings.CONTRACTOR_PASSWORD:
        role = "contractor"
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль"
        )

    access_token = create_access_token(data={"sub": username, "role": role})

    # HttpOnly Cookie для скрытия admin.html от сканеров
    response.set_cookie(
        key="auth_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

    return {"access_token": access_token, "token_type": "bearer", "role": role}


@router.post("/logout")
async def logout(response: Response):
    """Сброс сессии"""
    response.delete_cookie("auth_token")
    return {"status": "ok"}


@router.get("/verify")
async def verify_token(current_user: dict = Depends(get_current_user)):
    """Эндпоинт для серверной проверки прав на клиенте"""
    return {"status": "ok", "user": current_user}