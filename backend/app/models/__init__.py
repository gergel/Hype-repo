import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    DateTime,
    ForeignKey,
    Boolean,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


def _uuid():
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc)


class Admin(Base):
    __tablename__ = "admins"
    id = Column(String, primary_key=True, default=_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_now)


class Project(Base):
    __tablename__ = "projects"
    id = Column(String, primary_key=True, default=_uuid)
    slug = Column(String, unique=True, nullable=False, index=True)
    title = Column(String, nullable=False)
    client_name = Column(String, nullable=False, default="")
    description = Column(Text, default="")
    project_date = Column(String, default="")  # pl. "2026-06-17" vagy "2026. június"
    cover_image_url = Column(String, default="")
    status = Column(String, default="draft")  # draft | live | archived
    brand = Column(String, default="hype")  # hype | contentbee
    password_hash = Column(String, nullable=True)  # null = no password
    share_token = Column(String, default=_uuid, index=True)
    notion_page_id = Column(String, nullable=True, index=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)
    expires_at = Column(DateTime, nullable=True)
    videos = relationship(
        "Video",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Video.sort_order",
    )
    folders = relationship(
        "Folder",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Folder.sort_order",
    )
    images = relationship(
        "Image",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Image.sort_order",
    )


class Folder(Base):
    __tablename__ = "folders"
    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(
        String, ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    name = Column(String, nullable=False, default="")
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=_now)
    project = relationship("Project", back_populates="folders")
    videos = relationship(
        "Video",
        back_populates="folder",
        order_by="Video.sort_order",
    )


class Video(Base):
    __tablename__ = "videos"
    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(
        String, ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    folder_id = Column(
        String, ForeignKey("folders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title = Column(String, nullable=False)
    # storage keys / urls
    source_key = Column(String, default="")        # original mp4 key in R2
    mp4_url = Column(String, default="")           # direct download url
    hls_url = Column(String, default="")           # .m3u8 master playlist url
    thumbnail_url = Column(String, default="")
    # metadata
    duration_seconds = Column(Integer, default=0)
    width = Column(Integer, default=0)
    height = Column(Integer, default=0)
    resolution_label = Column(String, default="")  # e.g. "4K", "1080p"
    aspect_ratio_label = Column(String, default="")
    size_bytes = Column(Integer, default=0)
    status = Column(String, default="processing")   # processing | ready | failed
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=_now)
    project = relationship("Project", back_populates="videos")
    folder = relationship("Folder", back_populates="videos")

class Image(Base):
    __tablename__ = "images"
    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(
        String, ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    folder_id = Column(
        String, ForeignKey("folders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title = Column(String, default="")
    url = Column(String, default="")          # public URL in R2
    key = Column(String, default="")          # storage key in R2
    width = Column(Integer, default=0)
    height = Column(Integer, default=0)
    size_bytes = Column(Integer, default=0)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=_now)
    project = relationship("Project", back_populates="images")
