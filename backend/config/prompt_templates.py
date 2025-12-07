"""
Default and Pro prompt templates for Hyper Alpha Arena.
"""

# Baseline prompt (simplest version)
DEFAULT_PROMPT_TEMPLATE = """You are a cryptocurrency trading AI.

=== TRADING ENVIRONMENT ===
{trading_environment}

=== ACCOUNT STATUS ===
Available Cash: ${available_cash}
Total Account Value: ${total_account_value}

=== MARKET PRICES ===
{market_prices}

=== NEWS ===
{news_section}

=== TRADING RULES ===
- operation: "buy" (long), "sell" (short), "hold", or "close"
- target_portion_of_balance: 0.0-1.0 (portion of balance to use)
- leverage: 1 to {max_leverage}
- max_price: required for "buy" and closing SHORT (slippage protection)
- min_price: required for "sell" and closing LONG (slippage protection)
- Keep total margin usage below 70%

=== OUTPUT FORMAT ===
{output_format}
"""

# Structured prompt with technical analysis support
PRO_PROMPT_TEMPLATE = """=== SESSION CONTEXT ===
Runtime: {runtime_minutes} minutes since trading started
Current UTC time: {current_time_utc}

=== TRADING ENVIRONMENT ===
{trading_environment}
{real_trading_warning}

=== ACCOUNT STATUS ===
Total Return: {total_return_percent}%
Available Cash: ${available_cash}
Account Value: ${total_account_value}
{margin_info}

=== HOLDINGS ===
{holdings_detail}

=== MARKET PRICES ===
{market_prices}

=== PRICE HISTORY ===
{sampling_data}

=== NEWS ===
{news_section}

=== TECHNICAL ANALYSIS (Optional) ===
You can add K-line and indicator variables to this section.
Supported variables (see PROMPT_VARIABLES_REFERENCE.md for full list):
- Market data: BTC_market_data, ETH_market_data, etc.
- K-lines: BTC_klines_15m, ETH_klines_1h, etc.
- RSI: BTC_RSI14_15m, BTC_RSI7_15m
- MACD: BTC_MACD_15m
- Moving Averages: BTC_MA_15m, BTC_EMA_15m
- Bollinger Bands: BTC_BOLL_15m
- Volume: BTC_VWAP_15m, BTC_OBV_15m

Supported periods: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 8h, 12h, 1d, 3d, 1w, 1M

=== TRADING RULES ===
{operational_constraints}
{leverage_constraints}

Decision requirements:
- operation: "buy" (long), "sell" (short), "hold", or "close"
- target_portion_of_balance: 0.0-1.0
- leverage: 1 to {max_leverage}
- max_price: required for "buy" and closing SHORT
- min_price: required for "sell" and closing LONG
- Keep total margin usage below 70%

Default exit triggers:
- Long: exit if price drops 5% below entry
- Short: exit if price rises 5% above entry

=== OUTPUT FORMAT ===
{output_format}
"""

# K-line AI Analysis prompt template for chart insights
KLINE_ANALYSIS_PROMPT_TEMPLATE = """You are an expert technical analyst and trading advisor. Analyze the following K-line chart data and technical indicators to provide actionable trading insights.

=== ANALYSIS CONTEXT ===
Symbol: {symbol}
Timeframe: {period}
Analysis Time (UTC): {current_time_utc}

=== CURRENT MARKET DATA ===
Current Price: ${current_price}
24h Change: {change_24h}%
24h Volume: ${volume_24h}
Open Interest: ${open_interest}
Funding Rate: {funding_rate}%

=== K-LINE DATA (Recent {kline_count} candles) ===
{klines_summary}

=== TECHNICAL INDICATORS ===
{indicators_summary}

=== POSITIONS ===
{positions_summary}

=== USER QUESTION (if provided) ===
{user_message}

=== ANALYSIS REQUIREMENTS ===
Please provide a comprehensive analysis in **Markdown format** with the following sections:

## 📊 Trend Analysis
- Identify the current trend direction (bullish/bearish/sideways)
- Explain the trend strength based on indicators
- Note any trend reversal signals

## 🎯 Key Price Levels
- Support levels (where price may bounce)
- Resistance levels (where price may face selling pressure)
- Critical breakout/breakdown levels to watch

## 📈 Technical Signals
- Interpret the current indicator readings (MA, RSI, MACD, etc.)
- Identify any bullish or bearish signals
- Note divergences or confirmations between indicators

## 💡 Trading Suggestions
- Recommended action: Long / Short / Wait
- Entry zone (if applicable)
- Stop-loss level
- Take-profit targets

## ⚠️ Risk Warnings
- Current volatility assessment
- Key risks to monitor
- Events or levels that would invalidate the analysis

{additional_instructions}

**Important**: Base your analysis solely on the provided data. Be objective and include both bullish and bearish scenarios where applicable.
"""

