import { useState } from "react";
import { Upload, FileText, ArrowLeft, CheckCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Eliminamos la importación de Tabs ya que no se usarán
import { useToast } from "@/hooks/use-toast";

const LoadData = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar que sea CSV aquí para mayor robustez
      if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
        toast({
          title: "Archivo no válido",
          description: "Por favor, selecciona un archivo .csv",
          variant: "destructive",
        });
        setUploadedFile(null); // Limpiar si no es CSV
        event.target.value = ''; // Resetear el input file
        return;
      }
      setUploadedFile(file);
      setPreviewData([]); // Limpiar vista previa al cargar nuevo archivo

      toast({
        title: "Archivo seleccionado",
        description: `${file.name} está listo para procesarse`,
      });
    }
  };

  const handlePreview = () => {
    if (!uploadedFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length === 0) {
        toast({
          title: "Archivo vacío",
          description: "El archivo CSV parece estar vacío.",
          variant: "destructive",
        });
        return;
      }

      // Parse CSV header
      // Manejar posibles errores en la separación por comas o diferentes delimitadores
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '')); // Remover comillas

      // Parse first 6 data rows
      const rows = lines.slice(1, 7).map(line => {
        // Considerar comillas en los valores
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] !== undefined ? values[index] : null; // Asegurar null si falta valor
        });
        return row;
      });

      setPreviewData(rows);

      toast({
        title: "Vista previa generada",
        description: `Mostrando ${rows.length} filas de ${lines.length - 1} totales (aproximado)`,
      });
    };
    reader.onerror = () => {
        toast({
            title: "Error al leer archivo",
            description: "No se pudo leer el contenido del archivo.",
            variant: "destructive",
          });
    }

    reader.readAsText(uploadedFile);
  };

  const handleProcessData = async () => {
    if (!uploadedFile) {
      toast({
        title: "Error",
        description: "Por favor carga un archivo CSV primero",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    const formData = new FormData();
    formData.append("file", uploadedFile);

    try {
      const response = await fetch("http://127.0.0.1:8000/upload-csv", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || result.error || "Error al subir el archivo"); // Usar detail o error
      }

      toast({
        title: "Archivo subido exitosamente",
        description: `${result.filename} ha sido subido. Redirigiendo a limpieza...`,
      });

      localStorage.setItem('uploadedFileName', result.filename);
      // Limpiar archivo limpiado anterior si existe
      localStorage.removeItem('cleanedFileName');

      setTimeout(() => navigate('/clean-data'), 1000);

    } catch (error: any) {
      toast({
        title: "Error al procesar el archivo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <Link to="/" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al dashboard
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
              {/* Cambiamos el icono a FileText ya que solo manejamos CSV */}
              <FileText className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Cargar Datos CSV</h1>
              <p className="text-muted-foreground">Importa archivos CSV para análisis</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Eliminamos la estructura de Tabs */}
        <div className="max-w-4xl mx-auto">
          <Card className="p-8 shadow-card">
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-primary"/> Importar archivo CSV
                </h3>
                <p className="text-muted-foreground">Selecciona un archivo CSV desde tu computadora</p>
              </div>

              <div className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-primary transition-colors cursor-pointer bg-muted/10" onClick={() => document.getElementById('file-upload')?.click()}>
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <div className="text-lg font-medium mb-2">
                    {uploadedFile ? uploadedFile.name : "Arrastra tu archivo CSV aquí"}
                  </div>
                  <div className="text-sm text-muted-foreground mb-4">
                    o haz clic para seleccionar (solo .csv)
                  </div>
                  {/* Input ahora está oculto pero funcional */}
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".csv,text/csv" // Ser más específico con accept
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  {/* El botón ahora es decorativo, la acción está en el div padre */}
                  <Button variant="secondary" className="mt-2 pointer-events-none">
                    Seleccionar archivo
                  </Button>
                </Label>
              </div>

              {uploadedFile && (
                <div className="bg-success/10 border border-success/20 rounded-lg p-4 flex items-center gap-3 text-sm">
                  <CheckCircle className="w-5 h-5 text-success shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-success">Archivo listo:</p>
                    <p className="text-muted-foreground break-all">{uploadedFile.name}</p>
                  </div>
                  {/* Botón para quitar el archivo */}
                   <Button variant="ghost" size="sm" onClick={() => {
                       setUploadedFile(null);
                       setPreviewData([]);
                       // Resetear el input file para permitir volver a cargar el mismo archivo
                       const input = document.getElementById('file-upload') as HTMLInputElement;
                       if(input) input.value = '';
                       toast({ title: "Archivo deseleccionado"});
                    }}>Quitar</Button>
                </div>
              )}

              {previewData.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden mt-6 animate-in fade-in duration-300">
                  <div className="bg-muted/30 px-4 py-2 border-b border-border">
                    <h4 className="font-semibold text-sm text-muted-foreground">Vista previa de datos (primeras {previewData.length} filas)</h4>
                  </div>
                  {/* ESTE DIV CONTROLA EL SCROLL */}
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 sticky top-0 z-[1]">
                        <tr>
                          {Object.keys(previewData[0]).map((key) => (
                            <th key={key} className="px-4 py-2 text-left font-medium text-muted-foreground border-b border-r border-border last:border-r-0 whitespace-nowrap">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, idx) => (
                          <tr key={idx} className="border-b border-border last:border-b-0 hover:bg-muted/20">
                            {Object.keys(row).map((key: any, cellIdx) => (
                              <td key={cellIdx} className="px-4 py-2 border-r border-border last:border-r-0 whitespace-nowrap max-w-xs overflow-hidden text-ellipsis" title={row[key]}>
                                {row[key] === null || row[key] === '' ? ( // Considerar strings vacíos como null visualmente
                                  <span className="text-muted-foreground italic">null</span>
                                ) : (
                                  String(row[key]) // Convertir a string explícitamente
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border mt-6">
                <Button
                  className="flex-1 gap-2"
                  onClick={handleProcessData}
                  disabled={!uploadedFile || isProcessing}
                >
                  <FileText className="w-4 h-4"/>
                  {isProcessing ? "Procesando..." : "Procesar y Continuar"}
                </Button>
                <Button variant="outline" disabled={!uploadedFile || isProcessing} onClick={handlePreview}>
                  Vista previa
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default LoadData;