"""
Environment and configuration tests
"""
import os
import sys
import pytest


def test_environment_variables():
    """Test that environment variables are properly read"""
    # Test default values
    os.environ.pop('MQTT_HOST', None)
    os.environ.pop('MQTT_BROKER', None)
    os.environ.pop('MQTT_PORT', None)
    
    # Import after clearing env vars
    import importlib
    import congestion_service
    
    # Reload to pick up default values
    importlib.reload(congestion_service)
    
    assert congestion_service.MQTT_BROKER == "localhost"
    assert congestion_service.MQTT_PORT == 1883
    
    # Test with environment variables
    os.environ['MQTT_BROKER'] = 'test-broker'
    os.environ['MQTT_PORT'] = '1884'
    
    importlib.reload(congestion_service)
    
    assert congestion_service.MQTT_BROKER == "test-broker"
    assert congestion_service.MQTT_PORT == 1884
    
    # Test MQTT_HOST takes precedence
    os.environ['MQTT_HOST'] = 'alt-broker'
    
    importlib.reload(congestion_service)
    
    assert congestion_service.MQTT_BROKER == "alt-broker"


def test_mqtt_topics():
    """Test MQTT topic configuration"""
    from congestion_service import MQTT_TOPICS
    
    assert isinstance(MQTT_TOPICS, list)
    assert len(MQTT_TOPICS) > 0
    assert "stadium/crowd/gate-updates" in MQTT_TOPICS


def test_service_startup():
    """Test service startup sequence"""
    from congestion_service import app
    
    # Check that startup event is registered
    startup_events = [route for route in app.router.on_startup]
    assert len(startup_events) > 0


def test_cors_configuration():
    """Test CORS middleware is configured"""
    from congestion_service import app
    from fastapi.middleware.cors import CORSMiddleware

    # Find the CORS middleware in the app's stack
    cors_middleware = None
    for middleware in app.user_middleware:
        if middleware.cls == CORSMiddleware:
            cors_middleware = middleware
            break

    assert cors_middleware is not None, "CORS middleware is not configured"

    # Access the middleware's configuration correctly
    # In Starlette/FastAPI, the options are stored in the middleware instance
    # We need to check the actual structure by examining the middleware
    
    # The middleware object has a 'options' attribute or it's stored in kwargs
    config = {}
    
    # Try different ways to access the configuration based on Starlette version
    if hasattr(cors_middleware, 'options'):
        config = cors_middleware.options
    elif hasattr(cors_middleware, '__dict__'):
        config = cors_middleware.__dict__.get('options', {})
    
    if not config and hasattr(cors_middleware, '__getitem__'):
        try:
            # Might be (cls, options) tuple
            config = cors_middleware[1]
        except (TypeError, IndexError):
            pass
    
    # Verify the configuration
    assert cors_middleware is not None
    
    # Alternative: Test CORS functionality directly with a request
    from fastapi.testclient import TestClient
    client = TestClient(app)
    
    # Make a request with Origin header and check CORS headers are present
    response = client.get("/", headers={"Origin": "http://test-client.com"})
    
    # The important CORS headers should be present
    assert response.headers.get("access-control-allow-origin") == "*"
    assert response.headers.get("access-control-allow-credentials") == "true"