"""
K-line AI Analysis Service - Handles AI-powered chart analysis
"""
import logging
import json
import time
import random
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from sqlalchemy.orm import Session

from database.models import Account, KlineAIAnalysisLog
from config.prompt_templates import KLINE_ANALYSIS_PROMPT_TEMPLATE
from services.ai_decision_service import build_chat_completion_endpoints, _extract_text_from_message


logger = logging.getLogger(__name__)


class SafeDict(dict):
    """Dictionary that returns 'N/A' for missing keys"""
    def __missing__(self, key):
        return "N/A"


def _format_klines_summary(klines: List[Dict]) -> str:
    """Format K-line data into a readable summary"""
    if not klines:
        return "No K-line data available."

    lines = []
    # Take last N candles for summary (most recent)
    recent_klines = klines

    lines.append(f"Displaying last {len(recent_klines)} candles (oldest to newest):")
    lines.append("")

    for i, kline in enumerate(recent_klines):
        timestamp = kline.get('time', 'N/A')
        if isinstance(timestamp, (int, float)):
            try:
                dt = datetime.utcfromtimestamp(timestamp)
                time_str = dt.strftime('%Y-%m-%d %H:%M')
            except:
                time_str = str(timestamp)
        else:
            time_str = str(timestamp)

        open_price = kline.get('open', 0)
        high = kline.get('high', 0)
        low = kline.get('low', 0)
        close = kline.get('close', 0)
        volume = kline.get('volume', 0)

        # Determine candle direction
        direction = "+" if close >= open_price else "-"
        change_pct = ((close - open_price) / open_price * 100) if open_price > 0 else 0

        lines.append(
            f"[{time_str}] O:{open_price:.2f} H:{high:.2f} L:{low:.2f} C:{close:.2f} "
            f"({direction}{abs(change_pct):.2f}%) Vol:{volume:,.0f}"
        )

    # Add summary statistics
    if len(klines) >= 2:
        first_close = klines[0].get('close', 0)
        last_close = klines[-1].get('close', 0)
        highest = max(k.get('high', 0) for k in klines)
        lowest = min(k.get('low', float('inf')) for k in klines)
        total_volume = sum(k.get('volume', 0) for k in klines)

        if first_close > 0:
            period_change = ((last_close - first_close) / first_close) * 100
            lines.append("")
            lines.append(f"--- Period Summary ---")
            lines.append(f"Period Change: {period_change:+.2f}%")
            lines.append(f"High/Low Range: ${lowest:.2f} - ${highest:.2f}")
            lines.append(f"Total Volume: {total_volume:,.0f}")

    return "\n".join(lines)


def _format_positions_summary(positions: List[Dict]) -> str:
    """Format positions into a readable summary"""
    if not positions:
        return "No open positions."

    lines = []
    for p in positions:
        symbol = p.get("symbol") or "N/A"
        side = (p.get("side") or "").upper()
        size = p.get("size", "N/A")
        value = p.get("position_value", "N/A")
        entry = p.get("entry_price", "N/A")
        mark = p.get("mark_price", "N/A")
        liq = p.get("liquidation_price", "N/A")
        leverage = p.get("leverage", "N/A")
        pnl = p.get("unrealized_pnl", "N/A")
        pnl_pct = p.get("pnl_percentage", None)

        line_parts = [
            f"{symbol} {side} size:{size}",
            f"value:{value}",
            f"entry:{entry}",
            f"mark:{mark}",
            f"liq:{liq}",
            f"lev:{leverage}",
            f"unrealized_pnl:{pnl}",
        ]
        if pnl_pct is not None:
            line_parts.append(f"pnl%:{pnl_pct}")

        lines.append(" | ".join(line_parts))

    return "\n".join(lines)


