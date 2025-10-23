import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Search, X } from "lucide-react";

const ViewData = () => {
  const { filename } = useParams<{ filename: string }>();
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [pagination, setPagination] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");

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
      setFilteredData(result.data);
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

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      setFilteredData(data);
      return;
    }

    const filtered = data.filter(row => 
      Object.values(row).some(value => 
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
    setFilteredData(filtered);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setFilteredData(data);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Visualizador de Datos</CardTitle>
                <p className="text-sm text-muted-foreground">Mostrando archivo: <span className="font-mono bg-muted px-2 py-1 rounded">{filename}</span></p>
              </div>
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
          </CardHeader>
          <CardContent>
            {loading && <p>Cargando datos...</p>}
            {error && <p className="text-destructive">Error: {error}</p>}
            {!loading && !error && (
              <>
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {filteredData.length !== data.length ? (
                        <>Mostrando {filteredData.length} de {data.length} filas (filtradas)</>
                      ) : (
                        <>Datos del archivo: {filename}</>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {headers.length} columnas
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-[600px]">
                    <div className="min-w-full">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background">
                          <TableRow>
                            {headers.map((header) => (
                              <TableHead key={header} className="whitespace-nowrap min-w-[120px]">{header}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredData.map((row, rowIndex) => (
                            <TableRow key={rowIndex}>
                              {headers.map((header) => (
                                <TableCell key={`${rowIndex}-${header}`} className="whitespace-nowrap min-w-[120px]">
                                  {row[header] === null ? (
                                    <span className="text-pink-500 italic font-semibold bg-pink-50 px-2 py-1 rounded text-xs">null</span>
                                  ) : (
                                    <span className="truncate block max-w-[200px]" title={String(row[header])}>
                                      {String(row[header])}
                                    </span>
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                  <div className="bg-muted/30 px-4 py-2 text-xs text-muted-foreground border-t border-border">
                    💡 Desplázate horizontalmente para ver todas las columnas
                  </div>
                </div>

                {filteredData.length !== data.length && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Mostrando {filteredData.length} de {data.length} filas (filtradas)
                  </div>
                )}

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
