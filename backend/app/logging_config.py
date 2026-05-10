"""
Yapilandirilmis loglama (JSON formatinda + request_id).
Production'da Sentry/Datadog/CloudWatch'a kolay parse edilir.
"""

import logging
import sys
import json
import time
import uuid
from typing import Callable
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from app.config import settings


class JsonFormatter(logging.Formatter):
    def format(self, record):
        out = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        # Extra alanlar
        for attr in ("request_id", "user_id", "method", "path", "status", "duration_ms"):
            v = getattr(record, attr, None)
            if v is not None:
                out[attr] = v
        if record.exc_info:
            out["exc"] = self.formatException(record.exc_info)
        return json.dumps(out, ensure_ascii=False)


def setup_logging():
    root = logging.getLogger()
    # Var olan handler'lari temizle (uvicorn'unkilerle catismasin)
    for h in list(root.handlers):
        root.removeHandler(h)

    handler = logging.StreamHandler(sys.stdout)
    if settings.LOG_FORMAT == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
        ))
    root.addHandler(handler)
    root.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))

    # Uvicorn loggerleri da bizim formatla yazsin
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        lg.handlers = []
        lg.propagate = True


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Her request'e request_id ekle + access log yaz."""

    async def dispatch(self, request: Request, call_next: Callable):
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
        request.state.request_id = request_id
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = int((time.perf_counter() - start) * 1000)
            logger = logging.getLogger("basiret.access")
            logger.exception(
                "request failed",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": duration_ms,
                },
            )
            raise
        duration_ms = int((time.perf_counter() - start) * 1000)
        response.headers["X-Request-ID"] = request_id

        logger = logging.getLogger("basiret.access")
        logger.info(
            "request",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": duration_ms,
            },
        )
        return response
