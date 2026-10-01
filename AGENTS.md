<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project Decisions

- Brand: "Ledger" — Korean-language UI, monthly price tracker (tracked_items + price_entries, prices upserted per item+month, KRW default).
- Auth: Google social sign-in only (managed Cloud auth via `lovable.auth.signInWithOAuth`); gate is `src/routes/_authenticated.tsx` (ssr:false, redirect to /auth).
- Server logic lives in `src/lib/*.functions.ts` with `requireSupabaseAuth`; no Supabase Edge Functions.
- Design system: Frosted ledger direction in `src/styles.css` (oklch tokens: paper bg, ink fg, blue primary, rise=green/down-good, fall=red/up-bad; frosted `bg-panel` + `backdrop-blur`); fonts Inter / Inter Tight / JetBrains Mono via root head links. No ad-hoc colors in components.
- Change semantics: price falling = green (rise token), price rising = red (fall token).
