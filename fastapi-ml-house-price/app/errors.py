"""Custom exceptions + handlers so every error has the same JSON shape."""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ModelNotLoadedError(Exception):
    """Raised when a model file is missing (service is up, model is not)."""


class BadUploadError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message, self.status_code = message, status_code


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ModelNotLoadedError)
    async def model_not_loaded(_: Request, exc: ModelNotLoadedError):
        return JSONResponse(status_code=503, content={"error": "model_unavailable", "detail": str(exc)})

    @app.exception_handler(BadUploadError)
    async def bad_upload(_: Request, exc: BadUploadError):
        return JSONResponse(status_code=exc.status_code, content={"error": "bad_upload", "detail": exc.message})

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        # Friendlier than FastAPI's default: field path + message only.
        problems = [
            {"field": ".".join(str(p) for p in e["loc"] if p not in ("body", "query")), "message": e["msg"]}
            for e in exc.errors()
        ]
        return JSONResponse(status_code=422, content={"error": "validation_error", "detail": problems})
