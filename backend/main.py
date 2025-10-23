from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
import os, shutil
import pandas as pd
import numpy as np
import json
import math
from scipy import stats
from sklearn.preprocessing import MinMaxScaler, StandardScaler
from dotenv import load_dotenv
from database import supabase
from training import train_model

load_dotenv()
app = FastAPI(title="Backend ML/DL - Análisis de Datos")

# Permitir conexión desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:8081"],  # Origen del frontend de desarrollo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
MODEL_DIR = os.getenv("MODEL_DIR", "./models")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)

@app.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        return {"error": "Solo se permiten archivos .csv"}

    filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Registrar subida en Supabase
    supabase.table("training_jobs").insert({
        "filename": filename,
        "status": "uploaded",
        "created_at": datetime.utcnow().isoformat(),
    }).execute()

    return {"message": "Archivo subido correctamente", "filename": filename}

@app.get("/list-files")
async def list_files():
    """Lista todos los archivos CSV disponibles"""
    try:
        files = [f for f in os.listdir(UPLOAD_DIR) if f.endswith('.csv')]
        files_with_info = []
        for file in files:
            file_path = os.path.join(UPLOAD_DIR, file)
            file_info = {
                "filename": file,
                "size": os.path.getsize(file_path),
                "modified": os.path.getmtime(file_path),
                "is_cleaned": file.startswith('cleaned_')
            }
            files_with_info.append(file_info)
        
        # Ordenar por fecha de modificación (más reciente primero)
        files_with_info.sort(key=lambda x: x['modified'], reverse=True)
        
        return {"files": files_with_info}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get-csv-info/latest")
