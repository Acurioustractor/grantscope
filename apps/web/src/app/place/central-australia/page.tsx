import { RegionReport } from '../region-report';
import { OrganisationsMap } from './organisations-map';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Where the money goes: Central Australia — CivicGraph',
  description:
    'Public money and philanthropic grants reaching organisations in Mparntwe (Alice Springs), Tennant Creek and the Utopia homelands — and what those figures leave out.',
};

export default function CentralAustraliaPage() {
  return (
    <RegionReport
      regionKey="central-australia"
      title="Central Australia"
      intro={
        <p>
          Public contracts and grants reaching organisations based in Mparntwe (Alice Springs),
          Tennant Creek and the Utopia homelands. Every figure comes from a public register and can
          be checked. Where we cannot tell you something, the page says so instead of guessing.
        </p>
      }
    >
      <section aria-labelledby="map-title">
        <h2 id="map-title" className="text-2xl font-black uppercase tracking-widest">Every organisation, every channel</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6">
          Filter by money channel, council or community control, search by name, and read the detail
          on any organisation. The channels are kept apart because they mean different things:
          contracts follow the office, grants held follow the recipient, and grants delivered here
          follow the work.
        </p>
        <div className="mt-5">
          <OrganisationsMap />
        </div>
      </section>
    </RegionReport>
  );
}
