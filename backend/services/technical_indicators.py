#!/usr/bin/env python3
"""
技术指标计算服务
使用pandas-ta库计算各种技术指标
"""

import pandas as pd
import pandas_ta as ta
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


def calculate_indicators(kline_data: List[Dict[str, Any]], indicators: List[str]) -> Dict[str, Any]:
    """
    计算技术指标

    Args:
        kline_data: K线数据列表，包含timestamp, open, high, low, close, volume
        indicators: 需要计算的指标列表，如 ['EMA20', 'EMA50', 'MACD', 'RSI14']

    Returns:
        Dict: 计算结果，格式为 {'EMA20': [...], 'MACD': {...}, ...}
    """
    if not kline_data:
        return {}

    try:
        # 转换为DataFrame
        df = pd.DataFrame(kline_data)

        # 确保数据类型正确
        df['open'] = pd.to_numeric(df['open'], errors='coerce')
        df['high'] = pd.to_numeric(df['high'], errors='coerce')
        df['low'] = pd.to_numeric(df['low'], errors='coerce')
        df['close'] = pd.to_numeric(df['close'], errors='coerce')
        df['volume'] = pd.to_numeric(df['volume'], errors='coerce')

        # 按时间排序
        df = df.sort_values('timestamp')

        results = {}

        for indicator in indicators:
            try:
                if indicator == 'EMA20':
                    results['EMA20'] = _calculate_ema(df, 20)
                elif indicator == 'EMA50':
                    results['EMA50'] = _calculate_ema(df, 50)
                elif indicator == 'EMA100':
                    results['EMA100'] = _calculate_ema(df, 100)
                elif indicator == 'MA5':
                    results['MA5'] = _calculate_sma(df, 5)
                elif indicator == 'MA10':
                    results['MA10'] = _calculate_sma(df, 10)
                elif indicator == 'MA20':
                    results['MA20'] = _calculate_sma(df, 20)
                elif indicator == 'MACD':
                    results['MACD'] = _calculate_macd(df)
                elif indicator == 'RSI14':
                    results['RSI14'] = _calculate_rsi(df, 14)
                elif indicator == 'RSI7':
                    results['RSI7'] = _calculate_rsi(df, 7)
                elif indicator == 'BOLL':
                    results['BOLL'] = _calculate_bollinger_bands(df)
                elif indicator == 'ATR14':
                    results['ATR14'] = _calculate_atr(df, 14)
                elif indicator == 'VWAP':
                    results['VWAP'] = _calculate_vwap(df)
                elif indicator == 'STOCH':
                    results['STOCH'] = _calculate_stochastic(df)
                elif indicator == 'OBV':
                    results['OBV'] = _calculate_obv(df)
                else:
                    logger.warning(f"Unknown indicator: {indicator}")

            except Exception as e:
                logger.error(f"Error calculating {indicator}: {e}")
                results[indicator] = None

        return results

    except Exception as e:
        logger.error(f"Error in calculate_indicators: {e}")
        return {}


def _calculate_ema(df: pd.DataFrame, period: int) -> List[float]:
    """计算指数移动平均线"""
    ema = ta.ema(df['close'], length=period)
    return ema.fillna(0).tolist()


def _calculate_sma(df: pd.DataFrame, period: int) -> List[float]:
    """计算简单移动平均线"""
    sma = ta.sma(df['close'], length=period)
    return sma.fillna(0).tolist()


def _calculate_macd(df: pd.DataFrame) -> Dict[str, List[float]]:
    """计算MACD指标"""
    macd_data = ta.macd(df['close'])

    return {
        'macd': macd_data['MACD_12_26_9'].fillna(0).tolist(),
        'signal': macd_data['MACDs_12_26_9'].fillna(0).tolist(),
        'histogram': macd_data['MACDh_12_26_9'].fillna(0).tolist()
    }


def _calculate_rsi(df: pd.DataFrame, period: int) -> List[float]:
    """计算相对强弱指数"""
    rsi = ta.rsi(df['close'], length=period)
    return rsi.fillna(50).tolist()  # RSI默认值设为50


