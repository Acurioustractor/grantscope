export function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://civicgraph.au').replace(/\/+$/, '');
}

export function buildAbsoluteAppUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, getAppUrl()).toString();
}
