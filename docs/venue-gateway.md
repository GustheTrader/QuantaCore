# Local venue gateway

Quanta exposes `/api/venues` alongside the hybrid model gateway. The model gateway routes intelligence; the venue gateway reads markets. No order submission, approvals, wallet signing, financial token issuance, or simulated fills are implemented here. QS remains the intended execution and deterministic risk boundary.

All requests require `X-Quanta-Client: local-ui`, loopback access, and matching Origin when present. Requests only reach fixed HTTPS upstreams using GET, with redirects disabled, a ten-second timeout and a one-megabyte response limit. Responses retain provider fields and a local receivedAt timestamp: receipt time is not proof of quote freshness or executable liquidity.

## Selected adapters

| Venue | Route | Required local configuration |
|---|---|---|
| Alpaca TradFi | GET /api/venues/alpaca/quote?symbol=SPY | ALPACA_PAPER_KEY_ID and ALPACA_PAPER_SECRET_KEY |
| 0x DeFi | GET /api/venues/0x/quote?chainId=8453&sellToken=ADDRESS&buyToken=ADDRESS&sellAmount=INTEGER | ZEROX_API_KEY |
| Polymarket prediction | GET /api/venues/polymarket/quote?token_id=TOKEN_ID | Public API, no credentials |

GET `/api/venues/status` reports credential presence only. Put keys in the existing ignored `C:\QuantaCore\.env.local` and restart Quanta. Do not put wallet private keys or broker live keys here. Alpaca uses the IEX feed, not consolidated NBBO. 0x amounts are integer token base units; prices are indicative and must not be used as guaranteed fills. Enabled chains: Ethereum 1, Base 8453, Arbitrum 42161, Polygon 137. Retrieve each Polymarket outcome token separately; never manufacture a NO ask from 1 minus the YES price.

The adapter source is locally owned and replaceable; Alpaca and 0x hosted services and market access are external dependencies. Open-source adapters do not confer ownership of broker infrastructure or market data rights.

Sources: https://docs.alpaca.markets/us/docs/historical-api ; https://docs.alpaca.markets/us/v1.4.2/docs/paper-trading ; https://docs.0x.org/api-reference/evm-ap-is/swap/allowanceholder-getprice ; https://docs.polymarket.com

Activation boundary: this implementation activates market-read routes locally. Authentication still needs account credentials. Connecting QS, producing paper fills, and enabling live execution require their own validated integration; no RSI agent can activate them through this router.
