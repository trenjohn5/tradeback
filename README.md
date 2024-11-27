# TradeBack - Bitcoin Strategy Backtester

A web-based platform for building and backtesting Bitcoin trading strategies using technical indicators. Built with Flask, Chart.js, and Yahoo Finance data.

## Features

- Drag-and-drop strategy builder
- Real-time Bitcoin price chart
- Technical indicators (SMA, RSI, MACD)
- Performance metrics (Total Return, Win Rate, Max Drawdown)
- Trade visualization

## Setup

1. Clone the repository:
```bash
git clone [repository-url]
cd tradeback
```

2. Create a virtual environment and activate it:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Run the application:
```bash
python app.py
```

5. Open your browser and navigate to:
```
http://localhost:5000
```

## Usage

1. The main interface shows a strategy builder on the left and a price chart on the right.
2. Drag technical indicators from the Components section to the Strategy section.
3. Adjust the parameters for each indicator as needed.
4. Click "Run Backtest" to simulate your strategy.
5. View the results in the performance metrics section and on the price chart.

## Technical Indicators

### Simple Moving Average (SMA)
- Generates buy signals when price crosses above SMA
- Generates sell signals when price crosses below SMA
- Configurable period

### Relative Strength Index (RSI)
- Generates buy signals when RSI crosses below oversold level
- Generates sell signals when RSI crosses above overbought level
- Configurable period and levels

### MACD (Moving Average Convergence Divergence)
- Generates buy signals when MACD line crosses above signal line
- Generates sell signals when MACD line crosses below signal line
- Configurable fast, slow, and signal periods

## License

MIT License 