def _calculate_bollinger_bands(df: pd.DataFrame, period: int = 20, std: float = 2) -> Dict[str, List[float]]:
    """计算布林带"""
    logger.info(f"Starting BOLL calculation with {len(df)} data points, period={period}, std={std}")

    try:
        # 检查输入数据
        if len(df) < period:
            logger.error(f"Insufficient data for BOLL calculation: {len(df)} < {period}")
            return None

        logger.info(f"Close price sample: {df['close'].head().tolist()}")

        bb = ta.bbands(df['close'], length=period, std=std)
        logger.info(f"BOLL calculation completed, result type: {type(bb)}")

        if bb is None:
            logger.error("BOLL calculation returned None")
            return None

        if bb.empty:
            logger.error("BOLL calculation returned empty DataFrame")
            return None

        # 打印列名以调试
        logger.info(f"BOLL columns: {bb.columns.tolist()}")
        logger.info(f"BOLL shape: {bb.shape}")
        logger.info(f"BOLL sample data:\n{bb.head()}")

        # 尝试不同的列名格式
        upper_col = None
        middle_col = None
        lower_col = None

        for col in bb.columns:
            logger.info(f"Checking column: {col}")
            if 'BBU' in col or 'upper' in col.lower():
                upper_col = col
                logger.info(f"Found upper column: {col}")
            elif 'BBM' in col or 'middle' in col.lower():
                middle_col = col
                logger.info(f"Found middle column: {col}")
            elif 'BBL' in col or 'lower' in col.lower():
                lower_col = col
                logger.info(f"Found lower column: {col}")

        if not all([upper_col, middle_col, lower_col]):
            logger.error(f"Could not find all BOLL columns. Found: upper={upper_col}, middle={middle_col}, lower={lower_col}")
            logger.error(f"Available columns: {bb.columns.tolist()}")
            return None

        result = {
            'upper': bb[upper_col].fillna(0).tolist(),
            'middle': bb[middle_col].fillna(0).tolist(),
            'lower': bb[lower_col].fillna(0).tolist()
        }

        logger.info(f"BOLL calculation successful, returning {len(result['upper'])} data points")
        return result

    except Exception as e:
        logger.error(f"Error calculating BOLL: {e}", exc_info=True)
        return None


def _calculate_atr(df: pd.DataFrame, period: int) -> List[float]:
    """计算平均真实波幅"""
    atr = ta.atr(df['high'], df['low'], df['close'], length=period)
    return atr.fillna(0).tolist()


def _calculate_vwap(df: pd.DataFrame) -> List[float]:
    """计算成交量加权平均价"""
    try:
        # VWAP 需要 DatetimeIndex
        df_copy = df.copy()
        df_copy['datetime'] = pd.to_datetime(df_copy['timestamp'], unit='ms')
        df_copy = df_copy.set_index('datetime')
        vwap = ta.vwap(df_copy['high'], df_copy['low'], df_copy['close'], df_copy['volume'])
        return vwap.fillna(0).tolist()
    except Exception as e:
        logger.error(f"Error calculating VWAP: {e}")
        return None


def _calculate_stochastic(df: pd.DataFrame, k_period: int = 14, d_period: int = 3) -> Dict[str, List[float]]:
    """计算随机震荡指标"""
    stoch = ta.stoch(df['high'], df['low'], df['close'], k=k_period, d=d_period)
    return {
        'k': stoch[f'STOCHk_{k_period}_{d_period}_3'].fillna(50).tolist(),
        'd': stoch[f'STOCHd_{k_period}_{d_period}_3'].fillna(50).tolist()
    }


def _calculate_obv(df: pd.DataFrame) -> List[float]:
    """计算能量潮指标"""
    obv = ta.obv(df['close'], df['volume'])
    return obv.fillna(0).tolist()


def get_available_indicators() -> List[Dict[str, str]]:
    """获取支持的技术指标列表"""
    return [
        {'name': 'MA5', 'description': '5期简单移动平均线'},
        {'name': 'MA10', 'description': '10期简单移动平均线'},
        {'name': 'MA20', 'description': '20期简单移动平均线'},
        {'name': 'EMA20', 'description': '20期指数移动平均线'},
        {'name': 'EMA50', 'description': '50期指数移动平均线'},
        {'name': 'EMA100', 'description': '100期指数移动平均线'},
        {'name': 'MACD', 'description': '移动平均收敛发散指标'},
        {'name': 'RSI14', 'description': '14期相对强弱指数'},
        {'name': 'RSI7', 'description': '7期相对强弱指数'},
        {'name': 'BOLL', 'description': '布林带'},
        {'name': 'ATR14', 'description': '14期平均真实波幅'},
        {'name': 'VWAP', 'description': '成交量加权平均价'},
        {'name': 'STOCH', 'description': '随机震荡指标'},
        {'name': 'OBV', 'description': '能量潮指标'},
    ]
