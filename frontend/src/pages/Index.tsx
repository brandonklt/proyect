import { useEffect } from "react";
import { Database, FileSpreadsheet, Brain, BarChart3, Moon, Sun, ArrowRight } from "lucide-react"; // ArrowRight importada
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { api } from "@/lib/api";

const Index = () => {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    // Lógica para reiniciar la sesión (sin cambios)
    const resetSession = async () => {
      try {
        await api.post("/reset");
        console.log("Sesión reiniciada exitosamente.");
        localStorage.clear();
        sessionStorage.clear();
        console.log("Almacenamiento local y de sesión limpiado.");
      } catch (error) {
        console.error("Error al reiniciar la sesión:", error);
      }
    };
    resetSession();
  }, []);

  const modules = [
     {
      id: "load",
      title: "Cargar Datos",
      description: "Importa archivos CSV o conecta a bases de datos.",
      icon: Database,
      status: "ready", // Estado inicial
      path: "/load-data",
    },
    {
      id: "clean",
      title: "Limpiar y Analizar",
      description: "Preprocesa, visualiza estadísticas y limpia tus datasets.",
      icon: FileSpreadsheet,
      status: "available", // Disponible después de cargar
      path: "/clean-data",
    },
    {
      id: "train",
      title: "Entrenar Modelos",
      description: "Configura y entrena modelos ML con Scikit-learn.",
      icon: Brain,
      status: "available", // Disponible después de limpiar/analizar
      path: "/train-models",
    },
    {
      id: "results",
      title: "Evaluar Resultados",
      description: "Visualiza métricas, predicciones y análisis de rendimiento.",
      icon: BarChart3,
      status: "available", // Disponible después de entrenar
      path: "/results",
    },
  ];

  // Función para cambiar el tema
  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    // Contenedor principal
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 overflow-x-hidden">

      {/* Header Futurista */}
      <header className="border-b border-primary/20 dark:border-primary/10 bg-card/80 dark:bg-card/60 backdrop-blur-xl sticky top-0 z-50 shadow-md shadow-primary/10 dark:shadow-primary/5">
        <div className="container mx-auto px-6 py-5 flex justify-between items-center">
          {/* Espaciador invisible para ayudar a centrar */}
          <div className="w-10 h-10 flex-shrink-0"></div>

          {/* Título y Descripción Centrados */}
          <div className="text-center flex-grow mx-4">
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-1 drop-shadow-[0_0_10px_hsl(var(--primary)/0.3)]"> {/* Glow */}
              ML Data Pipeline
            </h1>
            <p className="text-muted-foreground text-sm md:text-base max-w-2xl mx-auto">
              Sistema IA para limpieza, entrenamiento y evaluación de modelos.
            </p>
          </div>

          {/* Botón de Cambio de Tema */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="text-muted-foreground hover:text-primary transition-colors duration-300 flex-shrink-0"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Cambiar tema</span>
          </Button>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="container mx-auto px-6 py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {modules.map((module, index) => {
            const Icon = module.icon;
            const isAvailable = module.status !== 'locked'; // Puedes añadir lógica de bloqueo si es necesario

            return (
              <Link
                key={module.id}
                to={isAvailable ? module.path : "#"}
                // Animación de entrada escalonada y efectos hover
                className={`group relative transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-6 ${isAvailable ? 'hover:scale-[1.03] hover:-translate-y-2' : 'opacity-60 cursor-not-allowed'}`}
                style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' }} // Delay escalonado
                aria-disabled={!isAvailable}
                onClick={(e) => !isAvailable && e.preventDefault()} // Previene click si no está disponible
              >
                {/* Card con efecto Glow Hover */}
                <div className="relative bg-card/80 dark:bg-card/60 backdrop-blur-md border border-border/30 rounded-xl p-6 md:p-8 shadow-lg shadow-black/10 dark:shadow-black/20 overflow-hidden transition-all duration-300 ease-in-out group-hover:border-primary/50 group-hover:shadow-2xl group-hover:shadow-primary/20 dark:group-hover:shadow-primary/10">

                  {/* Elemento de glow de fondo (se activa al hacer hover) */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-10 dark:group-hover:opacity-5 transition-opacity duration-300 ease-in-out bg-gradient-radial from-primary/50 to-transparent blur-3xl pointer-events-none"></div>

                  {/* Badge de Estado */}
                   {module.status === "ready" && (
                    <Badge variant="outline" className="absolute top-4 right-4 border-primary/50 text-primary bg-background/70 backdrop-blur-sm px-2 py-0.5 text-xs z-10">
                      Listo
                    </Badge>
                  )}
                   {module.status === "completed" && (
                     <Badge variant="default" className="absolute top-4 right-4 bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 backdrop-blur-sm px-2 py-0.5 text-xs z-10">
                       Completado
                     </Badge>
                   )}

                  {/* Icono con Glow Hover */}
                  <div className="relative w-14 h-14 rounded-lg bg-gradient-primary flex items-center justify-center mb-5 shadow-lg shadow-primary/40 transition-all duration-300 ease-out group-hover:scale-110 group-hover:shadow-[0_0_20px_hsl(var(--primary)/0.5)]">
                    <Icon className="w-7 h-7 text-primary-foreground" />
                  </div>

                  {/* Contenido (con z-index para estar sobre el glow) */}
                  <div className="relative z-[5]">
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      {module.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                      {module.description}
                    </p>

                    {/* --- CORRECCIÓN AQUÍ --- */}
                    {/* CTA con Animación de Flecha */}
                    <div className={`flex items-center font-medium text-sm transition-transform duration-300 ease-out ${isAvailable ? 'text-primary group-hover:translate-x-1.5' : 'text-muted-foreground'}`}>
                      {isAvailable ? (
                        <> {/* Fragmento para agrupar texto e icono */}
                          Abrir módulo
                          <ArrowRight className="ml-1.5 w-4 h-4 transition-transform duration-300 ease-out group-hover:translate-x-1" />
                        </>
                      ) : (
                        "Próximamente..." // Texto cuando no está disponible
                      )}
                    </div>
                    {/* --- FIN DE LA CORRECCIÓN --- */}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Footer Info */}
        <div className="mt-20 md:mt-28 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-secondary/30 dark:bg-secondary/20 border border-secondary/50 dark:border-secondary/30 rounded-full text-xs text-secondary-foreground dark:text-secondary-foreground/80">
            {/* Indicador de pulso */}
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Sistema Activo
          </div>
          <p className="mt-4 text-xs text-muted-foreground/80 tracking-wider uppercase">
            Python · Pandas · NumPy · PyTorch · Scikit-learn · FastAPI · React · Shadcn/ui · TailwindCSS
          </p>
        </div>
      </main>
    </div>
  );
};

export default Index;