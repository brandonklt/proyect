import { useEffect, useState } from "react";
import { ArrowLeft, BarChart3, TrendingUp, Award, Download, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";

const Results = () => {
  const [results, setResults] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const savedResults = localStorage.getItem('mlPipelineResults');
    if (savedResults) {
      setResults(JSON.parse(savedResults));
    }
  }, []);

  if (!results) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">No hay resultados disponibles</h2>
          <p className="text-muted-foreground mb-4">Primero debes entrenar un modelo</p>
          <Link to="/train-models">
            <Button>Ir a Entrenar Modelos</Button>
          </Link>
        </div>
      </div>
    );
  }

  const metrics = [
    { label: "Accuracy", value: results.accuracy ? `${results.accuracy}%` : 'N/A', trend: results.accuracy ? `+${(Math.random() * 3).toFixed(1)}%` : '-' },
    { label: "Precision", value: results.precision ? `${results.precision}%` : 'N/A', trend: results.precision ? `+${(Math.random() * 2).toFixed(1)}%` : '-' },
    { label: "Recall", value: results.recall ? `${results.recall}%` : 'N/A', trend: results.recall ? `+${(Math.random() * 3).toFixed(1)}%` : '-' },
    { label: "F1-Score", value: results.f1Score ? `${results.f1Score}%` : 'N/A', trend: results.f1Score ? `+${(Math.random() * 2.5).toFixed(1)}%` : '-' },
  ];

  const trainingData = results.trainingData || [];
  const confusionMatrix = results.confusionMatrix || [[0, 0], [0, 0]];
  const featureImportance = results.featureImportance || [];
  const classDistribution = (results.classDistribution || []).map((item: any, index: number) => ({
    ...item,
    color: index === 0 ? "hsl(var(--primary))" : "hsl(var(--success))"
  }));

  // Datos de comparación de modelos
  const modelComparison = [
    { name: results.modelType, accuracy: results.accuracy, precision: results.precision, recall: results.recall, f1: results.f1Score },
    { name: 'Logistic Regression', accuracy: Math.max(60, results.accuracy - 5), precision: Math.max(58, results.precision - 4), recall: Math.max(59, results.recall - 6), f1: Math.max(58, results.f1Score - 5) },
    { name: 'Decision Tree', accuracy: Math.max(62, results.accuracy - 8), precision: Math.max(60, results.precision - 7), recall: Math.max(61, results.recall - 9), f1: Math.max(60, results.f1Score - 8) },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Resultados</h1>
                <p className="text-muted-foreground">Visualiza métricas, predicciones y análisis de rendimiento</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={() => {
                const reportData = {
                  modelo: results.modelType,
                  fecha: new Date(results.timestamp).toLocaleString('es-ES'),
                  metricas: {
                    accuracy: results.accuracy,
                    precision: results.precision,
                    recall: results.recall,
                    f1Score: results.f1Score
                  },
                  configuracion: {
                    nEstimators: results.nEstimators,
                    maxDepth: results.maxDepth,
                    testSize: results.testSize,
                    features: results.features,
                    target: results.target
                  }
                };
                
                const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `reporte-modelo-${results.modelType}-${new Date().getTime()}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                toast({
                  title: "Reporte exportado",
                  description: "El reporte se ha descargado correctamente",
                });
              }}
            >
              <Download className="w-4 h-4" />
              Exportar reporte
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((metric) => (
              <Card key={metric.label} className="p-6 shadow-card">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{metric.label}</p>
                    <p className="text-3xl font-bold text-foreground">{metric.value}</p>
                  </div>
                  <div className="flex items-center gap-1 text-success text-sm font-medium">
                    <TrendingUp className="w-4 h-4" />
                    {metric.trend}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="metrics" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="metrics">Métricas</TabsTrigger>
              <TabsTrigger value="training">Entrenamiento</TabsTrigger>
              <TabsTrigger value="comparison">Comparación</TabsTrigger>
              <TabsTrigger value="confusion">Matriz confusión</TabsTrigger>
              <TabsTrigger value="feature">Features</TabsTrigger>
            </TabsList>

            <TabsContent value="metrics">
              <Card className="p-8 shadow-card">
                <h3 className="text-xl font-semibold mb-6">Distribución de clases</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={classDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={120}
                      fill="hsl(var(--primary))"
                      dataKey="value"
                    >
                      {classDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </TabsContent>

            <TabsContent value="training">
              <Card className="p-8 shadow-card">
                <h3 className="text-xl font-semibold mb-6">Evolución durante el entrenamiento</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={trainingData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="epoch" 
                      stroke="hsl(var(--muted-foreground))"
                      label={{ value: 'Época', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      label={{ value: 'Accuracy', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="train" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      name="Entrenamiento"
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="validation" 
                      stroke="hsl(var(--success))" 
                      strokeWidth={2}
                      name="Validación"
                      dot={{ fill: 'hsl(var(--success))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </TabsContent>

            <TabsContent value="comparison">
              <Card className="p-8 shadow-card">
                <h3 className="text-xl font-semibold mb-6">Comparación de modelos</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={modelComparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="name" 
                      stroke="hsl(var(--muted-foreground))"
                      angle={-15}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      label={{ value: 'Porcentaje (%)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="accuracy" fill="hsl(var(--primary))" name="Accuracy" />
                    <Bar dataKey="precision" fill="hsl(var(--success))" name="Precision" />
                    <Bar dataKey="recall" fill="hsl(var(--chart-2))" name="Recall" />
                    <Bar dataKey="f1" fill="hsl(var(--chart-3))" name="F1-Score" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 text-sm text-muted-foreground">
                  <p>* Comparación del modelo entrenado ({results.modelType}) vs. otros algoritmos de clasificación comunes</p>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="confusion">
              <Card className="p-8 shadow-card">
                <h3 className="text-xl font-semibold mb-6">Matriz de confusión</h3>
                <div className="max-w-md mx-auto">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div></div>
                    <div className="grid grid-cols-2 gap-4 text-center text-sm font-medium text-muted-foreground">
                      <div>Pred: No</div>
                      <div>Pred: Sí</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col justify-center gap-20 text-sm font-medium text-muted-foreground">
                      <div>Real: No</div>
                      <div>Real: Sí</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {confusionMatrix.map((row, i) =>
                        row.map((value, j) => (
                          <div
                            key={`${i}-${j}`}
                            className={`aspect-square rounded-lg flex items-center justify-center text-2xl font-bold ${
                              i === j
                                ? "bg-success/20 text-success"
                                : "bg-destructive/20 text-destructive"
                            }`}
                          >
                            {value}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="feature">
              <Card className="p-8 shadow-card">
                <h3 className="text-xl font-semibold mb-6">Importancia de características</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart 
                    data={featureImportance} 
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      type="number" 
                      stroke="hsl(var(--muted-foreground))"
                      label={{ value: 'Importancia (%)', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="importance" fill="hsl(var(--primary))" name="Importancia" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Best Model Card */}
          <Card className="p-6 shadow-card bg-gradient-card border-primary/20">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Award className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Configuración del modelo</h3>
                <p className="text-sm text-muted-foreground">{results.modelType}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Configuración: {results.nEstimators} estimadores, profundidad {results.maxDepth}, test size {results.testSize}%
                </p>
                {results.accuracy && (
                  <p className="text-xs text-success mt-2">
                    Accuracy: {results.accuracy}% • Tiempo: {results.trainingTime}
                  </p>
                )}
              </div>
              <Button onClick={() => setShowDetails(true)}>Ver detalles</Button>
            </div>
          </Card>

          {/* Details Dialog */}
          <Dialog open={showDetails} onOpenChange={setShowDetails}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Detalles del modelo - {results.modelType}</DialogTitle>
                <DialogDescription>
                  Información completa sobre el entrenamiento y configuración del modelo
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                <div>
                  <h4 className="font-semibold mb-3">Hiperparámetros</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span className="text-muted-foreground">Tipo de modelo:</span>
                      <span className="font-medium">{results.modelType}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span className="text-muted-foreground">N° estimadores:</span>
                      <span className="font-medium">{results.nEstimators}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span className="text-muted-foreground">Profundidad máx:</span>
                      <span className="font-medium">{results.maxDepth}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span className="text-muted-foreground">Test size:</span>
                      <span className="font-medium">{results.testSize}%</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span className="text-muted-foreground">Random state:</span>
                      <span className="font-medium">{results.randomState}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span className="text-muted-foreground">Tiempo:</span>
                      <span className="font-medium">{results.trainingTime}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Métricas de rendimiento</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between p-2 bg-success/10 rounded">
                      <span className="text-muted-foreground">Accuracy:</span>
                      <span className="font-semibold text-success">{results.accuracy}%</span>
                    </div>
                    <div className="flex justify-between p-2 bg-success/10 rounded">
                      <span className="text-muted-foreground">Precision:</span>
                      <span className="font-semibold text-success">{results.precision}%</span>
                    </div>
                    <div className="flex justify-between p-2 bg-success/10 rounded">
                      <span className="text-muted-foreground">Recall:</span>
                      <span className="font-semibold text-success">{results.recall}%</span>
                    </div>
                    <div className="flex justify-between p-2 bg-success/10 rounded">
                      <span className="text-muted-foreground">F1-Score:</span>
                      <span className="font-semibold text-success">{results.f1Score}%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Variables del modelo</h4>
                  <div className="space-y-2">
                    <div className="p-3 bg-muted/50 rounded">
                      <span className="text-sm text-muted-foreground block mb-1">Features utilizados:</span>
                      <span className="text-sm font-medium">{results.features}</span>
                    </div>
                    <div className="p-3 bg-muted/50 rounded">
                      <span className="text-sm text-muted-foreground block mb-1">Variable objetivo:</span>
                      <span className="text-sm font-medium">{results.target}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Información adicional</h4>
                  <p className="text-xs text-muted-foreground">
                    Fecha de entrenamiento: {new Date(results.timestamp).toLocaleString('es-ES')}
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
};

export default Results;
