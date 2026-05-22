import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ChartSpec } from "../api";

const GREYS = ["#ffffff", "#e5e5e5", "#d4d4d4", "#a3a3a3", "#737373", "#525252"];

interface ChartViewProps {
  chart: ChartSpec;
  rows: Record<string, unknown>[];
}

function buildChartData(chart: ChartSpec, rows: Record<string, unknown>[]) {
  const xKey = chart.x_column!;
  const yKey = chart.y_column ?? xKey;
  return rows.map((r) => ({
    name: String(r[xKey] ?? ""),
    value: Number(r[yKey] ?? 0),
  }));
}

export default function ChartView({ chart, rows }: ChartViewProps) {
  if (!chart.x_column || !rows.length) return null;

  const data = buildChartData(chart, rows);
  const tooltipStyle = {
    background: "#0a0a0a",
    border: "1px solid #404040",
    borderRadius: 0,
    fontFamily: "JetBrains Mono, monospace",
    fontSize: 12,
    color: "#fafafa",
  };

  const pieData = Object.entries(
    rows.reduce<Record<string, number>>((acc, r) => {
      const k = String(r[chart.x_column!] ?? "?");
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  return (
    <div className="result-block border border-ink-800 bg-black p-8">
      <p className="mono-label">Visualization</p>
      <h3 className="mt-2 text-xl font-bold text-white">{chart.title}</h3>
      <div className="mt-8 h-80 w-full min-h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === "line" && chart.y_column ? (
            <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" stroke="#525252" tick={{ fill: "#a3a3a3", fontSize: 11 }} axisLine={{ stroke: "#404040" }} />
              <YAxis stroke="#525252" tick={{ fill: "#a3a3a3", fontSize: 11 }} axisLine={{ stroke: "#404040" }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "#525252" }} />
              <Line type="monotone" dataKey="value" stroke="#ffffff" strokeWidth={2.5} dot={{ fill: "#fff", r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </LineChart>
          ) : chart.type === "pie" ? (
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={110}
                innerRadius={50}
                stroke="#000"
                strokeWidth={2}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: "#525252" }}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={GREYS[i % GREYS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          ) : (
            <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" stroke="#525252" tick={{ fill: "#a3a3a3", fontSize: 11 }} axisLine={{ stroke: "#404040" }} />
              <YAxis stroke="#525252" tick={{ fill: "#a3a3a3", fontSize: 11 }} axisLine={{ stroke: "#404040" }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.06)" }} />
              <Bar dataKey="value" fill="#ffffff" radius={[2, 2, 0, 0]} maxBarSize={80} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
