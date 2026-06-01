"""
Redis Cache Configuration Module
Provides caching utilities for all microservices
"""

import os
import json
import redis
import logging
from typing import Any, Optional, Callable
from functools import wraps
from datetime import date, datetime

logger = logging.getLogger(__name__)


def _json_default(value: Any) -> Any:
    """Convert common API response objects into JSON-safe values."""
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if hasattr(value, "dict"):
        return value.dict()
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")

# ========== REDIS CONNECTION ==========

class RedisCache:
    """Singleton Redis cache manager"""
    _instance = None
    _redis_client = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RedisCache, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._redis_client is None:
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
            redis_host = os.getenv("REDIS_HOST", "localhost")
            redis_port = int(os.getenv("REDIS_PORT", "6379"))
            redis_db = int(os.getenv("REDIS_DB", "0"))
            
            try:
                # Try URL first, then fallback to host/port
                if redis_url.startswith("redis://"):
                    self._redis_client = redis.from_url(redis_url, decode_responses=True)
                else:
                    self._redis_client = redis.Redis(
                        host=redis_host,
                        port=redis_port,
                        db=redis_db,
                        decode_responses=True
                    )
                
                # Test connection
                self._redis_client.ping()
                logger.info("Redis connection established: %s:%s/%s", redis_host, redis_port, redis_db)
            except Exception as e:
                logger.warning("Redis connection failed; cache will be disabled: %s", e)
                self._redis_client = None
    
    def get_client(self):
        """Get Redis client instance"""
        return self._redis_client
    
    def is_available(self):
        """Check if Redis is available"""
        return self._redis_client is not None
    
    def set(self, key: str, value: Any, ttl: int = 300):
        """
        Set a value in cache
        
        Args:
            key: Cache key
            value: Value to cache (will be JSON serialized)
            ttl: Time to live in seconds (default: 5 minutes)
        """
        if not self.is_available():
            return False
        
        try:
            json_value = json.dumps(value, default=_json_default)
            self._redis_client.setex(key, ttl, json_value)
            logger.debug("Cache entry stored: key=%s ttl_seconds=%s", key, ttl)
            return True
        except Exception as e:
            logger.warning("Cache write failed: key=%s error=%s", key, e)
            return False
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get a value from cache
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found
        """
        if not self.is_available():
            return None
        
        try:
            value = self._redis_client.get(key)
            if value:
                logger.debug(f"✨ Cache hit: {key}")
                return json.loads(value)
            logger.debug(f"⭕ Cache miss: {key}")
            return None
        except Exception as e:
            logger.warning("Cache read failed: key=%s error=%s", key, e)
            return None
    
    def delete(self, key: str):
        """Delete a key from cache"""
        if not self.is_available():
            return False
        
        try:
            self._redis_client.delete(key)
            logger.debug("Cache entry deleted: key=%s", key)
            return True
        except Exception as e:
            logger.warning("Cache delete failed: key=%s error=%s", key, e)
            return False
    
    def clear_pattern(self, pattern: str):
        """Clear all keys matching a pattern"""
        if not self.is_available():
            return 0
        
        try:
            keys = self._redis_client.keys(pattern)
            if keys:
                count = self._redis_client.delete(*keys)
                logger.debug("Cache entries cleared: count=%s pattern=%s", count, pattern)
                return count
            return 0
        except Exception as e:
            logger.warning("Cache pattern clear failed: pattern=%s error=%s", pattern, e)
            return 0
    
    def flush(self):
        """Flush entire cache database"""
        if not self.is_available():
            return False
        
        try:
            self._redis_client.flushdb()
            logger.info("Cache flushed")
            return True
        except Exception as e:
            logger.warning("Cache flush failed: %s", e)
            return False


# ========== DECORATOR FOR CACHING ==========

def cache_result(ttl: int = 300, key_prefix: str = ""):
    """
    Decorator to cache function results
    
    Args:
        ttl: Time to live in seconds
        key_prefix: Prefix for cache key
        
    Usage:
        @cache_result(ttl=600, key_prefix="heatmap")
        def get_heatmap():
            return expensive_calculation()
    """
    def decorator(func: Callable):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            cache = RedisCache()
            
            # Build cache key
            cache_key = f"{key_prefix}:{func.__name__}:{str(args)}:{str(kwargs)}"
            cache_key = cache_key.replace(" ", "")  # Remove spaces
            
            # Try to get from cache
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Call function and cache result
            result = await func(*args, **kwargs)
            cache.set(cache_key, result, ttl)
            
            return result
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            cache = RedisCache()
            
            # Build cache key
            cache_key = f"{key_prefix}:{func.__name__}:{str(args)}:{str(kwargs)}"
            cache_key = cache_key.replace(" ", "")  # Remove spaces
            
            # Try to get from cache
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Call function and cache result
            result = func(*args, **kwargs)
            cache.set(cache_key, result, ttl)
            
            return result
        
        # Return appropriate wrapper
        import asyncio
        import inspect
        if inspect.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


# ========== INITIALIZATION ==========

# Initialize Redis cache on import
redis_cache = RedisCache()

logger.info("Cache module initialized")
