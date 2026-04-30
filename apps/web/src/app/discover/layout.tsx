import { LandingChrome } from '@/components/landing/LandingChrome';

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return <LandingChrome currentPage="discover">{children}</LandingChrome>;
}
