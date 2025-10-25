import chardet # Para detectar codificación
import joblib
import json
import math
import os
import pandas as pd
import numpy as np
import shutil
import traceback # Para imprimir errores detallados
from datetime import datetime
from typing import List, Dict, Any, Optional

from database import supabase  # Asume database.py configura el cliente Supabase
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from scipy import stats
from sklearn.preprocessing import MinMaxScaler, StandardScaler
# Asume que training.py existe y tiene la función train_model
# Asegúrate de que training.py también maneje errores robustamente
from training import train_model

# --- Configuración ---
load_dotenv()
app = FastAPI(
    title="Backend ML/DL - Análisis de Datos",
    description="API para cargar, limpiar, visualizar y entrenar modelos con datos CSV.",
    version="1.0.1" # Versión incrementada
)

# --- Middleware CORS ---
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:8080,http://localhost:8081").split(',')
print(f"Allowed CORS origins: {ALLOWED_ORIGINS}")

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
PREVIEW_ROWS = 100 # Filas para previsualización
VIEW_PAGE_SIZE = 50 # Tamaño de página por defecto para visualización

# --- Asegurar que los Directorios Existen ---
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)

# --- Funciones Utilitarias ---
def generate_filename(original_filename: str) -> str:
    """Crea un nombre de archivo único basado en timestamp y nombre original."""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    # Sanitización básica (reemplaza espacios, mantiene alfanuméricos, _, .)
    sanitized_original = "".join(c for c in original_filename if c.isalnum() or c in ('_', '.'))
    # Limitar longitud si es necesario
    base, ext = os.path.splitext(sanitized_original)
    max_len = 100 # Longitud máxima para el nombre base
    safe_original = base[:max_len] + ext if len(base) > max_len else sanitized_original
    return f"{timestamp}_{safe_original}"

def get_file_path(filename: str, directory: str = UPLOAD_DIR) -> str:
    """Construye la ruta completa y verifica existencia y si es archivo."""
    if not filename: # Validar que filename no sea vacío
        raise HTTPException(status_code=400, detail="Nombre de archivo no proporcionado.")
    # Seguridad básica: evitar que filename intente salir del directorio
    if ".." in filename or filename.startswith("/"):
        raise HTTPException(status_code=400, detail="Nombre de archivo inválido.")

    file_path = os.path.join(directory, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"El archivo '{filename}' no existe en '{directory}'.")
    if not os.path.isfile(file_path):
         raise HTTPException(status_code=400, detail=f"La ruta '{filename}' no es un archivo válido.")
    return file_path

def read_csv_robust(file_path: str) -> pd.DataFrame:
    """
    Lee un CSV robustamente, detectando encoding/separador y limpiando cabeceras.
    """
    detected_encoding = 'utf-8' # Fallback por defecto
    try:
        with open(file_path, 'rb') as f:
            raw_data = f.read(50000) # Leer chunk para detectar
            if not raw_data: # Manejar archivo vacío
                 print(f"Warning: File {file_path} is empty.")
                 return pd.DataFrame()
            result = chardet.detect(raw_data)
            encoding = result['encoding']
            confidence = result['confidence'] or 0
            if encoding and confidence > 0.7:
                 normalized_encoding = encoding.lower()
                 if normalized_encoding in ['ascii', 'windows-1252', 'iso-8859-1']:
                     detected_encoding = 'utf-8'
                 else:
                     detected_encoding = encoding
                 print(f"Detected encoding: {detected_encoding} (confidence: {confidence:.2f})")
            else:
                 print(f"Low confidence ({confidence:.2f}) for detected encoding '{encoding}'. Falling back to utf-8.")
                 detected_encoding = 'utf-8'
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Archivo no encontrado en la ruta: {file_path}")
    except Exception as e:
        print(f"Error detecting encoding for {file_path}. Defaulting to utf-8. Error: {e}")
        detected_encoding = 'utf-8'

    encodings_to_try = [detected_encoding, 'utf-8', 'latin1', 'iso-8859-1', 'cp1252']
    unique_encodings = list(dict.fromkeys(encodings_to_try))

    df = None
    last_exception = None

    for enc in unique_encodings:
        try:
            df = pd.read_csv(file_path, sep=None, engine='python', encoding=enc, on_bad_lines='warn')
            print(f"Successfully read CSV with encoding '{enc}' and auto-sep.")
            break
        except (UnicodeDecodeError, pd.errors.ParserError) as e_sep:
            last_exception = e_sep
            print(f"Failed with '{enc}' and auto-sep. Trying common separators...")
            for sep in [',', ';', '\t', '|']:
                 try:
                     df = pd.read_csv(file_path, sep=sep, engine='c', encoding=enc, on_bad_lines='warn')
                     print(f"Successfully read CSV with encoding '{enc}' and separator '{sep}'.")
                     break
                 except Exception as e_inner:
                     last_exception = e_inner
                     print(f"Failed reading with encoding '{enc}' and separator '{sep}'.")
                     continue
            if df is not None:
                 break
        except Exception as e:
            last_exception = e
            print(f"General error reading CSV with encoding '{enc}': {e}")
            continue

    if df is None:
        error_detail = f"No se pudo leer el archivo CSV '{os.path.basename(file_path)}'. Verifique formato, codificación (probadas: {unique_encodings}) y separador (, ; \\t |)."
        if last_exception:
            error_detail += f" Último error: {type(last_exception).__name__}"
        raise HTTPException(status_code=400, detail=error_detail)

    df.columns = df.columns.str.strip().str.replace('[^A-Za-z0-9_]+', '_', regex=True)
    df.rename(columns={'': 'unnamed_0'}, inplace=True)
    df = df.infer_objects()
    print(f"CSV read. Shape: {df.shape}, Columns: {df.columns.tolist()}")
    return df

