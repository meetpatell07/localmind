# UI.md — Design System & Patterns

> Extracted from LocalMind. Copy this into any new project so you don't start from scratch or ship AI-generated generic slop.

---

## Core Philosophy

- **White + gray base, one accent color.** Don't use multiple brand colors. Pick blue or slate. Everything else is gray.
- **Density over spaciousness for dashboards.** Tight enough to show data, loose enough to breathe. `p-4 md:p-5` is the sweet spot.
- **Text is the UI.** Icons are decorative — labels always come with them. Never icon-only nav in desktop apps.
- **Active states, not hover states.** Hover is subtle (`bg-gray-50`). Active/selected is clear (`bg-gray-100`, bold text, or a border indicator).
- **Relative time everywhere.** "5m ago" > "Mar 25, 2026 3:14pm". Only use full dates in tables.

---

## Colors

Use oklch for design tokens. This is what works:

```css
:root {
  --background: oklch(1 0 0);           /* pure white */
  --foreground: oklch(0.145 0 0);       /* near black */
  --brand: #1447e5;                     /* one blue — use sparingly */
  --muted: oklch(0.97 0 0);            /* off-white, backgrounds */
  --muted-foreground: oklch(0.556 0 0); /* gray text */
  --border: oklch(0.922 0 0);          /* very light border */
  --radius: 0.625rem;                   /* base: 10px */
}
```

**Semantic color usage:**
- `text-gray-900` — headings, primary text
- `text-gray-700` — secondary text, labels
- `text-gray-500` — captions, metadata, placeholders
- `text-gray-400` — empty states, disabled text
- `border-gray-100` — card borders (subtle)
- `border-gray-200` — input borders, dividers

**Status colors (always use these same ones):**
```
success  → emerald-500, bg-emerald-50, text-emerald-700, border-emerald-200
warning  → amber-500,   bg-amber-50,   text-amber-700,   border-amber-200
error    → red-500,     bg-red-50,     text-red-700,     border-red-200
info     → blue-500,    bg-blue-50,    text-blue-700,    border-blue-200
purple   → purple-500,  bg-purple-50,  text-purple-700   (AI/memory things)
```

**Priority colors:**
```
high   → bg-red-100 text-red-700
medium → bg-amber-100 text-amber-700
low    → bg-emerald-100 text-emerald-700
```

---

## Typography

```
Page title:       text-2xl font-bold tracking-tight text-gray-900
Section heading:  text-lg font-bold tracking-tight text-gray-900
Card heading:     text-sm font-bold text-gray-900
Nav label:        text-sm font-medium text-muted-foreground
Body:             text-sm text-gray-700
Caption/meta:     text-xs font-medium text-gray-500
Empty state:      text-sm text-gray-400
Badge text:       text-[10px] font-medium uppercase tracking-wider
Code:             font-mono text-sm (tabular-nums)
```

**Never use:** `text-base` (too big for dense UIs), `font-light` (too weak), `text-xl` for body.

---

## Layout Shell (App/Dashboard)

```tsx
// Root: fixed sidebar + scrollable content
<div className="flex h-dvh overflow-hidden">
  <aside className="fixed z-40 flex flex-col bg-background border-r p-4 h-dvh w-64
                    transform -translate-x-full md:translate-x-0 transition-all duration-100" />
  <main className="flex-1 ml-0 md:ml-64 flex flex-col overflow-hidden">
    <div className="flex-1 overflow-y-auto">
      {/* page content */}
    </div>
  </main>
</div>

// Page content max-width
<div className="w-full max-w-5xl mx-auto px-6 pt-4 pb-12">
```

**Rules:**
- `h-dvh` not `h-screen` — handles mobile browser chrome correctly
- Sidebar is `fixed`, content gets `ml-64` margin
- Content areas always have a max-width (`max-w-5xl`) and center
- Never full-bleed content in dashboards — it feels broken on wide screens

---

## Sidebar

```tsx
// Nav item — inactive
<Link className="group flex w-full items-center gap-3 rounded-lg
                 hover:bg-gray-50 active:bg-gray-100">
  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
    <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} aria-hidden />
  </span>
  <span className="text-sm font-medium text-muted-foreground">Label</span>
</Link>

// Nav item — active
<Link className="bg-gray-50 text-foreground">
  <Icon className="h-4 w-4 text-foreground" />
  <span className="text-sm font-semibold text-foreground">Label</span>
</Link>
```

