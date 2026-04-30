import { LandingChrome } from '@/components/landing/LandingChrome';

export default function GetAReportLayout({ children }: { children: React.ReactNode }) {
  return <LandingChrome currentPage="report">{children}</LandingChrome>;
}
