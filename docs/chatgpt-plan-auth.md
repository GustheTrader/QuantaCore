# ChatGPT plan authentication in local Quanta

Installed OAuth integration uses OpenAI's documented open-source/local Sign in with ChatGPT flow. It does not reuse Codex tokens, impersonate Codex, scrape ChatGPT sessions, or create a Google OAuth client. Google is an account sign-in option on OpenAI's own page. No Gmail mailbox scopes are requested. The existing Quanta application login remains separate.

## Complete your account connection

1. Open http://127.0.0.1:3000/hybrid.html and select Business.
2. In Use your ChatGPT plan, choose Continue with ChatGPT.
3. On OpenAI's page, sign in using your usual Google profile if applicable. Review and authorize QuantaCore yourself. The implementation requests identity and optional ChatGPT plan usage scopes, not email inbox access.
4. Return to Quanta, load the account-specific model catalog, select a model and save the route. Tick Business connector permission only if you want your prepared connectors to send explicitly selected ChatGPT-plan requests.
5. Send the displayed connection test to verify a real response completed. Connecting an identity or loading models alone is not an inference success.

Eligibility and available models are determined by OpenAI. Current official guidance identifies eligible Plus and Pro users; Business/Enterprise workspace access must not be assumed. Shared plan limits and available credits apply; the bridge never switches to API-key billing on an error. This local integration is not a registered commercial hosted sign-in service; hosted commercial deployment requires OpenAI's applicable client approval.

## Connectors

Existing Business bridge clients explicitly select `model: "chatgpt-plan"` on their text completion request after the operator grants Business permission. Local remains the default. For the existing paused Paperclip analyst, run `node scripts/setup-business-bridge.mjs --chatgpt` only after connecting and saving that route. This updates its planning payload while preserving paused status. No worker is activated automatically.

OpenAI OAuth credentials stay only in `.quanta/chatgpt-credentials.json`, protected by Windows current-user DPAPI (the existing ProviderStore platform protection elsewhere). Host/account metadata is in ignored `.quanta/chatgpt-oauth.json`. Tokens never enter browser storage or connector credentials. Start authorization from 127.0.0.1, not localhost: the browser-bound HTTP callback is exactly `http://127.0.0.1:3000/auth/openai/callback`. Restarting the server expires pending sign-ins; start a new attempt.

Requests use the public `/v1/models` account catalog and `/v1/responses` with `stream:true`, `store:false`, full text context, and system guidance in `instructions`. The bridge accepts results only after `response.completed`; interruptions, quota failures and incomplete responses fail. It supports text planning only, with no model tools, publications, trading or automated business actions. No claim of durable remote conversation storage is made.

Switching an account requires saving a matching model/permission route before connector use. Disconnect attempts renewable-session revocation then clears local tokens. If remote revocation cannot be confirmed, the UI directs you to disconnect the app in ChatGPT settings. Account/client mapping and stable host identity remain for later authorization.

## Validation

OAuth and inference fixtures check dynamic registration, PKCE/state/nonce, ID-token verification, account/client matching, serialized refresh, missing permissions, one-time callbacks, explicit Business permission and terminal-stream errors. A live account login and real model response still require user authorization; fixture passes do not verify subscription entitlement.

Official references:
- https://developers.openai.com/siwc/token-sharing-open-source/sign-in
- https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations
