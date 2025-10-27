import { useState, useEffect } from "react";
import { ArrowLeft, Brain, Cpu, Zap } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const TrainModels = () => {
  const [isTraining, setIsTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [trainingStatus, setTrainingStatus] = useState(
    "Esperando configuración..."
  );

  // Common state
  const [modelType, setModelType] = useState("RandomForestClassifier");
  const [testSize, setTestSize] = useState(20);
  const [randomState, setRandomState] = useState(42);
  const [features, setFeatures] = useState(
    "Units Sold, Unit Price, Region, Payment Method"
  );
  const [target, setTarget] = useState("Total Revenue");

  // Sklearn state
  const [nEstimators, setNEstimators] = useState(100);
  const [maxDepth, setMaxDepth] = useState(10);

  // PyTorch state
  const [epochs, setEpochs] = useState(50);
  const [learningRate, setLearningRate] = useState(0.001);
  const [hiddenLayers, setHiddenLayers] = useState("[128, 64, 32]");
  const [activation, setActivation] = useState("ReLU");

  const { toast } = useToast();
  const navigate = useNavigate();

  const handleStartTraining = async () => {
    const fileName =
      localStorage.getItem("cleanedFileName") ||
      localStorage.getItem("uploadedFileName");
    if (!fileName) {
      toast({
        title: "Error",
        description: "No se encontró archivo para entrenar.",
        variant: "destructive",
      });
      return;
    }

    setIsTraining(true);
    setProgress(0);
    setTrainingStatus("Enviando configuración al backend...");

    const formData = new FormData();
    formData.append("filename", fileName);
    formData.append("modelType", modelType);
    formData.append("testSize", String(testSize));
    formData.append("randomState", String(randomState));
    formData.append("features", features);
    formData.append("target", target);

    if (modelType === "RandomForestClassifier") {
      formData.append("nEstimators", String(nEstimators));
      formData.append("maxDepth", String(maxDepth));
    } else if (modelType === "NeuralNetwork") {
      formData.append("epochs", String(epochs));
      formData.append("learningRate", String(learningRate));
      formData.append("hiddenLayers", hiddenLayers);
      formData.append("activation", activation);
    }

    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(90, prev + 5));
    }, 500);

    try {
      const response = await fetch("http://127.0.0.1:8000/train-model", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      const backendResult = await response.json();

      if (!response.ok) {
        throw new Error(backendResult.detail || "Error en el entrenamiento");
      }

      setTrainingStatus("Procesando resultados...");
      setProgress(100);

      const datosProcesadosId = localStorage.getItem("datosProcesadosId");
      if (!datosProcesadosId) {
        console.warn("No se encontró el ID de datos procesados");
      }

      const finalResults = {
        metrics: backendResult.result.metrics,
        accuracy: backendResult.result.metrics.accuracy,
        precision: backendResult.result.metrics.precision,
        recall: backendResult.result.metrics.recall,
        f1Score: backendResult.result.metrics.f1Score,
        confusionMatrix: backendResult.result.metrics.confusionMatrix,
        featureImportance: backendResult.result.metrics.featureImportance || [],
        trainingProgress: backendResult.result.metrics.trainingProgress || {
          epochs: [],
          loss: [],
        },
        scatterPlotData: backendResult.result.metrics.scatterPlotData,
        modelType: backendResult.result.model_type,
        datos_procesados_id: datosProcesadosId
          ? parseInt(datosProcesadosId)
          : null,
        testSize,
        randomState,
        features: features,
        target,
        timestamp: new Date().toISOString(),
        ...(modelType === "RandomForestClassifier"
          ? { nEstimators, maxDepth }
          : {}),
        ...(modelType === "NeuralNetwork"
          ? {
              epochs,
              learningRate,
              hiddenLayers: JSON.parse(hiddenLayers),
              activation,
            }
          : {}),
      };

      console.log("DEBUG: Results being saved to localStorage", finalResults);
      localStorage.setItem("mlPipelineResults", JSON.stringify(finalResults));
      toast({
        title: "Entrenamiento completado",
        description: `${modelType} entrenado con accuracy de ${finalResults.accuracy}%`,
      });
      setTimeout(() => navigate("/results"), 1000);
    } catch (error: Error | unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      clearInterval(progressInterval);
      toast({
        title: "Error en el entrenamiento",
        description: errorMessage,
        variant: "destructive",
      });
      setIsTraining(false);
      setProgress(0);
      setTrainingStatus("Error en el proceso");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <Link
            to="/"
            className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al dashboard
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Brain className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Entrenar Modelos
              </h1>
              <p className="text-muted-foreground">
                Configura y entrena modelos de Scikit-learn y PyTorch
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {/* Columna de Configuración */}
          <div className="lg:col-span-2">
            <Card className="p-6 shadow-card">
              <h3 className="text-xl font-semibold mb-6">
                Configuración del Entrenamiento
              </h3>
              <div className="space-y-6">
                {/* --- Selección de Modelo --- */}
                <div>
                  <Label>Tipo de Modelo</Label>
                  <Select value={modelType} onValueChange={setModelType}>
                    <SelectTrigger className="w-full mt-2">
                      <SelectValue placeholder="Selecciona un tipo de modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RandomForestClassifier">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-yellow-500" /> Random
                          Forest Classifier
                        </div>
                      </SelectItem>
                      <SelectItem value="NeuralNetwork">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-blue-500" /> Red Neuronal
                          (PyTorch)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* --- Hiperparámetros Condicionales --- */}
                {modelType === "RandomForestClassifier" && (
                  <>
                    <h4 className="text-lg font-medium pt-4 border-t">
                      Hiperparámetros de Scikit-learn
                    </h4>
                    <div>
                      <Label htmlFor="n-estimators">N° de estimadores</Label>
                      <Slider
                        value={[nEstimators]}
                        max={500}
                        step={10}
                        onValueChange={(v) => setNEstimators(v[0])}
                        className="mt-4"
                      />
                      <div className="text-sm text-muted-foreground mt-2">
                        {nEstimators} árboles
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="max-depth">Profundidad máxima</Label>
                      <Slider
                        value={[maxDepth]}
                        max={50}
                        step={1}
                        onValueChange={(v) => setMaxDepth(v[0])}
                        className="mt-4"
                      />
                      <div className="text-sm text-muted-foreground mt-2">
                        {maxDepth} niveles
                      </div>
                    </div>
                  </>
                )}

                {modelType === "NeuralNetwork" && (
                  <>
                    <h4 className="text-lg font-medium pt-4 border-t">
                      Hiperparámetros de PyTorch
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="epochs">Épocas</Label>
                        <Input
                          id="epochs"
                          type="number"
                          value={epochs}
                          onChange={(e) => setEpochs(Number(e.target.value))}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label htmlFor="learningRate">
                          Tasa de Aprendizaje
                        </Label>
                        <Input
                          id="learningRate"
                          type="number"
                          step="0.001"
                          value={learningRate}
                          onChange={(e) =>
                            setLearningRate(Number(e.target.value))
                          }
                          className="mt-2"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="hiddenLayers">
                        Arquitectura (Capas Ocultas)
                      </Label>
                      <Input
                        id="hiddenLayers"
                        value={hiddenLayers}
                        onChange={(e) => setHiddenLayers(e.target.value)}
                        className="mt-2"
                        placeholder="Ej: [128, 64, 32]"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Un string JSON que representa un array de números.
                      </p>
                    </div>
                    <div>
                      <Label>Función de Activación</Label>
                      <Select value={activation} onValueChange={setActivation}>
                        <SelectTrigger className="w-full mt-2">
                          <SelectValue placeholder="Selecciona una función" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ReLU">ReLU</SelectItem>
                          <SelectItem value="Tanh">Tanh</SelectItem>
                          <SelectItem value="Sigmoid">Sigmoid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* --- Configuración Común --- */}
                <h4 className="text-lg font-medium pt-4 border-t">
                  Configuración de Datos
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="test-size">Tamaño del test (%)</Label>
                    <Slider
                      value={[testSize]}
                      max={50}
                      step={5}
                      onValueChange={(v) => setTestSize(v[0])}
                      className="mt-4"
                    />
                    <div className="text-sm text-muted-foreground mt-2">
                      {testSize}%
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="random-state">Random State</Label>
                    <Input
                      id="random-state"
                      type="number"
                      value={randomState}
                      onChange={(e) => setRandomState(Number(e.target.value))}
                      className="mt-2"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="features">
                    Features a utilizar (separadas por comas)
                  </Label>
                  <textarea
                    id="features"
                    value={features}
                    onChange={(e) => setFeatures(e.target.value)}
                    className="w-full mt-2 px-4 py-2 rounded-lg border border-input bg-background min-h-[80px]"
                  />
                </div>
                <div>
                  <Label htmlFor="target">Variable Objetivo</Label>
                  <Input
                    id="target"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* Columna de Estado y Acción */}
          <div className="space-y-6">
            <Card className="p-6 shadow-card">
              <h3 className="font-semibold mb-4">Acción</h3>
              <Button
                className="w-full"
                onClick={handleStartTraining}
                disabled={isTraining}
              >
                {isTraining ? "Entrenando..." : "Iniciar Entrenamiento"}
              </Button>
            </Card>
            <Card className="p-6 shadow-card">
              <h3 className="font-semibold mb-4">Estado del Entrenamiento</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Estado</span>
                  <span
                    className={`font-medium ${
                      isTraining ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {trainingStatus}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progreso</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TrainModels;
