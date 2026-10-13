# DevPulse Dashboard UI

Real-time API monitoring, AI-powered code generation, and compatibility analysis dashboard.

## Features

- **Dashboard Stats**: Real-time overview of API health metrics
- **Health Monitor**: Live status of 15 monitored APIs with latency tracking
- **AI Code Generator**: Generate production-ready Python integration code using Groq AI
- **Compatibility Checker**: Analyze API compatibility using graph-based pathfinding
- **Documentation Search**: AI-powered documentation search and Q&A

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **API Client**: Async fetch with proper error handling

## Quick Start

### Prerequisites

- Node.js 18+ 
- DevPulse Backend running on port 8001

### Installation

```bash
# Install dependencies
npm install

# Configure environment
# (frontend will call /api on the same host; Next rewrites proxy to BACKEND_URL)
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

### One-host local setup

- Frontend runs on `http://localhost:3000`
- Backend runs on `http://localhost:8001`
- Browser calls only `http://localhost:3000/api/...`
- Next.js rewrites proxy those calls to `BACKEND_URL` (default `http://localhost:8001`)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Public API base URL (leave empty for same-host mode) | `""` |
| `BACKEND_URL` | Server-side proxy target for rewrites | `http://localhost:8001` |

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout with dark theme
│   ├── page.tsx            # Main dashboard page
│   └── globals.css         # Global styles
├── components/
│   ├── DashboardStats.tsx      # Stats overview cards
│   ├── HealthMonitor.tsx       # API health grid
│   ├── CodeGenerator.tsx       # AI code generation UI
│   ├── CompatibilityChecker.tsx # API compatibility tool
│   └── DocsSearch.tsx          # Documentation search
└── lib/
    └── api.ts              # API client with TypeScript types
```

## API Endpoints Used

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Get health status of all APIs |
| `/api/dashboard` | GET | Get dashboard statistics |
| `/api/compatibility` | GET | Check API compatibility |
| `/api/generate` | POST | Generate integration code |
| `/api/docs` | POST | Search documentation |

## Development

```bash
npm run dev     # Start development server
npm run build   # Build for production
npm start       # Start production server
npm run lint    # Lint code
```

## Deploy on Vercel

```bash
npx vercel
```

Set these Vercel environment variables:

- `NEXT_PUBLIC_API_URL=` (empty, for one-host mode)
- `BACKEND_URL=https://<your-backend-domain>`

This keeps your frontend and API under one Vercel host URL from the browser perspective.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
