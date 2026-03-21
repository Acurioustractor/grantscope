export default function PitchLayout({ children }: { children: React.ReactNode }) {
  // Break out of the parent <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  // so pitch pages can use full viewport width
  return (
    <div className="w-[100vw] relative left-[50%] -translate-x-[50%] -mt-8">
      {children}
    </div>
  );
}
