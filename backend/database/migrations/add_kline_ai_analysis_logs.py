"""
Create table kline_ai_analysis_logs
"""

from sqlalchemy import Table, Column, Integer, String, Text, TIMESTAMP, ForeignKey, func
from sqlalchemy import MetaData
from database.connection import engine


def upgrade():
    metadata = MetaData()
    metadata.bind = engine

    # Define tables for foreign keys
    users = Table('users', metadata, autoload_with=engine)
    accounts = Table('accounts', metadata, autoload_with=engine)

    kline_ai_analysis_logs = Table('kline_ai_analysis_logs', metadata,
        Column('id', Integer, primary_key=True, index=True),
        Column('user_id', Integer, ForeignKey(users.c.id), nullable=False, index=True),
        Column('account_id', Integer, ForeignKey(accounts.c.id), nullable=False, index=True),
        Column('symbol', String(20), nullable=False, index=True),
        Column('period', String(10), nullable=False),
        Column('user_message', Text, nullable=True),
        Column('model_used', String(100), nullable=False),
        Column('prompt_snapshot', Text, nullable=True),
        Column('analysis_result', Text, nullable=True),
        Column('created_at', TIMESTAMP, server_default=func.current_timestamp(), index=True),
    )

    kline_ai_analysis_logs.create(bind=engine, checkfirst=True)


def downgrade():
    metadata = MetaData()
    metadata.bind = engine
    kline_ai_analysis_logs = Table('kline_ai_analysis_logs', metadata, autoload_with=engine)
    kline_ai_analysis_logs.drop(bind=engine, checkfirst=True)

