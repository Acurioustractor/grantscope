export const metadata = {
  title: 'Youth Justice — Five Views · CivicGraph',
  description: 'Five visualizations of how $19B of youth justice money flows. Cityscape, money river, tree rings, drain, and split tanks.',
};

export default function ViewsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        nav, .nav-bar, [data-nav] { display: none !important; }
        main { padding: 0 !important; margin: 0 !important; }
        body { overflow: hidden !important; background: #0a0a0a; }
      `}</style>
      {children}
    </>
  );
}
