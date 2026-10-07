# Shared system setup

Settings and Hybrid Cloud use the same four-step setup screen: choose system, connect intelligence, check readiness, review setup.

## Universal and specific responsibilities

| Shared setup | Adapter-specific setup |
| --- | --- |
| System and purpose | QuantaCore model assignment, Paperclip organization/agent binding, QS backend and market contract |
| Provider selection and model choice | Subscription/browser authentication, API credentials, or a local endpoint |
| Configuration checks and evidence | Each service's health response, permissions and supported capabilities |
| Review and a saved manual setup plan | Actual agent activation or bridge approval |

One credential or model choice is not universal across runtimes. Paperclip's Codex subscription login remains separate from Quanta's account connection. Google sign-in for OpenAI does not grant Gmail access; Gemini API OAuth requires its own Google Cloud client. Local endpoint transport alone does not prove local model execution.

The UI reuses existing provider adapters. The setup plan is stored in browser localStorage without credentials. Only system/purpose selections are restored; readiness must be checked again. Saving a plan does not configure the target runtime or activate it. Backend status, saved model configuration and successful inference remain distinct.

## Next architecture work for review

Before implementing a universal connection registry, approve a server-side contract carrying connection ID, target system, authentication method, capabilities, permissions, model identity, timestamps and verification evidence. Keep secrets in existing protected stores. Runtime adapters should bind that connection explicitly, with revocable scopes and separate tests. Preserve QS execution/risk ownership and the existing cloud-job approval flow.

Current blocker: the full Quanta server previously failed to decrypt protected bootstrap/OAuth credentials. The built UI is a preview and cannot complete server-backed connection actions. Keep credentials intact and resolve decryption under their owning Windows identity; do not treat preview HTML responses as API readiness.
