"""
Migration: Add user-level prompt template support

This migration adds the following fields to prompt_templates:
- is_system: Mark system templates (default, pro, hyperliquid) as protected
- is_deleted: Soft delete support for user-created templates
- created_by: Track who created the template

Changes:
1. Add new columns to prompt_templates table
2. Mark existing templates as system templates
3. Remove unique constraint on 'key' field to allow duplicates

Safety:
- All existing templates are preserved
- All existing bindings remain unchanged
- Backward compatible with existing code
"""

from sqlalchemy import text
from database.connection import SessionLocal


def upgrade():
    """Apply migration"""
    db = SessionLocal()

    try:
        print("Starting migration: add_prompt_template_fields")

        # Step 1: Add new columns
        print("Step 1: Adding new columns to prompt_templates...")
        db.execute(text("""
            ALTER TABLE prompt_templates
            ADD COLUMN IF NOT EXISTS is_system VARCHAR(10) DEFAULT 'false',
            ADD COLUMN IF NOT EXISTS is_deleted VARCHAR(10) DEFAULT 'false',
            ADD COLUMN IF NOT EXISTS created_by VARCHAR(100) DEFAULT 'system'
        """))
        db.commit()
        print("  ✓ New columns added successfully")

        # Step 2: Mark existing templates as system templates
        print("Step 2: Marking existing templates as system templates...")
        result = db.execute(text("""
            UPDATE prompt_templates
            SET is_system = 'true', created_by = 'system'
            WHERE key IN ('default', 'pro', 'hyperliquid')
        """))
        db.commit()
        print(f"  ✓ Marked {result.rowcount} templates as system templates")

        # Step 3: Drop unique constraint on 'key' column
        print("Step 3: Removing unique constraint on 'key' column...")
        try:
            # Try to drop the constraint (constraint name may vary)
            db.execute(text("""
                ALTER TABLE prompt_templates
                DROP CONSTRAINT IF EXISTS prompt_templates_key_key
            """))
            db.commit()
            print("  ✓ Unique constraint removed successfully")
        except Exception as e:
            print(f"  ⚠ Could not remove unique constraint (may not exist): {e}")
            db.rollback()

        # Verify migration
        print("\nVerifying migration...")
        result = db.execute(text("""
            SELECT
                id,
                key,
                name,
                is_system,
                is_deleted,
                created_by
            FROM prompt_templates
            ORDER BY id
        """))

        print("\nCurrent prompt templates:")
        print("-" * 100)
        for row in result:
            print(f"ID: {row.id} | Key: {row.key:15} | Name: {row.name:25} | System: {row.is_system} | Deleted: {row.is_deleted} | Created by: {row.created_by}")
        print("-" * 100)

        print("\n✅ Migration completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        db.close()


def downgrade():
    """Rollback migration"""
    db = SessionLocal()

    try:
        print("Rolling back migration: add_prompt_template_fields")

        # Drop added columns
        db.execute(text("""
            ALTER TABLE prompt_templates
            DROP COLUMN IF EXISTS is_system,
            DROP COLUMN IF EXISTS is_deleted,
            DROP COLUMN IF EXISTS created_by
        """))
        db.commit()

        print("✅ Migration rolled back successfully!")

    except Exception as e:
        db.rollback()
        print(f"❌ Rollback failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
