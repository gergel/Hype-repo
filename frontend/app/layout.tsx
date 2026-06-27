/**
 * Az admin felület MINDIG sötét, függetlenül a portál téma-választásától.
 * A `dark` osztály ezen a kereten belül kényszeríti a sötét CSS-változókat,
 * a bg-ink háttér pedig kitölti a teljes magasságot.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-screen bg-ink text-bone">
      {children}
    </div>
  );
}
