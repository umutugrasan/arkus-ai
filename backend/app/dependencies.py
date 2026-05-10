from fastapi import HTTPException, Query
from app.db.database import SessionLocal
from app.db.models import User

def get_current_user(token: str = Query(None)):
    if not token:
        raise HTTPException(status_code=401, detail="Token bulunamadı")
        
    db = SessionLocal()
    user = db.query(User).filter(User.token == token).first()
    db.close()
    
    if not user:
        raise HTTPException(status_code=401, detail="Geçersiz veya süresi dolmuş token")
        
    return user
