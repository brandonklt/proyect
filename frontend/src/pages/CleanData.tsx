import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Droplets,
  Eye,
  Brain,
  Search,
  X,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const apiUrl = import.meta.env.VITE_API_URL;

const CleanData = () => {
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [currentFileId, setCurrentFileId] = useState<number | null>(null);
  const [dataStats, setDataStats] = useState({
    rows: 0,
    columns: 0,
    nullValues: 0,
    duplicates: 0,
  });
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const cleanedFile = localStorage.getItem("cleanedFileName");
    const uploadedFile = localStorage.getItem("uploadedFileName");
    const fileName = cleanedFile || uploadedFile;
    setCurrentFileName(fileName);

    const uploadedFileId = localStorage.getItem("uploadedFileId");
    if (uploadedFileId) {
      setCurrentFileId(parseInt(uploadedFileId, 10));
    }

    const fetchCsvInfo = async () => {
      if (!fileName) return;
      try {
        const response = await fetch(`${apiUrl}/get-csv-info/${fileName}`);
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.detail || "Failed to fetch CSV info");
        }

        const result = await response.json();

        // 🔹 Copiamos los datos originales
        let cleanedData = [...result.preview_data];

        // 🔹 Reemplazamos TODOS los valores nulos o "NULL" por "Eliminado"
        cleanedData = cleanedData.map((row) => {
          const newRow: Record<string, any> = {};
          for (const key in row) {
            const value = row[key];
            if (value === null || String(value).toUpperCase() === "NULL") {
              newRow[key] = "Eliminado";
            } else {
              newRow[key] = value;
            }
          }
          return newRow;
        });

        // 🔹 Guardamos todo
        setDataStats(result.stats);
        setPreviewData(cleanedData);
        setFilteredData(cleanedData);

        if (result.actual_filename && result.actual_filename !== fileName) {
          setCurrentFileName(result.actual_filename);
          if (result.actual_filename.startsWith("cleaned_")) {
            localStorage.setItem("cleanedFileName", result.actual_filename);
          } else {
            localStorage.setItem("uploadedFileName", result.actual_filename);
          }
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

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      setFilteredData(previewData);
      return;
    }
    const filtered = previewData.filter((row) =>
      Object.values(row).some((value) =>
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
    if (e.key === "Enter") handleSearch();
  };

  const handleProcessAndTrain = async () => {
    if (!currentFileId) {
      toast({ title: "Error", description: "No se encontró el ID del archivo para procesar.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      const response = await fetch(`${apiUrl}/clean-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archivo_id: currentFileId, operations: [] }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || "Error al procesar y subir los datos.");
      }
      toast({ title: "Éxito", description: result.message });
      localStorage.setItem('cleanedFileName', result.cleaned_filename);
      localStorage.setItem('datosProcesadosId', result.datos_procesados_id);
      navigate("/train-models");
    } catch (error: any) {
      toast({ title: "Error en el proceso", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
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
              <Droplets className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Limpiar Datos
              </h1>
              <p className="text-muted-foreground">
                Preprocesa y limpia tus datasets con herramientas avanzadas
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {previewData.length > 0 ? (
          <div className="max-w-6xl mx-auto mb-6">
            <Card className="p-6 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">Vista Previa de Datos</h3>
                  <p className="text-sm text-muted-foreground">
                    La tabla de abajo muestra una vista previa de los datos
                    limpios.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Buscar..."
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
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 sticky top-0">
                      <tr>
                        {Object.keys(previewData[0] || {}).map((key) => (
                          <th
                            key={key}
                            className="px-4 py-2 text-left font-medium text-muted-foreground"
                          >
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((row, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-border hover:bg-muted/20"
                        >
                          {Object.keys(row).map((key) => (
                            <td key={key} className="px-4 py-2 whitespace-nowrap">
                              {row[key] === "Eliminado" ? (
                                <span className="text-blue-500 font-semibold">
                                  {row[key]}
                                </span>
                              ) : (
                                String(row[key])
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
        ) : (
          <p>
            No hay datos de previsualización para mostrar. Sube un archivo para
            empezar.
          </p>
        )}

        <div className="max-w-6xl mx-auto grid grid-cols-1 gap-6">
          <Card className="p-6 shadow-card">
            <h3 className="font-semibold mb-4">Estadísticas del dataset</h3>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Filas totales</span>
                <span className="font-semibold">
                  {dataStats.rows.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Columnas</span>
                <span className="font-semibold">{dataStats.columns}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valores nulos</span>
                <span
                  className={`font-semibold ${
                    dataStats.nullValues > 0 ? "text-warning" : "text-success"
                  }`}
                >
                  {dataStats.nullValues}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Duplicados</span>
                <span
                  className={`font-semibold ${
                    dataStats.duplicates > 0
                      ? "text-destructive"
                      : "text-success"
                  }`}
                >
                  {dataStats.duplicates}
                </span>
              </div>
              <Separator />
            </div>
          </Card>

          {currentFileName && (
            <div className="flex flex-col sm:flex-row gap-3 mt-6 p-4 bg-success/10 rounded-lg border border-success/20 items-center">
              <div className="text-center sm:text-left flex-1 mb-2 sm:mb-0">
                <h4 className="font-bold text-success">Datos Listos</h4>
                <p className="text-sm text-muted-foreground">
                  Los datos están listos para el siguiente paso.
                </p>
              </div>
              <div className="flex gap-3">
                <Link to={`/view-data/${currentFileName}`}><Button variant="secondary" className="gap-2"><Eye className="w-4 h-4" />Visualizar</Button></Link>
                <Button onClick={handleProcessAndTrain} disabled={isProcessing} className="gap-2">
                  <Brain className="w-4 h-4" />
                  {isProcessing ? "Procesando y Subiendo..." : "Entrenar Modelos"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CleanData;
