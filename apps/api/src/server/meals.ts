import 'server-only';
import type { Meal } from '@kkilog/contracts';
import { type MealAnalysisRow, type MealEntryRow, toMeal } from '../meals/view';
import { db } from './db';
import { type MealAnalysisResult, analyzeMeal } from './meal-analysis';
import { readPhotoBase64, signedPhotoUrl } from './photos';

const ENTRY_COLUMNS = 'id, meal_type, local_date::text as local_date, eaten_at, input_text, photo_path';

// 모든 조회는 user_id로 범위를 제한하고, 지운 끼니는 없는 것으로 본다(없음·남의 것 모두 404).
export async function findEntry(userId: string, entryId: string): Promise<MealEntryRow | null> {
  const rows = await db().query(
    `select ${ENTRY_COLUMNS} from kkilog.meal_entries where id = $1 and user_id = $2 and deleted_at is null`,
    [entryId, userId],
  );
  return (rows[0] as MealEntryRow | undefined) ?? null;
}

// 그날(local_date) 끼니들. 먹은 시각 순.
export async function findEntriesOn(userId: string, date: string): Promise<MealEntryRow[]> {
  const rows = await db().query(
    `select ${ENTRY_COLUMNS} from kkilog.meal_entries
     where user_id = $1 and local_date = $2 and deleted_at is null order by eaten_at`,
    [userId, date],
  );
  return rows as MealEntryRow[];
}

export async function findEntryByRequestId(userId: string, clientRequestId: string): Promise<MealEntryRow | null> {
  const rows = await db().query(
    `select ${ENTRY_COLUMNS} from kkilog.meal_entries where user_id = $1 and client_request_id = $2`,
    [userId, clientRequestId],
  );
  return (rows[0] as MealEntryRow | undefined) ?? null;
}

async function findAnalyses(entryId: string): Promise<MealAnalysisRow[]> {
  const rows = await db()`
    select status, items, kcal, carb_g, protein_g, fat_g, notes, correction_text, error, created_at
    from kkilog.meal_analyses where entry_id = ${entryId} order by created_at desc`;
  return rows as MealAnalysisRow[];
}

export async function toMealResponse(entry: MealEntryRow): Promise<Meal> {
  const [analyses, photoUrl] = await Promise.all([
    findAnalyses(entry.id),
    entry.photo_path ? signedPhotoUrl(entry.photo_path) : Promise.resolve(null),
  ]);
  return toMeal(entry, analyses, photoUrl);
}

export async function latestCorrectionText(entryId: string): Promise<string | null> {
  const rows = await db()`
    select correction_text from kkilog.meal_analyses where entry_id = ${entryId} order by created_at desc limit 1`;
  return (rows[0]?.correction_text as string | null | undefined) ?? null;
}

async function saveAnalysis(entryId: string, result: MealAnalysisResult): Promise<void> {
  const sql = db();
  const raw = result.raw === null ? null : JSON.stringify(result.raw);
  if (result.status === 'ok') {
    await sql`
      insert into kkilog.meal_analyses
        (entry_id, status, model_id, prompt_version, correction_text, items, kcal, carb_g, protein_g, fat_g, notes, raw_response)
      values
        (${entryId}, 'ok', ${result.modelId}, ${result.promptVersion}, ${result.correctionText},
         ${JSON.stringify(result.items)}::jsonb, ${result.totals.kcal}, ${result.totals.carb_g}, ${result.totals.protein_g},
         ${result.totals.fat_g}, ${result.notes}, ${raw}::jsonb)`;
  } else {
    await sql`
      insert into kkilog.meal_analyses (entry_id, status, model_id, prompt_version, correction_text, error, raw_response)
      values (${entryId}, 'failed', ${result.modelId}, ${result.promptVersion}, ${result.correctionText},
              ${result.error}, ${raw}::jsonb)`;
  }
}

// 원본(텍스트·사진)으로 분석하고 결과를 행으로 남긴다. 실패도 저장해 [재시도]할 수 있게 한다(spec 3).
// 분석 호출엔 이 끼니의 입력만 넣는다(CLAUDE.md).
export async function analyzeAndSave(
  entry: MealEntryRow,
  correctionText: string | null,
  photoBase64?: string,
): Promise<MealAnalysisResult> {
  const base64 = photoBase64 ?? (entry.photo_path ? await readPhotoBase64(entry.photo_path) : null);
  const result = await analyzeMeal({
    inputText: entry.input_text,
    correctionText,
    image: base64 ? { mimeType: 'image/jpeg', base64 } : null,
  });
  await saveAnalysis(entry.id, result);
  return result;
}

export async function profileTimezone(userId: string): Promise<string | null> {
  const rows = await db()`select timezone from kkilog.profiles where user_id = ${userId}`;
  return (rows[0]?.timezone as string | undefined) ?? null;
}
