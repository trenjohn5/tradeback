// Backtest execution and results handling
export class BacktestHandler {
    constructor(strategy) {
        this.strategy = strategy;
        this.lastResults = null;
    }

    async runBacktest(timeframePeriod, timeframeInterval) {
        try {
            this.strategy.validate();

            const backtestData = {
                indicators: this.strategy.indicators,
                entry_conditions: this.strategy.entry,
                exit_conditions: this.strategy.exit,
                timeframe: {
                    period: timeframePeriod,
                    interval: timeframeInterval
                }
            };

            console.log('Running backtest with data:', backtestData);

            const response = await fetch('/api/backtest', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(backtestData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Raw backtest response:', data);
            
            // Check response structure
            if (!data.strategy_metrics) {
                throw new Error('Invalid response: missing strategy metrics');
            }
            
            // Check if trades are in the correct location
            if (data.strategy_metrics.trades) {
                // Move trades to top level if they're nested in metrics
                data.trades = data.strategy_metrics.trades;
                delete data.strategy_metrics.trades;
            }
            
            // Ensure trades array exists
            if (!data.trades) {
                console.warn('No trades array in backtest response');
                data.trades = [];
            }
            
            // Validate trade objects
            if (Array.isArray(data.trades)) {
                data.trades = data.trades.filter(trade => {
                    const isValid = trade && 
                        trade.entry_date && 
                        trade.exit_date && 
                        typeof trade.entry_price === 'number' && 
                        typeof trade.exit_price === 'number' &&
                        typeof trade.return === 'number';
                    
                    if (!isValid) {
                        console.warn('Filtered out invalid trade:', trade);
                    }
                    return isValid;
                });
            }
            
            // Store results and return
            this.lastResults = data;
            return data;

        } catch (error) {
            console.error('Backtest error:', error);
            throw error;
        }
    }

    async saveStrategy(name, description) {
        if (!this.lastResults) {
            throw new Error('No backtest results available. Please run a backtest first.');
        }

        const saveData = {
            name,
            description,
            config: {
                indicators: this.strategy.indicators,
                entry_conditions: this.strategy.entry,
                exit_conditions: this.strategy.exit,
                timeframe: this.lastResults.timeframe,
                buy_hold_metrics: this.lastResults.buy_hold_metrics
            },
            trades: this.lastResults.trades,
            metrics: {
                total_return: this.lastResults.strategy_metrics.total_return,
                sharpe_ratio: this.lastResults.strategy_metrics.sharpe_ratio,
                win_rate: this.lastResults.strategy_metrics.win_rate,
                risk_adjusted_return: this.lastResults.strategy_metrics.risk_adjusted_return,
                max_drawdown: this.lastResults.strategy_metrics.max_drawdown,
                total_trades: this.lastResults.strategy_metrics.total_trades,
                time_in_market: this.lastResults.strategy_metrics.time_in_market
            }
        };

        console.log('Saving strategy with data:', saveData);

        const response = await fetch('/api/save-strategy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(saveData)
        });

        if (!response.ok) {
            const text = await response.text();
            console.error('Error response text:', text);
            throw new Error(`Server error (${response.status}): ${text}`);
        }

        const data = await response.json();
        console.log('Save response:', data);
        return data;
    }

    updateMetricsDisplay(data) {
        console.log('Updating metrics display with:', data);
        
        // Update strategy metrics
        document.getElementById('strategy-return').textContent = data.strategy_metrics.total_return.toFixed(2) + '%';
        document.getElementById('strategy-win-rate').textContent = data.strategy_metrics.win_rate.toFixed(2) + '%';
        document.getElementById('strategy-drawdown').textContent = data.strategy_metrics.max_drawdown.toFixed(2) + '%';
        document.getElementById('strategy-trades').textContent = data.strategy_metrics.total_trades;
        
        // Update strategy risk metrics
        document.getElementById('strategy-time-in-market').textContent = data.strategy_metrics.time_in_market.toFixed(2) + '%';
        document.getElementById('strategy-sharpe').textContent = data.strategy_metrics.sharpe_ratio.toFixed(2);
        document.getElementById('strategy-risk-adjusted').textContent = data.strategy_metrics.risk_adjusted_return.toFixed(2);
        
        // Update buy & hold metrics
        if (data.buy_hold_metrics) {
            document.getElementById('buy-hold-return').textContent = data.buy_hold_metrics.total_return.toFixed(2) + '%';
            document.getElementById('buy-hold-drawdown').textContent = data.buy_hold_metrics.max_drawdown.toFixed(2) + '%';
            document.getElementById('buy-hold-sharpe').textContent = data.buy_hold_metrics.risk_metrics.sharpe_ratio.toFixed(2);
            document.getElementById('buy-hold-risk-adjusted').textContent = data.buy_hold_metrics.risk_metrics.risk_adjusted_return.toFixed(2);
        }
    }

    updateTradeHistory(trades) {
        console.log('Updating trade history with trades:', trades);
        
        const tradeHistory = document.getElementById('trade-history');
        if (!tradeHistory) {
            console.error('Trade history element not found');
            return;
        }
        
        if (!trades || !Array.isArray(trades)) {
            console.warn('Invalid trades data:', trades);
            tradeHistory.innerHTML = this.getNoTradesHTML();
            return;
        }

        if (trades.length === 0) {
            console.log('No trades executed in this backtest');
            tradeHistory.innerHTML = this.getNoTradesHTML();
            return;
        }

        console.log(`Rendering ${trades.length} trades`);
        
        try {
            const tradeRows = trades.map((trade, index) => {
                console.log(`Processing trade ${index + 1}:`, trade);
                return `
                    <tr class="hover:bg-gray-50">
                        <td class="px-6 py-4">
                            <div class="flex flex-col">
                                <span class="text-sm font-medium text-gray-900">Entry</span>
                                <div class="mt-1 flex items-center space-x-2">
                                    <span class="text-sm text-gray-500">${trade.entry_date}</span>
                                    <span class="text-sm font-medium text-gray-900">$${trade.entry_price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4">
                            <div class="flex flex-col">
                                <span class="text-sm font-medium text-gray-900">Exit</span>
                                <div class="mt-1 flex items-center space-x-2">
                                    <span class="text-sm text-gray-500">${trade.exit_date}</span>
                                    <span class="text-sm font-medium text-gray-900">$${trade.exit_price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4">
                            <div class="flex flex-col items-end">
                                <span class="text-sm font-medium text-gray-900">Return</span>
                                <span class="text-sm font-medium ${trade.return >= 0 ? 'text-green-600' : 'text-red-600'}">
                                    ${trade.return >= 0 ? '+' : ''}${trade.return.toFixed(2)}%
                                </span>
                            </div>
                        </td>
                    </tr>
                `;
            });

            tradeHistory.innerHTML = tradeRows.join('');
            console.log('Trade history updated successfully');
        } catch (error) {
            console.error('Error rendering trades:', error);
            tradeHistory.innerHTML = this.getNoTradesHTML();
        }
    }

    getNoTradesHTML() {
        return `
            <tr>
                <td colspan="3" class="px-6 py-4 text-center text-gray-500">
                    No trades executed
                </td>
            </tr>
        `;
    }

    updateComparisonDisplay(data) {
        const returnComparison = document.getElementById('return-comparison');
        const riskComparison = document.getElementById('risk-comparison');
        const timeComparison = document.getElementById('time-comparison');
        const comparisonDiv = document.getElementById('strategy-comparison');
        
        comparisonDiv.classList.remove('hidden');
        
        // Return comparison
        const returnDiff = data.strategy_metrics.total_return - data.buy_hold_metrics.total_return;
        if (returnDiff > 0) {
            returnComparison.innerHTML = `Your strategy <span class="text-green-600 font-medium">outperformed</span> buy & hold by <span class="text-green-600 font-medium">+${returnDiff.toFixed(2)}%</span>`;
        } else if (returnDiff < 0) {
            returnComparison.innerHTML = `Your strategy <span class="text-red-600 font-medium">underperformed</span> buy & hold by <span class="text-red-600 font-medium">${returnDiff.toFixed(2)}%</span>`;
        } else {
            returnComparison.innerHTML = `Your strategy <span class="text-gray-600 font-medium">matched</span> buy & hold returns`;
        }

        // Risk comparison
        const sharpeDiff = data.strategy_metrics.sharpe_ratio - data.buy_hold_metrics.risk_metrics.sharpe_ratio;
        if (sharpeDiff > 0) {
            riskComparison.innerHTML = `On a risk-adjusted basis, your strategy shows <span class="text-green-600 font-medium">better</span> risk-reward characteristics with a higher Sharpe ratio (${data.strategy_metrics.sharpe_ratio.toFixed(2)} vs ${data.buy_hold_metrics.risk_metrics.sharpe_ratio.toFixed(2)})`;
        } else if (sharpeDiff < 0) {
            riskComparison.innerHTML = `On a risk-adjusted basis, your strategy shows <span class="text-red-600 font-medium">worse</span> risk-reward characteristics with a lower Sharpe ratio (${data.strategy_metrics.sharpe_ratio.toFixed(2)} vs ${data.buy_hold_metrics.risk_metrics.sharpe_ratio.toFixed(2)})`;
        } else {
            riskComparison.innerHTML = `Your strategy shows <span class="text-gray-600 font-medium">similar</span> risk-reward characteristics to buy & hold`;
        }

        // Time in market comparison
        const timeInMarket = data.strategy_metrics.time_in_market;
        timeComparison.innerHTML = `Your strategy spent <span class="font-medium">${timeInMarket.toFixed(1)}%</span> of the time in the market, compared to 100% for buy & hold. ${
            timeInMarket < 100 
                ? `This reduced market exposure could provide <span class="text-blue-600 font-medium">additional flexibility</span> for other opportunities.`
                : `This suggests a <span class="text-blue-600 font-medium">fully invested</span> approach similar to buy & hold.`
        }`;
    }
}

export async function initializeBacktest(strategy) {
    const backtestHandler = new BacktestHandler(strategy);
    
    const timeframePeriod = document.getElementById('timeframe-period')?.value || '1y';
    const timeframeInterval = document.getElementById('timeframe-interval')?.value || '1d';
    
    try {
        const results = await backtestHandler.runBacktest(timeframePeriod, timeframeInterval);
        console.log('Backtest results for display:', results);
        
        backtestHandler.updateMetricsDisplay(results);
        
        // Explicitly check for trades
        if (results.trades && Array.isArray(results.trades)) {
            console.log(`Updating trade history with ${results.trades.length} trades`);
            backtestHandler.updateTradeHistory(results.trades);
        } else {
            console.warn('No valid trades array in results:', results);
            backtestHandler.updateTradeHistory([]);
        }
        
        backtestHandler.updateComparisonDisplay(results);
        
        return results;
    } catch (error) {
        console.error('Backtest initialization error:', error);
        throw error;
    }
} 