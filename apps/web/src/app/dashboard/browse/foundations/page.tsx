import { redirect } from 'next/navigation';

/**
 * The index moved to its public URL, /foundations, and kept the Shell layout with it.
 *
 * It lived here and at /foundations simultaneously — two indexes over identical data, one a thin
 * config over the shared browser and one bespoke. The shared one won; putting it at the
 * already-ranked public URL rather than redirecting that URL here keeps the link equity and
 * stops a visitor's entry point reading as "dashboard".
 *
 * Temporary (307): nothing has burned this path, and the detail page below it still lives here.
 */
export default function MovedBrowseFoundations() {
  redirect('/foundations');
}
