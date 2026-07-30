import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function VisitTrendGraph({ data, filter, onFilterChange, isLoading, error }) {
  // data is an array of { date, students, visitors }
  // filter is 'All' | 'Students' | 'Visitors'
  // onFilterChange is a callback to update the filter in the parent

  if (error) {
    return (
      <div className="visit-trend-container">
        <div className="visit-trend-error">
          <i className="fas fa-exclamation-triangle"></i>
          <p>Data unavailable</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="visit-trend-container">
        <div className="visit-trend-loading">
          <div className="spinner"></div>
          <p>Loading trend data...</p>
        </div>
      </div>
    );
  }

  const labels = data.map(d => d.date);

  const datasets = [];
  if (filter === 'All' || filter === 'Students') {
    datasets.push({
      label: 'Students',
      data: data.map(d => d.students),
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      tension: 0.3,
    });
  }
  if (filter === 'All' || filter === 'Visitors') {
    datasets.push({
      label: 'Visitors',
      data: data.map(d => d.visitors),
      borderColor: 'rgb(128, 90, 213)',
      backgroundColor: 'rgba(128, 90, 213, 0.1)',
      tension: 0.3,
    });
  }

  const chartData = { labels, datasets };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 3,
    plugins: {
      legend: { position: 'top' },
      title: { display: false },
    },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 } },
    },
  };

  return (
    <div className="visit-trend-container">
      <div className="visit-trend-title-bar">
        <span>Daily Visit Trend (30 Days)</span>
      </div>
      <div className="visit-trend-body">
        <div className="visit-trend-toggles">
          {['All', 'Students', 'Visitors'].map(opt => (
            <button
              key={opt}
              className={`trend-toggle-btn ${filter === opt ? 'active' : ''}`}
              onClick={() => onFilterChange(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}

export default VisitTrendGraph;
