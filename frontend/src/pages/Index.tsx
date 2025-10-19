import { Database, FileSpreadsheet, Brain, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

const Index = () => {
  const modules = [
    {
      id: "load",
      title: "Cargar Datos",
      description: "Importa archivos CSV o conecta a bases de datos externas",
      icon: Database,
      status: "completed",
      path: "/load-data",
    },
    {
      id: "clean",
      title: "Limpiar Datos",
      description: "Preprocesa y limpia tus datasets con herramientas avanzadas",
      icon: FileSpreadsheet,
      status: "available",
      path: "/clean-data",
    },
    {
      id: "train",
      title: "Entrenar Modelos",
      description: "Configura y entrena modelos con sklearn, PyTorch y más",
      icon: Brain,
      status: "available",
      path: "/train-models",
    },
    {
      id: "results",
      title: "Resultados",
      description: "Visualiza métricas, predicciones y análisis de rendimiento",
      icon: BarChart3,
      status: "available",
      path: "/results",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-6">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
            Analisis de Datos con ML - DL
          </h1>
          <p className="text-muted-foreground text-lg">
            Sistema que limpia, entrena, modela y carga datos usando las librerías de Python de pandas, Numpy, Pytorch y Scikit-learn
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.id}
                to={module.path}
                className="group relative"
              >
                <div className="bg-gradient-card rounded-2xl p-8 border border-border shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1">
                  {/* Status Badge */}
                  {module.status === "completed" && (
                    <Badge className="absolute top-6 right-6 bg-success text-success-foreground">
                      Completado
                    </Badge>
                  )}

                  {/* Icon */}
                  <div className="w-16 h-16 rounded-xl bg-gradient-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-8 h-8 text-primary-foreground" />
                  </div>

                  {/* Content */}
                  <h3 className="text-2xl font-bold text-foreground mb-3">
                    {module.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-6">
                    {module.description}
                  </p>

                  {/* CTA Button */}
                  <div className="flex items-center text-primary font-semibold group-hover:translate-x-2 transition-transform duration-300">
                    Abrir módulo
                    <svg
                      className="ml-2 w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Footer Info */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/50 rounded-full text-sm text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Sistema Activo
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Python • Pandas • NumPy • PyTorch • Scikit-learn
          </p>
        </div>
      </main>
    </div>
  );
};

export default Index;
