# Threat Model

## Project Overview

Tayyibati is an Arabic-first Expo mobile application backed by a public Express API and PostgreSQL database. Users submit text queries and food or label images for AI-assisted ingredient analysis, view saved history, and manage a lightweight local account. The production deployment is public (`tayyibati.replit.app`), so every `/api/*` route must be treated as internet-reachable. The mobile app and any values it sends are untrusted.

## Assets

- **User accounts** — email addresses, password hashes, password-reset state, premium flags, and plan assignments. Compromise enables impersonation and account takeover.
- **Analysis history** — saved food queries, image/label-derived reports, and timestamps. This is user data and may reveal dietary habits or uploaded product information.
- **Administrative capabilities** — foods catalog management, plan management, user management, usage unlocks, and configuration changes. Abuse can alter business logic or destroy data.
- **Application secrets and metering controls** — OpenAI API key, free usage limits, email configuration, and related app config values. Exposure or tampering can cause cost abuse, service disruption, or secret leakage.

## Trust Boundaries

- **Mobile client to API** — all requests come from an attacker-controllable client. The server must authenticate and authorize every protected action.
- **API to PostgreSQL** — the API has direct access to user records, history, reset codes, plans, foods, and app config. Route-level authorization failures immediately become database exposure or tampering.
- **API to external services** — the server uses OpenAI for analysis and Resend for password-reset email. Secrets used across this boundary must not be exposed through API routes.
- **Public vs user-specific vs admin surfaces** — public catalog/config/analysis endpoints are distinct from per-user history/usage data and from admin-only management actions. These separations must be enforced on the server, not just in the mobile UI.
- **Production vs dev-only behavior** — development-only fallbacks such as logging reset codes are out of scope unless reachable in production. Assume `NODE_ENV=production` in deployed environments.

## Scan Anchors

- Production entry points: `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/*.ts`, mobile API client in `artifacts/mobile/lib/api.ts`.
- Highest-risk areas: `routes/users.ts`, `routes/history.ts`, `routes/admin.ts`, `routes/config.ts`, `routes/foods.ts`, `routes/plans.ts`, `routes/analysis.ts`.
- Public surfaces: `/api/healthz`, `/api/config/public`, `/api/plans` GET, `/api/foods` GET, analysis endpoints, login/register/reset flows.
- User-specific surfaces: history, usage, plan enrollment, profile refresh; all currently depend on client-supplied identifiers.
- Admin surfaces: `/api/admin/*`, mutating foods/plans/config routes, and admin user-management routes in `routes/users.ts`.
- Usually ignore as dev-only unless proven reachable: local workflow files, mockup sandbox, and development-only email fallback behavior.

## Threat Categories

### Spoofing

The app’s mobile identity model is weak because the client stores a user object locally and sends `userId` values to the API. The API must not treat a caller-supplied user ID as proof of identity. Any route that accesses history, usage, premium state, or other user data must bind requests to a server-verified identity. Admin capabilities must require a server-verified admin credential on every request, not only on the login screen.

### Tampering

Foods, plans, config values, user records, premium flags, and saved history are all writable through API routes. The server must ensure only authorized actors can mutate them, and public analysis endpoints must not allow attackers to alter another user’s usage counters or saved records by submitting someone else’s identifier.

### Information Disclosure

The API stores and serves user account data, password-reset state, analysis history, and application configuration. User-specific routes must only return the caller’s own data, and admin/config routes must not disclose all users, all history, or secret config values to unauthenticated callers.

### Denial of Service

Public analysis routes invoke paid external AI calls and update daily usage counters. The service must prevent attackers from exhausting another user’s quota, abusing metering bypasses, or changing config values that disable practical rate or usage limits. External-service secrets must remain protected to avoid cost abuse outside the app.

### Elevation of Privilege

Admin-only capabilities exist for managing foods, plans, configuration, and user accounts. The server must enforce authorization on each privileged route. A regular internet user must not be able to grant premium access, reset another user’s password, unlock accounts, read all history, or rewrite app configuration.