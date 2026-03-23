FROM node:18-bullseye

# Install LuaJIT and Git
RUN apt-get update && apt-get install -y luajit git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Clone Prometheus
RUN git -c http.sslVerify=false clone https://github.com/prometheus-lua/Prometheus

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Set environment variables
ENV PROMETHEUS_DIR=/app/Prometheus
ENV PORT=8080
ENV LUA_CMD="luajit"

EXPOSE 8080

CMD ["node", "server.js"]
