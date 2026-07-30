export const metadata = {
  title: "Adatkezelési Tájékoztató — HYPE Productions",
};

export default function AdatvedelemPage() {
  return (
    <div className="dark min-h-screen bg-ink text-bone">
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <a
          href="/"
          className="font-mono text-xs uppercase tracking-eyebrow text-mist transition hover:text-bone"
        >
          ← Vissza
        </a>

        <h1 className="mt-6 font-display text-3xl text-bone sm:text-4xl">
          Adatkezelési Tájékoztató
        </h1>
        <p className="mt-3 font-mono text-xs uppercase tracking-eyebrow text-mist">
          Hatályos: 2026. — HYPE Productions Kft.
        </p>

        <div className="mt-10 space-y-6 text-sm leading-relaxed text-mist">
          {/*
            IDE KERÜL A JOGI SZÖVEG.
            A tartalmat jogi forrásból szerezd be (pl. FogyasztóBarát vagy VirtualJog),
            és illeszd be ide szakaszonként. A szerkezet alább egy vázlat — a valódi,
            jogilag pontos szöveget kell használnod.
          */}

          <section>
            <h2 className="mb-2 font-display text-lg text-bone">1. Az adatkezelő</h2>
            <p>
              HYPE Productions Kft. — székhely, cégjegyzékszám, adószám, elérhetőség.
              (Töltsd ki a cég valós adataival.)
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-bone">
              2. A kezelt adatok köre és célja
            </h2>
            <p>
              A szolgáltatás igénybevétele során kezelt adatok (pl. számlázási adatok:
              név, cím, adószám, e-mail), az adatkezelés célja és jogalapja.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-bone">
              3. Fizetés és a Barion
            </h2>
            <p>
              Az online bankkártyás fizetést a Barion Payment Zrt. biztosítja. A Barion
              a fizetés lebonyolításához és a csalásmegelőzéshez adatokat kezel. A Barion
              Pixel a szolgáltatás biztonsága és — hozzájárulás esetén — marketing célból
              gyűjt adatokat. (A pontos megfogalmazást a Barion adatkezelési
              feltételei szerint illeszd be.)
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-bone">4. Sütik (cookie-k)</h2>
            <p>
              A weboldal sütiket használ a működéshez és — hozzájárulás esetén —
              analitikai/marketing célból. A süti-hozzájárulás bármikor módosítható.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-bone">
              5. Az érintett jogai
            </h2>
            <p>
              Tájékoztatás, hozzáférés, helyesbítés, törlés, korlátozás, tiltakozás,
              adathordozhatóság, valamint a felügyeleti hatósághoz (NAIH) fordulás joga.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-display text-lg text-bone">6. Kapcsolat</h2>
            <p>
              Adatkezeléssel kapcsolatos kérdések: info@hypestab.hu
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
