import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Target,
  TestTube2,
  Scale,
  BarChart,
  BrainCircuit,
  LayoutGrid,
  Upload,
  Info,
  LineChart as LineChartIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  ResponsiveContainer,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart as RechartsBarChart,
  LineChart,
  Line,
} from "recharts";
import { CustomScatterPlot } from "@/components/ui/ScatterPlot";

const apiUrl = import.meta.env.VITE_API_URL;

const Results = () => {
  interface ModelResults {
    metrics: {
      accuracy: number;
      precision: number;
      recall: number;
      f1Score: number;
      confusionMatrix: number[][];
      scatterPlotData: {
        actual: number[];
        predicted: number[];
      };
      lossHistory?: number[];
      rocCurve: {
        fpr: number[];
        tpr: number[];
      };
      auc: number;
    };
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    confusionMatrix: number[][];
    featureImportance: { feature: string; importance: number }[];
    trainingProgress: { epochs: number[]; loss: number[] };
    scatterPlotData: {
      actual: number[];
      predicted: number[];
    };
    testSize: number;
    randomState: number;
    features: string[];
    target: string;
    timestamp: string;
    nEstimators?: number;
    maxDepth?: number;
    epochs?: number;
    learningRate?: number;
    hiddenLayers?: number[];
    activation?: string;
    modelType: string;
  }

  const [results, setResults] = useState<ModelResults | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const savedResults = localStorage.getItem("mlPipelineResults");
    if (savedResults) {
      const parsedResults = JSON.parse(savedResults);
      console.log("DEBUG: Results from localStorage", parsedResults);
      setResults(parsedResults);
    }
  }, []);

  const handleExportToDb = async () => {
    if (!results) return;
    console.log("Exporting to DB:", results);
    try {
      const response = await fetch(`${apiUrl}/export-to-db`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(results),
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error(
          "Export failed with status:",
          response.status,
          "and data:",
          errorData
        );
        throw new Error(errorData.detail || "Error al exportar los resultados");
      }
      toast({
        title: "Exportación exitosa",
        description: "Los resultados se han guardado en la base de datos.",
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      toast({
        title: "Error al cargar los resultados",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  if (!results) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">
            No se encontraron resultados
          </h1>
          <p className="text-muted-foreground mb-6">
            Parece que no has entrenado ningún modelo todavía.
          </p>
          <Link to="/train-models">
            <Button>Ir a entrenar un modelo</Button>
          </Link>
        </div>
      </div>
    );
  }

  const {
    modelType,
    accuracy,
    precision,
    recall,
    f1Score,
    confusionMatrix,
    featureImportance,
    trainingProgress,
    scatterPlotData,
    testSize,
    randomState,
    features,
    target,
    timestamp,
    nEstimators,
    maxDepth,
    epochs,
    learningRate,
    hiddenLayers,
    activation,
  } = results;

  const formattedTimestamp = new Date(timestamp).toLocaleString("es-ES", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const lossChartData = trainingProgress?.epochs.map(
    (epoch: number, index: number) => ({
      epoch,
      loss: trainingProgress.loss[index].toFixed(4),
    })
  );

  const scatterChartData = scatterPlotData?.actual.map(
    (actual: number, index: number) => ({
      actual,
      predicted: scatterPlotData.predicted[index],
    })
  );

  const renderModelSpecificParams = () => {
    if (modelType === "RandomForestClassifier") {
      return (
        <>
          <div className="flex justify-between">
            <span className="text-muted-foreground">N° Estimadores:</span>{" "}
            <span className="font-semibold">{nEstimators}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Profundidad Máxima:</span>{" "}
            <span className="font-semibold">{maxDepth}</span>
          </div>
        </>
      );
    }
    if (modelType === "NeuralNetwork") {
      return (
        <>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Épocas:</span>{" "}
            <span className="font-semibold">{epochs}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tasa de Aprendizaje:</span>{" "}
            <span className="font-semibold">{learningRate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Arquitectura:</span>{" "}
            <span className="font-semibold">
              {JSON.stringify(hiddenLayers)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Activación:</span>{" "}
            <span className="font-semibold">{activation}</span>
          </div>
        </>
      );
    }
    return null;
  };

  const renderAnalysisChart = () => {
    if (
      modelType === "NeuralNetwork" &&
      results.metrics.lossHistory &&
      results.metrics.lossHistory.length > 0
    ) {
      const data = results.metrics.lossHistory.map(
        (loss: number, index: number) => ({
          epoch: index + 1,
          loss: loss,
        })
      );

      return (
        <div className="h-[500px] flex flex-col">
          <div className="mb-4 text-center">
            <h3 className="text-lg font-semibold">
              Curva de Pérdida (Loss) del Entrenamiento
            </h3>
            <p className="text-sm text-muted-foreground">
              Evolución del error del modelo en cada época
            </p>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="epoch"
                  label={{
                    value: "Época",
                    position: "insideBottom",
                    offset: -10,
                  }}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                />
                <YAxis
                  label={{ value: "Loss", angle: -90, position: "insideLeft" }}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                  }}
                  formatter={(value: number) => [value.toFixed(4), "Loss"]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="loss"
                  name="Loss"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (
      modelType === "RandomForestClassifier" &&
      featureImportance &&
      featureImportance.length > 0
    ) {
      return (
        <div className="h-[500px] flex flex-col">
          <div className="mb-4 text-center">
            <h3 className="text-lg font-semibold">
              Importancia de Características
            </h3>
            <p className="text-sm text-muted-foreground">
              Las características más importantes para el modelo
            </p>
          </div>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart
                data={featureImportance}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
              >
                <CartesianGrid
                  horizontal={false}
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickFormatter={(value) => `${value}%`}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={180}
                  tick={{ fontSize: 13, fill: "hsl(var(--foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                  }}
                  formatter={(value: number) => [
                    `${value.toFixed(2)}%`,
                    "Importancia",
                  ]}
                />
                <Bar
                  dataKey="importance"
                  name="Importancia"
                  radius={[0, 4, 4, 0]}
                  fill="hsl(var(--primary))"
                />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    return (
      <div className="text-center py-12">
        <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          No hay gráfico de análisis
        </h3>
        <p className="text-sm text-muted-foreground">
          No hay una visualización de análisis específica para este tipo de
          modelo.
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center mb-4">
            <Link
              to="/train-models"
              className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a entrenar
            </Link>
            <Button onClick={handleExportToDb}>
              <Upload className="w-4 h-4 mr-2" />
              Exportar a DB
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
              <TestTube2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Resultados del Entrenamiento
              </h1>
              <p className="text-muted-foreground">
                Análisis del rendimiento del modelo: {modelType}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 shadow-card">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-3">
                <Scale className="w-5 h-5 text-primary" />
                Métricas de Rendimiento
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Accuracy</p>
                  <p className="text-3xl font-bold">{accuracy.toFixed(2)}%</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Precision</p>
                  <p className="text-3xl font-bold">{precision.toFixed(2)}%</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Recall</p>
                  <p className="text-3xl font-bold">{recall.toFixed(2)}%</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">F1-Score</p>
                  <p className="text-3xl font-bold">{f1Score.toFixed(2)}%</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 shadow-card">
              <Tabs defaultValue="analysis">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="confusion-matrix">
                    <LayoutGrid className="w-4 h-4 mr-2" />
                    Matriz de Confusión
                  </TabsTrigger>
                  <TabsTrigger value="analysis">
                    <BarChart className="w-4 h-4 mr-2" />
                    Análisis del Modelo
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="confusion-matrix">
                  <div className="h-[500px] flex flex-col">
                    <div className="mb-4 text-center">
                      <h3 className="text-lg font-semibold">
                        Matriz de Confusión
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Visualización de predicciones correctas e incorrectas
                      </p>
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                      <div className="grid grid-cols-2 gap-1">
                        {confusionMatrix.map((row, i) =>
                          row.map((value, j) => (
                            <div
                              key={`${i}-${j}`}
                              className="p-6 bg-muted/30 rounded-lg text-center"
                              style={{
                                backgroundColor: `hsl(var(--primary) / ${
                                  (value /
                                    Math.max(...confusionMatrix.flat())) *
                                  0.3
                                })`,
                              }}
                            >
                              <div className="text-2xl font-bold">{value}</div>
                              <div className="text-sm text-muted-foreground mt-2">
                                {i === 0 && j === 0 && "Verdaderos Negativos"}
                                {i === 0 && j === 1 && "Falsos Positivos"}
                                {i === 1 && j === 0 && "Falsos Negativos"}
                                {i === 1 && j === 1 && "Verdaderos Positivos"}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="analysis" className="mt-4">
                  {renderAnalysisChart()}
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6 shadow-card">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-3">
                <BrainCircuit className="w-5 h-5 text-primary" />
                Detalles del Modelo
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Modelo:</span>
                  <span className="font-semibold">{modelType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha:</span>
                  <span className="font-semibold">{formattedTimestamp}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Tamaño del Test:
                  </span>
                  <span className="font-semibold">{testSize}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Random State:</span>
                  <span className="font-semibold">{randomState}</span>
                </div>
                {renderModelSpecificParams()}
              </div>
            </Card>

            <Card className="p-6 shadow-card">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-3">
                <Target className="w-5 h-5 text-primary" />
                Features y Target
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">
                    Features utilizadas:
                  </p>
                  <p className="font-semibold break-words">{features}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">
                    Variable Objetivo:
                  </p>
                  <p className="font-semibold">{target}</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Results;
