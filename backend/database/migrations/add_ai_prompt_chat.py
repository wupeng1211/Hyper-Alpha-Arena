#!/usr/bin/env python3
"""
Migration: Add AI Prompt Generation Chat System Tables
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import create_engine, text
from database.connection import DATABASE_URL

def migrate():
    """Add AI prompt generation conversation and message tables"""
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        # 1. Create ai_prompt_conversations table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS ai_prompt_conversations (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                title VARCHAR(200) NOT NULL DEFAULT 'New Strategy Prompt',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))

        # 2. Create indexes for conversations table
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_ai_prompt_conversations_user_id
            ON ai_prompt_conversations(user_id);

            CREATE INDEX IF NOT EXISTS idx_ai_prompt_conversations_created_at
            ON ai_prompt_conversations(created_at DESC);
        """))

        # 3. Create ai_prompt_messages table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS ai_prompt_messages (
                id SERIAL PRIMARY KEY,
                conversation_id INTEGER NOT NULL REFERENCES ai_prompt_conversations(id) ON DELETE CASCADE,
                role VARCHAR(20) NOT NULL,
                content TEXT NOT NULL,
                prompt_result TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))

        # 4. Create indexes for messages table
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_ai_prompt_messages_conversation_id
            ON ai_prompt_messages(conversation_id);

            CREATE INDEX IF NOT EXISTS idx_ai_prompt_messages_created_at
            ON ai_prompt_messages(created_at);
        """))

        # 5. Add check constraint for role field
        conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'check_ai_prompt_message_role'
                ) THEN
                    ALTER TABLE ai_prompt_messages
                    ADD CONSTRAINT check_ai_prompt_message_role
                    CHECK (role IN ('user', 'assistant'));
                END IF;
            END $$;
        """))

        conn.commit()
        print("✅ AI Prompt Chat system database structure created successfully")
        print("   - ai_prompt_conversations table created")
        print("   - ai_prompt_messages table created")
        print("   - Indexes and constraints added")

def upgrade():
    """Entry point for migration manager"""
    migrate()

if __name__ == "__main__":
    migrate()
