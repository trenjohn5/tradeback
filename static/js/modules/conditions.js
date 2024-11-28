import Strategy from './strategy.js';

// Condition parsing and validation
export function parseConditions(dropzone) {
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

export function generateRulesPreview(conditions) {
    if (!conditions.length) return '';
    
    const strategy = new Strategy();  // Temporary instance for name lookup
    return conditions.map(cond => {
        if (cond.type === 'indicator-compare') {
            return `${strategy.getIndicatorName(cond.indicator)} ${cond.condition.replace('-', ' ')} ${cond.value}`;
        } else if (cond.type === 'price-level') {
            return `Price ${cond.condition.replace('-', ' ')} $${cond.price}`;
        }
        return '';
    }).join('\nAND\n');
} 