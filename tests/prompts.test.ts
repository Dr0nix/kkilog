import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = resolve(import.meta.dirname, '..', 'apps', 'api', 'prompts');

// 기존 버전 프롬프트는 수정하지 않는다(CLAUDE.md). 새 버전 파일을 추가하면 여기에 해시를 등록한다.
// 머지 전(아직 배포 안 된) 버전만 해시를 고쳐도 된다.
const LOCKED: Record<string, string> = {
  'calorie-target/v1.md': '0f0e347b29dec5377d3b7005408148db694684bb626d6a7d4a33839ee649a050',
  'calorie-target/v2.md': '1bd7561eb9feb7dbe26b940fac6d55ecabd43c9bfee39ab68e73f280eb750359',
  'meal-analysis/v1.md': '4ae60e83295950690e88417365aee9eba10b483676b71812813e39277db2567e',
  'meal-analysis/v2.md': '3f0ff3c1a70156871085d3252ebcc169163e847fa9c53f0f2007be660acdb582',
};

const files = readdirSync(DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((dir) =>
    readdirSync(join(DIR, dir.name))
      .filter((name) => name.endsWith('.md'))
      .map((name) => `${dir.name}/${name}`),
  )
  .sort();

describe('프롬프트 버전 파일', () => {
  it('모든 파일이 등록돼 있고 이름은 v<숫자>.md', () => {
    expect(files).toEqual(Object.keys(LOCKED).sort());
    for (const file of files) expect(file).toMatch(/^[a-z0-9-]+\/v\d+\.md$/);
  });

  it.each(Object.entries(LOCKED))('%s 내용이 바뀌지 않았다', (file, hash) => {
    const text = readFileSync(join(DIR, file), 'utf8').replace(/\r\n/g, '\n');
    expect(createHash('sha256').update(text).digest('hex')).toBe(hash);
  });
});
