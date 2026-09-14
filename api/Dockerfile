# CP Catalog API — UBI9 Python, non-root (OpenShift-friendly)
FROM registry.access.redhat.com/ubi9/python-311:latest
WORKDIR /app
COPY api/requirements.txt /app/requirements.txt
COPY ingestion/requirements.txt /app/ingestion-requirements.txt
ARG PIP_INDEX_URL=""
RUN if [ -n "$PIP_INDEX_URL" ]; then \
      pip install --no-cache-dir --index-url "$PIP_INDEX_URL" -r /app/requirements.txt -r /app/ingestion-requirements.txt; \
    else pip install --no-cache-dir -r /app/requirements.txt -r /app/ingestion-requirements.txt; fi
COPY api/app /app/app
COPY ingestion /app/ingestion
COPY sql /app/sql
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
