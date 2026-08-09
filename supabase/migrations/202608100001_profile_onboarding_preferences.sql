-- Profile onboarding preferences. All fields remain private under the existing
-- profiles RLS policies; no Auth, RLS, or Storage policy changes are required.

alter table public.profiles
  add column if not exists residence_country text,
  add column if not exists guardian_birth_year integer;

do $$ begin
  alter table public.profiles
    add constraint profiles_residence_country_check
    check (residence_country is null or residence_country in ('US', 'KR', 'OTHER'))
    not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.profiles
    add constraint profiles_preferred_language_check
    check (preferred_language in ('system', 'ko', 'en'))
    not valid;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.profiles
    add constraint profiles_guardian_birth_year_check
    check (guardian_birth_year is null or guardian_birth_year between 1900 and 2100)
    not valid;
exception when duplicate_object then null;
end $$;
