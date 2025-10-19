import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";

const ViewData = () => {
  const { filename } = useParams<{ filename: string }>();
  const [data, setData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [pagination, setPagination] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://127.0.0.1:8000/view-data/${filename}?page=${page}&page_size=50`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to fetch data");
      }
      const result = await response.json();
      setData(result.data);
      setHeaders(result.headers);
      setPagination(result.pagination);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
  }, [filename]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      fetchData(newPage);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link to="/clean-data" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Limpiar Datos
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Visualizador de Datos</CardTitle>
            <p className="text-sm text-muted-foreground">Mostrando archivo: <span className="font-mono bg-muted px-2 py-1 rounded">{filename}</span></p>
          </CardHeader>
          <CardContent>
            {loading && <p>Cargando datos...</p>}
            {error && <p className="text-destructive">Error: {error}</p>}
            {!loading && !error && (
              <>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {headers.map((header) => (
                          <TableHead key={header}>{header}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {headers.map((header) => (
                            <TableCell key={`${rowIndex}-${header}`}>
                              {row[header] === null ? <span className="text-muted-foreground italic">null</span> : String(row[header])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Fila {((pagination.current_page - 1) * pagination.page_size) + 1} a {Math.min(pagination.current_page * pagination.page_size, pagination.total_rows)} de {pagination.total_rows}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={pagination.current_page === 1}>
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handlePageChange(pagination.current_page - 1)} disabled={pagination.current_page === 1}>
                       <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">Página {pagination.current_page} de {pagination.total_pages}</span>
                    <Button variant="outline" size="sm" onClick={() => handlePageChange(pagination.current_page + 1)} disabled={pagination.current_page === pagination.total_pages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handlePageChange(pagination.total_pages)} disabled={pagination.current_page === pagination.total_pages}>
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ViewData;
