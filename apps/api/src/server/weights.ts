import 'server-only';
import type { WeightLog } from '@kkilog/contracts';
import { toIso } from '../meals/view';
import { db } from './db';

type WeightRow = { id: string; local_date: string; weight_kg: string | number; measured_at: Date | string };

const toWeightLog = (row: WeightRow): WeightLog => ({
  id: row.id,
  local_date: row.local_date,
  weight_kg: Number(row.weight_kg),
  measured_at: toIso(row.measured_at),
});

// 체중은 덮어쓰지 않고 쌓는다(spec 5). 같은 client_request_id면 기존 기록을 돌려준다.
export async function saveDailyWeight(args: {
  userId: string;
  clientRequestId: string;
  localDate: string;
  weightKg: number;
}): Promise<WeightLog> {
  const sql = db();
  const inserted = await sql`
    insert into kkilog.weight_logs (user_id, client_request_id, local_date, weight_kg, source)
    values (${args.userId}, ${args.clientRequestId}, ${args.localDate}, ${args.weightKg}, 'daily')
    on conflict (user_id, client_request_id) do nothing
    returning id, local_date::text as local_date, weight_kg, measured_at`;
  let row = inserted[0] as WeightRow | undefined;
  if (!row) {
    const existing = await sql`
      select id, local_date::text as local_date, weight_kg, measured_at from kkilog.weight_logs
      where user_id = ${args.userId} and client_request_id = ${args.clientRequestId}`;
    row = existing[0] as WeightRow | undefined;
  }
  if (!row) throw new Error('weight log conflict without existing row');
  return toWeightLog(row);
}
