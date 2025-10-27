import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, X } from "lucide-react";

const apiUrl = import.meta.env.VITE_API_URL;

// Reusable DataTable Component with Search
const DataTable = ({ title, data, headers }: { title: string, data: any[], headers: string[] }) => {
  const [searchTerm, setSearchTerm] = useState("");
  
  // Filtrar datos basado en el término de búsqueda
  const filteredData = data.filter(row => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    
    // Buscar en todos los campos de la fila, especialmente en ID
    return Object.values(row).some(value => 
      String(value || '').toLowerCase().includes(searchLower)
    );
  });

  const clearSearch = () => {
    setSearchTerm("");
  };

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>No hay datos para mostrar.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Barra de búsqueda compacta */}
        <div className="flex items-center justify-end gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3.5 w-3.5" />
            <Input
              placeholder="Buscar por ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 h-9 text-sm"
            />
          </div>
          {searchTerm && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearSearch}
              className="flex-shrink-0 h-9"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">Limpiar</span>
            </Button>
          )}
        </div>
        
        {/* Contador de resultados */}
        {searchTerm && (
          <p className="text-sm text-muted-foreground">
            Mostrando {filteredData.length} de {data.length} registros
          </p>
        )}
        
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-[550px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  {headers.map((header) => (
                    <TableHead key={header} className="whitespace-nowrap">{header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 && searchTerm ? (
                  <TableRow>
                    <TableCell colSpan={headers.length} className="text-center text-muted-foreground py-8">
                      No se encontraron resultados para "{searchTerm}"
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {headers.map((header) => (
                        <TableCell key={`${rowIndex}-${header}`} className="whitespace-nowrap">
                          {row[header] === null || row[header] === undefined ? (
                            <span className="text-pink-500 italic">null</span>
                          ) : (
                            String(row[header])
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ViewData = () => {
  const { filename } = useParams<{ filename: string }>();
  const [rawData, setRawData] = useState<any[]>([]);
  const [processedData, setProcessedData] = useState<any[]>([]);
  const [discardedRows, setDiscardedRows] = useState<any[]>([]);
  
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [processedHeaders, setProcessedHeaders] = useState<string[]>([]);
  const [discardedHeaders, setDiscardedHeaders] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllData = async (file: string) => {
      const response = await fetch(`${apiUrl}/view-data/${file}?page=1&page_size=10000`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || `Failed to fetch data for ${file}`);
      }
      return response.json();
    };

    const processData = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch raw and cleaned data
        const originalFilename = filename?.replace("cleaned_", "");
        const rawResult = await fetchAllData(originalFilename!);
        const cleanedResult = await fetchAllData(filename!);

        setRawData(rawResult.data);
        setRawHeaders(rawResult.headers);

        const cleanedData = cleanedResult.data;
        const cleanedHeaders = cleanedResult.headers;

        if (!cleanedData || cleanedData.length === 0) {
            setProcessedData([]);
            setDiscardedRows([]);
            setProcessedHeaders([]);
            setDiscardedHeaders([]);
            return;
        }

        // 2. Define column types
        const columnTypes: { [key: string]: 'numeric' | 'string' } = {};
        for (const header of cleanedHeaders) {
            const firstValue = cleanedData.find(row => row[header] !== null)?.[header];
            if (firstValue !== undefined && !isNaN(Number(firstValue))) {
                columnTypes[header] = 'numeric';
            } else {
                columnTypes[header] = 'string';
            }
        }

        const stringColumns = cleanedHeaders.filter(h => columnTypes[h] === 'string');
        const numericColumns = cleanedHeaders.filter(h => columnTypes[h] === 'numeric');

        // 3. Separate data into kept and discarded rows
        const keptRows = cleanedData.filter(row => !stringColumns.some(col => row[col] === null));
        const rejectedRows = cleanedData.filter(row => stringColumns.some(col => row[col] === null));

        // 4. Process the kept rows for the "Processed Data" table
        const processed = keptRows.map(row => {
            const newRow = { ...row };
            const rowNumericValues = numericColumns
                .map(col => newRow[col])
                .filter(val => val !== null && !isNaN(Number(val)))
                .map(Number);
            
            const nullNumericColsInRow = numericColumns.filter(col => newRow[col] === null);

            if (nullNumericColsInRow.length > 0 && rowNumericValues.length > 0) {
                const rowAverage = rowNumericValues.reduce((acc, val) => acc + val, 0) / rowNumericValues.length;
                nullNumericColsInRow.forEach(col => {
                    newRow[col] = rowAverage.toFixed(2);
                });
            }
            return newRow;
        });

        setProcessedData(processed);
        setProcessedHeaders(cleanedHeaders);

        // 5. Setup the "Discarded Rows" table - Mostrar TODAS las columnas
        const discardedDisplayHeaders = [...cleanedHeaders]; // Usar todas las columnas

        const rejectedRowsForDisplay = rejectedRows.map((row: any) => {
            const newRow: any = {};
            for (const header of discardedDisplayHeaders) {
                newRow[header] = row[header];
            }
            return newRow;
        });
        setDiscardedRows(rejectedRowsForDisplay);
        setDiscardedHeaders(discardedDisplayHeaders);

      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    if (filename) {
      processData();
    }
  }, [filename]);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link to="/clean-data" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Limpiar Datos
          </Link>
        </div>

        {loading && (
          <div className="flex items-center justify-center p-8">
            <p className="text-muted-foreground">Cargando y procesando datos...</p>
          </div>
        )}
        
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-destructive">Error: {error}</p>
          </div>
        )}
        
        {!loading && !error && (
          <Tabs defaultValue="raw" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="raw" className="text-sm">📊 Datos Crudos</TabsTrigger>
              <TabsTrigger value="processed" className="text-sm">✨ Datos Procesados</TabsTrigger>
              <TabsTrigger value="discarded" className="text-sm">🗑️ Datos Descartados</TabsTrigger>
            </TabsList>
            
            <TabsContent value="raw" className="mt-4">
              <DataTable title="Datos Crudos (Original)" data={rawData} headers={rawHeaders} />
            </TabsContent>
            
            <TabsContent value="processed" className="mt-4">
              <DataTable title="Datos Procesados" data={processedData} headers={processedHeaders} />
            </TabsContent>
            
            <TabsContent value="discarded" className="mt-4">
              <DataTable title="Filas con Nulos de Texto (Descartadas)" data={discardedRows} headers={discardedHeaders} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default ViewData;