def safe_to_json(df_slice: pd.DataFrame) -> List[Dict[str, Any]]:
    """Convierte un slice de DataFrame a lista de records serializable JSON."""
    if df_slice.empty:
        return []
    try:
        df_copy = df_slice.copy()
        for col in df_copy.select_dtypes(include=['datetime64[ns]', 'datetime64[ns, tz]']).columns:
             if pd.api.types.is_datetime64_any_dtype(df_copy[col]) and df_copy[col].dt.tz is not None:
                  df_copy[col] = df_copy[col].dt.tz_convert('UTC').dt.tz_localize(None)
             df_copy[col] = df_copy[col].dt.strftime('%Y-%m-%dT%H:%M:%SZ').replace({pd.NaT: None})

        df_copy = df_copy.replace([np.inf, -np.inf], np.nan).where(pd.notna(df_copy), None)
        records = df_copy.to_dict(orient='records')
        return records
    except Exception as e:
        print(f"Error during safe_to_json conversion: {e}")
        return df_slice.astype(str).replace({'nan': None}).to_dict(orient='records')

# --- Modelos Pydantic ---
class FileUploadResponse(BaseModel):
    message: str
    filename: str

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
    filename: str
    operations: List[str] = Field(..., description="Lista de IDs de operaciones de limpieza")

class CleanDataResponse(BaseModel):
    message: str
    cleaned_filename: str
    cleaned_stats: CsvInfoStats
    preview_data: List[Dict[str, Any]]
    headers: List[str]

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

class TrainingResult(BaseModel):
     metrics: TrainingMetrics
     model_type: str
     model_name: Optional[str] = None

class TrainModelResponse(BaseModel):
    message: str
    result: TrainingResult

class ModelResultsExport(BaseModel):
    modelType: str
    model_name: Optional[str] = None
    accuracy: float
    precision: float
    recall: float
    f1Score: float
    confusionMatrix: List[List[int]]
    featureImportance: List[Dict[str, Any]]
    testSize: int
    randomState: int
    nEstimators: int
    maxDepth: Optional[int] = None
    features: str
    target: str
    timestamp: Optional[str] = Field(None, description="Timestamp from frontend if available")

class SimpleMessageResponse(BaseModel):
    message: str

# --- Endpoints API ---

@app.post("/upload-csv", response_model=FileUploadResponse, tags=["Data Loading"],
          summary="Sube un archivo CSV",
          description="Valida que sea un CSV legible, lo guarda y registra el trabajo.")
