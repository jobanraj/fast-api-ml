"""Pydantic models = request validation + response documentation (shown in /docs)."""
from pydantic import BaseModel, ConfigDict, Field


class HouseFeatures(BaseModel):
    area_sqft: float = Field(..., gt=200, le=20000, description="Living area in square feet")
    bedrooms: int = Field(..., ge=0, le=10)
    bathrooms: float = Field(..., ge=0.5, le=10)
    age_years: int = Field(..., ge=0, le=150, description="Age of the house in years")
    distance_to_city_km: float = Field(..., ge=0, le=200)
    garage: bool = Field(False, description="Has a garage")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "area_sqft": 1800,
                "bedrooms": 3,
                "bathrooms": 2,
                "age_years": 12,
                "distance_to_city_km": 8.5,
                "garage": True,
            }
        }
    )


class PricePrediction(BaseModel):
    predicted_price: float = Field(..., description="Estimated price in USD")
    model_version: str


class CategoryPrediction(BaseModel):
    category: str = Field(..., description="'premium' or 'standard'")
    probability_premium: float = Field(..., ge=0, le=1)
    model_version: str


class ModelInfo(BaseModel):
    name: str
    task: str
    version: str
    metrics: dict
    features: list[str]


class BatchPredictionResponse(BaseModel):
    task: str
    rows: int
    predictions: list[dict]
