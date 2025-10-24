import pandas as pd
import numpy as np
import os
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
from sklearn.preprocessing import LabelEncoder

MODEL_DIR = os.getenv("MODEL_DIR", "./models")

def handle_nulls_for_training(df: pd.DataFrame, feature_cols: list, target_col: str) -> pd.DataFrame:
    """
    Maneja valores nulos específicamente para entrenamiento.
    El backend ignora completamente los nulos durante el entrenamiento.
    """
    print(f"Procesando valores nulos para entrenamiento...")
    
    # Crear una copia para no modificar el original
    df_clean = df.copy()
    
    # Verificar nulos en features y target
    null_counts = df_clean[feature_cols + [target_col]].isnull().sum()
    print(f"Nulos por columna: {null_counts.to_dict()}")
    
    # Eliminar filas con cualquier valor nulo en features o target
    df_clean = df_clean.dropna(subset=feature_cols + [target_col])
    
    print(f"Filas después de eliminar nulos: {df_clean.shape[0]}")
    print(f"Filas eliminadas: {df.shape[0] - df_clean.shape[0]}")
    
    return df_clean

def train_model(file_path: str, model_config: dict):
    """Entrena un modelo de clasificación y devuelve métricas detalladas."""
    df = pd.read_csv(file_path)
    df.columns = df.columns.str.strip().str.replace(' ', '_')
    
    print(f"Dataset original: {df.shape[0]} filas, {df.shape[1]} columnas")
    print(f"Valores nulos en dataset original: {df.isnull().sum().sum()}")

    # --- Preprocesamiento de datos ---
    features = model_config.get('features')
    if isinstance(features, str):
        feature_cols = [col.strip().replace(' ', '_') for col in features.split(',')]
    elif isinstance(features, list):
        feature_cols = [str(item).strip().replace(' ', '_') for item in features]
    else:
        feature_cols = []
    target_col = model_config['target'].strip().replace(' ', '_')
    
    if not all(col in df.columns for col in feature_cols):
        raise ValueError("Una o más columnas de features no se encontraron en el archivo.")
    if target_col not in df.columns:
        raise ValueError("La columna target no se encontró en el archivo.")

    # Usar la función especializada para manejar nulos en entrenamiento
    df = handle_nulls_for_training(df, feature_cols, target_col)

    if df.empty:
        raise ValueError("No hay datos suficientes después de eliminar filas con valores nulos.")

    # Codificar variables categóricas
    le = LabelEncoder()
    for col in df.select_dtypes(include=['object']).columns:
        df[col] = le.fit_transform(df[col])

    # La variable objetivo debe ser categórica para clasificación
    if df[target_col].nunique() > 10: # Heurística: si hay muchas clases, podría ser regresión
        # Convertir a problema de clasificación binaria simple (ej: por encima/debajo de la mediana)
        median_val = df[target_col].median()
        df[target_col] = (df[target_col] >= median_val).astype(int)

    X = df[feature_cols]
    y = df[target_col]

    # Añadir 'stratify=y' para un muestreo equilibrado
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, 
        test_size=model_config.get('testSize', 20) / 100.0,
        random_state=model_config.get('randomState', 42),
        stratify=y
    )

    # --- Entrenamiento del Modelo ---
    model = RandomForestClassifier(
        n_estimators=model_config.get('nEstimators', 100),
        max_depth=model_config.get('maxDepth', 10) or None, # Permitir None si maxDepth es 0
        random_state=model_config.get('randomState', 42)
    )
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    # --- Cálculo de Métricas ---
    # Añadir 'zero_division=0' para evitar errores en métricas
    accuracy = accuracy_score(y_test, y_pred) * 100
    precision = precision_score(y_test, y_pred, average='weighted', zero_division=0) * 100
    recall = recall_score(y_test, y_pred, average='weighted', zero_division=0) * 100
    f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0) * 100
    cm = confusion_matrix(y_test, y_pred).tolist()

    # Importancia de características
    feature_importance = sorted(
        zip(feature_cols, model.feature_importances_ * 100),
        key=lambda x: x[1], 
        reverse=True
    )

    # Guardar modelo
    model_name = os.path.basename(file_path).replace(".csv", f"_{model_config['modelType']}.pkl")
    joblib.dump(model, os.path.join(MODEL_DIR, model_name))

    return {
        "metrics": {
            "accuracy": round(accuracy, 2),
            "precision": round(precision, 2),
            "recall": round(recall, 2),
            "f1Score": round(f1, 2),
            "confusionMatrix": cm,
            "featureImportance": [{"name": name, "importance": round(imp, 2)} for name, imp in feature_importance]
        },
        "model_type": model_config['modelType'],
        "model_name": model_name,
        "data_info": {
            "training_rows": df.shape[0],  # Filas usadas para entrenamiento (sin nulos)
            "features_used": feature_cols,
            "target_column": target_col,
            "nulls_handled": "Eliminadas filas con valores nulos para entrenamiento"
        }
    }