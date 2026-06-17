import os
import tempfile

from celery import Celery
from app.core.config import settings
from app.core.database import SessionLocal
from app.models import Video
from app.services import transcode, storage

celery_app = Celery("hype", broker=settings.REDIS_URL, backend=settings.REDIS_URL)
celery_app.conf.task_track_started = True


def _remote_url(source_key: str) -> str:
    """Aláírt GET URL az R2-ből, hogy az ffmpeg közvetlenül olvashassa."""
    client = storage._client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET, "Key": source_key},
        ExpiresIn=6 * 3600,
    )


@celery_app.task(name="process_video")
def process_video_task(video_id: str, source_key: str):
    """
    Gyors lépés: metaadat + borító (első frame), a videó azonnal nézhető marad.
    Majd elindítja a háttér HLS-feldolgozást külön taskban.
    """
    db = SessionLocal()
    try:
        video = db.query(Video).get(video_id)
        if not video:
            return

        # mp4_url = a már feltöltött eredeti fájl (nincs újra-feltöltés)
        video.mp4_url = storage.public_url(source_key)
        video.source_key = source_key

        # Gyors metaadat + borító az R2 URL-ről
        remote = _remote_url(source_key)
        try:
            info = transcode.quick_metadata_and_thumb(remote, f"videos/{video_id}")
            for k, v in info.items():
                setattr(video, k, v)
        except Exception:
            # ha a borító/metaadat se megy, akkor is nézhető marad az mp4
            pass

        # A videó MOST nézhető
        video.status = "ready"
        db.commit()

        # Háttér HLS (opcionális, ha elhasal, a videó attól még ready marad)
        build_hls_task.delay(video_id, source_key)
    finally:
        db.close()


@celery_app.task(name="build_hls", soft_time_limit=10800, time_limit=11000)
def build_hls_task(video_id: str, source_key: str):
    """
    Lassú lépés: HLS generálás. Ha elhasal, a videó marad 'ready' az mp4-gyel.
    """
    db = SessionLocal()
    try:
        video = db.query(Video).get(video_id)
        if not video:
            return
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "source.mp4")
            client = storage._client()
            client.download_file(settings.R2_BUCKET, source_key, src)
            hls_url = transcode.build_hls(src, f"videos/{video_id}")
        video = db.query(Video).get(video_id)
        if video:
            video.hls_url = hls_url
            db.commit()
    except Exception:
        # HLS hiba nem teszi failed-dé a videót — marad ready az mp4-gyel
        pass
    finally:
        db.close()
