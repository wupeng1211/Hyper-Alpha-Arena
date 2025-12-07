# Prompt Variables Reference

This document lists all available variables you can use in your prompt templates.

---

## Required Variable

| Variable | Description |
|----------|-------------|
| `{output_format}` | **MUST INCLUDE** - JSON output schema and format requirements. Ensures AI returns valid, parseable JSON. |

---

## Basic Variables (All Templates)

| Variable | Description | Example |
|----------|-------------|---------|
| `{trading_environment}` | Current trading mode description | "Platform: Hyperliquid Perpetual Contracts \| Environment: MAINNET" |
| `{available_cash}` | Available cash (formatted USD) | "$10,000.00" |
| `{total_account_value}` | Total account value (formatted USD) | "$12,500.00" |
| `{market_prices}` | Current prices for all symbols (readable format) | "BTC: $50,000.00\nETH: $3,000.00" |
| `{news_section}` | Latest crypto news summary | "Bitcoin ETF inflows reach..." |
| `{max_leverage}` | Maximum allowed leverage | "10" |

---

## Session Variables (Pro Template)

| Variable | Description | Example |
|----------|-------------|---------|
| `{runtime_minutes}` | Minutes since trading started | "120" |
| `{current_time_utc}` | Current UTC timestamp | "2025-01-15T08:30:00Z" |
| `{total_return_percent}` | Total return percentage | "+5.25" |

---

## Portfolio Variables (Pro Template)

| Variable | Description | Example |
|----------|-------------|---------|
| `{holdings_detail}` | Detailed holdings with quantity, cost, value | "BTC: 0.5 units @ $48,000 avg (current value: $25,000)" |
| `{sampling_data}` | Intraday price series for all symbols | Multi-line price history data |
| `{margin_info}` | Margin mode information (Hyperliquid only) | "Margin Mode: Cross margin" |

---

## Hyperliquid Variables (Real Trading)

| Variable | Description | Example |
|----------|-------------|---------|
| `{environment}` | Trading environment | "mainnet" or "testnet" |
| `{total_equity}` | Total equity in USDC | "$10,500.00" |
| `{available_balance}` | Available balance for trading | "$8,000.00" |
| `{used_margin}` | Margin currently in use | "$2,500.00" |
| `{margin_usage_percent}` | Margin usage percentage | "23.8" |
| `{maintenance_margin}` | Maintenance margin requirement | "$500.00" |
| `{positions_detail}` | Detailed open positions with leverage, liquidation price, PnL | Full position breakdown |
| `{recent_trades_summary}` | Recent closed trades history | Last 5 closed positions |
| `{default_leverage}` | Default leverage setting | "3" |
| `{real_trading_warning}` | Risk warning message | "REAL MONEY TRADING - All decisions execute on live markets" |
| `{operational_constraints}` | Trading constraints and risk rules | Position size limits, margin rules |
| `{leverage_constraints}` | Leverage-specific constraints | "Leverage range: 1x to 10x" |

---

## Symbol Selection Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{selected_symbols_csv}` | Comma-separated symbol list | "BTC, ETH, SOL" |
| `{selected_symbols_detail}` | Detailed symbol information | "BTC: Bitcoin\nETH: Ethereum" |
| `{selected_symbols_count}` | Number of selected symbols | "6" |

---

## K-line and Technical Indicator Variables (Advanced)

These variables are dynamically generated based on your template. Add them to get technical analysis data.

### Syntax

- K-line data: `{SYMBOL_klines_PERIOD}` - e.g., `{BTC_klines_15m}`
- Market data: `{SYMBOL_market_data}` - e.g., `{BTC_market_data}`
- Indicators: `{SYMBOL_INDICATOR_PERIOD}` - e.g., `{BTC_RSI14_15m}`

### Supported Periods

`1m`, `3m`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, `8h`, `12h`, `1d`, `3d`, `1w`, `1M`

### Supported Indicators

| Indicator | Variable Example | Description |
|-----------|------------------|-------------|
| RSI (14) | `{BTC_RSI14_15m}` | Relative Strength Index (14-period) |
| RSI (7) | `{BTC_RSI7_15m}` | Relative Strength Index (7-period, faster) |
| MACD | `{BTC_MACD_15m}` | MACD line, signal line, histogram |
| Stochastic | `{BTC_STOCH_15m}` | Stochastic Oscillator (%K and %D) |
| MA | `{BTC_MA_15m}` | Moving Averages (MA5, MA10, MA20) |
| EMA | `{BTC_EMA_15m}` | Exponential MAs (EMA20, EMA50, EMA100) |
| Bollinger | `{BTC_BOLL_15m}` | Bollinger Bands (upper, middle, lower) |
| ATR | `{BTC_ATR14_15m}` | Average True Range (volatility) |
| VWAP | `{BTC_VWAP_15m}` | Volume Weighted Average Price |
| OBV | `{BTC_OBV_15m}` | On-Balance Volume |

### Example Usage

To add BTC technical analysis to your prompt:

```
=== TECHNICAL ANALYSIS ===
{BTC_market_data}
{BTC_klines_15m}
{BTC_RSI14_15m}
{BTC_MACD_15m}
```

---

## Legacy Variables (Backward Compatibility)

| Variable | Description | Recommended Alternative |
|----------|-------------|------------------------|
| `{account_state}` | Raw account state text | Use `{available_cash}` + `{total_account_value}` |
| `{prices_json}` | Prices in JSON format | Use `{market_prices}` |
| `{portfolio_json}` | Portfolio in JSON format | Use `{holdings_detail}` |
| `{session_context}` | Legacy session info | Use `{runtime_minutes}` + `{current_time_utc}` |

---

## Need Help?

If you're unsure how to use these variables or want a more sophisticated trading strategy, try the **AI Prompt Generation** feature (requires membership).

The AI assistant will:
- Generate optimized prompts based on your trading style
- Intelligently select appropriate variables and indicators
- Provide professional risk management suggestions
- Support multi-turn conversations to refine your strategy

Click "AI Write Prompt" button to get started.
