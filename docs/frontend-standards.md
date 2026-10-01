# Frontend Standards

Applies to: `apps/web` (Next.js 15 App Router, React 19) — pages, layouts, components, server actions (client-facing side), realtime subscriptions, and UI copy.

## 1. Technology Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 App Router, React 19, TypeScript strict |
| Styling | Tailwind CSS + CSS variables (design tokens) |
| Primitives | Radix UI + shadcn-style components in `apps/web/src/presentation/ui/` |
| Forms | React Hook Form + Zod resolvers (schemas shared from `contracts/`) |
| Data | Server Components for reads; Server Actions for mutations; Supabase Realtime for live updates |
| Icons | lucide-react |
| i18n | Single es-AR dictionary module (`apps/web/src/i18n/es-AR.ts`), no hard-coded copy in components |
| Tests | Vitest + Testing Library for components/hooks; browser E2E via Playwright or Cursor browser MCP |

## 2. Project Structure

```text
apps/web/src/
├── app/                      # Routes: (auth)/login, (panel)/inbox, citizens, tasks, notes, knowledge, settings, support, metrics
├── presentation/
│   ├── ui/                   # Generic primitives (button, input, dialog, badge, avatar…)
│   ├── layout/               # App shell, sidebar, top bar, notifications dock
│   └── <feature>/            # inbox/, citizens/, tasks/, notes/, settings/… feature components
├── features/<feature>/       # Server actions + services (see backend-standards)
├── infrastructure/           # Supabase browser/server clients, realtime helpers
├── contracts/                # Zod schemas + DTO types consumed by UI
└── i18n/es-AR.ts
```

## 3. Component Conventions

- Server Components by default; add `"use client"` only for interactivity (composer, realtime lists, dialogs).
- Components receive typed props and call server actions; no Supabase service-role access, no Evolution calls, no LLM prompts.
- One component per file, `kebab-case.tsx` file names, `PascalCase` exports.
- Section comments per base-standards §9.3 (props group, state group, handlers, JSX regions).
- Optimistic updates allowed for claim/move/send, always reconciled with the server response and rolled back on error.

## 4. Realtime

- Subscribe per organization and filter by the operator's visible areas.
- Apply **partial updates** to local state (insert/update/delete payloads); do not refetch whole lists on every event.
- Debounce badge/notification recomputation; clean up channels on unmount.

## 5. UI/UX Standards

- Language: Spanish (es-AR), voseo, short and concrete. Error messages explain what happened and what to do.
- Layout: sidebar (collapsible) + top bar; inbox as queue list + thread + citizen side panel; responsive down to tablet.
- Queue cards show the flags defined in INB-10 (time, registered/unregistered, owner, area, pending delegation, needs response, SLA, bot state, attachments) with consistent badge colors and text labels (never color-only).
- Chat thread follows WhatsApp conventions (inbound left, outbound right) with distinct styles for bot, operator, and phone-originated messages.
- Destructive or irreversible actions (resolve, cancel task, merge citizens) require confirmation; "resolve" is never labelled "delete".
- Design tokens adapted from the reference CRM (IBM Plex Sans body, tabular numerals for DNI/phones), with an institutional palette for Epuyén.

## 6. Accessibility

- Keyboard reachable actions (claim, reply, delegate) with visible focus.
- Semantic landmarks, labelled form fields, `aria-live` for new-message announcements.
- Contrast AA minimum; status never conveyed by color alone.

## 7. Testing

- TDD for hooks and non-trivial components (queue ordering display, composer validation, delegation dialogs).
- Component tests with Testing Library against user-visible behavior, not implementation details.
- E2E for each roadmap phase's success criteria (login, claim conflict, delegation accept/reject, realtime reopen).
