# CLAUDE.md — Relay Project Context

This file is read at the start of every Claude Code session.
Do not delete or modify unless instructed.

---

## What Relay Is

A mobile-first scheduling app for small healthcare facilities,
specifically skilled nursing facilities (SNFs). The core problem:
when a shift goes uncovered, coordinators call nurses one by one
for 30-60 minutes. Relay replaces that — coordinators post open
shifts, nurses claim in one tap, coordinator approves in one click.

Real-world anchor: Burlingame Skilled Nursing (281-bed SNF, owned
by Brius Corporation). Target pricing: $4/nurse/month, free for
nurses, facility pays.

---

## Tech Stack

- React + Vite (JavaScript, no TypeScript)
- Supabase (auth, database, RLS)
- Vercel (deployment) — live at relay-iota-rose.vercel.app
- Tailwind CSS v4 (no tailwind.config.js — CSS-driven via @theme)
- shadcn/ui (style: new-york, base color: neutral, CSS variables on)
- Geist font via Google Fonts CDN (loaded in index.html)
- lucide-react for all icons
- Cursor IDE with Claude Code for implementation

---

## File Structure

src/
  App.jsx              — auth, session, role fetching, tab routing
  main.jsx             — imports both index.css and tailwind.css
  index.css            — legacy CSS (being phased out, do not add new
                         classes here)
  tailwind.css         — Tailwind v4 config + shadcn CSS variables +
                         custom tokens
  pages/
    Home.jsx           — nurse and coordinator home screens (role-aware)
    Schedule.jsx       — MyShiftsTab, OpenShiftsTab, TeamScheduleTab,
                         ManageTab (all in one file)
    ShiftDetail.jsx    — coworker view for a specific shift
    More.jsx           — sign out button
  components/
    Auth.jsx           — magic link + password login
    BottomNav.jsx      — bottom tab navigation with lucide icons
    ui/
      button.jsx       — shadcn Button
      input.jsx        — shadcn Input
      label.jsx        — shadcn Label
      pill.jsx         — ShiftPeriodPill and StatusPill components
  lib/
    supabase.js        — Supabase client
    shiftFormat.js     — date/time helpers
    utils.js           — cn() helper for Tailwind class merging

---

## Database Schema

profiles table:
  id (uuid, FK to auth.users)
  full_name (text)
  role (user_role enum: 'nurse' | 'coordinator')
  credential (text) — e.g. 'RN', 'CNA', 'LVN'

shifts table:
  id (uuid)
  nurse_id (uuid, nullable FK to profiles.id — null for open shifts)
  unit (text) — 'Unit 1', 'Unit 2', etc.
  starts_at (timestamptz)
  ends_at (timestamptz)
  status (shift_status enum: 'assigned' | 'open' | 'pending' |
          'cancelled')
  claimed_by (uuid, nullable FK to profiles.id)
  claimed_at (timestamptz, nullable)

Seeded test accounts (all have password 'relay123'):
  maria.santos@relay-test.com — RN, nurse
  derek.okafor@relay-test.com — CNA, nurse
  linda.tran@relay-test.com — LVN, nurse
  james.reyes@relay-test.com — RN, nurse
  jefleangelo@gmail.com — coordinator (real email, magic link works)

---

## RLS Security Model

is_coordinator() function: checks if auth.uid() matches a profile
with role='coordinator'

has_overlapping_shift() function: checks if current user has a shift
on the same unit overlapping the queried shift

Nurses see: own shifts + overlapping same-unit coworker shifts
Coordinators see: all shifts

Nurses can UPDATE a shift only to claim it:
  - Only when status='open'
  - Only setting status='pending', claimed_by=auth.uid(),
    claimed_at=now()
  - Cannot set nurse_id or approve their own claim

Never modify RLS without explicit instruction.

---

## Design System

### Tailwind v4 Custom Tokens (in src/tailwind.css)

@theme {
  --font-sans: 'Geist', sans-serif;
  --color-ink: #111111;
  --color-surface: #f8f7f5;
  --color-line: #e8e6e3;
  --radius-card: 0.75rem;
}

### Color Palette

Background: #FFFFFF (true white)
Surface/card bg: #F8F7F5 (warm light gray, used for avatar circles
                          and subtle backgrounds)
Border/divider: #E8E6E3
Text primary: #111111
Text secondary: #6B7280
Text muted: #9CA3AF
Primary button bg: #111111
Primary button text: #FFFFFF

### Shift Period Pills (ShiftPeriodPill component)

Day: bg #D97706 text white (amber)
Evening: bg #7C3AED text white (purple)
Night: bg #2563EB text white (blue)
Border radius: 999px, px-2.5 py-0.5, text-xs font-medium
Icons: Sun (Day), Sunset (Evening), Moon (Night) from lucide-react

### Status Pills (StatusPill component)

Open: bg #D1FAE5 text #059669 (green)
Pending: bg #FEF3C7 text #D97706 (amber)
Assigned: bg #EDE9FE text #7C3AED (purple)
Cancelled: bg #F3F4F6 text #6B7280 (gray)
Border radius: 999px, px-3 py-1, text-xs font-medium
Icons: Circle (Open), Clock (Pending), CheckCircle2 (Assigned),
       XCircle (Cancelled)

Always import from '@/components/ui/pill' — never recreate inline.

### Card Pattern

Every shift card uses this pattern:
  className="bg-white shadow-sm rounded-xl p-4"

