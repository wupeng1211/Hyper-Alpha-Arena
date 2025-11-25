"""
K-line AI Analysis API Routes
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.connection import SessionLocal
from database.models import Account, User
from services.kline_ai_analysis_service import analyze_kline_chart, get_analysis_history


router = APIRouter(prefix="/api/klines", tags=["kline-analysis"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class KlineDataItem(BaseModel):
    time: float
    open: float
    high: float
    low: float
    close: float
    volume: float = 0


class MarketDataInput(BaseModel):
    price: float = 0
    oracle_price: float = 0
    change24h: float = 0
    volume24h: float = 0
    percentage24h: float = 0
    open_interest: float = 0
    funding_rate: float = 0


class AIAnalysisRequest(BaseModel):
    account_id: int
    symbol: str
    period: str
    kline_limit: Optional[int] = None
    klines: List[KlineDataItem]
    indicators: Dict[str, Any] = {}
    market_data: MarketDataInput
    positions: Optional[List[Dict[str, Any]]] = []
    user_message: Optional[str] = None
    prompt_snapshot: Optional[str] = None


class AIAnalysisResponse(BaseModel):
    success: bool
    analysis_id: Optional[int] = None
    symbol: Optional[str] = None
    period: Optional[str] = None
    model: Optional[str] = None
    trader_name: Optional[str] = None
    analysis: Optional[str] = None
    created_at: Optional[str] = None
    prompt: Optional[str] = None
    error: Optional[str] = None


@router.post("/ai-analysis", response_model=AIAnalysisResponse)
async def create_ai_analysis(
    request: AIAnalysisRequest,
    db: Session = Depends(get_db)
):
    """
    Perform AI analysis on K-line chart data

    - **account_id**: The AI Trader account to use for analysis
    - **symbol**: Trading symbol (e.g., 'BTC')
    - **period**: K-line period (e.g., '1m', '1h', '1d')
    - **klines**: List of K-line data points
    - **indicators**: Dictionary of technical indicator values
    - **market_data**: Current market data
    - **user_message**: Optional custom question from user
    """
    # Get the AI Trader account
    account = db.query(Account).filter(Account.id == request.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="AI Trader not found")

    if account.account_type != "AI":
        raise HTTPException(status_code=400, detail="Selected account is not an AI Trader")

    # Get user (default user for now)
    user = db.query(User).filter(User.username == "default").first()
    user_id = user.id if user else 1

    # Convert request data to dictionaries
    klines_data = [k.model_dump() for k in request.klines]
    market_data = request.market_data.model_dump()

    # Perform analysis
    result = analyze_kline_chart(
        db=db,
        account=account,
        symbol=request.symbol,
        period=request.period,
        klines=klines_data,
        indicators=request.indicators,
        market_data=market_data,
        user_message=request.user_message,
        positions=request.positions or [],
        kline_limit=request.kline_limit,
        user_id=user_id,
    )

    if result and result.get("success"):
        return AIAnalysisResponse(
            success=True,
            analysis_id=result.get("analysis_id"),
            symbol=result.get("symbol"),
            period=result.get("period"),
            model=result.get("model"),
            trader_name=result.get("trader_name"),
            analysis=result.get("analysis"),
            created_at=result.get("created_at"),
            prompt=result.get("prompt"),
        )
    else:
        error_msg = result.get("error", "Unknown error") if result else "Analysis failed"
        return AIAnalysisResponse(
            success=False,
            error=error_msg,
        )


@router.get("/ai-analysis/history")
async def get_ai_analysis_history(
    symbol: Optional[str] = None,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """
    Get K-line AI analysis history

    - **symbol**: Optional filter by symbol
    - **limit**: Maximum number of records to return (default: 20)
    """
    # Get user (default user for now)
    user = db.query(User).filter(User.username == "default").first()
    user_id = user.id if user else 1

    history = get_analysis_history(
        db=db,
        user_id=user_id,
        symbol=symbol,
        limit=limit,
    )

    return {"history": history}


@router.get("/ai-analysis/{analysis_id}")
async def get_ai_analysis_detail(
    analysis_id: int,
    db: Session = Depends(get_db)
):
    """
    Get a specific K-line AI analysis by ID
    """
    from database.models import KlineAIAnalysisLog

    log = db.query(KlineAIAnalysisLog).filter(
        KlineAIAnalysisLog.id == analysis_id
    ).first()

    if not log:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return {
        "id": log.id,
        "symbol": log.symbol,
        "period": log.period,
        "model_used": log.model_used,
        "user_message": log.user_message,
        "analysis": log.analysis_result,
        "prompt_snapshot": log.prompt_snapshot,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }
