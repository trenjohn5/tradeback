const AVAILABLE_INDICATORS = {
    'SMA': {
        name: 'Simple Moving Average',
        params: {
            'Period': { default: 20, type: 'number', min: 1, max: 200 }
        }
    },
    'EMA': {
        name: 'Exponential Moving Average',
        params: {
            'Period': { default: 20, type: 'number', min: 1, max: 200 }
        }
    },
    'RSI': {
        name: 'Relative Strength Index',
        params: {
            'Period': { default: 14, type: 'number', min: 1, max: 100 }
        }
    },
    'MACD': {
        name: 'Moving Average Convergence Divergence',
        params: {
            'Fast Period': { default: 12, type: 'number', min: 1, max: 100 },
            'Slow Period': { default: 26, type: 'number', min: 1, max: 100 },
            'Signal Period': { default: 9, type: 'number', min: 1, max: 100 }
        }
    },
    'BB': {
        name: 'Bollinger Bands',
        params: {
            'Period': { default: 20, type: 'number', min: 1, max: 100 },
            'StdDev': { default: 2, type: 'number', min: 0.1, max: 5, step: 0.1 }
        }
    },
    'STOCH': {
        name: 'Stochastic Oscillator',
        params: {
            'K Period': { default: 14, type: 'number', min: 1, max: 100 },
            'D Period': { default: 3, type: 'number', min: 1, max: 100 }
        }
    },
    'ATR': {
        name: 'Average True Range',
        params: {
            'Period': { default: 14, type: 'number', min: 1, max: 100 }
        }
    },
    'OBV': {
        name: 'On-Balance Volume',
        params: {}
    },
    'VWAP': {
        name: 'Volume Weighted Average Price',
        params: {}
    }
}; 