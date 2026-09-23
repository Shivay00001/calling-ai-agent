FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
# Voice AI agent backend (FastAPI + Twilio websocket). Needs .env with API keys.
CMD ["uvicorn", "bot:app", "--host", "0.0.0.0", "--port", "8000"]
