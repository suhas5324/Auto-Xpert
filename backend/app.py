from __future__ import annotations

import io
import logging
import os
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
from typing import Any

import requests
import timm
import torch
import torchvision.transforms as transforms
import uvicorn
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
from ultralytics import YOLO

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO").upper())
LOGGER = logging.getLogger("car_damage_backend")

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
)
SEVERITY_CLASSES = ["mild", "moderate", "severe"]
TYPE_CLASSES = ["Dent", "Scratch", "Crack", "glass shatter", "lamp broken", "tire flat"]
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
service_cache: dict[str, dict[str, Any]] = {}


@dataclass(frozen=True)
class Settings:
    device: str
    severity_model_path: Path
    severity_model_url: str | None
    type_model_path: Path
    type_model_url: str | None
    yolo_model_path: Path
    yolo_model_url: str | None
    cors_allow_origins: list[str]
    overpass_endpoints: tuple[str, ...]
    osm_user_agent: str
    request_timeout_seconds: int
    cache_ttl_seconds: int


@dataclass
class ModelBundle:
    yolo_model: YOLO
    severity_model: torch.nn.Module
    type_model: torch.nn.Module
    transform: transforms.Compose


def parse_csv_env(raw_value: str | None, default_values: tuple[str, ...] | list[str]) -> list[str]:
    if not raw_value:
        return list(default_values)

    values = [item.strip() for item in raw_value.split(",") if item.strip()]
    return values or list(default_values)


def resolve_path(raw_value: str | None, default_relative_path: str) -> Path:
    if raw_value:
        candidate = Path(raw_value)
        if not candidate.is_absolute():
            candidate = BASE_DIR / candidate
        return candidate.resolve()

    return (BASE_DIR / default_relative_path).resolve()


def load_settings() -> Settings:
    return Settings(
        device=DEVICE,
        severity_model_path=resolve_path(os.getenv("SEVERITY_MODEL_PATH"), "convnextb_finetuned.pth"),
        severity_model_url=os.getenv("SEVERITY_MODEL_URL"),
        type_model_path=resolve_path(
            os.getenv("TYPE_MODEL_PATH"),
            "mobilenetv3_large_100_type_best.pth",
        ),
        type_model_url=os.getenv("TYPE_MODEL_URL"),
        yolo_model_path=resolve_path(
            os.getenv("YOLO_MODEL_PATH"),
            "runs/detect/train2/weights/best.pt",
        ),
        yolo_model_url=os.getenv("YOLO_MODEL_URL"),
        cors_allow_origins=parse_csv_env(os.getenv("CORS_ALLOW_ORIGINS"), ("*",)),
        overpass_endpoints=tuple(
            parse_csv_env(os.getenv("OVERPASS_ENDPOINTS"), DEFAULT_OVERPASS_ENDPOINTS)
        ),
        osm_user_agent=os.getenv("OSM_USER_AGENT", "car-damage-backend/1.0"),
        request_timeout_seconds=int(os.getenv("REQUEST_TIMEOUT_SECONDS", "25")),
        cache_ttl_seconds=int(os.getenv("CACHE_TTL_SECONDS", "300")),
    )


SETTINGS = load_settings()


def ensure_model_file(model_path: Path, download_url: str | None, timeout_seconds: int) -> None:
    if model_path.exists():
        return

    if not download_url:
        raise FileNotFoundError(
            f"Model file not found: {model_path}. "
            "Set the matching *_MODEL_PATH or *_MODEL_URL environment variable."
        )

    LOGGER.info("Downloading model to %s", model_path)
    model_path.parent.mkdir(parents=True, exist_ok=True)

    with requests.get(download_url, stream=True, timeout=max(timeout_seconds, 120)) as response:
        response.raise_for_status()
        with model_path.open("wb") as output_file:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    output_file.write(chunk)


def load_state_dict(model_path: Path, device: str) -> dict[str, Any]:
    checkpoint = torch.load(model_path, map_location=device)

    if isinstance(checkpoint, dict) and "state_dict" in checkpoint:
        checkpoint = checkpoint["state_dict"]

    if not isinstance(checkpoint, dict):
        raise ValueError(f"Unsupported checkpoint format for {model_path}")

    return {key.removeprefix("module."): value for key, value in checkpoint.items()}


def build_transform() -> transforms.Compose:
    return transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ]
    )


