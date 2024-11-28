from flask import Flask, render_template, jsonify, request
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import ta
import os
from flask_sqlalchemy import SQLAlchemy
import uuid

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///strategies.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class Strategy(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    config = db.Column(db.JSON, nullable=False)
    
    # Performance metrics
    total_return = db.Column(db.Float)
    sharpe_ratio = db.Column(db.Float)
    win_rate = db.Column(db.Float)
    risk_adjusted_return = db.Column(db.Float)
    max_drawdown = db.Column(db.Float)
    total_trades = db.Column(db.Integer)
    time_in_market = db.Column(db.Float)

with app.app_context():
    db.create_all()

def calculate_indicators(df, component):
    """Calculate technical indicators based on strategy parameters."""
    if component['type'].lower() == 'sma':
        period = component['params'].get('Period', 20)
        df[f'SMA_{period}'] = ta.trend.sma_indicator(df['Close'], window=period)
    
    elif component['type'].lower() == 'ema':
        period = component['params'].get('Period', 20)
        df[f'EMA_{period}'] = ta.trend.ema_indicator(df['Close'], window=period)
    
    elif component['type'].lower() == 'rsi':
        period = component['params'].get('Period', 14)
        df[f'RSI_{period}'] = ta.momentum.rsi(df['Close'], window=period)
    
    elif component['type'].lower() == 'macd':
        fast_period = component['params'].get('Fast Period', 12)
        slow_period = component['params'].get('Slow Period', 26)
        signal_period = component['params'].get('Signal Period', 9)
        macd = ta.trend.MACD(
            df['Close'], 
            window_fast=fast_period,
            window_slow=slow_period,
            window_sign=signal_period
        )
        df['MACD'] = macd.macd()
        df['MACD_Signal'] = macd.macd_signal()
    
    elif component['type'].lower() == 'bb':  # Bollinger Bands
        period = component['params'].get('Period', 20)
        std_dev = component['params'].get('StdDev', 2)
        indicator_bb = ta.volatility.BollingerBands(
            df['Close'], 
            window=period, 
            window_dev=std_dev
        )
        df['BB_Upper'] = indicator_bb.bollinger_hband()
        df['BB_Middle'] = indicator_bb.bollinger_mavg()
        df['BB_Lower'] = indicator_bb.bollinger_lband()
    
    elif component['type'].lower() == 'stoch':  # Stochastic Oscillator
        k_period = component['params'].get('K Period', 14)
        d_period = component['params'].get('D Period', 3)
        df['Stoch_K'] = ta.momentum.stoch(df['High'], df['Low'], df['Close'], window=k_period, smooth_window=d_period)
        df['Stoch_D'] = ta.momentum.stoch_signal(df['High'], df['Low'], df['Close'], window=k_period, smooth_window=d_period)
    
    elif component['type'].lower() == 'atr':  # Average True Range
        period = component['params'].get('Period', 14)
        df['ATR'] = ta.volatility.average_true_range(df['High'], df['Low'], df['Close'], window=period)
    
    elif component['type'].lower() == 'obv':  # On-Balance Volume
        df['OBV'] = ta.volume.on_balance_volume(df['Close'], df['Volume'])
    
    elif component['type'].lower() == 'vwap':  # Volume Weighted Average Price
        df['VWAP'] = ta.volume.volume_weighted_average_price(
            high=df['High'],
            low=df['Low'],
            close=df['Close'],
            volume=df['Volume']
        )
    
    return df

