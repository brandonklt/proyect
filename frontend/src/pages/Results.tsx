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
  PieChart, // Usado para el título y el nuevo tab
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  PieChart as RechartsPieChart, // Importar PieChart
  Pie, // Importar Pie
  Cell,
} from "recharts";

// Paleta de colores para los gráficos
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d", "#FA8072", "#7B68EE"];

// --- DATOS DE EJEMPLO PARA EL GRÁFICO DE PASTEL ---
// Reemplaza esto con los datos reales de la distribución de tu variable objetivo
const pieChartData = [
  { name: 'Clase 0 (Ej: No Compra)', value: 400 },
  { name: 'Clase 1 (Ej: Compra)', value: 300 },
];
// --- FIN DATOS DE EJEMPLO ---

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
    // ... (sin cambios en esta función)
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
     // ... (sin cambios si no hay resultados)
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

  // Prepara los datos para el gráfico de barras con colores
  const coloredFeatureImportance = Array.isArray(featureImportance)
    ? featureImportance.map((entry: any, index: number) => ({
        ...entry,
        name: String(entry.name || `Feature ${index + 1}`),
        importance: typeof entry.importance === 'number' ? entry.importance : 0,
        fill: COLORS[index % COLORS.length],
      }))
    : [];


  const formattedTimestamp = timestamp ? new Date(timestamp).toLocaleString("es-ES", {
    dateStyle: "long",
    timeStyle: "short",
  }) : "Fecha no disponible";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
         {/* ... (sin cambios en el header) */}
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center mb-4">
            <Link
              to="/"
              className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al dashboard
            </Link>
            <Button onClick={handleExportToDb} disabled={!results}>
              <Upload className="w-4 h-4 mr-2" />
              Exportar a DB
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
              <TestTube2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                Resultados del Entrenamiento
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                Análisis detallado del rendimiento del modelo: {modelType || 'Desconocido'}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Columna Izquierda: Métricas y Detalles */}
          <div className="lg:col-span-1 space-y-6">
            {/* ... (Tarjeta de Métricas Principales - sin cambios) ... */}
            <Card className="shadow-card overflow-hidden">
               <CardHeader>
                 <CardTitle className="text-xl font-semibold flex items-center gap-3">
                    <Scale className="w-5 h-5 text-primary" />
                    Métricas Principales
                 </CardTitle>
               </CardHeader>
               <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">Accuracy</p>
                      <p className="text-2xl md:text-3xl font-bold">{accuracy?.toFixed(2) ?? 'N/A'}%</p>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">Precision</p>
                      <p className="text-2xl md:text-3xl font-bold">{precision?.toFixed(2) ?? 'N/A'}%</p>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">Recall</p>
                      <p className="text-2xl md:text-3xl font-bold">{recall?.toFixed(2) ?? 'N/A'}%</p>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">F1-Score</p>
                      <p className="text-2xl md:text-3xl font-bold">{f1Score?.toFixed(2) ?? 'N/A'}%</p>
                    </div>
                  </div>
               </CardContent>
            </Card>
            {/* ... (Tarjeta de Detalles del Modelo - sin cambios) ... */}
            <Card className="shadow-card overflow-hidden">
               <CardHeader>
                  <CardTitle className="text-xl font-semibold flex items-center gap-3">
                    <BrainCircuit className="w-5 h-5 text-primary" />
                    Detalles del Modelo
                  </CardTitle>
               </CardHeader>
               <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Modelo:</span>{" "}
                      <span className="font-semibold text-right">{modelType || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Fecha:</span>{" "}
                      <span className="font-semibold text-right">{formattedTimestamp}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">
                        Tamaño del Test:
                      </span>{" "}
                      <span className="font-semibold text-right">{testSize ?? 'N/A'}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Random State:</span>{" "}
                      <span className="font-semibold text-right">{randomState ?? 'N/A'}</span>
                    </div>
                     {(nEstimators !== undefined && nEstimators !== null) && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">N° Estimadores:</span>{" "}
                        <span className="font-semibold text-right">{nEstimators}</span>
                      </div>
                     )}
                     {(maxDepth !== undefined && maxDepth !== null && maxDepth > 0) && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Profundidad Máxima:</span>{" "}
                          <span className="font-semibold text-right">{maxDepth}</span>
                        </div>
                     )}
                  </div>
               </CardContent>
            </Card>
            {/* ... (Tarjeta de Features y Target - sin cambios) ... */}
            <Card className="shadow-card overflow-hidden">
               <CardHeader>
                  <CardTitle className="text-xl font-semibold flex items-center gap-3">
                    <Target className="w-5 h-5 text-primary" />
                    Features y Target
                  </CardTitle>
               </CardHeader>
               <CardContent>
                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="text-muted-foreground font-medium mb-1">
                        Features utilizadas:
                      </p>
                      <p className="font-semibold break-words bg-muted/20 p-2 rounded-md">
                        {Array.isArray(features) ? features.join(', ') : (features || 'N/A')}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-medium mb-1">
                        Variable Objetivo:
                      </p>
                      <p className="font-semibold bg-muted/20 p-2 rounded-md">{target || 'N/A'}</p>
                    </div>
                  </div>
               </CardContent>
            </Card>
          </div>

           {/* Columna Derecha: Apartado de Gráficos */}
           <div className="lg:col-span-2 space-y-6">
             <Card className="shadow-card overflow-hidden">
                <CardHeader>
                    <CardTitle className="text-xl font-semibold flex items-center gap-3">
                        <PieChart className="w-5 h-5 text-primary" />
                        Visualizaciones del Modelo
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {/* AÑADIDO: Ahora hay 3 botones/tabs */}
                    <Tabs defaultValue="feature-importance">
                        <TabsList className="grid w-full grid-cols-3 mb-6"> {/* Cambio a grid-cols-3 */}
                            <TabsTrigger value="feature-importance">
                                <BarChart className="w-4 h-4 mr-2" />
                                Importancia
                            </TabsTrigger>
                            <TabsTrigger value="confusion-matrix">
                                <LayoutGrid className="w-4 h-4 mr-2" />
                                Matriz Confusión
                            </TabsTrigger>
                            {/* NUEVO BOTÓN/TAB */}
                            <TabsTrigger value="target-distribution">
                                <PieChart className="w-4 h-4 mr-2" />
                                Distribución Target
                            </TabsTrigger>
                        </TabsList>

                        {/* Contenido Tab Importancia */}
                        <TabsContent value="feature-importance">
                             {/* ... (Gráfico de Barras - sin cambios) ... */}
                            {coloredFeatureImportance && coloredFeatureImportance.length > 0 ? (
                                <div className="h-[500px] flex flex-col">
                                    <div className="mb-4 text-center">
                                      <h3 className="text-lg font-semibold text-foreground">Importancia Relativa de Características</h3>
                                      <p className="text-sm text-muted-foreground">
                                        Qué tanto influye cada característica en las predicciones del modelo.
                                      </p>
                                    </div>
                                    <div className="flex-1 min-h-0">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RechartsBarChart
                                                data={coloredFeatureImportance}
                                                layout="vertical"
                                                margin={{ top: 5, right: 30, left: 10, bottom: 20 }}
                                                barCategoryGap="20%"
                                            >
                                                <CartesianGrid
                                                    horizontal={false}
                                                    strokeDasharray="3 3"
                                                    stroke="hsl(var(--border) / 0.5)"
                                                />
                                                <XAxis
                                                    type="number"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                                    tickFormatter={(value) => `${value}%`}
                                                    domain={[0, 'dataMax + 5']}
                                                />
                                                <YAxis
                                                    dataKey="name"
                                                    type="category"
                                                    width={180}
                                                    tick={{
                                                        fontSize: 12,
                                                        fill: 'hsl(var(--foreground))',
                                                        fontWeight: 500
                                                    }}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    interval={0}
                                                />
                                                <Tooltip
                                                    cursor={{ fill: 'hsl(var(--accent) / 0.1)' }}
                                                    contentStyle={{
                                                        backgroundColor: 'hsl(var(--popover))',
                                                        borderColor: 'hsl(var(--border))',
                                                        borderRadius: 'var(--radius)',
                                                        padding: '8px 12px',
                                                        boxShadow: 'var(--shadow-lg)'
                                                    }}
                                                    itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                                                    labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: 'hsl(var(--popover-foreground))' }}
                                                    formatter={(value: number, name: string, props: any) => [
                                                        `${value.toFixed(2)}%`,
                                                        'Importancia'
                                                    ]}
                                                    labelFormatter={(label) => `Feature: ${label}`}
                                                />
                                                <Bar
                                                  dataKey="importance"
                                                  name="Importancia"
                                                  radius={[0, 4, 4, 0]}
                                                  animationDuration={1500}
                                                  maxBarSize={40}
                                                >
                                                    {coloredFeatureImportance.map((entry, index) => (
                                                        <Cell
                                                            key={`cell-${index}`}
                                                            fill={entry.fill}
                                                            className="transition-opacity hover:opacity-80"
                                                        />
                                                    ))}
                                                </Bar>
                                            </RechartsBarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="mt-6 p-4 bg-muted/10 border border-border rounded-lg">
                                        <h4 className="text-sm font-medium mb-2 flex items-center text-foreground">
                                            <Info className="w-4 h-4 mr-2 text-blue-500" />
                                            Cómo interpretar este gráfico
                                        </h4>
                                        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                                            <li>Las barras más largas indican características más influyentes para las predicciones del modelo.</li>
                                            <li>Los porcentajes indican la contribución relativa de cada característica.</li>
                                            <li>Pasa el cursor sobre las barras para ver los valores exactos.</li>
                                        </ul>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-muted-foreground text-center mt-8 py-4">
                                    No hay datos de importancia de features disponibles para mostrar.
                                </p>
                            )}
                        </TabsContent>

                        {/* Contenido Tab Matriz Confusión */}
                        <TabsContent value="confusion-matrix">
                             {/* ... (Tabla Matriz de Confusión - sin cambios) ... */}
                            {(confusionMatrix && Array.isArray(confusionMatrix) && confusionMatrix.length === 2 && confusionMatrix[0]?.length === 2) ? (
                                <div className="mt-4 p-4 rounded-lg bg-muted/10 border border-border">
                                <h4 className="font-semibold mb-6 text-center text-lg">Matriz de Confusión</h4>
                                <div className="flex justify-center">
                                    <table className="border-collapse border border-border text-center shadow-sm rounded-lg overflow-hidden w-full max-w-sm">
                                        <thead className="bg-muted/50">
                                            <tr>
                                                <th className="border border-border p-3 w-24"></th>
                                                <th colSpan={2} className="border border-border p-3 font-semibold text-foreground text-sm">Predicho</th>
                                            </tr>
                                            <tr>
                                                <th className="border border-border p-3"></th>
                                                <th className="border border-border p-3 font-medium text-muted-foreground text-xs">Negativo (0)</th>
                                                <th className="border border-border p-3 font-medium text-muted-foreground text-xs">Positivo (1)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <th rowSpan={2} className="border border-border p-3 font-semibold text-foreground bg-muted/50 text-sm" style={{ writingMode: 'vertical-lr', textOrientation: 'mixed' }}>
                                                    <span className="transform rotate-180">Real</span>
                                                </th>
                                                <th className="border border-border p-3 font-medium text-muted-foreground bg-muted/50 text-xs">Negativo (0)</th>
                                                <td className="border border-border p-4 text-lg font-bold bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200">{confusionMatrix[0][0]} <span className="block text-xs font-normal text-muted-foreground mt-1">(VN)</span></td>
                                                <td className="border border-border p-4 text-lg font-bold bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200">{confusionMatrix[0][1]} <span className="block text-xs font-normal text-muted-foreground mt-1">(FP)</span></td>
                                            </tr>
                                            <tr>
                                                <th className="border border-border p-3 font-medium text-muted-foreground bg-muted/50 text-xs">Positivo (1)</th>
                                                <td className="border border-border p-4 text-lg font-bold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-200">{confusionMatrix[1][0]} <span className="block text-xs font-normal text-muted-foreground mt-1">(FN)</span></td>
                                                <td className="border border-border p-4 text-lg font-bold bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200">{confusionMatrix[1][1]} <span className="block text-xs font-normal text-muted-foreground mt-1">(VP)</span></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-6 text-xs text-muted-foreground text-center space-y-1">
                                    <p><span className="font-semibold">VN:</span> Verdadero Negativo (predicción correcta 0)</p>
                                    <p><span className="font-semibold">FP:</span> Falso Positivo (predicción incorrecta 1)</p>
                                    <p><span className="font-semibold">FN:</span> Falso Negativo (predicción incorrecta 0)</p>
                                    <p><span className="font-semibold">VP:</span> Verdadero Positivo (predicción correcta 1)</p>
                                </div>
                                </div>
                            ) : (
                                <p className="text-muted-foreground text-center mt-8 py-4">
                                    Matriz de confusión no disponible o en formato incorrecto.
                                </p>
                            )}
                        </TabsContent>

                        {/* NUEVO CONTENIDO TAB: Gráfico de Pastel */}
                        <TabsContent value="target-distribution">
                            <div className="h-[500px] flex flex-col mt-4">
                                <div className="mb-4 text-center">
                                    <h3 className="text-lg font-semibold text-foreground">Distribución de la Variable Objetivo</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Proporción de cada clase en la variable '{target || 'objetivo'}'. (Datos de ejemplo)
                                    </p>
                                </div>
                                <div className="flex-1 min-h-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RechartsPieChart>
                                            <Pie
                                                data={pieChartData} // Usar los datos de ejemplo
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                // label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                                                //     const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                                //     const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                                                //     const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                                                //     return (
                                                //         <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                                                //             {`${(percent * 100).toFixed(0)}%`}
                                                //         </text>
                                                //     );
                                                // }} // Etiqueta dentro de las porciones (opcional)
                                                outerRadius={150} // Radio exterior
                                                fill="#8884d8"
                                                dataKey="value"
                                                nameKey="name"
                                                animationDuration={1000}
                                            >
                                                {pieChartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'hsl(var(--popover))',
                                                    borderColor: 'hsl(var(--border))',
                                                    borderRadius: 'var(--radius)',
                                                    padding: '8px 12px',
                                                    boxShadow: 'var(--shadow-lg)'
                                                }}
                                                itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                                                formatter={(value: number, name: string) => [`${value} instancias`, name]} // Formato tooltip
                                            />
                                            <Legend
                                                layout="horizontal" // Leyenda horizontal
                                                verticalAlign="bottom" // Abajo
                                                align="center" // Centrada
                                            />
                                        </RechartsPieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="mt-6 p-4 bg-muted/10 border border-border rounded-lg">
                                    <h4 className="text-sm font-medium mb-2 flex items-center text-foreground">
                                        <Info className="w-4 h-4 mr-2 text-blue-500" />
                                        Acerca de este gráfico
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                        Este gráfico muestra la proporción de cada categoría en la variable objetivo utilizada para el entrenamiento.
                                        <strong className="text-amber-600 dark:text-amber-400"> Nota: Actualmente usa datos de ejemplo.</strong> Se necesita calcular la distribución real de la variable '{target || 'objetivo'}' en los datos procesados.
                                    </p>
                                </div>
                            </div>
                        </TabsContent>

                    </Tabs>
                </CardContent>
             </Card>
          </div>

        </div>
      </main>
    </div>
  );
};

export default Results;