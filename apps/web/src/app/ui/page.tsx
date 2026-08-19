import type { Metadata } from 'next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const metadata: Metadata = { title: 'UI — CivicGraph' };

/**
 * The living design reference. Not a mock: every element below is the real component from
 * `components/ui`, reading the real tokens from globals.css. If this page looks right, the
 * system is right — and if a surface elsewhere disagrees with this page, that surface is wrong.
 *
 * The `ui` class is the opt-in scope (globals.css). Without it the global zero-radius rule
 * flattens every corner and the whole system renders square.
 */
export default function UiPage() {
  return (
    <div className="ui bg-background text-foreground min-h-screen p-10">
      <div className="mx-auto max-w-5xl space-y-8">

        <header className="space-y-2">
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">components/ui · the locked set</p>
          <h1 className="text-3xl font-semibold tracking-tight">CivicGraph UI</h1>
          <p className="text-muted-foreground max-w-prose text-sm">
            Every component here reads a token name, never a hex value. Change a token in
            globals.css and this page moves with the whole site.
          </p>
        </header>

        <Separator />

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Buttons</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button>Add to pack</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Export</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="destructive">Remove</Button>
            <Button variant="link">View source</Button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Badges — the states our data actually has</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Verified ABN</Badge>
            <Badge variant="secondary">Relationship</Badge>
            <Badge variant="outline">No amount on record</Badge>
            <Badge variant="destructive">Aggregate — excluded</Badge>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Stat cards</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Grantee links', value: '3,595', sub: '2,308 organisations' },
              { label: 'Community-controlled', value: '214', sub: 'vs 9 before the fix' },
              { label: 'No amount on record', value: '464', sub: '13% of all links' },
              { label: 'Evidence', value: '4', sub: '50 evidence-backed orgs' },
            ].map((s) => (
              <Card key={s.label}>
                <CardHeader>
                  <CardDescription>{s.label}</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">{s.value}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-xs">{s.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Input</h2>
          <Input placeholder="Search 66,000 charities…" className="max-w-sm" />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Table</h2>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grantee</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ['New School Of Arts Neighbourhood House', 'NSW', '$571K'],
                    ['Western Queensland Drought Committee', 'QLD', '$252K'],
                    ['Mudyala Aboriginal Corporation', 'NSW', '$148K'],
                  ].map(([name, state, amt]) => (
                    <TableRow key={name}>
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell className="text-muted-foreground">{state}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{amt}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

      </div>
    </div>
  );
}
