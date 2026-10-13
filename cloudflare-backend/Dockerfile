FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
COPY devpulse-backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY devpulse-backend/ .
COPY cloudflare-backend/production_entrypoint.py .
RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser
EXPOSE 8000
CMD ["python", "production_entrypoint.py"]
