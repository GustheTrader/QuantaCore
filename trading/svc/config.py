from dataclasses import dataclass
import os
from pathlib import Path
from urllib.parse import urlparse


ENGINE_COMMIT = "35543d0248bf89fcb92b17a15858ad0c0e940687"
NAME = "Gnoesis Agenic Research"


@dataclass
class Settings:
    service_token: str = ""
    gateway_token: str = ""
    gateway_url: str = "http://127.0.0.1:3000/v1"
    sidecar_url: str = "http://127.0.0.1:8788"
    data_dir: Path = Path("C:/QuantaCore/data/trading")
    test_mode: bool = False
    owner_pid: int | None = None

    def __post_init__(self):
        self.data_dir = Path(self.data_dir).resolve()
        for address in (self.gateway_url, self.sidecar_url):
            parsed = urlparse(address)
            if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
                raise ValueError("Worker gateway and sidecar URLs must be local HTTP addresses")
            if parsed.username or parsed.password or parsed.query or parsed.fragment:
                raise ValueError("Local service URLs cannot contain credentials, queries, or fragments")
        self.gateway_url = self.gateway_url.rstrip("/")
        self.sidecar_url = self.sidecar_url.rstrip("/")

    @classmethod
    def from_env(cls):
        return cls(
            service_token=os.getenv("GNOESIS_SERVICE_TOKEN", ""),
            gateway_token=os.getenv("GNOESIS_GATEWAY_TOKEN", ""),
            gateway_url=os.getenv("GNOESIS_GATEWAY_URL", "http://127.0.0.1:3000/v1"),
            sidecar_url=os.getenv("GNOESIS_SIDECAR_URL", "http://127.0.0.1:8788"),
            data_dir=Path(os.getenv("GNOESIS_DATA_DIR", "C:/QuantaCore/data/trading")),
            test_mode=os.getenv("GNOESIS_TEST_MODE", "0") == "1",
            owner_pid=int(os.getenv("GNOESIS_OWNER_PID")) if os.getenv("GNOESIS_OWNER_PID") else None,
        )
