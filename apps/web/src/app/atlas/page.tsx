import type { Metadata } from 'next';
import AtlasClient from './atlas-client';

export const metadata: Metadata = {
  title: 'The Atlas — CivicGraph',
  description:
    'One full-screen map of the place data CivicGraph holds. Every layer carries a ' +
    'plain-words account of what its number contains, the geography it is honest at, ' +
    'and what we cannot yet say.',
};

export default function AtlasPage() {
  return <AtlasClient />;
}
