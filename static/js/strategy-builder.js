document.addEventListener('DOMContentLoaded', function() {
    // Strategy state
    let strategy = {
        indicators: [],
        entry: [],
        exit: []
    };

    // UI Elements
    const activeIndicatorsEl = document.getElementById('active-indicators');
    const entryDropzone = document.getElementById('entry-dropzone');
    const exitDropzone = document.getElementById('exit-dropzone');
    const strategyPreview = document.getElementById('strategy-preview');
    const clearBtn = document.getElementById('clear-strategy');
    const saveBtn = document.getElementById('save-strategy');

    // Make sure dropzones are properly initialized
    [activeIndicatorsEl, entryDropzone, exitDropzone].forEach(el => {
        el.classList.add('dropzone');
    });

    // Initialize draggable indicators
    const indicators = document.querySelectorAll('.draggable[data-type]');
    indicators.forEach(indicator => {
        indicator.draggable = true;
        indicator.addEventListener('dragstart', (e) => {
            console.log('Drag started:', e.target.dataset.type);
            e.target.classList.add('opacity-50');
            e.dataTransfer.setData('text/plain', e.target.dataset.type);
        });
        
        indicator.addEventListener('dragend', (e) => {
            console.log('Drag ended');
            e.target.classList.remove('opacity-50');
        });
    });

    // Initialize dropzones
    document.querySelectorAll('.dropzone').forEach(zone => {
        zone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            console.log('Drag enter:', zone.id);
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        zone.addEventListener('dragleave', (e) => {
            if (e.target === zone) {
                console.log('Drag leave:', zone.id);
                zone.classList.remove('drag-over');
            }
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            console.log('Drop on:', zone.id);
            zone.classList.remove('drag-over');
            
            const type = e.dataTransfer.getData('text/plain');
            console.log('Dropped type:', type);
            
            if (zone === activeIndicatorsEl && ['sma', 'rsi', 'macd'].includes(type)) {
                addIndicator(type);
            }
        });
    });

    // Add condition buttons
    function initializeConditionButtons() {
        document.querySelectorAll('.add-condition-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                console.log('Add condition button clicked');
                const dropzone = this.closest('.dropzone');
                if (!dropzone) return;
                
                if (strategy.indicators.length === 0) {
                    showToast('Please add some indicators first!');
                    return;
                }

                addIndicatorCondition(dropzone);
            });
        });

        document.querySelectorAll('.add-price-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                console.log('Add price button clicked');
                const dropzone = this.closest('.dropzone');
                if (!dropzone) return;

                addPriceCondition(dropzone);
            });
        });
    }

    // Initialize buttons
    initializeConditionButtons();

    function addIndicatorCondition(dropzone) {
        // Clear placeholder if present
        const placeholder = dropzone.querySelector('.flex.flex-col');
        if (placeholder) {
            dropzone.innerHTML = '';
        }

        const card = document.createElement('div');
        card.className = 'condition-card bg-white p-4 rounded-lg shadow mb-4';
        card.dataset.type = 'indicator-compare';
        card.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <span class="font-medium text-gray-900">Indicator Condition</span>
                <button class="delete-component text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div class="space-y-2">
                <select class="indicator-select w-full text-sm border rounded p-2 bg-white">
                    ${strategy.indicators.map(ind => `
                        <option value="${ind.type}">${getIndicatorName(ind.type)}</option>
                    `).join('')}
                </select>
                <select class="condition-select w-full text-sm border rounded p-2 bg-white">
                    <option value="crosses-above">Crosses Above</option>
                    <option value="crosses-below">Crosses Below</option>
                    <option value="is-above">Is Above</option>
                    <option value="is-below">Is Below</option>
                </select>
                <div class="relative">
                    <input type="number" name="value" placeholder="Enter value" step="any"
                           class="w-full text-sm border rounded p-2 bg-white">
                    <div class="absolute right-3 top-2 text-gray-500 text-sm indicator-value-hint"></div>
                </div>
            </div>
        `;

        // Add indicator-specific value hints
        const indicatorSelect = card.querySelector('.indicator-select');
        const valueHint = card.querySelector('.indicator-value-hint');
        
        function updateValueHint() {
            const selectedType = indicatorSelect.value;
            switch(selectedType) {
                case 'rsi':
                    valueHint.textContent = '(0-100)';
                    break;
                case 'macd':
                    valueHint.textContent = '(signal line)';
                    break;
                default:
                    valueHint.textContent = '';
            }
        }
        
        indicatorSelect.addEventListener('change', updateValueHint);
        updateValueHint();  // Set initial hint

        setupComponentInteractions(card);
        dropzone.appendChild(card);
        updateStrategy();
    }

    function addPriceCondition(dropzone) {
        // Clear placeholder if present
        const placeholder = dropzone.querySelector('.flex.flex-col');
        if (placeholder) {
            dropzone.innerHTML = '';
        }

        const card = document.createElement('div');
        card.className = 'condition-card bg-white p-4 rounded-lg shadow mb-4';
        card.dataset.type = 'price-level';
        card.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <span class="font-medium text-gray-900">Price Level</span>
                <button class="delete-component text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div class="space-y-2">
                <select class="condition-select w-full text-sm border rounded p-2 bg-white">
                    <option value="crosses-above">Crosses Above</option>
                    <option value="crosses-below">Crosses Below</option>
                    <option value="is-above">Is Above</option>
                    <option value="is-below">Is Below</option>
                </select>
                <div class="relative">
                    <span class="absolute left-3 top-2 text-gray-500">$</span>
                    <input type="number" name="price" placeholder="Enter price level" step="any"
                           class="w-full text-sm border rounded p-2 pl-6 bg-white">
                    <div class="absolute right-3 top-2 text-gray-500 text-sm">USD</div>
                </div>
            </div>
        `;

        setupComponentInteractions(card);
        dropzone.appendChild(card);
        updateStrategy();
    }

    function setupComponentInteractions(card) {
        // Add delete handler
        card.querySelector('.delete-component').addEventListener('click', () => {
            const dropzone = card.closest('.dropzone');
            card.remove();
            
            // If this was the last card, restore the placeholder
            if (!dropzone.querySelector('.condition-card')) {
                dropzone.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full">
                        <p class="text-gray-400 text-sm text-center">Drop your ${dropzone.id === 'entry-dropzone' ? 'entry' : 'exit'} conditions here</p>
                        <div class="mt-2 flex space-x-2">
                            <button class="add-condition-btn px-3 py-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                                + Add Indicator Condition
                            </button>
                            <button class="add-price-btn px-3 py-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                                + Add Price Level
                            </button>
                        </div>
                    </div>
                `;
                
                // Reattach event listeners to new buttons
                initializeConditionButtons();
            }
            
            updateStrategy();
        });

        // Add change handlers for inputs and selects
        card.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('change', updateStrategy);
        });
    }

    function addIndicator(type) {
        console.log('Adding indicator:', type);
        
        // Check for duplicate
        if (strategy.indicators.find(i => i.type === type)) {
            showToast('This indicator is already added!');
            return;
        }

        // Clear placeholder if present
        if (activeIndicatorsEl.querySelector('p.text-gray-400')) {
            activeIndicatorsEl.innerHTML = '';
        }

        // Create indicator card
        const card = document.createElement('div');
        card.className = 'condition-card bg-white p-4 rounded-lg shadow mb-4';
        card.dataset.type = type;
        card.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <span class="font-medium text-gray-900">${getIndicatorName(type)}</span>
                <button class="delete-component text-gray-400 hover:text-gray-600">×</button>
            </div>
            ${createParamsHTML(getDefaultParams(type))}
        `;

        // Add delete handler
        card.querySelector('.delete-component').addEventListener('click', () => {
            strategy.indicators = strategy.indicators.filter(i => i.type !== type);
            card.remove();
            if (strategy.indicators.length === 0) {
                activeIndicatorsEl.innerHTML = '<p class="text-gray-400 text-sm italic">Drop your indicators here</p>';
            }
            updateStrategy();
        });

        // Add parameter change handlers
        card.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', updateStrategy);
        });

        // Add to DOM and update strategy
        activeIndicatorsEl.appendChild(card);
        strategy.indicators.push({
            type,
            params: getDefaultParams(type)
        });

        updateStrategy();
        showToast('Indicator added successfully!');
    }

    function getIndicatorName(type) {
        const names = {
            'sma': 'Moving Average',
            'rsi': 'RSI',
            'macd': 'MACD'
        };
        return names[type] || type.toUpperCase();
    }

    function getDefaultParams(type) {
        const defaults = {
            'sma': { Period: 20 },
            'rsi': { Period: 14, Overbought: 70, Oversold: 30 },
            'macd': { 'Fast Period': 12, 'Slow Period': 26, 'Signal Period': 9 }
        };
        return defaults[type] || {};
    }

    function createParamsHTML(params) {
        return Object.entries(params).map(([key, value]) => `
            <div class="mb-2">
                <label class="block text-sm text-gray-600 mb-1">${key}:</label>
                <input type="number" name="${key}" value="${value}" 
                       class="w-full text-sm border rounded p-2 bg-white">
            </div>
        `).join('');
    }

    function updateStrategy() {
        // Update indicators
        strategy.indicators = Array.from(activeIndicatorsEl.querySelectorAll('.condition-card')).map(card => {
            const params = {};
            card.querySelectorAll('input').forEach(input => {
                params[input.name] = parseFloat(input.value);
            });
            return {
                type: card.dataset.type,
                params
            };
        });

        // Update entry conditions
        strategy.entry = parseConditions(entryDropzone);

        // Update exit conditions
        strategy.exit = parseConditions(exitDropzone);

        // Update preview
        updateStrategyPreview();
    }

    function parseConditions(dropzone) {
        return Array.from(dropzone.querySelectorAll('.condition-card')).map(card => {
            if (card.dataset.type === 'indicator-compare') {
                return {
                    type: 'indicator-compare',
                    indicator: card.querySelector('.indicator-select').value,
                    condition: card.querySelector('.condition-select').value,
                    value: parseFloat(card.querySelector('input[name="value"]').value) || 0
                };
            } else if (card.dataset.type === 'price-level') {
                return {
                    type: 'price-level',
                    condition: card.querySelector('.condition-select').value,
                    price: parseFloat(card.querySelector('input[name="price"]').value) || 0
                };
            }
            return null;
        }).filter(Boolean);
    }

    function updateStrategyPreview() {
        let preview = '// Active Indicators:\n';
        preview += strategy.indicators.map(ind => {
            switch(ind.type) {
                case 'sma':
                    return `Moving Average (${ind.params.Period} periods)`;
                case 'rsi':
                    return `RSI (${ind.params.Period} periods)`;
                case 'macd':
                    return `MACD (${ind.params['Fast Period']}, ${ind.params['Slow Period']}, ${ind.params['Signal Period']})`;
                default:
                    return ind.type.toUpperCase();
            }
        }).join('\n') || 'None';

        preview += '\n\n// Entry Rules:\n';
        preview += generateRulesPreview(strategy.entry) || 'No conditions set';
        
        preview += '\n\n// Exit Rules:\n';
        preview += generateRulesPreview(strategy.exit) || 'No conditions set';

        strategyPreview.textContent = preview;
    }

    function generateRulesPreview(conditions) {
        if (!conditions.length) return '';
        
        return conditions.map(cond => {
            if (cond.type === 'indicator-compare') {
                return `${getIndicatorName(cond.indicator)} ${cond.condition.replace('-', ' ')} ${cond.value}`;
            } else if (cond.type === 'price-level') {
                return `Price ${cond.condition.replace('-', ' ')} $${cond.price}`;
            }
            return '';
        }).join('\nAND\n');
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg transform transition-all duration-300';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // Clear button handler
    clearBtn?.addEventListener('click', () => {
        if (!confirm('Are you sure you want to clear your strategy?')) return;
        
        activeIndicatorsEl.innerHTML = '<p class="text-gray-400 text-sm italic">Drop your indicators here</p>';
        strategy = {
            indicators: [],
            entry: [],
            exit: []
        };
        updateStrategy();
    });

    // Save button handler
    saveBtn?.addEventListener('click', () => {
        const name = prompt('Enter a name for this strategy:');
        if (name) {
            const savedStrategies = JSON.parse(localStorage.getItem('savedStrategies') || '[]');
            savedStrategies.push({ name, ...strategy });
            localStorage.setItem('savedStrategies', JSON.stringify(savedStrategies));
            showToast('Strategy saved successfully!');
        }
    });

    // Run Backtest Button Handler
    document.getElementById('run-backtest').addEventListener('click', function() {
        if (strategy.indicators.length === 0) {
            showToast('Please add at least one indicator to your strategy.');
            return;
        }

        if (strategy.entry.length === 0 && strategy.exit.length === 0) {
            showToast('Please add at least one entry or exit condition.');
            return;
        }

        // Show loading state
        const runButton = this;
        runButton.disabled = true;
        const originalText = runButton.textContent;
        runButton.innerHTML = `
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Running Backtest...
        `;

        // Prepare strategy data
        const backtestData = {
            indicators: strategy.indicators,
            entry_conditions: parseConditions(entryDropzone),
            exit_conditions: parseConditions(exitDropzone)
        };

        console.log('Sending backtest data:', JSON.stringify(backtestData, null, 2));

        // Run backtest
        fetch('/api/backtest', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(backtestData)
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    try {
                        const error = JSON.parse(text);
                        throw new Error(error.message || 'Unknown error');
                    } catch {
                        throw new Error(`Server error (${response.status}): ${text}`);
                    }
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Backtest results:', data);
            
            if (data.status === 'success') {
                // Update strategy metrics
                document.getElementById('strategy-return').textContent = data.strategy_metrics.total_return + '%';
                document.getElementById('strategy-win-rate').textContent = data.strategy_metrics.win_rate + '%';
                document.getElementById('strategy-drawdown').textContent = data.strategy_metrics.max_drawdown + '%';
                document.getElementById('strategy-trades').textContent = data.strategy_metrics.total_trades;

                // Update risk metrics
                if (data.strategy_metrics.risk_metrics) {
                    document.getElementById('strategy-time-in-market').textContent = 
                        data.strategy_metrics.risk_metrics.time_in_market + '%';
                    document.getElementById('strategy-sharpe').textContent = 
                        data.strategy_metrics.risk_metrics.sharpe_ratio.toFixed(2);
                    document.getElementById('strategy-risk-adjusted').textContent = 
                        data.strategy_metrics.risk_metrics.risk_adjusted_return.toFixed(2);
                }

                // Update buy & hold metrics
                document.getElementById('buy-hold-return').textContent = data.buy_hold_metrics.total_return + '%';
                document.getElementById('buy-hold-drawdown').textContent = data.buy_hold_metrics.max_drawdown + '%';

                // Update buy & hold risk metrics
                if (data.buy_hold_metrics.risk_metrics) {
                    document.getElementById('buy-hold-sharpe').textContent = 
                        data.buy_hold_metrics.risk_metrics.sharpe_ratio.toFixed(2);
                    document.getElementById('buy-hold-risk-adjusted').textContent = 
                        data.buy_hold_metrics.risk_metrics.risk_adjusted_return.toFixed(2);
                }

                // Show comparison
                const comparisonDiv = document.getElementById('strategy-comparison');
                const returnComparison = document.getElementById('return-comparison');
                const riskComparison = document.getElementById('risk-comparison');
                const timeComparison = document.getElementById('time-comparison');
                
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
                if (data.strategy_metrics.risk_metrics && data.buy_hold_metrics.risk_metrics) {
                    const sharpeDiff = data.strategy_metrics.risk_metrics.sharpe_ratio - data.buy_hold_metrics.risk_metrics.sharpe_ratio;
                    
                    if (sharpeDiff > 0) {
                        riskComparison.innerHTML = `On a risk-adjusted basis, your strategy shows <span class="text-green-600 font-medium">better</span> risk-reward characteristics with a higher Sharpe ratio (${data.strategy_metrics.risk_metrics.sharpe_ratio.toFixed(2)} vs ${data.buy_hold_metrics.risk_metrics.sharpe_ratio.toFixed(2)})`;
                    } else if (sharpeDiff < 0) {
                        riskComparison.innerHTML = `On a risk-adjusted basis, your strategy shows <span class="text-red-600 font-medium">worse</span> risk-reward characteristics with a lower Sharpe ratio (${data.strategy_metrics.risk_metrics.sharpe_ratio.toFixed(2)} vs ${data.buy_hold_metrics.risk_metrics.sharpe_ratio.toFixed(2)})`;
                    } else {
                        riskComparison.innerHTML = `Your strategy shows <span class="text-gray-600 font-medium">similar</span> risk-reward characteristics to buy & hold`;
                    }

                    // Time in market comparison
                    const timeInMarket = data.strategy_metrics.risk_metrics.time_in_market;
                    timeComparison.innerHTML = `Your strategy spent <span class="font-medium">${timeInMarket.toFixed(1)}%</span> of the time in the market, compared to 100% for buy & hold. ${
                        timeInMarket < 100 
                            ? `This reduced market exposure could provide <span class="text-blue-600 font-medium">additional flexibility</span> for other opportunities.`
                            : `This suggests a <span class="text-blue-600 font-medium">fully invested</span> approach similar to buy & hold.`
                    }`;
                }

                // Update chart and trade history
                if (window.chartHandler && data.trades) {
                    window.chartHandler.addTradeMarkers(data.trades);
                }

                if (data.trades) {
                    updateTradeHistory(data.trades);
                }

                showToast('Backtest completed successfully!');
            } else {
                showToast(data.message || 'Error running backtest');
            }
        })
        .catch(error => {
            console.error('Backtest error:', error);
            showToast(error.message || 'Error running backtest');
        })
        .finally(() => {
            // Reset button state
            runButton.disabled = false;
            runButton.textContent = originalText;
        });
    });

    function updateTradeHistory(trades) {
        const tradeHistory = document.getElementById('trade-history');
        if (!tradeHistory || !trades || !Array.isArray(trades)) {
            console.error('Invalid trade history data:', trades);
            return;
        }

        // Filter for completed trades (pairs of buy and sell)
        const completedTrades = [];
        let currentTrade = null;

        trades.forEach(trade => {
            if (trade.type === 'buy') {
                currentTrade = {
                    entry_date: trade.date,
                    entry_price: trade.price
                };
            } else if (trade.type === 'sell' && currentTrade) {
                currentTrade.exit_date = trade.date;
                currentTrade.exit_price = trade.price;
                currentTrade.pnl = trade.pl_absolute;
                currentTrade.pnl_percent = trade.pl_percentage * 100;
                completedTrades.push(currentTrade);
                currentTrade = null;
            }
        });

        // Create trade history rows
        tradeHistory.innerHTML = completedTrades.map(trade => `
            <tr class="hover:bg-gray-50 group">
                <!-- Entry Information -->
                <td class="px-6 py-4">
                    <div class="flex flex-col">
                        <span class="text-sm font-medium text-gray-900">Entry</span>
                        <div class="mt-1 flex items-center space-x-2">
                            <span class="text-sm text-gray-500">${new Date(trade.entry_date).toLocaleDateString()}</span>
                            <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                            </svg>
                            <span class="text-sm font-medium text-gray-900">$${trade.entry_price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                    </div>
                </td>

                <!-- Exit Information -->
                <td class="px-6 py-4">
                    <div class="flex flex-col">
                        <span class="text-sm font-medium text-gray-900">Exit</span>
                        <div class="mt-1 flex items-center space-x-2">
                            <span class="text-sm text-gray-500">${new Date(trade.exit_date).toLocaleDateString()}</span>
                            <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                            </svg>
                            <span class="text-sm font-medium text-gray-900">$${trade.exit_price.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                    </div>
                </td>

                <!-- P/L Information -->
                <td class="px-6 py-4">
                    <div class="flex flex-col items-end">
                        <span class="text-sm font-medium text-gray-900">Profit/Loss</span>
                        <div class="mt-1 flex flex-col items-end">
                            <span class="text-sm font-semibold ${trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'}">
                                ${trade.pnl >= 0 ? '+' : ''}$${Math.abs(trade.pnl).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </span>
                            <span class="text-sm ${trade.pnl_percent >= 0 ? 'text-green-600' : 'text-red-600'}">
                                (${trade.pnl_percent >= 0 ? '+' : ''}${trade.pnl_percent.toFixed(2)}%)
                            </span>
                        </div>
                    </div>
                </td>
            </tr>
        `).join('') || `
            <tr>
                <td colspan="3" class="px-6 py-8 text-center">
                    <div class="flex flex-col items-center text-gray-500">
                        <svg class="h-12 w-12 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                        </svg>
                        <span class="text-sm font-medium">No trades executed</span>
                        <span class="text-xs mt-1">Add some indicators and conditions to start trading</span>
                    </div>
                </td>
            </tr>
        `;

        console.log('Updated trade history with trades:', completedTrades);
    }
}); 