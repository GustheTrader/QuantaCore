import csv
from datetime import date, datetime, timezone
import hashlib
import io
import json
import math
from pathlib import Path
import re
import threading
from uuid import uuid4


ESSENTIAL_TOOLS = {"get_stock_data", "get_verified_market_snapshot"}


def json_safe(value):
    if hasattr(value, "to_dict") and hasattr(value, "columns"):
        value = value.reset_index().to_dict(orient="records")
    elif hasattr(value, "to_dict") and hasattr(value, "index"):
        value = [{"date": str(key), "close": number} for key, number in value.items()]
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, (str, bool, int, float)) or value is None:
        return value
    if hasattr(value, "item"):
        return json_safe(value.item())
    return str(value)


def numeric(value):
    try:
        parsed = float(value)
        return parsed if math.isfinite(parsed) and parsed > 0 else None
    except (TypeError, ValueError):
        return None


class EvidenceRecorder:
    def __init__(self, directory, as_of, artifact_prefix="", expected_symbol=None):
        self.directory = Path(directory)
        self.as_of = as_of
        self.artifact_prefix = artifact_prefix
        self.expected_symbol = expected_symbol
        self.items = []
        self.warnings = []
        self.latest_price = None
        self.current_node = None
        self._lock = threading.RLock()

    @property
    def price_ready(self):
        return self.latest_price is not None

    def warn(self, message):
        with self._lock:
            if message not in self.warnings:
                self.warnings.append(message)

    def capture(self, tool, node_id, vendor, query, raw, *, error=None, status=None):
        with self._lock:
            identifier = str(uuid4())
            source = "rendered_text" if isinstance(raw, str) else "structured"
            raw_value = json_safe(raw)
            text = raw if isinstance(raw, str) else json.dumps(raw_value, ensure_ascii=False)
            if status is None:
                status = "error" if error else "success"
                if "NO_DATA_AVAILABLE" in text or (error and "NoMarketData" in error):
                    status = "no_data"
                elif "DATA_UNAVAILABLE" in text or (error and ("VendorRateLimit" in error or "VendorNotConfigured" in error)):
                    status = "unavailable"
            envelope = {
                "id": identifier, "node_id": node_id,
                "tool": tool, "vendor": vendor, "query": json_safe(query),
                "source": source, "raw": raw_value,
                "as_of": self.as_of, "fetched_at": datetime.now(timezone.utc).isoformat(),
                "status": status, "error": error,
            }
            artifact_bytes = json.dumps(envelope, ensure_ascii=False, indent=2, allow_nan=False).encode("utf-8")
            artifact_local = Path("evidence") / f"{identifier}.json"
            destination = self.directory / artifact_local
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(artifact_bytes)
            item = {
                "id": identifier, "tool": tool, "node_id": node_id,
                "vendor": vendor, "status": status, "kind": "observed",
                "query": json_safe(query), "as_of": self.as_of,
                "fetched_at": envelope["fetched_at"],
                "sha256": hashlib.sha256(artifact_bytes).hexdigest(),
                "excerpt": text[:1200],
                "artifact": self.artifact_prefix + artifact_local.as_posix(), "error": error,
            }
            self.items.append(item)
            self.save_index()
            if status != "success":
                self.warn(f"{tool} ({vendor}) returned {status}: {error or text[:300]}")
            self._update_price(tool, status, query, raw_value)
            return item

    def save_index(self):
        with self._lock:
            self.directory.mkdir(parents=True, exist_ok=True)
            temporary = self.directory / "evidence-index.tmp"
            temporary.write_text(json.dumps(self.items, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
            temporary.replace(self.directory / "evidence-index.json")

    def include_prior(self, item, raw):
        with self._lock:
            if not any(existing["id"] == item["id"] for existing in self.items):
                self.items.append(item)
                self._update_price(item["tool"], item["status"], item["query"], raw)
                self.save_index()

    def _update_price(self, tool, status, query, raw_value):
        if tool in ESSENTIAL_TOOLS and status == "success":
            symbol = query.get("symbol", query.get("ticker")) if isinstance(query, dict) else None
            if self.expected_symbol is not None and (not isinstance(symbol, str) or symbol.upper() != self.expected_symbol.upper()):
                self.warn("Price evidence for a missing or different ticker was excluded from the essential price gate.")
                return
            candidate = self._price(raw_value)
            if candidate is not None and (self.latest_price is None or candidate["date"] >= self.latest_price["date"]):
                self.latest_price = candidate

    def _price(self, raw):
        rows = []
        if isinstance(raw, dict):
            if isinstance(raw.get("latest_row"), dict):
                rows = [raw["latest_row"]]
            elif isinstance(raw.get("rows"), list):
                rows = raw["rows"]
            else:
                rows = [raw]
        elif isinstance(raw, list):
            rows = raw
        elif isinstance(raw, str):
            lines = [line for line in raw.splitlines() if line.strip() and not line.lstrip().startswith("#")]
            if lines:
                for start, line in enumerate(lines):
                    if "," in line and re.search(r"\b(?:Date|Datetime|date)\b", line) and re.search(r"\b(?:Close|close)\b", line):
                        rows = list(csv.DictReader(io.StringIO("\n".join(lines[start:]))))
                        break
            if not rows:
                latest = re.search(r"Latest trading row used:\s*(\d{4}-\d{2}-\d{2})", raw)
                close = re.search(r"\|\s*Close\s*\|\s*([\d.]+)\s*\|", raw)
                if latest and close:
                    rows = [{"date": latest.group(1), "close": close.group(1)}]
                elif raw.strip().startswith("{"):
                    try:
                        return self._price(json.loads(raw))
                    except (ValueError, TypeError):
                        pass
        eligible = []
        cutoff = date.fromisoformat(self.as_of)
        for row in rows:
            if not isinstance(row, dict):
                continue
            normalized = {str(key).lower(): value for key, value in row.items()}
            row_date = str(normalized.get("date", normalized.get("datetime", "")))[:10]
            try:
                observed = date.fromisoformat(row_date)
            except ValueError:
                continue
            close = numeric(normalized.get("close"))
            if observed > cutoff:
                self.warn("Essential price output contained rows after the requested analysis date; they were excluded.")
                continue
            if close is None or (cutoff - observed).days > 10:
                continue
            if any(key in normalized and numeric(normalized[key]) is None for key in ("open", "high", "low")):
                continue
            eligible.append({"date": row_date, "close": close})
        return max(eligible, key=lambda row: row["date"]) if eligible else None
