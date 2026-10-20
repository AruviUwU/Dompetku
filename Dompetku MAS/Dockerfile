FROM python:3.11-slim

WORKDIR /app

# Copy dan install dependencies terlebih dahulu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy seluruh kode project
COPY . .

# Jalankan bot Discord
CMD ["python", "discord_bot.py"]
