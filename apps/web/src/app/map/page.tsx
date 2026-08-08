import { redirect } from 'next/navigation';

// The boxed funding-desert map grew into the full-viewport Atlas, which
// carries the same two layers plus their caveats. Temporary (307) rather than
// permanent until the replace-vs-coexist call is confirmed — if /map ever
// needs to come back as its own surface, nothing has burned the URL.
export default function MapPage() {
  redirect('/atlas');
}
