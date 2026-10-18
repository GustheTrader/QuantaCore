// Pattern compatibility snapshot from installed Hindsight 0.10.1, 2026-10-13.
// Source: hindsight_api.extensions.memory_defense._REDACTION_PATTERNS.
// Known credential/PII formats only; this is not a complete sensitive-data detector.
const patterns: [string, string][] = [
  [
    "anthropic_key",
    "(?<![A-Za-z0-9_])sk-ant-[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_])"
  ],
  [
    "openai_project_key",
    "(?<![A-Za-z0-9_])sk-proj-[A-Za-z0-9_-]{48,}(?![A-Za-z0-9_])"
  ],
  [
    "openai_admin_key",
    "(?<![A-Za-z0-9_])sk-admin-[A-Za-z0-9_-]{40,}(?![A-Za-z0-9_])"
  ],
  [
    "openai_key",
    "(?<![A-Za-z0-9_])sk-[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_])"
  ],
  [
    "google_api_key",
    "(?<![A-Za-z0-9_])AIza[0-9A-Za-z_-]{35}(?![A-Za-z0-9_])"
  ],
  [
    "google_oauth_token",
    "(?<![A-Za-z0-9_])ya29\\.[0-9A-Za-z_-]{20,}(?![A-Za-z0-9_])"
  ],
  [
    "xai_key",
    "(?<![A-Za-z0-9_])xai-[A-Za-z0-9]{40,}(?![A-Za-z0-9_])"
  ],
  [
    "groq_key",
    "(?<![A-Za-z0-9_])gsk_[A-Za-z0-9]{20,}(?![A-Za-z0-9_])"
  ],
  [
    "hindsight_key",
    "(?<![A-Za-z0-9_])hsk_(?:sys_)?[0-9a-f]{32}(?:_[0-9a-f]{8,})?(?![A-Za-z0-9_])"
  ],
  [
    "huggingface_token",
    "(?<![A-Za-z0-9_])hf_[A-Za-z0-9]{30,}(?![A-Za-z0-9_])"
  ],
  [
    "replicate_token",
    "(?<![A-Za-z0-9_])r8_[A-Za-z0-9]{30,}(?![A-Za-z0-9_])"
  ],
  [
    "perplexity_key",
    "(?<![A-Za-z0-9_])pplx-[A-Za-z0-9]{40,}(?![A-Za-z0-9_])"
  ],
  [
    "databricks_token",
    "(?<![A-Za-z0-9_])dapi[A-Za-z0-9]{32}(?![A-Za-z0-9_])"
  ],
  [
    "aws_access_key",
    "(?<![A-Za-z0-9_])AKIA[0-9A-Z]{16}(?![A-Za-z0-9_])"
  ],
  [
    "aws_session_token",
    "(?<![A-Za-z0-9_])ASIA[0-9A-Z]{16}(?![A-Za-z0-9_])"
  ],
  [
    "aws_secret_key",
    "(?i)aws(.{0,20})?(secret|private)?[\\s_-]?access[\\s_-]?key[\\s_-]?[:=][\\s\\\"']*([A-Za-z0-9/+=]{40})"
  ],
  [
    "digitalocean_token",
    "(?<![A-Za-z0-9_])dop_v1_[a-f0-9]{64}(?![A-Za-z0-9_])"
  ],
  [
    "github_fg_pat",
    "(?<![A-Za-z0-9_])github_pat_[A-Za-z0-9_]{60,}(?![A-Za-z0-9_])"
  ],
  [
    "github_token",
    "(?<![A-Za-z0-9_])ghp_[A-Za-z0-9]{36}(?![A-Za-z0-9_])"
  ],
  [
    "github_app_token",
    "(?<![A-Za-z0-9_])ghs_[A-Za-z0-9]{36}(?![A-Za-z0-9_])"
  ],
  [
    "github_user_token",
    "(?<![A-Za-z0-9_])ghu_[A-Za-z0-9]{36}(?![A-Za-z0-9_])"
  ],
  [
    "github_refresh",
    "(?<![A-Za-z0-9_])ghr_[A-Za-z0-9]{36}(?![A-Za-z0-9_])"
  ],
  [
    "github_oauth",
    "(?<![A-Za-z0-9_])gho_[A-Za-z0-9]{36}(?![A-Za-z0-9_])"
  ],
  [
    "gitlab_pat",
    "(?<![A-Za-z0-9_])glpat-[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_])"
  ],
  [
    "npm_token",
    "(?<![A-Za-z0-9_])npm_[A-Za-z0-9]{30,}(?![A-Za-z0-9_])"
  ],
  [
    "pypi_token",
    "(?<![A-Za-z0-9_])pypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_])"
  ],
  [
    "stripe_secret",
    "(?<![A-Za-z0-9_])sk_(?:live|test)_[A-Za-z0-9]{20,}(?![A-Za-z0-9_])"
  ],
  [
    "stripe_restricted",
    "(?<![A-Za-z0-9_])rk_(?:live|test)_[A-Za-z0-9]{20,}(?![A-Za-z0-9_])"
  ],
  [
    "square_token",
    "(?<![A-Za-z0-9_])sq0[a-z]{3}-[A-Za-z0-9_-]{22,}(?![A-Za-z0-9_])"
  ],
  [
    "braintree_token",
    "(?<![A-Za-z0-9_])access_token\\$production\\$[a-z0-9]{16}\\$[a-f0-9]{32}(?![A-Za-z0-9_])"
  ],
  [
    "slack_token",
    "(?<![A-Za-z0-9_])xox[abpr]-[0-9A-Za-z-]{10,}(?![A-Za-z0-9_])"
  ],
  [
    "slack_webhook",
    "https://hooks\\.slack\\.com/services/T[A-Za-z0-9_]{8,}/B[A-Za-z0-9_]{8,}/[A-Za-z0-9_]{20,}"
  ],
  [
    "twilio_api_key",
    "(?<![A-Za-z0-9_])SK[0-9a-fA-F]{32}(?![A-Za-z0-9_])"
  ],
  [
    "twilio_account_sid",
    "(?<![A-Za-z0-9_])AC[0-9a-fA-F]{32}(?![A-Za-z0-9_])"
  ],
  [
    "sendgrid_key",
    "(?<![A-Za-z0-9_])SG\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]{43}(?![A-Za-z0-9_])"
  ],
  [
    "mailgun_key",
    "(?<![A-Za-z0-9_])key-[A-Za-z0-9]{32}(?![A-Za-z0-9_])"
  ],
  [
    "discord_bot",
    "(?<![A-Za-z0-9_])[MNO][A-Za-z0-9]{23}\\.[A-Za-z0-9_-]{6}\\.[A-Za-z0-9_-]{27}(?![A-Za-z0-9_])"
  ],
  [
    "telegram_bot",
    "(?<![A-Za-z0-9_])[0-9]{8,10}:[A-Za-z0-9_-]{35}(?![A-Za-z0-9_])"
  ],
  [
    "shopify_token",
    "(?<![A-Za-z0-9_])shpat_[a-fA-F0-9]{32}(?![A-Za-z0-9_])"
  ],
  [
    "db_url_postgres",
    "postgres(?:ql)?://[^\\s:/@]+:[^\\s/@]+@[^\\s]+"
  ],
  [
    "db_url_mysql",
    "mysql://[^\\s:/@]+:[^\\s/@]+@[^\\s]+"
  ],
  [
    "db_url_mongodb",
    "mongodb(?:\\+srv)?://[^\\s:/@]+:[^\\s/@]+@[^\\s]+"
  ],
  [
    "private_key_pem",
    "-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY( BLOCK)?-----"
  ],
  [
    "jwt",
    "(?<![A-Za-z0-9_])eyJ[A-Za-z0-9_-]{10,}\\.eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}(?![A-Za-z0-9_])"
  ],
  [
    "credit_card",
    "(?<![A-Za-z0-9_])(?<!\\d)(?<!\\d\\.)(?:\\d{4}[ -]?){3}\\d{1,4}(?!\\d)(?!\\.\\d)(?![A-Za-z0-9_])"
  ],
  [
    "ssn_us",
    "(?<![A-Za-z0-9_])\\d{3}-\\d{2}-\\d{4}(?![A-Za-z0-9_])"
  ]
];
patterns.unshift(...[["firecrawl_key","(?<![A-Za-z0-9_-])fc-[a-fA-F0-9]{32}(?![A-Za-z0-9_-])"],["supabase_management_token","(?<![A-Za-z0-9_-])sbp_[A-Za-z0-9_-]{32,}(?![A-Za-z0-9_-])"],["supabase_secret_key","(?<![A-Za-z0-9_-])sb_secret_[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_-])"],["generic_credential_assignment","(?i)\\b(?:[A-Z0-9_]*API_KEY|[A-Z0-9_]*ACCESS_TOKEN|[A-Z0-9_]*SECRET|PASSWORD)\\s*[:=]\\s*[\"\\']?[^\\s\"\\']{12,}"]] as [string, string][]);
const compiled = patterns.map(([type, expression]) => {
  let flags = 'g';
  const source = expression.replace(/\(\?([is]+)\)/g, (_, inline) => { for (const flag of inline) if (!flags.includes(flag)) flags += flag; return ''; });
  return { type, expression: new RegExp(source, flags) };
});
function validCard(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19 || /^0+$/.test(digits)) return false;
  let sum = 0, double = false;
  for (let i = digits.length - 1; i >= 0; i--) { let n = Number(digits[i]); if (double) { n *= 2; if (n > 9) n -= 9; } sum += n; double = !double; }
  return sum % 10 === 0;
}
export const memoryPatternCount = patterns.length;
export function screenMemory(input: string, action: 'redact' | 'block') {
  const matchedTypes = new Set<string>();
  let text = input;
  for (const pattern of compiled) {
    pattern.expression.lastIndex = 0;
    text = text.replace(pattern.expression, value => {
      if (pattern.type === 'credit_card' && !validCard(value)) return value;
      matchedTypes.add(pattern.type); return '[REDACTED:' + pattern.type + ']';
    });
  }
  return { text, matchedTypes: [...matchedTypes], blocked: action === 'block' && matchedTypes.size > 0 };
}