**Rules:**
- Icon container is always `h-8 w-8` — consistent tap target
- Active = `bg-gray-50` + foreground color + `font-semibold`
- Inactive = `text-muted-foreground` + `hover:bg-gray-50`
- `aria-current="page"` on active link
- Bottom section (`Settings`, user badge) uses `mt-auto pt-2`

---

## Tab Bar (in-page tabs)

```tsx
// Tab bar
<div className="flex items-center gap-6 border-b border-gray-100 overflow-x-auto no-scrollbar">
  <button className="group flex items-center gap-2 pb-3 text-sm font-medium
                     text-gray-500 hover:text-gray-700 relative whitespace-nowrap">
    <Icon className="size-4 text-gray-400 group-hover:text-gray-600" />
    Tab Label
    {/* Active indicator */}
    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-600 rounded-t-full" />
  </button>
</div>
```

**Rules:**
- Active indicator: `h-[2px] bg-blue-600 rounded-t-full` — not `border-b`, not underline
- `overflow-x-auto no-scrollbar` — tabs scroll on mobile, no ugly scrollbar
- `pb-3` on tab, `border-b` on container — keeps line flush
- `whitespace-nowrap` — never wrap tab text

---

## Cards

```tsx
// Standard card
<div className="border border-gray-100 rounded-xl bg-white shadow-sm">
  {/* content */}
</div>

// Card with sections (use divide instead of nested borders)
<div className="border border-gray-100 rounded-xl bg-white shadow-sm
                divide-y divide-gray-100 overflow-hidden">
  <div className="p-4 md:p-5">{/* section 1 */}</div>
  <div className="p-4 md:p-5">{/* section 2 */}</div>
</div>

// Interactive card (clickable)
<Link className="border border-gray-100 rounded-xl bg-gray-50
                 hover:border-blue-200 hover:bg-blue-50/40
                 transition-all p-4 flex items-center gap-4 group">
```

**Rules:**
- `border-gray-100` not `border-gray-200` — lighter feels more premium
- `rounded-xl` for cards, `rounded-lg` for smaller containers, `rounded-md` for inputs
- `shadow-sm` baseline, no shadow on hover (instead change border color)
- Interactive cards: change `border` color on hover, not `shadow`
- `overflow-hidden` when using `divide-y` inside rounded containers

---

## Badges & Pills

```tsx
// Source tag (filled)
<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full
                 bg-blue-50/50 border border-blue-100 text-[10px] font-medium text-blue-600">
  <div className="size-1.5 rounded-full bg-blue-600" />
  Chat
</span>

// Status pill
<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                 text-xs font-medium border
                 bg-emerald-50/80 border-emerald-200/60 text-emerald-700">
  <CheckmarkCircle01Icon className="size-3 shrink-0" />
  Connected
</span>

// Tool call badge (running → done)
<div className={cn(
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
  isRunning && "bg-amber-50/80 border-amber-200/60 text-amber-700",
  isDone    && "bg-emerald-50/80 border-emerald-200/60 text-emerald-700",
)}>
  {isRunning ? <Spinner /> : <CheckIcon />}
  {label}
</div>
```

**Rules:**
- Always `rounded-full` for status pills, `rounded-md` for action tags
- Background is `/80` opacity (`bg-emerald-50/80`) — not flat
- Border matches the color family (`border-emerald-200/60`)
- The tiny dot (`size-1.5 rounded-full`) replaces icons when space is tight

---

## Avatars & Initials

```tsx
// User avatar (initial)
<div className="size-7 rounded-full bg-gray-200 flex items-center justify-center
                text-sm font-medium text-gray-600 shrink-0">
  M
</div>

// AI avatar / colored avatar
<div className="size-8 rounded-full bg-blue-100 text-blue-700
                flex items-center justify-center text-sm font-semibold shrink-0 shadow-sm">
  AI
</div>

// Icon avatar (for entities/tools)
<div className="size-10 rounded-lg bg-purple-100 text-purple-600
                flex items-center justify-center shrink-0">
  <Icon className="size-5" />
</div>
```

**Rules:**
- User initials: `size-7`, `bg-gray-200`
- AI/system: `size-8`, color-matched to context, `shadow-sm`
- Feature/icon avatars: `size-10 rounded-lg` (not circle)
- Always `shrink-0` — avatars never compress in flex rows

---

## Feed / Timeline Row Pattern

Use this for any activity feed, inbox, or notification list:

