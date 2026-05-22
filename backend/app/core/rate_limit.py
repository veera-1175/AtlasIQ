import time
from collections import defaultdict

from fastapi import HTTPException, Request

from app.core.config import get_settings
from app.core.redis_client import get_redis

_hits: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(request: Request, user_id: str | None = None) -> None:
    settings = get_settings()
    limit = settings.rate_limit_per_hour
    key = user_id or (request.client.host if request.client else "unknown")
    now = time.time()
    window = 3600

    r = get_redis()
    if r:
        redis_key = f"atlasiq:ratelimit:{key}"
        pipe = r.pipeline()
        pipe.zremrangebyscore(redis_key, 0, now - window)
        pipe.zadd(redis_key, {str(now): now})
        pipe.zcard(redis_key)
        pipe.expire(redis_key, window + 60)
        _, _, count, _ = pipe.execute()
        if count > limit:
            raise HTTPException(status_code=429, detail=f"Rate limit exceeded ({limit} queries/hour)")
        return

    _hits[key] = [t for t in _hits[key] if now - t < window]
    if len(_hits[key]) >= limit:
        raise HTTPException(status_code=429, detail=f"Rate limit exceeded ({limit} queries/hour)")
    _hits[key].append(now)
