/**
 * What a report renders when its data did not load.
 *
 * The alternative — and what these pages did until 2026-08-19 — is to print zeros, which reads as a
 * measurement. "0 entities operate through multiple influence channels" is a claim about Australia.
 * Saying nothing loaded is honest and costs the reader nothing but a refresh.
 */
export function ReportUnavailable({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <p className="text-xs font-black uppercase tracking-widest text-bauhaus-red">Data unavailable</p>
      <h1 className="mt-3 text-3xl font-black text-bauhaus-black sm:text-4xl">{title}</h1>
      <p className="mt-4 text-base leading-relaxed text-bauhaus-muted">
        This report could not load its figures, so it is showing nothing rather than showing zeros.
        A zero here would read as a measurement, and we do not know that it is one.
      </p>
      {detail ? <p className="mt-3 text-sm text-bauhaus-muted">{detail}</p> : null}
      <p className="mt-6 text-sm text-bauhaus-muted">
        The underlying data has not gone anywhere. Try again shortly, or{' '}
        <a href="/reports" className="font-bold text-bauhaus-blue hover:underline">
          browse the other reports
        </a>
        .
      </p>
    </div>
  );
}
