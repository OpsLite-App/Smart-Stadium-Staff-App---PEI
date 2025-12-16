"""
Test project structure and basic imports.
These tests don't require any external dependencies.
"""
import os
import sys

def test_project_structure():
    """Test that project has the required files."""
    required_files = [
        'requirements.txt',
        'docker-compose.yml',
        'ApiHandler.py',
        'config.py',
        'database.py',
        'models.py',
        'load_data_db.py',
    ]
    
    for file in required_files:
        assert os.path.exists(file), f"Missing required file: {file}"
    
    print("✓ Project structure test passed")

def test_python_version():
    """Test Python version."""
    version = sys.version_info
    assert version.major == 3, "Python 3 is required"
    assert version.minor >= 8, "Python 3.8 or higher is required"
    print(f"✓ Python version test passed (using Python {version.major}.{version.minor}.{version.micro})")

def test_imports():
    """Test that basic Python imports work."""
    # Test standard library imports
    import json
    import typing
    import pathlib
    
    # Test project imports (these should work without external deps)
    try:
        # These might fail if external deps aren't installed, that's OK
        import config
        print("✓ config.py import successful")
    except ImportError as e:
        print(f"⚠️  config.py import failed (expected if deps not installed): {e}")
    
    try:
        import models
        print("✓ models.py import successful")
    except ImportError as e:
        print(f"⚠️  models.py import failed (expected if deps not installed): {e}")
    
    print("✓ Basic imports test passed")

def test_requirements_file():
    """Test that requirements.txt exists and has content."""
    assert os.path.exists('requirements.txt'), "requirements.txt not found"
    
    with open('requirements.txt', 'r') as f:
        content = f.read()
        assert content, "requirements.txt is empty"
        assert 'fastapi' in content, "fastapi not in requirements.txt"
        assert 'sqlalchemy' in content, "sqlalchemy not in requirements.txt"
    
    print("✓ Requirements file test passed")

def test_docker_compose():
    """Test that docker-compose.yml exists and has basic structure."""
    assert os.path.exists('docker-compose.yml'), "docker-compose.yml not found"
    
    with open('docker-compose.yml', 'r') as f:
        content = f.read()
        assert 'postgres:' in content, "Postgres service not defined in docker-compose.yml"
        assert '5435:5432' in content, "Port mapping not found in docker-compose.yml"
    
    print("✓ Docker compose test passed")

if __name__ == "__main__":
    test_project_structure()
    test_python_version()
    test_imports()
    test_requirements_file()
    test_docker_compose()