# Zo Computer MCP connection

The local MCP Connectors page and Hybrid Cloud panel provide a Zo Computer remote MCP connection. Endpoint: `https://api.zo.computer/mcp`; transport: Streamable HTTP; authentication: server-side Bearer token. The installed MCP SDK performs initialization and paginated tool discovery. No new dependency is required.

Create a token in Zo Settings → Advanced, enter it into the local Zo MCP card, select Save token, then Discover tools. Tokens are encrypted with the existing ProviderStore and are never returned to settings. Business and Trading use separate credential slots; these slots do not constrain a token's privileges inside Zo. Use separate Zo workspaces/tokens when upstream isolation is needed.

Discovery does not execute tools. Descriptions and schemas are displayed as text, not trusted instructions. Agent tool execution, scheduled calls, resource retrieval and automatic binding are not enabled by this connector. The existing browser-local connector definitions remain separate from this real remote connection.

Requests require local browser access, same-origin validation and the local-client header. Redirects are rejected; requests time out; pagination is bounded; upstream errors are generalized to avoid exposing credentials. Tool discovery status is session-local and clears when the server restarts. Removing a stored token does not revoke it at Zo.

Source: [Zo MCP server guide](https://www.zo.computer/guide/mcp-server).

Verified October 5, 2026 (America/Los_Angeles): router security/domain tests, TypeScript checking and production build passed. The local server was restarted after confirming no active research/cloud jobs. The existing Business Zo token was reused server-side into the separate MCP credential slot. Authenticated MCP initialization and tools/list succeeded with 79 tools at 2026-10-06T02:24:47Z. No tools/call operation was performed. The new Hybrid Cloud card was observed in the browser with its successful discovery count. Trading remains unconfigured.
