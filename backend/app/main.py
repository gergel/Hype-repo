from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.core.security import hash_password
from app.models import Admin
from app.api import auth, public, admin


def _seed_admin():
    db = SessionLocal()
    try:
        if not db.query(Admin).filter(Admin.email == settings.ADMIN_EMAIL).first():
            db.add(Admin(
                email=settings.ADMIN_EMAIL,
                password_hash=hash_password(settings.ADMIN_PASSWORD),
            ))
            db.commit()
    finally:
        db.close()


def _migrate():
    """Egyszerű migrációk meglévő táblákhoz (a create_all nem ad új oszlopot)."""
    statements = [
        "ALTER TABLE projects ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP",
        "UPDATE projects SET expires_at = created_at + INTERVAL '180 days' WHERE expires_at IS NULL",
        "ALTER TABLE videos ALTER COLUMN size_bytes TYPE BIGINT",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            try:
                conn.execute(text(stmt))
            except Exception as e:
                print(f"[migrate] skipped: {stmt[:50]}… → {e}", flush=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        _migrate()
        _seed_admin()
    except Exception as e:
        print(f"[startup] init skipped: {e}", flush=True)
    yield


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(public.router)
app.include_router(admin.router)


@app.get("/health")
def health():
    return {"status": "ok"}
