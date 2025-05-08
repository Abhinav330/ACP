FROM python:3.11-slim

WORKDIR /app

# Install pandas and other required packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the executor script
COPY pandas_executor.py .

# Create a non-root user and set permissions
RUN useradd -m -u 1000 executor && \
    chown -R executor:executor /app

USER executor

# Run the executor
CMD ["python", "pandas_executor.py"] 