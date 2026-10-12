# Bradcall

Bradcall is a local-services marketplace built with plain HTML, CSS, and JavaScript on the frontend and Express, Prisma, and PostgreSQL on the backend.

## Current experience

- Public homepage and service discovery page with a partial, searchable community map (OpenStreetMap / Leaflet).
- Customer dashboard: search services, submit requests, and track request status.
- Provider dashboard: publish and hide listings, edit a provider profile, and update job status.
- Admin dashboard: marketplace totals, account list, and service-request overview.
- Account registration and login for customers and providers. Admin accounts are provisioned by an operator, not through public registration.
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


## Payments, communications and Trust Centre

The feature branch now includes a Trust Centre at \`trust-center.html\` and draft policies at \`policies.html\`.

- **Messaging:** private messages are scoped to a service request and its parties.
- **Support:** consumers/providers create tickets; admins reply and manage ticket status.
- **Disputes:** either service party can open a dispute; admins review the case and record resolution.
- **Paystack:** configure \`PAYSTACK_SECRET_KEY\` and \`PAYSTACK_CALLBACK_URL\` on the backend only. Checkout initialization and transaction verification happen server-side. Configure Paystack to send webhooks to \`/api/payments/webhook\`.
- **Cash:** providers report cash received; the customer can confirm or dispute the record. This is an audit record, not independent proof of physical cash transfer. Provider commission is tracked separately.
- **Refunds:** admins can request a Paystack refund for a confirmed online payment. The status remains pending until Paystack confirms processing.
- **Trust & Safety:** reports receive AI-assisted triage when \`OPENAI_API_KEY\` is configured; without it, conservative keyword flags are used. AI never applies sanctions automatically. Admin decisions are recorded and appeals are supported.
- **Policies:** registration requires recorded acceptance of policy version \`2026-10-12-v1\`. The original policy pages are drafts requiring legal review before public launch.

### New database migration

For a database already running the initial Bradcall migration, deploy the additive migration using:

\`\`\`sh
cd backend
npm install
npx prisma migrate deploy
npm run prisma:generate
npm run check
\`\`\`

Do not run against an uninspected database or assume production is configured. Back up the database first and review migration status.

### Required environment settings

- \`PAYSTACK_SECRET_KEY\` — server-side secret only
- \`PAYSTACK_CALLBACK_URL\` — public payment result page URL
- \`BRADCALL_COMMISSION_PERCENT\` — disclosed provider commission calculation (defaults to 0% (configure only after disclosing and agreeing the rate))
- \`OPENAI_API_KEY\` — optional, server-side only; enables AI-assisted report triage

**Settlement limitation:** the current integration records the platform commission and provider share but does not implement an approved split payout or escrow. The admin payout ledger records a completed external transfer reference; it does not move funds itself. Admins must verify the provider and resolve disputes before recording a payout. Funds collected into the platform Paystack account require a separately approved payout process. Do not advertise delayed payouts or escrow until Paystack confirms the compliant product and configuration.
