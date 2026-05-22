import hashlib
import json
import time
from typing import Any

from app.core.redis_client import get_redis

_memory_cache: dict[str, tuple[float, Any]] = {}


def _cache_key(prefix: str, payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True, default=str)
    digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"atlasiq:{prefix}:{digest}"


def cache_get(prefix: str, payload: dict[str, Any], ttl_sec: int = 300) -> Any | None:
    key = _cache_key(prefix, payload)
    r = get_redis()
    if r:
        val = r.get(key)
        return json.loads(val) if val else None

    entry = _memory_cache.get(key)
    if not entry:
        return None
    ts, val = entry
    if time.time() - ts > ttl_sec:
        _memory_cache.pop(key, None)
        return None
    return val


def cache_set(prefix: str, payload: dict[str, Any], value: Any, ttl_sec: int = 300) -> None:
    key = _cache_key(prefix, payload)
    r = get_redis()
    if r:
        r.setex(key, ttl_sec, json.dumps(value, default=str))
        return
    _memory_cache[key] = (time.time(), value)
