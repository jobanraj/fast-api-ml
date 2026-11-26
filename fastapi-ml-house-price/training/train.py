"""Train the regression + classification models and save them to ./models.

Usage:  python -m training.train

Uses a reproducible synthetic housing dataset so the project works offline.
To use real data, replace `make_dataset()` with your own loader (keep FEATURE_COLUMNS).
"""
import json
from datetime import date
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.config import FEATURE_COLUMNS

OUT = Path(__file__).resolve().parent.parent / "models"
DATA = Path(__file__).resolve().parent.parent / "data"
VERSION = date.today().strftime("%Y.%m.%d")


def make_dataset(n: int = 5000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    area = rng.normal(1900, 650, n).clip(450, 6000)
    bedrooms = np.clip((area / 650 + rng.normal(0, 0.8, n)).round(), 1, 8).astype(int)
    bathrooms = np.clip((bedrooms * 0.6 + rng.normal(0.4, 0.5, n)).round(1), 1, 7)
    age = rng.integers(0, 80, n)
    dist = rng.gamma(2.2, 5.0, n).clip(0.5, 60)
    garage = rng.random(n) < 0.6
    price = (
        45_000 + 155 * area + 9_000 * bedrooms + 14_000 * bathrooms
        - 1_100 * age - 3_800 * dist + 18_000 * garage
        + rng.normal(0, 16_000, n)
    ).clip(40_000, None)
    return pd.DataFrame({
        "area_sqft": area.round(1), "bedrooms": bedrooms, "bathrooms": bathrooms,
        "age_years": age, "distance_to_city_km": dist.round(2), "garage": garage.astype(int),
        "price": price.round(2),
    })


def save(name, task, estimator, metrics):
    OUT.mkdir(exist_ok=True)
    joblib.dump(estimator, OUT / f"{name}.joblib")
    meta = {"name": name, "task": task, "version": VERSION, "metrics": metrics, "features": FEATURE_COLUMNS}
    (OUT / f"{name}.json").write_text(json.dumps(meta, indent=2))
    print(f"saved {name}: {metrics}")


def main():
    df = make_dataset()
    DATA.mkdir(exist_ok=True)
    df.head(200).to_csv(DATA / "training_sample.csv", index=False)
    X, y = df[FEATURE_COLUMNS], df["price"]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)

    # 1) Regression: predict price
    reg = Pipeline([("scale", StandardScaler()),
                    ("model", GradientBoostingRegressor(n_estimators=300, max_depth=3, random_state=42))])
    reg.fit(X_tr, y_tr)
    pred = reg.predict(X_te)
    save("house_price_regressor", "regression", reg,
         {"r2": round(r2_score(y_te, pred), 4), "mae": round(mean_absolute_error(y_te, pred), 2)})

    # 2) Classification: premium (top 30% priced) vs standard
    threshold = y.quantile(0.7)
    y_cls = (y >= threshold).astype(int)
    Xc_tr, Xc_te, yc_tr, yc_te = train_test_split(X, y_cls, test_size=0.2, random_state=42, stratify=y_cls)
    clf = Pipeline([("scale", StandardScaler()),
                    ("model", RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1))])
    clf.fit(Xc_tr, yc_tr)
    cp = clf.predict(Xc_te)
    save("house_category_classifier", "classification", clf,
         {"accuracy": round(accuracy_score(yc_te, cp), 4), "f1": round(f1_score(yc_te, cp), 4),
          "premium_price_threshold": round(float(threshold), 2)})


if __name__ == "__main__":
    main()
