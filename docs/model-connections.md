# Local model connections

Open the local operations panel at http://127.0.0.1:3000/hybrid.html.

The OpenAI dropdown automatically loads the connected ChatGPT account's live catalog. It is not copied from Codex's model selector. A saved route is only changed when you choose a model and save it. Business permission is a separate explicit choice.

Claude, Grok (xAI), Google Gemini API, Fireworks AI and Ollama Cloud are available in Model connections. Enter the provider API key, select Save & load models, choose a model, and save. Use for text agents explicitly changes the default text route. Keys stay encrypted on the local server. A catalog check does not perform inference. The local production build uses the local backend; the hosted demo retains its separate fixed route.

Claude uses the official OpenAI compatibility endpoint for text requests. Its limitations apply; it does not enable native Claude-only features. Claude, Grok, Fireworks and Zo Computer consumer subscription OAuth tokens are not imported or repurposed here. Only published integration methods are offered.

Google API OAuth requires your own Google Cloud project with the Generative Language API enabled and a Desktop OAuth client. Enter its client ID, client secret and project ID in Google API OAuth. Save the client, select Continue with Google, and personally approve the requested API scope. This is Google API authorization, not Gemini app subscription access or Gmail authorization. The implementation requests the documented generative-language.retriever scope, uses PKCE and a browser-bound one-time loopback callback, encrypts credentials, refreshes access on the server and supports revocation. Catalog discovery and explicit connection tests are available. The Google OAuth route does not replace existing worker or agent defaults. Google project configuration and live consent remain required; no account has been authorized automatically.

Ollama Cloud is available through its cloud API key. Alternatively install Ollama and personally run `ollama signin`; use Ollama Local with a cloud model tag. Cloud tags execute remotely despite the loopback API connection. Local Ollama is not installed by this change.

Zo Computer remains in the domain-specific cloud connections, with separate Business and Trading tokens and reviewed jobs. Obtain its token from Settings > Advanced, save the connection and load its live model catalog. A saved model selection is pinned into the approved job and sent as model_name; otherwise Zo uses its default. Zo access tokens grant full workspace access. The similarly named zo.app is a different API and is not used.

Official references:
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk
- https://docs.x.ai/developers/quickstart
- https://ai.google.dev/gemini-api/docs/oauth
- https://ai.google.dev/gemini-api/docs/openai
- https://docs.fireworks.ai/tools-sdks/openai-compatibility
- https://docs.ollama.com/api/authentication
- https://www.zo.computer/guide/api
