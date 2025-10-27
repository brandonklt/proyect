import pandas as pd
import numpy as np
import os
import json
import joblib
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, roc_curve, auc, roc_auc_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from typing import Any, Dict, List

MODEL_DIR = os.getenv("MODEL_DIR", "./models")

# --- Funciones Utilitarias ---

def clean_record_for_json(data: Any) -> Any:
    if isinstance(data, dict):
        return {key: clean_record_for_json(value) for key, value in data.items()}
    if isinstance(data, list):
        return [clean_record_for_json(element) for element in data]
    if isinstance(data, (np.floating, float)) and not np.isfinite(data):
        return None
    if pd.isna(data):
        return None
    return data

def handle_nulls_for_training(df: pd.DataFrame, feature_cols: list, target_col: str) -> pd.DataFrame:
    df_clean = df.copy().dropna(subset=feature_cols + [target_col])
    return df_clean

# --- Lógica de Entrenamiento PyTorch (Dinámica) ---

class DynamicMLP(nn.Module):
    """Un Perceptrón Multicapa construido dinámicamente."""
    def __init__(self, input_size: int, hidden_layers: List[int], num_classes: int, activation_fn: nn.Module):
        super(DynamicMLP, self).__init__()
        layers = []
        prev_size = input_size
        
        for hidden_size in hidden_layers:
            layers.append(nn.Linear(prev_size, hidden_size))
            layers.append(activation_fn())
            layers.append(nn.Dropout(0.3))
            prev_size = hidden_size
            
        layers.append(nn.Linear(prev_size, num_classes))
        
        self.network = nn.Sequential(*layers)

    def forward(self, x):
        return self.network(x)

def get_activation_function(name: str) -> nn.Module:
    if name.lower() == 'relu':
        return nn.ReLU
    elif name.lower() == 'tanh':
        return nn.Tanh
    elif name.lower() == 'sigmoid':
        return nn.Sigmoid
    else:
        raise ValueError(f"Función de activación no soportada: {name}")

def train_pytorch_mlp(df: pd.DataFrame, feature_cols: List[str], target_col: str, model_config: Dict[str, Any], file_path: str):
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(df[feature_cols])
    y = df[target_col].values

    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=model_config.get('testSize', 20) / 100.0,
        random_state=model_config.get('randomState', 42), stratify=y
    )

    X_train_tensor = torch.FloatTensor(X_train)
    y_train_tensor = torch.LongTensor(y_train)
    X_test_tensor = torch.FloatTensor(X_test)
    y_test_tensor = torch.LongTensor(y_test)

    train_dataset = TensorDataset(X_train_tensor, y_train_tensor)
    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)

    input_size = X_train.shape[1]
    num_classes = len(np.unique(y_train))
    hidden_layers = model_config.get('hiddenLayers', [128, 64, 32])
    activation_fn = get_activation_function(model_config.get('activation', 'ReLU'))

    model = DynamicMLP(input_size, hidden_layers, num_classes, activation_fn)
    
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=model_config.get('learningRate', 0.001))
    epochs = model_config.get('epochs', 50)

    loss_history = []
    model.train()
    for epoch in range(epochs):
        epoch_loss = 0.0
        num_batches = 0
        for batch_X, batch_y in train_loader:
            optimizer.zero_grad()
            outputs = model(batch_X)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item()
            num_batches += 1
        avg_epoch_loss = epoch_loss / num_batches
        loss_history.append(avg_epoch_loss)

    model.eval()
    with torch.no_grad():
        y_pred_logits = model(X_test_tensor)
        y_pred_probs = torch.nn.functional.softmax(y_pred_logits, dim=1).numpy()
        y_pred = np.argmax(y_pred_probs, axis=1)
        y_test_np = y_test_tensor.numpy()

    accuracy = accuracy_score(y_test_np, y_pred) * 100
    precision = precision_score(y_test_np, y_pred, average='weighted', zero_division=0) * 100
    recall = recall_score(y_test_np, y_pred, average='weighted', zero_division=0) * 100
    f1 = f1_score(y_test_np, y_pred, average='weighted', zero_division=0) * 100
    cm = confusion_matrix(y_test_np, y_pred).tolist()

    roc_auc = None
    roc_curve_data = None
    if num_classes == 2:
        fpr, tpr, _ = roc_curve(y_test_np, y_pred_probs[:, 1])
        roc_auc = auc(fpr, tpr)
        roc_curve_data = {"fpr": fpr.tolist(), "tpr": tpr.tolist()}
    elif num_classes > 2:
        roc_auc = roc_auc_score(y_test_np, y_pred_probs, multi_class='ovr', average='weighted')

    model_name = os.path.basename(file_path).replace(".csv", f"_{model_config['modelType']}.pt")
    torch.save(model.state_dict(), os.path.join(MODEL_DIR, model_name))

    metrics_dict = {
        "accuracy": round(accuracy, 2),
        "precision": round(precision, 2),
        "recall": round(recall, 2),
        "f1Score": round(f1, 2),
        "confusionMatrix": cm,
        "scatterPlotData": {"actual": y_test_np.tolist(), "predicted": y_pred.tolist()},
        "lossHistory": loss_history,
        "rocCurve": roc_curve_data,
        "auc": roc_auc
    }
    
    return {
        "metrics": clean_record_for_json(metrics_dict),
        "model_type": model_config['modelType'],
        "model_name": model_name
    }

