import Strategy from './modules/strategy.js';
import { BacktestHandler } from './modules/backtest.js';
import { createIndicatorCard, createConditionCard, createDropzoneContent, showToast } from './modules/ui-components.js';
import { parseConditions, generateRulesPreview } from './modules/conditions.js';
import { getQueryParam, removeQueryParam } from './modules/utils.js';

document.addEventListener('DOMContentLoaded', function() {
    // Initialize core objects
    const strategy = new Strategy();
    const backtestHandler = new BacktestHandler(strategy);

    // Initialize UI elements
    const activeIndicatorsEl = document.getElementById('active-indicators');
    const entryDropzone = document.getElementById('entry-dropzone');
    const exitDropzone = document.getElementById('exit-dropzone');
    const strategyPreview = document.getElementById('strategy-preview');
    const clearBtn = document.getElementById('clear-strategy');
    const runBacktestBtn = document.getElementById('run-backtest');

    // Initialize dropzones
    [activeIndicatorsEl, entryDropzone, exitDropzone].forEach(el => {
        el.classList.add('dropzone');
        initializeDropzone(el);
    });

    // Initialize draggable indicators
    initializeDraggableIndicators();

    // Check for strategy ID in URL
    const strategyId = getQueryParam('strategy');
    if (strategyId) {
        loadStrategyFromId(strategyId);
    }

    // Event Handlers
    clearBtn?.addEventListener('click', () => {
        if (!confirm('Are you sure you want to clear your strategy?')) return;
        strategy.clear();
        updateUI();
    });

    runBacktestBtn?.addEventListener('click', async () => {
        try {
            const timeframePeriod = document.getElementById('timeframe-period').value;
            const timeframeInterval = document.getElementById('timeframe-interval').value;
            
            const results = await backtestHandler.runBacktest(timeframePeriod, timeframeInterval);
            
            // Update UI with results
            backtestHandler.updateMetricsDisplay(results);
            backtestHandler.updateTradeHistory(results.strategy_metrics.trades);
            backtestHandler.updateComparisonDisplay(results);
            
            // Show save prompt
            showSavePrompt();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });

    function initializeDropzone(zone) {
        zone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        zone.addEventListener('dragleave', (e) => {
            if (e.target === zone) {
                zone.classList.remove('drag-over');
            }
        });

        zone.addEventListener('drop', handleDrop);
    }

    function initializeDraggableIndicators() {
        document.querySelectorAll('.draggable[data-type]').forEach(indicator => {
            indicator.draggable = true;
            indicator.addEventListener('dragstart', (e) => {
                e.target.classList.add('opacity-50');
                e.dataTransfer.setData('text/plain', e.target.dataset.type);
            });
            
            indicator.addEventListener('dragend', (e) => {
                e.target.classList.remove('opacity-50');
            });
        });
    }

    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const zone = e.currentTarget;
        zone.classList.remove('drag-over');
        
        const type = e.dataTransfer.getData('text/plain');
        
        if (zone === activeIndicatorsEl) {
            try {
                strategy.addIndicator(type);
                updateUI();
                showToast('Indicator added successfully!');
            } catch (error) {
                showToast(error.message, 'error');
            }
        }
    }

    function updateUI() {
        // Update indicators
        if (strategy.indicators.length === 0) {
            activeIndicatorsEl.innerHTML = '<p class="text-gray-400 text-sm italic">Drop your indicators here</p>';
        } else {
            activeIndicatorsEl.innerHTML = '';
            strategy.indicators.forEach(ind => {
                const card = createIndicatorCard(
                    ind.type,
                    ind.params,
                    () => {
                        strategy.removeIndicator(ind.type);
                        updateUI();
                    },
                    updateUI
                );
                activeIndicatorsEl.appendChild(card);
            });
        }

        // Update entry/exit dropzones
        [
            { el: entryDropzone, type: 'entry' },
            { el: exitDropzone, type: 'exit' }
        ].forEach(({ el, type }) => {
            if (!el.querySelector('.condition-card')) {
                el.innerHTML = createDropzoneContent(type);
                initializeConditionButtons(el);
            }
        });

        // Update strategy preview
        updateStrategyPreview();
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

    function initializeConditionButtons(dropzone) {
        dropzone.querySelector('.add-condition-btn')?.addEventListener('click', () => {
            if (strategy.indicators.length === 0) {
                showToast('Please add some indicators first!');
                return;
            }
            addCondition(dropzone, 'indicator-compare');
        });

        dropzone.querySelector('.add-price-btn')?.addEventListener('click', () => {
            addCondition(dropzone, 'price-level');
        });
    }

    function addCondition(dropzone, type) {
        // Clear placeholder if present
        const placeholder = dropzone.querySelector('.flex.flex-col');
        if (placeholder) {
            dropzone.innerHTML = '';
        }

        const card = createConditionCard(
            type,
            null,
            strategy.indicators,
            () => {
                if (!dropzone.querySelector('.condition-card')) {
                    dropzone.innerHTML = createDropzoneContent(dropzone.id === 'entry-dropzone' ? 'entry' : 'exit');
                    initializeConditionButtons(dropzone);
                }
                updateUI();
            },
            updateUI
        );

        dropzone.appendChild(card);
        updateUI();
    }

    function showSavePrompt() {
        const savePrompt = document.createElement('div');
        savePrompt.className = 'fixed bottom-4 right-4 bg-white text-gray-900 px-6 py-4 rounded-lg shadow-xl border border-gray-200 flex items-center space-x-4';
        savePrompt.innerHTML = `
            <div class="flex-1">
                <p class="font-medium">Strategy tested successfully!</p>
                <p class="text-sm text-gray-600 mt-1">Would you like to save this strategy to the leaderboard?</p>
            </div>
            <div class="flex space-x-2">
                <button class="px-3 py-1 text-sm text-gray-600 hover:text-gray-800" onclick="this.closest('div.fixed').remove()">
                    No thanks
                </button>
                <button id="save-strategy-btn" class="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                    Save Strategy
                </button>
            </div>
        `;
        document.body.appendChild(savePrompt);

        document.getElementById('save-strategy-btn').addEventListener('click', () => {
            savePrompt.remove();
            showSaveModal();
        });

        setTimeout(() => {
            if (document.body.contains(savePrompt)) {
                savePrompt.remove();
            }
        }, 10000);
    }

    function showSaveModal() {
        const modal = document.getElementById('strategy-modal');
        const nameInput = document.getElementById('strategy-name');
        const descInput = document.getElementById('strategy-description');
        modal.classList.remove('hidden');
        nameInput.focus();

        document.getElementById('cancel-save').onclick = () => {
            modal.classList.add('hidden');
            nameInput.value = '';
            descInput.value = '';
        };

        document.getElementById('confirm-save').onclick = async () => {
            const name = nameInput.value.trim();
            if (!name) {
                showToast('Please enter a strategy name');
                return;
            }

            try {
                await backtestHandler.saveStrategy(name, descInput.value.trim());
                modal.classList.add('hidden');
                showToast('Strategy saved successfully!');
                window.location.href = '/leaderboard';
            } catch (error) {
                showToast(error.message, 'error');
            }
        };
    }

    async function loadStrategyFromId(id) {
        try {
            const response = await fetch(`/api/strategy/${id}`);
            const data = await response.json();
            
            if (data.config) {
                strategy.clear();
                
                // Load indicators
                data.config.indicators.forEach(indicator => {
                    strategy.addIndicator(indicator.type, indicator.params);
                });

                // Load conditions
                strategy.updateEntryConditions(data.config.entry_conditions);
                strategy.updateExitConditions(data.config.exit_conditions);
                
                updateUI();
                showToast('Strategy loaded successfully!');
                removeQueryParam('strategy');
            }
        } catch (error) {
            showToast('Error loading strategy', 'error');
        }
    }
}); 