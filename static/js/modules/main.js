import { Strategy } from './strategy.js';
import { chartHandler } from './chart-handler.js';
import { 
    initializeDragAndDrop, 
    showToast, 
    createIndicatorCard, 
    createConditionCard, 
    updateConditions 
} from './ui-components.js';
import { BacktestHandler } from './backtest.js';

// Create a global strategy instance and backtest handler that can be accessed by other modules
let globalStrategy;
let globalBacktestHandler;

async function loadStrategyFromId(strategyId) {
    try {
        console.log('Loading strategy:', strategyId);
        const response = await fetch(`/api/strategy/${strategyId}`);
        if (!response.ok) {
            throw new Error('Failed to load strategy');
        }
        
        const data = await response.json();
        console.log('Loaded strategy data:', data);
        
        // Set timeframe
        if (data.config.timeframe) {
            const periodSelect = document.getElementById('timeframe-period');
            const intervalSelect = document.getElementById('timeframe-interval');
            if (periodSelect) periodSelect.value = data.config.timeframe.period;
            if (intervalSelect) intervalSelect.value = data.config.timeframe.interval;
        }
        
        // Clear existing strategy
        globalStrategy.clear();
        
        // Add indicators
        if (data.config.indicators) {
            // Clear existing indicators
            const container = document.getElementById('active-indicators');
            if (container) {
                container.innerHTML = ''; // Clear placeholder text
            }
            
            for (const indicator of data.config.indicators) {
                globalStrategy.addIndicator(indicator.type, indicator.params);
                
                // Create indicator card in UI
                if (container) {
                    const card = createIndicatorCard(
                        indicator.type,
                        indicator.params,
                        () => {
                            globalStrategy.removeIndicator(indicator.type);
                            card.remove();
                            if (!container.querySelector('.condition-card')) {
                                container.innerHTML = '<p class="text-gray-400 text-sm italic">Drop your indicators here</p>';
                            }
                        },
                        () => {
                            const params = {};
                            card.querySelectorAll('input').forEach(input => {
                                params[input.name] = parseFloat(input.value);
                            });
                            globalStrategy.updateIndicatorParams(indicator.type, params);
                        }
                    );
                    container.appendChild(card);
                }
            }
        }
        
        // Add entry conditions
        if (data.config.entry_conditions) {
            const entryDropzone = document.getElementById('entry-dropzone');
            if (entryDropzone) {
                entryDropzone.innerHTML = ''; // Clear existing content
                for (const condition of data.config.entry_conditions) {
                    const card = createConditionCard(
                        condition.type,
                        condition,
                        globalStrategy.indicators,
                        () => {
                            card.remove();
                            updateConditions(entryDropzone, globalStrategy);
                            if (!entryDropzone.querySelector('.condition-card')) {
                                entryDropzone.innerHTML = createDropzoneContent('entry');
                            }
                        },
                        () => updateConditions(entryDropzone, globalStrategy)
                    );
                    entryDropzone.appendChild(card);
                }
                updateConditions(entryDropzone, globalStrategy);
            }
        }
        
        // Add exit conditions
        if (data.config.exit_conditions) {
            const exitDropzone = document.getElementById('exit-dropzone');
            if (exitDropzone) {
                exitDropzone.innerHTML = ''; // Clear existing content
                for (const condition of data.config.exit_conditions) {
                    const card = createConditionCard(
                        condition.type,
                        condition,
                        globalStrategy.indicators,
                        () => {
                            card.remove();
                            updateConditions(exitDropzone, globalStrategy);
                            if (!exitDropzone.querySelector('.condition-card')) {
                                exitDropzone.innerHTML = createDropzoneContent('exit');
                            }
                        },
                        () => updateConditions(exitDropzone, globalStrategy)
                    );
                    exitDropzone.appendChild(card);
                }
                updateConditions(exitDropzone, globalStrategy);
            }
        }
        
        // Store loaded results in backtest handler
        if (data.metrics && data.trades) {
            const buyHoldMetrics = data.config.buy_hold_metrics || {
                total_return: 0,
                max_drawdown: 0,
                risk_metrics: {
                    sharpe_ratio: 0,
                    risk_adjusted_return: 0
                }
            };

            globalBacktestHandler.lastResults = {
                strategy_metrics: {
                    total_return: data.metrics.total_return,
                    sharpe_ratio: data.metrics.sharpe_ratio,
                    win_rate: data.metrics.win_rate,
                    risk_adjusted_return: data.metrics.risk_adjusted_return,
                    max_drawdown: data.metrics.max_drawdown,
                    total_trades: data.metrics.total_trades,
                    time_in_market: data.metrics.time_in_market
                },
                buy_hold_metrics: buyHoldMetrics,
                trades: data.trades,
                timeframe: data.config.timeframe
            };
            
            // Update displays
            globalBacktestHandler.updateMetricsDisplay(globalBacktestHandler.lastResults);
            globalBacktestHandler.updateTradeHistory(data.trades);
            globalBacktestHandler.updateComparisonDisplay(globalBacktestHandler.lastResults);
            
            // Clear existing chart markers
            chartHandler.clearTradeMarkers();
            
            // Add trade markers with proper dates
            const formattedTrades = data.trades.map(trade => ({
                ...trade,
                entry_date: new Date(trade.entry_date).toISOString().split('T')[0],
                exit_date: new Date(trade.exit_date).toISOString().split('T')[0]
            }));
            chartHandler.addTradeMarkers(formattedTrades);
        }
        
        // Run backtest to get fresh data
        const backtestBtn = document.getElementById('run-backtest');
        if (backtestBtn) {
            backtestBtn.click();
        }
        
        showToast('Strategy loaded successfully!');
        
    } catch (error) {
        console.error('Error loading strategy:', error);
        showToast('Failed to load strategy', 'error');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize strategy
    globalStrategy = new Strategy();
    window.strategy = globalStrategy; // Make it accessible for debugging
    
    // Initialize backtest handler
    globalBacktestHandler = new BacktestHandler(globalStrategy);
    
    // Initialize drag and drop
    initializeDragAndDrop(globalStrategy);
    
    // Check for strategy ID in URL
    const urlParams = new URLSearchParams(window.location.search);
    const strategyId = urlParams.get('strategy');
    if (strategyId) {
        await loadStrategyFromId(strategyId);
    }
    
    // Initialize backtest button
    const backtestBtn = document.getElementById('run-backtest');
    if (backtestBtn) {
        backtestBtn.addEventListener('click', async () => {
            try {
                // Show loading state
                backtestBtn.disabled = true;
                backtestBtn.innerHTML = `
                    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Running Backtest...
                `;
                
                // Clear previous trade markers
                chartHandler.clearTradeMarkers();
                
                // Validate strategy
                globalStrategy.validate();
                
                // Run backtest
                const results = await globalBacktestHandler.runBacktest(
                    document.getElementById('timeframe-period')?.value || '1y',
                    document.getElementById('timeframe-interval')?.value || '1d'
                );
                
                console.log('Backtest completed with results:', results);
                
                // Update displays
                globalBacktestHandler.updateMetricsDisplay(results);
                
                // Update trade history and markers
                if (results.trades && Array.isArray(results.trades)) {
                    console.log(`Processing ${results.trades.length} trades for display`);
                    globalBacktestHandler.updateTradeHistory(results.trades);
                    
                    // Add trade markers to chart
                    console.log('Adding trade markers to chart');
                    chartHandler.addTradeMarkers(results.trades);
                } else {
                    console.warn('No trades found in results');
                    globalBacktestHandler.updateTradeHistory([]);
                }
                
                // Update comparison
                globalBacktestHandler.updateComparisonDisplay(results);
                
                // Show success message and save prompt
                showToast('Backtest completed successfully!');
                showSavePrompt();
                
            } catch (error) {
                console.error('Backtest error:', error);
                showToast(error.message || 'Error running backtest', 'error');
            } finally {
                // Reset button state
                backtestBtn.disabled = false;
                backtestBtn.innerHTML = 'Run Backtest';
            }
        });
    }
    
    // Initialize save button
    const saveBtn = document.getElementById('save-strategy');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            if (!globalBacktestHandler?.lastResults) {
                showToast('Please run a backtest first', 'error');
                return;
            }
            const modal = document.getElementById('strategy-modal');
            if (modal) {
                modal.classList.remove('hidden');
            }
        });
    }
    
    // Initialize modal buttons
    const cancelSaveBtn = document.getElementById('cancel-save');
    const confirmSaveBtn = document.getElementById('confirm-save');
    const modal = document.getElementById('strategy-modal');
    
    if (cancelSaveBtn && modal) {
        cancelSaveBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    }
    
    if (confirmSaveBtn && modal) {
        confirmSaveBtn.addEventListener('click', async () => {
            const nameInput = document.getElementById('strategy-name');
            const descInput = document.getElementById('strategy-description');
            
            if (!nameInput.value.trim()) {
                showToast('Please enter a strategy name', 'error');
                return;
            }
            
            if (!globalBacktestHandler?.lastResults) {
                showToast('Please run a backtest first', 'error');
                modal.classList.add('hidden');
                return;
            }
            
            try {
                confirmSaveBtn.disabled = true;
                confirmSaveBtn.innerHTML = 'Saving...';
                
                const result = await globalBacktestHandler.saveStrategy(nameInput.value, descInput.value);
                
                modal.classList.add('hidden');
                showSuccessWithLeaderboardLink(result.strategy_id);
                
            } catch (error) {
                console.error('Save error:', error);
                showToast(error.message || 'Error saving strategy', 'error');
            } finally {
                confirmSaveBtn.disabled = false;
                confirmSaveBtn.innerHTML = 'Save';
            }
        });
    }
    
    // Initialize dropzones with empty state
    document.querySelectorAll('.dropzone').forEach(dropzone => {
        const container = document.createElement('div');
        container.className = 'indicators-container';
        dropzone.appendChild(container);
    });
});

