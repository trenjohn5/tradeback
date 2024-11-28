// Core strategy state management
export class Strategy {
    constructor() {
        this.indicators = [];
        this.entry = [];
        this.exit = [];
    }

    addIndicator(type, params = null) {
        if (this.hasIndicator(type)) {
            throw new Error('This indicator is already added!');
        }

        const indicatorParams = params || this.getDefaultParams(type);
        this.indicators.push({
            type,
            params: indicatorParams
        });
    }

    removeIndicator(type) {
        this.indicators = this.indicators.filter(i => i.type !== type);
    }

    updateIndicatorParams(type, params) {
        const indicator = this.indicators.find(i => i.type === type);
        if (indicator) {
            indicator.params = params;
        }
    }

    hasIndicator(type) {
        return this.indicators.find(i => i.type === type) !== undefined;
    }

    updateEntryConditions(conditions) {
        this.entry = conditions;
    }

    updateExitConditions(conditions) {
        this.exit = conditions;
    }

    clear() {
        this.indicators = [];
        this.entry = [];
        this.exit = [];
    }

    getDefaultParams(type) {
        const defaults = {
            'sma': { Period: 20 },
            'ema': { Period: 20 },
            'rsi': { Period: 14 },
            'macd': { 'Fast Period': 12, 'Slow Period': 26, 'Signal Period': 9 },
            'bb': { 'Period': 20, 'StdDev': 2 },
            'stoch': { 'K Period': 14, 'D Period': 3 },
            'atr': { Period: 14 },
            'obv': {},
            'vwap': {}
        };
        return defaults[type.toLowerCase()] || {};
    }

    getIndicatorName(type) {
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

    toJSON() {
        return {
            indicators: this.indicators,
            entry_conditions: this.entry,
            exit_conditions: this.exit
        };
    }

    validate() {
        if (this.indicators.length === 0) {
            throw new Error('Please add at least one indicator.');
        }
        if (this.entry.length === 0 && this.exit.length === 0) {
            throw new Error('Please add at least one entry or exit condition.');
        }
        return true;
    }
} 