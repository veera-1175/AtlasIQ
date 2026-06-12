"""Celery application for async long-running queries."""

from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "atlasiq",
    broker=settings.celery_broker_url or "memory://",
    backend=settings.celery_result_backend or "cache+memory://",
    include=["app.worker.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_soft_time_limit=settings.celery_task_soft_time_limit,
    task_time_limit=settings.celery_task_time_limit,
    task_track_started=True,
    worker_prefetch_multiplier=1,
    task_routes={"app.worker.tasks.run_query_async": {"queue": "queries"}},
)
