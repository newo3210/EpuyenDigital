-- Second re-review fix (design D13, R-4): profile names must contain a visible letter or number.

-- ---------------------------------------------------------------------------
-- Profile name - trim invisible characters, measure 2-80, and require a letter or number once
-- invisible characters (blanks, zero-width/bidi marks, soft hyphen, Hangul fillers, braille blank,
-- variation selectors, tag characters) are removed everywhere. Hangul fillers count as letters in
-- the en_US.UTF-8 ctype, so they must be stripped before the letter check.
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint profiles_full_name_trimmed_length;

alter table public.profiles
  add constraint profiles_full_name_trimmed_length
    check (
      char_length(
        regexp_replace(
          full_name,
          '^[[:space:]\u00a0\u00ad\u034f\u061c\u115f\u1160\u1680\u180e\u2000-\u200f\u2028-\u202f\u205f-\u2064\u2066-\u206f\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\U000e0000-\U000e007f]+'
          || '|[[:space:]\u00a0\u00ad\u034f\u061c\u115f\u1160\u1680\u180e\u2000-\u200f\u2028-\u202f\u205f-\u2064\u2066-\u206f\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\U000e0000-\U000e007f]+$',
          '',
          'g'
        )
      ) between 2 and 80
      and regexp_replace(
        full_name,
        '[[:space:]\u00a0\u00ad\u034f\u061c\u115f\u1160\u1680\u180e\u2000-\u200f\u2028-\u202f\u205f-\u2064\u2066-\u206f\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\U000e0000-\U000e007f]',
        '',
        'g'
      ) ~ '[[:alnum:]]'
    );
