#!/usr/bin/env python3
"""
Migration: Add environment field to crypto_klines table for testnet/mainnet isolation

This migration adds an 'environment' field to the crypto_klines table to support
proper isolation between testnet and mainnet K-line data.

Changes:
1. Add 'environment' column with default value 'mainnet'
2. Update all existing records to 'mainnet' (since current hardcoded sandbox=False)
3. Update unique constraint to include environment field
4. Create indexes on environment field for performance

Background:
Previously, HyperliquidClient was hardcoded with sandbox=False, meaning all K-line
data came from mainnet regardless of account environment. This migration enables
proper environment isolation for GitHub users upgrading their installations.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from connection import SessionLocal, engine


def upgrade():
    """Apply the migration"""
    print("Starting migration: add_environment_to_crypto_klines")

    db = SessionLocal()
    try:
        # Step 1: Add environment column with default value (idempotent)
        print("Adding environment column to crypto_klines table...")
        db.execute(text("""
            ALTER TABLE crypto_klines
            ADD COLUMN IF NOT EXISTS environment VARCHAR(20) NOT NULL DEFAULT 'mainnet'
        """))

        # Step 2: Update all existing records to 'mainnet'
        # (since current hardcoded sandbox=False means all data is mainnet)
        print("Updating all existing records to 'mainnet' environment...")
        result = db.execute(text("""
            UPDATE crypto_klines SET environment = 'mainnet' WHERE environment IS NULL
        """))
        print(f"Updated {result.rowcount} records")

        # Step 3: Drop old unique constraint
        print("Dropping old unique constraint...")
        db.execute(text("""
            ALTER TABLE crypto_klines
            DROP CONSTRAINT IF EXISTS crypto_klines_exchange_symbol_market_period_timestamp_key
        """))

        # Step 4: Create new unique constraint including environment (idempotent)
        print("Creating new unique constraint with environment field...")
        # Check if constraint already exists
        constraint_check = db.execute(text("""
            SELECT COUNT(*) FROM information_schema.table_constraints
            WHERE constraint_name = 'crypto_klines_exchange_symbol_market_period_timestamp_environment_key'
            AND table_name = 'crypto_klines'
        """))
        if constraint_check.scalar() == 0:
            db.execute(text("""
                ALTER TABLE crypto_klines
                ADD CONSTRAINT crypto_klines_exchange_symbol_market_period_timestamp_environment_key
                UNIQUE (exchange, symbol, market, period, timestamp, environment)
            """))
            print("  ✓ New unique constraint created")
        else:
            print("  ✓ Unique constraint already exists, skipping")

        # Step 5: Create indexes for performance (idempotent)
        print("Creating performance indexes...")
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_crypto_klines_environment ON crypto_klines(environment)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_crypto_klines_symbol_period_env ON crypto_klines(symbol, period, environment)
        """))

        db.commit()
        print("Migration completed successfully!")
        print("All existing K-line data has been marked as 'mainnet' environment")

    except Exception as e:
        db.rollback()
        print(f"Migration failed: {e}")
        raise
    finally:
        db.close()


def downgrade():
    """Rollback the migration"""
    print("Starting rollback: add_environment_to_crypto_klines")

    db = SessionLocal()
    try:
        # Step 1: Drop new unique constraint
        print("Dropping new unique constraint...")
        db.execute(text("""
            ALTER TABLE crypto_klines
            DROP CONSTRAINT IF EXISTS crypto_klines_exchange_symbol_market_period_timestamp_environment_key
        """))

        # Step 2: Recreate old unique constraint
        print("Recreating old unique constraint...")
        db.execute(text("""
            ALTER TABLE crypto_klines
            ADD CONSTRAINT crypto_klines_exchange_symbol_market_period_timestamp_key
            UNIQUE (exchange, symbol, market, period, timestamp)
        """))

        # Step 3: Drop performance indexes
        print("Dropping performance indexes...")
        db.execute(text("""
            DROP INDEX IF EXISTS idx_crypto_klines_environment
        """))
        db.execute(text("""
            DROP INDEX IF EXISTS idx_crypto_klines_symbol_period_env
        """))

        # Step 4: Drop environment column
        print("Dropping environment column...")
        db.execute(text("""
            ALTER TABLE crypto_klines DROP COLUMN IF EXISTS environment
        """))

        db.commit()
        print("Rollback completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"Rollback failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='Crypto Klines Environment Migration')
    parser.add_argument('--rollback', action='store_true', help='Rollback the migration')
    args = parser.parse_args()

    if args.rollback:
        downgrade()
    else:
        upgrade()