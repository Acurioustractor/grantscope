import { YouthJustice3DClient } from './youth-justice-3d-client';

export const metadata = {
  title: 'Youth Justice — 3D Funding Network · CivicGraph',
  description: 'Temporal 3D force-directed graph of youth justice funding flows. Programs, recipients, reactive vs prevention vs community-led — flown through 17 financial years.',
};

export default function YouthJustice3DPage() {
  return <YouthJustice3DClient />;
}