# Hyperliquid-specific prompt template for perpetual contract trading
HYPERLIQUID_PROMPT_TEMPLATE = """=== SESSION CONTEXT ===
Runtime: {runtime_minutes} minutes since trading started
Current UTC time: {current_time_utc}

=== TRADING ENVIRONMENT ===
Platform: Hyperliquid Perpetual Contracts
Environment: {environment} (TESTNET or MAINNET)
{real_trading_warning}

=== ACCOUNT STATE ===
Total Equity (USDC): ${total_equity}
Available Balance: ${available_balance}
Used Margin: ${used_margin}
Margin Usage: {margin_usage_percent}%
Maintenance Margin: ${maintenance_margin}

Leverage Settings:
- Maximum: {max_leverage}x
- Default: {default_leverage}x

=== OPEN POSITIONS ===
{positions_detail}

=== RECENT TRADES ===
{recent_trades_summary}

Note: Review recent trades to avoid flip-flop behavior (rapid position reversals).

=== SYMBOLS ===
Monitoring {selected_symbols_count} contracts:
{selected_symbols_detail}

=== MARKET PRICES ===
{market_prices}

=== PRICE HISTORY ===
{sampling_data}

=== NEWS ===
{news_section}

=== TECHNICAL ANALYSIS (Optional) ===
Add K-line and indicator variables here if needed.
See PROMPT_VARIABLES_REFERENCE.md for available variables.

Example variables you can add:
- Market data: BTC_market_data, ETH_market_data
- K-lines: BTC_klines_15m, ETH_klines_1h
- Indicators: BTC_RSI14_15m, BTC_MACD_15m, BTC_MA_15m, BTC_BOLL_15m

Supported periods: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 8h, 12h, 1d, 3d, 1w, 1M

=== HYPERLIQUID PRICE LIMITS (CRITICAL) ===
ALL orders must have prices within 1% of oracle price or will be rejected.

- BUY/LONG: max_price <= market_price * 1.01
- SELL/SHORT: min_price >= market_price * 0.99
- CLOSE LONG: min_price >= market_price * 0.99
- CLOSE SHORT: max_price <= market_price * 1.01

CLOSE orders use IOC execution - prices must be competitive to match order book.
Failure = "Price too far from oracle" error.

=== TRADING RULES ===
Leverage:
- Multiplies gains AND losses
- Recommended: 2-3x default, 5-10x only for high-probability setups
- Keep margin usage below 70%

Risk Management:
- Consider liquidation price before entering
- Maintain 30%+ free margin buffer
- Set clear profit targets and stop losses

Execution Order:
1. Close positions (free margin)
2. Open SELL/SHORT entries
3. Open BUY/LONG entries

=== DECISION REQUIREMENTS ===
- operation: "buy" (long), "sell" (short), "hold", or "close"
- target_portion_of_balance: 0.0-1.0
- leverage: 1 to {max_leverage}
- max_price: required for "buy" and closing SHORT
- min_price: required for "sell" and closing LONG
- Symbols: {selected_symbols_csv}

=== OUTPUT FORMAT ===
{output_format}
"""
