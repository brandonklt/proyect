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

@app.get("/get-csv-info/{filename}")
async def get_csv_info(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="El archivo CSV no existe")

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
        df = pd.read_csv(file_path)
        print(f"Dataframe shape: {df.shape}")
        
        # --- Apply cleaning operations ---
        numeric_cols = df.select_dtypes(include=np.number).columns.tolist()

        if "remove-na" in request.operations:
            df.dropna(inplace=True)
        
        if "fill-mean" in request.operations:
            df.fillna(df.mean(numeric_only=True), inplace=True)

        if "fill-median" in request.operations:
            df.fillna(df.median(numeric_only=True), inplace=True)
            
        if "interpolate" in request.operations:
            df.interpolate(method='linear', limit_direction='forward', axis=0, inplace=True)

        if "remove-duplicates" in request.operations:
            df.drop_duplicates(inplace=True)

        if "keep-first" in request.operations:
            df.drop_duplicates(keep='first', inplace=True)

        if "remove-outliers" in request.operations and numeric_cols:
            df = df[(np.abs(stats.zscore(df[numeric_cols])) < 3).all(axis=1)]

        if "cap-outliers" in request.operations and numeric_cols:
            Q1 = df[numeric_cols].quantile(0.25)
            Q3 = df[numeric_cols].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            df[numeric_cols] = df[numeric_cols].clip(lower=lower_bound, upper=upper_bound, axis=1)

        if "normalize" in request.operations and numeric_cols:
            scaler = MinMaxScaler()
            df[numeric_cols] = scaler.fit_transform(df[numeric_cols])

        if "standardize" in request.operations and numeric_cols:
            scaler = StandardScaler()
            df[numeric_cols] = scaler.fit_transform(df[numeric_cols])
            
        if "log-transform" in request.operations and numeric_cols:
            for col in numeric_cols:
                if (df[col] >= 0).all():
                    df[col] = df[col].apply(np.log1p)

        # --- Final stats and preview ---
        cleaned_stats = {
            "rows": len(df),
            "columns": len(df.columns),
            "nullValues": int(df.isnull().sum().sum()),
            "duplicates": int(df.duplicated().sum()),
        }
        
        preview_data_json = df.head(6).to_json(orient='records')
        preview_data = json.loads(preview_data_json)

        cleaned_filename = f"cleaned_{request.filename}"
        cleaned_file_path = os.path.join(UPLOAD_DIR, cleaned_filename)
        print("Saving cleaned file...")
        df.to_csv(cleaned_file_path, index=False)

        return {
            "message": "Datos limpiados correctamente",
            "cleaned_filename": cleaned_filename,
            "cleaned_stats": cleaned_stats,
            "preview_data": preview_data,
            "headers": list(df.columns),
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