```tsx
<Link className="p-4 md:p-5 flex flex-col gap-1 hover:bg-gray-50/50 transition-colors">
  {/* Meta row */}
  <div className="flex items-center justify-between mb-1.5">
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 font-medium w-16 shrink-0">5m ago</span>
      <Badge />
    </div>
    <SourceIcon />
  </div>

  {/* Sender row */}
  <div className="flex items-center gap-3">
    <div className="w-16 shrink-0 flex justify-end pr-2">
      <Avatar />
    </div>
    <div className="flex-1 min-w-0">
      <span className="text-sm font-semibold text-gray-900 truncate">Name</span>
      <span className="text-[13px] text-gray-500">detail</span>
    </div>
  </div>

  {/* Content */}
  <div className="flex">
    <div className="w-16 shrink-0 hidden md:block" />  {/* gutter to align with avatar */}
    <div className="flex-1 min-w-0 md:pl-3 pt-1">
      <p className="text-[14px] font-semibold text-gray-900">Subject</p>
      <p className="text-[13px] text-gray-500 line-clamp-2">Body preview</p>
    </div>
  </div>
</Link>
```

**Group by date:**
```
TODAY, YESTERDAY, MONDAY MARCH 23 (all caps, `text-xs font-semibold text-gray-400 uppercase tracking-wider`)
```

---

## Status Indicator (online/offline dot)

```tsx
<div className="flex items-center gap-1.5">
  <div className={`size-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-red-400"}`} />
  <span className="text-xs font-medium text-gray-500">{online ? "Online" : "Offline"}</span>
</div>
```

---

## Search Input

```tsx
<div className="relative w-full md:w-64 shrink-0">
  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
  <Input
    placeholder="Search…"
    className="pl-9 pr-10 bg-white border-gray-200 shadow-sm
               focus-visible:ring-gray-200 rounded-lg h-9"
  />
  {value && (
    <button onClick={clear}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
      <CancelIcon className="size-4" />
    </button>
  )}
</div>
```

**Rules:**
- Icon left, clear button right
- `h-9` — slightly shorter than default input (more compact in headers)
- `focus-visible:ring-gray-200` — don't use the default blue ring in gray UI
- Clear button only when `value` is truthy

---

## Loading States

**Never use a full spinner for page loads.** Always skeleton:

```tsx
// Skeleton pattern
<div className="animate-pulse">
  <div className="h-3 w-32 bg-gray-100 rounded mb-2" />
  <div className="h-3 w-24 bg-gray-100 rounded" />
</div>

// Avatar skeleton
<div className="size-8 rounded-full bg-gray-100 animate-pulse" />

// Card skeleton
<div className="border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden divide-y">
  {[1,2,3].map(i => (
    <div key={i} className="p-5 flex flex-col gap-3 animate-pulse">
      <div className="h-3 w-16 bg-gray-100 rounded" />
      <div className="h-3 w-3/4 bg-gray-100 rounded" />
      <div className="h-3 w-1/2 bg-gray-100 rounded" />
    </div>
  ))}
