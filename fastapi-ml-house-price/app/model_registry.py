"""Load models ONCE at startup and keep them in memory (never per request)."""
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path

import joblib

from app.config import MODEL_DIR
from app.errors import ModelNotLoadedError

log = logging.getLogger("model_registry")


@dataclass
class LoadedModel:
    name: str
    task: str
    version: str
    estimator: object
    metrics: dict = field(default_factory=dict)
    features: list = field(default_factory=list)


class ModelRegistry:
    def __init__(self) -> None:
        self._models: dict[str, LoadedModel] = {}

    def load_all(self, model_dir: Path | None = None) -> None:
        model_dir = Path(model_dir or MODEL_DIR)
        self._models.clear()
        for meta_path in sorted(model_dir.glob("*.json")):
            meta = json.loads(meta_path.read_text())
            model_path = meta_path.with_suffix(".joblib")
            if not model_path.exists():
                log.warning("metadata %s has no model file", meta_path.name)
                continue
            self._models[meta["name"]] = LoadedModel(
                name=meta["name"], task=meta["task"], version=meta["version"],
                estimator=joblib.load(model_path), metrics=meta.get("metrics", {}),
                features=meta.get("features", []),
            )
            log.info("loaded model %s v%s", meta["name"], meta["version"])

    def get(self, name: str) -> LoadedModel:
        try:
            return self._models[name]
        except KeyError:
            raise ModelNotLoadedError(
                f"Model '{name}' is not loaded. Run `python -m training.train` first."
            ) from None

    def all(self) -> list[LoadedModel]:
        return list(self._models.values())

    def clear(self) -> None:
        self._models.clear()

    def __len__(self) -> int:
        return len(self._models)


registry = ModelRegistry()
