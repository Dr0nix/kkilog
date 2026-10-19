import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const SKIP_DIRS = new Set(['node_modules', '.expo', '.next', 'android', 'ios', 'dist']);

const SERVER_ONLY = ['@neondatabase/', '@vercel/blob', '@google/genai', '@kkilog/domain'];

// domain은 프레임워크·DB·외부 서비스·Node 내장 모듈에 의존하지 않는 순수 함수만 둔다.
const DOMAIN_FORBIDDEN = [
  '@neondatabase/',
  '@vercel/blob',
  '@google/genai',
  '@kkilog/contracts',
  'next',
  'react',
  'react-native',
  'expo',
  'server-only',
  'node:',
];

const ALLOWED_MOBILE_ENV = new Set(['EXPO_PUBLIC_API_BASE_URL']);

function extractImports(source: string): string[] {
  const patterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  return patterns.flatMap((re) => [...source.matchAll(re)].map((m) => m[1] as string));
}

function matches(specifier: string, prefix: string): boolean {
  if (prefix.endsWith('/') || prefix.endsWith(':')) return specifier.startsWith(prefix);
  return specifier === prefix || specifier.startsWith(`${prefix}/`) || specifier.startsWith(`${prefix}-`);
}

function listSources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return SKIP_DIRS.has(name) ? [] : listSources(path);
    return SOURCE_EXT.test(name) ? [path] : [];
  });
}

function violations(dir: string, forbidden: string[]): string[] {
  const absDir = join(ROOT, dir);
  return listSources(absDir).flatMap((file) =>
    extractImports(readFileSync(file, 'utf8'))
      .filter((spec) => {
        if (forbidden.some((prefix) => matches(spec, prefix))) return true;
        // 상대 경로로 packages/domain에 직접 닿는 것도 막는다.
        if (spec.startsWith('.') && forbidden.includes('@kkilog/domain')) {
          return resolve(file, '..', spec).includes(`${sep}packages${sep}domain`);
        }
        return false;
      })
      .map((spec) => `${relative(ROOT, file)} → ${spec}`),
  );
}

function declaredDeps(dir: string): string[] {
  const pkg = JSON.parse(readFileSync(join(ROOT, dir, 'package.json'), 'utf8')) as Record<
    string,
    Record<string, string> | undefined
  >;
  return ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].flatMap(
    (key) => Object.keys(pkg[key] ?? {}),
  );
}

describe('extractImports', () => {
  it('정적·동적 import와 require를 모두 찾는다', () => {
    const src = [
      "import a from '@neondatabase/serverless';",
      "import type { B } from \"@vercel/blob\";",
      "export * from '@kkilog/domain';",
      "import '@google/genai';",
      "const c = await import('next/server');",
      "const d = require('expo-secure-store');",
    ].join('\n');
    expect(extractImports(src)).toEqual(
      expect.arrayContaining([
        '@neondatabase/serverless',
        '@vercel/blob',
        '@kkilog/domain',
        '@google/genai',
        'next/server',
        'expo-secure-store',
      ]),
    );
  });
});

describe.each([
  ['apps/mobile', SERVER_ONLY],
  ['packages/contracts', SERVER_ONLY],
  ['packages/domain', DOMAIN_FORBIDDEN],
])('%s 의존성 경계', (dir, forbidden) => {
  it('검사할 소스 파일이 있다', () => {
    expect(listSources(join(ROOT, dir)).length).toBeGreaterThan(0);
  });

  it('금지된 모듈을 import하지 않는다', () => {
    expect(violations(dir, forbidden)).toEqual([]);
  });

  it('package.json에 금지된 의존성이 없다', () => {
    expect(declaredDeps(dir).filter((dep) => forbidden.some((p) => matches(dep, p)))).toEqual([]);
  });
});

describe('apps/mobile 환경변수', () => {
  it(`${[...ALLOWED_MOBILE_ENV].join(', ')} 외의 환경변수를 읽지 않는다`, () => {
    const used = listSources(join(ROOT, 'apps/mobile')).flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/process\.env(?:\.(\w+)|\[\s*['"](\w+)['"]\s*\]|\b)/g)].map(
        (m) => `${relative(ROOT, file)} → ${m[1] ?? m[2] ?? 'process.env'}`,
      ),
    );
    expect(used.filter((u) => !ALLOWED_MOBILE_ENV.has(u.split(' → ')[1] as string))).toEqual([]);
  });
});
