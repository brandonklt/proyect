import {
  ResponsiveContainer,
  ScatterChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Scatter,
} from "recharts";

interface ScatterPlotProps {
  data: { actual: number; predicted: number }[];
}

export const CustomScatterPlot = ({ data }: ScatterPlotProps) => {
  const domainMax = Math.ceil(Math.max(...data.map(p => Math.max(p.actual, p.predicted)))) + 1;

  return (
    <div className="h-[500px] flex flex-col">
      <div className="mb-4 text-center">
        <h3 className="text-lg font-semibold">Gráfico de Dispersión: Reales vs. Predichos</h3>
        <p className="text-sm text-muted-foreground">
          Comparación de las clases reales con las clases predichas por el modelo.
        </p>
      </div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              dataKey="actual"
              name="Clase Real"
              domain={[0, domainMax]}
              allowDecimals={false}
              label={{ value: 'Clase Real', position: 'insideBottom', offset: -10 }}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <YAxis
              type="number"
              dataKey="predicted"
              name="Clase Predicha"
              domain={[0, domainMax]}
              allowDecimals={false}
              label={{ value: 'Clase Predicha', angle: -90, position: 'insideLeft' }}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
              }}
            />
            <Legend />
            <Scatter name="Predicciones" data={data} fill="hsl(var(--primary))" shape="circle" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
