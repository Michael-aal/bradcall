# Bradcall

Bradcall is a local-services marketplace built with plain HTML, CSS, and JavaScript on the frontend and Express, Prisma, and PostgreSQL on the backend.

## Current experience

- Public homepage and service discovery page with a partial, searchable community map (OpenStreetMap / Leaflet).
- Consumer dashboard: search services, submit requests, and track request status.
- Provider dashboard: publish and hide listings, edit a provider profile, and update job status.
- Admin dashboard: marketplace totals, account list, and service-request overview.
- Account registration and login for consumers and providers. Admin accounts are provisioned by an operator, not through public registration.
- Responsive layouts with a green/yellow palette.

## Backend setup

1. Install a supported Node.js LTS release.
2. In `backend/`, install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and set `DATABASE_URL` and a strong random `JWT_SECRET` (at least 32 characters).
4. For a new/empty database, run `npx prisma migrate deploy` and then `npm run prisma:generate`.
5. Run `npm run check` for JavaScript syntax checks.
6. Start the API with `npm run dev`. Health check: `GET /api/health`.

If a database already contains these tables but has no matching Prisma migration history, do not run the initial migration blindly. Confirm the live schema first and baseline the migration deliberately.

### Provision the first administrator

Set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in the backend environment, using a unique password of at least 12 characters, then run:

```sh
npm run admin:seed
```

This is an operator-only command. Do not add public admin registration.

## Frontend API configuration

The pages load `config.js`. Local development defaults to `http://localhost:5000`; for a separate production API, set `window.BRADCALL_API_URL` in `config.js` to the deployed backend origin. Set `CORS_ORIGIN` on the backend to the exact frontend origin(s), comma-separated, before deployment.

## Community map

The map uses Leaflet and OpenStreetMap tiles. Community searches use the public Nominatim geocoder, with a conservative delay between provider-area lookups. OpenStreetMap attribution is displayed on the map. It maps broad service areas from listings; it does not track the visitor or expose a provider's private home address. The initial view is a Lagos map preview and can be searched for another community.

The shaded circle is an approximate viewing aid, not an official community boundary. Provider pins appear only when the service area can be geocoded and matches the selected search area.

## Important verification notes

This repository work has been committed to the feature branch and still needs a real database-backed end-to-end run, mobile-browser testing, deployment configuration, and a security review before production use. Do not treat the marketplace as production-ready until those checks pass.
