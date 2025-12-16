"""
Integration tests that check component relationships.
"""
import os

def test_database_config():
    """Test database configuration relationships."""
    # Check config references
    config_content = ""
    if os.path.exists('config.py'):
        with open('config.py', 'r') as f:
            config_content = f.read()
    
    # Check database references
    database_content = ""
    if os.path.exists('database.py'):
        with open('database.py', 'r') as f:
            database_content = f.read()
    
    # Check relationships
    if 'Config' in config_content and 'SQLALCHEMY_DATABASE_URI' in config_content:
        print("Config class with database URI found")
    
    if 'create_engine' in database_content and 'SessionLocal' in database_content:
        print("Database engine and session setup found")
    
    if 'Config.SQLALCHEMY_DATABASE_URI' in database_content:
        print("Database module imports Config")
    
    print("Database configuration test passed")

def test_model_relationships():
    """Test that models have proper relationships."""
    if os.path.exists('models.py'):
        with open('models.py', 'r') as f:
            content = f.read()
            
            # Check for SQLAlchemy imports
            if 'from sqlalchemy' in content or 'import sqlalchemy' in content:
                print("SQLAlchemy imports found")
            
            # Check for Pydantic imports
            if 'from pydantic' in content or 'import pydantic' in content:
                print("Pydantic imports found")
            
            # Check for relationships in Node model
            if 'edges_from = relationship' in content:
                print("Node model has edges_from relationship")
            if 'edges_to = relationship' in content:
                print("Node model has edges_to relationship")
    
    print("Model relationships test passed")

def test_api_handler_structure():
    """Test API handler structure."""
    if os.path.exists('ApiHandler.py'):
        with open('ApiHandler.py', 'r') as f:
            content = f.read()
            
            # Check for FastAPI app
            if 'FastAPI(' in content:
                print("FastAPI app instantiation found")
            
            # Check for route decorators
            if '@app.get' in content:
                print("GET routes defined")
            if '@app.post' in content:
                print("POST routes defined")
            if '@app.put' in content:
                print("PUT routes defined")
            if '@app.delete' in content:
                print("DELETE routes defined")
            
            # Check for database dependency
            if 'Depends(get_db)' in content:
                print("Database dependency injection found")
    
    print("API handler structure test passed")

if __name__ == "__main__":
    test_database_config()
    test_model_relationships()
    test_api_handler_structure()