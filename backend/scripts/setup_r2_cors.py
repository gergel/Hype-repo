"""
Beallitja a CORS policy-t az R2 bucketen, hogy a frontend tudjon
`fetch(url, { mode: "cors" })`-szal letolteni belole (tomeges letoltes / ZIP).

Enelkul a bucket minden cross-origin fetch kerest elutasit (a bongeszo
CORS hibat dob), ezert a tomeges/ZIP letoltes minden fajlnal elbukik,
es a "A letoltes nem sikerult (a fajlok nem elerhetok)" hibauzenet jelenik meg
-- annak ellenere, hogy az egyesevel <a href> letoltes mukodik, mert az
navigacio, nem fetch, igy nem esik CORS-ellenorzes ala.

Hasznalat (a backend konyvtarban, a .env-ben levo R2/FRONTEND_URL ertekekkel):

    python scripts/setup_r2_cors.py
    python scripts/setup_r2_cors.py https://example.com https://foo.example.com
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings
from app.services.storage import _client


def main() -> None:
    origins = sys.argv[1:] or [settings.FRONTEND_URL]
    origins = [o.rstrip("/") for o in origins if o]

    if not origins:
        raise SystemExit(
            "Nincs megadva engedelyezendo origin, es FRONTEND_URL sincs beallitva."
        )

    client = _client()
    client.put_bucket_cors(
        Bucket=settings.R2_BUCKET,
        CORSConfiguration={
            "CORSRules": [
                {
                    "AllowedOrigins": origins,
                    "AllowedMethods": ["GET", "HEAD"],
                    "AllowedHeaders": ["*"],
                    "MaxAgeSeconds": 3600,
                }
            ]
        },
    )
    print(f"R2 CORS beallitva a(z) '{settings.R2_BUCKET}' bucketen ezekre az originokra:")
    for o in origins:
        print(f"  - {o}")


if __name__ == "__main__":
    main()
