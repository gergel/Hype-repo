import os
import tempfile
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from sqlalchemy.orm import Session
from slugify import slugify

from app.core.config import settings
from app.core.database import get_db
from app.core.security import require_admin, hash_password
from app.models import Project, Video, Folder, Image
from app.schemas import (
    ProjectCreate,
    ProjectUpdate,
    ProjectSummary,
    ProjectDetail,
    VideoOut,
    VideoUpdate,
    ReorderPayload,
    ShareLink,
    FolderOut,
    FolderCreate,
    FolderUpdate,
    ImageOut,
)
from app.services import storage, notion as notion_service
from app.workers.tasks import process_video_task

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---------------- Multipart request models ----------------
class MultipartInitIn(BaseModel):
    filename: str
    content_type: str = "video/mp4"
    title: str | None = None


class MultipartPartIn(BaseModel):
    upload_id: str
    key: str
    part_number: int


class MultipartCompleteIn(BaseModel):
    upload_id: str
    key: str
    video_id: str
    parts: list[dict]


class MultipartAbortIn(BaseModel):
    upload_id: str
    key: str
    video_id: str


def _summary(p: Project) -> dict:
    d = ProjectSummary.model_validate(p).model_dump()
    d["has_password"] = bool(p.password_hash)
    return d


# ---------------- Projects ----------------
@router.get("/projects")
def list_projects(db: Session = Depends(get_db), _: str = Depends(require_admin)):
    projects = db.query(Project).order_by(Project.sort_order, Project.created_at).all()
    return [_summary(p) for p in projects]


