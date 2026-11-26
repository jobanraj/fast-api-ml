"""Central configuration. Override with environment variables."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = Path(os.getenv("MODEL_DIR", BASE_DIR / "models"))
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "5"))
MAX_BATCH_ROWS = int(os.getenv("MAX_BATCH_ROWS", "10000"))

# Order matters: the models were trained with exactly these columns, in this order.
FEATURE_COLUMNS = [
    "area_sqft",
    "bedrooms",
    "bathrooms",
    "age_years",
    "distance_to_city_km",
    "garage",
]
