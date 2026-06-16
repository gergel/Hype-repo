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
    cover_image_url = Column(String, default="")
    status = Column(String, default="draft")  # draft | live | archived
    password_hash = Column(String, nullable=True)  # null = no password
    share_token = Column(String, default=_uuid, index=True)
    notion_page_id = Column(String, nullable=True, index=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=_now)
    updated_at = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    videos = relationship(
        "Video",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Video.sort_order",
    )


class Video(Base):
    __tablename__ = "videos"
    id = Column(String, primary_key=True, default=_uuid)
    project_id = Column(
        String, ForeignKey("projects.id", ondelete="CASCADE"), index=True
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
    size_bytes = Column(Integer, default=0)
    status = Column(String, default="processing")   # processing | ready | failed
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=_now)

    project = relationship("Project", back_populates="videos")
