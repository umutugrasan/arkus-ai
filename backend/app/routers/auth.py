from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
import os
import hashlib
import secrets

router = APIRouter()

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "users.json")


def load_users():
    if not os.path.exists(DB_PATH):
        return []
    with open(DB_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_users(users):
    with open(DB_PATH, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)


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
def register(req: RegisterRequest):
    users = load_users()

    for user in users:
        if user["email"] == req.email:
            raise HTTPException(status_code=400, detail="Bu e-posta zaten kayitli")

    new_user = {
        "id": f"U{len(users) + 1:03d}",
        "name": req.name,
        "email": req.email,
        "password": hash_password(req.password),
        "store_name": req.store_name,
        "token": secrets.token_hex(32),
        "created_at": "2026-05-10",
    }

    users.append(new_user)
    save_users(users)

    return {
        "message": "Kayit basarili",
        "user": {
            "id": new_user["id"],
            "name": new_user["name"],
            "email": new_user["email"],
            "store_name": new_user["store_name"],
            "token": new_user["token"],
        },
    }


@router.post("/login")
def login(req: LoginRequest):
    users = load_users()

    for user in users:
        if user["email"] == req.email and user["password"] == hash_password(req.password):
            new_token = secrets.token_hex(32)
            user["token"] = new_token
            save_users(users)

            return {
                "message": "Giris basarili",
                "user": {
                    "id": user["id"],
                    "name": user["name"],
                    "email": user["email"],
                    "store_name": user["store_name"],
                    "token": new_token,
                },
            }

    raise HTTPException(status_code=401, detail="E-posta veya sifre hatali")


@router.get("/me")
def get_me(token: str):
    users = load_users()

    for user in users:
        if user["token"] == token:
            return {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "store_name": user["store_name"],
            }

    raise HTTPException(status_code=401, detail="Gecersiz token")