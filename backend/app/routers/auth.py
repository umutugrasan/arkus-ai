from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from app.db.database import SessionLocal
from app.db.models import User
import hashlib
import secrets
from datetime import datetime

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    store_name: str = ""

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/register")
def register(req: RegisterRequest, db=Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Bu e-posta zaten kayitli")

    new_token = secrets.token_hex(32)
    new_user = User(
        name=req.name,
        email=req.email,
        password=hash_password(req.password),
        store_name=req.store_name,
        token=new_token,
        created_at=datetime.now().strftime("%Y-%m-%d")
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "Kayit basarili",
        "user": {
            "id": new_user.id,
            "name": new_user.name,
            "email": new_user.email,
            "store_name": new_user.store_name,
            "token": new_token,
        },
    }

@router.post("/login")
def login(req: LoginRequest, db=Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    
    if not user or user.password != hash_password(req.password):
        raise HTTPException(status_code=401, detail="E-posta veya sifre hatali")
        
    new_token = secrets.token_hex(32)
    user.token = new_token
    db.commit()

    return {
        "message": "Giris basarili",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "store_name": user.store_name,
            "token": new_token,
        },
    }

@router.get("/me")
def get_me(token: str, db=Depends(get_db)):
    user = db.query(User).filter(User.token == token).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Gecersiz token")
        
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "store_name": user.store_name,
    }