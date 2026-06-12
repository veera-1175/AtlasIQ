"""S3-compatible object storage for tenant uploads (horizontal scaling)."""

from pathlib import Path
from typing import BinaryIO

from app.core.config import get_settings


def storage_enabled() -> bool:
    s = get_settings()
    return s.object_storage_enabled and bool(s.s3_endpoint_url or s.s3_access_key)


def ensure_bucket() -> None:
    if not storage_enabled():
        return
    s = get_settings()
    client = _client()
    try:
        client.head_bucket(Bucket=s.s3_bucket)
    except Exception:
        client.create_bucket(Bucket=s.s3_bucket)


def _client():
    import boto3
    from botocore.client import Config

    s = get_settings()
    kwargs: dict = {
        "service_name": "s3",
        "aws_access_key_id": s.s3_access_key or None,
        "aws_secret_access_key": s.s3_secret_key or None,
        "region_name": s.s3_region,
        "config": Config(signature_version="s3v4"),
    }
    if s.s3_endpoint_url:
        kwargs["endpoint_url"] = s.s3_endpoint_url
    return boto3.client(**kwargs)


def upload_file(local_path: Path, object_key: str) -> str:
    s = get_settings()
    client = _client()
    client.upload_file(str(local_path), s.s3_bucket, object_key)
    return f"s3://{s.s3_bucket}/{object_key}"


def upload_bytes(data: bytes, object_key: str, content_type: str = "application/octet-stream") -> str:
    s = get_settings()
    client = _client()
    client.put_object(Bucket=s.s3_bucket, Key=object_key, Body=data, ContentType=content_type)
    return f"s3://{s.s3_bucket}/{object_key}"


def download_to_path(object_key: str, dest: Path) -> Path:
    s = get_settings()
    client = _client()
    dest.parent.mkdir(parents=True, exist_ok=True)
    client.download_file(s.s3_bucket, object_key, str(dest))
    return dest


def tenant_key(company_id: str, filename: str) -> str:
    return f"companies/{company_id}/uploads/{filename}"
