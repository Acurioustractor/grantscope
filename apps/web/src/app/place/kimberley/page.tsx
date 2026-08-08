import { RegionReport } from '../region-report';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Where the money goes: the Kimberley — CivicGraph',
  description:
    'Public money and philanthropic grants reaching organisations in Rubibi (Broome), Derby, Halls Creek, Kununurra and the Dampier Peninsula communities — and what those figures leave out.',
};

export default function KimberleyPage() {
  return (
    <RegionReport
      regionKey="kimberley"
      title="The Kimberley"
      intro={
        <p>
          Public contracts and grants reaching organisations based in Rubibi (Broome), Derby, Halls
          Creek, Kununurra and the communities of the Dampier Peninsula. Every figure comes from a
          public register and can be checked. Where we cannot tell you something, the page says so
          instead of guessing.
        </p>
      }
    />
  );
}
