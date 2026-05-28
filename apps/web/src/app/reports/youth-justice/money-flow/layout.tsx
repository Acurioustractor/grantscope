// Override the parent reports layout for this scrollytelling page —
// strip the sidebar, breadcrumbs, and inner padding so it's full-bleed.
export default function MoneyFlowLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        /* Reports layout root: turn off the flex sidebar+content split */
        [data-reports-layout] {
          display: block !important;
          background: #0a0a0a;
        }
        /* Hide the sidebar (rendered as <aside>) */
        [data-reports-layout] aside { display: none !important; }
        /* Hide the breadcrumb bar — it sits at the top of the children wrapper */
        [data-reports-layout] > div > nav,
        [data-reports-layout] > div > div:first-child > nav { display: none !important; }
        /* Strip the padding wrapper so children fill the viewport */
        [data-reports-layout] > div {
          padding: 0 !important;
          max-width: none !important;
          width: 100% !important;
        }
        /* Hide the breadcrumb component if it has a known selector */
        [data-report-breadcrumbs] { display: none !important; }
      `}</style>
      {children}
    </>
  );
}
