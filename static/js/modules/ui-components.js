import { Strategy } from './strategy.js';

// UI Component creation and management
export function createIndicatorCard(type, params, onDelete, onChange) {
    const card = document.createElement('div');
    card.className = 'condition-card bg-white p-4 rounded-lg shadow mb-4';
    card.dataset.type = type;
    card.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <span class="font-medium text-gray-900">${getIndicatorName(type)}</span>
            <button class="delete-component text-gray-400 hover:text-gray-600">×</button>
        </div>
        ${createParamsHTML(params)}
    `;

    // Add delete handler
    card.querySelector('.delete-component').addEventListener('click', onDelete);

    // Add parameter change handlers
    card.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', onChange);
    });

    return card;
}

export function createConditionCard(type, preset = null, indicators = [], onDelete, onChange) {
    const card = document.createElement('div');
    card.className = 'condition-card bg-white p-4 rounded-lg shadow mb-4';
    card.dataset.type = type;

    if (type === 'indicator-compare') {
        card.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <span class="font-medium text-gray-900">Indicator Condition</span>
                <button class="delete-component text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div class="space-y-2">
                <select class="indicator-select w-full text-sm border rounded p-2 bg-white">
                    ${indicators.map(ind => `
                        <option value="${ind.type}" ${preset && preset.indicator === ind.type ? 'selected' : ''}>
                            ${getIndicatorName(ind.type)}
                        </option>
                    `).join('')}
                </select>
                <select class="condition-select w-full text-sm border rounded p-2 bg-white">
                    <option value="crosses-above" ${preset && preset.condition === 'crosses-above' ? 'selected' : ''}>Crosses Above</option>
                    <option value="crosses-below" ${preset && preset.condition === 'crosses-below' ? 'selected' : ''}>Crosses Below</option>
                    <option value="is-above" ${preset && preset.condition === 'is-above' ? 'selected' : ''}>Is Above</option>
                    <option value="is-below" ${preset && preset.condition === 'is-below' ? 'selected' : ''}>Is Below</option>
                </select>
                <div class="relative">
                    <input type="number" name="value" placeholder="Enter value" step="any"
                           class="w-full text-sm border rounded p-2 bg-white"
                           value="${preset ? preset.value : ''}">
                </div>
            </div>
        `;
    } else if (type === 'price-level') {
        card.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <span class="font-medium text-gray-900">Price Level</span>
                <button class="delete-component text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div class="space-y-2">
                <select class="condition-select w-full text-sm border rounded p-2 bg-white">
                    <option value="crosses-above" ${preset && preset.condition === 'crosses-above' ? 'selected' : ''}>Crosses Above</option>
                    <option value="crosses-below" ${preset && preset.condition === 'crosses-below' ? 'selected' : ''}>Crosses Below</option>
                    <option value="is-above" ${preset && preset.condition === 'is-above' ? 'selected' : ''}>Is Above</option>
                    <option value="is-below" ${preset && preset.condition === 'is-below' ? 'selected' : ''}>Is Below</option>
                </select>
                <div class="relative">
                    <span class="absolute left-3 top-2 text-gray-500">$</span>
                    <input type="number" name="price" placeholder="Enter price level" step="any"
                           class="w-full text-sm border rounded p-2 pl-6 bg-white"
                           value="${preset ? preset.price : ''}">
                </div>
            </div>
        `;
    }

    // Add delete handler
    card.querySelector('.delete-component').addEventListener('click', onDelete);

    // Add change handlers
    card.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', onChange);
    });

    return card;
}

export function createDropzoneContent(type) {
    return `
        <div class="flex flex-col items-center justify-center h-full">
            <p class="text-gray-400 text-sm text-center">Drop your ${type} conditions here</p>
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
}

export function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const bgColor = type === 'error' ? 'bg-red-600' : 'bg-gray-800';
    toast.className = `fixed bottom-4 right-4 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg transform transition-all duration-300`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
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

function getIndicatorName(type) {
    const names = {
        'sma': 'Simple Moving Average',
        'ema': 'Exponential Moving Average',
        'rsi': 'Relative Strength Index',
        'macd': 'MACD',
        'bb': 'Bollinger Bands',
        'stoch': 'Stochastic Oscillator',
        'atr': 'Average True Range',
        'obv': 'On-Balance Volume',
        'vwap': 'Volume Weighted Average Price'
    };
    return names[type.toLowerCase()] || type.toUpperCase();
}

