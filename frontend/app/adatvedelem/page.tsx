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

          const sections = [
            {
              h: "1. Az adatkezelő",
              p: "Cégnév: Hype Productions Korlátolt Felelősségű Társaság (Hype Productions Kft.) · Székhely: 3036 Gyöngyöstarján, Kossuth Lajos utca 3. · Cégjegyzékszám: 10-09-041944 · Adószám: 23995828-2-10 · E-mail: info@hypestab.hu · Honlap: https://hypeclient.com. Az adatkezelő a jelen tájékoztatóban meghatározott adatokat a hatályos adatvédelmi jogszabályok — így különösen az Európai Parlament és a Tanács (EU) 2016/679 rendelete (GDPR), valamint az információs önrendelkezési jogról és az információszabadságról szóló 2011. évi CXII. törvény (Infotv.) — szerint kezeli.",
            },
            {
              h: "2. A kezelt adatok köre, célja és jogalapja",
              p: "Számlázási adatok (név vagy cégnév, számlázási cím, adószám cég esetén, e-mail cím): a tárhelycsomag megrendelésekor. Cél: a szolgáltatás teljesítése és a jogszabályi számlázási kötelezettség. Jogalap: szerződés teljesítése (GDPR 6. cikk (1) b)) és jogi kötelezettség (GDPR 6. cikk (1) c)). — Fizetési adatok: a bankkártyás fizetés a Barion rendszerében történik; a bankkártyaadatokhoz az adatkezelő nem fér hozzá. — Technikai adatok (IP-cím, böngésző, sütik által gyűjtött adatok): a szolgáltatás működése és biztonsága, valamint — hozzájárulás esetén — analitikai és marketing célból. Jogalap: jogos érdek (GDPR 6. cikk (1) f)), illetve hozzájárulás (GDPR 6. cikk (1) a)).",
            },
            {
              h: "3. Adatfeldolgozók",
              p: "Az adatkezelő a szolgáltatás nyújtásához az alábbi adatfeldolgozókat veszi igénybe: Barion Payment Zrt. (online bankkártyás fizetés lebonyolítása, csalásmegelőzés) · Számlázz.hu / KBOSS.hu Kft. (elektronikus számla kiállítása).",
            },
            {
              h: "4. Az adatkezelés időtartama",
              p: "A számlázási adatokat az adatkezelő a számviteli jogszabályok által előírt ideig (a számla kiállításától számított 8 évig) őrzi meg. A szolgáltatáshoz kapcsolódó egyéb személyes adatokat a szolgáltatás nyújtásához szükséges ideig, illetve a vonatkozó jogszabályi megőrzési idő lejártáig kezeli.",
            },
            {
              h: "5. Sütik (cookie-k)",
              p: "A weboldal a működéséhez szükséges sütiket, valamint — a felhasználó hozzájárulása esetén — analitikai és marketing célú sütiket használ. A weboldalon a Barion Pixel is működik, amely a szolgáltatás biztonsága érdekében, illetve hozzájárulás esetén marketing célból gyűjt adatokat. A süti-hozzájárulás a weboldalon megjelenő süti-sávon keresztül bármikor megadható vagy visszavonható.",
            },
            {
              h: "6. Adattovábbítás",
              p: "Az adatkezelő személyes adatot harmadik félnek csak a jelen tájékoztatóban megjelölt adatfeldolgozók részére, a szolgáltatás teljesítése érdekében, illetve jogszabályi kötelezettség alapján továbbít.",
            },
            {
              h: "7. Az érintett jogai",
              p: "Az érintettet megilleti a tájékoztatáshoz, a hozzáféréshez, a helyesbítéshez, a törléshez, az adatkezelés korlátozásához, az adathordozhatósághoz, valamint a tiltakozáshoz való jog. A hozzájáruláson alapuló adatkezelés esetén a hozzájárulás bármikor visszavonható. Az érintett jogait az info@hypestab.hu e-mail címen gyakorolhatja.",
            },
            {
              h: "8. Jogorvoslat",
              p: "Az érintett a személyes adatai kezelésével kapcsolatos panaszával a Nemzeti Adatvédelmi és Információszabadság Hatósághoz (NAIH) fordulhat (cím: 1055 Budapest, Falk Miksa utca 9-11.; e-mail: ugyfelszolgalat@naih.hu; honlap: naih.hu), illetve jogainak megsértése esetén bírósághoz fordulhat.",
            },
            {
              h: "9. Az adatkezelés biztonsága",
              p: "Az adatkezelő a személyes adatok biztonsága érdekében megfelelő technikai és szervezési intézkedéseket alkalmaz, így különösen a titkosított adatátvitelt és a hozzáférések korlátozását.",
            },
            {
              h: "10. A tájékoztató módosítása",
              p: "Az adatkezelő fenntartja a jogot a jelen tájékoztató módosítására. A mindenkor hatályos tájékoztató a https://hypeclient.com/adatvedelem oldalon érhető el.",
            },
          ];
        </div>
      </main>
    </div>
  );
}
