import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes"; // <-- 1. Importar ThemeProvider

import Index from "./pages/Index";
import LoadData from "./pages/LoadData";
import CleanData from "./pages/CleanData";
import TrainModels from "./pages/TrainModels";
import Results from "./pages/Results";
import ViewData from "./pages/ViewData";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      {/* --- 2. Envolver la aplicación con ThemeProvider --- */}
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <Toaster />
        <Sonner /> {/* Mantenemos Sonner aquí si lo necesitas */}
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/load-data" element={<LoadData />} />
            <Route path="/clean-data" element={<CleanData />} />
            <Route path="/train-models" element={<TrainModels />} />
            <Route path="/results" element={<Results />} />
            <Route path="/view-data/:filename" element={<ViewData />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
      {/* --------------------------------------------------- */}
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;