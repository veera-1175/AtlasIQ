"""Shared Redis client for cache, rate limits, quotas, and job status."""

from typing import Any

_redis_client: Any | None = None
_redis_checked = False


def get_redis():
    global _redis_client, _redis_checked
    if _redis_checked:
        return _redis_client
    _redis_checked = True
    from app.core.config import get_settings

    url = get_settings().redis_url
    if not url:
        return None
    try:
        import redis

        client = redis.from_url(url, decode_responses=True)
        client.ping()
        _redis_client = client
    except Exception:
        _redis_client = None
    return _redis_client


def redis_available() -> bool:
    return get_redis() is not None
