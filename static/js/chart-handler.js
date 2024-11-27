document.addEventListener('DOMContentLoaded', function() {
    let priceChart = null;

    // Initialize the chart
    function initializeChart() {
        const ctx = document.getElementById('price-chart').getContext('2d');
        priceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'BTC-USD',
                    data: [],
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Bitcoin Price History'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `$${context.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    // Fetch and update price data
    function fetchPriceData() {
        fetch('/api/fetch-btc-data')
            .then(response => response.json())
            .then(data => {
                updateChart(data);
            })
            .catch(error => {
                console.error('Error fetching price data:', error);
            });
    }

    // Update chart with new data
    function updateChart(data) {
        if (!priceChart) {
            initializeChart();
        }

        priceChart.data.labels = data.labels;
        priceChart.data.datasets[0].data = data.prices;
        priceChart.update();
    }

    // Add trade markers to the chart
    function addTradeMarkers(trades) {
        const buyMarkers = {
            label: 'Buy Signals',
            data: trades.filter(t => t.type === 'buy').map(t => ({
                x: t.date,
                y: t.price
            })),
            backgroundColor: 'green',
            pointStyle: 'triangle',
            pointRadius: 8,
            showLine: false
        };

        const sellMarkers = {
            label: 'Sell Signals',
            data: trades.filter(t => t.type === 'sell').map(t => ({
                x: t.date,
                y: t.price
            })),
            backgroundColor: 'red',
            pointStyle: 'triangle',
            pointRadius: 8,
            rotation: 180,
            showLine: false
        };

        priceChart.data.datasets = [
            priceChart.data.datasets[0],
            buyMarkers,
            sellMarkers
        ];
        priceChart.update();
    }

    // Initialize chart and fetch initial data
    initializeChart();
    fetchPriceData();

    // Export functions for use in other modules
    window.chartHandler = {
        updateChart,
        addTradeMarkers
    };
}); 