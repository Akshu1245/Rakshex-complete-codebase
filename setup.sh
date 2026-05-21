#!/bin/bash

echo "🚀 Launching Rakshex Full Stack..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating template..."
    cp .env.example .env
    echo "✅ Created .env file. Please edit it with your real API keys."
    echo ""
    echo "Required keys to configure:"
    echo "  - GITHUB_TOKEN (for PR scanning)"
    echo "  - SLACK_WEBHOOK_URL (for alerts)"
    echo "  - STRIPE_API_KEY (for payments)"
    echo ""
    read -p "Press Enter to continue with default config..."
fi

# Build and Start
echo "🐳 Building and starting containers..."
docker-compose -f docker-compose.prod.yml up --build -d

echo ""
echo "✅ System Online!"
echo ""
echo "👉 Frontend Dashboard: http://localhost:3000"
echo "👉 API Docs: http://localhost:8000/docs"
echo "👉 Nginx: http://localhost:80"
echo ""
echo "To view logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "To stop: docker-compose -f docker-compose.prod.yml down"