</div>
```

**Inline button loading:**
```tsx
<button disabled={loading} className="opacity-60 cursor-not-allowed">
  {loading ? <Loading03Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
  {loading ? "Saving…" : "Save"}
</button>
```

---

## Empty States

```tsx
// Simple empty
<div className="text-center py-16 text-sm text-gray-400">
  No activity yet. Start a chat to see events here.
</div>

// Rich empty (for main views)
<div className="flex flex-col items-center justify-center py-16 gap-3">
  <div className="size-12 rounded-full bg-gray-100 flex items-center justify-center">
    <Icon className="size-6 text-gray-400" />
  </div>
  <p className="text-sm font-medium text-gray-600">Nothing here yet</p>
  <p className="text-xs text-gray-400 text-center max-w-xs">
    Brief explanation of what this section does and how to get started.
  </p>
  <Button variant="outline" size="sm">Get started</Button>
</div>
```

---

## FAB (Floating Action Button)

```tsx
<button className="fixed bottom-8 right-8 z-40
                   flex items-center justify-center size-14
                   bg-blue-600 text-white rounded-full
                   shadow-lg hover:shadow-xl hover:bg-blue-700
                   transition-all hover:scale-105"
        aria-label="Ask AI">
  <SparklesIcon className="size-6" />
</button>
```

**Rules:**
- `bottom-8 right-8` — consistent position
- `size-14` — large enough to tap on mobile
- `hover:scale-105` — subtle grow, not bounce
- Always `aria-label` — no visible text

---

## Icons

**Always use one icon library.** LocalMind uses `hugeicons-react`.

```tsx
<Icon
  className="size-4"      // or size-5, size-6
  strokeWidth={1.5}       // always 1.5 — thinner than default 2
  aria-hidden             // always, unless icon is the only UI element
/>
```

**Rules:**
- `size-4` (16px) for inline/nav icons
- `size-5` (20px) for button icons
- `size-6` (24px) for feature icons in empty states / hero areas
- `strokeWidth={1.5}` everywhere — default 2 is too heavy
- `aria-hidden` unless there's no text label alongside it

---

## Animations

```css
/* Page entry — always use this on page components */
.animate-fade-in {
  animation: fade-in 0.2s ease-out forwards;
}

/* For modals, drawers, popovers */
.animate-slide-up-fade {
  animation: slide-up-fade 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

/* For list items staggered */
.stagger-1 { animation-delay: 0ms; }
.stagger-2 { animation-delay: 80ms; }
.stagger-3 { animation-delay: 160ms; }
```

**Transition defaults:**
```
transition-colors        — hover color changes
transition-all duration-200  — layout changes (sidebar open/close)
transition-all duration-300  — modals, popovers
```

**Never animate:** width/height changes in flex layouts (use `overflow-hidden` + `w-0`/`w-64` instead).

---

## Glassmorphism (use sparingly)

```css
.glass {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(12px) saturate(1.5);
  -webkit-backdrop-filter: blur(12px) saturate(1.5);
}
```

Only for: modals over blurred background, floating overlays. Never for normal cards.

---

## Shadows

```
shadow-sm         — cards, inputs (default)
shadow-lg         — modals, FABs, dropdowns
shadow-xl         — FAB hover, popovers
shadow-minimal    — 0px 0px 42px -9px rgba(0,0,0,0.1) — glow on hover
```

**Never:** box-shadow on nav items or inline elements.

---

## Form Fields

```tsx
// Consistent field layout
<div className="flex flex-col gap-1.5">
  <label className="text-xs font-medium text-gray-500">Field Label</label>
  <div className="relative">
    <Icon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
    <Input
      className="pl-9 bg-white border-gray-200 focus-visible:ring-1
                 focus-visible:ring-gray-300 focus-visible:border-gray-300 rounded-lg"
    />
  </div>
</div>

// Read-only display field
<div className="text-sm font-medium text-gray-900 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
  value
</div>
```

---

## Responsiveness

```
Mobile first: base classes → md: for desktop
Sidebar: hidden mobile (translate-x-full), visible desktop (md:translate-x-0)
Padding: p-4 md:p-5 (extra breathing room on desktop)
Grid: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
Max width: max-w-5xl for dashboard content, max-w-lg for forms
```

**Key viewport unit:** `h-dvh` not `h-screen` — handles iOS Safari toolbar correctly.

---

## Scrollbars

```css
/* Hide scrollbar but keep scroll */
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

/* Styled scrollbar (6px, barely visible) */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.2);
  border-radius: 3px;
}
```

Use `no-scrollbar` on: tab bars, horizontal scroll areas.
Use styled scrollbar on: main content areas, sidebars.

---

## What NOT to Do

- No gradients on backgrounds. Gradients are for hero sections on landing pages.
- No `rounded-full` on cards or large containers. Only pills, avatars, dots, FABs.
- No multiple font sizes on the same hierarchy level.
- No colored backgrounds for whole sections (e.g. blue sidebar). Sidebar is white/background.
- No `text-white` text on light backgrounds.
- No hover `box-shadow` animations — they're jarring. Change border/bg color instead.
- No full-page spinners. Skeleton or progressive load.
- No `alert()`, `confirm()`, or browser dialogs. Use toast (`sonner`) or inline error.
- No `overflow: hidden` on body — kills sticky positioning and modals.
- No hardcoded pixel widths on flex children. Use `min-w-0` for truncation instead.
- No `word-break: break-all`. Use `truncate` or `line-clamp-{n}`.
- Don't put `transition-all` on every element — it catches layout/paint properties and causes jank.

---

## Stack This System Runs On

| Concern | Tool |
|---|---|
| Framework | Next.js App Router (RSC + client islands) |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix primitives) |
| Icons | hugeicons-react (strokeWidth 1.5) |
| Animations | tw-animate-css + custom keyframes in globals.css |
| State | Zustand (global) + React hooks (local) |
| Toasts | sonner |
| Drag-drop | @hello-pangea/dnd |
| Markdown | react-markdown + remark-gfm |
| Forms | React Hook Form + Zod |
