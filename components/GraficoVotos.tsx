"use client";

import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface GraficoVotosProps {
  votos: { [key: string]: number };
  titulo: string;
}

export default function GraficoVotos({ votos, titulo }: GraficoVotosProps) {
  const data = {
    labels: Object.keys(votos).map(candidato => candidato.charAt(0).toUpperCase() + candidato.slice(1)),
    datasets: [
      {
        label: 'Número de Votos',
        data: Object.values(votos),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: titulo,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  return (
    <div style={{ width: '100%', maxWidth: '800px', margin: 'auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>{titulo}</h2>
      {Object.keys(votos).length > 0 ? (
        <Bar data={data} options={options} />
      ) : (
        <p style={{ textAlign: 'center' }}>No hay datos para mostrar el gráfico.</p>
      )}
    </div>
  );
}
