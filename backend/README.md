# Bradcall API

Express API for the Bradcall service marketplace.

## Stack

- Express 5
- PostgreSQL
- Prisma ORM 7
- JWT authentication
- bcrypt password hashing
- Zod request validation
- Helmet and restricted CORS

Prisma's current PostgreSQL guidance supports PostgreSQL with Prisma ORM; the database connection is supplied through `DATABASE_URL`. urlPrisma PostgreSQL documentationhttps://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql

## Roles

- `PARTNER`: browse services and create service requests.
- `PROVIDER`: create/manage their own services and manage requests assigned to them.
- `ADMIN`: platform operations and cross-provider management.

Provider and admin service ownership is enforced server-side; the frontend role alone is never trusted.

## Local setup

1. Copy `.env.example` to `.env`.
2. Set a real PostgreSQL `DATABASE_URL`.
3. Set a long random `JWT_SECRET`.
4. Run `npm install`.
5. Run `npx prisma generate`.
6. Run `npx prisma migrate dev --name init`.
7. Run `npm run dev`.

Health check: `GET /api/health`.

Never commit `.env` or real credentials.

## API

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`

Registration permits only PARTNER or PROVIDER. ADMIN is intentionally not self-registerable.

### Services

- `GET /api/services`
- `GET /api/services/:id`
- `POST /api/services` — PROVIDER/ADMIN
- `PATCH /api/services/:id` — owner PROVIDER/ADMIN
- `DELETE /api/services/:id` — owner PROVIDER/ADMIN

Search supports `q`, `location`, and `category`.

### Requests

- `POST /api/requests` — PARTNER
- `GET /api/requests` — authenticated user; ADMIN can view all
- `PATCH /api/requests/:id` — assigned PROVIDER/ADMIN

This is the foundation for the marketplace flows. Payments, notifications, provider subscriptions, reviews, and admin invitation workflows are intentionally separate next phases.
