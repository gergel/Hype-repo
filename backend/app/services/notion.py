import httpx
from slugify import slugify

from app.core.config import settings
from app.models import Project

NOTION_VERSION = "2022-06-28"


def _headers():
    return {
        "Authorization": f"Bearer {settings.NOTION_API_KEY}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }


def _plain(prop: dict) -> str:
    t = prop.get("type")
    if t in ("title", "rich_text"):
        arr = prop.get(t, [])
        return "".join(x.get("plain_text", "") for x in arr)
    if t == "url":
        return prop.get("url") or ""
    if t == "select":
        sel = prop.get("select")
        return sel.get("name", "") if sel else ""
    if t == "files":
        files = prop.get("files", [])
        if files:
            f = files[0]
            return f.get("file", {}).get("url") or f.get("external", {}).get("url", "")
    return ""


def sync_projects(db) -> dict:
    """Pull rows from a Notion database and upsert Projects.

    Expected Notion fields:
      Project Name, Client Name, Portal Slug, Portal Cover Image,
      Portal Status, Portal URL
    """
    if not (settings.NOTION_API_KEY and settings.NOTION_DATABASE_ID):
        return {"synced": 0, "error": "Notion not configured"}

    url = f"https://api.notion.com/v1/databases/{settings.NOTION_DATABASE_ID}/query"
    synced = 0
    cursor = None

    with httpx.Client(timeout=30) as client:
        while True:
            body = {"page_size": 100}
            if cursor:
                body["start_cursor"] = cursor
            resp = client.post(url, headers=_headers(), json=body)
            resp.raise_for_status()
            data = resp.json()

            for page in data.get("results", []):
                props = page.get("properties", {})
                page_id = page["id"]
                title = _plain(props.get("Project Name", {})) or "Untitled"
                client_name = _plain(props.get("Client Name", {}))
                slug = _plain(props.get("Portal Slug", {})) or slugify(title)
                cover = _plain(props.get("Portal Cover Image", {}))
                status = _plain(props.get("Portal Status", {})).lower() or "draft"

                proj = (
                    db.query(Project)
                    .filter(Project.notion_page_id == page_id)
                    .first()
                )
                if not proj:
                    proj = db.query(Project).filter(Project.slug == slug).first()
                if not proj:
                    proj = Project(slug=slug)
                    db.add(proj)

                proj.notion_page_id = page_id
                proj.title = title
                proj.client_name = client_name
                proj.slug = slug
                proj.cover_image_url = cover or proj.cover_image_url
                proj.status = "live" if status in ("live", "published") else status
                synced += 1

            db.commit()
            if not data.get("has_more"):
                break
            cursor = data.get("next_cursor")

    return {"synced": synced}
