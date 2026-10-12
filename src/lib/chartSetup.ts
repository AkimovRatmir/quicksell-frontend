import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';

ChartJS.register(
  BarController,
  BarElement,
  CategoryScale,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
);
