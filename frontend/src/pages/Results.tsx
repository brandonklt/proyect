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
  Cell,
} from "recharts";

const Results = () => {
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    const savedResults = localStorage.getItem("mlPipelineResults");
    if (savedResults) {
      setResults(JSON.parse(savedResults));
    }
  }, []);

  const handleExportToDb = async () => {
    if (!results) return;

    try {
      const response = await fetch("http://127.0.0.1:8000/export-to-db", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(results),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Error al exportar los resultados");
      }

      toast({
        title: "Exportación exitosa",
        description:
          "Los resultados del modelo se han guardado en la base de datos.",
      });
    } catch (error: any) {
      toast({
        title: "Error en la exportación",
        description: error.message,
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
    testSize,
    randomState,
    nEstimators,
    maxDepth,
    features,
    target,
    timestamp,
  } = results;

  const formattedTimestamp = new Date(timestamp).toLocaleString("es-ES", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center mb-4">
            <Link
              to="/"
              className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al dashboard
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
                Análisis detallado del rendimiento del modelo: {modelType}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Izquierda: Métricas y Gráficos */}
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
              <Tabs defaultValue="confusion-matrix">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="confusion-matrix">
                    <LayoutGrid className="w-4 h-4 mr-2" />
                    Matriz de Confusión
                  </TabsTrigger>
                  <TabsTrigger value="feature-importance">
                    <BarChart className="w-4 h-4 mr-2" />
                    Importancia de Features
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="confusion-matrix">
                  <div className="flex justify-center mt-4">
                    <div className="grid grid-cols-2 gap-2 text-center w-100">
                      <div className="p-8 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-500/50">
                        <p className="text-sm text-green-900 dark:text-green-100">
                          Verdaderos Positivos
                        </p>
                        <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                          {confusionMatrix[1][1]}
                        </p>
                      </div>
                      <div className="p-8 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-500/50">
                        <p className="text-sm text-red-900 dark:text-red-100">
                          Falsos Positivos
                        </p>
                        <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                          {confusionMatrix[0][1]}
                        </p>
                      </div>
                      <div className="p-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg border border-yellow-500/50">
                        <p className="text-sm text-yellow-900 dark:text-yellow-100">
                          Falsos Negativos
                        </p>
                        <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                          {confusionMatrix[1][0]}
                        </p>
                      </div>
                      <div className="p-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg border border-blue-500/50">
                        <p className="text-sm text-blue-900 dark:text-blue-100">
                          Verdaderos Negativos
                        </p>
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                          {confusionMatrix[0][0]}
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="feature-importance" className="mt-4">
                  <div className="h-[500px] flex flex-col">
                    <div className="mb-4 text-center">
                      <h3 className="text-lg font-semibold">Importancia de Características</h3>
                      <p className="text-sm text-muted-foreground">
                        Las características más importantes para las predicciones del modelo
                      </p>
                    </div>

                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart
                          data={featureImportance}
                          layout="vertical"
                          margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
                          barCategoryGap={12}
                        >
                          <defs>
                            <linearGradient id="importanceGradient" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#4f46e5" />
                              <stop offset="100%" stopColor="#7c3aed" />
                            </linearGradient>
                          </defs>

                          <CartesianGrid
                            horizontal={false}
                            strokeDasharray="3 3"
                            stroke="hsl(var(--border))"
                          />

                          <XAxis
                            type="number"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                            tickFormatter={(value) => `${value}%`}
                          />

                          <YAxis
                            dataKey="name"
                            type="category"
                            width={180}
                            tick={{
                              fontSize: 13,
                              fill: 'hsl(var(--foreground))',
                              fontWeight: 500
                            }}
                            tickLine={false}
                            axisLine={false}
                            interval={0}
                          />

                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--background))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '0.5rem',
                              padding: '0.75rem',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                            formatter={(value: number) => [
                              `${value.toFixed(2)}% de importancia`,
                              'Valor'
                            ]}
                            labelFormatter={(label) => `Característica: ${label}`}
                          />

                          <Bar
                            dataKey="importance"
                            name="Importancia"
                            radius={[0, 4, 4, 0]}
                            fill="url(#importanceGradient)"
                            animationDuration={1500}
                          >
                            {featureImportance?.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={`hsl(${220 + (index * 30)}, 70%, 60%)`}
                              />
                            ))}
                          </Bar>
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                      <h4 className="text-sm font-medium mb-2 flex items-center">
                        <Info className="w-4 h-4 mr-2" />
                        Cómo interpretar este gráfico
                      </h4>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        <li className="flex items-start">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary mt-1.5 mr-2 flex-shrink-0"></span>
                          <span>Las barras más largas indican características más importantes para el modelo</span>
                        </li>
                        <li className="flex items-start">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/70 mt-1.5 mr-2 flex-shrink-0"></span>
                          <span>Pasa el cursor sobre las barras para ver los valores exactos</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          {/* Columna Derecha: Detalles y Features */}
          <div className="space-y-6">
            <Card className="p-6 shadow-card">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-3">
                <BrainCircuit className="w-5 h-5 text-primary" />
                Detalles del Modelo
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Modelo:</span>{" "}
                  <span className="font-semibold">{modelType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha:</span>{" "}
                  <span className="font-semibold">{formattedTimestamp}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Tamaño del Test:
                  </span>{" "}
                  <span className="font-semibold">{testSize}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Random State:</span>{" "}
                  <span className="font-semibold">{randomState}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">N° Estimadores:</span>{" "}
                  <span className="font-semibold">{nEstimators}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Profundidad Máxima:
                  </span>{" "}
                  <span className="font-semibold">{maxDepth}</span>
                </div>
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
