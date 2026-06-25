# GitHub OAuth Callback

## Objective

Complete the GitHub OAuth web flow for an authenticated platform user. The
callback consumes a one-time state, exchanges the authorization code, fetches
the GitHub identity, stores an encrypted access token, creates one
GithubConnection, and redirects the browser to the frontend projects page.

## Contract

- GET /api/v1/github/oauth/login requires authentication and uses state + PKCE.
- GET /api/v1/github/oauth/callback accepts code + state or error + state.
- Success redirects to FRONTEND_URL/projects.
- Expected failures redirect with github=error&reason=<safe-code>.
- OAuth state expires after 300 seconds and can be consumed only once.

## Security Boundaries

- Never log OAuth codes, secrets, tokens, PKCE verifiers, or raw provider errors.
- Validate callback, Redis, token, and profile payloads with Zod.
- Encrypt GitHub access tokens with AES-256-GCM before persistence.
- Never overwrite an existing connection or share a GitHub account across users.

## Verification

- Targeted Jest tests for login, callback orchestration, and encryption.
- npm test
- npm run build
- npm run lint