def _format_indicators_summary(indicators: Dict[str, Any]) -> str:
    """Format technical indicators into a readable summary"""
    if not indicators:
        return "No technical indicators available."

    lines = []
    tail_len = 5

    # Moving Averages
    ma_indicators = []
    for key in ['MA5', 'MA10', 'MA20', 'EMA20', 'EMA50']:
        if key in indicators and indicators[key]:
            values = indicators[key]
            if isinstance(values, list) and len(values) > 0:
                latest = values[-1] if values[-1] is not None else 'N/A'
                ma_indicators.append(f"{key}: ${latest:.2f}" if isinstance(latest, (int, float)) else f"{key}: {latest}")
                # 最近序列
                tail_values = [v for v in values[-tail_len:] if isinstance(v, (int, float, float))]
                if tail_values:
                    ma_indicators.append(f"{key} last {len(tail_values)}: {', '.join(f'{v:.2f}' for v in tail_values)}")

    if ma_indicators:
        lines.append("**Moving Averages:**")
        lines.append(", ".join(ma_indicators))
        lines.append("")

    # RSI
    rsi_values = []
    for key in ['RSI14', 'RSI7']:
        if key in indicators and indicators[key]:
            values = indicators[key]
            if isinstance(values, list) and len(values) > 0:
                latest = values[-1] if values[-1] is not None else 'N/A'
                if isinstance(latest, (int, float)):
                    status = "Overbought" if latest > 70 else "Oversold" if latest < 30 else "Neutral"
                    rsi_values.append(f"{key}: {latest:.2f} ({status})")

    if rsi_values:
        lines.append("**RSI (Relative Strength Index):**")
        lines.extend(rsi_values)
        lines.append("")

    # MACD
    if 'MACD' in indicators and indicators['MACD']:
        macd_data = indicators['MACD']
        if isinstance(macd_data, dict):
            macd_line = macd_data.get('macd', [])
            signal_line = macd_data.get('signal', [])
            histogram = macd_data.get('histogram', [])

            lines.append("**MACD:**")
            if macd_line and len(macd_line) > 0 and macd_line[-1] is not None:
                lines.append(f"MACD Line: {macd_line[-1]:.4f}")
            if signal_line and len(signal_line) > 0 and signal_line[-1] is not None:
                lines.append(f"Signal Line: {signal_line[-1]:.4f}")
            if histogram and len(histogram) > 0 and histogram[-1] is not None:
                hist_val = histogram[-1]
                trend = "Bullish momentum" if hist_val > 0 else "Bearish momentum"
                lines.append(f"Histogram: {hist_val:.4f} ({trend})")
                tail_hist = [v for v in histogram[-tail_len:] if isinstance(v, (int, float, float))]
                if tail_hist:
                    lines.append(f"Histogram last {len(tail_hist)}: {', '.join(f'{v:.4f}' for v in tail_hist)}")
            lines.append("")

    # Bollinger Bands
    if 'BOLL' in indicators and indicators['BOLL']:
        boll_data = indicators['BOLL']
        if isinstance(boll_data, dict):
            upper = boll_data.get('upper', [])
            middle = boll_data.get('middle', [])
            lower = boll_data.get('lower', [])

            lines.append("**Bollinger Bands:**")
            if upper and len(upper) > 0 and upper[-1] is not None:
                lines.append(f"Upper Band: ${upper[-1]:.2f}")
            if middle and len(middle) > 0 and middle[-1] is not None:
                lines.append(f"Middle Band (SMA20): ${middle[-1]:.2f}")
            if lower and len(lower) > 0 and lower[-1] is not None:
                lines.append(f"Lower Band: ${lower[-1]:.2f}")
            lines.append("")

    # ATR
    if 'ATR14' in indicators and indicators['ATR14']:
        values = indicators['ATR14']
        if isinstance(values, list) and len(values) > 0 and values[-1] is not None:
            lines.append("**ATR (Average True Range):**")
            lines.append(f"ATR14: ${values[-1]:.2f} (volatility indicator)")
            lines.append("")

    if not lines:
        return "No technical indicators selected."

    return "\n".join(lines)


