// Generated from contracts/research.schema.json. Run npm run research:types; do not edit.
export type RunStatus = "queued" | "running" | "cancelling" | "cancelled" | "done" | "error" | "review" | "data_insufficient";

export type Models = {
  deep: string;
  quick: string;
};

export type Budget = {
  max_calls: number;
  max_tokens: number;
  max_output_tokens: number;
  max_duration_seconds: number;
  max_cost_usd: number | null;
};

export type Position = {
  ticker: string;
  quantity: number;
  average_price: number | null;
};

export type Portfolio = {
  cash: number | null;
  currency: string | null;
  positions: Array<Position>;
};

export type RunRequest = {
  ticker: string;
  trade_date: string;
  asset_type: "stock";
  models: Models;
  selected_analysts: Array<"market" | "social" | "news" | "fundamentals">;
  debate_rounds: number;
  risk_rounds: number;
  budget: Budget;
  portfolio: Portfolio | null;
  mode: "research" | "evaluation" | "fixture";
  confirmed: true;
};

export type Evidence = {
  id: string;
  tool: string;
  node_id: string | null;
  vendor: string;
  status: "success" | "no_data" | "unavailable" | "error";
  kind: "observed" | "operator_supplied";
  query: Record<string, unknown>;
  as_of: string;
  fetched_at: string;
  sha256: string;
  excerpt: string;
  artifact: string | null;
  error: string | null;
};

export type Decision = {
  rating: "Buy" | "Overweight" | "Hold" | "Underweight" | "Sell" | "REVIEW";
  executive_summary: string;
  investment_thesis: string;
  price_target: number | null;
  time_horizon: string | null;
  entry_price: number | null;
  stop_loss: number | null;
  position_sizing: string | null;
  raw_text: string;
  reports: Record<string, string>;
  evidence: Array<Evidence>;
  warnings: Array<string>;
  data_status: "ready" | "insufficient";
  research_only: true;
  source: "structured" | "rendered_text" | "fixture";
  baseline: Record<string, unknown> | null;
};

export type Usage = {
  calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number | null;
  price_known: boolean;
  estimated: boolean;
};

export type RunError = {
  code: string;
  message: string;
  error_id: string;
};

export type Run = {
  id: string;
  ticker: string;
  trade_date: string;
  status: RunStatus;
  created_at: string;
  updated_at: string;
  configuration_hash: string;
  request: RunRequest;
  batch_id: string | null;
  attempt: number;
  decision: Decision | null;
  error: RunError | null;
  usage: Usage;
  settlement: Record<string, unknown> | null;
  artifact_url: string | null;
};

export type Event = {
  seq: number;
  run_id: string;
  type: string;
  at: string;
  node_id: string | null;
  payload: Record<string, unknown>;
  previous_hash: string;
  hash: string;
};

export type WorkerRequest = {
  attempt: number;
  run_id: string;
  request: RunRequest;
  past_decisions: Array<Record<string, unknown>>;
};

export type WorkerEvent = {
  type: string;
  node_id: string | null;
  payload: Record<string, unknown>;
};

export type BatchRequest = {
  tickers: Array<string>;
  dates: Array<string>;
  template: RunRequest;
};
