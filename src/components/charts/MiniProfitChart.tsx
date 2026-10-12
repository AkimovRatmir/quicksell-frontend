import { Chart } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';

const options: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  // Линия «прочерчивается» слева направо при появлении карточки.
  animation: { duration: 900, easing: 'easeOutQuart' },
  animations: {
    x: { from: (ctx) => (ctx.type === 'data' && ctx.mode === 'default' ? ctx.chart.chartArea?.left : undefined) },
    y: { from: (ctx) => (ctx.type === 'data' && ctx.mode === 'default' ? ctx.chart.chartArea?.bottom : undefined) },
  },
  plugins: { legend: { display: false }, tooltip: { enabled: false } },
  scales: { x: { display: false }, y: { display: false } },
};

export function MiniProfitChart({ profit, height = 72 }: { profit: number[]; height?: number }) {
  const data: ChartData<'line'> = {
    labels: profit.map((_, i) => String(i + 1)),
    datasets: [
      {
        data: profit,
        borderColor: '#0F6E56',
        backgroundColor: 'rgba(15,110,86,0.06)',
        tension: 0.4,
        pointRadius: 0,
        fill: true,
        borderWidth: 1.5,
      },
    ],
  };

  return (
    <div style={{ position: 'relative', height }}>
      <Chart type="line" data={data} options={options} aria-label="Мини-график прибыли" role="img" />
    </div>
  );
}
