import { describeIcsea, type SchoolNeedSignal } from '@/lib/services/school-need-signal';

/**
 * The need signal, stated as the one thing on these pages that does not depend
 * on us having placed an organisation correctly.
 */
export function SchoolNeed({ signal, placeLabel }: { signal: SchoolNeedSignal; placeLabel: string }) {
  return (
    <section aria-labelledby="schools-title" className="border-4 border-bauhaus-blue bg-white p-6 shadow-[8px_8px_0_0_#121212]">
      <p className="font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-blue">
        The one figure here that is not about money
      </p>
      <h2 id="schools-title" className="mt-2 text-2xl font-black uppercase tracking-widest">
        Schools in {placeLabel}
      </h2>
      <p className="mt-3 max-w-3xl text-base leading-7">
        Every other number on this page is money, and money is recorded against whichever
        organisation holds it — which in remote Australia is often somewhere else. A school is where
        its students are. These figures do not depend on us getting an address right.
      </p>

      <dl className="mt-6 grid gap-5 sm:grid-cols-3">
        <div className="border-l-4 border-bauhaus-black pl-4">
          <dt className="font-mono text-[10px] font-bold uppercase tracking-widest">Students</dt>
          <dd className="mt-1 text-3xl font-black">{signal.students.toLocaleString('en-AU')}</dd>
          <dd className="font-mono text-[11px]">
            across {signal.schools.toLocaleString('en-AU')}{' '}
            {signal.schools === 1 ? 'school' : 'schools'}
          </dd>
        </div>
        {signal.indigenousPct !== null ? (
          <div className="border-l-4 border-bauhaus-black pl-4">
            <dt className="font-mono text-[10px] font-bold uppercase tracking-widest">
              Indigenous enrolment
            </dt>
            <dd className="mt-1 text-3xl font-black">{signal.indigenousPct}%</dd>
            <dd className="font-mono text-[11px]">weighted by enrolments</dd>
          </div>
        ) : null}
        {signal.meanIcsea !== null ? (
          <div className="border-l-4 border-bauhaus-blue pl-4">
            <dt className="font-mono text-[10px] font-bold uppercase tracking-widest text-bauhaus-blue">
              ICSEA
            </dt>
            <dd className="mt-1 text-3xl font-black text-bauhaus-blue">{signal.meanIcsea}</dd>
            <dd className="font-mono text-[11px]">national average is 1000</dd>
          </div>
        ) : null}
      </dl>

      {signal.meanIcsea !== null ? (
        <p className="mt-5 max-w-3xl border-l-4 border-bauhaus-blue bg-bauhaus-canvas p-3 text-sm leading-6">
          ICSEA is the Index of Community Socio-Educational Advantage, built from parents&apos;
          education and occupation, school remoteness and Indigenous enrolment. At{' '}
          <strong>{signal.meanIcsea}</strong>, schools here sit {describeIcsea(signal.meanIcsea)}.
          {signal.lowestIcseaSchool ? (
            <>
              {' '}
              The lowest is {signal.lowestIcseaSchool.name} at {signal.lowestIcseaSchool.icsea}.
            </>
          ) : null}
        </p>
      ) : null}

      {signal.schoolsWithoutIcsea > 0 ? (
        <p className="mt-3 font-mono text-xs">
          {signal.schoolsWithoutIcsea} {signal.schoolsWithoutIcsea === 1 ? 'school' : 'schools'} here
          {signal.schoolsWithoutIcsea === 1 ? ' publishes' : ' publish'} no ICSEA and{' '}
          {signal.schoolsWithoutIcsea === 1 ? 'is' : 'are'} not in the average.
        </p>
      ) : null}

      <p className="mt-4 font-mono text-xs">
        Source: ACARA school profiles, 2025. Enrolment-weighted, so a 900-student town school counts
        for more than a 20-student homeland school.
      </p>
    </section>
  );
}
