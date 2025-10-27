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
import uvicorn
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
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS", 
    "http://localhost:5173,http://127.0.0.1:5173,https://proyect-7223.vercel.app"
).split(',')

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

# --- Funciones Utilitarias ---
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
    records = df_copy.to_dict(orient='records')
    clean_records = [clean_record_for_json(rec) for rec in records]
    return clean_records

def clean_record_for_json(data: Any) -> Any:
    if isinstance(data, dict):
        return {key: clean_record_for_json(value) for key, value in data.items()}
    if isinstance(data, list):
        return [clean_record_for_json(element) for element in data]
    if isinstance(data, (float, np.floating)) and not np.isfinite(data):
        return None
    if pd.isna(data):
        return None
    return data

# --- Modelos Pydantic ---
class FileUploadResponse(BaseModel):
    message: str
    filename: str
    archivo_id: int

class CsvInfoStats(BaseModel):
    rows: int
    columns: int
    nullValues: int
    duplicates: int

class CsvInfoResponse(BaseModel):
    stats: CsvInfoStats
    preview_data: List[Dict[str, Any]]
    headers: List[str]

class CleanDataRequest(BaseModel):
    archivo_id: int
    operations: List[str]

class CleanDataResponse(BaseModel):
    message: str
    cleaned_filename: str
    cleaned_stats: CsvInfoStats
    preview_data: List[Dict[str, Any]]
    headers: List[str]
    datos_procesados_id: int

class ViewDataPagination(BaseModel):
    total_rows: int
    total_pages: int
    current_page: int
    page_size: int

class ViewDataResponse(BaseModel):
    pagination: ViewDataPagination
    data: List[Dict[str, Any]]
    headers: List[str]

class TrainingMetrics(BaseModel):
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1Score: Optional[float] = None
    confusionMatrix: Optional[List[List[int]]] = None
    featureImportance: Optional[List[Dict[str, Any]]] = None
    lossHistory: Optional[List[float]] = None
    scatterPlotData: Optional[Dict[str, List[Any]]] = None

class TrainingResult(BaseModel):
    metrics: TrainingMetrics
    model_type: str
    model_name: Optional[str] = None

class TrainModelResponse(BaseModel):
    message: str
    result: TrainingResult

class ModelResultsExport(BaseModel):
    datos_procesados_id: int
    modelType: str
    accuracy: float
    precision: float
    recall: float
    f1Score: float
    confusionMatrix: List[List[int]]
    featureImportance: Optional[List[Dict[str, Any]]] = None
    scatterPlotData: Optional[Dict[str, List[Any]]] = None
    testSize: int
    randomState: int
    features: str
    target: str
    timestamp: str
    nEstimators: Optional[int] = None
    maxDepth: Optional[int] = None
    epochs: Optional[int] = None
    learningRate: Optional[float] = None
    hiddenLayers: Optional[List[int]] = None
    activation: Optional[str] = None

    class Config:
        schema_extra = {
            "example": {
                "datos_procesados_id": 1,
                "modelType": "NeuralNetwork",
                "accuracy": 86.05,
                "precision": 86.39,
                "recall": 86.05,
                "f1Score": 86.03,
                "confusionMatrix": [[19, 2], [4, 18]],
                "testSize": 20,
                "randomState": 42,
                "features": "Units Sold, Unit Price, Region, Payment Method",
                "target": "Total Revenue",
                "timestamp": "2025-10-26T03:29:06.754Z"
            }
        }

class SimpleMessageResponse(BaseModel):
    message: str

