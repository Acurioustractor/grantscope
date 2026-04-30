import { LandingChrome } from '@/components/landing/LandingChrome';

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return <LandingChrome currentPage="feedback">{children}</LandingChrome>;
}
