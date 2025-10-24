import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";

// Reusable DataTable Component
const DataTable = ({ title, data, headers }: { title: string, data: any[], headers: string[] }) => {
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
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-[600px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  {headers.map((header) => (
                    <TableHead key={header} className="whitespace-nowrap">{header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {headers.map((header) => (
                      <TableCell key={`${rowIndex}-${header}`} className="whitespace-nowrap">
                        {row[header] === null ? (
                          <span className="text-pink-500 italic">null</span>
                        ) : (
                          String(row[header])
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
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
      const response = await fetch(`http://127.0.0.1:8000/view-data/${file}?page=1&page_size=10000`);
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

        // 5. Setup the "Discarded Rows" table
        const discardedDisplayHeaders = [...stringColumns];
        if (!discardedDisplayHeaders.includes('Transaction_ID') && cleanedHeaders.includes('Transaction_ID')) {
            discardedDisplayHeaders.unshift('Transaction_ID');
        }

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

        {loading && <p>Cargando y procesando datos...</p>}
        {error && <p className="text-destructive">Error: {error}</p>}
        
        {!loading && !error && (
          <div className="space-y-8">
            <DataTable title="Datos Crudos (Original)" data={rawData} headers={rawHeaders} />
            <DataTable title="Datos Procesados" data={processedData} headers={processedHeaders} />
            <DataTable title="Filas con Nulos de Texto (Descartadas)" data={discardedRows} headers={discardedHeaders} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewData;