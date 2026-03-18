export const metadata = {
  title: 'CivicGraph Network',
  description: 'Force-directed graph visualization of the CivicGraph entity network',
};

export default function GraphLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Hide the root layout's nav bar on this page */}
      <style>{`
        nav, .nav-bar, [data-nav] { display: none !important; }
        main { padding: 0 !important; margin: 0 !important; }
        body { overflow: hidden !important; }
      `}</style>
      {children}
    </>
  );
}
