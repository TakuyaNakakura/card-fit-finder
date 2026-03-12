# Credit Card Recommendation MVP

Containerized MVP for recommending the best credit card based on monthly spend, preferred card brands, favorite merchants, and annual fee tolerance.

## Stack
- frontend: Next.js App Router + TypeScript
- backend: Express + TypeScript
- database: PostgreSQL
- orchestration: Docker Compose

## Demo Scope
- Anonymous diagnosis flow for end users
- Admin login with card and merchant CRUD
- Seeded sample catalog for Japanese-market demo scenarios

## Environment Variables
The app can start without a `.env` file. Copy `.env.example` to `.env` only when you want to override the defaults.

| Variable | Description |
| --- | --- |
| `POSTGRES_DB` | PostgreSQL database name |
| `POSTGRES_USER` | PostgreSQL username |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `POSTGRES_HOST_PORT` | Host port mapped to PostgreSQL (`55432` by default) |
| `BACKEND_HOST_PORT` | Host port mapped to the backend API (`4000` by default) |
| `FRONTEND_HOST_PORT` | Host port mapped to the frontend app (`33000` by default) |
| `ADMIN_USERNAME` | Seeded admin username |
| `ADMIN_PASSWORD` | Seeded admin password |
| `ADMIN_DISPLAY_NAME` | Seeded admin display name |
| `SESSION_SECRET` | HMAC secret for admin session cookies |

## Development
- Start all services: `docker compose up -d --build`
- Stop all services: `docker compose down`
- View frontend logs: `docker compose logs --tail=200 frontend`
- View backend logs: `docker compose logs --tail=200 backend`
- View database logs: `docker compose logs --tail=200 db`

## Local Validation
- Install dependencies: `npm install`
- Frontend typecheck: `npm run typecheck -w frontend`
- Frontend test: `npm run test -w frontend`
- Backend typecheck: `npm run typecheck -w backend`
- Backend test: `npm run test -w backend`
- Full build: `npm run build`

## Runtime URLs
- App: [http://localhost:33000](http://localhost:33000)
- Backend API: [http://localhost:4000/api/health](http://localhost:4000/api/health)

## Notes
- Seed data is illustrative demo data, not live card program data.
- The frontend proxies `/api/*` requests to the backend service through Next.js rewrites.
- If host ports conflict with local services, override `POSTGRES_HOST_PORT`, `BACKEND_HOST_PORT`, or `FRONTEND_HOST_PORT`.
