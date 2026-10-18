# Firecrawl Alexandria in QuantaCore

QuantaCore exposes Alexandria as a local-only research connector at `#/alexandria`.

## Local setup

1. Add `FIRECRAWL_API_KEY` to the ignored `C:\QuantaCore\.env` file. Keep it server-side; do not add a `VITE_` prefix or commit the value.
2. Restart the local QuantaCore server so Node loads the updated environment.
3. Open `http://127.0.0.1:3000/#/alexandria` and choose **Discover providers**.

The API key is read by `eve.ts` and never returned to the browser. The connector accepts requests only from the local QuantaCore UI.

## Retrieval and credits

Discovery posts the query to Firecrawl API v2 Search with `sources: ["alexandria"]`. Firecrawl documents Alexandria discovery as free. Quanta then calls the `firecrawl/find-tools` catalogue capability, scoped only to the provider and capabilities returned by that search, to load full input contracts and current prices. Both steps are free.

Retrieval requires a still-valid server-side discovery ID and a capability ID from that discovery. The server ignores client-supplied provider and capability names, validates inputs against the inspected contract, and requires the exact listed credit price to be acknowledged in the request. No retrieval occurs automatically after discovery. The result view shows Firecrawl's reported charge if the response includes one, alongside the published price. Per-record priced capabilities stay blocked until a maximum total-credit budget can be enforced.

Discovery records are held in local server memory for 15 minutes. A restart or expiry requires a fresh discovery.

## Deployment scope

This connector is local-only. It does not configure Vercel environment variables or deploy an Alexandria endpoint. For a hosted deployment, add the key as a server-side secret and expose the connector behind the deployment's authenticated server API before using it there.
