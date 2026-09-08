# SmartTour AI — Advanced Hackathon Edition

## Features
- Professional responsive tourism UI
- MySQL-backed user registration/login using bcrypt + JWT
- AI trip planner + AI travel chatbot (OpenAI Responses API)
- Real weather via Open-Meteo forecast + geocoding
- Real map/place discovery through configurable Places provider
- Hotel and restaurant data stored in MySQL
- Admin dashboard: users, hotels, restaurants, trips and API settings
- Secure environment-variable configuration
- Demo mode works without AI/Places keys

## Requirements
- Node.js 20+
- MySQL 8+
- Optional OpenAI API key for live AI
- Optional Places provider key for production-grade place search

## Setup
1. Create database:
   `mysql -u root -p < database/schema.sql`
2. Copy `backend/.env.example` to `backend/.env`
3. Set MySQL credentials and `JWT_SECRET`.
4. Install:
   `cd backend && npm install`
5. Start:
   `npm start`
6. Open:
   `http://localhost:5000`

## First admin
The schema creates a demo admin:
- Email: admin@smarttour.local
- Password: ChangeMe123!

Change/remove this account before any real deployment.

## AI
The backend uses the OpenAI Responses API server-side when `OPENAI_API_KEY` is present. Never put the key in frontend JavaScript. If no key is present, the app uses a deterministic demo planner/chat response.

## Weather
Open-Meteo provides geocoding and forecast data. No key is required for non-commercial evaluation/prototyping.

## Maps & places
The default map uses Leaflet with OpenStreetMap tiles and visible attribution. The code is intentionally provider-configurable. For a real deployment with significant traffic, use an appropriate commercial OSM-derived tile/place provider or self-hosted infrastructure.

The demo's Places endpoint can use the configured provider:
- `PLACES_BASE_URL`
- `PLACES_API_KEY`
- `PLACES_MODE` = `foursquare` or `custom`

If no provider is configured, it returns curated MySQL demo records.

## Hackathon demo
1. Register/login.
2. Search Ooty.
3. Click Weather.
4. Generate a 3-day AI itinerary.
5. Browse hotel/restaurant recommendations.
6. Open the map and click markers.
7. Ask the AI assistant: "Make this trip cheaper."
8. Login as admin to demonstrate the dashboard.

## Production checklist
- Replace demo admin password.
- Use HTTPS.
- Rotate JWT secret and API keys.
- Add rate limiting and audit logs.
- Use a proper transactional email provider.
- Add a production Places provider and commercial map tiles if traffic requires it.