async def get_latest_csv_info():
    """Obtiene información del archivo CSV más reciente"""
    try:
        files = [f for f in os.listdir(UPLOAD_DIR) if f.endswith('.csv')]
        if not files:
            raise HTTPException(status_code=404, detail="No se encontraron archivos CSV")
        
        # Obtener el archivo más reciente
        latest_file = max(files, key=lambda x: os.path.getmtime(os.path.join(UPLOAD_DIR, x)))
        file_path = os.path.join(UPLOAD_DIR, latest_file)
        
        df = pd.read_csv(file_path)
        
        stats = {
            "rows": len(df),
            "columns": len(df.columns),
            "nullValues": int(df.isnull().sum().sum()),
            "duplicates": int(df.duplicated().sum()),
        }
        
        preview_data_json = df.head(6).to_json(orient='records')
        preview_data = json.loads(preview_data_json)

        return {
            "stats": stats,
            "preview_data": preview_data,
            "headers": list(df.columns),
            "actual_filename": latest_file
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get-csv-info/{filename}")
async def get_csv_info(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)

    if not os.path.exists(file_path):
        # Intentar encontrar el archivo más reciente si el específico no existe
        available_files = [f for f in os.listdir(UPLOAD_DIR) if f.endswith('.csv')]
        if available_files:
            # Ordenar por fecha de modificación y tomar el más reciente
            latest_file = max(available_files, key=lambda x: os.path.getmtime(os.path.join(UPLOAD_DIR, x)))
            file_path = os.path.join(UPLOAD_DIR, latest_file)
            print(f"Archivo {filename} no encontrado, usando el más reciente: {latest_file}")
        else:
            raise HTTPException(status_code=404, detail="No se encontraron archivos CSV")

    try:
        df = pd.read_csv(file_path)
        
        stats = {
            "rows": len(df),
            "columns": len(df.columns),
            "nullValues": int(df.isnull().sum().sum()),
            "duplicates": int(df.duplicated().sum()),
        }
        
        preview_data_json = df.head(6).to_json(orient='records')
        preview_data = json.loads(preview_data_json)

        return {
            "stats": stats,
            "preview_data": preview_data,
            "headers": list(df.columns),
            "actual_filename": os.path.basename(file_path)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class CleanDataRequest(BaseModel):
    filename: str
    operations: List[str]

@app.post("/clean-data")
async def clean_data_route(request: CleanDataRequest):
    file_path = os.path.join(UPLOAD_DIR, request.filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="El archivo CSV no existe")

    try:
        print(f"Request: {request}")
        print(f"File path: {file_path}")
        
        # Leer datos originales para visualización
        df_original = pd.read_csv(file_path)
        print(f"Original dataframe shape: {df_original.shape}")
        
        # Crear una copia para limpieza (para entrenamiento)
        df_cleaned = df_original.copy()
        
        # --- Apply cleaning operations to the cleaned copy ---
        numeric_cols = df_cleaned.select_dtypes(include=np.number).columns.tolist()

        if "remove-na" in request.operations:
            df_cleaned.dropna(inplace=True)
        
        if "fill-mean" in request.operations:
            df_cleaned.fillna(df_cleaned.mean(numeric_only=True), inplace=True)

        if "fill-median" in request.operations:
            df_cleaned.fillna(df_cleaned.median(numeric_only=True), inplace=True)
            
        if "interpolate" in request.operations:
            df_cleaned.interpolate(method='linear', limit_direction='forward', axis=0, inplace=True)

        if "remove-duplicates" in request.operations:
            df_cleaned.drop_duplicates(inplace=True)

        if "keep-first" in request.operations:
            df_cleaned.drop_duplicates(keep='first', inplace=True)

        if "remove-outliers" in request.operations and numeric_cols:
            df_cleaned = df_cleaned[(np.abs(stats.zscore(df_cleaned[numeric_cols])) < 3).all(axis=1)]

        if "cap-outliers" in request.operations and numeric_cols:
            Q1 = df_cleaned[numeric_cols].quantile(0.25)
            Q3 = df_cleaned[numeric_cols].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            df_cleaned[numeric_cols] = df_cleaned[numeric_cols].clip(lower=lower_bound, upper=upper_bound, axis=1)

        if "normalize" in request.operations and numeric_cols:
            scaler = MinMaxScaler()
            df_cleaned[numeric_cols] = scaler.fit_transform(df_cleaned[numeric_cols])

        if "standardize" in request.operations and numeric_cols:
            scaler = StandardScaler()
            df_cleaned[numeric_cols] = scaler.fit_transform(df_cleaned[numeric_cols])
            
        if "log-transform" in request.operations and numeric_cols:
            for col in numeric_cols:
                if (df_cleaned[col] >= 0).all():
                    df_cleaned[col] = df_cleaned[col].apply(np.log1p)

        # --- Stats para datos originales (para mostrar en frontend) ---
        original_stats = {
            "rows": len(df_original),
            "columns": len(df_original.columns),
            "nullValues": int(df_original.isnull().sum().sum()),
            "duplicates": int(df_original.duplicated().sum()),
        }
        
        # --- Stats para datos limpios (para entrenamiento) ---
        cleaned_stats = {
            "rows": len(df_cleaned),
            "columns": len(df_cleaned.columns),
            "nullValues": int(df_cleaned.isnull().sum().sum()),
            "duplicates": int(df_cleaned.duplicated().sum()),
        }
        
        # Usar datos originales para preview (mantener nulos visibles)
        preview_data_json = df_original.head(6).to_json(orient='records')
        preview_data = json.loads(preview_data_json)

        # Guardar datos limpios para entrenamiento
        cleaned_filename = f"cleaned_{request.filename}"
        cleaned_file_path = os.path.join(UPLOAD_DIR, cleaned_filename)
        print("Saving cleaned file for training...")
        df_cleaned.to_csv(cleaned_file_path, index=False)

        return {
            "message": "Datos limpiados correctamente",
            "cleaned_filename": cleaned_filename,
            "original_stats": original_stats,  # Stats de datos originales
            "cleaned_stats": cleaned_stats,    # Stats de datos limpios
            "preview_data": preview_data,      # Preview de datos originales (con nulos)
            "headers": list(df_original.columns),
        }
    except Exception as e:
        print(e)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/view-data/{filename}")
async def view_data(filename: str, page: int = 1, page_size: int = 50):
    file_path = os.path.join(UPLOAD_DIR, filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="El archivo CSV no existe")

    try:
        df = pd.read_csv(file_path)
        
        total_rows = len(df)
        total_pages = math.ceil(total_rows / page_size)
        
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        
        df_page = df.iloc[start_index:end_index]
        
        page_data_json = df_page.to_json(orient='records')
        page_data = json.loads(page_data_json)
        
        return {
            "pagination": {
                "total_rows": total_rows,
                "total_pages": total_pages,
                "current_page": page,
                "page_size": page_size
            },
            "data": page_data,
            "headers": list(df.columns)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/train-model")
def train_model_route(
    filename: str = Form(...),
    modelType: str = Form(...),
    testSize: int = Form(...),
    randomState: int = Form(...),
    nEstimators: int = Form(...),
    maxDepth: int = Form(...),
    features: str = Form(...),
    target: str = Form(...)
):
    """
    Entrena un modelo con el CSV indicado y una configuración completa.
    """
    file_path = os.path.join(UPLOAD_DIR, filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="El archivo CSV no existe")

    model_config = {
        "modelType": modelType,
        "testSize": testSize,
        "randomState": randomState,
        "nEstimators": nEstimators,
        "maxDepth": maxDepth,
        "features": features,
        "target": target,
    }

    try:
        result = train_model(file_path, model_config)
        
        supabase.table("training_jobs").update({
            "status": "trained",
            "model_type": modelType,
            "metrics": result.get("metrics"),
            "model_name": result.get("model_name")
        }).eq("filename", filename).execute()

        return {"message": "Entrenamiento completado", "result": result}
    except Exception as e:
        supabase.table("training_jobs").update({
            "status": "error",
            "error_message": str(e)
        }).eq("filename", filename).execute()
        raise HTTPException(status_code=500, detail=str(e))

class ModelResults(BaseModel):
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
    maxDepth: int
    features: str
    target: str

@app.get("/get-dataset-stats/{filename}")
async def get_dataset_stats(filename: str):
    """Obtiene estadísticas detalladas del dataset incluyendo datos eliminados y nulos"""
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="El archivo CSV no existe")
    
    try:
        df = pd.read_csv(file_path)
        
        # Estadísticas básicas
        total_rows = len(df)
        total_columns = len(df.columns)
        total_cells = total_rows * total_columns
        
        # Análisis de valores nulos por columna
        null_analysis = {}
        for col in df.columns:
            null_count = df[col].isnull().sum()
            null_percentage = (null_count / total_rows) * 100
            null_analysis[col] = {
                "count": int(null_count),
                "percentage": round(null_percentage, 2),
                "rows_with_nulls": df[df[col].isnull()].index.tolist()[:10]  # Primeras 10 filas con nulos
            }
        
        # Análisis de duplicados
        duplicate_rows = df[df.duplicated(keep=False)]
        duplicate_analysis = {
            "total_duplicates": int(df.duplicated().sum()),
            "duplicate_groups": len(duplicate_rows.groupby(list(df.columns))),
            "duplicate_rows": duplicate_rows.index.tolist()[:20]  # Primeras 20 filas duplicadas
        }
        
        # Análisis de tipos de datos
        dtype_analysis = {}
        for col in df.columns:
            dtype_analysis[col] = {
                "type": str(df[col].dtype),
                "unique_values": int(df[col].nunique()),
                "unique_percentage": round((df[col].nunique() / total_rows) * 100, 2)
            }
        
        # Análisis de outliers para columnas numéricas
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        outlier_analysis = {}
        for col in numeric_cols:
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            
            outliers = df[(df[col] < lower_bound) | (df[col] > upper_bound)]
            outlier_analysis[col] = {
                "count": len(outliers),
                "percentage": round((len(outliers) / total_rows) * 100, 2),
                "outlier_rows": outliers.index.tolist()[:10],  # Primeras 10 filas con outliers
                "bounds": {
                    "lower": round(lower_bound, 2),
                    "upper": round(upper_bound, 2)
                }
            }
        
        # Calidad general del dataset
        completeness_score = ((total_cells - df.isnull().sum().sum()) / total_cells) * 100
        uniqueness_score = ((total_rows - df.duplicated().sum()) / total_rows) * 100
        
        return {
            "dataset_info": {
                "filename": filename,
                "total_rows": total_rows,
                "total_columns": total_columns,
                "total_cells": total_cells,
                "file_size_bytes": os.path.getsize(file_path)
            },
            "quality_metrics": {
                "completeness_score": round(completeness_score, 2),
                "uniqueness_score": round(uniqueness_score, 2),
                "overall_quality": round((completeness_score + uniqueness_score) / 2, 2)
            },
            "null_analysis": null_analysis,
            "duplicate_analysis": duplicate_analysis,
            "dtype_analysis": dtype_analysis,
            "outlier_analysis": outlier_analysis,
            "summary": {
                "total_nulls": int(df.isnull().sum().sum()),
                "total_duplicates": int(df.duplicated().sum()),
                "total_outliers": sum([outlier_analysis[col]["count"] for col in numeric_cols]),
                "numeric_columns": len(numeric_cols),
                "categorical_columns": len(df.columns) - len(numeric_cols)
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get-deleted-data/{filename}")
async def get_deleted_data(filename: str):
    """Obtiene información sobre datos que fueron eliminados durante la limpieza"""
    try:
        # Buscar archivo original y limpio
        original_file = filename.replace("cleaned_", "") if filename.startswith("cleaned_") else filename
        cleaned_file = f"cleaned_{original_file}" if not filename.startswith("cleaned_") else filename
        
        original_path = os.path.join(UPLOAD_DIR, original_file)
        cleaned_path = os.path.join(UPLOAD_DIR, cleaned_file)
        
        if not os.path.exists(original_path):
            raise HTTPException(status_code=404, detail="Archivo original no encontrado")
        
        df_original = pd.read_csv(original_path)
        
        deleted_data_info = {
            "original_file": original_file,
            "cleaned_file": cleaned_file if os.path.exists(cleaned_path) else None,
            "original_rows": len(df_original),
            "deleted_rows": [],
            "deletion_summary": {}
        }
        
        if os.path.exists(cleaned_path):
            df_cleaned = pd.read_csv(cleaned_path)
            deleted_rows_count = len(df_original) - len(df_cleaned)
            
            # Identificar qué filas fueron eliminadas
            if deleted_rows_count > 0:
                # Crear un índice para comparar
                original_index = set(df_original.index)
                cleaned_index = set(df_cleaned.index)
                deleted_indices = list(original_index - cleaned_index)[:50]  # Primeras 50 filas eliminadas
                
                deleted_data_info["deleted_rows"] = [
                    {
                        "index": idx,
                        "data": df_original.iloc[idx].to_dict()
                    } for idx in deleted_indices
                ]
            
            deleted_data_info["deletion_summary"] = {
                "rows_deleted": deleted_rows_count,
                "rows_remaining": len(df_cleaned),
                "deletion_percentage": round((deleted_rows_count / len(df_original)) * 100, 2)
            }
        else:
            deleted_data_info["deletion_summary"] = {
                "rows_deleted": 0,
                "rows_remaining": len(df_original),
                "deletion_percentage": 0,
                "note": "No se ha realizado limpieza aún"
            }
        
        return deleted_data_info
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get-null-data/{filename}")
async def get_null_data(filename: str, limit: int = 100):
    """Obtiene información detallada sobre valores nulos en el dataset"""
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="El archivo CSV no existe")
    
    try:
        df = pd.read_csv(file_path)
        
        null_data_info = {
            "filename": filename,
            "total_nulls": int(df.isnull().sum().sum()),
            "total_rows": len(df),
            "null_percentage": round((df.isnull().sum().sum() / (len(df) * len(df.columns))) * 100, 2),
            "columns_with_nulls": {},
            "rows_with_nulls": [],
            "null_patterns": {}
        }
        
        # Análisis por columna
        for col in df.columns:
            null_count = df[col].isnull().sum()
            if null_count > 0:
                null_rows = df[df[col].isnull()].index.tolist()[:limit]
                null_data_info["columns_with_nulls"][col] = {
                    "count": int(null_count),
                    "percentage": round((null_count / len(df)) * 100, 2),
                    "sample_rows": null_rows,
                    "sample_data": [
                        {
                            "row_index": idx,
                            "row_data": df.iloc[idx].to_dict()
                        } for idx in null_rows[:10]  # Solo primeras 10 filas
                    ]
                }
        
        # Análisis por fila
        rows_with_nulls = df[df.isnull().any(axis=1)]
        if len(rows_with_nulls) > 0:
            null_data_info["rows_with_nulls"] = [
                {
                    "row_index": idx,
                    "null_columns": df.columns[df.iloc[idx].isnull()].tolist(),
                    "null_count": int(df.iloc[idx].isnull().sum()),
                    "row_data": df.iloc[idx].to_dict()
                } for idx in rows_with_nulls.index[:limit]
            ]
        
        # Patrones de nulos (filas completamente nulas, etc.)
        completely_null_rows = df[df.isnull().all(axis=1)]
        null_data_info["null_patterns"] = {
            "completely_null_rows": len(completely_null_rows),
            "partially_null_rows": len(rows_with_nulls) - len(completely_null_rows),
            "columns_with_all_nulls": df.columns[df.isnull().all()].tolist()
        }
        
        return null_data_info
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/export-to-db")
async def export_to_db(results: ModelResults):
    try:
        db_record = {
            "model_type": results.modelType,
            "model_name": results.model_name,
            "accuracy": results.accuracy,
            "precision": results.precision,
            "recall": results.recall,
            "f1_score": results.f1Score,
            "confusion_matrix": results.confusionMatrix,
            "feature_importance": results.featureImportance,
            "training_parameters": {
                "test_size": results.testSize,
                "random_state": results.randomState,
                "n_estimators": results.nEstimators,
                "max_depth": results.maxDepth,
                "features": results.features,
                "target": results.target
            }
        }
        
        supabase.table("model_results").insert(db_record).execute()
        
        return {"message": "Resultados exportados a la base de datos correctamente."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
