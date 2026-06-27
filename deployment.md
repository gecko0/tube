# Deployment Guide

This guide covers the production deployment for the cloud web app in
`apps/web`. The CLI package is not deployed to Vercel.

## Production Targets

Use these Convex production values:

| Purpose | Value |
| --- | --- |
| Convex deployment name | `exuberant-squirrel-58` |
| Convex client URL | `https://exuberant-squirrel-58.convex.cloud` |
| Convex HTTP actions URL | `https://exuberant-squirrel-58.convex.site` |
| CLI upload endpoint | `https://exuberant-squirrel-58.convex.site/api/upload` |
| CLI missing-videos endpoint | `https://exuberant-squirrel-58.convex.site/api/missing` |

Do not commit deploy keys, Clerk secret keys, or generated API keys to the repo.

## What Gets Deployed

Vercel deploys the React/Vite app from `apps/web`.

Convex deploys the backend functions from `apps/web/convex` during the Vercel
build. The Vercel build command must run `convex deploy` first so the deployed
frontend is built against the production Convex URL.

## Required Accounts

1. A Vercel account connected to the Git repository.
2. A Convex project with the production deployment:
   `exuberant-squirrel-58`.
3. A Clerk production application for the cloud web app.

Use a Clerk production instance for the production Vercel site. Do not reuse
Clerk development keys in Vercel production.

## Step 1: Configure Clerk

1. Open the Clerk dashboard.
2. Select or create the production Clerk application for `tube`.
3. Copy the production publishable key from Clerk:
   `pk_live_...`
4. Copy the Clerk Frontend API URL. It looks like:
   `https://<your-clerk-frontend-api>.clerk.accounts.dev`
5. Enable Clerk's Convex integration:
   `https://dashboard.clerk.com/apps/setup/convex`
6. Confirm that the integration creates a JWT template/application named
   `convex`.

This repo's Convex auth config uses:

```ts
applicationID: "convex"
```

So the Clerk JWT template/application ID must stay `convex`.

Clerk production should also be configured to allow the final production web
origin. Convex's Vercel guide notes that Clerk production auth should use a
custom domain rather than relying on a `*.vercel.app` URL, so plan to add the
final custom domain in Clerk once it exists.

## Step 2: Configure Convex Production Environment Variables

Open the Convex dashboard for the `exuberant-squirrel-58` production deployment:

`https://dashboard.convex.dev/`

Go to the production deployment settings and add this environment variable:

| Variable | Value |
| --- | --- |
| `CLERK_JWT_ISSUER_DOMAIN` | The Clerk Frontend API URL, for example `https://<your-clerk-frontend-api>.clerk.accounts.dev` |

This value is read by `apps/web/convex/auth.config.ts`.

You can also set it from the repo root if your local Convex CLI is logged in
and linked to this project:

```bash
pnpm --filter web exec convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-clerk-frontend-api>.clerk.accounts.dev --prod
```

After setting or changing `CLERK_JWT_ISSUER_DOMAIN`, deploy Convex functions
again. Vercel will do this automatically on the next production deploy.

## Step 3: Create the Convex Production Deploy Key

1. Open the Convex dashboard.
2. Select the production deployment `exuberant-squirrel-58`.
3. Go to the deployment settings.
4. Open the `General` tab.
5. Click `Generate Production Deploy Key`.
6. When choosing permissions, enable `deployment:deploy`.
7. Copy the generated deploy key.

The deploy key is a secret. It goes into Vercel only.

## Step 4: Create the Vercel Project

1. Open `https://vercel.com/new`.
2. Import the Git repository.
3. Configure the project settings:

| Vercel setting | Value |
| --- | --- |
| Framework Preset | `Vite` |
| Root Directory | `apps/web` |
| Install Command | `pnpm install --frozen-lockfile` |
| Build Command | `npx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --cmd 'pnpm build'` |
| Output Directory | `dist` |

Why this build command matters:

1. `npx convex deploy` deploys the Convex backend functions.
2. `--cmd-url-env-var-name VITE_CONVEX_URL` exposes the production Convex URL to
   Vite using the exact variable name this app reads.
3. `--cmd 'pnpm build'` builds the frontend after Convex has provided
   `VITE_CONVEX_URL`.

Do not replace the build command with only `pnpm build`, or Vercel will build
the frontend without deploying Convex functions.

## Step 5: Add Vercel Environment Variables

In Vercel, open:

`Project Settings -> Environment Variables`

Add these variables:

| Variable | Value | Environment |
| --- | --- | --- |
| `CONVEX_DEPLOY_KEY` | The production deploy key from Convex | Production only |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk production publishable key, `pk_live_...` | Production |

Do not set `CONVEX_DEPLOY_KEY` for Preview unless you intentionally create a
separate Convex Preview Deploy Key. The production deploy key should not be used
for preview deployments.

Do not set `CLERK_SECRET_KEY` in Vercel for the current app. This repo's cloud
web app is a Vite SPA and does not currently read a Clerk secret key at runtime.

