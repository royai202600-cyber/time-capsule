# 時光膠囊 / Time Capsule

A mobile-first web app for sending a sealed capsule that can only be opened when the time comes.
Project context, decisions and roadmap: see [AGENTS.md](AGENTS.md).

## Run locally

```bash
cd mobile
npm ci
cp .env.example .env.local   # then fill in the Supabase project URL and publishable key
npm run web                  # http://localhost:8088
```

## Database

Schema lives in `supabase/migrations/`. Apply it to the linked Supabase project with:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```
