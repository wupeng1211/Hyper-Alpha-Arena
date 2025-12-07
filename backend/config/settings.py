from pydantic import BaseModel
from typing import Dict
import os


class MarketConfig(BaseModel):
    market: str
    min_commission: float
    commission_rate: float
    exchange_rate: float
    min_order_quantity: int = 1
    lot_size: int = 1


class HyperliquidBuilderConfig(BaseModel):
    """Hyperliquid Builder Fee Configuration"""
    builder_address: str
    builder_fee: int  # Fee in tenths of basis point (30 = 0.03%)


#  default configs for CRYPTO markets
DEFAULT_TRADING_CONFIGS: Dict[str, MarketConfig] = {
    "CRYPTO": MarketConfig(
        market="CRYPTO",
        min_commission=0.1,  # $0.1 minimum commission for crypto
        commission_rate=0.001,  # 0.1% commission rate (typical for crypto)
        exchange_rate=1.0,  # USD base
        min_order_quantity=1,  # Can trade fractional amounts
        lot_size=1,
    ),
}

# Hyperliquid Builder Fee Configuration
HYPERLIQUID_BUILDER_CONFIG = HyperliquidBuilderConfig(
    builder_address=os.getenv(
        "HYPERLIQUID_BUILDER_ADDRESS",
        "0x012E82f81e506b8f0EF69FF719a6AC65822b5924"
    ),
    builder_fee=int(os.getenv("HYPERLIQUID_BUILDER_FEE", "30"))  # 0.03% default
)
