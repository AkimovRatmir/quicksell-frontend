import { Chart } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';

interface RevenueProfitChartProps {
  labels: string[];
  revenue: number[];
  profit: number[];
}

export function RevenueProfitChart({ labels, revenue, profit }: RevenueProfitChartProps) {
  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        data: revenue,
        backgroundColor: '#AFA9EC',
        hoverBackgroundColor: '#8F87E0',
        borderRadius: 3,
        borderSkipped: false,
        label: 'Выручка',
      },
      {
        data: profit,
        backgroundColor: '#1D9E75',
        hoverBackgroundColor: '#0F6E56',
        borderRadius: 3,
        borderSkipped: false,
        label: 'Прибыль',
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    // Столбцы вырастают снизу с лёгким стаггером — как появление карточек в интерфейсе.
    animation: {
      duration: 750,
      easing: 'easeOutQuart',
    },
    animations: {
      y: {
        from: (ctx) => (ctx.type === 'data' && ctx.mode === 'default' ? ctx.chart.scales.y.getPixelForValue(0) : undefined),
        delay: (ctx) => (ctx.type === 'data' && ctx.mode === 'default' ? ctx.dataIndex * 30 + ctx.datasetIndex * 70 : 0),
      },
    },
    // Наведение только меняет оттенок столбца, без «прыжка» цвета.
    transitions: { active: { animation: { duration: 160, easing: 'easeOutQuad' } } },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1F1F1F',
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
        boxWidth: 8,
        boxHeight: 8,
        boxPadding: 4,
        usePointStyle: true,
        titleColor: '#fff',
        titleFont: { size: 11, weight: 500 },
        bodyColor: 'rgba(255,255,255,0.78)',
        bodyFont: { size: 11.5 },
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${Math.round(Number(ctx.parsed.y)).toLocaleString('ru')} ₸`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#aaa', autoSkip: false, maxRotation: 0 } },
      y: {
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: { font: { size: 10 }, color: '#aaa', callback: (v) => Number(v).toLocaleString('ru') },
      },
    },
  };

  return (
    <div style={{ position: 'relative', height: 220 }}>
      <Chart type="bar" data={data} options={options} aria-label="График выручки и прибыли" role="img" />
    </div>
  );
}
