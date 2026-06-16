import os
import tempfile

from celery import Celery

from app.core.config import settings
from app.core.database import SessionLocal
from app.models import Video
from app.services import transcode, storage

celery_app = Celery("hype", broker=settings.REDIS_URL, backend=settings.REDIS_URL)
celery_app.conf.task_track_started = True


@celery_app.task(name="process_video")
def process_video_task(video_id: str, source_key: str):
    """Download original from R2, transcode, upload outputs, update DB."""
    db = SessionLocal()
    try:
        video = db.query(Video).get(video_id)
        if not video:
            return

        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "source.mp4")
            client = storage._client()
            client.download_file(settings.R2_BUCKET, source_key, src)

            result = transcode.process_video(src, f"videos/{video_id}")

        for k, v in result.items():
            setattr(video, k, v)
        video.status = "ready"
        db.commit()
    except Exception:
        video = db.query(Video).get(video_id)
        if video:
            video.status = "failed"
            db.commit()
        raise
    finally:
        db.close()