`VITE_CONVEX_URL` normally does not need to be added manually in Vercel because
`convex deploy` injects it into the `pnpm build` command. If you ever need a
manual fallback, the production value is:

```text
VITE_CONVEX_URL=https://exuberant-squirrel-58.convex.cloud
```

## Step 6: Deploy

Trigger a production deploy in Vercel.

The expected build sequence is:

1. Vercel installs dependencies.
2. Vercel runs:
   `npx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --cmd 'pnpm build'`
3. Convex reads `CONVEX_DEPLOY_KEY`.
4. Convex deploys `apps/web/convex`.
5. Convex runs `pnpm build` with `VITE_CONVEX_URL` set.
6. Vercel publishes `apps/web/dist`.

## Step 7: Configure Production Domains

After the first Vercel production deploy:

1. Decide on the production web domain, for example `https://tube.example.com`.
2. Add that domain in Vercel:
   `Project Settings -> Domains`.
3. Add the same production origin in Clerk's production application.
4. Use that production domain for user-facing access.

Keep Convex URLs separate:

| Use | URL |
| --- | --- |
| Browser app Convex client | `https://exuberant-squirrel-58.convex.cloud` |
| CLI HTTP sync endpoints | `https://exuberant-squirrel-58.convex.site` |
| User-facing web app | Your Vercel/custom domain |

## Step 8: Verify the Deployment

### Verify the Vercel App

1. Open the production Vercel URL or custom domain.
2. Sign in with Clerk.
3. Confirm the videos page loads without an auth error.
4. Open browser dev tools and confirm there is no Clerk `/tokens/convex` 404.

If sign-in works but Convex queries are unauthenticated, check:

1. Clerk Convex integration is enabled.
2. The Clerk JWT application/template is named `convex`.
3. Convex production has `CLERK_JWT_ISSUER_DOMAIN` set to the Clerk Frontend API
   URL.
4. Convex functions have been redeployed after changing auth config or env vars.

### Verify Convex HTTP Actions

From a terminal, this should return `401` with a missing API key error after the
Convex HTTP routes are deployed:

```bash
curl -i -X POST https://exuberant-squirrel-58.convex.site/api/upload \
  -H 'Content-Type: application/json' \
  -d '{}'
```

A `404` usually means the Convex HTTP functions were not deployed or the URL is
wrong.

### Verify CLI Sync

1. Sign in to the deployed web app.
2. Open the API keys dialog.
3. Create a new API key.
4. Connect the CLI to the production Convex HTTP deployment:

```bash
yt --prod connect <api-key>
```

5. Make production the default cloud connection:

```bash
yt connection default prod
```

The equivalent config command is:

```bash
yt config --default_connection_key prod
```

6. Confirm the saved production connection:

```bash
yt connection show prod
```

7. Upload local videos:

```bash
yt sync --limit 1
```

Use `yt sync --all` only after the small sync succeeds.

You can target production explicitly without changing the default:

```bash
yt --prod sync --limit 1
```

## Local Production Smoke Test

For a local build against production Convex, create `apps/web/.env.local` with:

```env
VITE_CONVEX_URL=https://exuberant-squirrel-58.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_live_<your-production-key>
```

Then run:

```bash
pnpm --filter web build
```

This verifies the frontend can compile with production-style values. It does
not deploy Convex functions.

## Preview Deployments

Preview deployments are optional.

If you want Vercel previews to deploy isolated Convex preview backends:

1. In Convex, create a Preview Deploy Key from the project settings.
2. In Vercel, add another `CONVEX_DEPLOY_KEY` scoped to Preview only.
3. Keep the Production deploy key scoped to Production only.
4. Decide whether previews should use a separate Clerk development application
   or a Clerk production domain setup that explicitly allows preview origins.

Do not use the production Convex deploy key for preview environments.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Vercel build says `Missing VITE_CONVEX_URL` | Build command did not inject the Convex URL | Use `npx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --cmd 'pnpm build'` |
| Vercel build cannot deploy Convex | Missing or wrong `CONVEX_DEPLOY_KEY` | Add a production Convex deploy key to Vercel Production env vars |
| Browser shows missing Clerk publishable key | Missing `VITE_CLERK_PUBLISHABLE_KEY` | Add the Clerk `pk_live_...` key to Vercel |
| Clerk sign-in succeeds but Convex queries fail as unauthenticated | Clerk JWT/Convex auth mismatch | Enable Clerk Convex integration and set `CLERK_JWT_ISSUER_DOMAIN` in Convex production |
| `/api/upload` returns `404` | Convex HTTP routes not deployed | Redeploy through Vercel or run `convex deploy` with the production deploy key |
| `/api/upload` returns `401` | Route exists but no CLI API key was supplied | This is expected for the unauthenticated smoke test |

## References

- Convex Vercel hosting guide: `https://docs.convex.dev/production/hosting/vercel`
- Convex Clerk auth guide: `https://docs.convex.dev/auth/clerk`
- Vercel Vite guide: `https://vercel.com/docs/frameworks/frontend/vite`