async def upload_csv_endpoint(file: UploadFile = File(..., description="Archivo CSV a subir")):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Tipo de archivo inválido. Solo se permiten archivos .csv.")
    allowed_mime_types = ["text/csv", "application/vnd.ms-excel", "text/plain"]
    if file.content_type not in allowed_mime_types:
         print(f"Warning: Unexpected content type '{file.content_type}' for file '{file.filename}'.")

    filename = generate_filename(file.filename)
    file_path = os.path.join(UPLOAD_DIR, filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"Archivo guardado en: {file_path}")
        read_csv_robust(file_path)
        try:
            db_insert = { "filename": filename, "status": "uploaded", "created_at": datetime.utcnow().isoformat() }
            supabase.table("training_jobs").insert(db_insert).execute()
            print(f"Registro de subida en Supabase exitoso.")
        except Exception as db_error:
            print(f"Error EXCEPCIÓN al registrar subida en Supabase: {db_error}")
        return {"message": "Archivo subido y validado correctamente", "filename": filename}
    except HTTPException as http_exc:
        if os.path.exists(file_path):
            try: os.remove(file_path); print(f"Archivo inválido eliminado: {file_path}")
            except OSError as del_err: print(f"Error eliminando archivo inválido {file_path}: {del_err}")
        raise http_exc
    except Exception as e:
        if os.path.exists(file_path):
            try: os.remove(file_path); print(f"Archivo parcialmente guardado eliminado por error: {file_path}")
            except OSError as del_err: print(f"Error eliminando archivo parcialmente guardado {file_path}: {del_err}")
        print(f"Error inesperado durante subida de archivo: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error interno del servidor al procesar el archivo: {type(e).__name__}")

@app.get("/get-csv-info/{filename}", response_model=CsvInfoResponse, tags=["Data Loading"],
         summary="Obtiene información y previsualización de un CSV",
         description="Devuelve estadísticas básicas y las primeras filas de un archivo CSV subido.")
