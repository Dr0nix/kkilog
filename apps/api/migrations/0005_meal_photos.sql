-- 한 끼에 사진 여러 장(최대 5장, spec 2.4). 사진은 Blob에 두고 DB엔 pathname만 저장한다(spec 5).
-- meal_entries.photo_path는 대표(첫) 사진으로 남겨 둔다. 기존 CHECK(input_text 또는 photo_path)와
-- 예전 앱(사진 1장)이 그대로 동작하게 하기 위해서다. 사진 목록은 이 테이블이 기준이다.

create table kkilog.meal_photos (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references kkilog.meal_entries (id) on delete cascade,
  position smallint not null check (position between 0 and 4), -- 0이 대표 사진(= meal_entries.photo_path)
  path text not null unique, -- Blob pathname
  created_at timestamptz not null default now(),
  unique (entry_id, position)
);

-- 기존 기록의 사진 한 장을 0번으로 옮긴다.
insert into kkilog.meal_photos (entry_id, position, path)
select id, 0, photo_path from kkilog.meal_entries where photo_path is not null;
