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
    status: str = "draft"
    project_date: str = ""


class ProjectCreate(ProjectBase):
    slug: Optional[str] = None
    password: Optional[str] = None


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    client_name: Optional[str] = None
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    status: Optional[str] = None
    slug: Optional[str] = None
    password: Optional[str] = None  # "" clears password
    project_date: Optional[str] = None


class ProjectSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    slug: str
    title: str
    client_name: str
    cover_image_url: str
    status: str
    project_date: str = ""
    has_password: bool = False


class ProjectDetail(ProjectSummary):
    description: str
    share_token: str
    videos: List[VideoOut] = []
    folders: List[FolderOut] = []


class PublicProject(BaseModel):
    id: str
    slug: str
    title: str
    client_name: str
    description: str
    cover_image_url: str
    project_date: str = ""
    videos: List[VideoOut] = []
    folders: List[FolderOut] = []


class ReorderPayload(BaseModel):
    ordered_ids: List[str]


class ShareLink(BaseModel):
    url: str
    token: str
