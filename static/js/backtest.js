document.addEventListener('DOMContentLoaded', function() {
    // UI Elements
    const totalReturnEl = document.getElementById('total-return');
    const winRateEl = document.getElementById('win-rate');
    const maxDrawdownEl = document.getElementById('max-drawdown');
    const totalTradesEl = document.getElementById('total-trades');
    const tradeHistoryEl = document.getElementById('trade-history');

    // Update performance metrics in the UI
    function updateMetrics(results) {
        // Format numbers for display
        const formatPercent = (num) => `${(num * 100).toFixed(2)}%`;
        const formatMoney = (num) => `$${num.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;

        // Update UI elements with animations
        function animateValue(element, value, isPercentage = false) {
            const duration = 1000; // Animation duration in milliseconds
            const startValue = 0;
            const startTime = performance.now();
            
            function update(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Easing function for smooth animation
                const easeOutQuart = 1 - Math.pow(1 - progress, 4);
                const currentValue = startValue + (value - startValue) * easeOutQuart;
                
                element.textContent = isPercentage ? 
                    `${(currentValue * 100).toFixed(2)}%` : 
                    formatMoney(currentValue);
                
                if (progress < 1) {
                    requestAnimationFrame(update);
                }
            }
            
            requestAnimationFrame(update);
        }

        // Animate metrics
        animateValue(totalReturnEl, results.totalReturn, true);
        totalReturnEl.className = results.totalReturn >= 0 ? 
            'text-2xl font-semibold mt-1 text-green-600' : 
            'text-2xl font-semibold mt-1 text-red-600';

        animateValue(winRateEl, results.winRate, true);
        animateValue(maxDrawdownEl, results.maxDrawdown, true);
        totalTradesEl.textContent = Math.floor(results.totalTrades / 2);

        // Update trade history
        updateTradeHistory(results.trades);

        // Add trade markers to the chart
        if (window.chartHandler) {
            window.chartHandler.addTradeMarkers(results.trades);
        }
    }

    // Update trade history table
    function updateTradeHistory(trades) {
        // Clear existing trades
        tradeHistoryEl.innerHTML = '';
        
        // Group trades into pairs (buy/sell)
        const tradePairs = [];
        let currentBuy = null;
        
        trades.forEach(trade => {
            if (trade.type === 'buy') {
                currentBuy = trade;
            } else if (trade.type === 'sell' && currentBuy) {
                tradePairs.push({
                    entry: currentBuy,
                    exit: trade
                });
                currentBuy = null;
            }
        });

        // Create rows for each trade pair
        tradePairs.forEach((pair, index) => {
            const { entry, exit } = pair;
            
            // Format dates
            const entryDate = new Date(entry.date).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            const exitDate = new Date(exit.date).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            // Format prices
            const entryPrice = entry.price.toLocaleString(undefined, {
                style: 'currency',
                currency: 'USD'
            });
            const exitPrice = exit.price.toLocaleString(undefined, {
                style: 'currency',
                currency: 'USD'
            });
            
            // Calculate P/L
            const plClass = exit.pl_absolute >= 0 ? 'text-green-600' : 'text-red-600';
            const plAbsolute = exit.pl_absolute.toLocaleString(undefined, {
                style: 'currency',
                currency: 'USD'
            });
            const plPercentage = (exit.pl_percentage * 100).toFixed(2) + '%';

            // Create main trade row
            const mainRow = document.createElement('tr');
            mainRow.className = 'trade-row hover:bg-gray-50 transition-colors';
            mainRow.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <svg class="expand-icon w-4 h-4 mr-2 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M7.293 4.293a1 1 0 011.414 0L14.414 10l-5.707 5.707a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                        <div>
                            <div class="text-sm font-medium text-gray-900">${entryDate}</div>
                            <div class="text-sm text-gray-500">Entry</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div>
                        <div class="text-sm font-medium text-gray-900">${exitDate}</div>
                        <div class="text-sm text-gray-500">Exit</div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                    <div class="text-sm font-medium text-gray-900">${entryPrice}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                    <div class="text-sm font-medium text-gray-900">${exitPrice}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                    <div class="text-sm font-semibold ${plClass}">${plAbsolute}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                    <div class="text-sm font-semibold ${plClass}">${plPercentage}</div>
                </td>
            `;

            // Create details row
            const detailsRow = document.createElement('tr');
            detailsRow.className = 'trade-details';
            detailsRow.innerHTML = `
                <td colspan="6" class="px-6 py-0 bg-gray-50">
                    <div class="py-3">
                        <div class="flex items-center justify-between py-2 border-b border-gray-200">
                            <div class="flex items-center">
                                <span class="text-sm font-medium text-green-600 w-16">BUY</span>
                                <span class="text-sm text-gray-900">${entryDate}</span>
                            </div>
                            <span class="text-sm font-medium text-gray-900">${entryPrice}</span>
                        </div>
                        <div class="flex items-center justify-between py-2">
                            <div class="flex items-center">
                                <span class="text-sm font-medium text-red-600 w-16">SELL</span>
                                <span class="text-sm text-gray-900">${exitDate}</span>
                            </div>
                            <span class="text-sm font-medium text-gray-900">${exitPrice}</span>
                        </div>
                    </div>
                </td>
            `;

            // Add click handler to toggle details
            mainRow.addEventListener('click', () => {
                detailsRow.classList.toggle('expanded');
                mainRow.classList.toggle('expanded');
            });

            // Add rows to table with fade-in animation
            mainRow.style.opacity = '0';
            detailsRow.style.opacity = '0';
            tradeHistoryEl.appendChild(mainRow);
            tradeHistoryEl.appendChild(detailsRow);

            // Trigger fade-in animation
            setTimeout(() => {
                mainRow.style.transition = 'opacity 0.3s ease-in-out';
                mainRow.style.opacity = '1';
                detailsRow.style.transition = 'opacity 0.3s ease-in-out';
                detailsRow.style.opacity = '1';
            }, index * 50); // Stagger the animations
        });
    }

    // Handle backtest response
    function handleBacktestResponse(data) {
        if (data.status === 'success' && data.results) {
            updateMetrics(data.results);
        } else {
            console.error('Invalid backtest response:', data);
            // Show error message to user
            alert('Error running backtest. Please check the console for details.');
        }
    }

    // Export functions for use in other modules
    window.backtestHandler = {
        handleBacktestResponse,
        updateMetrics
    };
}); 