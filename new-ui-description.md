# NeedBoard — Design System Reference for UI Changes

Use this as the design system reference whenever making UI/styling changes to NeedBoard. Match these exact tokens, patterns, and conventions so new components/pages feel native to the existing app.

**Do not touch `AmbientCanvas.tsx` or the background particle/node animation system — it is finalized and should be left exactly as-is.** Only reference it here so new UI sits correctly on top of it.

---

## Overall Aesthetic

Ultra-dark **"terminal / data-ops / observability" console** aesthetic — like a live instrumentation dashboard where human frustration becomes measurable signal. Deep navy-black base, glowing amber/teal/coral accent system, heavy monospace micro-typography, italic serif display headings, glassmorphic cards, blurred glow orbs.

Layout convention: centered column (`max-w-7xl` / `max-w-6xl` / `max-w-5xl` / `max-w-4xl` depending on page), generous vertical rhythm (`py-16`, `space-y-10/12/16/24`).

Motion: Framer Motion throughout — staggered fade/slide-in (`initial={{ opacity: 0, y: 15 }}`), spring physics (`stiffness: 220–450, damping: 25–30`), `AnimatePresence mode="wait"`, subtle hover nudges (`group-hover:translate-x-1`).

---

## Color Tokens (Tailwind v4 `@theme`, in `src/app/globals.css`)

| Token | Hex | Role |
|---|---|---|
| `brand-amber` | `#f59e0b` | Primary accent — CTAs, badges, "signal" labels, upvotes |
| `brand-coral` | `#ef4444` | Secondary CTA gradient partner, destructive actions |
| `brand-teal` | `#14b8a6` | Success/verified, search identity, builder theme |
| `slate-950` | `#020617` | Base background |
| `slate-900` | `#0f172a` | Card surfaces |
| `slate-100` | `#f1f5f9` | Primary text |
| `slate-400/500` | — | Secondary/muted text |
| `red-500`/`rose-500/600` | — | Errors, downvotes, admin |
| `blue-500/400` | — | Admin stats icons only |

**Gradients (reuse exactly):**
- **Amber → Coral** (`from-brand-amber to-brand-coral`): the primary-action gradient. Text on top is `text-slate-950`.
- **Teal → Amber** (`from-teal-500 to-amber-500`): secondary confirm actions (new-item creation, review/form submit).
- **Tri-color wordmark gradient** (`from-brand-amber via-brand-coral to-brand-teal`, 135°): logo and `text-gradient` utility class only.
- Hero titles: silver metallic (`from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent`) or warm (`from-amber-400 via-coral-400 to-teal-400`) depending on page tone.

**Selection highlight:** `selection:bg-amber-500/30` default; override to teal on teal-themed pages.

---

## Typography

Three-font system, never mix roles:

| Font | Variable | Usage |
|---|---|---|
| **Geist Sans** | `--font-geist-sans` | Body copy, inputs, card text |
| **Geist Mono** | `--font-geist-mono` | ALL micro-labels, badges, nav, counters, buttons |
| **Playfair Display** (italic bold) | `--font-playfair` | Display headings only |

- **Display headings:** Playfair Display, bold + italic, `tracking-tight`, `text-3xl → text-6xl`, color `text-slate-100`.
- **Micro-labels (signature move):** Geist Mono, `text-[8px]–text-[10px]`, uppercase, `tracking-widest`/`tracking-[0.2em]`/`tracking-[0.3em]`, colored per section (amber/teal/red). Used as section eyebrows, e.g. `00 // SECTION NAME`.
- **Body:** Geist Sans, `text-xs`–`text-lg`, `text-slate-400` secondary / `text-slate-200-300` primary, `leading-relaxed`.
- **Quoted data objects:** core content (problems/complaints/etc.) is always rendered italic, wrapped in typographic quotes `"…"`, `font-semibold`/`font-medium`.

---

## Background System (reference only — do not modify)

The `AmbientCanvas.tsx` fixed full-viewport canvas provides the radial navy gradient (`#0c142b → #050814`) and animated amber/coral/teal/pink/blue "signal node" constellation. All new pages/components should sit on top of this unmodified — use transparent or low-opacity surfaces (`bg-slate-900/20-60`) rather than opaque backgrounds so the canvas remains visible.

