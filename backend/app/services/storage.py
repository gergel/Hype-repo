import boto3
from botocore.config import Config

from app.core.config import settings

_session = boto3.session.Session()


def _client():
    return _session.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def upload_file(local_path: str, key: str, content_type: str) -> str:
    client = _client()
    client.upload_file(
        local_path,
        settings.R2_BUCKET,
        key,
        ExtraArgs={"ContentType": content_type},
    )
    return public_url(key)


def upload_bytes(data: bytes, key: str, content_type: str) -> str:
    client = _client()
    client.put_object(
        Bucket=settings.R2_BUCKET, Key=key, Body=data, ContentType=content_type
    )
    return public_url(key)


def delete_prefix(prefix: str) -> None:
    client = _client()
    resp = client.list_objects_v2(Bucket=settings.R2_BUCKET, Prefix=prefix)
    objs = [{"Key": o["Key"]} for o in resp.get("Contents", [])]
    if objs:
        client.delete_objects(Bucket=settings.R2_BUCKET, Delete={"Objects": objs})


def presigned_put(key: str, content_type: str, expires: int = 3600) -> str:
    client = _client()
    return client.generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.R2_BUCKET, "Key": key, "ContentType": content_type},
        ExpiresIn=expires,
    )


def public_url(key: str) -> str:
    base = settings.R2_PUBLIC_URL.rstrip("/")
    return f"{base}/{key}"
