from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    verify_password,
    create_access_token,
    decode_token,
)
from app.models import Project, Video, Image
from app.schemas import PublicProject, ProjectUnlock, VideoOut, FolderOut, ImageOut
from app.services import storage, barion
from app.core.config import settings

router = APIRouter(prefix="/api/public", tags=["public"])

# Fizetési csomagok: kód → (napok, ár HUF, megnevezés)
PACKAGES = {
    "1month": {"days": 30, "amount": 6000, "label": "1 month extension"},
    "180days": {"days": 180, "amount": 30000, "label": "180 days extension"},
    "1year": {"days": 365, "amount": 50000, "label": "1 year extension"},
}


def _contact_email(project: Project) -> str:
    if project.brand == "contentbee":
        return "hello@contentbee.hu"
    return "info@hypestab.hu"


def _is_expired(project: Project) -> bool:
    if not project.expires_at:
        return False
    exp = project.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
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

    if _is_expired(project):
        return {
            "expired": True,
            "title": project.title,
            "brand": project.brand,
            "contact_email": _contact_email(project),
            "payment_mode": project.payment_mode,
            "slug": project.slug,
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
            "payment_mode": project.payment_mode,
            "slug": project.slug,
        }
    return {"locked": False, "project": _serialize(project).model_dump()}


@router.post("/projects/{slug}/pay")
def start_payment(slug: str, payload: dict, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.slug == slug).first()
    if not project:
        raise HTTPException(status_code=404, detail="Not found")
    if project.payment_mode != "paid":
        raise HTTPException(status_code=400, detail="Payment not enabled for this project")

    pkg_code = payload.get("package")
    pkg = PACKAGES.get(pkg_code)
    if not pkg:
        raise HTTPException(status_code=400, detail="Invalid package")

    ts = int(datetime.now(timezone.utc).timestamp())
    payment_request_id = f"{project.id}_{pkg_code}_{ts}"

    front = settings.FRONTEND_URL.rstrip("/")
    api = (settings.API_BASE_URL or "").rstrip("/")
    redirect_url = f"{front}/p/{project.slug}"
    callback_url = f"{api}/api/public/barion/callback"

    data = barion.start_payment(
        payment_request_id=payment_request_id,
        amount=pkg["amount"],
        title=pkg["label"],
        redirect_url=redirect_url,
        callback_url=callback_url,
    )

    if data.get("Errors"):
        raise HTTPException(status_code=502, detail="Payment provider error")

    gateway_url = data.get("GatewayUrl")
    if not gateway_url:
        raise HTTPException(status_code=502, detail="No gateway URL")

    return {"gateway_url": gateway_url}


@router.post("/barion/callback")
async def barion_callback(request: Request, db: Session = Depends(get_db)):
    # A Barion a paymentId-t a query stringben küldi (?paymentId=...)
    qp = request.query_params
    payment_id = (
        qp.get("paymentId")
        or qp.get("PaymentId")
        or qp.get("paymentid")
    )

    # Tartalék: ha mégis a body-ban jönne
    if not payment_id:
        try:
            body = await request.json()
            payment_id = body.get("PaymentId") or body.get("paymentId")
        except Exception:
            try:
                form = await request.form()
                payment_id = form.get("PaymentId") or form.get("paymentId")
            except Exception:
                payment_id = None

    if not payment_id:
        print("[barion] no payment_id", flush=True)
        return {"ok": True}

    state = barion.get_payment_state(payment_id)
    status = state.get("Status")
    request_id = state.get("PaymentRequestId") or ""
    print(f"[barion] status={status} request_id={request_id}", flush=True)

    if status == "Succeeded":
        parts = request_id.split("_")
        print(f"[barion] parts={parts}", flush=True)
        if len(parts) >= 2:
            project_id = parts[0]
            pkg_code = parts[1]
            pkg = PACKAGES.get(pkg_code)
            project = db.query(Project).get(project_id)
            print(f"[barion] project_found={bool(project)} pkg={pkg}", flush=True)
            if project and pkg:
                now = datetime.now(timezone.utc)
                current = project.expires_at
                if current and current.tzinfo is None:
                    current = current.replace(tzinfo=timezone.utc)
                base_date = current if (current and current > now) else now
                project.expires_at = base_date + timedelta(days=pkg["days"])
                db.commit()
                print(f"[barion] extended to {project.expires_at}", flush=True)

    return {"ok": True}