def evaluate_condition(df, component, i, strategy):
    """Evaluate a single condition at index i."""
    if component['type'] == 'price-level':
        value = component['params'].get('Value', 0)
        condition = component['condition']
        
        if condition == 'crosses-above':
            return i > 0 and df['Close'].iloc[i-1] <= value and df['Close'].iloc[i] > value
        elif condition == 'crosses-below':
            return i > 0 and df['Close'].iloc[i-1] >= value and df['Close'].iloc[i] < value
        elif condition == 'is-above':
            return df['Close'].iloc[i] > value
        elif condition == 'is-below':
            return df['Close'].iloc[i] < value
            
    elif component['type'] == 'indicator-compare':
        indicator = component['indicator']
        condition = component['condition']
        
        # Find the indicator configuration
        ind_config = next((ind for ind in strategy['indicators'] if ind['type'] == indicator), None)
        if not ind_config:
            return False
            
        if indicator == 'sma':
            period = ind_config['params'].get('Period', 20)
            sma_col = f'SMA_{period}'
            
            if condition == 'crosses-above':
                return i > 0 and df['Close'].iloc[i-1] <= df[sma_col].iloc[i-1] and df['Close'].iloc[i] > df[sma_col].iloc[i]
            elif condition == 'crosses-below':
                return i > 0 and df['Close'].iloc[i-1] >= df[sma_col].iloc[i-1] and df['Close'].iloc[i] < df[sma_col].iloc[i]
            elif condition == 'is-above':
                return df['Close'].iloc[i] > df[sma_col].iloc[i]
            elif condition == 'is-below':
                return df['Close'].iloc[i] < df[sma_col].iloc[i]
                
        elif indicator == 'rsi':
            period = ind_config['params'].get('Period', 14)
            rsi_col = f'RSI_{period}'
            overbought = ind_config['params'].get('Overbought', 70)
            oversold = ind_config['params'].get('Oversold', 30)
            
            if condition == 'crosses-above':
                return i > 0 and df[rsi_col].iloc[i-1] <= overbought and df[rsi_col].iloc[i] > overbought
            elif condition == 'crosses-below':
                return i > 0 and df[rsi_col].iloc[i-1] >= oversold and df[rsi_col].iloc[i] < oversold
            elif condition == 'is-above':
                return df[rsi_col].iloc[i] > overbought
            elif condition == 'is-below':
                return df[rsi_col].iloc[i] < oversold
                
        elif indicator == 'macd':
            if condition == 'crosses-above':
                return i > 0 and df['MACD'].iloc[i-1] <= df['MACD_Signal'].iloc[i-1] and df['MACD'].iloc[i] > df['MACD_Signal'].iloc[i]
            elif condition == 'crosses-below':
                return i > 0 and df['MACD'].iloc[i-1] >= df['MACD_Signal'].iloc[i-1] and df['MACD'].iloc[i] < df['MACD_Signal'].iloc[i]
            elif condition == 'is-above':
                return df['MACD'].iloc[i] > df['MACD_Signal'].iloc[i]
            elif condition == 'is-below':
                return df['MACD'].iloc[i] < df['MACD_Signal'].iloc[i]
    
    return False

def evaluate_logic(df, components, i, strategy):
    """Evaluate a list of components with logical operators."""
    if not components:
        return False
        
    result = evaluate_condition(df, components[0], i, strategy)
    
    for j in range(1, len(components), 2):
        if j + 1 >= len(components):
            break
            
        operator = components[j]['type']
        next_condition = evaluate_condition(df, components[j+1], i, strategy)
        
        if operator == 'and':
            result = result and next_condition
        elif operator == 'or':
            result = result or next_condition
            
    return result

def generate_signals(df, strategy):
    """Generate buy/sell signals based on entry and exit conditions."""
    signals = pd.DataFrame(index=df.index)
    signals['signal'] = 0  # 0: no signal, 1: buy, -1: sell
    
    position = 0  # 0: no position, 1: long position
    
    for i in range(len(df)):
        if position == 0:  # Looking for entry
            if evaluate_logic(df, strategy['entry'], i, strategy):
                signals.iloc[i]['signal'] = 1
                position = 1
        else:  # Looking for exit
            if evaluate_logic(df, strategy['exit'], i, strategy):
                signals.iloc[i]['signal'] = -1
                position = 0
    
    return signals

def calculate_risk_metrics(returns, time_in_market_pct):
    """Calculate risk-adjusted performance metrics."""
    # Convert returns to numpy array and remove any NaN
    returns = np.array(returns)
    returns = returns[~np.isnan(returns)]
    
    if len(returns) == 0:
        return {
            'sharpe_ratio': 0,
            'time_in_market': 0,
            'risk_adjusted_return': 0
        }
    
    # Calculate annualized metrics
    risk_free_rate = 0.04  # 4% risk-free rate
    trading_days = 252
    
    excess_returns = returns - (risk_free_rate / trading_days)
    annualized_return = np.mean(returns) * trading_days
    annualized_volatility = np.std(returns) * np.sqrt(trading_days)
    
    # Sharpe Ratio
    sharpe_ratio = 0 if annualized_volatility == 0 else (annualized_return - risk_free_rate) / annualized_volatility
    
    # Risk-adjusted return (considering time in market)
    risk_adjusted_return = annualized_return * (time_in_market_pct / 100) / annualized_volatility if annualized_volatility > 0 else 0
    
    return {
        'sharpe_ratio': round(sharpe_ratio, 2),
        'time_in_market': round(time_in_market_pct, 2),
        'risk_adjusted_return': round(risk_adjusted_return, 2)
    }

