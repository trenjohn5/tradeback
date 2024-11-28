export class ChartHandler {
    constructor() {
        this.priceChart = null;
        this.initialize();
    }

    initialize() {
        const ctx = document.getElementById('price-chart')?.getContext('2d');
        if (!ctx) return;

        this.priceChart = new Chart(ctx, {
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

        this.setupTimeframeHandlers();
        this.fetchInitialData();
    }

    async fetchPriceData() {
        const timeframePeriod = document.getElementById('timeframe-period')?.value || '1y';
        const timeframeInterval = document.getElementById('timeframe-interval')?.value || '1d';

        console.log(`Fetching price data for period: ${timeframePeriod}, interval: ${timeframeInterval}`);

        try {
            const response = await fetch('/api/fetch-btc-data?' + new URLSearchParams({
                period: timeframePeriod,
                interval: timeframeInterval
            }));
            const data = await response.json();
            this.updateChart(data);
        } catch (error) {
            console.error('Error fetching price data:', error);
        }
    }

    updateChart(data) {
        if (!this.priceChart) return;

        console.log(`Updating chart with ${data.labels?.length || 0} data points`);

        this.priceChart.data.labels = data.labels;
        this.priceChart.data.datasets[0].data = data.prices;
        this.priceChart.update();
    }

    addTradeMarkers(trades) {
        if (!this.priceChart) {
            console.warn('Chart not initialized');
            return;
        }

        console.log('Adding trade markers:', trades);

        if (!trades || !Array.isArray(trades)) {
            console.warn('Invalid trades data for markers');
            return;
        }

        // Convert trades into entry (buy) and exit (sell) points
        const buyMarkers = {
            label: 'Entry Points',
            data: trades.map(t => ({
                x: t.entry_date,
                y: t.entry_price
            })),
            backgroundColor: 'rgb(34, 197, 94)', // green-500
            pointStyle: 'triangle',
            pointRadius: 12,
            borderColor: 'white',
            borderWidth: 2,
            showLine: false
        };

        const sellMarkers = {
            label: 'Exit Points',
            data: trades.map(t => ({
                x: t.exit_date,
                y: t.exit_price
            })),
            backgroundColor: 'rgb(239, 68, 68)', // red-500
            pointStyle: 'triangle',
            pointRadius: 12,
            borderColor: 'white',
            borderWidth: 2,
            rotation: 180,
            showLine: false
        };

        // Keep the price line and add the markers
        this.priceChart.data.datasets = [
            this.priceChart.data.datasets[0], // Price line
            buyMarkers,
            sellMarkers
        ];

        console.log('Updating chart with markers');
        this.priceChart.update();
    }

    clearTradeMarkers() {
        if (!this.priceChart) return;
        
        // Keep only the price line dataset
        this.priceChart.data.datasets = [this.priceChart.data.datasets[0]];
        this.priceChart.update();
    }

    setupTimeframeHandlers() {
        const timeframePeriodEl = document.getElementById('timeframe-period');
        const timeframeIntervalEl = document.getElementById('timeframe-interval');

        if (timeframePeriodEl) {
            timeframePeriodEl.addEventListener('change', () => this.fetchPriceData());
        }
        if (timeframeIntervalEl) {
            timeframeIntervalEl.addEventListener('change', () => this.fetchPriceData());
        }
    }

    async fetchInitialData() {
        await this.fetchPriceData();
    }
}

export const chartHandler = new ChartHandler(); 