import io

import pytest
from fastapi.testclient import TestClient

from app.main import app

GOOD = {"area_sqft": 1800, "bedrooms": 3, "bathrooms": 2, "age_years": 12,
        "distance_to_city_km": 8.5, "garage": True}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:      # `with` triggers the lifespan -> models load
        yield c


def test_root_and_health(client):
    assert client.get("/").json()["models_loaded"] == 2
    assert client.get("/health").json()["status"] == "ok"


def test_models_endpoints(client):
    names = {m["name"] for m in client.get("/models").json()}
    assert names == {"house_price_regressor", "house_category_classifier"}
    r = client.get("/models/house_price_regressor")
    assert r.status_code == 200 and r.json()["task"] == "regression"


def test_unknown_model_returns_503(client):
    r = client.get("/models/nope")
    assert r.status_code == 503 and r.json()["error"] == "model_unavailable"


def test_predict_price_is_sensible(client):
    r = client.post("/predict/price", json=GOOD)
    assert r.status_code == 200
    assert 150_000 < r.json()["predicted_price"] < 700_000


def test_bigger_house_costs_more(client):
    small = client.post("/predict/price", json={**GOOD, "area_sqft": 900}).json()["predicted_price"]
    big = client.post("/predict/price", json={**GOOD, "area_sqft": 3500}).json()["predicted_price"]
    assert big > small


def test_predict_category(client):
    cheap = client.post("/predict/category", json={**GOOD, "area_sqft": 700, "bedrooms": 1,
                                                    "bathrooms": 1, "age_years": 60}).json()
    rich = client.post("/predict/category", json={**GOOD, "area_sqft": 4200, "bedrooms": 5,
                                                   "bathrooms": 4, "age_years": 1}).json()
    assert cheap["category"] == "standard" and rich["category"] == "premium"
    assert 0 <= rich["probability_premium"] <= 1


@pytest.mark.parametrize("bad", [
    {**GOOD, "area_sqft": -5},
    {**GOOD, "bedrooms": 99},
    {**GOOD, "bathrooms": "many"},
])
def test_validation_errors_are_422(client, bad):
    r = client.post("/predict/price", json=bad)
    assert r.status_code == 422
    body = r.json()
    assert body["error"] == "validation_error" and body["detail"][0]["field"]


def test_missing_field_is_422(client):
    payload = {k: v for k, v in GOOD.items() if k != "area_sqft"}
    r = client.post("/predict/price", json=payload)
    assert r.status_code == 422 and r.json()["detail"][0]["field"] == "area_sqft"


CSV = ("area_sqft,bedrooms,bathrooms,age_years,distance_to_city_km,garage\n"
       "1200,2,1.5,25,12.0,0\n2600,4,3,5,4.2,yes\n")


def _upload(client, content, name="houses.csv", **params):
    return client.post("/predict/batch", params=params,
                       files={"file": (name, io.BytesIO(content.encode()), "text/csv")})


def test_batch_price_json(client):
    r = _upload(client, CSV, task="price")
    body = r.json()
    assert r.status_code == 200 and body["rows"] == 2
    assert body["predictions"][1]["predicted_price"] > body["predictions"][0]["predicted_price"]


def test_batch_category_csv_output(client):
    r = _upload(client, CSV, task="category", output="csv")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    assert "category" in r.text.splitlines()[0]


def test_batch_rejects_non_csv(client):
    assert _upload(client, CSV, name="houses.txt").status_code == 415


def test_batch_missing_columns(client):
    r = _upload(client, "area_sqft,bedrooms\n1000,2\n")
    assert r.status_code == 400 and "Missing required columns" in r.json()["detail"]


def test_batch_bad_values_report_line_numbers(client):
    bad = CSV + "abc,2,1,3,4,1\n"
    r = _upload(client, bad)
    assert r.status_code == 400 and "[4]" in r.json()["detail"]


def test_batch_invalid_task_is_422(client):
    assert _upload(client, CSV, task="banana").status_code == 422
