-- 인증을 운영자 발급 접속 코드로 바꾼다(spec 4절).
-- allowed_emails는 쓰지 않으므로 삭제하고, 사용자·코드 테이블을 만든 뒤 profiles를 users에 연결한다.

drop table kkilog.allowed_emails;

create table kkilog.users (
  id uuid primary key default gen_random_uuid(),
  label text not null unique check (char_length(label) between 1 and 40), -- 운영자가 알아보는 이름. 앱엔 노출하지 않음
  created_at timestamptz not null default now()
);

create table kkilog.access_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references kkilog.users (id),
  code_hash bytea not null unique check (octet_length(code_hash) = 32), -- sha256(정규화한 코드). 원문은 저장하지 않음
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
-- 사용자당 유효 코드는 하나
create unique index access_codes_active_user_idx on kkilog.access_codes (user_id) where revoked_at is null;

alter table kkilog.profiles
  add constraint profiles_user_id_fkey foreign key (user_id) references kkilog.users (id);
