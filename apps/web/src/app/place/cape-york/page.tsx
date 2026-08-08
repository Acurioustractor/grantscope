import { RegionReport } from '../region-report';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Where the money goes: Cape York — CivicGraph',
  description:
    'Public money and philanthropic grants reaching organisations on Cape York — and the much larger sum recorded against Cairns, which is not on Cape York.',
};

export default function CapeYorkPage() {
  return (
    <RegionReport
      regionKey="cape-york"
      title="Cape York"
      intro={
        <p>
          Public contracts and grants reaching organisations based in the shires of Cape York and
          the Torres Strait. Every figure comes from a public register and can be checked. Where we
          cannot tell you something, the page says so instead of guessing.
        </p>
      }
    />
  );
}
