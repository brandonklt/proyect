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
  const [maxRows, setMaxRows] = useState(1000);
  const [availableRows, setAvailableRows] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const storedData = localStorage.getItem('mlPipelineData');
    if (storedData) {
      const data = JSON.parse(storedData);
      setAvailableRows(data.rows || 0);
      setMaxRows(Math.min(1000, data.rows || 0));
    }
  }, []);

  const handleStartTraining = () => {
    setIsTraining(true);
    setProgress(0);
    setTrainingStatus("Inicializando modelo...");

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 10;
      });
    }, 300);

    const statusUpdates = [
      { time: 0, status: "Inicializando modelo..." },
      { time: 1000, status: "Dividiendo datos..." },
      { time: 2000, status: "Entrenando Random Forest..." },
      { time: 2500, status: "Optimizando hiperparámetros..." },
      { time: 3000, status: "Finalizando entrenamiento..." },
    ];

    statusUpdates.forEach(({ time, status }) => {
      setTimeout(() => setTrainingStatus(status), time);
    });

    setTimeout(() => {
      // Obtener datos reales del CSV
      const storedData = localStorage.getItem('mlPipelineData');
      if (!storedData) {
        toast({
          title: "Error",
          description: "No hay datos cargados. Por favor, carga un archivo CSV primero.",
          variant: "destructive",
        });
        setIsTraining(false);
        return;
      }

      const data = JSON.parse(storedData);
      const allData = (data.allData || []).slice(0, maxRows); // Usar solo las filas especificadas
      
      // Generar resultados simulados basados en el dataset real
      const featureList = features.split(',').map(f => f.trim()).filter(f => f);
      
      // Simular métricas de rendimiento
      const accuracy = 85 + Math.random() * 10;
      const precision = 83 + Math.random() * 12;
      const recall = 82 + Math.random() * 13;
      const f1Score = 84 + Math.random() * 11;
      
      // Generar datos de entrenamiento (evolución por época)
      const trainingData = Array.from({ length: 10 }, (_, i) => ({
        epoch: i + 1,
        train: 70 + (i * 2) + Math.random() * 3,
        validation: 68 + (i * 1.8) + Math.random() * 3,
      }));
      
      // Simular matriz de confusión
      const totalSamples = Math.floor(allData.length * (testSize / 100));
      const tp = Math.floor(totalSamples * 0.45);
      const tn = Math.floor(totalSamples * 0.42);
      const fp = Math.floor(totalSamples * 0.08);
      const fn = totalSamples - tp - tn - fp;
      const confusionMatrix = [[tn, fp], [fn, tp]];
      
      // Generar importancia de características
      const featureImportance = featureList.map((feature, index) => ({
        name: feature,
        importance: Math.max(10, 100 - (index * 15) + Math.random() * 20),
      })).sort((a, b) => b.importance - a.importance);
      
      // Analizar distribución de clases (basado en variable objetivo)
      const targetValues = allData.map((row: any) => row[target]).filter(Boolean);
      const numericValues = targetValues.map((v: any) => parseFloat(v)).filter((v: number) => !isNaN(v));
      
      let classDistribution = [];
      if (numericValues.length > 0) {
        const median = numericValues.sort((a: number, b: number) => a - b)[Math.floor(numericValues.length / 2)];
        const highCount = numericValues.filter((v: number) => v >= median).length;
        const lowCount = numericValues.length - highCount;
        
        classDistribution = [
          { name: `${target} Alto`, value: highCount, color: "hsl(var(--primary))" },
          { name: `${target} Bajo`, value: lowCount, color: "hsl(var(--success))" },
        ];
      }

      const modelResults = {
        modelType,
        testSize,
        randomState,
        nEstimators,
        maxDepth,
        features,
        target,
        maxRows,
        timestamp: new Date().toISOString(),
        accuracy: parseFloat(accuracy.toFixed(2)),
        precision: parseFloat(precision.toFixed(2)),
        recall: parseFloat(recall.toFixed(2)),
        f1Score: parseFloat(f1Score.toFixed(2)),
        trainingTime: `${(2 + Math.random() * 3).toFixed(2)}s`,
        trainingData,
        confusionMatrix,
        featureImportance,
        classDistribution,
      };

      localStorage.setItem('mlPipelineResults', JSON.stringify(modelResults));

      toast({
        title: "Entrenamiento completado",
        description: `${modelType} entrenado con accuracy de ${accuracy.toFixed(1)}%`,
      });

      setIsTraining(false);
      setTrainingStatus("Completado");
      
      setTimeout(() => navigate('/results'), 1000);
    }, 3500);
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

                      <div>
                        <Label htmlFor="max-rows">Número de filas a usar</Label>
                        <div className="mt-4">
                          <Slider 
                            value={[maxRows]} 
                            max={availableRows || 1000} 
                            min={100}
                            step={50}
                            onValueChange={(val) => setMaxRows(val[0])}
                          />
                          <div className="flex justify-between items-center text-sm text-muted-foreground mt-2">
                            <span>{maxRows.toLocaleString()} filas</span>
                            <span className="text-xs">Disponibles: {availableRows.toLocaleString()}</span>
                          </div>
                        </div>
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