def analyze_kline_chart(
    db: Session,
    account: Account,
    symbol: str,
    period: str,
    klines: List[Dict],
    indicators: Dict[str, Any],
    market_data: Dict[str, Any],
    user_message: Optional[str] = None,
    positions: List[Dict[str, Any]] = None,
    kline_limit: Optional[int] = None,
    user_id: int = 1,
) -> Optional[Dict[str, Any]]:
    """
    Perform AI analysis on K-line chart data

    Args:
        db: Database session
        account: AI Trader account with model configuration
        symbol: Trading symbol (e.g., 'BTC')
        period: K-line period (e.g., '1m', '1h', '1d')
        klines: List of K-line data points
        indicators: Dictionary of technical indicators
        market_data: Current market data (price, volume, etc.)
        user_message: Optional custom question from user
        user_id: User ID for logging

    Returns:
        Dictionary with analysis result or None if failed
    """
    if not account.api_key or account.api_key in ["", "default-key-please-update-in-settings", "default"]:
        logger.warning(f"Account {account.name} has no valid API key for K-line analysis")
        return {"error": "AI Trader has no valid API key configured"}

    try:
        # Build prompt context
        now = datetime.utcnow()

        # respect kline_limit if provided
        display_klines = klines[-kline_limit:] if kline_limit else klines

        klines_summary = _format_klines_summary(display_klines)
        indicators_summary = _format_indicators_summary(indicators)
        positions_summary = _format_positions_summary(positions or [])

        context = {
            "symbol": symbol,
            "period": period,
            "current_time_utc": now.isoformat() + "Z",
            "current_price": market_data.get("price", "N/A"),
            "change_24h": f"{market_data.get('percentage24h', 0):.2f}",
            "volume_24h": f"{market_data.get('volume24h', 0):,.0f}",
            "open_interest": f"{market_data.get('open_interest', 0):,.0f}",
            "funding_rate": f"{market_data.get('funding_rate', 0) * 100:.4f}",
            "kline_count": len(display_klines),
            "klines_summary": klines_summary,
            "indicators_summary": indicators_summary,
            "positions_summary": positions_summary,
            "user_message": user_message if user_message else "No specific question provided. Please provide a general analysis.",
            "additional_instructions": "",
        }

        # Render prompt
        try:
            prompt = KLINE_ANALYSIS_PROMPT_TEMPLATE.format_map(SafeDict(context))
        except Exception as e:
            logger.error(f"Failed to render prompt: {e}")
            prompt = KLINE_ANALYSIS_PROMPT_TEMPLATE

    # Build API request
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {account.api_key}",
        }

        model_lower = (account.model or "").lower()
        is_reasoning_model = any(
            marker in model_lower for marker in [
                "gpt-5", "o1-preview", "o1-mini", "o1-", "o3-", "o4-",
                "deepseek-r1", "deepseek-reasoner",
                "qwq", "qwen-plus-thinking", "qwen-max-thinking", "qwen3-thinking",
                "claude-4", "claude-sonnet-4-5",
                "gemini-2.5", "gemini-3", "gemini-2.0-flash-thinking",
                "grok-3-mini"
            ]
        )

        is_new_model = is_reasoning_model or any(marker in model_lower for marker in ["gpt-4o"])

        payload = {
            "model": account.model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
        }

        if not is_reasoning_model:
            payload["temperature"] = 0.7

        if is_new_model:
            payload["max_completion_tokens"] = 4000
        else:
            payload["max_tokens"] = 4000

        # Call AI API
        endpoints = build_chat_completion_endpoints(account.base_url, account.model)
        if not endpoints:
            logger.error(f"No valid API endpoint for account {account.name}")
            return {"error": "Failed to build API endpoint"}

        max_retries = 3
        response = None
        success = False
        request_timeout = 120 if is_reasoning_model else 60

        for endpoint in endpoints:
            for attempt in range(max_retries):
                try:
                    response = requests.post(
                        endpoint,
                        headers=headers,
                        json=payload,
                        timeout=request_timeout,
                        verify=False,
                    )

                    if response.status_code == 200:
                        success = True
                        break

                    if response.status_code == 429:
                        wait_time = (2**attempt) + random.uniform(0, 1)
                        logger.warning(f"Rate limited, waiting {wait_time:.1f}s...")
                        if attempt < max_retries - 1:
                            time.sleep(wait_time)
                            continue

                    logger.warning(f"API returned status {response.status_code}: {response.text}")
                    break

                except requests.RequestException as e:
                    if attempt < max_retries - 1:
                        wait_time = (2**attempt) + random.uniform(0, 1)
                        logger.warning(f"Request failed, retrying in {wait_time:.1f}s: {e}")
                        time.sleep(wait_time)
                        continue
                    logger.warning(f"Request failed after {max_retries} attempts: {e}")
                    break

            if success:
                break

        if not success or not response:
            logger.error(f"All API endpoints failed for account {account.name}")
            return {"error": "AI API request failed"}

        # Parse response
        result = response.json()

        if "choices" in result and len(result["choices"]) > 0:
            choice = result["choices"][0]
            message = choice.get("message", {})
            raw_content = message.get("content")

            analysis_text = _extract_text_from_message(raw_content)

            if not analysis_text:
                logger.error("Empty content in AI response")
                return {"error": "AI returned empty response"}

            # Save to database
            analysis_log = KlineAIAnalysisLog(
                user_id=user_id,
                account_id=account.id,
                symbol=symbol,
                period=period,
                user_message=user_message,
                model_used=account.model,
                prompt_snapshot=prompt,
                analysis_result=analysis_text,
            )

            db.add(analysis_log)
            db.commit()
            db.refresh(analysis_log)

            logger.info(f"K-line analysis completed for {symbol}/{period} using {account.name}")

            return {
                "success": True,
                "analysis_id": analysis_log.id,
                "symbol": symbol,
                "period": period,
                "model": account.model,
                "trader_name": account.name,
                "analysis": analysis_text,
                "created_at": analysis_log.created_at.isoformat() if analysis_log.created_at else None,
                "prompt": prompt,
            }

        logger.error(f"Unexpected AI response format: {result}")
        return {"error": "Unexpected AI response format"}

    except Exception as e:
        logger.error(f"K-line analysis failed: {e}", exc_info=True)
        return {"error": f"Analysis failed: {str(e)}"}


def get_analysis_history(
    db: Session,
    user_id: int,
    symbol: Optional[str] = None,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """Get K-line analysis history for a user"""
    query = db.query(KlineAIAnalysisLog).filter(
        KlineAIAnalysisLog.user_id == user_id
    )

    if symbol:
        query = query.filter(KlineAIAnalysisLog.symbol == symbol)

    logs = query.order_by(KlineAIAnalysisLog.created_at.desc()).limit(limit).all()

    return [
        {
            "id": log.id,
            "symbol": log.symbol,
            "period": log.period,
            "model_used": log.model_used,
            "user_message": log.user_message,
            "analysis": log.analysis_result,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]