# --- Endpoints API ---
@app.post("/upload-csv", response_model=FileUploadResponse, tags=["Data Loading"])
async def upload_csv_endpoint(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Tipo de archivo inválido.")
    filename = generate_filename(file.filename)
    file_path = os.path.join(UPLOAD_DIR, filename)
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        df = read_csv_robust(file_path)
        file_content = df.to_json(orient='records')
        response = supabase.table('archivos_originales').insert({
            'filename': filename,
            'file_content': file_content
        }).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Error al guardar el archivo en la base de datos.")
        archivo_id = response.data[0]['id']
        return {"message": "Archivo subido y validado.", "filename": filename, "archivo_id": archivo_id}
    except HTTPException as e:
        if os.path.exists(file_path): os.remove(file_path)
        raise e
    except Exception as e:
        if os.path.exists(file_path): os.remove(file_path)
        traceback.print_exc()
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
    try:
        response = supabase.table('archivos_originales').select('filename').eq('id', request.archivo_id).single().execute()
        if not response.data:
            raise HTTPException(status_code=404, detail=f"No se encontró un archivo con ID {request.archivo_id}")
        original_filename = response.data['filename']
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al buscar el archivo original: {e}")
    file_path = get_file_path(original_filename)
    df = read_csv_robust(file_path)
    text_cols = df.select_dtypes(include=['object', 'string']).columns
    if not text_cols.empty:
        mask_null_in_text = df[text_cols].isnull().any(axis=1)
        discarded_rows_df = df[mask_null_in_text].copy()
        clean_rows_df = df[~mask_null_in_text].copy()
    else:
        discarded_rows_df = pd.DataFrame(columns=df.columns)
        clean_rows_df = df.copy()
    discarded_json = json.loads(discarded_rows_df.to_json(orient='records'))
    clean_json = json.loads(clean_rows_df.to_json(orient='records'))
    if not discarded_rows_df.empty:
        try:
            supabase.table('filas_con_nulos_descartadas').insert({
                'archivo_id': request.archivo_id,
                'row_data': discarded_json,
                'reason': f"{len(discarded_rows_df)} filas descartadas por valores nulos en columnas de texto."
            }).execute()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al insertar en Supabase (descartados): {e}")
    datos_procesados_id = None
    if not clean_rows_df.empty:
        try:
            response = supabase.table('datos_procesados').insert({
                'archivo_id': request.archivo_id,
                'row_data': clean_json
            }).execute()
            if not response.data:
                raise HTTPException(status_code=500, detail="No se pudo obtener el ID de los datos procesados.")
            datos_procesados_id = response.data[0]['id']
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al insertar en Supabase (procesados): {e}")
    cleaned_filename = f"cleaned_{original_filename}"
    cleaned_filepath = os.path.join(UPLOAD_DIR, cleaned_filename)
    clean_rows_df.to_csv(cleaned_filepath, index=False)
    response_stats = CsvInfoStats(
        rows=len(clean_rows_df),
        columns=len(clean_rows_df.columns),
        nullValues=int(clean_rows_df.isnull().sum().sum()),
        duplicates=int(clean_rows_df.duplicated().sum())
    )
    message = f"Procesamiento completo. {len(clean_rows_df)} filas procesadas. {len(discarded_rows_df)} filas descartadas."
    return {
        "message": message,
        "cleaned_filename": cleaned_filename,
        "cleaned_stats": response_stats,
        "preview_data": safe_to_json(clean_rows_df.head(PREVIEW_ROWS)),
        "headers": list(clean_rows_df.columns),
        "datos_procesados_id": datos_procesados_id
    }

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
def train_model_endpoint(
    filename: str = Form(...),
    modelType: str = Form(...),
    testSize: int = Form(...),
    randomState: int = Form(...),
    features: str = Form(...),
    target: str = Form(...),
    nEstimators: Optional[int] = Form(100),
    maxDepth: Optional[int] = Form(10),
    epochs: Optional[int] = Form(50),
    learningRate: Optional[float] = Form(0.001),
    hiddenLayers: Optional[str] = Form('[64, 32]'),
    activation: Optional[str] = Form('ReLU')
):
    try:
        file_path = get_file_path(filename)
        feature_list = [f.strip() for f in features.split(',') if f.strip()]
        model_config = {
            "modelType": modelType,
            "testSize": testSize,
            "randomState": randomState,
            "features": feature_list,
            "target": target.strip()
        }
        if modelType == 'RandomForestClassifier':
            model_config.update({"nEstimators": nEstimators, "maxDepth": maxDepth})
        elif modelType == 'NeuralNetwork':
            try:
                hidden_layers_list = json.loads(hiddenLayers)
                if not isinstance(hidden_layers_list, list) or not all(isinstance(i, int) for i in hidden_layers_list):
                    raise HTTPException(status_code=400, detail="'hiddenLayers' debe ser un array de enteros.")
            except (json.JSONDecodeError, TypeError):
                raise HTTPException(status_code=400, detail="Formato de 'hiddenLayers' inválido.")
            model_config.update({
                "epochs": epochs,
                "learningRate": learningRate,
                "hiddenLayers": hidden_layers_list,
                "activation": activation
            })
        result_dict = train_model(file_path, model_config)
        return {"message": "Entrenamiento completado.", "result": result_dict}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error inesperado: {e}")

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

@app.post("/export-to-db", response_model=SimpleMessageResponse, tags=["Model Training"])
async def export_to_db_endpoint(results: Dict[str, Any]):
    print("--- DEBUG: RAW DATA RECEIVED --- ")
    print(results)
    print("---------------------------------")
    try:
        validated_results = ModelResultsExport.parse_obj(results)
        results_dict = validated_results.dict(exclude_unset=True)
        training_params = {
            "test_size": results_dict.get("testSize"),
            "random_state": results_dict.get("randomState"),
            "features": results_dict.get("features"),
            "target": results_dict.get("target")
        }
        if validated_results.modelType == 'RandomForestClassifier':
            training_params['n_estimators'] = results_dict.get("nEstimators")
            training_params['max_depth'] = results_dict.get("maxDepth")
        elif validated_results.modelType == 'NeuralNetwork':
            training_params['epochs'] = results_dict.get("epochs")
            training_params['learning_rate'] = results_dict.get("learningRate")
            training_params['hidden_layers'] = results_dict.get("hiddenLayers")
            training_params['activation'] = results_dict.get("activation")
        # Verificar que el datos_procesados_id existe
        if not results_dict.get("datos_procesados_id"):
            raise HTTPException(
                status_code=400,
                detail="datos_procesados_id es requerido para establecer la relación con los datos procesados"
            )

        # Verificar que el ID existe en la tabla datos_procesados
        datos_procesados = supabase.table("datos_procesados").select("id").eq("id", results_dict["datos_procesados_id"]).execute()
        if not datos_procesados.data:
            raise HTTPException(
                status_code=404,
                detail=f"No se encontró el registro de datos_procesados con id {results_dict['datos_procesados_id']}"
            )

        data_to_insert = {
            "datos_procesados_id": results_dict["datos_procesados_id"],
            "model_type": results_dict["modelType"],
            "accuracy": results_dict["accuracy"],
            "precision": results_dict["precision"],
            "recall": results_dict["recall"],
            "f1_score": results_dict["f1Score"],
            "confusion_matrix": results_dict["confusionMatrix"],
            "feature_importance": results_dict.get("featureImportance"),
            "training_parameters": training_params
        }
        
        print("--- DEBUG: INSERTING DATA ---")
        print(data_to_insert)
        print("----------------------------")
        
        result = supabase.table("model_results").insert(data_to_insert).execute()
        return {"message": "Resultados del modelo exportados a la base de datos exitosamente."}
    except Exception as e:
        print("--- DEBUG: VALIDATION ERROR ---")
        traceback.print_exc()
        print("-------------------------------")
        raise HTTPException(status_code=500, detail=f"Error de validación o procesamiento: {e}")

@app.get("/", tags=["Utility"])
def read_root():
    return {"message": "Backend ML/DL - Análisis de Datos está activo"}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        ssl_keyfile="key.pem",
        ssl_certfile="cert.pem"
    )
