import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const cache = new Map<string, string>();

// apps/api/prompts/<name>/<version>.md. 배포 번들에 포함되도록 next.config.ts의 outputFileTracingIncludes에 등록돼 있다.
export async function loadPrompt(name: string, version: string): Promise<string> {
  const key = `${name}/${version}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const text = await readFile(join(process.cwd(), 'prompts', name, `${version}.md`), 'utf8');
  cache.set(key, text);
  return text;
}
