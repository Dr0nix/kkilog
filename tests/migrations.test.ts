import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = resolve(import.meta.dirname, '..', 'apps', 'api', 'migrations');
const files = readdirSync(DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort();

function stripComments(sql: string): string {
  return sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

// 쓰기 대상(테이블·인덱스 대상 테이블 등)으로 쓰인 이름을 모은다.
function writeTargets(sql: string): string[] {
  const patterns = [
    /\b(?:create|alter|drop)\s+(?:table|view|materialized\s+view|sequence|type|function)\s+(?:if\s+(?:not\s+)?exists\s+)?([\w."]+)/gi,
    /\bcreate\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?(?:[\w"]+\s+)?on\s+(?:only\s+)?([\w."]+)/gi,
    // FK의 `on update`/`on delete`는 DML이 아니라서 제외한다.
    /\b(?:insert\s+into|(?<!\bon\s+)update|delete\s+from|truncate(?:\s+table)?)\s+([\w."]+)/gi,
  ];
  return patterns.flatMap((re) => [...sql.matchAll(re)].map((m) => m[1] as string));
}

function referenceTargets(sql: string): string[] {
  return [...sql.matchAll(/\breferences\s+([\w."]+)/gi)].map((m) => m[1] as string);
}

describe('writeTargets', () => {
  it('테이블·인덱스·DML 대상을 찾는다', () => {
    const sql = [
      'create table if not exists public.a (id int);',
      'create unique index a_idx on neon_auth.users (id);',
      'alter table b add column c int;',
      'insert into kkilog.c values (1);',
      'update other.d set x = 1;',
    ].join('\n');
    expect(writeTargets(sql)).toEqual(
      expect.arrayContaining(['public.a', 'neon_auth.users', 'b', 'kkilog.c', 'other.d']),
    );
  });

  it('FK의 on update / on delete는 대상으로 보지 않는다', () => {
    const sql = 'create table kkilog.x (y uuid references kkilog.z (id) on update cascade on delete cascade);';
    expect(writeTargets(sql)).toEqual(['kkilog.x']);
  });
});

describe('마이그레이션 파일', () => {
  it('하나 이상 있다', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('NNNN_name.sql 형식이고 0001부터 빠짐없이 이어진다', () => {
    files.forEach((name, i) => {
      expect(name).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/);
      expect(name.slice(0, 4)).toBe(String(i + 1).padStart(4, '0'));
    });
  });

  describe.each(files)('%s', (name) => {
    const sql = stripComments(readFileSync(join(DIR, name), 'utf8'));

    it('kkilog 스키마 안의 객체만 만들거나 바꾼다', () => {
      expect(writeTargets(sql).filter((t) => !t.startsWith('kkilog.'))).toEqual([]);
    });

    it('kkilog 안의 테이블만 참조한다', () => {
      expect(referenceTargets(sql).filter((t) => !t.startsWith('kkilog.'))).toEqual([]);
    });

    it('search_path·스키마 생성/삭제에 의존하지 않는다', () => {
      expect(sql).not.toMatch(/\bsearch_path\b/i);
      expect(sql).not.toMatch(/\b(?:create|drop|alter)\s+schema\b/i);
    });
  });
});
