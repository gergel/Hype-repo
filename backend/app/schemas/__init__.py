from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict


# ---------- Auth ----------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProjectUnlock(BaseModel):
    password: str


# ---------- Video ----------
class VideoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    folder_id: Optional[str] = None
    mp4_url: str
    hls_url: str
    thumbnail_url: str
    duration_seconds: int
    width: int
    height: int
    resolution_label: str
    aspect_ratio_label: str = ""
    size_bytes: int
    status: str
    sort_order: int


class VideoUpdate(BaseModel):
    title: Optional[str] = None
    sort_order: Optional[int] = None
    folder_id: Optional[str] = None


# ---------- Image ----------
class ImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    folder_id: Optional[str] = None
    url: str
    width: int
    height: int
    size_bytes: int
    sort_order: int


# ---------- Folder ----------
class FolderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    sort_order: int


class FolderCreate(BaseModel):
    name: str


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None


# ---------- Project ----------
class ProjectBase(BaseModel):
    title: str
    client_name: str = ""
    description: str = ""
    cover_image_url: str = ""
    brand: str = "hype"
    project_date: str = ""


class ProjectCreate(ProjectBase):
    slug: Optional[str] = None
    password: Optional[str] = None
    status: str = "live"


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    client_name: Optional[str] = None
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    status: Optional[str] = None
    brand: Optional[str] = None
    slug: Optional[str] = None
    password: Optional[str] = None  # "" clears password
    project_date: Optional[str] = None
    expires_at: Optional[datetime] = None
    payment_mode: Optional[str] = None


class ProjectSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    slug: str
    title: str
    client_name: str
    cover_image_url: str
    status: str
    brand: str = "hype"
    project_date: str = ""
    expires_at: Optional[datetime] = None
    payment_mode: str = "contact"
    has_password: bool = False


class ProjectDetail(ProjectSummary):
    description: str
    share_token: str
    videos: List[VideoOut] = []
    folders: List[FolderOut] = []
    images: List[ImageOut] = []


class PublicProject(BaseModel):
    id: str
    slug: str
    title: str
    client_name: str
    description: str
    cover_image_url: str
    brand: str = "hype"
    project_date: str = ""
    expires_at: Optional[datetime] = None
    payment_mode: str = "contact"
    videos: List[VideoOut] = []
    folders: List[FolderOut] = []
    images: List[ImageOut] = []


class ReorderPayload(BaseModel):
    ordered_ids: List[str]


class ShareLink(BaseModel):
    url: str
    token: str
