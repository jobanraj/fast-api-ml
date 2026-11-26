import io
import logging
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, File, Path, Query, UploadFile
from fastapi.responses import StreamingResponse

from app import services
from app.config import MAX_UPLOAD_MB
from app.errors import register_error_handlers
from app.model_registry import registry
from app.schemas import (BatchPredictionResponse, CategoryPrediction, HouseFeatures,
                         ModelInfo, PricePrediction)

logging.basicConfig(level=logging.INFO)


def _info(m) -> ModelInfo:
    return ModelInfo(name=m.name, task=m.task, version=m.version, metrics=m.metrics, features=m.features)


@asynccontextmanager
async def lifespan(_: FastAPI):
    registry.load_all()          # runs once when the server starts
    yield                        # the app serves requests here


app = FastAPI(
    title="House Price ML API",
    description="Serve scikit-learn models (regression + classification) through FastAPI.",
    version="1.0.0",
    lifespan=lifespan,
)
register_error_handlers(app)


# ---------- basics: GET, path & query parameters ----------
@app.get("/", tags=["basics"])
def root():
    return {"service": "House Price ML API", "docs": "/docs", "models_loaded": len(registry)}


@app.get("/health", tags=["basics"])
def health():
    return {"status": "ok" if len(registry) else "degraded", "models_loaded": len(registry)}


@app.get("/models", response_model=list[ModelInfo], tags=["models"])
def list_models():
    return [_info(m) for m in registry.all()]


@app.get("/models/{model_name}", response_model=ModelInfo, tags=["models"])
def get_model(model_name: str = Path(..., description="e.g. house_price_regressor")):
    return _info(registry.get(model_name))      # path parameter


# ---------- single predictions: POST + Pydantic body ----------
@app.post("/predict/price", response_model=PricePrediction, tags=["predict"])
def predict_price(features: HouseFeatures):
    price, version = services.predict_price(features)
    return PricePrediction(predicted_price=price, model_version=version)


@app.post("/predict/category", response_model=CategoryPrediction, tags=["predict"])
def predict_category(features: HouseFeatures):
    category, proba, version = services.predict_category(features)
    return CategoryPrediction(category=category, probability_premium=proba, model_version=version)


# ---------- file upload: batch predictions ----------
@app.post("/predict/batch", response_model=BatchPredictionResponse, tags=["predict"],
          responses={200: {"content": {"text/csv": {}}}})
async def predict_batch(
    file: UploadFile = File(..., description=f"CSV file, max {MAX_UPLOAD_MB} MB"),
    task: Literal["price", "category"] = Query("price", description="Which model to run"),
    output: Literal["json", "csv"] = Query("json", description="Response format"),
):
    raw = await file.read()
    df = services.parse_csv(raw, file.filename)
    result = services.batch_predict(df, task)
    if output == "csv":
        buf = io.StringIO()
        result.to_csv(buf, index=False)
        return StreamingResponse(
            iter([buf.getvalue()]), media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="predictions_{task}.csv"'},
        )
    return BatchPredictionResponse(task=task, rows=len(result), predictions=result.to_dict(orient="records"))
