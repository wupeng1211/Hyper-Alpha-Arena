"""
Market data API routes
Provides RESTful API interfaces for crypto market data
"""

from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import logging

from services.market_data import get_last_price, get_kline_data, get_market_status, get_ticker_data

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/market", tags=["market_data"])


class PriceResponse(BaseModel):
    """Price response model"""
    symbol: str
    market: str
    price: float
    oracle_price: Optional[float] = 0
    change24h: Optional[float] = 0
    volume24h: Optional[float] = 0
    percentage24h: Optional[float] = 0
    open_interest: Optional[float] = 0
    funding_rate: Optional[float] = 0
    timestamp: int


class KlineItem(BaseModel):
    """K-line data item model"""
    timestamp: int
    datetime: str
    open: Optional[float]
    high: Optional[float]
    low: Optional[float]
    close: Optional[float]
    volume: Optional[float]
    amount: Optional[float]
    chg: Optional[float]
    percent: Optional[float]


class KlineResponse(BaseModel):
    """K-line data response model"""
    symbol: str
    market: str
    period: str
    count: int
    data: List[KlineItem]


class MarketStatusResponse(BaseModel):
    """Market status response model"""
    symbol: str
    market: str = None
    market_status: str
    timestamp: int
    current_time: str


@router.get("/price/{symbol}", response_model=PriceResponse)
async def get_crypto_price(symbol: str, market: str = "US"):
    """
    Get latest crypto price

    Args:
        symbol: crypto symbol, such as 'MSFT'
        market: Market symbol, default 'US'

    Returns:
        Response containing latest price
    """
    try:
        ticker_data = get_ticker_data(symbol, market)

        import time
        return PriceResponse(
            symbol=ticker_data['symbol'],
            market=market,
            price=ticker_data['price'],
            oracle_price=ticker_data.get('oracle_price', 0),
            change24h=ticker_data['change24h'],
            volume24h=ticker_data['volume24h'],
            percentage24h=ticker_data['percentage24h'],
            open_interest=ticker_data.get('open_interest', 0),
            funding_rate=ticker_data.get('funding_rate', 0),
            timestamp=int(time.time() * 1000)
        )
    except Exception as e:
        logger.error(f"Failed to get crypto price: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get crypto price: {str(e)}")


@router.get("/prices", response_model=List[PriceResponse])
async def get_multiple_prices(symbols: str, market: str = "hyperliquid"):
    """
    Get latest prices for multiple cryptos in batch

    Returns:
        Response list containing multiple crypto prices
    """
    try:
        symbol_list = [s.strip() for s in symbols.split(',') if s.strip()]
        
        if not symbol_list:
            raise HTTPException(status_code=400, detail="crypto symbol list cannot be empty")
        
        if len(symbol_list) > 20:
            raise HTTPException(status_code=400, detail="Maximum 20 crypto symbols supported")
        
        results = []
        import time
        current_timestamp = int(time.time() * 1000)
        
        for symbol in symbol_list:
            try:
                ticker_data = get_ticker_data(symbol, market)
                results.append(PriceResponse(
                    symbol=ticker_data['symbol'],
                    market=market,
                    price=ticker_data['price'],
                    oracle_price=ticker_data.get('oracle_price', 0),
                    change24h=ticker_data['change24h'],
                    volume24h=ticker_data['volume24h'],
                    percentage24h=ticker_data['percentage24h'],
                    open_interest=ticker_data.get('open_interest', 0),
                    funding_rate=ticker_data.get('funding_rate', 0),
                    timestamp=current_timestamp
                ))
            except Exception as e:
                logger.warning(f"Failed to get {symbol} ticker data: {e}")
                # Continue processing other cryptos without interrupting the entire request
                
        return results
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to batch get crypto prices: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to batch get crypto prices: {str(e)}")


