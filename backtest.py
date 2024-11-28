import pandas as pd
import numpy as np
import ta
from datetime import datetime, timedelta

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
            if evaluate_logic(df, strategy['entry_conditions'], i, strategy):
                signals.iloc[i]['signal'] = 1
                position = 1
        else:  # Looking for exit
            if evaluate_logic(df, strategy['exit_conditions'], i, strategy):
                signals.iloc[i]['signal'] = -1
                position = 0
    
    return signals

def calculate_risk_metrics(returns, time_in_market_pct, trading_days_multiplier=252):
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
    
    excess_returns = returns - (risk_free_rate / trading_days_multiplier)
    annualized_return = np.mean(returns) * trading_days_multiplier
    annualized_volatility = np.std(returns) * np.sqrt(trading_days_multiplier)
    
    # Sharpe Ratio
    sharpe_ratio = 0 if annualized_volatility == 0 else (annualized_return - risk_free_rate) / annualized_volatility
    
    # Risk-adjusted return (considering time in market)
    risk_adjusted_return = annualized_return * (time_in_market_pct / 100) / annualized_volatility if annualized_volatility > 0 else 0
    
    return {
        'sharpe_ratio': round(sharpe_ratio, 2),
        'time_in_market': round(time_in_market_pct, 2),
        'risk_adjusted_return': round(risk_adjusted_return, 2)
    }

def calculate_metrics(df, signals, interval):
    """Calculate backtest performance metrics."""
    position = 0
    trades = []
    returns = []
    days_in_market = 0
    total_days = len(df)
    
    # Determine trading days multiplier based on interval
    trading_days_multiplier = {
        '1d': 252,  # Daily
        '1wk': 52,  # Weekly
        '1mo': 12,  # Monthly
    }.get(interval, 252)  # Default to daily if interval not recognized
    
    entry_price = None
    entry_date = None
    
    # Iterate through the entire dataset
    for i in range(len(df)):
        if signals['signal'].iloc[i] == 1 and position == 0:  # Buy signal
            position = 1
            entry_price = df['Close'].iloc[i]
            entry_date = df.index[i].strftime('%Y-%m-%d')
            days_in_market += 1
        elif signals['signal'].iloc[i] == -1 and position == 1:  # Sell signal
            exit_price = df['Close'].iloc[i]
            exit_date = df.index[i].strftime('%Y-%m-%d')
            
            # Calculate trade return
            trade_return = (exit_price - entry_price) / entry_price
            returns.append(trade_return)
            
            trades.append({
                'entry_date': entry_date,
                'entry_price': round(entry_price, 2),
                'exit_date': exit_date,
                'exit_price': round(exit_price, 2),
                'return': round(trade_return * 100, 2)
            })
            
            position = 0
            entry_price = None
            entry_date = None
        elif position == 1:  # In position
            days_in_market += 1
    
    # Close any open position at the end
    if position == 1:
        exit_price = df['Close'].iloc[-1]
        exit_date = df.index[-1].strftime('%Y-%m-%d')
        trade_return = (exit_price - entry_price) / entry_price
        returns.append(trade_return)
        
        trades.append({
            'entry_date': entry_date,
            'entry_price': round(entry_price, 2),
            'exit_date': exit_date,
            'exit_price': round(exit_price, 2),
            'return': round(trade_return * 100, 2)
        })
    
    # Calculate metrics
    total_return = sum(returns) * 100 if returns else 0
    win_rate = (sum(1 for r in returns if r > 0) / len(returns) * 100) if returns else 0
    
    # Calculate maximum drawdown
    cumulative_returns = np.cumprod(np.array(returns) + 1)
    running_max = np.maximum.accumulate(cumulative_returns)
    drawdowns = (cumulative_returns - running_max) / running_max
    max_drawdown = abs(min(drawdowns)) * 100 if len(drawdowns) > 0 else 0
    
    # Calculate time in market
    time_in_market_pct = (days_in_market / total_days) * 100 if total_days > 0 else 0
    
    # Calculate risk metrics with appropriate trading days multiplier
    risk_metrics = calculate_risk_metrics(returns, time_in_market_pct, trading_days_multiplier)
    
    return {
        'total_return': round(total_return, 2),
        'win_rate': round(win_rate, 2),
        'max_drawdown': round(max_drawdown, 2),
        'total_trades': len(trades),
        'trades': trades,
        'sharpe_ratio': risk_metrics['sharpe_ratio'],
        'time_in_market': risk_metrics['time_in_market'],
        'risk_adjusted_return': risk_metrics['risk_adjusted_return']
    } 