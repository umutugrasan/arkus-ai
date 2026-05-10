FROM python:3.11-slim

WORKDIR /app

# Hafif gerekli paketler
RUN pip install --no-cache-dir fastapi uvicorn pydantic

# mock_raw.json okuyabilmek icin tum backend klasoru gerekir
COPY . /app/backend

WORKDIR /app/backend

EXPOSE 8001

CMD ["uvicorn", "mock_api.main:app", "--host", "0.0.0.0", "--port", "8001"]
