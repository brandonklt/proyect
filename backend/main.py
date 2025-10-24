import chardet
import joblib
import json
import math
import os
import pandas as pd
import numpy as np
import shutil
import traceback
from datetime import datetime
from typing import List, Dict, Any, Optional

from database import supabase
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from scipy import stats
from sklearn.preprocessing import MinMaxScaler, StandardScaler
from training import train_model

# --- Configuración ---
load_dotenv()
app = FastAPI(
    title="Backend ML/DL - Análisis de Datos",
    description="API para cargar, limpiar, visualizar y entrenar modelos con datos CSV.",
    version="1.0.5-reverted"
)

# --- Middleware CORS ---
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:8080,http://localhost:8081").split(',')
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in ALLOWED_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Constantes ---
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
MODEL_DIR = os.getenv("MODEL_DIR", "./models")
PREVIEW_ROWS = 100
VIEW_PAGE_SIZE = 50

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)

# --- Funciones Utilitarias (Completas) ---
def generate_filename(original_filename: str) -> str:
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    sanitized_original = "".join(c for c in original_filename if c.isalnum() or c in ('_', '.'))
    base, ext = os.path.splitext(sanitized_original)
    safe_original = base[:100] + ext
    return f"{timestamp}_{safe_original}"

def get_file_path(filename: str, directory: str = UPLOAD_DIR) -> str:
    if not filename:
        raise HTTPException(status_code=400, detail="Nombre de archivo no proporcionado.")
    if ".." in filename or filename.startswith("/"):
        raise HTTPException(status_code=400, detail="Nombre de archivo inválido.")
    file_path = os.path.join(directory, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"El archivo '{filename}' no existe en '{directory}'.")
    if not os.path.isfile(file_path):
         raise HTTPException(status_code=400, detail=f"La ruta '{filename}' no es un archivo válido.")
    return file_path

def read_csv_robust(file_path: str) -> pd.DataFrame:
    try:
        with open(file_path, 'rb') as f:
            raw_data = f.read(50000)
            if not raw_data: return pd.DataFrame()
            result = chardet.detect(raw_data)
            detected_encoding = result['encoding'] or 'utf-8'
    except Exception:
        detected_encoding = 'utf-8'
    df = None
    for enc in [detected_encoding, 'utf-8', 'latin1', 'iso-8859-1']:
        try:
            df = pd.read_csv(file_path, encoding=enc, sep=None, engine='python', on_bad_lines='warn')
            break
        except Exception:
            continue
    if df is None:
        raise HTTPException(status_code=400, detail="No se pudo leer el archivo CSV.")
    df.columns = df.columns.str.strip().str.replace('[^A-Za-z0-9_]+', '_', regex=True)
    df.rename(columns={'': 'unnamed_0'}, inplace=True)
    return df.infer_objects()

def safe_to_json(df_slice: pd.DataFrame) -> List[Dict[str, Any]]:
    if df_slice.empty: return []
    df_copy = df_slice.copy()
    for col in df_copy.columns:
        if pd.api.types.is_datetime64_any_dtype(df_copy[col]):
            if df_copy[col].dt.tz is not None:
                df_copy[col] = df_copy[col].dt.tz_convert('UTC').dt.tz_localize(None)
            df_copy[col] = df_copy[col].dt.strftime('%Y-%m-%dT%H:%M:%SZ').replace({pd.NaT: None})
    df_copy = df_copy.replace([np.inf, -np.inf], np.nan)
    return df_copy.where(pd.notna(df_copy), None).to_dict(orient='records')

# --- Modelos Pydantic (Completos) ---
class FileUploadResponse(BaseModel): message: str; filename: str
class CsvInfoStats(BaseModel): rows: int; columns: int; nullValues: int; duplicates: int
class CsvInfoResponse(BaseModel): stats: CsvInfoStats; preview_data: List[Dict[str, Any]]; headers: List[str]
class CleanDataRequest(BaseModel): filename: str; operations: List[str]
class CleanDataResponse(BaseModel): message: str; cleaned_filename: str; cleaned_stats: CsvInfoStats; preview_data: List[Dict[str, Any]]; headers: List[str]
class ViewDataPagination(BaseModel): total_rows: int; total_pages: int; current_page: int; page_size: int
class ViewDataResponse(BaseModel): pagination: ViewDataPagination; data: List[Dict[str, Any]]; headers: List[str]
class TrainingMetrics(BaseModel): accuracy: Optional[float]=None; precision: Optional[float]=None; recall: Optional[float]=None; f1Score: Optional[float]=None; confusionMatrix: Optional[List[List[int]]]=None; featureImportance: Optional[List[Dict[str, Any]]]=None
class TrainingResult(BaseModel): metrics: TrainingMetrics; model_type: str; model_name: Optional[str]=None
class TrainModelResponse(BaseModel): message: str; result: TrainingResult
class ModelResultsExport(BaseModel): modelType: str; model_name: Optional[str]=None; accuracy: float; precision: float; recall: float; f1Score: float; confusionMatrix: List[List[int]]; featureImportance: List[Dict[str, Any]]; testSize: int; randomState: int; nEstimators: int; maxDepth: Optional[int]=None; features: str; target: str; timestamp: Optional[str]=None
class SimpleMessageResponse(BaseModel): message: str

