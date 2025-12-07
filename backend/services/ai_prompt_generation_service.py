"""
AI Prompt Generation Service - Handles AI-powered trading prompt generation
"""
import logging
import os
import re
import time
from typing import Dict, List, Optional

import requests
from sqlalchemy.orm import Session

from database.models import Account, AiPromptConversation, AiPromptMessage
from services.ai_decision_service import build_chat_completion_endpoints, _extract_text_from_message

logger = logging.getLogger(__name__)

# Path to system prompt file
SYSTEM_PROMPT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "config",
    "prompt_generation_system_prompt.md"
)


def load_system_prompt() -> str:
    """Load the system prompt from markdown file"""
    try:
        with open(SYSTEM_PROMPT_PATH, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        logger.error(f"Failed to load system prompt: {e}")
        return "You are a trading strategy prompt generation assistant."


def extract_prompt_from_response(content: str) -> Optional[str]:
    """
    Extract prompt content from ```prompt code block

    Args:
        content: Full assistant response (markdown)

    Returns:
        Extracted prompt text or None if no prompt block found
    """
    # Match ```prompt ... ``` code block
    pattern = r'```prompt\s*\n(.*?)\n```'
    match = re.search(pattern, content, re.DOTALL)

    if match:
        return match.group(1).strip()

    return None


def generate_prompt_with_ai(
    db: Session,
    account: Account,
    user_message: str,
    conversation_id: Optional[int] = None,
    user_id: int = 1,
) -> Dict:
    """
    Generate or modify trading strategy prompt using AI

    Args:
        db: Database session
        account: AI Trader account to use for model configuration
        user_message: User's input message
        conversation_id: Optional conversation ID to continue existing conversation
        user_id: User ID making the request

    Returns:
        Dictionary with:
        - success: bool
        - conversation_id: int
        - message_id: int (the assistant's message ID)
        - content: str (full assistant response in markdown)
        - prompt_result: str or None (extracted prompt from code block)
        - error: str (if failed)
    """
    start_time = time.time()
    request_id = f"prompt_gen_{int(start_time)}"

    logger.info(f"[AI Prompt Gen {request_id}] Starting: account={account.name}, "
                f"conversation_id={conversation_id}, user_message_length={len(user_message)}")

    try:
        # Load system prompt
        system_prompt = load_system_prompt()

        # Get or create conversation
        conversation = None
        if conversation_id:
            conversation = db.query(AiPromptConversation).filter(
                AiPromptConversation.id == conversation_id,
                AiPromptConversation.user_id == user_id
            ).first()

            if not conversation:
                logger.warning(f"[AI Prompt Gen {request_id}] Conversation {conversation_id} not found, creating new")

        if not conversation:
            # Create new conversation
            # Extract first 50 chars of user message as title
            title = user_message[:50] + "..." if len(user_message) > 50 else user_message
            conversation = AiPromptConversation(
                user_id=user_id,
                title=title
            )
            db.add(conversation)
            db.flush()  # Get conversation ID
            logger.info(f"[AI Prompt Gen {request_id}] Created new conversation: id={conversation.id}")

        # Save user message
        user_msg = AiPromptMessage(
            conversation_id=conversation.id,
            role="user",
            content=user_message
        )
        db.add(user_msg)
        db.flush()

        # Build message history
        messages = []

        # System message
        messages.append({
            "role": "system",
            "content": system_prompt
        })

        # Load conversation history (excluding the just-added user message)
        history_messages = db.query(AiPromptMessage).filter(
            AiPromptMessage.conversation_id == conversation.id,
            AiPromptMessage.id != user_msg.id
        ).order_by(AiPromptMessage.created_at).limit(10).all()  # Limit to last 10 messages

        for msg in history_messages:
            messages.append({
                "role": msg.role,
                "content": msg.content
            })

        # Add current user message
        messages.append({
            "role": "user",
            "content": user_message
        })

        logger.info(f"[AI Prompt Gen {request_id}] Built message context: {len(messages)} messages total")

        # Call LLM API
        endpoints = build_chat_completion_endpoints(account.base_url, account.model)

        if not endpoints:
            return {
                "success": False,
                "error": "Invalid base_url configuration"
            }

        # Prepare request payload
        request_payload = {
            "model": account.model,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 4096,
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {account.api_key}"
        }

        # Try endpoints
        response = None
        last_error = None

        for endpoint in endpoints:
            try:
                logger.info(f"[AI Prompt Gen {request_id}] Trying endpoint: {endpoint}")
                api_start = time.time()

                response = requests.post(
                    endpoint,
                    json=request_payload,
                    headers=headers,
                    timeout=120
                )

                api_elapsed = time.time() - api_start

                if response.status_code == 200:
                    logger.info(f"[AI Prompt Gen {request_id}] Success in {api_elapsed:.2f}s")
                    break
                else:
                    logger.warning(f"[AI Prompt Gen {request_id}] Endpoint failed: {response.status_code}")
                    last_error = f"HTTP {response.status_code}: {response.text[:200]}"

            except requests.exceptions.Timeout:
                last_error = "Request timeout"
                logger.warning(f"[AI Prompt Gen {request_id}] Timeout on {endpoint}")
            except Exception as e:
                last_error = str(e)
                logger.warning(f"[AI Prompt Gen {request_id}] Error on {endpoint}: {e}")

        if not response or response.status_code != 200:
            return {
                "success": False,
                "error": f"All endpoints failed. Last error: {last_error}"
            }

        # Parse response
        try:
            response_json = response.json()
            assistant_content = _extract_text_from_message(
                response_json["choices"][0]["message"]["content"]
            )
        except Exception as e:
            logger.error(f"[AI Prompt Gen {request_id}] Failed to parse response: {e}")
            return {
                "success": False,
                "error": f"Failed to parse AI response: {str(e)}"
            }

        # Extract prompt from code block (if present)
        prompt_result = extract_prompt_from_response(assistant_content)

        # Save assistant message
        assistant_msg = AiPromptMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=assistant_content,
            prompt_result=prompt_result
        )
        db.add(assistant_msg)
        db.commit()

        total_elapsed = time.time() - start_time
        logger.info(f"[AI Prompt Gen {request_id}] Completed in {total_elapsed:.2f}s: "
                   f"conversation_id={conversation.id}, has_prompt={prompt_result is not None}")

        return {
            "success": True,
            "conversation_id": conversation.id,
            "message_id": assistant_msg.id,
            "content": assistant_content,
            "prompt_result": prompt_result,
        }

    except Exception as e:
        logger.error(f"[AI Prompt Gen {request_id}] Unexpected error: {type(e).__name__}: {str(e)}",
                    exc_info=True)
        db.rollback()
        return {
            "success": False,
            "error": f"Internal error: {type(e).__name__}"
        }


