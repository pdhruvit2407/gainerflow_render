FROM python:3.9-slim

# Prevent Python from writing .pyc files & buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . .

# Run application using Gunicorn WSGI server
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 app:app
