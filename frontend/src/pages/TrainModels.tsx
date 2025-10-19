import { useState, useEffect } from "react";
import { ArrowLeft, Brain, Cpu, Zap, Settings } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const TrainModels = () => {
  const [isTraining, setIsTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [trainingStatus, setTrainingStatus] = useState("Configurando...");
  const [modelType, setModelType] = useState("Random Forest Classifier");
  const [testSize, setTestSize] = useState(20);
  const [randomState, setRandomState] = useState(42);
  const [nEstimators, setNEstimators] = useState(100);
  const [maxDepth, setMaxDepth] = useState(10);
  const [features, setFeatures] = useState("Units Sold, Unit Price, Region, Payment Method");
  const [target, setTarget] = useState("Total Revenue");
  const [availableRows, setAvailableRows] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const fileName = localStorage.getItem('cleanedFileName') || localStorage.getItem('uploadedFileName');
    if (fileName) {
      const fetchCsvInfo = async () => {
        try {
          const response = await fetch(`http://127.0.0.1:8000/get-csv-info/${fileName}`);
          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.detail || 'Failed to fetch CSV info');
          }
          setAvailableRows(result.stats.rows);
        } catch (error: any) {
          toast({
            title: "Error al cargar datos del CSV",
            description: error.message,
            variant: "destructive",
          });
        }
      };
      fetchCsvInfo();
    }
  }, [toast]);

  const handleStartTraining = async () => {
    const fileName = localStorage.getItem('cleanedFileName') || localStorage.getItem('uploadedFileName');
    if (!fileName) {
      toast({
        title: "Error",
        description: "No se encontró ningún archivo para entrenar. Por favor, carga o limpia un archivo primero.",
        variant: "destructive",
      });
      return;
    }

    setIsTraining(true);
    setProgress(0);
    setTrainingStatus("Enviando configuración al backend...");

    const formData = new FormData();
    formData.append('filename', fileName);
    formData.append('modelType', modelType);
    formData.append('testSize', String(testSize));
    formData.append('randomState', String(randomState));
    formData.append('nEstimators', String(nEstimators));
    formData.append('maxDepth', String(maxDepth));
    formData.append('features', features);
    formData.append('target', target);

    // Simular progreso mientras el backend trabaja
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(90, prev + 5)); // No llegar al 100%
    }, 500);

    try {
      const response = await fetch("http://127.0.0.1:8000/train-model", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      const backendResult = await response.json();

      if (!response.ok) {
        throw new Error(backendResult.detail || "Error en el entrenamiento del modelo");
      }

      setTrainingStatus("Procesando resultados...");
      setProgress(100);

      const finalResults = {
        ...backendResult.result.metrics,
        modelType: backendResult.result.model_type,
        testSize,
        randomState,
        nEstimators,
        maxDepth,
        features,
        target,
        timestamp: new Date().toISOString(),
      };

      localStorage.setItem('mlPipelineResults', JSON.stringify(finalResults));

      toast({
        title: "Entrenamiento completado",
        description: `${modelType} entrenado con accuracy de ${finalResults.accuracy}%`,
      });

      setTimeout(() => navigate('/results'), 1000);

    } catch (error: any) {
      clearInterval(progressInterval);
      toast({
        title: "Error en el entrenamiento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al dashboard
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Brain className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Entrenar Modelos</h1>
              <p className="text-muted-foreground">Configura y entrena modelos con sklearn, PyTorch y más</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="sklearn" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sklearn" className="gap-2">
                <Zap className="w-4 h-4" />
                Scikit-learn
              </TabsTrigger>
              <TabsTrigger value="pytorch" className="gap-2">
                <Cpu className="w-4 h-4" />
                PyTorch
              </TabsTrigger>
              <TabsTrigger value="advanced" className="gap-2">
                <Settings className="w-4 h-4" />
                Avanzado
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sklearn">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <Card className="p-6 shadow-card">
                    <h3 className="text-xl font-semibold mb-6">Configuración del modelo</h3>
                    
                    <div className="space-y-6">
                      <div>
                        <Label htmlFor="model-type">Tipo de modelo</Label>
                        <select
                          id="model-type"
                          className="w-full mt-2 px-4 py-2 rounded-lg border border-input bg-background"
                          value={modelType}
                          onChange={(e) => setModelType(e.target.value)}
                        >
                          <option>Random Forest Classifier</option>
                          <option>Logistic Regression</option>
                          <option>Support Vector Machine (SVM)</option>
                          <option>Gradient Boosting</option>
                          <option>K-Nearest Neighbors</option>
                          <option>Decision Tree</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="test-size">Tamaño del test (%)</Label>
                          <div className="mt-4">
                            <Slider 
                              value={[testSize]} 
                              max={50} 
                              step={5} 
                              onValueChange={(val) => setTestSize(val[0])}
                            />
                            <div className="text-sm text-muted-foreground mt-2">{testSize}%</div>
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
                        <Label htmlFor="n-estimators">N° de estimadores</Label>
                        <div className="mt-4">
                          <Slider 
                            value={[nEstimators]} 
                            max={500} 
                            step={10}
                            onValueChange={(val) => setNEstimators(val[0])}
                          />
                          <div className="text-sm text-muted-foreground mt-2">{nEstimators} árboles</div>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="max-depth">Profundidad máxima</Label>
                        <div className="mt-4">
                          <Slider 
                            value={[maxDepth]} 
                            max={50} 
                            step={1}
                            onValueChange={(val) => setMaxDepth(val[0])}
                          />
                          <div className="text-sm text-muted-foreground mt-2">{maxDepth} niveles</div>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="features">Features a utilizar</Label>
                        <textarea
                          id="features"
                          placeholder="Units Sold, Unit Price, Region, Payment Method"
                          value={features}
                          onChange={(e) => setFeatures(e.target.value)}
                          className="w-full mt-2 px-4 py-2 rounded-lg border border-input bg-background min-h-[80px]"
                        />
                      </div>

                      <div>
                        <Label htmlFor="target">Variable objetivo</Label>
                        <Input 
                          id="target" 
                          placeholder="Total Revenue" 
                          value={target}
                          onChange={(e) => setTarget(e.target.value)}
                          className="mt-2" 
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 mt-8">
                      <Button 
                        className="flex-1"
                        onClick={handleStartTraining}
                        disabled={isTraining}
                      >
                        {isTraining ? "Entrenando..." : "Iniciar entrenamiento"}
                      </Button>
                      <Button 
                        variant="outline" 
                        disabled={isTraining}
                        onClick={() => {
                          toast({
                            title: "Validación cruzada",
                            description: "Esta función realizará K-fold cross-validation para evaluar el modelo de forma más robusta.",
                          });
                        }}
                      >
                        Validación cruzada
                      </Button>
                    </div>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card className="p-6 shadow-card">
                    <h3 className="font-semibold mb-4">Estado del entrenamiento</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Estado</span>
                        <span className={`font-medium ${isTraining ? 'text-primary' : 'text-warning'}`}>
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

                  <Card className="p-6 shadow-card bg-gradient-card">
                    <h3 className="font-semibold mb-3">Librerías disponibles</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">scikit-learn</span>
                        <span className="text-success font-mono text-xs">1.3.0</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">pandas</span>
                        <span className="text-success font-mono text-xs">2.0.3</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">numpy</span>
                        <span className="text-success font-mono text-xs">1.24.3</span>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pytorch">
              <Card className="p-8 shadow-card">
                <div className="text-center py-12">
                  <Cpu className="w-16 h-16 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Configuración de PyTorch</h3>
                  <p className="text-muted-foreground mb-6">
                    Define arquitectura de red neuronal, optimizador y función de pérdida
                  </p>
                  <div className="max-w-2xl mx-auto space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-left">
                        <Label>Arquitectura</Label>
                        <Input placeholder="[128, 64, 32]" className="mt-2" />
                      </div>
                      <div className="text-left">
                        <Label>Función de activación</Label>
                        <select className="w-full mt-2 px-4 py-2 rounded-lg border border-input bg-background">
                          <option>ReLU</option>
                          <option>Sigmoid</option>
                          <option>Tanh</option>
                        </select>
                      </div>
                    </div>
                    <Button className="w-full">Configurar red neuronal</Button>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="advanced">
              <Card className="p-8 shadow-card">
                <div className="text-center py-12">
                  <Settings className="w-16 h-16 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Configuración avanzada</h3>
                  <p className="text-muted-foreground">
                    Grid search, optimización de hiperparámetros y más
                  </p>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default TrainModels;