async def get_csv_info_endpoint(filename: str):
    try:
        file_path = get_file_path(filename)
        df = read_csv_robust(file_path)

        if df.empty:
             stats_data = CsvInfoStats(rows=0, columns=0, nullValues=0, duplicates=0)
             preview_data_serializable = []
             headers = []
        else:
            stats_data = CsvInfoStats(
                rows=len(df),
                columns=len(df.columns),
                nullValues=int(df.isnull().sum().sum()),
                duplicates=int(df.duplicated().sum()),
            )
            preview_df = df.head(PREVIEW_ROWS)
            preview_data_serializable = safe_to_json(preview_df)
            headers = list(df.columns)

        return CsvInfoResponse(
            stats=stats_data,
            preview_data=preview_data_serializable,
            headers=headers,
        )
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Error obteniendo info de CSV para '{filename}': {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error al procesar la información del CSV: {type(e).__name__}")

@app.post("/clean-data", response_model=CleanDataResponse, tags=["Data Cleaning"],
          summary="Limpia un archivo CSV",
          description="Aplica operaciones de limpieza seleccionadas y guarda un nuevo archivo 'cleaned_'.")
async def clean_data_endpoint(request: CleanDataRequest):
    try:
        file_path = get_file_path(request.filename)
        df = read_csv_robust(file_path)
        print(f"Iniciando limpieza para '{request.filename}'. Shape inicial: {df.shape}. Operaciones: {request.operations}")
        initial_rows = len(df)

        if not df.empty:
            numeric_cols = df.select_dtypes(include=np.number).columns.tolist()
            if "remove-na" in request.operations:
                df.dropna(inplace=True)
                print(f"Shape después de dropna: {df.shape}")
            numeric_cols = df.select_dtypes(include=np.number).columns.tolist() if not df.empty else []
            if "fill-mean" in request.operations and numeric_cols and not df.empty:
                df.fillna(df[numeric_cols].mean(), inplace=True)
                print("Operación fill-mean aplicada.")
            if "fill-median" in request.operations and numeric_cols and not df.empty:
                df.fillna(df[numeric_cols].median(), inplace=True)
                print("Operación fill-median aplicada.")
            if "interpolate" in request.operations and not df.empty:
                df.interpolate(method='linear', limit_direction='forward', axis=0, inplace=True)
                print("Operación interpolate aplicada.")
            if "remove-duplicates" in request.operations and not df.empty:
                df.drop_duplicates(inplace=True)
                print(f"Shape después de remove-duplicates: {df.shape}")
            if "keep-first" in request.operations and not df.empty and "remove-duplicates" not in request.operations:
                 df.drop_duplicates(keep='first', inplace=True)
                 print(f"Shape después de keep-first: {df.shape}")
            numeric_cols = df.select_dtypes(include=np.number).columns.tolist() if not df.empty else []
            if not df.empty and numeric_cols:
                df_numeric_no_na_cols = df[numeric_cols].dropna(axis=1, how='all')
                if "remove-outliers" in request.operations and not df_numeric_no_na_cols.empty:
                    try:
                        z_scores = np.abs(stats.zscore(df_numeric_no_na_cols.fillna(0)))
                        mask = pd.DataFrame(z_scores < 3, index=df_numeric_no_na_cols.index, columns=df_numeric_no_na_cols.columns).all(axis=1)
                        df = df[mask]
                        print(f"Shape después de remove-outliers (z-score): {df.shape}")
                    except Exception as e_zscore:
                         print(f"Error calculando Z-score para outliers: {e_zscore}")
                numeric_cols = df.select_dtypes(include=np.number).columns.tolist() if not df.empty else []
                df_numeric_no_na_cols = df[numeric_cols].dropna(axis=1, how='all') if numeric_cols else pd.DataFrame()
                if "cap-outliers" in request.operations and not df_numeric_no_na_cols.empty:
                    try:
                        Q1 = df_numeric_no_na_cols.quantile(0.25)
                        Q3 = df_numeric_no_na_cols.quantile(0.75)
                        IQR = Q3 - Q1
                        df[numeric_cols] = df[numeric_cols].clip(lower=Q1 - 1.5 * IQR, upper=Q3 + 1.5 * IQR, axis=1)
                        print("Operación cap-outliers (IQR) aplicada.")
                    except Exception as e_iqr:
                        print(f"Error aplicando cap-outliers (IQR): {e_iqr}")
                if "normalize" in request.operations and not df_numeric_no_na_cols.empty:
                     try:
                        scaler = MinMaxScaler()
                        df[numeric_cols] = scaler.fit_transform(df[numeric_cols])
                        print("Operación normalize (MinMax) aplicada.")
                     except Exception as e_norm:
                          print(f"Error aplicando normalize (MinMaxScaler): {e_norm}")
                if "standardize" in request.operations and not df_numeric_no_na_cols.empty:
                     try:
                        scaler = StandardScaler()
                        df[numeric_cols] = scaler.fit_transform(df[numeric_cols])
                        print("Operación standardize (StandardScaler) aplicada.")
                     except Exception as e_std:
                          print(f"Error aplicando standardize (StandardScaler): {e_std}")
                if "log-transform" in request.operations:
                    for col in numeric_cols:
                        if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
                            if (df[col] > 0).all():
                                try:
                                    df[col] = np.log1p(df[col])
                                    print(f"Log-transform (log1p) aplicado a '{col}'.")
                                except Exception as e_log:
                                     print(f"Error aplicando log-transform a '{col}': {e_log}")
                            elif (df[col] >= 0).any():
                                 print(f"WARN: Columna '{col}' contiene ceros, log-transform (log1p) puede generar 0s. Aplicado de todas formas.")
                                 try: df[col] = np.log1p(df[col])
                                 except Exception as e_log0: print(f"Error aplicando log-transform con ceros a '{col}': {e_log0}")
                            else:
                                print(f"WARN: Columna '{col}' contiene valores negativos. Log-transform no aplicado.")

        print(f"Limpieza finalizada. Shape final: {df.shape}")
        if df.empty and initial_rows > 0:
            print("WARN: DataFrame vacío después de todas las operaciones de limpieza.")

        cleaned_stats_data = CsvInfoStats(
            rows=len(df), columns=len(df.columns),
            nullValues=int(df.isnull().sum().sum()) if not df.empty else 0,
            duplicates=int(df.duplicated().sum()) if not df.empty else 0
        )
        preview_df = df.head(PREVIEW_ROWS)
        preview_data_serializable = safe_to_json(preview_df)
        final_headers = list(df.columns)

        cleaned_filename = f"cleaned_{request.filename}"
        cleaned_file_path = os.path.join(UPLOAD_DIR, cleaned_filename)
        try:
            df.to_csv(cleaned_file_path, index=False)
            print(f"Archivo limpiado guardado en: {cleaned_file_path}")
        except Exception as e_save:
            print(f"Error guardando archivo limpiado: {e_save}")
            raise HTTPException(status_code=500, detail=f"No se pudo guardar el archivo limpiado: {e_save}")

        try:
            db_insert = { "filename": cleaned_filename, "status": "cleaned",
                          "created_at": datetime.utcnow().isoformat(),
                          "original_file": request.filename, "operations": request.operations }
            supabase.table("training_jobs").insert(db_insert).execute()
            print("Registro de limpieza en Supabase exitoso.")
        except Exception as db_error:
            print(f"Error registrando limpieza en Supabase: {db_error}")

        return CleanDataResponse(
            message="Datos limpiados correctamente.", cleaned_filename=cleaned_filename,
            cleaned_stats=cleaned_stats_data, preview_data=preview_data_serializable,
            headers=final_headers
        )
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Error inesperado durante la limpieza de datos para '{request.filename}': {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error interno durante la limpieza: {type(e).__name__}")

@app.get("/view-data/{filename}", response_model=ViewDataResponse, tags=["Data Viewing"],
         summary="Visualiza datos paginados de un CSV",
         description="Devuelve una porción paginada de los datos de un archivo CSV específico.")
async def view_data_endpoint(filename: str, page: int = 1, page_size: int = VIEW_PAGE_SIZE):
    if page < 1: page = 1
    if page_size < 1: page_size = 10
    if page_size > 500: page_size = 500

    try:
        file_path = get_file_path(filename)
        df = read_csv_robust(file_path)
        total_rows = len(df)
        total_pages = math.ceil(total_rows / page_size) if page_size > 0 else 1
        if total_pages == 0 and total_rows == 0: total_pages = 1
        if page > total_pages: page = total_pages
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        df_page = df.iloc[start_index:end_index]
        page_data_serializable = safe_to_json(df_page)
        pagination_data = ViewDataPagination(
             total_rows=total_rows, total_pages=total_pages,
             current_page=page, page_size=page_size
        )
        return ViewDataResponse(
            pagination=pagination_data,
            data=page_data_serializable,
            headers=list(df.columns)
        )
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Error visualizando datos para '{filename}': {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error al obtener los datos paginados: {type(e).__name__}")

@app.post("/train-model", response_model=TrainModelResponse, tags=["Model Training"],
          summary="Entrena un modelo de ML",
          description="Entrena un modelo (actualmente RandomForestClassifier) con los parámetros dados.")
def train_model_endpoint(
    filename: str = Form(..., description="Nombre del archivo CSV (usualmente el limpiado) para entrenar."),
    modelType: str = Form(..., description="Tipo de modelo (ej. 'Random Forest Classifier')."),
    testSize: int = Form(..., ge=1, le=99, description="Porcentaje para test set (1-99)."),
    randomState: int = Form(..., description="Semilla aleatoria."),
    nEstimators: int = Form(..., ge=1, description="Número de estimadores (ej. árboles)."),
    maxDepth: int = Form(..., ge=0, description="Profundidad máxima (0 para ilimitado)."),
    features: str = Form(..., description="Nombres de columnas de features, separados por coma."),
    target: str = Form(..., description="Nombre de la columna objetivo.")
):
    try:
        file_path = get_file_path(filename)
        feature_list = [f.strip() for f in features.split(',') if f.strip()]
        cleaned_target = target.strip()
        if not feature_list: raise ValueError("La lista de 'features' no puede estar vacía.")
        if not cleaned_target: raise ValueError("El nombre de la columna 'target' no puede estar vacío.")

        model_config = {
            "modelType": modelType, "testSize": testSize, "randomState": randomState,
            "nEstimators": nEstimators, "maxDepth": maxDepth if maxDepth > 0 else None,
            "features": feature_list,
            "target": cleaned_target,
        }
        print(f"Iniciando entrenamiento para '{filename}' con config: {model_config}")
        result_dict = train_model(file_path, model_config)
        print(f"Entrenamiento completado. Resultado: {result_dict}")

        try:
            upsert_data = {
                "filename": filename, "status": "trained", "model_type": modelType,
                "metrics": result_dict.get("metrics"),
                "model_name": result_dict.get("model_name"),
                "trained_at": datetime.utcnow().isoformat(),
                "training_parameters": {k: v for k, v in model_config.items() if k != 'features'} | {'features': feature_list}
            }
            supabase.table("training_jobs").upsert(upsert_data, on_conflict="filename").execute()
            print("Estado de entrenamiento actualizado en Supabase.")
        except Exception as db_error:
            print(f"Error actualizando estado en Supabase: {db_error}")

        return {"message": "Entrenamiento completado exitosamente", "result": result_dict}
    except HTTPException as http_exc:
        raise http_exc
    except ValueError as ve:
        print(f"Error de validación durante entrenamiento: {ve}")
        try:
            supabase.table("training_jobs").upsert({"filename": filename,"status": "error", "error_message": f"DataError: {ve}"}, on_conflict="filename").execute()
        except Exception as db_log_err: print(f"Error loggeando error de entrena.: {db_log_err}")
        raise HTTPException(status_code=400, detail=f"Error en datos/configuración: {ve}")
    except Exception as e:
        print(f"Error inesperado durante entrenamiento: {e}")
        traceback.print_exc()
        try:
            supabase.table("training_jobs").upsert({"filename": filename,"status": "error", "error_message": str(e)}, on_conflict="filename").execute()
        except Exception as db_log_err: print(f"Error loggeando error de entrena.: {db_log_err}")
        raise HTTPException(status_code=500, detail=f"Error interno durante el entrenamiento: {type(e).__name__}")

@app.post("/export-to-db", response_model=SimpleMessageResponse, tags=["Model Results"],
          summary="Exporta resultados del modelo a la base de datos",
          description="Guarda las métricas y parámetros de un entrenamiento en la tabla 'model_results'.")
async def export_to_db_endpoint(results: ModelResultsExport):
    try:
        exported_at = results.timestamp if results.timestamp else datetime.utcnow().isoformat()
        feature_list = [f.strip() for f in results.features.split(',') if f.strip()]
        db_record = {
            "model_type": results.modelType, "model_name": results.model_name,
            "accuracy": results.accuracy, "precision": results.precision,
            "recall": results.recall, "f1_score": results.f1Score,
            "confusion_matrix": json.dumps(results.confusionMatrix),
            "feature_importance": json.dumps(results.featureImportance),
            "training_parameters": json.dumps({
                "test_size": results.testSize, "random_state": results.randomState,
                "n_estimators": results.nEstimators, "max_depth": results.maxDepth,
                "features": feature_list, "target": results.target
            }),
            "exported_at": exported_at
        }
        print("Exportando a Supabase 'model_results':", {k: (v[:100] + '...' if isinstance(v, str) and len(v) > 100 else v) for k, v in db_record.items()})
        response, error = supabase.table("model_results").insert(db_record).execute()
        if error and error[1]:
            print(f"Error de Supabase al exportar resultados: {error[1]}")
            raise HTTPException(status_code=500, detail=f"Error al guardar en BD: {error[1].get('message', 'Error desconocido')}")
        else:
             print("Exportación a Supabase exitosa.")
        return {"message": "Resultados exportados a la base de datos correctamente."}
    except Exception as e:
        print(f"Error EXCEPCIÓN al exportar resultados a Supabase: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error al exportar resultados: {type(e).__name__}")

@app.post("/reset", response_model=SimpleMessageResponse, tags=["Utility"],
          summary="Reinicia la sesión",
          description="Elimina archivos generados en 'uploads' y 'models'. ¡Irreversible!")
async def reset_session_endpoint():
    deleted_files_count = 0
    deleted_dirs_count = 0
    errors = []
    for directory in [UPLOAD_DIR, MODEL_DIR]:
        print(f"Limpiando directorio: {directory}")
        if not os.path.exists(directory):
             print(f"Directorio no encontrado, omitiendo: {directory}")
             continue
        for item_name in os.listdir(directory):
            if item_name.startswith('.'): continue
            item_path = os.path.join(directory, item_name)
            try:
                if os.path.isfile(item_path) or os.path.islink(item_path):
                    os.unlink(item_path)
                    deleted_files_count += 1
                elif os.path.isdir(item_path):
                    shutil.rmtree(item_path)
                    deleted_dirs_count += 1
            except Exception as e:
                error_msg = f"No se pudo eliminar {item_path}. Razón: {e}"
                print(error_msg)
                errors.append(error_msg)
    final_message = f"Sesión reiniciada. {deleted_files_count} archivos y {deleted_dirs_count} directorios eliminados de {UPLOAD_DIR} y {MODEL_DIR}."
    if errors:
        final_message += f" Se encontraron {len(errors)} errores durante la limpieza."
        print("Errores durante el reseteo:", errors)
        return {"message": final_message + " (con errores de eliminación)"}
    print(final_message)
    return {"message": "La sesión ha sido reiniciada correctamente."}

@app.get("/get-dataset-stats/{filename}", tags=["Data Analysis"])
async def get_dataset_stats(filename: str):
    """Obtiene estadísticas detalladas del dataset incluyendo datos eliminados y nulos"""
    try:
        file_path = get_file_path(filename)
        df = read_csv_robust(file_path)
        total_rows, total_columns = df.shape
        total_cells = total_rows * total_columns
        null_analysis = {col: {"count": int(df[col].isnull().sum()), "percentage": round((df[col].isnull().sum() / total_rows) * 100, 2)} for col in df.columns}
        duplicate_rows = df[df.duplicated(keep=False)]
        duplicate_analysis = {"total_duplicates": int(df.duplicated().sum()), "duplicate_groups": len(duplicate_rows.groupby(list(df.columns)))}
        dtype_analysis = {col: {"type": str(df[col].dtype), "unique_values": int(df[col].nunique()), "unique_percentage": round((df[col].nunique() / total_rows) * 100, 2)} for col in df.columns}
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        outlier_analysis = {}
        for col in numeric_cols:
            Q1, Q3 = df[col].quantile(0.25), df[col].quantile(0.75)
            IQR = Q3 - Q1
            outliers = df[(df[col] < (Q1 - 1.5 * IQR)) | (df[col] > (Q3 + 1.5 * IQR))]
            outlier_analysis[col] = {"count": len(outliers), "percentage": round((len(outliers) / total_rows) * 100, 2)}
        completeness_score = ((total_cells - df.isnull().sum().sum()) / total_cells) * 100
        uniqueness_score = ((total_rows - df.duplicated().sum()) / total_rows) * 100
        return {
            "dataset_info": {"filename": filename, "total_rows": total_rows, "total_columns": total_columns, "file_size_bytes": os.path.getsize(file_path)},
            "quality_metrics": {"completeness_score": round(completeness_score, 2), "uniqueness_score": round(uniqueness_score, 2)},
            "null_analysis": null_analysis, "duplicate_analysis": duplicate_analysis, "dtype_analysis": dtype_analysis, "outlier_analysis": outlier_analysis
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get-deleted-data/{filename}", tags=["Data Analysis"])
async def get_deleted_data(filename: str):
    """Obtiene información sobre datos que fueron eliminados durante la limpieza"""
    try:
        original_file = filename.replace("cleaned_", "")
        cleaned_file = f"cleaned_{original_file}" if not filename.startswith("cleaned_") else filename
        original_path = get_file_path(original_file)
        df_original = read_csv_robust(original_path)
        deleted_data_info = {"original_file": original_file, "cleaned_file": None, "original_rows": len(df_original), "deleted_rows_count": 0, "deleted_rows_sample": []}
        try:
            cleaned_path = get_file_path(cleaned_file)
            df_cleaned = read_csv_robust(cleaned_path)
            deleted_data_info["cleaned_file"] = cleaned_file
            if len(df_original) > len(df_cleaned):
                merged = df_original.merge(df_cleaned, how='left', indicator=True)
                deleted_df = merged[merged['_merge'] == 'left_only']
                deleted_data_info["deleted_rows_count"] = len(deleted_df)
                deleted_data_info["deleted_rows_sample"] = safe_to_json(deleted_df.head(50))
        except HTTPException as e:
            if e.status_code == 404:
                print("No cleaned file found, assuming no rows deleted.")
        return deleted_data_info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get-null-data/{filename}", tags=["Data Analysis"])
async def get_null_data(filename: str, limit: int = 100):
    """Obtiene información detallada sobre valores nulos en el dataset"""
    try:
        file_path = get_file_path(filename)
        df = read_csv_robust(file_path)
        null_data_info = {"filename": filename, "total_nulls": int(df.isnull().sum().sum()), "columns_with_nulls": {}, "rows_with_nulls_sample": []}
        for col in df.columns[df.isnull().any()].tolist():
            null_count = df[col].isnull().sum()
            null_data_info["columns_with_nulls"][col] = {"count": int(null_count), "percentage": round((null_count / len(df)) * 100, 2)}
        rows_with_nulls = df[df.isnull().any(axis=1)]
        null_data_info["rows_with_nulls_sample"] = safe_to_json(rows_with_nulls.head(limit))
        return null_data_info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Endpoint Raíz ---
@app.get("/", tags=["Utility"], summary="Verificar estado del API")
def read_root():
    """Devuelve un mensaje simple para confirmar que el backend está activo."""
    return {"message": "Backend ML/DL - Análisis de Datos está activo"}

# --- Ejecución Local (Opcional) ---
# import uvicorn
# if __name__ == "__main__":
#     print(f"Starting Uvicorn server on http://0.0.0.0:8000")
#     uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
