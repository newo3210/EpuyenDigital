-- Re-review fixes (design D12, 2026-10-05): PG 17 MAINTAIN privilege and Unicode-blank names.

-- ---------------------------------------------------------------------------
-- Least privilege - PG 17 grants MAINTAIN (VACUUM, ANALYZE, REINDEX, LOCK...) with the default table grants
-- ---------------------------------------------------------------------------
revoke maintain on public.organizations, public.profiles, public.error_logs from authenticated;

-- ---------------------------------------------------------------------------
-- Profile name - length measured after trimming Unicode blanks (spaces, tabs, NBSP, zero-width, BOM)
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint profiles_full_name_trimmed_length;

alter table public.profiles
  add constraint profiles_full_name_trimmed_length
    check (
      char_length(
        regexp_replace(
          full_name,
          '^[[:space:]\u00a0\u1680\u2000-\u200d\u2028\u2029\u202f\u205f\u2060\u3000\ufeff]+|[[:space:]\u00a0\u1680\u2000-\u200d\u2028\u2029\u202f\u205f\u2060\u3000\ufeff]+$',
          '',
          'g'
        )
      ) between 2 and 80
    );
