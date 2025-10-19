from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import os, shutil
from dotenv import load_dotenv
from database import supabase
from training import train_model

load_dotenv()
app = FastAPI(title="Backend ML/DL - Análisis de Datos")

# Permitir conexión desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8081"],  # Origen del frontend de desarrollo
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


@app.post("/train-model")
def train_model_route(filename: str = Form(...), model_type: str = Form("linear_regression")):
    """
    Entrena un modelo con el CSV indicado.
    """
    file_path = os.path.join(UPLOAD_DIR, filename)

    if not os.path.exists(file_path):
        return {"error": "El archivo CSV no existe"}

    try:
        result = train_model(file_path, model_type)
        supabase.table("training_jobs").insert({
            "filename": filename,
            "status": "trained",
            "model_type": model_type,
            "metrics": result.get("metrics"),
            "created_at": datetime.utcnow().isoformat(),
        }).execute()
        return {"message": "Entrenamiento completado", "result": result}
    except Exception as e:
        supabase.table("training_jobs").insert({
            "filename": filename,
            "status": "error",
            "error_message": str(e),
            "created_at": datetime.utcnow().isoformat(),
        }).execute()
        return {"error": str(e)}
