from flask import Flask, render_template, jsonify, request
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import ta
import os
from flask_sqlalchemy import SQLAlchemy
import uuid
from backtest import (
    calculate_indicators,
    evaluate_condition,
    evaluate_logic,
    generate_signals,
    calculate_risk_metrics,
    calculate_metrics
)

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
    trades = db.Column(db.JSON)
    
    # Performance metrics
    total_return = db.Column(db.Float)
    sharpe_ratio = db.Column(db.Float)
    win_rate = db.Column(db.Float)
    risk_adjusted_return = db.Column(db.Float)
    max_drawdown = db.Column(db.Float)
    total_trades = db.Column(db.Integer)
    time_in_market = db.Column(db.Float)

def init_db():
    with app.app_context():
        # Drop all tables
        db.drop_all()
        
        # Create all tables
        db.create_all()
        
        app.logger.info("Database initialized successfully")

# Initialize database on startup
init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/leaderboard')
def leaderboard():
    return render_template('leaderboard.html')

@app.route('/api/backtest', methods=['POST'])
def backtest():
    try:
        data = request.get_json()
        app.logger.info(f"Received backtest request with data: {data}")
        
        # Get timeframe parameters from the request
        timeframe = data.get('timeframe', {})
        period = timeframe.get('period', '1y')
        interval = timeframe.get('interval', '1d')
        
        app.logger.info(f"Using timeframe: period={period}, interval={interval}")
        
        # Download data
        df = yf.download(
            'BTC-USD',
            period=period,
            interval=interval,
            progress=False
        )
        
        if df.empty:
            raise ValueError("No data available for the specified timeframe")
        
        app.logger.info(f"Downloaded {len(df)} data points")
        
        # Calculate indicators
        for indicator in data['indicators']:
            app.logger.info(f"Calculating indicator: {indicator}")
            df = calculate_indicators(df, indicator)
        
        # Generate signals
        app.logger.info("Generating signals...")
        signals = generate_signals(df, data)
        
        # Calculate strategy metrics
        app.logger.info("Calculating strategy metrics...")
        strategy_results = calculate_metrics(df, signals, interval)
        
        # Calculate buy & hold metrics
        app.logger.info("Calculating buy & hold metrics...")
        buy_hold_return = ((df['Close'].iloc[-1] - df['Close'].iloc[0]) / df['Close'].iloc[0]) * 100
        
        # Calculate buy & hold drawdown
        buy_hold_prices = df['Close']
        buy_hold_peaks = buy_hold_prices.expanding(min_periods=1).max()
        buy_hold_drawdowns = ((buy_hold_prices - buy_hold_peaks) / buy_hold_peaks) * 100
        buy_hold_max_drawdown = abs(buy_hold_drawdowns.min())
        
        # Calculate buy & hold risk metrics
        buy_hold_returns = df['Close'].pct_change().dropna().values
        buy_hold_risk_metrics = calculate_risk_metrics(buy_hold_returns, 100, trading_days_multiplier=252)
        
        # Combine results
        results = {
            'strategy_metrics': strategy_results,
            'buy_hold_metrics': {
                'total_return': round(buy_hold_return, 2),
                'max_drawdown': round(buy_hold_max_drawdown, 2),
                'risk_metrics': buy_hold_risk_metrics
            },
            'timeframe': {
                'period': period,
                'interval': interval,
                'start_date': df.index[0].strftime('%Y-%m-%d'),
                'end_date': df.index[-1].strftime('%Y-%m-%d')
            }
        }
        
        app.logger.info(f"Backtest completed successfully. Results: {results}")
        return jsonify(results)
        
    except ValueError as e:
        app.logger.error(f"Validation error in backtest: {str(e)}")
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
        app.logger.info(f"Received save strategy request")
        
        # Create new strategy
        strategy = Strategy(
            name=data['name'],
            description=data.get('description', ''),
            config=data['config']
        )
        
        # Add trades if available
        if 'trades' in data:
            app.logger.info(f"Saving {len(data['trades'])} trades")
            strategy.trades = data['trades']
        
        # Add performance metrics
        metrics = data['metrics']
        strategy.total_return = metrics['total_return']
        strategy.sharpe_ratio = metrics['sharpe_ratio']
        strategy.win_rate = metrics['win_rate']
        strategy.risk_adjusted_return = metrics['risk_adjusted_return']
        strategy.max_drawdown = metrics['max_drawdown']
        strategy.total_trades = metrics['total_trades']
        strategy.time_in_market = metrics['time_in_market']
        
        # Add buy & hold metrics to config
        strategy.config['buy_hold_metrics'] = data.get('buy_hold_metrics', {
            'total_return': 0,
            'max_drawdown': 0,
            'risk_metrics': {
                'sharpe_ratio': 0,
                'risk_adjusted_return': 0
            }
        })
        
        app.logger.info("Saving strategy to database...")
        db.session.add(strategy)
        db.session.commit()
        app.logger.info(f"Strategy saved successfully with ID: {strategy.id}")
        
        return jsonify({
            'status': 'success',
            'strategy_id': strategy.id
        })
        
    except Exception as e:
        app.logger.error(f"Save strategy error: {str(e)}", exc_info=True)
        db.session.rollback()  # Rollback on error
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/strategy/<strategy_id>', methods=['GET'])
def get_strategy(strategy_id):
    try:
        strategy = Strategy.query.get(strategy_id)
        if not strategy:
            return jsonify({
                'status': 'error',
                'message': 'Strategy not found'
            }), 404
            
        return jsonify({
            'id': strategy.id,
            'name': strategy.name,
            'description': strategy.description,
            'config': strategy.config,
            'trades': strategy.trades,
            'metrics': {
                'total_return': strategy.total_return,
                'sharpe_ratio': strategy.sharpe_ratio,
                'win_rate': strategy.win_rate,
                'risk_adjusted_return': strategy.risk_adjusted_return,
                'max_drawdown': strategy.max_drawdown,
                'total_trades': strategy.total_trades,
                'time_in_market': strategy.time_in_market,
                'buy_hold_metrics': strategy.config.get('buy_hold_metrics', {
                    'total_return': 0,
                    'max_drawdown': 0,
                    'risk_metrics': {
                        'sharpe_ratio': 0,
                        'risk_adjusted_return': 0
                    }
                })
            }
        })
        
    except Exception as e:
        app.logger.error(f"Get strategy error: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/fetch-btc-data')
def fetch_btc_data():
    try:
        period = request.args.get('period', '1y')
        interval = request.args.get('interval', '1d')
        
        # Download data
        df = yf.download(
            'BTC-USD',
            period=period,
            interval=interval,
            progress=False
        )
        
        if df.empty:
            return jsonify({
                'status': 'error',
                'message': 'No data available for the specified timeframe'
            })

        # Format dates and prices for the chart
        dates = df.index.strftime('%Y-%m-%d').tolist()
        prices = df['Close'].tolist()

        return jsonify({
            'status': 'success',
            'labels': dates,
            'prices': prices
        })
        
    except Exception as e:
        app.logger.error(f"Error fetching BTC data: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/leaderboard')
def get_leaderboard():
    try:
        # Get sort metric from query params, default to total_return
        sort_metric = request.args.get('metric', 'total_return')
        
        # Map metric names to model attributes
        metric_map = {
            'total_return': Strategy.total_return,
            'sharpe_ratio': Strategy.sharpe_ratio,
            'win_rate': Strategy.win_rate,
            'risk_adjusted_return': Strategy.risk_adjusted_return,
            'max_drawdown': Strategy.max_drawdown,
            'total_trades': Strategy.total_trades,
            'time_in_market': Strategy.time_in_market
        }
        
        # Get sort attribute, default to total_return if invalid metric provided
        sort_attr = metric_map.get(sort_metric, Strategy.total_return)
        
        # Query strategies ordered by the selected metric
        strategies = Strategy.query.order_by(sort_attr.desc()).all()
        
        # Format response
        response = []
        for strategy in strategies:
            response.append({
                'id': strategy.id,
                'name': strategy.name,
                'description': strategy.description,
                'created_at': strategy.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'metrics': {
                    'total_return': strategy.total_return,
                    'sharpe_ratio': strategy.sharpe_ratio,
                    'win_rate': strategy.win_rate,
                    'risk_adjusted_return': strategy.risk_adjusted_return,
                    'max_drawdown': strategy.max_drawdown,
                    'total_trades': strategy.total_trades,
                    'time_in_market': strategy.time_in_market
                },
                'config': strategy.config
            })
        
        return jsonify({
            'status': 'success',
            'strategies': response
        })
        
    except Exception as e:
        app.logger.error(f"Error fetching leaderboard: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5000))) 