.PHONY: install train run test docker
install:
	pip install -r requirements-dev.txt
train:
	python -m training.train
run:
	uvicorn app.main:app --reload
test:
	pytest -q
docker:
	docker build -t house-price-api . && docker run -p 8000:8000 house-price-api