def build_model_bundle(settings: Settings) -> ModelBundle:
    ensure_model_file(
        settings.severity_model_path,
        settings.severity_model_url,
        settings.request_timeout_seconds,
    )
    ensure_model_file(
        settings.type_model_path,
        settings.type_model_url,
        settings.request_timeout_seconds,
    )
    ensure_model_file(
        settings.yolo_model_path,
        settings.yolo_model_url,
        settings.request_timeout_seconds,
    )

    LOGGER.info("Loading YOLO model from %s", settings.yolo_model_path)
    yolo_model = YOLO(str(settings.yolo_model_path))
    yolo_model.to(settings.device)
    yolo_model.model.eval()

    LOGGER.info("Loading severity model from %s", settings.severity_model_path)
    severity_model = timm.create_model(
        "convnext_base",
        pretrained=False,
        num_classes=len(SEVERITY_CLASSES),
    )
    severity_model.load_state_dict(load_state_dict(settings.severity_model_path, settings.device))
    severity_model.to(settings.device)
    severity_model.eval()

    LOGGER.info("Loading damage-type model from %s", settings.type_model_path)
    type_model = timm.create_model(
        "mobilenetv3_large_100",
        pretrained=False,
        num_classes=len(TYPE_CLASSES),
    )
    type_model.load_state_dict(load_state_dict(settings.type_model_path, settings.device))
    type_model.to(settings.device)
    type_model.eval()

    return ModelBundle(
        yolo_model=yolo_model,
        severity_model=severity_model,
        type_model=type_model,
        transform=build_transform(),
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.settings = SETTINGS
    app.state.models = build_model_bundle(SETTINGS)
    LOGGER.info("Backend startup complete on device=%s", SETTINGS.device)
    try:
        yield
    finally:
        service_cache.clear()


app = FastAPI(
    title="Car Damage Backend API",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=SETTINGS.cors_allow_origins,
    allow_headers=["*"],
    allow_methods=["*"],
)


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_model_bundle(request: Request) -> ModelBundle:
    models = getattr(request.app.state, "models", None)
    if models is None:
        raise HTTPException(status_code=503, detail="Models are not ready yet.")
    return models


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371
    delta_lat = radians(lat2 - lat1)
    delta_lon = radians(lon2 - lon1)
    a_value = (
        sin(delta_lat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(delta_lon / 2) ** 2
    )
    c_value = 2 * asin(sqrt(a_value))
    return radius_km * c_value


def decode_polyline_value(encoded: str, index: int) -> tuple[int, int]:
    result = 0
    shift = 0

    while True:
        current = ord(encoded[index]) - 63
        index += 1
        result |= (current & 0x1F) << shift
        shift += 5
        if current < 0x20:
            break

    value = ~(result >> 1) if result & 1 else result >> 1
    return value, index


def decode_polyline(encoded: str) -> list[list[float]]:
    coordinates: list[list[float]] = []
    index = 0
    latitude = 0
    longitude = 0

    while index < len(encoded):
        latitude_delta, index = decode_polyline_value(encoded, index)
        longitude_delta, index = decode_polyline_value(encoded, index)
        latitude += latitude_delta
        longitude += longitude_delta
        coordinates.append([latitude / 1e5, longitude / 1e5])

    return coordinates


def request_json(
    method: str,
    url: str,
    settings: Settings,
    **kwargs: Any,
) -> dict[str, Any]:
    headers = kwargs.pop("headers", {})
    headers.setdefault("User-Agent", settings.osm_user_agent)

    try:
        response = requests.request(
            method,
            url,
            headers=headers,
            timeout=settings.request_timeout_seconds,
            **kwargs,
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Invalid JSON response from upstream service.") from exc


def get_yolo_class_name(yolo_model: YOLO, class_index: int) -> str:
    names = yolo_model.names

    if isinstance(names, dict):
        return str(names.get(class_index, class_index))

    if isinstance(names, list) and 0 <= class_index < len(names):
        return str(names[class_index])

    return str(class_index)


@app.get("/")
def root(request: Request) -> dict[str, Any]:
    settings = get_settings(request)
    return {
        "message": "Car damage backend is running.",
        "docs": "/docs",
        "health": "/health",
        "device": settings.device,
    }


@app.get("/health")
def health(request: Request) -> dict[str, Any]:
    settings = get_settings(request)
    return {
        "status": "ok",
        "device": settings.device,
        "models_loaded": getattr(request.app.state, "models", None) is not None,
    }


@app.post("/predict")
async def predict(request: Request, file: UploadFile = File(...)) -> dict[str, Any]:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload a valid image file.")

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        image = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=400, detail="Unable to read the uploaded image.") from exc

    models = get_model_bundle(request)
    detection_result = models.yolo_model(image, verbose=False)[0]

    predictions = []
    with torch.inference_mode():
        for box in detection_result.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            if x2 <= x1 or y2 <= y1:
                continue

            crop = image.crop((x1, y1, x2, y2))
            crop_tensor = models.transform(crop).unsqueeze(0).to(SETTINGS.device)

            severity_index = int(models.severity_model(crop_tensor).argmax(dim=1).item())
            type_index = int(models.type_model(crop_tensor).argmax(dim=1).item())
            class_index = int(box.cls.item())

            predictions.append(
                {
                    "part": get_yolo_class_name(models.yolo_model, class_index),
                    "severity": SEVERITY_CLASSES[severity_index],
                    "damage_type": TYPE_CLASSES[type_index],
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                }
            )

    return {"predictions": predictions, "count": len(predictions)}


@app.get("/api/nearest-centres")
def nearest_centres(
    request: Request,
    lat: float,
    lon: float,
    radius: int = 5000,
) -> dict[str, Any]:
    settings = get_settings(request)
    cache_key = f"{lat:.4f}:{lon:.4f}:{radius}"
    cached_value = service_cache.get(cache_key)

    if cached_value and time.time() - cached_value["timestamp"] < settings.cache_ttl_seconds:
        return cached_value["data"]

    query = f"""
    [out:json];
    node(around:{radius},{lat},{lon})["shop"="car_repair"];
    out;
    """

    response_data: dict[str, Any] | None = None
    last_error: Exception | None = None

    for endpoint in settings.overpass_endpoints:
        try:
            response_data = request_json(
                "POST",
                endpoint,
                settings,
                data=query,
            )
            break
        except HTTPException as exc:
            last_error = exc

    if response_data is None:
        detail = "Overpass API error."
        if isinstance(last_error, HTTPException) and last_error.detail:
            detail = str(last_error.detail)
        raise HTTPException(status_code=502, detail=detail)

    centres = []
    for element in response_data.get("elements", []):
        centre_lat = element["lat"]
        centre_lon = element["lon"]
        tags = element.get("tags", {})

        centres.append(
            {
                "name": tags.get("name", "Service Centre"),
                "lat": centre_lat,
                "lon": centre_lon,
                "phone": tags.get("phone", "N/A"),
                "distance_km": round(haversine(lat, lon, centre_lat, centre_lon), 2),
            }
        )

    centres.sort(key=lambda item: item["distance_km"])
    result = {"centres": centres[:5]}
    service_cache[cache_key] = {"timestamp": time.time(), "data": result}
    return result


@app.get("/api/route")
def get_route(
    request: Request,
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float,
) -> dict[str, Any]:
    settings = get_settings(request)
    base_url = (
        "https://router.project-osrm.org/route/v1/driving/"
        f"{start_lon},{start_lat};{end_lon},{end_lat}"
    )
    response_data = request_json(
        "GET",
        base_url,
        settings,
        params={"overview": "full", "geometries": "polyline"},
    )

    routes = response_data.get("routes") or []
    if not routes:
        raise HTTPException(status_code=404, detail="No route found.")

    geometry = routes[0].get("geometry")
    if not geometry:
        raise HTTPException(status_code=404, detail="No route geometry found.")

    return {"polyline": decode_polyline(geometry)}


@app.get("/api/centre-details")
def centre_details(request: Request, lat: float, lon: float) -> dict[str, Any]:
    settings = get_settings(request)
    response_data = request_json(
        "GET",
        "https://nominatim.openstreetmap.org/reverse",
        settings,
        params={
            "lat": lat,
            "lon": lon,
            "format": "json",
            "addressdetails": 1,
            "extratags": 1,
        },
    )

    tags = response_data.get("extratags", {})
    return {
        "address": response_data.get("display_name", "Unknown address"),
        "phone": tags.get("phone", "N/A"),
        "opening_hours": tags.get("opening_hours", "N/A"),
        "website": tags.get("website", "N/A"),
        "rating": tags.get("rating", "N/A"),
    }


if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("UVICORN_RELOAD", "false").lower() == "true",
    )
