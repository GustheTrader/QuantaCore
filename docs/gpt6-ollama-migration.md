# GPT-6 and Ollama Cloud integration

Implemented October 5, 2026. The direct OpenAI-compatible connection recognizes GPT-6 model IDs only at the official `https://api.openai.com/v1` endpoint and translates the existing chat contract to Responses. Other providers retain their transport. Requests preserve gateway authorization, token ceilings, reservation accounting, cancellation and bounded response parsing.

Candidate models: `gpt-6.1-sol` for general research, `gpt-6-astra` for difficult reviews, `gpt-6-luna` for bounded tasks, and Ollama Cloud `deepseek-v4.1-flash:cloud` for economical routine work. Model presets fill the connection form; saving and default selection remain separate actions. Availability and quality must be measured through the actual account.

The adapter handles text, function definitions/call IDs/results, JSON output schemas, refusals and usage normalization. Reasoning requests omit sampling parameters. Failed, incomplete, empty and unknown output items fail closed. GPT-6 streaming is buffered and emitted as chat-compatible SSE only after successful completion; it is not incremental token streaming. Multimodal input and hosted tools are explicitly unsupported. Reasoning state continuity/compaction and async tool orchestration are not implemented; function continuation uses explicit chat history. General scoped policies remain non-streaming text-only.

Current live inspection: the saved OpenRouter route is `openrouter/free`. Neither the direct OpenAI nor Ollama Cloud connection has a saved API key. The separate ChatGPT-authorized catalog exposed `gpt-6-astra`, but did not expose Sol or Luna. Its existing business route is separately configured. This does not establish direct API access, Ollama credit availability or a working GPT-6 response.

The direct OpenAI model selection is now saved as `gpt-6.1-sol`; Ollama Cloud is saved as `deepseek-v4.1-flash:cloud`. The preferred provider remains the existing OpenRouter route pending successful live validation.

Verification: the original adapter/gateway run passed 12 checks; the final GPT-6 suite passed five checks including HTTP translation, buffered SSE, usage accounting and incomplete-response rejection. `npm run lint` and `npm run build` passed. Build emitted its large-chunk warning. The local panel returned HTTP 200, but browser automation timed out twice, so rendered controls are not visually verified. Automatic approval review rejected the local server restart with “blocked by policy”; the running production backend has not loaded the new adapter. Restart the QuantaCore server before activating the GPT-6 direct API route.

## Activate Ollama using existing credits

1. Open the local `/hybrid.html` panel, Model connections, Ollama Cloud.
2. Enter the API key in the local form and select Save & load models. Never put it in chat or browser build variables.
3. Confirm the actual catalog contains `deepseek-v4.1-flash:cloud`; use that exact ID and save.
4. Create a scoped gateway client pinned to the saved route with a small call/output ceiling and spending reservation. Cloud approval is required by the existing gateway policy even when credits cover usage.
5. Run one synthetic text connection check, then a few fixed extraction/research cases. Record latency, output validity, usage, actual credit debit where available and baseline quality. Expand only after these results pass.

Pricing shown in a catalog does not verify account billing or effective cost. No live request or credit consumption has been performed by this migration. Open-weight licensing/export rights have not been independently audited.

Sources: [OpenAI GPT-6 guidance](https://developers.openai.com/api/docs/guides/latest-model), [Responses migration](https://developers.openai.com/api/docs/guides/migrate-to-responses), [Ollama DeepSeek model](https://registry.ollama.com/library/deepseek-v4.1-flash:cloud), [Ollama Cloud](https://docs.ollama.com/cloud).
