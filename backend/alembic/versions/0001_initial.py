"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-01-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "admins",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("email", sa.String(), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_admins_email", "admins", ["email"])

    op.create_table(
        "projects",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("slug", sa.String(), nullable=False, unique=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("client_name", sa.String(), server_default=""),
        sa.Column("description", sa.Text(), server_default=""),
        sa.Column("cover_image_url", sa.String(), server_default=""),
        sa.Column("status", sa.String(), server_default="draft"),
        sa.Column("password_hash", sa.String(), nullable=True),
        sa.Column("share_token", sa.String()),
        sa.Column("notion_page_id", sa.String(), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_projects_slug", "projects", ["slug"])
    op.create_index("ix_projects_share_token", "projects", ["share_token"])
    op.create_index("ix_projects_notion_page_id", "projects", ["notion_page_id"])

    op.create_table(
        "videos",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("project_id", sa.String(),
                  sa.ForeignKey("projects.id", ondelete="CASCADE")),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("source_key", sa.String(), server_default=""),
        sa.Column("mp4_url", sa.String(), server_default=""),
        sa.Column("hls_url", sa.String(), server_default=""),
        sa.Column("thumbnail_url", sa.String(), server_default=""),
        sa.Column("duration_seconds", sa.Integer(), server_default="0"),
        sa.Column("width", sa.Integer(), server_default="0"),
        sa.Column("height", sa.Integer(), server_default="0"),
        sa.Column("resolution_label", sa.String(), server_default=""),
        sa.Column("size_bytes", sa.Integer(), server_default="0"),
        sa.Column("status", sa.String(), server_default="processing"),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_videos_project_id", "videos", ["project_id"])


def downgrade():
    op.drop_table("videos")
    op.drop_table("projects")
    op.drop_table("admins")