def get_conversation_history(
    db: Session,
    user_id: int,
    limit: int = 20
) -> List[Dict]:
    """
    Get user's conversation history

    Args:
        db: Database session
        user_id: User ID
        limit: Maximum number of conversations to return

    Returns:
        List of conversation dictionaries
    """
    conversations = db.query(AiPromptConversation).filter(
        AiPromptConversation.user_id == user_id
    ).order_by(
        AiPromptConversation.updated_at.desc()
    ).limit(limit).all()

    result = []
    for conv in conversations:
        # Get message count
        msg_count = db.query(AiPromptMessage).filter(
            AiPromptMessage.conversation_id == conv.id
        ).count()

        result.append({
            "id": conv.id,
            "title": conv.title,
            "messageCount": msg_count,
            "createdAt": conv.created_at.isoformat() if conv.created_at else None,
            "updatedAt": conv.updated_at.isoformat() if conv.updated_at else None,
        })

    return result


def get_conversation_messages(
    db: Session,
    conversation_id: int,
    user_id: int
) -> Optional[List[Dict]]:
    """
    Get all messages in a conversation

    Args:
        db: Database session
        conversation_id: Conversation ID
        user_id: User ID (for authorization)

    Returns:
        List of message dictionaries or None if conversation not found/unauthorized
    """
    # Verify conversation belongs to user
    conversation = db.query(AiPromptConversation).filter(
        AiPromptConversation.id == conversation_id,
        AiPromptConversation.user_id == user_id
    ).first()

    if not conversation:
        return None

    messages = db.query(AiPromptMessage).filter(
        AiPromptMessage.conversation_id == conversation_id
    ).order_by(AiPromptMessage.created_at).all()

    result = []
    for msg in messages:
        result.append({
            "id": msg.id,
            "role": msg.role,
            "content": msg.content,
            "promptResult": msg.prompt_result,
            "createdAt": msg.created_at.isoformat() if msg.created_at else None,
        })

    return result
