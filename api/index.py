import sys
import os

# Add the devpulse-backend directory to Python path so all imports resolve
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'devpulse-backend'))

from mangum import Mangum
from main import app

# Vercel/AWS Lambda handler — lifespan disabled since serverless functions are stateless
handler = Mangum(app, lifespan="off")
