import { money } from '@/lib/format';
import type { CapturePlace } from '@/lib/grant-place-capture';
import { divergenceNote, isConcentrated } from '@/lib/place-capture-copy';

/**
 * What the place keeps, on the council page.
 *
 * THE THREE FIGURES TRAVEL TOGETHER OR NOT AT ALL. A dollar share alone is the most misleading
 * number in this dataset. Measured 2026-08-21, every one of the twelve worst dollar-capturing
 * councils in Australia also has HIGH award capture and one award carrying 38-96% of its money:
 * Gladstone keeps 0.3% of the dollars delivered into it and 70.4% of the awards, because a handful
 * of hydrogen grants went to head offices in Sydney and Perth while the many small grants stayed
 * local. Armidale reads 4.4% of dollars and 96.0% of awards on a single grant worth 95.6% of the
 * total.
 *
 * So a place reading only its dollar share is being told it fails to hold its own money, when what
 * is true is that one large grant passed through it. That is a fact about the grant, not about the
 * community, and the framing is not the reader's job to get right.
 *
 * NULL IS NOT ZERO. A council with no covered awards, or too few to report, gets the refusal
 * below — never a 0%.
 */
export function PlaceCapture({ capture, lgaName }: { capture: CapturePlace | null; lgaName: string }) {
  if (!capture) {
    return (
      <section className="border-4 border-bauhaus-black bg-white p-6 lg:p-8">
        <h2 className="font-black uppercase tracking-widest text-bauhaus-black">
          What {lgaName} keeps
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed">
          Not measured here. Either no federal grant money in our records was delivered into this
          council, or too few of those grants resolve at both ends to report a share honestly.
        </p>
        <p className="mt-3 max-w-2xl font-mono text-[11px] uppercase tracking-widest text-bauhaus-black/60">
          That is not the same as nothing arriving. It means we cannot tell you.
        </p>
      </section>
    );
  }

  // Both decisions live in lib/place-capture-copy.ts and are tested against real measured shapes,
  // so the rule that fires here is the rule under test rather than a second copy of it.
  const note = divergenceNote(capture);
  const concentrated = isConcentrated(capture);

  return (
    <section className="border-4 border-bauhaus-black bg-white p-6 lg:p-8">
      <h2 className="font-black uppercase tracking-widest text-bauhaus-black">
        What {lgaName} keeps
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed">
        Of the federal grant money recorded as delivered into this council, this is the share
        received by an organisation based here.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Figure
          label="of the money"
          value={`${capture.pctDollarsLocal.toFixed(0)}%`}
          detail={`${money(capture.localDollars)} of ${money(capture.resolvedDollars)}`}
          valueClass="text-bauhaus-red"
        />
        <Figure
          label="of the grants"
          value={`${capture.pctAwardsLocal.toFixed(0)}%`}
          detail={`${capture.localAwards} of ${capture.resolvedAwards} awards`}
          valueClass="text-bauhaus-blue"
        />
      </div>

      {/* The disagreement between the two figures IS the finding, so it is said in words rather
          than left for the reader to spot in two percentages. */}
      {note && (
        <p className="mt-5 max-w-2xl border-l-4 border-bauhaus-yellow pl-4 text-sm leading-relaxed">
          {note === 'money-leaves' ? (
            <>
              Most of the <strong>grants</strong> stay here; much of the{' '}
              <strong>money</strong> does not. That usually means a small number of large grants
              were received by organisations based elsewhere, while the ordinary grant economy is
              local.
            </>
          ) : (
            <>
              Most of the <strong>money</strong> stays here; many of the individual{' '}
              <strong>grants</strong> do not. A few large local awards can carry the dollar figure
              on their own.
            </>
          )}
        </p>
      )}

      {concentrated && (
        <p className="mt-4 max-w-2xl border-l-4 border-bauhaus-red pl-4 text-sm leading-relaxed">
          <strong>One grant is {capture.biggestAwardShare?.toFixed(0)}% of the money</strong>{' '}
          delivered into this council. Read the dollar figure above as a fact about that grant
          before reading it as a fact about this place.
        </p>
      )}

      <dl className="mt-6 grid gap-x-8 gap-y-2 border-t-4 border-bauhaus-black pt-4 font-mono text-[11px] uppercase tracking-widest text-bauhaus-black/70 sm:grid-cols-2">
        <Row k="Grants counted" v={`${capture.resolvedAwards} of ${capture.awards} delivered here`} />
        <Row k="Received across a state border" v={money(capture.crossStateDollars)} />
        <Row
          k="Location of the recipient unknown"
          v={`${capture.unresolvedAwards} awards · ${money(capture.unresolvedDollars)}`}
        />
        <Row k="Largest single grant" v={capture.biggestAwardShare === null ? 'not held' : `${capture.biggestAwardShare.toFixed(0)}% of the money`} />
      </dl>

      <p className="mt-5 max-w-2xl font-mono text-[11px] leading-relaxed uppercase tracking-widest text-bauhaus-black/60">
        Federal grants only, and only those where both the delivery place and the recipient&apos;s
        address resolve to a single council. Government contracts record no delivery location at
        all and are absent from this figure, not zero. Awards whose recipient location cannot be
        resolved are counted in neither share.
      </p>
    </section>
  );
}

function Figure({
  label,
  value,
  detail,
  valueClass,
}: {
  label: string;
  value: string;
  detail: string;
  /** A COMPLETE class string, never interpolated. Tailwind scans source text, so `text-${accent}`
   * is invisible to it and gets purged — the figure would render with no colour at all. */
  valueClass: string;
}) {
  return (
    <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-5">
      <p className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-black/60">
        {label}
      </p>
      <p className={`mt-1 text-5xl font-black tracking-tight ${valueClass}`}>{value}</p>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-bauhaus-black/60">
        stays here · {detail}
      </p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-bauhaus-black/15 py-1">
      <dt>{k}</dt>
      <dd className="text-right text-bauhaus-black">{v}</dd>
    </div>
  );
}
