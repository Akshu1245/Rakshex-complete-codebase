# DevPulse Backend

Production-grade FastAPI backend for API health monitoring, compatibility analysis, and AI-powered code generation.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/devpulse-backend.git
cd devpulse-backend

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your GROQ_API_KEY

# Run the server
python main.py
```

Server starts at `http://localhost:8000`

## Tech Stack

- **Framework**: FastAPI 0.111.0
- **Server**: Uvicorn 0.30.1 (ASGI)
- **HTTP Client**: httpx 0.27.0 (async)
- **Validation**: Pydantic 2.7.1
- **AI**: Groq API (Mixtral-8x7b-32768)
- **Python**: 3.11+

## API Endpoints

### Health Check

```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-28T12:00:00.000000+00:00"
}
```

---

### Dashboard

```
GET /api/dashboard
```

Returns health status of all 15 monitored APIs with summary.

**Response:**
```json
{
  "apis": {
    "OpenWeatherMap": {
      "name": "OpenWeatherMap",
      "status": "healthy",
      "latency_ms": 245.32,
      "status_code": 200,
      "is_rate_limited": false,
      "is_timeout": false,
      "error": null,
      "last_checked": "2026-02-28T12:00:00.000000+00:00"
    }
  },
  "summary": {
    "total": 15,
    "healthy": 12,
    "degraded": 2,
    "down": 1,
    "last_run": "2026-02-28T12:00:00.000000+00:00"
  },
  "status": "success"
}
```

---

### API Details

```
GET /api/api-details
```

Returns detailed information for all monitored APIs.

**Response:**
```json
{
  "apis": [
    {
      "name": "OpenWeatherMap",
      "category": "weather",
      "status": "healthy",
      "latency_ms": 245,
      "status_code": 200,
      "is_rate_limited": false,
      "is_timeout": false,
      "error": null,
      "last_checked": "2026-02-28T12:00:00.000000+00:00"
    }
  ],
  "count": 15,
  "status": "success"
}
```

---

### API Compatibility

```
POST /api/compatibility
```

Check compatibility between two APIs using Dijkstra's shortest path algorithm.

**Request:**
```json
{
  "api1": "OpenWeatherMap",
  "api2": "Google Maps"
}
```

**Response:**
```json
{
  "score": 30,
  "path": ["OpenWeatherMap", "Google Maps"],
  "hops": 1,
  "reason": "Shared inputs (2): lat, lon",
  "edge_scores": [
    {"from": "OpenWeatherMap", "to": "Google Maps", "score": 30}
  ],
  "status": "success"
}
```

---

### Code Generation

```
POST /api/generate
```

Generate production-ready Python integration code using Groq AI.

**Request:**
```json
{
  "use_case": "Fetch weather data and display on a map"
}
```

**Response:**
```json
{
  "code": "import asyncio\nimport httpx\n\nasync def fetch_weather():\n    ...",
  "apis_used": ["OpenWeatherMap", "Google Maps"],
  "tokens_used": 847,
  "status": "success"
}
```

**Fallback Response (when AI unavailable):**
```json
{
  "code": "",
  "apis_used": ["OpenWeatherMap"],
  "tokens_used": 0,
  "status": "fallback",
  "message": "AI engine timeout. Try again."
}
```

---

### Documentation Search

```
POST /api/docs
```

Search documentation across Wikipedia, DuckDuckGo, and Semantic Scholar with AI summarization.

**Request:**
```json
{
  "question": "How does OAuth 2.0 work?"
}
```

**Response:**
```json
{
  "summary": "OAuth 2.0 is an authorization framework that enables applications to obtain limited access to user accounts...",
  "sources": ["Wikipedia", "DuckDuckGo"],
  "source_count": 2,
  "status": "success"
}
```

---

### List Available APIs

```
GET /api/compatibility/apis
```

**Response:**
```json
{
  "apis": [
    "CoinGecko", "Discord", "GitHub", "Google Maps", "NASA",
    "NewsAPI", "OpenAI", "OpenWeatherMap", "Reddit", "SendGrid",
    "Slack", "Spotify", "Stripe", "Twilio", "Twitter"
  ],
  "count": 15,
  "status": "success"
}
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GROQ_API_KEY` | Yes | - | Groq API key for AI features |
| `PORT` | No | 8000 | Server port |
| `HOST` | No | 0.0.0.0 | Server host |
| `ENV` | No | development | Environment mode |
| `LOG_LEVEL` | No | info | Logging level |

## Docker

```bash
# Build
docker build -t devpulse-backend .

# Run
docker run -p 8000:8000 -e GROQ_API_KEY=your_key devpulse-backend
```

## Project Structure

```
devpulse-backend/
├── main.py                 # FastAPI app entry point
├── requirements.txt        # Python dependencies
├── .env.example           # Environment template
├── Dockerfile             # Container configuration
├── routes/
│   ├── dashboard.py       # Health monitoring endpoints
│   ├── compatibility.py   # API compatibility endpoints
│   ├── generate.py        # Code generation endpoint
│   └── docs.py            # Documentation search endpoint
├── services/
│   ├── health_monitor.py  # Background health probing
│   ├── graph_engine.py    # Dijkstra compatibility engine
│   └── groq_client.py     # Groq AI client
└── models/
    └── schemas.py         # Pydantic models
```

## License

MIT