function showSavePrompt() {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-white text-gray-900 px-6 py-4 rounded-lg shadow-xl transform transition-all duration-300 flex items-center space-x-4';
    toast.innerHTML = `
        <div>
            <h4 class="font-medium mb-1">Strategy Tested Successfully!</h4>
            <p class="text-sm text-gray-600">Would you like to save it to the leaderboard?</p>
        </div>
        <button id="save-prompt-btn" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            Save Strategy
        </button>
    `;
    
    document.body.appendChild(toast);
    
    // Add click handler
    toast.querySelector('#save-prompt-btn').addEventListener('click', () => {
        const modal = document.getElementById('strategy-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
        toast.remove();
    });
    
    // Auto remove after 10 seconds
    setTimeout(() => {
        toast.remove();
    }, 10000);
}

function showSuccessWithLeaderboardLink(strategyId) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-white text-gray-900 px-6 py-4 rounded-lg shadow-xl transform transition-all duration-300';
    toast.innerHTML = `
        <div class="mb-3">
            <h4 class="font-medium text-green-600 mb-1">Strategy Saved Successfully!</h4>
            <p class="text-sm text-gray-600">Your strategy has been added to the leaderboard.</p>
        </div>
        <a href="/leaderboard" class="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            View on Leaderboard
        </a>
    `;
    
    document.body.appendChild(toast);
    
    // Auto remove after 10 seconds
    setTimeout(() => {
        toast.remove();
    }, 10000);
} 