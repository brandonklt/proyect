import { useState, useEffect } from "react";
import { ArrowLeft, Droplets, Settings2, Play, Eye, Brain, Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const CleanData = () => {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanedFileName, setCleanedFileName] = useState<string | null>(null);
  const [dataStats, setDataStats] = useState({
    rows: 0,
    columns: 0,
    nullValues: 0,
    duplicates: 0,
  });
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    const cleanedFile = localStorage.getItem('cleanedFileName');
    const uploadedFile = localStorage.getItem('uploadedFileName');

    // Prioritize showing the state for the cleaned file if it exists
    const fileName = cleanedFile || uploadedFile;

    const fetchCsvInfo = async () => {
      try {
        let response;
        if (fileName) {
          response = await fetch(`http://127.0.0.1:8000/get-csv-info/${fileName}`);
        } else {
          // Si no hay archivo específico, obtener el más reciente
          response = await fetch(`http://127.0.0.1:8000/get-csv-info/latest`);
        }
        
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.detail || 'Failed to fetch CSV info');
        }
        
        setDataStats(result.stats);
        setPreviewData(result.preview_data);
        setFilteredData(result.preview_data);
        
        // Si se devolvió un nombre de archivo diferente, actualizar el localStorage
        if (result.actual_filename && result.actual_filename !== fileName) {
          if (result.actual_filename.startsWith('cleaned_')) {
            setCleanedFileName(result.actual_filename);
            localStorage.setItem('cleanedFileName', result.actual_filename);
          } else {
            localStorage.setItem('uploadedFileName', result.actual_filename);
          }
        } else if (cleanedFile) {
          setCleanedFileName(cleanedFile);
        }
        
      } catch (error: any) {
        toast({
          title: "Error al cargar datos",
          description: error.message,
          variant: "destructive",
        });
      }
    };
    
    fetchCsvInfo();
  }, [toast]);

  const handleOptionToggle = (optionId: string) => {
    setSelectedOptions(prev => 
      prev.includes(optionId) 
        ? prev.filter(id => id !== optionId)
        : [...prev, optionId]
    );
  };

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      setFilteredData(previewData);
      return;
    }

    const filtered = previewData.filter(row => 
      Object.values(row).some(value => 
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
    setFilteredData(filtered);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setFilteredData(previewData);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleCleanData = async () => {
    if (selectedOptions.length === 0) {
      toast({
        title: "Selecciona al menos una opción",
        description: "Elige las técnicas de limpieza que deseas aplicar",
        variant: "destructive",
      });
      return;
    }

    const originalFileName = localStorage.getItem('uploadedFileName');
    if (!originalFileName) {
      toast({
        title: "Error",
        description: "No se encontró el archivo original. Por favor, vuelve a cargarlo.",
        variant: "destructive",
      });
      return;
    }

    setIsCleaning(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/clean-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: originalFileName,
          operations: selectedOptions,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Error al limpiar los datos");
      }

      // Usar stats originales para mostrar en el frontend (mantener nulos visibles)
      setDataStats(result.original_stats || result.cleaned_stats);
      setPreviewData(result.preview_data);
      setFilteredData(result.preview_data);
      setCleanedFileName(result.cleaned_filename);

      localStorage.setItem('cleanedFileName', result.cleaned_filename);

      toast({
        title: "Limpieza completada",
        description: `Dataset limpio: ${result.cleaned_stats.rows} filas procesadas correctamente. Los nulos siguen visibles en el frontend.`,
      });

    } catch (error: any) {
      toast({
        title: "Error en la limpieza",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCleaning(false);
    }
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
        {previewData.length > 0 && (
          <div className="max-w-6xl mx-auto mb-6">
            <Card className="p-6 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">Vista Previa de Datos</h3>
                  <p className="text-sm text-muted-foreground">La tabla de abajo muestra una vista previa de los datos. Después de la limpieza, la vista previa se actualizará.</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Buscar en los datos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="w-64"
                    />
                    <Button onClick={handleSearch} size="sm" variant="outline">
                      <Search className="w-4 h-4" />
                    </Button>
                    <Button onClick={handleClearSearch} size="sm" variant="outline">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {filteredData.length !== previewData.length ? (
                      <>Mostrando {filteredData.length} de {previewData.length} filas</>
                    ) : (
                      <>Vista previa de datos</>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {Object.keys(previewData[0]).length} columnas
                  </div>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <div className="min-w-full">
                    <table className="w-full text-sm min-w-max">
                      <thead className="bg-muted/30 sticky top-0">
                        <tr>
                          {Object.keys(previewData[0]).map((key) => (
                            <th key={key} className="px-4 py-2 text-left font-medium text-muted-foreground border-b border-border whitespace-nowrap min-w-[120px]">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredData.map((row, idx) => (
                          <tr key={idx} className="border-b border-border hover:bg-muted/20">
                            {Object.values(row).map((value: any, cellIdx) => (
                              <td key={cellIdx} className="px-4 py-2 whitespace-nowrap min-w-[120px]">
                                {value === null ? (
                                  <span className="text-pink-500 italic font-semibold bg-pink-50 px-2 py-1 rounded text-xs">null</span>
                                ) : (
                                  <span className="truncate block max-w-[200px]" title={String(value)}>
                                    {String(value)}
                                  </span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="bg-muted/30 px-4 py-2 text-xs text-muted-foreground border-t border-border">
                  💡 Desplázate horizontalmente para ver todas las columnas
                </div>
              </div>
            </Card>
          </div>
        )}

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
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

              {!cleanedFileName ? (
                <div className="flex gap-3 mt-8">
                  <Button 
                    className="flex-1 gap-2"
                    onClick={handleCleanData}
                    disabled={isCleaning || selectedOptions.length === 0}
                  >
                    <Play className="w-4 h-4" />
                    {isCleaning ? "Limpiando..." : "Ejecutar limpieza"}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3 mt-8 p-4 bg-success/10 rounded-lg border border-success/20 items-center">
                    <div className="text-center sm:text-left flex-1 mb-2 sm:mb-0">
                        <h4 className="font-bold text-success">Limpieza Completada</h4>
                        <p className="text-sm text-muted-foreground">Los datos están listos para entrenamiento. Los valores nulos siguen visibles en el frontend pero serán ignorados durante el entrenamiento.</p>
                    </div>
                    <div className="flex gap-3">
                        <Link to={`/view-data/${cleanedFileName}`}>
                            <Button variant="secondary" className="gap-2">
                                <Eye className="w-4 h-4"/>
                                Visualizar
                            </Button>
                        </Link>
                        <Link to="/train-models">
                            <Button className="gap-2">
                                <Brain className="w-4 h-4"/>
                                Continuar
                            </Button>
                        </Link>
                    </div>
                </div>
              )}
            </Card>
          </div>

          {/* Stats Panel */}
          <div className="space-y-6">
            <Card className="p-6 shadow-card">
              <h3 className="font-semibold mb-4">Estadísticas del dataset</h3>
              {cleanedFileName && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Nota:</strong> Los valores nulos siguen visibles en el frontend (color rosado) pero serán ignorados durante el entrenamiento del modelo.
                  </p>
                </div>
              )}
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
