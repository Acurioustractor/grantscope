import { LandingChrome } from '@/components/landing/LandingChrome';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <LandingChrome currentPage="account">{children}</LandingChrome>;
}