def calculate_metrics(df, signals):
    """Calculate backtest performance metrics."""
    position = 0
    trades = []
    returns = []
    days_in_market = 0
    total_days = len(df)
    
    entry_price = None
    for i in range(len(df)):
        if signals['signal'].iloc[i] == 1 and position == 0:  # Buy signal
            position = 1
            entry_price = df['Close'].iloc[i]
            entry_date = df.index[i].strftime('%Y-%m-%d')
            days_in_market += 1
            trades.append({
                'type': 'buy',
                'date': entry_date,
                'price': entry_price
            })
        elif signals['signal'].iloc[i] == -1 and position == 1:  # Sell signal
            position = 0
            exit_price = df['Close'].iloc[i]
            exit_date = df.index[i].strftime('%Y-%m-%d')
            
            # Calculate returns
            trade_return = (exit_price - entry_price) / entry_price
            returns.append(trade_return)
            
            trades.append({
                'type': 'sell',
                'date': exit_date,
                'price': exit_price,
                'pl_absolute': exit_price - entry_price,
                'pl_percentage': trade_return
            })
        elif position == 1:  # Count days in market while holding
            days_in_market += 1
    
    # Calculate time in market percentage
    time_in_market_pct = (days_in_market / total_days) * 100
    
    # Calculate basic metrics
    if not returns:
        return {
            'totalReturn': 0,
            'winRate': 0,
            'maxDrawdown': 0,
            'totalTrades': 0,
            'trades': [],
            'riskMetrics': calculate_risk_metrics([], time_in_market_pct)
        }
    
    total_return = np.prod([1 + r for r in returns]) - 1
    win_rate = sum(1 for r in returns if r > 0) / len(returns)
    
    # Calculate maximum drawdown
    cumulative_returns = np.cumprod([1 + r for r in returns])
    rolling_max = np.maximum.accumulate(cumulative_returns)
    drawdowns = cumulative_returns / rolling_max - 1
    max_drawdown = min(drawdowns)
    
    # Calculate risk-adjusted metrics
    risk_metrics = calculate_risk_metrics(returns, time_in_market_pct)
    
    return {
        'totalReturn': total_return,
        'winRate': win_rate,
        'maxDrawdown': max_drawdown,
        'totalTrades': len(trades),
        'trades': trades,
        'riskMetrics': risk_metrics
    }

def calculate_buy_hold_metrics(df):
    """Calculate metrics for buy and hold strategy."""
    initial_price = df['Close'].iloc[0]
    final_price = df['Close'].iloc[-1]
    total_return = (final_price - initial_price) / initial_price
    
    # Calculate daily returns for risk metrics
    daily_returns = df['Close'].pct_change().dropna().values
    
    # Calculate maximum drawdown
    peak = df['Close'].expanding(min_periods=1).max()
    drawdown = (df['Close'] - peak) / peak
    max_drawdown = drawdown.min()
    
    # Always 100% time in market for buy & hold
    time_in_market_pct = 100
    risk_metrics = calculate_risk_metrics(daily_returns, time_in_market_pct)
    
    return {
        'total_return': round(total_return * 100, 2),
        'max_drawdown': round(max_drawdown * 100, 2),
        'risk_metrics': risk_metrics
    }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/leaderboard')
def leaderboard():
    return render_template('leaderboard.html')

@app.route('/api/fetch-btc-data')
def fetch_btc_data():
    # Fetch Bitcoin data from Yahoo Finance
    btc = yf.Ticker("BTC-USD")
    end_date = datetime.now()
    start_date = end_date - timedelta(days=365)  # Last 1 year of data
    
    df = btc.history(start=start_date, end=end_date, interval='1d')
    
    # Format data for Chart.js
    data = {
        'labels': df.index.strftime('%Y-%m-%d').tolist(),
        'prices': df['Close'].tolist(),
        'volumes': df['Volume'].tolist()
    }
    return jsonify(data)

@app.route('/api/leaderboard')
def get_leaderboard():
    metric = request.args.get('metric', 'total_return')
    
    # Validate metric to prevent SQL injection
    valid_metrics = ['total_return', 'sharpe_ratio', 'win_rate', 'risk_adjusted_return']
    if metric not in valid_metrics:
        return jsonify({'error': 'Invalid metric'}), 400
    
    # Get top 100 strategies sorted by the specified metric
    strategies = Strategy.query.order_by(getattr(Strategy, metric).desc()).limit(100).all()
    
    return jsonify({
        'strategies': [{
            'id': s.id,
            'name': s.name,
            'total_return': s.total_return,
            'sharpe_ratio': s.sharpe_ratio,
            'win_rate': s.win_rate,
            'risk_adjusted_return': s.risk_adjusted_return,
            'max_drawdown': s.max_drawdown,
            'total_trades': s.total_trades,
            'time_in_market': s.time_in_market
        } for s in strategies]
    })

