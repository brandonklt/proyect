import React, { useState, useEffect, useCallback } from "react";

// --- External Libraries ---
import {
  ArrowLeft,
  Droplets,
  Eye,
  Brain,
  Search,
  X,
  DatabaseZap,
  Info,
  Loader2,
  CheckCircle,
  // Icons for pagination
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";

// --- Internal Components ---
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
// Import Table components needed for the modal
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// --- Hooks ---
import { useToast } from "@/hooks/use-toast";

// --- Constants ---
const API_BASE_URL = "http://127.0.0.1:8000";
const VIEW_PAGE_SIZE = 50; // Rows per page in the data view modal

// --- Component ---
const CleanData = () => {
  // --- State Hooks ---
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false); // For stats modal
  const [isLoadingFullData, setIsLoadingFullData] = useState(false); // For full data modal
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [cleanedFileName, setCleanedFileName] = useState<string | null>(null);
  const [dataStats, setDataStats] = useState({
    rows: 0,
    columns: 0,
    nullValues: 0,
    duplicates: 0,
  });
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]); // Filtered preview data
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Full Data Modal State
  const [fullData, setFullData] = useState<any[]>([]);
  const [fullDataHeaders, setFullDataHeaders] = useState<string[]>([]);
  const [fullDataPagination, setFullDataPagination] = useState<any>({
    current_page: 1,
    total_pages: 1,
    total_rows: 0,
    page_size: VIEW_PAGE_SIZE,
  });
   const [fullDataError, setFullDataError] = useState<string | null>(null);
   const [isFullDataModalOpen, setIsFullDataModalOpen] = useState(false); // Control modal visibility

  // Stats Modal State
  const [detailedStats, setDetailedStats] = useState<any>(null);
  const [deletedData, setDeletedData] = useState<any>(null);
  const [nullData, setNullData] = useState<any>(null);

  // --- Context Hooks ---
  const { toast } = useToast();

  // --- API Helper Functions ---
  const fetchData = useCallback(async (endpoint: string, options?: RequestInit, errorMessage?: string) => {
    // ... (fetchData remains the same) ...
     try {
      const response = await fetch(`${API_BASE_URL}/${endpoint}`, options);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || errorMessage || `Failed to fetch ${endpoint}`);
      }
      return result;
    } catch (error: any) {
      console.error(`Error fetching ${endpoint}:`, error);
      toast({
        title: `Error en API (${endpoint.split('/')[0]})`,
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  }, [toast]);

  const fetchPaginatedData = useCallback(async (fileName: string, page = 1) => {
    // ... (fetchPaginatedData remains the same) ...
     if (!fileName) {
          setFullDataError("Nombre de archivo no disponible.");
          return;
      }
      setIsLoadingFullData(true);
      setFullDataError(null);
      try {
          const result = await fetchData(
              `view-data/${fileName}?page=${page}&page_size=${VIEW_PAGE_SIZE}`,
              {},
              "Failed to fetch paginated data"
          );
          setFullData(result.data || []); // Ensure data is an array
          setFullDataHeaders(result.headers || []); // Ensure headers is an array
          setFullDataPagination(result.pagination || { current_page: 1, total_pages: 1, total_rows: 0, page_size: VIEW_PAGE_SIZE });
      } catch (e: any) {
          setFullDataError(e.message || "Error desconocido al cargar datos paginados.");
          setFullData([]); // Clear data on error
          setFullDataHeaders([]);
      } finally {
          setIsLoadingFullData(false);
      }
  }, [fetchData]);

  const fetchAllDetails = useCallback(async (fileName: string) => {
    // ... (fetchAllDetails remains the same) ...
     if (!fileName) return;
    setIsLoadingDetails(true);
    setDetailedStats(null);
    setDeletedData(null);
    setNullData(null);
    try {
        const [stats, deleted, nulls] = await Promise.all([
            fetchData(`get-dataset-stats/${fileName}`, {}, "Failed to fetch detailed stats"),
            fetchData(`get-deleted-data/${fileName}`, {}, "Failed to fetch deleted data info"),
            fetchData(`get-null-data/${fileName}`, {}, "Failed to fetch null data info")
        ]);
        setDetailedStats(stats);
        setDeletedData(deleted);
        setNullData(nulls);
    } catch (error) {
      console.error("Error fetching one or more dataset details:", error);
    } finally {
        setIsLoadingDetails(false);
    }
  }, [fetchData]);

  const fetchCsvInfo = useCallback(async (fileName: string) => {
    // ... (fetchCsvInfo remains the same) ...
    setIsLoadingInitialData(true);
    try {
      const result = await fetchData(`get-csv-info/${fileName}`, {}, "Failed to fetch CSV info");
      setDataStats(result.stats);
      const preview = Array.isArray(result.preview_data) ? result.preview_data : [];
      setPreviewData(preview);
      setFilteredData(preview);
      const effectiveFileName = result.actual_filename || fileName;
      setCurrentFileName(effectiveFileName);

      if (effectiveFileName.startsWith("cleaned_")) {
          setCleanedFileName(effectiveFileName);
          localStorage.setItem("cleanedFileName", effectiveFileName);
      } else {
          setCleanedFileName(null);
          localStorage.removeItem("cleanedFileName");
          localStorage.setItem("uploadedFileName", effectiveFileName);
      }

      fetchAllDetails(effectiveFileName);
    } catch (error) {
      setDataStats({ rows: 0, columns: 0, nullValues: 0, duplicates: 0 });
      setPreviewData([]);
      setFilteredData([]);
      setCurrentFileName(null);
      setCleanedFileName(null);
    } finally {
      setIsLoadingInitialData(false);
    }
  }, [fetchData, fetchAllDetails, toast]);

  // --- Effect Hooks ---
  useEffect(() => {
    // ... (Initial data load effect remains the same) ...
     const initialCleanedFile = localStorage.getItem("cleanedFileName");
    const initialUploadedFile = localStorage.getItem("uploadedFileName");
    const fileNameToLoad = initialCleanedFile || initialUploadedFile;

    if (fileNameToLoad) {
      fetchCsvInfo(fileNameToLoad);
    } else {
      console.warn("No file name found in localStorage to load initial data.");
      toast({ title: "Advertencia", description: "No se encontró archivo para cargar información.", variant: "destructive" });
      setIsLoadingInitialData(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect to load data when the full data modal opens (modified)
  useEffect(() => {
      // Load only if modal is open AND data hasn't been loaded yet for the current file or page 1
      if (isFullDataModalOpen && currentFileName && (fullData.length === 0 || fullDataPagination.current_page !== 1)) {
          fetchPaginatedData(currentFileName, 1);
      }
      // Reset page to 1 if modal is closed and reopened with potentially different file
      if (!isFullDataModalOpen) {
          setFullDataPagination((prev: any) => ({ ...prev, current_page: 1 }));
          setFullData([]); // Clear data when modal closes
      }
  }, [isFullDataModalOpen, currentFileName, fetchPaginatedData]); // Removed fullData.length and pagination dependencies


  // --- Callback Hooks (Event Handlers) ---
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleSearch = useCallback(() => {
    // ... (handleSearch remains the same) ...
     if (!searchTerm.trim()) {
      setFilteredData(previewData);
      return;
    }
    if (!previewData || previewData.length === 0) {
      setFilteredData([]);
      return;
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = previewData.filter((row) =>
        row && typeof row === 'object' &&
        Object.values(row).some((value) =>
            value !== null && value !== undefined &&
            String(value).toLowerCase().includes(lowerSearchTerm)
        )
    );
    setFilteredData(filtered);
  }, [searchTerm, previewData]);

  const handleClearSearch = useCallback(() => {
    // ... (handleClearSearch remains the same) ...
     setSearchTerm("");
    setFilteredData(previewData || []);
  }, [previewData]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    // ... (handleKeyPress remains the same) ...
     if (e.key === "Enter") {
      handleSearch();
    }
  }, [handleSearch]);

   // Handler for full data modal pagination
  const handleFullDataPageChange = useCallback((newPage: number) => {
      if (currentFileName && newPage >= 1 && newPage <= fullDataPagination.total_pages) {
          fetchPaginatedData(currentFileName, newPage);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFileName, fullDataPagination.total_pages, fetchPaginatedData]); // fetchPaginatedData is stable


  // --- Render Helper Functions ---
  const renderPreviewTable = () => {
    // ... (renderPreviewTable remains the same) ...
      if (isLoadingInitialData) {
      return (
          <div className="space-y-2 mt-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-[80%]" />
          </div>
      );
    }
    if (!previewData || previewData.length === 0 || !previewData[0]) {
      return <p className="text-center text-muted-foreground mt-4">No hay datos de vista previa para mostrar.</p>;
    }
    const headers = Object.keys(previewData[0]);
    return (
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {filteredData.length !== previewData.length
              ? `Mostrando ${filteredData.length} de ${previewData.length} filas (vista previa)`
              : `Vista previa (${previewData.length} filas)`}
          </div>
          <div className="text-xs text-muted-foreground">{headers.length} columnas</div>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm min-w-max">
            <thead className="bg-muted/30 sticky top-0 z-10">
              <tr>
                {headers.map((key) => (
                  <th key={key} className="px-4 py-2 text-left font-medium text-muted-foreground border-b border-r border-border whitespace-nowrap min-w-[120px] last:border-r-0">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, idx) => (
                <tr key={idx} className="border-b border-border hover:bg-muted/20 last:border-b-0">
                  {headers.map((key, cellIdx) => (
                    <td key={cellIdx} className="px-4 py-2 border-r border-border whitespace-nowrap min-w-[120px] last:border-r-0">
                      {row[key] === null || row[key] === '' ? (
                        <span className="text-pink-500 italic font-semibold bg-pink-50 dark:bg-pink-900/20 dark:text-pink-400 px-2 py-0.5 rounded text-xs">
                          null
                        </span>
                      ) : (
                        <span className="truncate block max-w-[200px]" title={String(row[key])}>
                          {String(row[key])}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-muted/30 px-4 py-2 text-xs text-muted-foreground border-t border-border">
          💡 Desplázate horizontalmente para ver todas las columnas. La tabla muestra hasta {previewData.length} filas.
        </div>
      </div>
    );
  };

  const renderStatsCard = () => (
    // ... (renderStatsCard remains the same, including its Dialog structure) ...
      <Dialog>
      <DialogTrigger asChild>
        <Card className="p-6 shadow-card cursor-pointer hover:shadow-lg transition-shadow hover:border-primary/50">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="flex items-center justify-between text-lg">
              <span>Estadísticas</span>
              <Info className="w-4 h-4 text-muted-foreground" />
            </CardTitle>
            <CardDescription>Resumen del dataset. Haz clic para ver detalles.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingInitialData ? (
                <div className="space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-5 w-1/2" />
                </div>
            ) : (
              <>
                {cleanedFileName && (
                  <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50 rounded-lg">
                    <p className="text-xs text-blue-800 dark:text-blue-300">
                      <strong>Nota:</strong> Nulos visibles aquí pero ignorados en entrenamiento.
                    </p>
                  </div>
                )}
                <div className="space-y-2 text-sm">
                  {/* Basic Stats */}
                  <div className="flex justify-between"><span className="text-muted-foreground">Filas:</span> <span className="font-semibold">{dataStats.rows.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Columnas:</span> <span className="font-semibold">{dataStats.columns}</span></div>
                  <div className="flex justify-between">
                      <span className="text-muted-foreground">Valores Nulos:</span>
                      <span className={`font-semibold ${dataStats.nullValues > 0 ? "text-orange-500 dark:text-orange-400" : "text-green-600 dark:text-green-400"}`}>
                          {dataStats.nullValues.toLocaleString()}
                      </span>
                  </div>
                  <div className="flex justify-between">
                      <span className="text-muted-foreground">Filas Duplicadas:</span>
                      <span className={`font-semibold ${dataStats.duplicates > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                          {dataStats.duplicates.toLocaleString()}
                      </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </DialogTrigger>
      {/* Stats Modal Content */}
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
         <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <DatabaseZap className="w-5 h-5 text-primary"/>
            Análisis Detallado del Dataset
          </DialogTitle>
          <DialogDescription>
            Información extendida ({currentFileName || "N/A"}).
          </DialogDescription>
        </DialogHeader>
        {/* Scrollable content area */}
        <div className="grid gap-6 py-4 overflow-y-auto flex-grow pr-3 mr-[-6px]">
          {isLoadingDetails ? (
              <div className="space-y-4">
                  <Skeleton className="h-8 w-1/3" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-8 w-1/4" />
                  <Skeleton className="h-24 w-full" />
              </div>
          ) : (
            <>
              {/* Detailed Stats Section */}
              {detailedStats ? (
                <div>
                  <h4 className="font-semibold mb-2 text-base">Resumen General</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm border p-4 rounded-lg bg-muted/30">
                    <p><strong className="text-muted-foreground block text-xs">Archivo:</strong> {detailedStats.dataset_info.filename}</p>
                    <p><strong className="text-muted-foreground block text-xs">Filas:</strong> {detailedStats.dataset_info.total_rows.toLocaleString()}</p>
                    <p><strong className="text-muted-foreground block text-xs">Columnas:</strong> {detailedStats.dataset_info.total_columns}</p>
                    <p><strong className="text-muted-foreground block text-xs">Tamaño:</strong> {(detailedStats.dataset_info.file_size_bytes / 1024).toFixed(1)} KB</p>
                    <p><strong className="text-muted-foreground block text-xs">Completitud:</strong> {detailedStats.quality_metrics.completeness_score}%</p>
                    <p><strong className="text-muted-foreground block text-xs">Unicidad:</strong> {detailedStats.quality_metrics.uniqueness_score}%</p>
                  </div>

                  <h4 className="font-semibold mt-4 mb-2 text-base">Análisis de Nulos por Columna</h4>
                  <div className="border rounded-lg max-h-48 overflow-y-auto text-xs">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-muted/50 z-10"><tr className="border-b"><th className="p-2 text-left font-medium">Columna</th><th className="p-2 text-right font-medium">Nulos</th><th className="p-2 text-right font-medium">% Nulos</th></tr></thead>
                      <tbody>
                        {Object.entries(detailedStats.null_analysis).map(([col, stats]: [string, any]) => (
                          <tr key={col} className="border-t hover:bg-muted/20">
                            <td className="p-2 font-medium">{col}</td>
                            <td className={`p-2 text-right ${stats.count > 0 ? 'text-orange-600 dark:text-orange-400 font-semibold' : ''}`}>{stats.count}</td>
                            <td className={`p-2 text-right ${stats.percentage > 10 ? 'text-orange-600 dark:text-orange-400' : ''}`}>{stats.percentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-4">No se pudieron cargar las estadísticas detalladas.</p>}

              {/* Deleted Data Section */}
              {deletedData ? (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2 text-base">Análisis de Filas Eliminadas</h4>
                  {deletedData.deleted_rows_count > 0 ? (
                    <>
                      <p className="text-sm mb-2">Se eliminaron <strong className="text-red-600 dark:text-red-400">{deletedData.deleted_rows_count.toLocaleString()}</strong> filas durante la limpieza.</p>
                      <p className="text-xs text-muted-foreground mb-2">Mostrando hasta 5 ejemplos:</p>
                      <div className="border rounded-lg max-h-40 overflow-y-auto text-xs bg-muted/20 p-2">
                        <pre className="whitespace-pre-wrap break-words">{JSON.stringify(deletedData.deleted_rows_sample, null, 2)}</pre>
                      </div>
                    </>
                  ) : <p className="text-sm text-muted-foreground">No se eliminaron filas o no se pudo comparar con el archivo original.</p>}
                </div>
              ) : <p className="text-sm text-muted-foreground mt-4 text-center">Cargando información de filas eliminadas...</p>}

              {/* Null Data Section */}
              {nullData ? (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2 text-base">Ejemplos de Filas con Nulos</h4>
                  {nullData.total_nulls > 0 && nullData.rows_with_nulls_sample?.length > 0 ? (
                    <>
                      <p className="text-sm mb-2">Total de celdas nulas: <strong className="text-orange-600 dark:text-orange-400">{nullData.total_nulls.toLocaleString()}</strong>. Mostrando hasta {nullData.rows_with_nulls_sample.length} filas con nulos:</p>
                      <div className="border rounded-lg max-h-40 overflow-y-auto text-xs bg-muted/20 p-2">
                        <pre className="whitespace-pre-wrap break-words">{JSON.stringify(nullData.rows_with_nulls_sample, null, 2)}</pre>
                      </div>
                    </>
                  ) : <p className="text-sm text-muted-foreground">No se encontraron filas con valores nulos en la muestra.</p>}
                </div>
              ) : <p className="text-sm text-muted-foreground mt-4 text-center">Cargando ejemplos de filas con nulos...</p>}
            </>
          )}
        </div>
        <DialogFooter className="mt-4 border-t pt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // --- Render Full Data Modal ---
  const renderFullDataModalContent = () => (
      <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col">
          <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                  <Eye className="w-5 h-5 text-primary"/>
                  Visualizador de Datos Completos
              </DialogTitle>
              <DialogDescription>
                  Mostrando datos paginados de: {currentFileName || "N/A"}.
                  Página {fullDataPagination.current_page} de {fullDataPagination.total_pages}.
              </DialogDescription>
          </DialogHeader>
          {/* Contenedor principal del modal con scroll si es necesario */}
          <div className="flex-grow overflow-y-auto pr-3 mr-[-6px]">
              {isLoadingFullData ? (
                  <div className="space-y-2 mt-4">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-[80%]" />
                      <Skeleton className="h-8 w-full" />
                  </div>
              ) : fullDataError ? (
                  <p className="text-destructive text-center py-10">{fullDataError}</p>
              ) : fullData.length === 0 ? (
                 <p className="text-muted-foreground text-center py-10">No hay datos para mostrar en esta página.</p>
              ) : (
                  <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                          <Table className="min-w-full">
                              <TableHeader className="sticky top-0 bg-background z-10">
                                  <TableRow>
                                      {fullDataHeaders.map((header) => (
                                          <TableHead key={header} className="whitespace-nowrap min-w-[120px]">
                                              {header}
                                          </TableHead>
                                      ))}
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {fullData.map((row, rowIndex) => (
                                      <TableRow key={rowIndex}>
                                          {fullDataHeaders.map((header) => (
                                              <TableCell key={`${rowIndex}-${header}`} className="whitespace-nowrap min-w-[120px]">
                                                  {row[header] === null || row[header] === '' ? (
                                                      <span className="text-pink-500 italic font-semibold bg-pink-50 dark:bg-pink-900/20 dark:text-pink-400 px-2 py-0.5 rounded text-xs">null</span>
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
              )}
          </div>
          {/* Footer with pagination */}
          <DialogFooter className="mt-4 pt-4 border-t flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Fila {((fullDataPagination.current_page - 1) * fullDataPagination.page_size) + (fullData.length > 0 ? 1 : 0)} a {Math.min(fullDataPagination.current_page * fullDataPagination.page_size, fullDataPagination.total_rows)} de {fullDataPagination.total_rows}
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={() => handleFullDataPageChange(1)} disabled={isLoadingFullData || fullDataPagination.current_page === 1}>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleFullDataPageChange(fullDataPagination.current_page - 1)} disabled={isLoadingFullData || fullDataPagination.current_page === 1}>
                   <ChevronLeft className="h-4 h-4" />
                </Button>
                <span className="text-sm px-2 tabular-nums"> {/* Added tabular-nums */}
                    {fullDataPagination.current_page} / {fullDataPagination.total_pages}
                </span>
                <Button variant="outline" size="sm" onClick={() => handleFullDataPageChange(fullDataPagination.current_page + 1)} disabled={isLoadingFullData || fullDataPagination.current_page === fullDataPagination.total_pages}>
                  <ChevronRight className="w-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleFullDataPageChange(fullDataPagination.total_pages)} disabled={isLoadingFullData || fullDataPagination.current_page === fullDataPagination.total_pages}>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
              <DialogClose asChild>
                  <Button type="button" variant="outline">Cerrar</Button>
              </DialogClose>
          </DialogFooter>
      </DialogContent>
  );


  // --- JSX Structure ---
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-20">
         <div className="container mx-auto px-6 py-4">
          <a href="/" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Volver al dashboard
          </a>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-md">
              <Droplets className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Vista Previa y Estadísticas</h1>
              <p className="text-muted-foreground">Analiza el dataset antes de entrenar.</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Preview Section */}
        <section className="max-w-7xl mx-auto mb-8">
           <Card className="p-6 shadow-card overflow-hidden">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-4">
              <div>
                <h3 className="text-xl font-semibold">Vista Previa del Dataset</h3>
                <p className="text-sm text-muted-foreground">
                    Tabla interactiva con {isLoadingInitialData ? '...' : (dataStats.rows?.toLocaleString() ?? 0)} filas.
                    {cleanedFileName ? 'Mostrando datos limpios.' : 'Mostrando datos originales.'}
                </p>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                 <div className="flex items-center gap-2 flex-grow sm:flex-grow-0">
                     <Input
                      placeholder="Buscar en vista previa..."
                      value={searchTerm}
                      onChange={handleSearchChange}
                      onKeyPress={handleKeyPress}
                      className="w-full sm:w-64"
                      aria-label="Buscar en tabla"
                      disabled={isLoadingInitialData}
                    />
                     <Button onClick={handleSearch} size="icon" variant="outline" aria-label="Buscar" disabled={isLoadingInitialData}>
                      <Search className="w-4 h-4" />
                    </Button>
                     <Button onClick={handleClearSearch} size="icon" variant="outline" aria-label="Limpiar búsqueda" disabled={isLoadingInitialData || !searchTerm}>
                      <X className="w-4 h-4" />
                    </Button>
                 </div>
                 <Dialog open={isFullDataModalOpen} onOpenChange={setIsFullDataModalOpen}>
                    <DialogTrigger asChild>
                         <Button
                            variant="outline"
                            className="gap-2 w-full sm:w-auto"
                            disabled={!currentFileName || isLoadingInitialData}
                        >
                            <Eye className="w-4 h-4" /> Visualizar Datos Completos
                        </Button>
                    </DialogTrigger>
                    {renderFullDataModalContent()}
                 </Dialog>
              </div>
            </div>
            {renderPreviewTable()}
          </Card>
        </section>

        {/* Stats Section */}
        <section className="max-w-3xl mx-auto">
          {renderStatsCard()}
           {/* Botón para ir a entrenar */}
            {!isLoadingInitialData && currentFileName && (
                 <div className="mt-8">
                     <a href="/train-models">
                         <Button className="w-full gap-2">
                             <Brain className="w-4 h-4" /> Proceder a Entrenar Modelo
                         </Button>
                     </a>
                 </div>
             )}
        </section>
      </main>

    </div>
  );
};

export default CleanData;

