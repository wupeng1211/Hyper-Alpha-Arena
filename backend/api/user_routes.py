"""
User authentication API routes
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
import logging

from database.connection import SessionLocal
from database.models import User, UserExchangeConfig, UserSubscription
from repositories.user_repo import (
    create_user, get_user, get_user_by_username,
    update_user, create_auth_session, verify_auth_session
)
from datetime import datetime
from pydantic import BaseModel
from schemas.user import (
    UserCreate, UserUpdate, UserOut, UserLogin, UserAuthResponse
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/users", tags=["users"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/register", response_model=UserOut)
async def register_user(user_data: UserCreate, db: Session = Depends(get_db)):
    try:
        # Check if username exists
        existing = get_user_by_username(db, user_data.username)
        if existing:
            raise HTTPException(status_code=400, detail="Username already exists")
        
        # Create new user
        user = create_user(
            db=db,
            username=user_data.username,
            email=user_data.email,
            password=user_data.password
        )
        
        return UserOut(
            id=user.id,
            username=user.username,
            email=user.email,
            is_active=user.is_active == "true"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"User registration failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"User registration failed: {str(e)}")


@router.post("/login", response_model=UserAuthResponse)
async def login_user(login_data: UserLogin, db: Session = Depends(get_db)):
    try:
        # For now, just verify username exists and create session
        # Password verification can be implemented later
        user = get_user_by_username(db, login_data.username)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Create auth session
        session = create_auth_session(db, user.id)
        if not session:
            raise HTTPException(status_code=500, detail="Failed to create session")
        
        return UserAuthResponse(
            user=UserOut(
                id=user.id,
                username=user.username,
                email=user.email,
                is_active=user.is_active == "true"
            ),
            session_token=session.session_token,
            expires_at=session.expires_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"User login failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"User login failed: {str(e)}")


@router.get("/profile", response_model=UserOut)
async def get_user_profile(session_token: str, db: Session = Depends(get_db)):
    try:
        user_id = verify_auth_session(db, session_token)
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        
        user = get_user(db, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return UserOut(
            id=user.id,
            username=user.username,
            email=user.email,
            is_active=user.is_active == "true"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get user profile: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get user profile: {str(e)}")


@router.put("/profile", response_model=UserOut)
async def update_user_profile(
    session_token: str, 
    user_data: UserUpdate, 
    db: Session = Depends(get_db)
):
    try:
        user_id = verify_auth_session(db, session_token)
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        
        # Check if new username is taken (if provided)
        if user_data.username:
            existing = get_user_by_username(db, user_data.username)
            if existing and existing.id != user_id:
                raise HTTPException(status_code=400, detail="Username already exists")
        
        user = update_user(
            db=db,
            user_id=user_id,
            username=user_data.username,
            email=user_data.email
        )
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return UserOut(
            id=user.id,
            username=user.username,
            email=user.email,
            is_active=user.is_active == "true"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update user profile: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update user profile: {str(e)}")


@router.get("/", response_model=List[UserOut])
async def list_users(db: Session = Depends(get_db)):
    try:
        users = db.query(User).filter(User.is_active == "true").order_by(User.username).all()
        return [
            UserOut(
                id=user.id,
                username=user.username,
                email=user.email,
                is_active=user.is_active == "true"
            )
            for user in users
        ]
        
    except Exception as e:
        logger.error(f"Failed to list users: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list users: {str(e)}")


@router.get("/exchange-config")
async def get_exchange_config(db: Session = Depends(get_db)):
    """Get current exchange configuration for default user"""
    try:
        # Use default user_id=1 for now
        config = db.query(UserExchangeConfig).filter(UserExchangeConfig.user_id == 1).first()
        if not config:
            # Return default if no config exists
            return {"selected_exchange": "hyperliquid"}
        return {"selected_exchange": config.selected_exchange}
    except Exception as e:
        logger.error(f"Failed to get exchange config: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get exchange config: {str(e)}")


@router.post("/exchange-config")
async def set_exchange_config(exchange_data: dict, db: Session = Depends(get_db)):
    """Set exchange configuration for default user"""
    try:
        selected_exchange = exchange_data.get("selected_exchange")
        if not selected_exchange or selected_exchange not in ["hyperliquid", "binance", "aster"]:
            raise HTTPException(status_code=400, detail="Invalid exchange selection")

        # Use default user_id=1 for now
        config = db.query(UserExchangeConfig).filter(UserExchangeConfig.user_id == 1).first()
        if config:
            config.selected_exchange = selected_exchange
        else:
            config = UserExchangeConfig(user_id=1, selected_exchange=selected_exchange)
            db.add(config)

        db.commit()
        return {"selected_exchange": selected_exchange, "status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to set exchange config: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to set exchange config: {str(e)}")


class MembershipSyncRequest(BaseModel):
    """Request model for syncing membership info from www.akooi.com"""
    username: str
    status: str | None  # "ACTIVE" or None
    current_period_end: str | None  # ISO datetime string


@router.post("/sync-membership")
async def sync_membership_info(
    sync_data: MembershipSyncRequest,
    db: Session = Depends(get_db)
):
    """
    Sync membership information from www.akooi.com to local database

    This endpoint is called by frontend after successfully fetching membership
    info from www.akooi.com/api/membership/me. It updates the local UserSubscription
    table to keep it in sync, preventing accidental usage of stale local data.
    """
    try:
        # Find or create user
        user = db.query(User).filter(User.username == sync_data.username).first()
        if not user:
            # Create user if doesn't exist
            user = User(
                username=sync_data.username,
                email=f"{sync_data.username}@external.user",
                is_active="true"
            )
            db.add(user)
            db.flush()  # Get user.id
            logger.info(f"Created new user: {sync_data.username} (ID: {user.id})")

        # Determine subscription type based on status
        subscription_type = "premium" if sync_data.status == "ACTIVE" else "free"

        # Parse expiry date if provided
        expires_at = None
        if sync_data.current_period_end:
            try:
                expires_at = datetime.fromisoformat(sync_data.current_period_end.replace('Z', '+00:00'))
            except Exception as e:
                logger.warning(f"Failed to parse expiry date: {e}")

        # Find or create subscription
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user.id
        ).first()

        if subscription:
            # Update existing subscription
            subscription.subscription_type = subscription_type
            subscription.expires_at = expires_at
            subscription.max_sampling_depth = 60 if subscription_type == "premium" else 10
            logger.info(f"Updated subscription for user {sync_data.username}: {subscription_type}")
        else:
            # Create new subscription
            subscription = UserSubscription(
                user_id=user.id,
                subscription_type=subscription_type,
                expires_at=expires_at,
                max_sampling_depth=60 if subscription_type == "premium" else 10
            )
            db.add(subscription)
            logger.info(f"Created subscription for user {sync_data.username}: {subscription_type}")

        db.commit()

        return {
            "status": "success",
            "message": f"Membership synced for {sync_data.username}",
            "subscription_type": subscription_type,
            "max_sampling_depth": subscription.max_sampling_depth
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to sync membership info: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to sync membership info: {str(e)}"
        )