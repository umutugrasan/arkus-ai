"""
Dosya yukleme endpoint'i — image analyzer icin URL alternative.
Production'da S3/MinIO presigned URL pattern'i tercih edilir.
"""

import os
import tempfile
import uuid
import base64
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from app.dependencies import get_current_user

router = APIRouter()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(tempfile.gettempdir(), "basiret_uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)
MAX_SIZE_MB = 10
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    """
    Imaj yukle, server'da kaydet, image_analyzer'da kullanilabilecek URL veya
    base64 data URI dondur.
    """
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(
            status_code=400,
            detail=f"Sadece resim formatlari kabul edilir: {ALLOWED_MIME}",
        )

    content = await file.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"Dosya cok buyuk ({size_mb:.1f}MB), max {MAX_SIZE_MB}MB",
        )

    ext = file.content_type.split("/")[-1]
    fname = f"{user.id}_{uuid.uuid4().hex[:12]}.{ext}"
    fpath = os.path.join(UPLOAD_DIR, fname)
    with open(fpath, "wb") as f:
        f.write(content)

    # Image analyzer hem URL hem base64 destekliyor — base64 daha tasinabilir
    b64 = base64.b64encode(content).decode("ascii")
    data_uri = f"data:{file.content_type};base64,{b64}"

    return {
        "filename": fname,
        "size_bytes": len(content),
        "content_type": file.content_type,
        "data_uri": data_uri,  # image-analyzer endpoint'lerine direkt verilebilir
        "uploaded_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
