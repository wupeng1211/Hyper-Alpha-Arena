#!/usr/bin/env python3
"""
Test script for prompt template migration and functionality
"""
import sys
import os
sys.path.append('/app/backend')

from database.connection import SessionLocal
from database.models import PromptTemplate, AccountPromptBinding
from repositories import prompt_repo
from sqlalchemy import text, inspect


def test_migration_executed():
    """Test that the migration has been executed"""
    print("=== Testing Migration Execution ===")

    db = SessionLocal()
    try:
        # Check if schema_migrations table exists
        result = db.execute(text("""
            SELECT COUNT(*) FROM information_schema.tables
            WHERE table_name = 'schema_migrations'
        """))
        if result.scalar() == 0:
            print("⚠️  schema_migrations table does not exist yet")
            return False

        # Check if our migration is recorded
        result = db.execute(text("""
            SELECT COUNT(*) FROM schema_migrations
            WHERE migration_name = 'add_prompt_template_fields.py'
        """))

        if result.scalar() > 0:
            print("✅ Migration 'add_prompt_template_fields.py' has been executed")
            return True
        else:
            print("⚠️  Migration 'add_prompt_template_fields.py' not yet executed")
            return False

    except Exception as e:
        print(f"⚠️  Could not check migration status: {e}")
        return False
    finally:
        db.close()


def test_table_structure():
    """Test that prompt_templates table has the new fields"""
    print("\n=== Testing Table Structure ===")

    db = SessionLocal()
    try:
        # Get table columns
        inspector = inspect(db.bind)
        columns = inspector.get_columns('prompt_templates')
        column_names = [col['name'] for col in columns]

        required_fields = ['is_system', 'is_deleted', 'created_by']
        missing_fields = [field for field in required_fields if field not in column_names]

        if missing_fields:
            print(f"❌ Missing fields: {missing_fields}")
            return False

        print(f"✅ All required fields exist: {required_fields}")

        # Check field types
        for col in columns:
            if col['name'] in required_fields:
                print(f"   - {col['name']}: {col['type']}")

        return True

    except Exception as e:
        print(f"❌ Table structure test failed: {e}")
        return False
    finally:
        db.close()


def test_system_templates():
    """Test that system templates are properly marked"""
    print("\n=== Testing System Templates ===")

    db = SessionLocal()
    try:
        templates = prompt_repo.get_all_templates(db)

        if len(templates) == 0:
            print("⚠️  No templates found (database might be empty)")
            return True  # Not an error for fresh install

        print(f"Found {len(templates)} templates:")

        system_templates = [t for t in templates if t.is_system == 'true']
        user_templates = [t for t in templates if t.is_system == 'false']

        print(f"  - System templates: {len(system_templates)}")
        for tpl in system_templates:
            print(f"    • {tpl.name} (key: {tpl.key})")

        print(f"  - User templates: {len(user_templates)}")
        for tpl in user_templates:
            print(f"    • {tpl.name} (key: {tpl.key})")

        # Check that default system templates exist
        expected_keys = ['default', 'pro', 'hyperliquid']
        existing_keys = [t.key for t in system_templates]

        for key in expected_keys:
            if key in existing_keys:
                print(f"✅ System template '{key}' exists")
            else:
                print(f"⚠️  System template '{key}' not found")

        return True

    except Exception as e:
        print(f"❌ System templates test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


def test_crud_operations():
    """Test CRUD operations on prompt templates"""
    print("\n=== Testing CRUD Operations ===")

    db = SessionLocal()
    try:
        # Test 1: Create a new template
        print("Test 1: Creating new template...")
        new_template = prompt_repo.create_user_template(
            db,
            name="Test Template",
            description="Test description",
            created_by="test_script"
        )
        print(f"✅ Created template: ID={new_template.id}, Name={new_template.name}")
        assert new_template.is_system == 'false'
        assert new_template.created_by == 'test_script'

        # Test 2: Copy a template
        print("\nTest 2: Copying template...")
        copied = prompt_repo.copy_template(
            db,
            template_id=new_template.id,
            new_name="Test Template Copy",
            created_by="test_script"
        )
        print(f"✅ Copied template: ID={copied.id}, Name={copied.name}")
        assert copied.id != new_template.id
        assert copied.template_text == new_template.template_text

        # Test 3: Update template name
        print("\nTest 3: Updating template name...")
        updated = prompt_repo.update_template_name(
            db,
            template_id=new_template.id,
            name="Updated Test Template",
            description="Updated description",
            updated_by="test_script"
        )
        print(f"✅ Updated template name: {updated.name}")
        assert updated.name == "Updated Test Template"

        # Test 4: Soft delete
        print("\nTest 4: Soft deleting template...")
        prompt_repo.soft_delete_template(db, copied.id)
        print(f"✅ Soft deleted template ID={copied.id}")

        # Verify it's marked as deleted
        deleted_tpl = db.get(PromptTemplate, copied.id)
        assert deleted_tpl.is_deleted == 'true'

        # Test 5: Verify it's excluded from get_all_templates
        print("\nTest 5: Verifying deleted template is excluded...")
        all_templates = prompt_repo.get_all_templates(db, include_deleted=False)
        deleted_ids = [t.id for t in all_templates if t.id == copied.id]
        assert len(deleted_ids) == 0
        print("✅ Deleted template is excluded from results")

        # Cleanup
        print("\nCleaning up test data...")
        db.delete(new_template)
        db.delete(deleted_tpl)
        db.commit()
        print("✅ Test data cleaned up")

        return True

    except Exception as e:
        print(f"❌ CRUD operations test failed: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()


def test_system_template_protection():
    """Test that system templates cannot be deleted"""
    print("\n=== Testing System Template Protection ===")

    db = SessionLocal()
    try:
        # Try to find a system template
        system_template = db.execute(
            text("SELECT id FROM prompt_templates WHERE is_system = 'true' LIMIT 1")
        ).scalar()

        if not system_template:
            print("⚠️  No system templates found to test protection")
            return True

        # Try to delete it (should fail)
        try:
            prompt_repo.soft_delete_template(db, system_template)
            print("❌ System template was deleted (should have been protected!)")
            return False
        except ValueError as e:
            if "Cannot delete system templates" in str(e):
                print("✅ System template protection works correctly")
                return True
            else:
                print(f"❌ Unexpected error: {e}")
                return False

    except Exception as e:
        print(f"❌ System template protection test failed: {e}")
        return False
    finally:
        db.close()


def main():
    """Run all tests"""
    print("🚀 Starting Prompt Template Migration Tests")
    print("=" * 60)

    results = []

    # Run tests
    results.append(("Migration Executed", test_migration_executed()))
    results.append(("Table Structure", test_table_structure()))
    results.append(("System Templates", test_system_templates()))
    results.append(("CRUD Operations", test_crud_operations()))
    results.append(("System Template Protection", test_system_template_protection()))

    # Summary
    print("\n" + "=" * 60)
    print("📊 Test Summary:")
    print("=" * 60)

    passed = 0
    failed = 0

    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
        if result:
            passed += 1
        else:
            failed += 1

    print("=" * 60)
    print(f"Total: {passed} passed, {failed} failed")

    if failed == 0:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {failed} test(s) failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
