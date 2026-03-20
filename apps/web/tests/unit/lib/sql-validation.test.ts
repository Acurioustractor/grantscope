import { describe, it, expect } from 'vitest';
import { cleanSqlOutput, validateSql } from '@/lib/sql-validation';

describe('cleanSqlOutput', () => {
  it('strips <think> blocks', () => {
    const raw = '<think>Let me think about this query...</think>\nSELECT * FROM gs_entities';
    expect(cleanSqlOutput(raw)).toBe('SELECT * FROM gs_entities');
  });

  it('strips nested <think> blocks with newlines', () => {
    const raw = '<think>\nStep 1: consider the schema\nStep 2: write query\n</think>\n\nSELECT COUNT(*) FROM gs_entities';
    expect(cleanSqlOutput(raw)).toBe('SELECT COUNT(*) FROM gs_entities');
  });

  it('strips markdown sql code fences', () => {
    const raw = '```sql\nSELECT * FROM gs_entities\n```';
    expect(cleanSqlOutput(raw)).toBe('SELECT * FROM gs_entities');
  });

  it('strips plain markdown code fences', () => {
    const raw = '```\nSELECT * FROM gs_entities\n```';
    expect(cleanSqlOutput(raw)).toBe('SELECT * FROM gs_entities');
  });

  it('strips trailing semicolons', () => {
    expect(cleanSqlOutput('SELECT 1;')).toBe('SELECT 1');
    expect(cleanSqlOutput('SELECT 1 ;  ')).toBe('SELECT 1');
  });

  it('handles combined think + fences + semicolon', () => {
    const raw = '<think>reasoning</think>\n```sql\nSELECT * FROM gs_entities;\n```';
    expect(cleanSqlOutput(raw)).toBe('SELECT * FROM gs_entities');
  });

  it('preserves clean SQL unchanged', () => {
    expect(cleanSqlOutput('SELECT * FROM gs_entities')).toBe('SELECT * FROM gs_entities');
  });

  it('handles empty string', () => {
    expect(cleanSqlOutput('')).toBe('');
  });
});

describe('validateSql', () => {
  it('accepts valid SELECT query', () => {
    const result = validateSql('SELECT * FROM gs_entities');
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.sql).toBe('SELECT * FROM gs_entities LIMIT 100');
  });

  it('accepts valid WITH (CTE) query', () => {
    const result = validateSql('WITH cte AS (SELECT 1) SELECT * FROM cte');
    expect(result.valid).toBe(true);
  });

  it('auto-appends LIMIT 100 when missing', () => {
    const result = validateSql('SELECT * FROM gs_entities');
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.sql).toContain('LIMIT 100');
  });

  it('preserves existing LIMIT', () => {
    const result = validateSql('SELECT * FROM gs_entities LIMIT 10');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.sql).toBe('SELECT * FROM gs_entities LIMIT 10');
      expect(result.sql).not.toContain('LIMIT 100');
    }
  });

  it('rejects empty SQL', () => {
    const result = validateSql('');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe('Empty SQL query');
  });

  it('rejects whitespace-only SQL', () => {
    const result = validateSql('   ');
    expect(result.valid).toBe(false);
  });

  it('rejects INSERT statements', () => {
    const result = validateSql('INSERT INTO gs_entities VALUES (1)');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('SELECT');
  });

  it('rejects DROP TABLE', () => {
    const result = validateSql('SELECT 1; DROP TABLE gs_entities');
    // Starts with SELECT but contains DROP
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('DROP');
  });

  it('rejects DELETE disguised after SELECT', () => {
    const result = validateSql('SELECT 1 UNION ALL DELETE FROM gs_entities');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('DELETE');
  });

  it('rejects UPDATE disguised after SELECT', () => {
    const result = validateSql("SELECT 1 WHERE 1=0 UPDATE gs_entities SET canonical_name = 'hacked'");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('UPDATE');
  });

  it('rejects TRUNCATE', () => {
    const result = validateSql('SELECT 1; TRUNCATE gs_entities');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('TRUNCATE');
  });

  it('rejects ALTER TABLE', () => {
    const result = validateSql('SELECT 1; ALTER TABLE gs_entities ADD COLUMN hacked text');
    expect(result.valid).toBe(false);
  });

  it('rejects CREATE TABLE', () => {
    const result = validateSql('SELECT 1; CREATE TABLE hacked (id int)');
    expect(result.valid).toBe(false);
  });

  it('rejects GRANT', () => {
    const result = validateSql('SELECT 1; GRANT ALL ON gs_entities TO public');
    expect(result.valid).toBe(false);
  });

  it('rejects EXECUTE', () => {
    const result = validateSql("SELECT 1; EXECUTE 'DROP TABLE gs_entities'");
    expect(result.valid).toBe(false);
  });

  it('allows blocked keywords inside string literals', () => {
    const result = validateSql("SELECT * FROM gs_entities WHERE canonical_name ILIKE '%DROP TABLE%'");
    expect(result.valid).toBe(true);
  });

  it('allows INSERT/UPDATE/DELETE as column value in strings', () => {
    const result = validateSql("SELECT * FROM gs_entities WHERE sector = 'INSERT' OR sector = 'UPDATE'");
    expect(result.valid).toBe(true);
  });

  it('is case-insensitive for SELECT check', () => {
    const result = validateSql('select * from gs_entities');
    expect(result.valid).toBe(true);
  });

  it('is case-insensitive for blocked keywords', () => {
    const result = validateSql('SELECT 1; drop table gs_entities');
    expect(result.valid).toBe(false);
  });

  it('handles WITH ... SELECT pattern', () => {
    const result = validateSql(`
      WITH top_orgs AS (
        SELECT canonical_name, COUNT(*) as cnt
        FROM gs_entities
        GROUP BY canonical_name
      )
      SELECT * FROM top_orgs ORDER BY cnt DESC LIMIT 10
    `);
    expect(result.valid).toBe(true);
    if (result.valid) {
      // Should NOT double-add LIMIT since it already has one
      expect(result.sql.match(/LIMIT/gi)?.length).toBe(1);
    }
  });
});
