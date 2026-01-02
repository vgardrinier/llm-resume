# AGENTS.md

You are a coding agent working in this repo.
**Goal:** Ship small, correct changes fast. Prefer boring solutions.

## Stack
- Next.js 14 (App Router)
- React 18 with TypeScript (strict mode)
- Tailwind CSS
- Anthropic Claude SDK
- Puppeteer (PDF generation)

## Next.js + Claude SDK + Puppeteer notes
- Keep Claude SDK calls **server-side** (Route Handlers or Server Actions). Never expose keys to client
- For Puppeteer/PDF: runs in Node.js runtime (not Edge). Check API route compatibility if touching
- Be careful with server/client boundaries: only add `"use client"` when needed

## How to work
- If the request is ambiguous, ask 1 focused question or propose a default and proceed
- Make the smallest change that solves the problem
- Keep diffs small. If it's getting big, split into steps/PRs
- Always explain what you changed in plain English at the end (3–6 bullets)

## Code style
- This is a Next.js App Router project: components in `app/components/`, API routes in `app/api/`
- Use TypeScript strictly. No `any` unless unavoidable (comment why if you must)
- Follow existing component patterns—check `app/components/` for examples
- Tailwind for styling. No inline styles or new CSS files
- Be explicit with `"use client"` directive when component needs browser APIs
- Readability > cleverness. Avoid unnecessary abstractions

## Commands
This repo uses **npm**. Run from root:

- Install: `npm install`
- Dev: `npm run dev`
- Lint: `npm run lint`
- Type-check: `npm run type-check`
- Build: `npm run build`

Check `package.json` for other scripts. Don't invent new ones.

## Testing
No automated tests currently. When making changes:
- Manually verify in dev mode (`npm run dev`)
- Run type-check before committing (`npm run type-check`)
- Test the full user flow if you touch core features (upload, analysis, download)

## Definition of done (for most PRs)
- `npm run lint` passes
- `npm run type-check` passes
- Core flow works in dev:
  - Upload → analysis → download PDF
- No secrets logged, no `.env*` changes committed
- PR description includes: why this change / what you tested / risks or follow-ups

## Safety rules (critical)
- **Never** print or log env vars (API keys live in `.env.local`)
- **Avoid destructive commands** unless explicitly asked:
  - `rm -rf`, deleting large directories, or wiping `supabase/` data
  - DB migrations or schema changes
  - Changing Vercel/project settings
- Treat anything that deletes user data as a hard stop—ask first
- Don't push directly to `main`. Always use a feature branch

## Git workflow
- Branch per task: `feature/<short-name>` or `fix/<short-name>`
- One logical change per commit
- PR description must include:
  - What changed
  - How you verified it (commands + manual steps)
  - Known risks or follow-ups

## Decision log (lightweight)
For non-trivial changes, include a short note in your PR or commit:
- Why this approach
- What you checked
- What might still break

## When unsure
- If it could break prod, lose data, or create a security hole: **stop and ask**
- Otherwise, pick the simplest reasonable default, proceed, and state your assumptions clearly
