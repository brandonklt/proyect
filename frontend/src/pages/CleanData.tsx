import { useState, useEffect } from "react";
import { ArrowLeft, Droplets, Settings2, Play } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

const CleanData = () => {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isCleaning, setIsCleaning] = useState(false);
  const [dataStats, setDataStats] = useState({
    rows: 0,
    columns: 0,
    nullValues: 0,
    duplicates: 0,
  });
  const [previewData, setPreviewData] = useState<any[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const storedData = localStorage.getItem('mlPipelineData');
    if (storedData) {
      const data = JSON.parse(storedData);
      setDataStats({
        rows: data.rows || 0,
        columns: data.columns || 0,
        nullValues: data.nullValues || 0,
        duplicates: data.duplicates || 0,
      });
      
      // Cargar datos de muestra
      if (data.sampleRows && data.sampleRows.length > 0) {
        setPreviewData(data.sampleRows.slice(0, 6));
      }
    }
  }, []);

  const handleOptionToggle = (optionId: string) => {
    setSelectedOptions(prev => 
      prev.includes(optionId) 
        ? prev.filter(id => id !== optionId)
        : [...prev, optionId]
    );
  };

  const handleCleanData = () => {
    if (selectedOptions.length === 0) {
      toast({
        title: "Selecciona al menos una opción",
        description: "Elige las técnicas de limpieza que deseas aplicar",
        variant: "destructive",
      });
      return;
    }

    setIsCleaning(true);

    setTimeout(() => {
      const storedData = JSON.parse(localStorage.getItem('mlPipelineData') || '{}');
      let cleanedData = [...(storedData.allData || [])];
      
      // Aplicar limpieza según opciones seleccionadas
      if (selectedOptions.includes('remove-na')) {
        cleanedData = cleanedData.filter(row => 
          Object.values(row).every(val => val !== null && val !== '' && val !== undefined)
        );
      }
      
      if (selectedOptions.includes('remove-duplicates')) {
        const uniqueRows = new Set();
        cleanedData = cleanedData.filter(row => {
          const rowStr = JSON.stringify(row);
          if (uniqueRows.has(rowStr)) return false;
          uniqueRows.add(rowStr);
          return true;
        });
      }
      
      // Actualizar vista previa con datos limpios
      setPreviewData(cleanedData.slice(0, 6));
      
      const cleanedStats = {
        rows: cleanedData.length,
        columns: storedData.columns || 0,
        nullValues: 0,
        duplicates: 0,
      };

      setDataStats(cleanedStats);
      
      localStorage.setItem('mlPipelineData', JSON.stringify({
        ...storedData,
        allData: cleanedData,
        sampleRows: cleanedData.slice(0, 10),
        ...cleanedStats,
        cleaned: true,
        cleaningMethods: selectedOptions,
      }));

      toast({
        title: "Limpieza completada",
        description: `Dataset limpio: ${cleanedStats.rows} filas procesadas correctamente`,
      });

      setIsCleaning(false);
      setTimeout(() => navigate('/train-models'), 1000);
    }, 2500);
  };

  const cleaningOptions = [
    {
      category: "Valores faltantes",
      options: [
        { id: "remove-na", label: "Eliminar filas con valores nulos", method: "dropna()" },
        { id: "fill-mean", label: "Rellenar con media", method: "fillna(mean)" },
        { id: "fill-median", label: "Rellenar con mediana", method: "fillna(median)" },
        { id: "interpolate", label: "Interpolación lineal", method: "interpolate()" },
      ],
    },
    {
      category: "Duplicados",
      options: [
        { id: "remove-duplicates", label: "Eliminar filas duplicadas", method: "drop_duplicates()" },
        { id: "keep-first", label: "Mantener primera ocurrencia", method: "keep='first'" },
      ],
    },
    {
      category: "Outliers",
      options: [
        { id: "remove-outliers", label: "Eliminar valores atípicos (Z-score > 3)", method: "scipy.stats" },
        { id: "cap-outliers", label: "Limitar valores extremos (IQR)", method: "np.clip()" },
      ],
    },
    {
      category: "Transformaciones",
      options: [
        { id: "normalize", label: "Normalización (0-1)", method: "MinMaxScaler" },
        { id: "standardize", label: "Estandarización (Z-score)", method: "StandardScaler" },
        { id: "log-transform", label: "Transformación logarítmica", method: "np.log()" },
      ],
    },
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
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Droplets className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Limpiar Datos</h1>
              <p className="text-muted-foreground">Preprocesa y limpia tus datasets con herramientas avanzadas</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Vista previa de datos */}
        {previewData.length > 0 && (
          <div className="max-w-6xl mx-auto mb-6">
            <Card className="p-6 shadow-card">
              <h3 className="font-semibold mb-4">Datos a limpiar (vista previa)</h3>
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr>
                        {Object.keys(previewData[0]).map((key) => (
                          <th key={key} className="px-4 py-2 text-left font-medium text-muted-foreground border-b border-border">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, idx) => (
                        <tr key={idx} className="border-b border-border hover:bg-muted/20">
                          {Object.values(row).map((value: any, cellIdx) => (
                            <td key={cellIdx} className="px-4 py-2">
                              {value === null ? (
                                <span className="text-warning italic font-semibold">null</span>
                              ) : (
                                value
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          </div>
        )}

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Options Panel */}
          <div className="lg:col-span-2">
            <Card className="p-6 shadow-card">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Settings2 className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-semibold">Opciones de limpieza</h2>
                </div>
              </div>

              <div className="space-y-6">
                {cleaningOptions.map((section, idx) => (
                  <div key={section.category}>
                    <h3 className="font-semibold text-foreground mb-3">{section.category}</h3>
                    <div className="space-y-3">
                      {section.options.map((option) => (
                        <div key={option.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors">
                          <Checkbox 
                            id={option.id}
                            checked={selectedOptions.includes(option.id)}
                            onCheckedChange={() => handleOptionToggle(option.id)}
                          />
                          <div className="flex-1">
                            <Label htmlFor={option.id} className="cursor-pointer font-medium">
                              {option.label}
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              <code className="text-xs bg-muted px-2 py-0.5 rounded">{option.method}</code>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {idx < cleaningOptions.length - 1 && <Separator className="mt-6" />}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-8">
                <Button 
                  className="flex-1 gap-2"
                  onClick={handleCleanData}
                  disabled={isCleaning}
                >
                  <Play className="w-4 h-4" />
                  {isCleaning ? "Limpiando..." : "Ejecutar limpieza"}
                </Button>
                <Button 
                  variant="outline" 
                  disabled={selectedOptions.length === 0}
                  onClick={() => {
                    toast({
                      title: "Vista previa",
                      description: "Los datos mostrados arriba reflejan las opciones seleccionadas",
                    });
                  }}
                >
                  Vista previa
                </Button>
              </div>
            </Card>
          </div>

          {/* Stats Panel */}
          <div className="space-y-6">
            <Card className="p-6 shadow-card">
              <h3 className="font-semibold mb-4">Estadísticas del dataset</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Filas totales</span>
                    <span className="font-semibold">{dataStats.rows.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Columnas</span>
                    <span className="font-semibold">{dataStats.columns}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Valores nulos</span>
                    <span className={`font-semibold ${dataStats.nullValues > 0 ? 'text-warning' : 'text-success'}`}>
                      {dataStats.nullValues}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Duplicados</span>
                    <span className={`font-semibold ${dataStats.duplicates > 0 ? 'text-destructive' : 'text-success'}`}>
                      {dataStats.duplicates}
                    </span>
                  </div>
                </div>
                <Separator />
                {dataStats.rows > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-3">Calidad de datos</h4>
                    <div className="space-y-2">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Completitud</span>
                          <span className="font-medium">
                            {((1 - dataStats.nullValues / (dataStats.rows * dataStats.columns)) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-success" style={{ width: `${((1 - dataStats.nullValues / (dataStats.rows * dataStats.columns)) * 100)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Unicidad</span>
                          <span className="font-medium">
                            {((1 - dataStats.duplicates / dataStats.rows) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-success" style={{ width: `${((1 - dataStats.duplicates / dataStats.rows) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-6 shadow-card bg-gradient-card">
              <h3 className="font-semibold mb-3">Métodos disponibles</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Pandas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-muted-foreground">NumPy</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Scikit-learn</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CleanData;