// Initialize drag and drop functionality
export function initializeDragAndDrop(strategy) {
    const draggables = document.querySelectorAll('.draggable');
    const indicatorsDropzone = document.getElementById('active-indicators');
    const entryDropzone = document.getElementById('entry-dropzone');
    const exitDropzone = document.getElementById('exit-dropzone');
    
    // Initialize drag and drop for indicators
    draggables.forEach(draggable => {
        draggable.addEventListener('dragstart', (e) => handleDragStart(e, strategy));
        draggable.addEventListener('dragend', handleDragEnd);
    });

    [indicatorsDropzone, entryDropzone, exitDropzone].forEach(dropzone => {
        if (dropzone) {
            dropzone.addEventListener('dragover', handleDragOver);
            dropzone.addEventListener('dragleave', handleDragLeave);
            dropzone.addEventListener('drop', (e) => handleDrop(e, strategy));
            
            // Initialize condition buttons
            if (dropzone.id === 'entry-dropzone' || dropzone.id === 'exit-dropzone') {
                initializeConditionButtons(dropzone, strategy);
            }
        }
    });
}

function handleDragStart(e, strategy) {
    e.dataTransfer.setData('text/plain', e.target.dataset.type);
    e.target.classList.add('dragging');
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.dropzone, #active-indicators').forEach(dropzone => {
        dropzone.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    e.preventDefault();
    const dropzone = e.currentTarget;
    if (!dropzone.classList.contains('drag-over')) {
        dropzone.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    const dropzone = e.currentTarget;
    dropzone.classList.remove('drag-over');
}

function handleDrop(e, strategy) {
    e.preventDefault();
    const dropzone = e.currentTarget;
    dropzone.classList.remove('drag-over');

    // Clear the placeholder text if it exists
    const placeholder = dropzone.querySelector('p.text-gray-400');
    if (placeholder) {
        placeholder.remove();
    }

    const type = e.dataTransfer.getData('text/plain');
    
    try {
        strategy.addIndicator(type);
        const card = createIndicatorCard(
            type, 
            strategy.getDefaultParams(type),
            () => {
                strategy.removeIndicator(type);
                card.remove();
                
                // Add back placeholder if no indicators
                if (!dropzone.querySelector('.condition-card')) {
                    dropzone.innerHTML = '<p class="text-gray-400 text-sm italic">Drop your indicators here</p>';
                }
            },
            () => {
                // Handle parameter changes
                const params = {};
                card.querySelectorAll('input').forEach(input => {
                    params[input.name] = parseFloat(input.value);
                });
                strategy.updateIndicatorParams(type, params);
            }
        );
        
        dropzone.appendChild(card);
        showToast(`Added ${strategy.getIndicatorName(type)}`);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function initializeConditionButtons(dropzone, strategy) {
    const addIndicatorBtn = dropzone.querySelector('.add-condition-btn');
    const addPriceBtn = dropzone.querySelector('.add-price-btn');
    
    if (addIndicatorBtn) {
        addIndicatorBtn.addEventListener('click', () => {
            if (strategy.indicators.length === 0) {
                showToast('Please add at least one indicator first', 'error');
                return;
            }
            
            const card = createConditionCard(
                'indicator-compare',
                null,
                strategy.indicators,
                () => {
                    card.remove();
                    updateConditions(dropzone, strategy);
                    if (!dropzone.querySelector('.condition-card')) {
                        dropzone.innerHTML = createDropzoneContent(dropzone.id === 'entry-dropzone' ? 'entry' : 'exit');
                        initializeConditionButtons(dropzone, strategy);
                    }
                },
                () => updateConditions(dropzone, strategy)
            );
            
            // Clear placeholder content if it exists
            const placeholder = dropzone.querySelector('.flex.flex-col');
            if (placeholder) {
                dropzone.innerHTML = '';
            }
            
            dropzone.appendChild(card);
            updateConditions(dropzone, strategy);
        });
    }
    
    if (addPriceBtn) {
        addPriceBtn.addEventListener('click', () => {
            const card = createConditionCard(
                'price-level',
                null,
                [],
                () => {
                    card.remove();
                    updateConditions(dropzone, strategy);
                    if (!dropzone.querySelector('.condition-card')) {
                        dropzone.innerHTML = createDropzoneContent(dropzone.id === 'entry-dropzone' ? 'entry' : 'exit');
                        initializeConditionButtons(dropzone, strategy);
                    }
                },
                () => updateConditions(dropzone, strategy)
            );
            
            // Clear placeholder content if it exists
            const placeholder = dropzone.querySelector('.flex.flex-col');
            if (placeholder) {
                dropzone.innerHTML = '';
            }
            
            dropzone.appendChild(card);
            updateConditions(dropzone, strategy);
        });
    }
}

export function updateConditions(dropzone, strategy) {
    const conditions = Array.from(dropzone.querySelectorAll('.condition-card')).map(card => {
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

    if (dropzone.id === 'entry-dropzone') {
        strategy.updateEntryConditions(conditions);
    } else if (dropzone.id === 'exit-dropzone') {
        strategy.updateExitConditions(conditions);
    }
} 