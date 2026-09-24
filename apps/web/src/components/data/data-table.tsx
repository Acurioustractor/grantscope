import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  /** Right-align numbers and money; they also get tabular figures. */
  align?: 'left' | 'right';
  cell: (row: T) => ReactNode;
}

/**
 * The public data table: 4px black frame, black header row with white uppercase labels, 1px row
 * rules, numbers right-aligned in tabular figures. DESIGN.md "Tables". Scrolls sideways inside its
 * own frame on a phone instead of pushing the page wider.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  caption?: string;
}) {
  return (
    <div className="overflow-x-auto border-4 border-bauhaus-black bg-white">
      <table className="w-full border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="bg-bauhaus-black text-white">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`px-3 py-2 text-[11px] font-black uppercase tracking-widest ${c.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)} className="border-t border-bauhaus-black/20 hover:bg-link-light">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-3 py-2 align-top ${c.align === 'right' ? 'text-right font-mono tabular-nums' : 'text-left'}`}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