@router.get("/kline/{symbol}", response_model=KlineResponse)
async def get_crypto_kline(
    symbol: str, 
    market: str = "US",
    period: str = "1m",
    count: int = 100
):
    """
    Get crypto K-line data

    Args:
        symbol: crypto symbol, such as 'MSFT'
        market: Market symbol, default 'US'
        period: Time period, supports '1m', '5m', '15m', '30m', '1h', '1d'
        count: Number of data points, default 100, max 500

    Returns:
        Response containing K-line data
    """
    try:
        # Parameter validation - Hyperliquid supported time periods
        valid_periods = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '8h', '12h', '1d', '3d', '1w', '1M']
        if period not in valid_periods:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported time period, supported periods: {', '.join(valid_periods)}"
            )
            
        if count <= 0 or count > 500:
            raise HTTPException(status_code=400, detail="Data count must be between 1-500")
        
        # Get K-line data
        kline_data = get_kline_data(symbol, market, period, count)
        
        # Convert data format
        kline_items = []
        for item in kline_data:
            # Handle datetime - may be string or datetime object
            dt_value = item.get('datetime')
            if dt_value is not None:
                dt_str = dt_value.isoformat() if hasattr(dt_value, 'isoformat') else str(dt_value)
            else:
                dt_str = None

            kline_items.append(KlineItem(
                timestamp=item.get('timestamp'),
                datetime=dt_str,
                open=item.get('open'),
                high=item.get('high'),
                low=item.get('low'),
                close=item.get('close'),
                volume=item.get('volume'),
                amount=item.get('amount'),
                chg=item.get('chg'),
                percent=item.get('percent')
            ))
        
        return KlineResponse(
            symbol=symbol,
            market=market,
            period=period,
            count=len(kline_items),
            data=kline_items
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get K-line data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get K-line data: {str(e)}")


@router.get("/status/{symbol}", response_model=MarketStatusResponse)
async def get_crypto_market_status(symbol: str, market: str = "US"):
    """
    Get crypto market status

    Args:
        symbol: crypto symbol, such as 'MSFT'
        market: Market symbol, default 'US'

    Returns:
        Response containing market status
    """
    try:
        status_data = get_market_status(symbol, market)
        
        return MarketStatusResponse(
            symbol=status_data.get('symbol', symbol),
            market=status_data.get('market', market),
            market_status=status_data.get('market_status', 'UNKNOWN'),
            timestamp=status_data.get('timestamp'),
            current_time=status_data.get('current_time', '')
        )
    except Exception as e:
        logger.error(f"Failed to get market status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get market status: {str(e)}")


@router.get("/health")
async def market_data_health():
    """
    Market data service health check

    Returns:
        Service status information
    """
    try:
        # Test getting a price to check if service is running normally
        test_price = get_last_price("MSFT", "US")
        
        import time
        return {
            "status": "healthy",
            "timestamp": int(time.time() * 1000),
            "test_price": {
                "symbol": "MSFT.US",
                "price": test_price
            },
            "message": "Market data service is running normally"
        }
    except Exception as e:
        logger.error(f"Market data service health check failed: {e}")
        return {
            "status": "unhealthy",
            "timestamp": int(time.time() * 1000),
            "error": str(e),
            "message": "Market data service abnormal"
        }

class KlineWithIndicatorsResponse(BaseModel):
    """K线数据+技术指标响应模型"""
    symbol: str
    market: str
    period: str
    count: int
    klines: List[KlineItem]
    indicators: Dict[str, Any]


@router.get("/kline-with-indicators/{symbol}", response_model=KlineWithIndicatorsResponse)
async def get_kline_with_indicators(
    symbol: str,
    market: str = "hyperliquid",
    period: str = "1h",
    count: int = 500,
    indicators: str = ""
):
    """
    获取K线数据并计算技术指标

    Args:
        symbol: 币种符号，如 'BTC'
        market: 市场，默认 'hyperliquid'
        period: 时间周期，如 '1h'
        count: 数据数量，默认500
        indicators: 指标列表，逗号分隔，如 'EMA20,EMA50,MACD,RSI14'

    Returns:
        包含K线数据和技术指标的响应
    """
    try:
        from services.technical_indicators import calculate_indicators

        # 参数验证
        valid_periods = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '8h', '12h', '1d', '3d', '1w', '1M']
        if period not in valid_periods:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的时间周期，支持的周期: {', '.join(valid_periods)}"
            )

        if count <= 0 or count > 500:
            raise HTTPException(status_code=400, detail="数据数量必须在1-500之间")

        # 获取K线数据
        kline_data = get_kline_data(symbol, market, period, count)

        # 转换K线数据格式
        kline_items = []
        for item in kline_data:
            dt_value = item.get('datetime')
            if dt_value is not None:
                dt_str = dt_value.isoformat() if hasattr(dt_value, 'isoformat') else str(dt_value)
            else:
                dt_str = None

            kline_items.append(KlineItem(
                timestamp=item.get('timestamp'),
                datetime=dt_str,
                open=item.get('open'),
                high=item.get('high'),
                low=item.get('low'),
                close=item.get('close'),
                volume=item.get('volume'),
                amount=item.get('amount'),
                chg=item.get('chg'),
                percent=item.get('percent')
            ))

        # 计算技术指标
        indicator_results = {}
        if indicators.strip():
            indicator_list = [ind.strip() for ind in indicators.split(',') if ind.strip()]
            if indicator_list:
                indicator_results = calculate_indicators(kline_data, indicator_list)

        return KlineWithIndicatorsResponse(
            symbol=symbol,
            market=market,
            period=period,
            count=len(kline_items),
            klines=kline_items,
            indicators=indicator_results
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取K线和指标数据失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取K线和指标数据失败: {str(e)}")


@router.get("/indicators/available")
async def get_available_indicators():
    """
    获取支持的技术指标列表

    Returns:
        支持的指标列表
    """
    try:
        from services.technical_indicators import get_available_indicators
        return {
            "indicators": get_available_indicators(),
            "message": "支持的技术指标列表"
        }
    except Exception as e:
        logger.error(f"获取指标列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取指标列表失败: {str(e)}")
