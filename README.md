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

## Production Posture
- Production defaults disable the admin console, bootstrap admin creation, and demo seed data.
- Public catalog data should be imported into PostgreSQL from trusted JSON files instead of keeping the admin console open.
- Admin login now includes rate limiting and admin API responses are marked `Cache-Control: no-store`.

## Environment Variables
The app can start without a `.env` file for local Docker usage. Copy `.env.example` to `.env` only when you want to override the local defaults.

| Variable | Description |
| --- | --- |
| `POSTGRES_DB` | PostgreSQL database name |
| `POSTGRES_USER` | PostgreSQL username |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `POSTGRES_HOST_PORT` | Host port mapped to PostgreSQL (`55432` by default) |
| `BACKEND_HOST_PORT` | Host port mapped to the backend API (`4000` by default) |
| `FRONTEND_HOST_PORT` | Host port mapped to the frontend app (`33000` by default) |
| `SECURE_COOKIES` | Forces `Secure` on admin cookies (`false` in local Compose, `true` by default in production runtime) |
| `ENABLE_ADMIN_CONSOLE` | Enables `/admin` and `/api/admin/*` (`true` in local Compose, `false` by default in production runtime) |
| `BOOTSTRAP_ADMIN` | Seeds the initial admin user when admin is enabled (`true` in local Compose, `false` by default in production runtime) |
| `ENABLE_DEMO_SEED` | Seeds demo merchants and cards (`true` in local Compose, `false` by default in production runtime) |
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
- Local Compose admin login: `admin / AdminConsoleLocal2026!` (override in `.env` when needed)

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

## Vercel Deployment
Deploy the `frontend` workspace to Vercel and point it at a PostgreSQL database. The Next.js app serves the public UI and also hosts the internal API bridge used on Vercel.

1. In Vercel, import the repository as a Next.js project.
2. Set the project Root Directory to `frontend`.
3. If the project setting `Include files outside the Root Directory in the Build Step` is disabled, enable it because the frontend imports backend source for API routes.
4. Configure a PostgreSQL database and set `DATABASE_URL` in Vercel.
5. Add these production environment variables:

```env
DATABASE_URL=postgres://...
SECURE_COOKIES=true
ENABLE_ADMIN_CONSOLE=false
BOOTSTRAP_ADMIN=false
ENABLE_DEMO_SEED=false
SESSION_SECRET=replace-with-a-long-random-secret-at-least-32-characters
```

6. Deploy.

Recommended production stance:
- Keep `ENABLE_ADMIN_CONSOLE=false` unless you have a short, controlled maintenance window.
- Keep `BOOTSTRAP_ADMIN=false` in public environments.
- Keep `ENABLE_DEMO_SEED=false` so no dummy catalog is exposed.

If you must open the admin console temporarily, also set:

```env
ENABLE_ADMIN_CONSOLE=true
BOOTSTRAP_ADMIN=true
SECURE_COOKIES=true
ADMIN_USERNAME=replace-me
ADMIN_PASSWORD=use-a-long-random-password
ADMIN_DISPLAY_NAME=Operations Admin
SESSION_SECRET=replace-with-a-long-random-secret-at-least-32-characters
```

When `ENABLE_ADMIN_CONSOLE=false`, `/admin` is hidden and `/api/admin/*` returns `404`.

## Production Catalog Import
For public deployment, import `data/shop.json` and `data/cards.json` directly into the production database from a trusted machine instead of exposing the admin UI.

One-time import example:

```bash
DATABASE_URL=postgres://... npm run import:catalog -w backend
```

The importer reads:
- `data/shop.json`
- `data/cards.json`

Import behavior:
- merchants are upserted first
- known merchant aliases in `cards.json` are normalized during import
- missing merchant references fail the import unless they are part of the built-in alias set

## JSON Import
Admin Console supports JSON file import for merchants and cards.

- Merchant import endpoint: `POST /api/admin/import/merchants`
- Card import endpoint: `POST /api/admin/import/cards`
- Both endpoints accept either a bare array or an object wrapper.

Merchant file examples:

```json
[
  {
    "id": "amazon",
    "name": "Amazon",
    "category": "EC",
    "isActive": true
  }
]
```

```json
{
  "merchants": [
    {
      "id": "amazon",
      "name": "Amazon",
      "category": "EC",
      "isActive": true
    }
  ]
}
```

Card file example:

```json
{
  "cards": [
    {
      "id": "sample-card",
      "name": "Sample Card",
      "issuer": "Sample Bank",
      "description": "Imported from JSON",
      "annualFeeYen": 0,
      "baseRewardRatePct": 1.2,
      "supportedBrands": ["Visa", "JCB"],
      "isActive": true,
      "merchantBenefitRates": [
        {
          "merchantId": "amazon",
          "rewardRatePct": 2.4,
          "note": "EC bonus",
          "isActive": true
        }
      ]
    }
  ]
}
```

## Notes
- Seed data is illustrative demo data, not live card program data.
- In Docker Compose, the frontend proxies `/api/*` requests to the backend container through Next.js rewrites.
- On Vercel, the frontend serves `/api/*` through an internal Node.js API route that boots the backend runtime in-process.
- If host ports conflict with local services, override `POSTGRES_HOST_PORT`, `BACKEND_HOST_PORT`, or `FRONTEND_HOST_PORT`.
- Importing cards requires referenced `merchantId` values to already exist in the merchant master.
