from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    APP_NAME: str = "HYPE Portal"
    SECRET_KEY: str = "change-me-in-prod"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    ADMIN_EMAIL: str = "admin@hype.studio"
    ADMIN_PASSWORD: str = "change-me"
    FRONTEND_URL: str = "http://localhost:3000"

    # Database
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/hype"

    # Redis / Celery
    REDIS_URL: str = "redis://localhost:6379/0"

    # Cloudflare R2 (S3-compatible)
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET: str = "hype-portal"
    R2_PUBLIC_URL: str = ""  # e.g. https://media.hype.studio (custom domain on bucket)

    @property
    def R2_ENDPOINT(self) -> str:
        return f"https://{self.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

    # Notion
    NOTION_API_KEY: str = ""
    NOTION_DATABASE_ID: str = ""

    # Barion (fizetés)
    BARION_POS_KEY: str = ""
    BARION_ENV: str = "test"  # test | prod
    BARION_PAYEE: str = ""    # a Barion bolt email címe (ahova a pénz megy)

    @property
    def BARION_API_BASE(self) -> str:
        # test → api.test.barion.com, prod → api.barion.com
        return (
            "https://api.test.barion.com"
            if self.BARION_ENV == "test"
            else "https://api.barion.com"
        )


settings = Settings()


PUBLIC_BASE_URL = settings.FRONTEND_URL
