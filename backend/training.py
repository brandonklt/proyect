import pandas as pd
import numpy as np
import os
import joblib
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score
import torch
import torch.nn as nn

MODEL_DIR = os.getenv("MODEL_DIR", "./models")

def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """Limpieza básica de datos"""
    df = df.dropna()  # eliminar filas con valores nulos
    df = df.select_dtypes(include=[np.number])  # solo columnas numéricas
    return df


def train_model(file_path: str, model_type: str = "linear_regression"):
    """Entrena un modelo básico dependiendo del tipo seleccionado"""
    df = pd.read_csv(file_path)
    df = clean_data(df)

    # Validación rápida
    if df.shape[1] < 2:
        raise ValueError("El dataset necesita al menos una columna de entrada y una de salida")

    X = df.iloc[:, :-1].values
    y = df.iloc[:, -1].values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    if model_type == "linear_regression":
        model = LinearRegression()
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)

        metrics = {
            "mse": mean_squared_error(y_test, y_pred),
            "r2": r2_score(y_test, y_pred)
        }

        model_name = os.path.basename(file_path).replace(".csv", "_linear.pkl")
        joblib.dump(model, os.path.join(MODEL_DIR, model_name))

    elif model_type == "torch_nn":
        # Ejemplo simple de red neuronal con PyTorch
        X_train_tensor = torch.tensor(X_train, dtype=torch.float32)
        y_train_tensor = torch.tensor(y_train, dtype=torch.float32).view(-1, 1)

        model = nn.Sequential(
            nn.Linear(X_train.shape[1], 16),
            nn.ReLU(),
            nn.Linear(16, 1)
        )

        criterion = nn.MSELoss()
        optimizer = torch.optim.Adam(model.parameters(), lr=0.01)

        for epoch in range(200):
            optimizer.zero_grad()
            outputs = model(X_train_tensor)
            loss = criterion(outputs, y_train_tensor)
            loss.backward()
            optimizer.step()

        torch.save(model.state_dict(), os.path.join(MODEL_DIR, "model_torch.pt"))
        metrics = {"loss": float(loss.item())}

    else:
        raise ValueError(f"Modelo '{model_type}' no soportado todavía")

    return {"metrics": metrics, "model_type": model_type}