@app.route('/api/strategy/<strategy_id>')
def get_strategy(strategy_id):
    strategy = Strategy.query.get_or_404(strategy_id)
    return jsonify({
        'id': strategy.id,
        'name': strategy.name,
        'config': strategy.config
    })

@app.route('/api/backtest', methods=['POST'])
def backtest():
    try:
        data = request.get_json()
        
        # Validate strategy structure
        if not isinstance(data, dict):
            raise ValueError("Invalid strategy format")
        
        if 'indicators' not in data or not isinstance(data['indicators'], list):
            raise ValueError("Strategy must include indicators array")
            
        if 'entry_conditions' not in data or not isinstance(data['entry_conditions'], list):
            raise ValueError("Strategy must include entry_conditions array")
            
        if 'exit_conditions' not in data or not isinstance(data['exit_conditions'], list):
            raise ValueError("Strategy must include exit_conditions array")

        # Fetch data
        btc = yf.Ticker("BTC-USD")
        end_date = datetime.now()
        start_date = end_date - timedelta(days=365)
        df = btc.history(start=start_date, end=end_date, interval='1d')
        
        # Calculate buy & hold metrics
        buy_hold_metrics = calculate_buy_hold_metrics(df)
        
        # Calculate indicators
        for indicator in data['indicators']:
            df = calculate_indicators(df, indicator)
        
        # Prepare strategy for signal generation
        strategy_formatted = {
            'indicators': data['indicators'],
            'entry': data['entry_conditions'],
            'exit': data['exit_conditions']
        }
        
        # Generate signals
        signals = generate_signals(df, strategy_formatted)
        
        # Calculate metrics
        metrics = calculate_metrics(df, signals)
        
        results = {
            'status': 'success',
            'strategy_metrics': {
                'total_return': round(metrics['totalReturn'] * 100, 2),
                'win_rate': round(metrics['winRate'] * 100, 2),
                'max_drawdown': round(metrics['maxDrawdown'] * 100, 2),
                'total_trades': metrics['totalTrades'],
                'risk_metrics': metrics['riskMetrics']
            },
            'buy_hold_metrics': buy_hold_metrics,
            'trades': metrics['trades']
        }
        
        return jsonify(results)
        
    except ValueError as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 400
    except Exception as e:
        app.logger.error(f"Backtest error: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/save-strategy', methods=['POST'])
def save_strategy():
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('name'):
            raise ValueError("Strategy name is required")
            
        # Run backtest to get metrics
        btc = yf.Ticker("BTC-USD")
        end_date = datetime.now()
        start_date = end_date - timedelta(days=365)
        df = btc.history(start=start_date, end=end_date, interval='1d')
        
        # Calculate indicators
        for indicator in data['indicators']:
            df = calculate_indicators(df, indicator)
        
        # Prepare strategy for signal generation
        strategy_formatted = {
            'indicators': data['indicators'],
            'entry': data['entry_conditions'],
            'exit': data['exit_conditions']
        }
        
        # Generate signals
        signals = generate_signals(df, strategy_formatted)
        
        # Calculate metrics
        metrics = calculate_metrics(df, signals)
        
        # Save strategy to database
        strategy = Strategy(
            name=data['name'],
            description=data.get('description', ''),
            config=data,
            total_return=round(metrics['totalReturn'] * 100, 2),
            sharpe_ratio=metrics['riskMetrics']['sharpe_ratio'],
            win_rate=round(metrics['winRate'] * 100, 2),
            risk_adjusted_return=metrics['riskMetrics']['risk_adjusted_return'],
            max_drawdown=round(metrics['maxDrawdown'] * 100, 2),
            total_trades=metrics['totalTrades'],
            time_in_market=metrics['riskMetrics']['time_in_market']
        )
        
        db.session.add(strategy)
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'message': 'Strategy saved successfully',
            'strategy_id': strategy.id
        })
        
    except ValueError as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 400
    except Exception as e:
        app.logger.error(f"Save strategy error: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    # Use environment variable for port if available (production), otherwise use 5000 (local)
    port = int(os.environ.get('PORT', 5000))
    # In development, use debug mode and localhost
    if os.environ.get('FLASK_ENV') == 'production':
        app.run(host='0.0.0.0', port=port)
    else:
        app.run(debug=True, port=port) 