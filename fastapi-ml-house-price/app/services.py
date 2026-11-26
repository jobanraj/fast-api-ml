"""Prediction logic, separated from HTTP so it is easy to test."""
import io

import pandas as pd

from app.config import FEATURE_COLUMNS, MAX_BATCH_ROWS, MAX_UPLOAD_MB
from app.errors import BadUploadError
from app.model_registry import registry
from app.schemas import HouseFeatures

REG_MODEL, CLF_MODEL = "house_price_regressor", "house_category_classifier"


def _frame_from_features(items: list[HouseFeatures]) -> pd.DataFrame:
    rows = [{**i.model_dump(), "garage": int(i.garage)} for i in items]
    return pd.DataFrame(rows)[FEATURE_COLUMNS]


def predict_price(features: HouseFeatures) -> tuple[float, str]:
    m = registry.get(REG_MODEL)
    value = float(m.estimator.predict(_frame_from_features([features]))[0])
    return round(max(value, 0.0), 2), m.version


def predict_category(features: HouseFeatures) -> tuple[str, float, str]:
    m = registry.get(CLF_MODEL)
    proba = float(m.estimator.predict_proba(_frame_from_features([features]))[0][1])
    return ("premium" if proba >= 0.5 else "standard"), round(proba, 4), m.version


def parse_csv(raw: bytes, filename: str | None) -> pd.DataFrame:
    """Validate and clean an uploaded CSV. Raises BadUploadError with a clear message."""
    if not filename or not filename.lower().endswith(".csv"):
        raise BadUploadError("Upload must be a .csv file", 415)
    if len(raw) > MAX_UPLOAD_MB * 1024 * 1024:
        raise BadUploadError(f"File larger than {MAX_UPLOAD_MB} MB", 413)
    if not raw.strip():
        raise BadUploadError("File is empty")
    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as exc:  # malformed CSV
        raise BadUploadError(f"Could not parse CSV: {exc}") from exc
    df.columns = [str(c).strip().lower() for c in df.columns]
    missing = [c for c in FEATURE_COLUMNS if c not in df.columns]
    if missing:
        raise BadUploadError(f"Missing required columns: {missing}")
    if len(df) == 0:
        raise BadUploadError("CSV has no data rows")
    if len(df) > MAX_BATCH_ROWS:
        raise BadUploadError(f"Too many rows (max {MAX_BATCH_ROWS})", 413)
    df = df[FEATURE_COLUMNS].copy()
    df["garage"] = df["garage"].map(
        lambda v: 1 if str(v).strip().lower() in {"1", "true", "yes", "y"} else 0
    )
    for col in FEATURE_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    bad_rows = df[df.isna().any(axis=1)].index.tolist()
    if bad_rows:
        shown = [i + 2 for i in bad_rows[:10]]  # +2: header line + 1-based
        raise BadUploadError(f"Non-numeric or empty values on CSV lines {shown}")
    return df


def batch_predict(df: pd.DataFrame, task: str) -> pd.DataFrame:
    out = df.copy()
    if task == "price":
        m = registry.get(REG_MODEL)
        out["predicted_price"] = m.estimator.predict(df).round(2).clip(min=0)
    else:
        m = registry.get(CLF_MODEL)
        proba = m.estimator.predict_proba(df)[:, 1]
        out["probability_premium"] = proba.round(4)
        out["category"] = ["premium" if p >= 0.5 else "standard" for p in proba]
    return out
