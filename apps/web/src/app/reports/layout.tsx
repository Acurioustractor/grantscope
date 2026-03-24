import { ReportSidebar } from './_components/report-sidebar';
import { ReportBreadcrumbs } from './_components/report-breadcrumbs';

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-reports-layout
      className="flex"
    >
      <ReportSidebar />
      <div className="flex-1 min-w-0 max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        <ReportBreadcrumbs />
        {children}
      </div>
    </div>
  );
}
