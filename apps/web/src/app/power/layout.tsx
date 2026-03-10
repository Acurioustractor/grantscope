import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Power Page — Where the Money Goes | CivicGraph',
  description: 'Map Australia\'s funding flows. See who funds what, where money goes, and which communities are underserved.',
};

export default function PowerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