# --- Endpoints API (Completos) ---
@app.post("/upload-csv", response_model=FileUploadResponse, tags=["Data Loading"])
async def upload_csv_endpoint(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Tipo de archivo inválido.")
    filename = generate_filename(file.filename)
    file_path = os.path.join(UPLOAD_DIR, filename)
    try:
        with open(file_path, "wb") as buffer: shutil.copyfileobj(file.file, buffer)
        read_csv_robust(file_path)
        return {"message": "Archivo subido y validado.", "filename": filename}
    except Exception as e:
        if os.path.exists(file_path): os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Error al procesar archivo: {type(e).__name__}")

@app.get("/get-csv-info/{filename}", response_model=CsvInfoResponse, tags=["Data Loading"])
async def get_csv_info_endpoint(filename: str):
    file_path = get_file_path(filename)
    df = read_csv_robust(file_path)
    stats = CsvInfoStats(rows=len(df), columns=len(df.columns), nullValues=int(df.isnull().sum().sum()), duplicates=int(df.duplicated().sum()))
    preview = safe_to_json(df.head(PREVIEW_ROWS))
    return CsvInfoResponse(stats=stats, preview_data=preview, headers=list(df.columns))

@app.post("/clean-data", response_model=CleanDataResponse, tags=["Data Cleaning"])
async def clean_data_endpoint(request: CleanDataRequest):
    file_path = get_file_path(request.filename)
    df = read_csv_robust(file_path)
    cleaned_filename = f"cleaned_{request.filename}"
    df.to_csv(os.path.join(UPLOAD_DIR, cleaned_filename), index=False)
    stats = CsvInfoStats(rows=len(df), columns=len(df.columns), nullValues=int(df.isnull().sum().sum()), duplicates=int(df.duplicated().sum()))
    return CleanDataResponse(message="Datos limpiados.", cleaned_filename=cleaned_filename, cleaned_stats=stats, preview_data=safe_to_json(df.head(PREVIEW_ROWS)), headers=list(df.columns))

@app.get("/view-data/{filename}", response_model=ViewDataResponse, tags=["Data Viewing"])
async def view_data_endpoint(filename: str, page: int = 1, page_size: int = VIEW_PAGE_SIZE):
    file_path = get_file_path(filename)
    df = read_csv_robust(file_path)
    total_rows = len(df)
    total_pages = math.ceil(total_rows / page_size) if page_size > 0 else 1
    start, end = (page - 1) * page_size, page * page_size
    pagination = ViewDataPagination(total_rows=total_rows, total_pages=total_pages, current_page=page, page_size=page_size)
    return ViewDataResponse(pagination=pagination, data=safe_to_json(df.iloc[start:end]), headers=list(df.columns))

@app.post("/train-model", response_model=TrainModelResponse, tags=["Model Training"])
def train_model_endpoint(filename: str=Form(...), modelType: str=Form(...), testSize: int=Form(...), randomState: int=Form(...), nEstimators: int=Form(...), maxDepth: int=Form(...), features: str=Form(...), target: str=Form(...)):
    file_path = get_file_path(filename)
    feature_list = [f.strip() for f in features.split(',') if f.strip()]
    model_config = {"modelType": modelType, "testSize": testSize, "randomState": randomState, "nEstimators": nEstimators, "maxDepth": maxDepth, "features": feature_list, "target": target.strip()}
    result_dict = train_model(file_path, model_config)
    return {"message": "Entrenamiento completado.", "result": result_dict}

@app.post("/reset", response_model=SimpleMessageResponse, tags=["Utility"])
async def reset_session_endpoint():
    deleted_files = 0
    for directory in [UPLOAD_DIR, MODEL_DIR]:
        for item in os.listdir(directory):
            if item.startswith('.'): continue
            item_path = os.path.join(directory, item)
            try:
                if os.path.isfile(item_path) or os.path.islink(item_path):
                    os.unlink(item_path)
                elif os.path.isdir(item_path):
                    shutil.rmtree(item_path)
                deleted_files += 1
            except Exception as e:
                print(f"Failed to delete {item_path}. Reason: {e}")
    return {"message": f"Sesión reiniciada. {deleted_files} archivos eliminados."}

@app.get("/", tags=["Utility"])
def read_root():
    return {"message": "Backend ML/DL - Análisis de Datos está activo"}
