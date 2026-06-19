from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    verify_password,
    create_access_token,
    decode_token,
)
from app.models import Project, Video, Image
from app.schemas import PublicProject, ProjectUnlock, VideoOut, FolderOut, ImageOut
from app.services import storage

router = APIRouter(prefix="/api/public", tags=["public"])


# Lejárati e-mail márka szerint
def _contact_email(project: Project) -> str:
    if project.brand == "contentbee":
        return "hype.stab@gmail.com"
    return "info@hypestab.hu"


def _is_expired(project: Project) -> bool:
    if not project.expires_at:
        return False
    exp = project.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    # A lejárat napjának VÉGÉIG elérhető: a tárolt dátum napjának 23:59:59 UTC-jéig
    end_of_day = exp.replace(hour=23, minute=59, second=59, microsecond=0)
    return datetime.now(timezone.utc) > end_of_day

def _serialize(project: Project) -> PublicProject:
    ready = [v for v in project.videos if v.status == "ready"]
    return PublicProject(
        id=project.id,
        slug=project.slug,
        title=project.title,
        client_name=project.client_name,
        description=project.description,
        cover_image_url=project.cover_image_url,
        brand=project.brand,
        project_date=project.project_date,
        videos=[VideoOut.model_validate(v) for v in ready],
        folders=[FolderOut.model_validate(f) for f in project.folders],
        images=[ImageOut.model_validate(i) for i in project.images],
    )


@router.get("/projects/{slug}")
def get_public_project(
    slug: str,
    db: Session = Depends(get_db),
    authorization: str | None = None,
):
    project = (
        db.query(Project)
        .filter(Project.slug == slug, Project.status == "live")
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Lejárt? → anyagok elrejtve, kapcsolati üzenet
    if _is_expired(project):
        return {
            "expired": True,
            "title": project.title,
            "brand": project.brand,
            "contact_email": _contact_email(project),
        }

    if project.password_hash:
        if not authorization:
            return {"locked": True, "title": project.title,
                    "cover_image_url": project.cover_image_url}
        try:
            data = decode_token(authorization)
            if data.get("scope") != f"project:{project.id}":
                raise ValueError
        except Exception:
            return {"locked": True, "title": project.title,
                    "cover_image_url": project.cover_image_url}

    return {"locked": False, "project": _serialize(project).model_dump()}


@router.get("/videos/{video_id}/download")
def public_video_download(video_id: str, db: Session = Depends(get_db)):
    video = db.query(Video).get(video_id)
    if not video or not video.source_key:
        raise HTTPException(status_code=404, detail="Not found")
    safe = (video.title or "video").replace('"', "").replace("\n", " ")
    url = storage.presigned_download(video.source_key, f"{safe}.mp4")
    return {"url": url}


@router.get("/images/{image_id}/download")
def image_download(image_id: str, db: Session = Depends(get_db)):
    image = db.query(Image).get(image_id)
    if not image or not image.key:
        raise HTTPException(status_code=404, detail="Not found")
    ext = image.key.split(".")[-1] if "." in image.key else "jpg"
    filename = f"{image.title or 'image'}.{ext}"
    url = storage.presigned_download(image.key, filename)
    return {"url": url}


@router.post("/projects/{slug}/unlock")
def unlock(slug: str, payload: ProjectUnlock, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.slug == slug).first()
    if not project or not project.password_hash:
        raise HTTPException(status_code=404, detail="Not found")
    if _is_expired(project):
        raise HTTPException(status_code=410, detail="Expired")
    if not verify_password(payload.password, project.password_hash):
        raise HTTPException(status_code=401, detail="Wrong password")
    token = create_access_token(
        project.slug, {"scope": f"project:{project.id}"}
    )
    return {"token": token}


@router.get("/share/{token}")
def get_by_share(token: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.share_token == token).first()
    if not project:
        raise HTTPException(status_code=404, detail="Not found")
    if _is_expired(project):
        return {
            "expired": True,
            "title": project.title,
            "brand": project.brand,
            "contact_email": _contact_email(project),
        }
    return {"locked": False, "project": _serialize(project).model_dump()}
