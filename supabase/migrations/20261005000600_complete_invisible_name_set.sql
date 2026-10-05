-- Third re-review fix (design D14, S-5): complete the default-ignorable set used by the profile name check.

-- ---------------------------------------------------------------------------
-- Profile name - same rule as 000400, with the invisible set extended by Khmer inherent vowels
-- (U+17B4-U+17B5), Mongolian free variation selectors (U+180B-U+180F), reserved specials
-- (U+FFF0-U+FFF8), shorthand format controls (U+1BCA0-U+1BCA3), musical format controls
-- (U+1D173-U+1D17A) and supplementary variation selectors (U+E0100-U+E01EF). Mirrors
-- INVISIBLE_CHARS in packages/shared/src/contracts/profile.ts.
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint profiles_full_name_trimmed_length;

alter table public.profiles
  add constraint profiles_full_name_trimmed_length
    check (
      char_length(
        regexp_replace(
          full_name,
          '^[[:space:]\u00a0\u00ad\u034f\u061c\u115f\u1160\u1680\u17b4-\u17b5\u180b-\u180f\u2000-\u200f\u2028-\u202f\u205f-\u2064\u2066-\u206f\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff0-\ufff8\U0001bca0-\U0001bca3\U0001d173-\U0001d17a\U000e0000-\U000e007f\U000e0100-\U000e01ef]+'
          || '|[[:space:]\u00a0\u00ad\u034f\u061c\u115f\u1160\u1680\u17b4-\u17b5\u180b-\u180f\u2000-\u200f\u2028-\u202f\u205f-\u2064\u2066-\u206f\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff0-\ufff8\U0001bca0-\U0001bca3\U0001d173-\U0001d17a\U000e0000-\U000e007f\U000e0100-\U000e01ef]+$',
          '',
          'g'
        )
      ) between 2 and 80
      and regexp_replace(
        full_name,
        '[[:space:]\u00a0\u00ad\u034f\u061c\u115f\u1160\u1680\u17b4-\u17b5\u180b-\u180f\u2000-\u200f\u2028-\u202f\u205f-\u2064\u2066-\u206f\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff0-\ufff8\U0001bca0-\U0001bca3\U0001d173-\U0001d17a\U000e0000-\U000e007f\U000e0100-\U000e01ef]',
        '',
        'g'
      ) ~ '[[:alnum:]]'
    );
