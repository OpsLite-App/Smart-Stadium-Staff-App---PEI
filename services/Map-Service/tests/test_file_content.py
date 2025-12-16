"""
Test file contents and syntax.
"""
import ast
import os

def test_python_syntax():
    """Test that Python files have valid syntax."""
    python_files = [
        'ApiHandler.py',
        'config.py',
        'database.py',
        'models.py',
        'load_data_db.py',
        'visualize.py',
    ]
    
    for file in python_files:
        if os.path.exists(file):
            with open(file, 'r') as f:
                try:
                    ast.parse(f.read(), filename=file)
                    print(f"✓ {file} has valid Python syntax")
                except SyntaxError as e:
                    print(f"✗ {file} has syntax error: {e}")
                    raise
        else:
            print(f"⚠️  {file} not found, skipping syntax check")

def test_env_file():
    """Test .env.example if it exists."""
    env_example = '.env.example'
    env_file = '.env'
    
    if os.path.exists(env_example):
        with open(env_example, 'r') as f:
            content = f.read()
            assert 'DATABASE_URI' in content or 'postgresql' in content, \
                   ".env.example should contain DATABASE_URI"
        print("✓ .env.example test passed")
    
    if os.path.exists(env_file):
        print("✓ .env file exists")
    else:
        print("⚠️  .env file not found (run 'cp .env.example .env' to create)")

def test_readme():
    """Test README.md exists and has content."""
    assert os.path.exists('README.md'), "README.md not found"
    
    with open('README.md', 'r') as f:
        content = f.read()
        assert content, "README.md is empty"
        assert 'Map-Service' in content, "README should mention Map-Service"
        assert 'docker-compose' in content, "README should mention docker-compose"
    
    print("✓ README test passed")

def test_wait_script():
    """Test wait-for-postgres.sh exists and is executable."""
    if os.path.exists('wait-for-postgres.sh'):
        with open('wait-for-postgres.sh', 'r') as f:
            content = f.read()
            assert '#!/bin/sh' in content, "wait-for-postgres.sh should start with #!/bin/sh"
            assert 'pg_isready' in content, "wait-for-postgres.sh should use pg_isready"
        
        # Check if executable (not required but good practice)
        if os.access('wait-for-postgres.sh', os.X_OK):
            print("✓ wait-for-postgres.sh is executable")
        else:
            print("⚠️  wait-for-postgres.sh is not executable (run 'chmod +x wait-for-postgres.sh')")
    else:
        print("⚠️  wait-for-postgres.sh not found")

if __name__ == "__main__":
    test_python_syntax()
    test_env_file()
    test_readme()
    test_wait_script()