New pages should still include the standard **decorative glow orbs** where appropriate: absolute-positioned `rounded-full blur-3xl` divs at ~5% opacity (e.g. `bg-amber-500/5` 400×400px, `bg-teal-500/5` 500×500px) — match placement style already used on Home/Dashboard.

---

## Card & Surface Patterns

- Standard card: `bg-slate-900/20–60 border border-white/5 rounded-xl/2xl shadow-lg/xl`; hover darkens/brightens surface and border (`bg-slate-900/60→75`, `border-white/10`).
- Hairline dividers: `border-t/b border-white/5` only — never heavy dividers.
- Numbered/labeled section cards use a small mono eyebrow header with a colored icon chip (`p-2 bg-{color}-500/10 rounded-xl`), matching whichever accent color the section belongs to (amber/teal/red/blue).
- Locked/gated content: frosted overlay `bg-slate-950/70 backdrop-blur-md` with a pulsing icon circle and mono bold headline + microcopy + single CTA.

---

## Button Inventory (reuse these exact archetypes — do not invent new button styles)

| Type | Style essence | Use for |
|---|---|---|
| **Primary gradient** | `h-10-12 px-5-8 rounded-xl font-mono text-[10px-xs] uppercase tracking-wider font-bold text-slate-950 bg-gradient-to-r from-brand-amber to-brand-coral hover:opacity-90/95`, optional amber glow shadow | Hero CTA, submit, confirm, primary actions |
| **Teal→amber gradient** | same shape, `from-teal-500 to-amber-500` | Secondary create/publish/submit actions |
| **Solid teal** | `bg-teal-500 hover:bg-teal-600 text-slate-950 rounded-xl` | Add/save actions in teal-themed contexts |
| **Solid amber** | `bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg` | Standalone primary actions outside gradient contexts |
| **Ghost** | `bg-white/5 hover:bg-white/10 border border-white/5 text-slate-200/300 rounded-xl` | Secondary/cancel-adjacent actions, back links |
| **Text-only ghost** | mono uppercase `text-slate-400 hover:text-slate-100` | Cancel buttons, "Inspect ›" style links |
| **Icon chips** | `p-1.5 rounded-lg bg-white/5 border-white/5`, colored hover state | Edit/delete/external-link/close icons |

All buttons: `cursor-pointer`, most get `active:scale-95`. Disabled state: `disabled:opacity-50 disabled:pointer-events-none` (amber CTAs use `disabled:opacity-30`).

---

## Input Inventory

- **Text/URL inputs:** `bg-slate-950 border border-white/10 rounded-xl px-3-4 py-2-2.5 text-xs-sm text-slate-200/300 focus:outline-none focus:border-amber-500/50` (swap to teal focus border on teal-themed sections/dashboards).
- **Textareas:** same base + `resize-none`, fixed height (`h-16`–`h-20`).
- **Selects:** same base styling, `cursor-pointer`, `bg-slate-950` options.
- Labels above all inputs: mono, `text-[9px]` uppercase.

---

## Header Pattern (for reference when adding nav items)

`sticky top-0 z-40`, `border-b border-white/5`, `bg-slate-950/80 backdrop-blur-md`. Nav items in Geist Mono `text-xs tracking-widest uppercase text-slate-400`; active item gets `text-slate-100` + 3px colored bottom border, color-coded per section (amber/coral/teal/red depending on which area of the app).

---

## Summary — the identity in one paragraph

Dark observatory/radar-console aesthetic on a navy-black canvas alive with drifting amber/teal/pink/blue constellation nodes (unchanged). Three-part type system: Geist Sans for reading, Geist Mono for every instrument label (always tiny, uppercase, letter-spaced), Playfair italic for editorial headlines. Amber = demand/signal (hero color), teal = solution/verification, coral/red = urgency/errors/admin — all woven through strict `border-white/5` glass cards with blurred glow orbs. Interaction language: spring physics, scale-on-press, hover-nudge arrows, hover-revealed "Inspect" affordances, pulse loaders.

When building new UI, pick the accent color that matches the semantic role of the feature (amber = primary/demand-side, teal = solution/verification-side, coral/red = destructive/urgent/admin) and reuse the existing button, card, and input archetypes above rather than introducing new patterns.