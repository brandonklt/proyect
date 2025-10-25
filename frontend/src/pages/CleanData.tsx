import React, { useState, useEffect, useCallback } from "react";

// --- External Libraries ---
import {
  ArrowLeft,
  Droplets,
  // Eye, // <--- Eliminado
  Brain,
  Search,
  X,
  DatabaseZap,
  Info,
  Loader2,
  CheckCircle,
  // Icons for pagination (Re-agregados)
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
// Import Table components (todavía se usan en otros modales/tablas)
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
const VIEW_PAGE_SIZE = 10240; // <--- Cambiado de 50 a 10240

// --- Component ---
const CleanData = () => {
  // --- State Hooks ---
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true); // Para stats
  const [isLoadingDetails, setIsLoadingDetails] = useState(false); // For stats modal
  const [isLoadingTableData, setIsLoadingTableData] = useState(true); // Para la tabla principal
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [cleanedFileName, setCleanedFileName] = useState<string | null>(null);
  const [dataStats, setDataStats] = useState({
    rows: 0,
    columns: 0,
    nullValues: 0,
    duplicates: 0,
  });

  // Estado para la tabla principal (ahora paginada)
  const [tableData, setTableData] = useState<any[]>([]);
  const [filteredTableData, setFilteredTableData] = useState<any[]>([]);
  const [tableHeaders, setTableHeaders] = useState<string[]>([]);
  const [tablePagination, setTablePagination] = useState<any>({
    current_page: 1,
    total_pages: 1,
    total_rows: 0,
    page_size: VIEW_PAGE_SIZE,
  });
  const [tableError, setTableError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");

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

  // Renombrado: Carga datos para la tabla principal
  const fetchTableData = useCallback(async (fileName: string, page = 1) => {
     if (!fileName) {
         setTableError("Nombre de archivo no disponible.");
         return;
       }
       setIsLoadingTableData(true);
       setTableError(null);
       setSearchTerm(""); // Limpiar búsqueda al cambiar de página
       try {
         const result = await fetchData(
             `view-data/${fileName}?page=${page}&page_size=${VIEW_PAGE_SIZE}`,
             {},
             "Failed to fetch paginated data"
         );
         const data = result.data || [];
         setTableData(data);
         setFilteredTableData(data); // Sincronizar datos filtrados
         setTableHeaders(result.headers || []);
         setTablePagination(result.pagination || { current_page: 1, total_pages: 1, total_rows: 0, page_size: VIEW_PAGE_SIZE });
       } catch (e: any) {
         setTableError(e.message || "Error desconocido al cargar datos paginados.");
         setTableData([]);
         setFilteredTableData([]);
         setTableHeaders([]);
       } finally {
         setIsLoadingTableData(false);
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

  // Modificado: Ahora solo carga stats e info del archivo, no la vista previa
  const fetchCsvInfo = useCallback(async (fileName: string) => {
    setIsLoadingInitialData(true);
    try {
      const result = await fetchData(`get-csv-info/${fileName}`, {}, "Failed to fetch CSV info");
      setDataStats(result.stats);
      // const preview = Array.isArray(result.preview_data) ? result.preview_data : []; // <-- Eliminado
      // setPreviewData(preview); // <-- Eliminado
      // setFilteredData(preview); // <-- Eliminado
      const effectiveFileName = result.actual_filename || fileName;
      setCurrentFileName(effectiveFileName); // <-- Esto disparará el useEffect para cargar la tabla

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
      // setPreviewData([]); // <-- Eliminado
      // setFilteredData([]); // <-- Eliminado
      setCurrentFileName(null);
      setCleanedFileName(null);
    } finally {
      setIsLoadingInitialData(false); // Termina la carga de stats
    }
  }, [fetchData, fetchAllDetails, toast]);

  // --- Effect Hooks ---
  useEffect(() => {
    // Carga stats e info del archivo al montar
     const initialCleanedFile = localStorage.getItem("cleanedFileName");
    const initialUploadedFile = localStorage.getItem("uploadedFileName");
    const fileNameToLoad = initialCleanedFile || initialUploadedFile;

    if (fileNameToLoad) {
      fetchCsvInfo(fileNameToLoad);
    } else {
      console.warn("No file name found in localStorage to load initial data.");
      toast({ title: "Advertencia", description: "No se encontró archivo para cargar información.", variant: "destructive" });
      setIsLoadingInitialData(false);
      setIsLoadingTableData(false); // Detener carga de tabla también
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo se ejecuta una vez

  // Nuevo Effect: Carga los datos de la tabla cuando currentFileName está listo
  useEffect(() => {
    if (currentFileName) {
      fetchTableData(currentFileName, 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFileName]); // Depende solo de currentFileName (fetchTableData es estable)


  // --- Callback Hooks (Event Handlers) ---
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Modificado: Busca en tableData, no en previewData
  const handleSearch = useCallback(() => {
     if (!searchTerm.trim()) {
       setFilteredTableData(tableData);
       return;
     }
     if (!tableData || tableData.length === 0) {
       setFilteredTableData([]);
       return;
     }
     const lowerSearchTerm = searchTerm.toLowerCase();
     const filtered = tableData.filter((row) =>
         row && typeof row === 'object' &&
         Object.values(row).some((value) =>
             value !== null && value !== undefined &&
             String(value).toLowerCase().includes(lowerSearchTerm)
         )
     );
     setFilteredTableData(filtered);
  }, [searchTerm, tableData]);

  // Modificado: Limpia sobre tableData
  const handleClearSearch = useCallback(() => {
     setSearchTerm("");
    setFilteredTableData(tableData || []);
  }, [tableData]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
     if (e.key === "Enter") {
       handleSearch();
     }
  }, [handleSearch]);

  // Renombrado: Handler para la paginación de la tabla principal
  const handleTablePageChange = useCallback((newPage: number) => {
       if (currentFileName && newPage >= 1 && newPage <= tablePagination.total_pages) {
           fetchTableData(currentFileName, newPage);
       }
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [currentFileName, tablePagination.total_pages, fetchTableData]); // fetchTableData is stable


  // --- Render Helper Functions ---
  // Renombrado: renderMainDataTable
  const renderMainDataTable = () => {
     if (isLoadingTableData) { // Carga basada en la tabla
       return (
           <div className="space-y-2 mt-4">
               <Skeleton className="h-8 w-full" />
               <Skeleton className="h-8 w-full" />
               <Skeleton className="h-8 w-[80%]" />
           </div>
       );
     }
     if (tableError) {
        return <p className="text-center text-destructive mt-4">{tableError}</p>;
     }
     if (!tableData || tableData.length === 0 || !tableHeaders[0]) {
       return <p className="text-center text-muted-foreground mt-4">No hay datos para mostrar.</p>;
     }
     
     // Usa tableHeaders, no keys del primer objeto
     const headers = tableHeaders; 
     
     return (
       <div className="border border-border rounded-lg overflow-hidden">
         <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center justify-between">
           <div className="text-sm text-muted-foreground">
             {filteredTableData.length !== tableData.length
               ? `Mostrando ${filteredTableData.length} de ${tableData.length} filas (filtradas en esta página)`
               : `Mostrando ${tableData.length} filas (Página ${tablePagination.current_page})`}
           </div>
           <div className="text-xs text-muted-foreground">{headers.length} columnas</div>
         </div>
         <div className="overflow-x-auto max-h-96"> {/* Mantenemos altura máxima para la vista previa de la página */}
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
               {filteredTableData.map((row, idx) => (
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
           💡 Desplázate horizontalmente para ver todas las columnas. Mostrando {tableData.length} filas en esta página.
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
           {isLoadingInitialData ? ( // Esto se basa en la carga de stats
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

  // --- Render Full Data Modal (Eliminado) ---
  // const renderFullDataModalContent = () => ( ... );


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

      {/* Main Content: Nuevo layout de Dashboard */}
      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Columna Principal: Vista Previa */}
          <section className="lg:col-span-2">
             <Card className="p-6 shadow-card overflow-hidden">
               <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-4">
                 <div>
                   <h3 className="text-xl font-semibold">Visor de Datos del Dataset</h3>
                   <p className="text-sm text-muted-foreground">
                      {/* Modificado: Muestra el total de filas de las stats */}
                      Datos paginados ({isLoadingInitialData ? '...' : (dataStats.rows?.toLocaleString() ?? 0)} filas totales).
                      {cleanedFileName ? ' Mostrando datos limpios.' : ' Mostrando datos originales.'}
                   </p>
                 </div>
                 <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                     <div className="flex items-center gap-2 flex-grow sm:flex-grow-0">
                         <Input
                           placeholder="Buscar en página actual..."
                           value={searchTerm}
                           onChange={handleSearchChange}
                           onKeyPress={handleKeyPress}
                           className="w-full sm:w-64"
                           aria-label="Buscar en tabla"
                           disabled={isLoadingTableData} // Desactivado mientras carga la tabla
                         />
                         <Button onClick={handleSearch} size="icon" variant="outline" aria-label="Buscar" disabled={isLoadingTableData}>
                           <Search className="w-4 h-4" />
                         </Button>
                         <Button onClick={handleClearSearch} size="icon" variant="outline" aria-label="Limpiar búsqueda" disabled={isLoadingTableData || !searchTerm}>
                           <X className="w-4 h-4" />
                         </Button>
                     </div>
                     {/* --- BOTÓN Y MODAL ELIMINADOS --- */}
                 </div>
               </div>
               {renderMainDataTable()}

               {/* --- CONTROLES DE PAGINACIÓN AÑADIDOS --- */}
               {!isLoadingTableData && tableData.length > 0 && tablePagination.total_pages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between mt-4 pt-4 border-t gap-4">
                    <div className="text-sm text-muted-foreground">
                      Fila {((tablePagination.current_page - 1) * tablePagination.page_size) + (tableData.length > 0 ? 1 : 0)} a {Math.min(tablePagination.current_page * tablePagination.page_size, tablePagination.total_rows)} de {tablePagination.total_rows}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleTablePageChange(1)} disabled={isLoadingTableData || tablePagination.current_page === 1}>
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleTablePageChange(tablePagination.current_page - 1)} disabled={isLoadingTableData || tablePagination.current_page === 1}>
                         <ChevronLeft className="h-4 h-4" />
                      </Button>
                      <span className="text-sm px-2 tabular-nums">
                        {tablePagination.current_page} / {tablePagination.total_pages}
                      </span>
                      <Button variant="outline" size="sm" onClick={() => handleTablePageChange(tablePagination.current_page + 1)} disabled={isLoadingTableData || tablePagination.current_page === tablePagination.total_pages}>
                        <ChevronRight className="w-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleTablePageChange(tablePagination.total_pages)} disabled={isLoadingTableData || tablePagination.current_page === tablePagination.total_pages}>
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
             </Card>
          </section>

          {/* Columna Lateral: Estadísticas y Acciones */}
          <aside className="lg:col-span-1 space-y-8 sticky top-28 h-fit">
            {renderStatsCard()}
             {/* Botón para ir a entrenar */}
              {/* Se muestra si las stats iniciales cargaron y hay un archivo */}
              {!isLoadingInitialData && currentFileName && (
                  <div>
                      <a href="/train-models">
                          <Button className="w-full gap-2 text-lg py-6">
                              <Brain className="w-5 h-5" /> Proceder a Entrenar
                          </Button>
                      </a>
                  </div>
              )}
          </aside>

        </div>
      </main>

    </div>
  );
};

export default CleanData;


