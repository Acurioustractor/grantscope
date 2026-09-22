import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectTableReaders } from './table-readers';

const GENERATED = join(__dirname, 'table-readers.generated.json');

describe('table-readers.generated.json', () => {
  it('matches what the source actually reads', () => {
    const actual = collectTableReaders(join(__dirname, '..'));
    if (process.env.UPDATE_TABLE_READERS) {
      writeFileSync(GENERATED, JSON.stringify(actual, null, 1) + '\n');
      return;
    }
    const committed = JSON.parse(readFileSync(GENERATED, 'utf8'));
    expect(committed, 'stale: run UPDATE_TABLE_READERS=1 npx vitest run src/lib/table-readers.test.ts').toEqual(actual);
  });
});
