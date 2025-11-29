from __future__ import annotations

from typing import List, Optional, Tuple
from datetime import datetime

from sqlalchemy.orm import Session
from sqlalchemy import select

from database.models import PromptTemplate, AccountPromptBinding, Account


def get_all_templates(db: Session, include_deleted: bool = False) -> List[PromptTemplate]:
    """Get all prompt templates, excluding deleted ones by default"""
    statement = select(PromptTemplate)
    if not include_deleted:
        statement = statement.where(PromptTemplate.is_deleted == "false")
    statement = statement.order_by(PromptTemplate.created_at.desc())
    return list(db.execute(statement).scalars().all())


def get_template_by_key(db: Session, key: str) -> Optional[PromptTemplate]:
    statement = select(PromptTemplate).where(PromptTemplate.key == key)
    return db.execute(statement).scalar_one_or_none()


def create_template(
    db: Session,
    *,
    key: str,
    name: str,
    description: Optional[str],
    template_text: str,
    system_template_text: Optional[str] = None,
    updated_by: Optional[str] = None,
) -> PromptTemplate:
    template = PromptTemplate(
        key=key,
        name=name,
        description=description,
        template_text=template_text,
        system_template_text=system_template_text or template_text,
        updated_by=updated_by,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


def update_template(
    db: Session,
    *,
    key: str,
    template_text: str,
    description: Optional[str] = None,
    updated_by: Optional[str] = None,
) -> PromptTemplate:
    template = get_template_by_key(db, key)
    if not template:
        raise ValueError(f"Prompt template with key '{key}' not found")
    template.template_text = template_text
    if description is not None:
        template.description = description
    template.updated_by = updated_by
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


def restore_template(db: Session, *, key: str, updated_by: Optional[str] = None) -> PromptTemplate:
    template = get_template_by_key(db, key)
    if not template:
        raise ValueError(f"Prompt template with key '{key}' not found")
    template.template_text = template.system_template_text
    template.updated_by = updated_by
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


def list_bindings(db: Session) -> List[Tuple[AccountPromptBinding, Account, PromptTemplate]]:
    statement = (
        select(AccountPromptBinding, Account, PromptTemplate)
        .join(Account, AccountPromptBinding.account_id == Account.id)
        .join(PromptTemplate, AccountPromptBinding.prompt_template_id == PromptTemplate.id)
        .order_by(Account.name.asc())
    )
    return list(db.execute(statement).all())


def get_binding_by_account(db: Session, account_id: int) -> Optional[AccountPromptBinding]:
    statement = select(AccountPromptBinding).where(AccountPromptBinding.account_id == account_id)
    return db.execute(statement).scalar_one_or_none()


def upsert_binding(
    db: Session,
    *,
    account_id: int,
    prompt_template_id: int,
    updated_by: Optional[str] = None,
) -> AccountPromptBinding:
    binding = get_binding_by_account(db, account_id)

    if binding:
        binding.prompt_template_id = prompt_template_id
        binding.updated_by = updated_by
    else:
        binding = AccountPromptBinding(
            account_id=account_id,
            prompt_template_id=prompt_template_id,
            updated_by=updated_by,
        )
        db.add(binding)

    db.commit()
    db.refresh(binding)
    return binding


def delete_binding(db: Session, binding_id: int) -> None:
    binding = db.get(AccountPromptBinding, binding_id)
    if not binding:
        raise ValueError(f"Prompt binding with id '{binding_id}' not found")
    db.delete(binding)
    db.commit()


def get_prompt_for_account(db: Session, account_id: int) -> Optional[PromptTemplate]:
    binding = get_binding_by_account(db, account_id)
    if binding:
        template = db.get(PromptTemplate, binding.prompt_template_id)
        if template:
            return template
    return None


def ensure_default_prompt(db: Session) -> PromptTemplate:
    template = get_template_by_key(db, "default")
    if not template:
        raise ValueError("Default prompt template not found")
    return template


def _generate_unique_key(db: Session, base_key: str) -> str:
    """Generate a unique key by appending timestamp and counter if needed"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    key = f"{base_key}-{timestamp}"

    # Check if key exists
    counter = 1
    original_key = key
    while get_template_by_key(db, key) is not None:
        key = f"{original_key}-{counter}"
        counter += 1

    return key


def copy_template(
    db: Session,
    *,
    template_id: int,
    new_name: Optional[str] = None,
    created_by: str = "ui",
) -> PromptTemplate:
    """Copy an existing template to create a new user template"""
    source = db.get(PromptTemplate, template_id)
    if not source:
        raise ValueError(f"Prompt template with id '{template_id}' not found")

    # Generate unique key based on source key
    new_key = _generate_unique_key(db, source.key)

    # Create copy
    copy_name = new_name or f"{source.name} (Copy)"
    new_template = PromptTemplate(
        key=new_key,
        name=copy_name,
        description=source.description,
        template_text=source.template_text,
        system_template_text=source.template_text,  # Use current text as system template
        is_system="false",
        is_deleted="false",
        created_by=created_by,
        updated_by=created_by,
    )

    db.add(new_template)
    db.commit()
    db.refresh(new_template)
    return new_template


def create_user_template(
    db: Session,
    *,
    name: str,
    description: Optional[str] = None,
    template_text: str = "",
    created_by: str = "ui",
) -> PromptTemplate:
    """Create a new user template from scratch"""
    # Generate unique key based on name
    base_key = name.lower().replace(" ", "-").replace("_", "-")[:50]
    new_key = _generate_unique_key(db, base_key)

    # Use default template as starting point if empty
    if not template_text:
        default_template = ensure_default_prompt(db)
        template_text = default_template.template_text

    new_template = PromptTemplate(
        key=new_key,
        name=name,
        description=description,
        template_text=template_text,
        system_template_text=template_text,
        is_system="false",
        is_deleted="false",
        created_by=created_by,
        updated_by=created_by,
    )

    db.add(new_template)
    db.commit()
    db.refresh(new_template)
    return new_template


def soft_delete_template(db: Session, template_id: int) -> None:
    """Soft delete a template (mark as deleted)"""
    template = db.get(PromptTemplate, template_id)
    if not template:
        raise ValueError(f"Prompt template with id '{template_id}' not found")

    if template.is_system == "true":
        raise ValueError("Cannot delete system templates")

    # Check if template is in use
    binding = db.execute(
        select(AccountPromptBinding).where(AccountPromptBinding.prompt_template_id == template_id)
    ).scalar_one_or_none()

    if binding:
        raise ValueError(
            f"Cannot delete template '{template.name}' - it is currently bound to an account"
        )

    template.is_deleted = "true"
    db.add(template)
    db.commit()


def update_template_name(
    db: Session,
    *,
    template_id: int,
    name: str,
    description: Optional[str] = None,
    updated_by: Optional[str] = None,
) -> PromptTemplate:
    """Update template name and description"""
    template = db.get(PromptTemplate, template_id)
    if not template:
        raise ValueError(f"Prompt template with id '{template_id}' not found")

    template.name = name
    if description is not None:
        template.description = description
    template.updated_by = updated_by

    db.add(template)
    db.commit()
    db.refresh(template)
    return template