Never use bg-surface (#F8F7F5) as a card background.
Use shadow-sm for elevation, not borders.

### Date Column Layout (used in all shift cards)

Left column (w-12, center-aligned, flex flex-col items-center):
  - Abbreviated weekday: text-xs uppercase tracking-wide text-muted
  - Day number: text-2xl font-bold text-ink
  - Abbreviated month: text-xs uppercase tracking-wide text-muted

Vertical divider: border-l border-line h-8 self-center mx-3

Right side (flex-1):
  - Time range: text-sm font-semibold text-ink (PRIMARY title)
  - Unit + credential: text-xs text-muted with | divider between them
  - Pill: positioned top-right of card

### Typography Hierarchy

Page titles: text-2xl font-bold text-ink
Section headings: text-sm font-semibold text-ink
Card primary (time range): text-sm font-semibold text-ink
Card secondary (unit, date): text-xs text-muted
Labels on forms: text-xs font-medium uppercase tracking-wide
                 text-secondary
Body text: text-sm text-secondary

Greeting pattern (Home.jsx):
  "Good morning/afternoon/evening," — text-3xl font-medium
                                       text-secondary (#6B7280)
  Name — text-3xl font-bold text-ink (#111111)

### Buttons

Primary: rounded-full bg-ink text-white font-semibold py-3
         hover:bg-ink/90
Secondary/outline: rounded-full border border-line text-ink
                   bg-white
Danger: rounded-full bg-red-500 text-white
Small action: rounded-full px-4 py-1.5 text-sm

### Forms

Inputs and selects:
  rounded-xl border border-line p-3 text-sm w-full
  focus:outline-none focus:border-ink

### Apple-Like Principles (always follow these)

- Extreme whitespace — don't crowd elements
- Typography hierarchy does the work, not decoration
- No unnecessary borders — use shadow-sm or bg contrast instead
- Rounded corners everywhere — cards (12px), buttons and pills (999px)
- Muted secondary info — dates, units, credentials should recede
- Buttons feel substantial — tall padding, full width on mobile
- Nothing cluttered — if two elements compete, one should recede
- Geist font with tight letter spacing on headings

---

## Features Built and Working

DO NOT refactor or redesign these unless explicitly instructed:

Auth:
  - Magic link (email OTP) via Supabase
  - Email/password toggle
  - Role fetched from profiles on login

Home (nurse):
  - Time-aware greeting with bold name
  - Working status with today's shift unit and time inline
  - Upcoming shifts (7-day) with date column cards

Home (coordinator):
  - Same greeting
  - Stat row: shifts today, nurses scheduled, unstaffed days
  - Coverage gaps list (date cards with warning icon)
  - Go to Manage button (routes to Manage tab)

ShiftDetail:
  - Shift hero card with time, unit, credential, date, period pill
  - Working with section: coworker rows with avatar initials,
    name, credential, time range
  - Profiles join uses profiles!nurse_id to avoid ambiguity

Schedule — My Shifts:
  - 4-week view grouped by day
  - Date column card layout
  - Day off rows (no card, muted text)

Schedule — Open Shifts:
  - Lists open shifts nurse can claim
  - One-tap claim with optimistic UI
  - Race condition handled: second nurse gets "shift just taken"
  - Claimed shift shows "Requested" status

Schedule — Team Schedule:
  - Grouped by day, then by time slot
  - Each time slot = one card with all nurses as rows inside
  - Avatar initials, name, credential per nurse row
  - Open shifts show "Open shift" row with Open pill

Schedule — Manage (coordinator only):
  - Post a shift (assigned or open/unassigned)
  - Recent shifts list (3 shown, expandable with Show all)
  - Edit shift: inline form, pre-filled, all fields editable
  - Delete shift: inline warning, pending claim warning if applicable
  - Pending claims: Approve/Deny buttons
  - Duplicate a week: source/dest pickers, conflict detection,
    DST-safe shifting

More:
  - Sign out button

BottomNav:
  - Home / Schedule / More tabs
  - lucide-react icons: Home, Calendar, MoreHorizontal
  - Active: text-ink, Inactive: text-muted

---

## Current Task

Adding home_unit field to profiles table so open shifts can be
filtered by the nurse's unit.

Migration needed (run in Supabase SQL editor):
  ALTER TABLE profiles ADD COLUMN home_unit text;

After migration:
1. Update RLS on shifts SELECT policy so nurses can see open shifts
   on their home_unit even without an overlapping shift
2. Update OpenShiftsTab in Schedule.jsx to filter open shifts by
   the nurse's home_unit
3. Add a way for coordinator to set home_unit per nurse (in Manage
   tab or a new admin section)

---

## Known Gaps (fix in this order)

1. Open shifts unit filter — IN PROGRESS (current task)
2. Denied nurse notification — nurse gets no feedback when claim
   is denied, shift just disappears from their view
3. Nothing in the app says "Relay" — branding pass needed before
   showing to anyone at the facility

---

## What NOT to Build Yet

- Time-off and availability requests
- Credential-based shift eligibility filtering
- Overtime alerts
- CA staffing ratio warnings (needs legal review)
- Payroll integration
- Automated schedule generation
- Calendar view for Schedule page (planned but deferred)

---

## Working Style

- Plan in the separate Claude chat, implement here in Claude Code
- Always read relevant files before writing code
- Draft first, wait for approval before iterating
- Never use em dashes in any output
- Match existing patterns exactly -- do not introduce new design
  language
- When touching Schedule.jsx, be careful -- it is large and contains
  all four tabs
- Always show screenshots via claude-in-chrome after UI changes
- Commit messages should be descriptive and lowercase