@router.post("/projects")
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    slug = payload.slug or slugify(payload.title)
    if db.query(Project).filter(Project.slug == slug).first():
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"
    project = Project(
        slug=slug,
        title=payload.title,
        client_name=payload.client_name,
        description=payload.description,
        cover_image_url=payload.cover_image_url,
        status=payload.status,
        password_hash=hash_password(payload.password) if payload.password else None,
        expires_at=datetime.now(timezone.utc) + timedelta(days=180),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _summary(project)


@router.get("/projects/{project_id}", response_model=ProjectDetail)
def get_project(
    project_id: str, db: Session = Depends(get_db), _: str = Depends(require_admin)
):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Not found")
    out = ProjectDetail.model_validate(project)
    out.has_password = bool(project.password_hash)
    return out


@router.patch("/projects/{project_id}")
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Not found")
    data = payload.model_dump(exclude_unset=True)
    if "password" in data:
        pw = data.pop("password")
        project.password_hash = hash_password(pw) if pw else None
    if "slug" in data and data["slug"]:
        data["slug"] = slugify(data["slug"])
    for k, v in data.items():
        setattr(project, k, v)
    db.commit()
    return _summary(project)


@router.delete("/projects/{project_id}")
def delete_project(
    project_id: str, db: Session = Depends(get_db), _: str = Depends(require_admin)
):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Not found")
    for v in project.videos:
        storage.delete_prefix(f"videos/{v.id}")
    db.delete(project)
    db.commit()
    return {"ok": True}


@router.post("/projects/{project_id}/cover")
async def upload_cover(
    project_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    ext = os.path.splitext(file.filename or "cover.jpg")[1] or ".jpg"
    key = f"covers/{project_id}/cover{ext}"
    content_type = file.content_type or "image/jpeg"

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    url = storage.upload_file(tmp_path, key, content_type)
    os.unlink(tmp_path)

    project.cover_image_url = url
    db.commit()
    return {"cover_image_url": url}


@router.delete("/projects/{project_id}/cover")
def delete_cover(
    project_id: str, db: Session = Depends(get_db), _: str = Depends(require_admin)
):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    storage.delete_prefix(f"covers/{project_id}")
    project.cover_image_url = ""
    db.commit()
    return {"cover_image_url": ""}


@router.post("/projects/{project_id}/share", response_model=ShareLink)
def regenerate_share(
    project_id: str, db: Session = Depends(get_db), _: str = Depends(require_admin)
):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Not found")
    project.share_token = str(uuid.uuid4())
    db.commit()
    return ShareLink(
        token=project.share_token,
        url=f"{settings.FRONTEND_URL}/p/{project.slug}?share={project.share_token}",
    )


# ---------------- Videos ----------------
@router.post("/projects/{project_id}/videos/multipart/init")
def multipart_init(
    project_id: str,
    payload: MultipartInitIn,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    max_order = max([v.sort_order for v in project.videos], default=-1)
    video = Video(
        project_id=project_id,
        title=payload.title or os.path.splitext(payload.filename)[0],
        status="uploading",
        sort_order=max_order + 1,
    )
    db.add(video)
    db.commit()
    db.refresh(video)

    key = f"videos/{video.id}/upload.mp4"
    upload_id = storage.create_multipart(key, payload.content_type)
    video.source_key = key
    db.commit()

    return {"video_id": video.id, "upload_id": upload_id, "key": key}


@router.get("/videos/{video_id}/download-url")
def video_download_url(
    video_id: str, db: Session = Depends(get_db), _: str = Depends(require_admin)
):
    video = db.query(Video).get(video_id)
    if not video or not video.source_key:
        raise HTTPException(status_code=404, detail="Not found")
    safe = (video.title or "video").replace('"', "")
    url = storage.presigned_download(video.source_key, f"{safe}.mp4")
    return {"url": url}


@router.post("/videos/multipart/sign-part")
def multipart_sign_part(
    payload: MultipartPartIn,
    _: str = Depends(require_admin),
):
    url = storage.presigned_part(payload.key, payload.upload_id, payload.part_number)
    return {"url": url}


@router.post("/videos/multipart/complete")
def multipart_complete(
    payload: MultipartCompleteIn,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    video = db.query(Video).get(payload.video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    storage.complete_multipart(payload.key, payload.upload_id, payload.parts)
    video.status = "processing"
    db.commit()

    process_video_task.delay(video.id, payload.key)
    return VideoOut.model_validate(video)


@router.post("/videos/multipart/abort")
def multipart_abort(
    payload: MultipartAbortIn,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    storage.abort_multipart(payload.key, payload.upload_id)
    video = db.query(Video).get(payload.video_id)
    if video:
        db.delete(video)
        db.commit()
    return {"ok": True}


@router.post("/projects/{project_id}/videos")
async def upload_video(
    project_id: str,
    file: UploadFile = File(...),
    title: str | None = None,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    max_order = max([v.sort_order for v in project.videos], default=-1)
    video = Video(
        project_id=project_id,
        title=title or os.path.splitext(file.filename or "Untitled")[0],
        status="processing",
        sort_order=max_order + 1,
    )
    db.add(video)
    db.commit()
    db.refresh(video)

    # Stage original to R2 then queue async processing
    source_key = f"videos/{video.id}/upload.mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    storage.upload_file(tmp_path, source_key, "video/mp4")
    os.unlink(tmp_path)
    video.source_key = source_key
    db.commit()

    process_video_task.delay(video.id, source_key)
    return VideoOut.model_validate(video)


@router.patch("/videos/{video_id}")
def update_video(
    video_id: str,
    payload: VideoUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    video = db.query(Video).get(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(video, k, v)
    db.commit()
    return VideoOut.model_validate(video)


@router.post("/videos/{video_id}/replace")
async def replace_video(
    video_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    video = db.query(Video).get(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Not found")
    storage.delete_prefix(f"videos/{video.id}")
    video.status = "processing"
    source_key = f"videos/{video.id}/upload.mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    storage.upload_file(tmp_path, source_key, "video/mp4")
    os.unlink(tmp_path)
    video.source_key = source_key
    db.commit()
    process_video_task.delay(video.id, source_key)
    return VideoOut.model_validate(video)


@router.delete("/videos/{video_id}")
def delete_video(
    video_id: str, db: Session = Depends(get_db), _: str = Depends(require_admin)
):
    video = db.query(Video).get(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Not found")
    storage.delete_prefix(f"videos/{video.id}")
    db.delete(video)
    db.commit()
    return {"ok": True}


@router.post("/projects/{project_id}/videos/reorder")
def reorder_videos(
    project_id: str,
    payload: ReorderPayload,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    for index, vid in enumerate(payload.ordered_ids):
        video = db.query(Video).get(vid)
        if video and video.project_id == project_id:
            video.sort_order = index
    db.commit()
    return {"ok": True}



# ---------------- Folders ----------------
@router.post("/projects/{project_id}/folders", response_model=FolderOut)
def create_folder(
    project_id: str,
    payload: FolderCreate,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    max_order = max([f.sort_order for f in project.folders], default=-1)
    folder = Folder(project_id=project_id, name=payload.name, sort_order=max_order + 1)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return FolderOut.model_validate(folder)


@router.patch("/folders/{folder_id}", response_model=FolderOut)
def update_folder(
    folder_id: str,
    payload: FolderUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    folder = db.query(Folder).get(folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(folder, k, v)
    db.commit()
    return FolderOut.model_validate(folder)


@router.delete("/folders/{folder_id}")
def delete_folder(
    folder_id: str, db: Session = Depends(get_db), _: str = Depends(require_admin)
):
    folder = db.query(Folder).get(folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Not found")
    for v in list(folder.videos):
        storage.delete_prefix(f"videos/{v.id}")
        db.delete(v)
    for img in db.query(Image).filter(Image.folder_id == folder_id).all():
        storage.delete_prefix(f"images/{img.id}")
        db.delete(img)
    db.delete(folder)
    db.commit()
    return {"ok": True}


# ---------------- Images ----------------
@router.post("/projects/{project_id}/images", response_model=ImageOut)
async def upload_image(
    project_id: str,
    file: UploadFile = File(...),
    folder_id: str | None = Form(None),
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    image = Image(project_id=project_id)
    if folder_id:
        image.folder_id = folder_id
    db.add(image)
    db.flush()
    data = await file.read()
    ext = (file.filename or "image.jpg").split(".")[-1].lower()
    key = f"images/{image.id}/original.{ext}"
    storage.upload_bytes(data, key, file.content_type or "image/jpeg")
    max_order = max([i.sort_order for i in project.images], default=-1)
    image.title = (file.filename or "").rsplit(".", 1)[0]
    image.url = storage.public_url(key)
    image.key = key
    image.size_bytes = len(data)
    image.sort_order = max_order + 1
    db.commit()
    db.refresh(image)
    return ImageOut.model_validate(image)


@router.delete("/images/{image_id}")
def delete_image(
    image_id: str, db: Session = Depends(get_db), _: str = Depends(require_admin)
):
    image = db.query(Image).get(image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Not found")
    storage.delete_prefix(f"images/{image.id}")
    db.delete(image)
    db.commit()
    return {"ok": True}

class ImageFolderIn(BaseModel):
    folder_id: str | None = None


@router.patch("/images/{image_id}", response_model=ImageOut)
def update_image_folder(
    image_id: str,
    payload: ImageFolderIn,
    db: Session = Depends(get_db),
    _: str = Depends(require_admin),
):
    image = db.query(Image).get(image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Not found")
    image.folder_id = payload.folder_id
    db.commit()
    db.refresh(image)
    return ImageOut.model_validate(image)


# ---------------- Notion ----------------
@router.post("/notion/sync")
def notion_sync(db: Session = Depends(get_db), _: str = Depends(require_admin)):
    return notion_service.sync_projects(db)