# --- Lógica de Entrenamiento Scikit-learn ---

def train_sklearn_random_forest(df: pd.DataFrame, feature_cols: List[str], target_col: str, model_config: Dict[str, Any], file_path: str):
    X = df[feature_cols]
    y = df[target_col]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=model_config.get('testSize', 20) / 100.0,
        random_state=model_config.get('randomState', 42), stratify=y
    )

    model = RandomForestClassifier(
        n_estimators=model_config.get('nEstimators', 100),
        max_depth=model_config.get('maxDepth', 10) or None,
        random_state=model_config.get('randomState', 42)
    )
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)

    accuracy = accuracy_score(y_test, y_pred) * 100
    precision = precision_score(y_test, y_pred, average='weighted', zero_division=0) * 100
    recall = recall_score(y_test, y_pred, average='weighted', zero_division=0) * 100
    f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0) * 100
    cm = confusion_matrix(y_test, y_pred).tolist()

    feature_importance = sorted(
        zip(feature_cols, model.feature_importances_ * 100),
        key=lambda x: x[1], reverse=True
    )

    num_classes = y.nunique()
    roc_auc = None
    roc_curve_data = None
    if num_classes == 2:
        fpr, tpr, _ = roc_curve(y_test, y_pred_proba[:, 1])
        roc_auc = auc(fpr, tpr)
        roc_curve_data = {"fpr": fpr.tolist(), "tpr": tpr.tolist()}
    elif num_classes > 2:
        roc_auc = roc_auc_score(y_test, y_pred_proba, multi_class='ovr', average='weighted')

    model_name = os.path.basename(file_path).replace(".csv", f"_{model_config['modelType']}.pkl")
    joblib.dump(model, os.path.join(MODEL_DIR, model_name))

    metrics_dict = {
        "accuracy": round(accuracy, 2),
        "precision": round(precision, 2),
        "recall": round(recall, 2),
        "f1Score": round(f1, 2),
        "confusionMatrix": cm,
        "featureImportance": [{"name": name, "importance": round(imp, 2)} for name, imp in feature_importance],
        "rocCurve": roc_curve_data,
        "auc": roc_auc
    }

    return {
        "metrics": clean_record_for_json(metrics_dict),
        "model_type": model_config['modelType'],
        "model_name": model_name
    }

# --- Función Principal (Despachador) ---

def train_model(file_path: str, model_config: dict):
    df = pd.read_csv(file_path)
    df.columns = df.columns.str.strip().str.replace(' ', '_', regex=True)

    feature_cols = [str(col).strip().replace(' ', '_') for col in model_config.get('features', [])]
    target_col = model_config.get('target', '').strip().replace(' ', '_')

    if not all(col in df.columns for col in feature_cols) or target_col not in df.columns:
        raise ValueError("Columnas de features o target no encontradas.")

    df = handle_nulls_for_training(df, feature_cols, target_col)
    if df.empty:
        raise ValueError("No hay datos suficientes tras eliminar filas con nulos.")

    label_encoders = {}
    for col in df.select_dtypes(include=['object']).columns:
        if col in feature_cols or col == target_col:
            le = LabelEncoder()
            df[col] = le.fit_transform(df[col])
            label_encoders[col] = le

    if df[target_col].nunique() > 50: # Heurística para evitar regresión accidental
        median_val = df[target_col].median()
        df[target_col] = (df[target_col] >= median_val).astype(int)

    model_type = model_config.get('modelType')
    if model_type == 'RandomForestClassifier':
        return train_sklearn_random_forest(df, feature_cols, target_col, model_config, file_path)
    elif model_type == 'NeuralNetwork':
        return train_pytorch_mlp(df, feature_cols, target_col, model_config, file_path)
    else:
        raise ValueError(f"Tipo de modelo no soportado: {model_type}")
