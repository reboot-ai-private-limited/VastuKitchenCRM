# Mobile design system (Vastu Kitchen, React Native / Expo)

Status: design doc, 2026-11-12. Audience: mobile team and coding agents building screens.
Scope: tokens, type, layout rules, shared component catalogue. Screens are specified elsewhere.

Source key (cited per value):
- `CSS` = `apps/web/app/globals.css` (the only place web tokens live; no tailwind config file exists, Tailwind v4 `@theme inline`).
- `DS` = `docs/05-design/design-system.md`. `FND` = `docs/mobile/research/inventory-foundations.md`. `UX` = `research-ux-patterns.md`. `OPI` = `research-offline-performance-i18n.md`. `STK` = `research-stack-and-distribution.md`.
- `web/<path>` = a file under `apps/web/components/`.
- PROPOSED = a mobile decision that is not read from web code. GAP = web has no value; stated, not invented.

Decisions in force: one role-based app; `StyleSheet` + shared tokens, no NativeWind (STK section 1 item 5); WhatsApp-style chat (UX 1.1); light theme ships first, tokens shaped for dark (PROPOSED, section 1.6).

---

## 1. Tokens

### 1.1 Colours, light (CSS `:root`; hex copied verbatim)

| Token | Hex | Use on mobile |
|---|---|---|
| background / card / popover | `#ffffff` | screen, card, sheet surfaces |
| foreground / card-foreground | `#0f1c1a` | body text |
| primary | `#0e8f78` | primary button, links, active tab, focus indicator |
| primary-hover | `#0b7563` | pressed state (RN has no hover) |
| primary-soft | `#e4f5f0` | selected row, active segment, avatar fallback bg (DS 6) |
| primary-foreground | `#ffffff` | text on primary |
| secondary / muted | `#f0f5f4` | subtle fills, skeleton, file type tile |
| muted-foreground | `#566865` | secondary text (CSS comment: chosen so body text passes AA) |
| accent / accent-foreground | `#e4f5f0` / `#0b7563` | same as primary-soft / primary-hover |
| destructive | `#c0392b` | destructive buttons, invalid border |
| border | `#dce6e3` | dividers, card border |
| input | `#cbd8d4` | input border |
| ring | `#0e8f78` | focus (RN: use `accessibilityState` plus keyboard-focus outline on hardware keyboards) |
| sidebar, sidebar-* | `#f5faf8`, `#dcf1ea`, ... | web only; not ported (tab bar uses background) |
| placeholder / disabled text | `#9a8b7e` | DS 1: allowed only for placeholder and disabled (fails AA as body text) |

Semantic tones (CSS `:root`; badge = soft bg + same-hue fg, never colour alone):

| Tone | fg | soft bg |
|---|---|---|
| info | `#1d5fa8` | `#e8f1fb` |
| success | `#1e7a46` | `#e7f5ec` |
| warning | `#9a6200` | `#fdf3dc` |
| danger | `#b3261e` | `#fbe9e7` |
| neutral | `#4a5b58` | `#edf2f1` |
| violet | `#5b3fa6` | `#efeafb` |
| orange | `#a24a10` | `#fcebdd` |
| accent (chip tone) | `#0b7563` | `#e4f5f0` (`web/common/status-badge.tsx`: `bg-primary-soft text-primary-hover`) |

Note: destructive is `#c0392b` while danger is `#b3261e`. Both exist on the web; keep both (buttons use destructive, chips/inline errors use danger). GAP: no `--heading` token in CSS although DS lists `#000000` as optional; do not port.
Alpha tints used by components (Tailwind `/10`, `/20`, `/30`, `/40` on a token) become `rgba(token, a)`; tokens.ts exposes `alpha(hex, a)`.
Chart palette (DS 1, no CSS var): `#0E8F78 #2A78D6 #E0A02B #D4694A #9A8B7E`; mobile MVP has no charts.

### 1.2 Radii (CSS `--radius: 0.625rem` = 10; derived tokens)

`sm 6` (0.6x), `md 8` (0.8x), `lg 10`, `xl 14` (1.4x), `2xl 18`, `3xl 22`, `4xl 26`, `full 9999`. Usage read from web: Button and Input `rounded-lg` = 10 (`web/ui/button.tsx`, `input.tsx`); Card `rounded-xl` = 14 (`web/ui/card.tsx`); chip `rounded-full` (`status-badge.tsx`); avatar full; project card `rounded-xl`; bottom sheet top corners 14 (DS 3: sheets `xl`). 1 CSS px = 1 dp.

### 1.3 Shadows (CSS `--shadow-card`, `--shadow-card-hover`)

| Token | CSS | RN translation (PROPOSED, FND 4.4) |
|---|---|---|
| card | `0 1px 2px rgb(15 40 35 / .05), 0 6px 16px -6px rgb(15 40 35 / .10)` | iOS `shadowColor #0f2823, offset (0,6), radius 16, opacity .10`; Android `elevation: 2`; keep 1 px `border` (Android elevation is faint on white) |
| card-hover | `0 2px 4px rgb(15 40 35 / .06), 0 12px 28px -8px rgb(14 143 120 / .22)` | not ported (no hover); pressed card = background `#f0f5f4` at 50% instead |
| popover/sheet | DS 3: `shadow-lg`/`shadow-xl` (no CSS var) | GAP; use Android `elevation: 8`, iOS offset (0,-4) radius 16 opacity .12 (PROPOSED) |

### 1.4 Type scale (web px to RN sp)

Web base: `body text-sm` 14 px, line-height 1.5; `h1,h2,h3` letter-spacing -0.015em (CSS `@layer base`). Sizes below are from DS 2 and web classes; the mobile column is PROPOSED: body rises to 15 sp for touch/outdoor reading (UX 1.1 item 6 wants layouts to survive 130-200%; UX 2.5 suggests 16 sp body).

| Role | Web | RN sp / weight / lineHeight (PROPOSED) |
|---|---|---|
| title (page) | `text-xl` 20 / 600, tracking -0.015em | 22 / 600 / 30, letterSpacing -0.3 |
| section title, card title | 14 / 600 (DS 2); Card title `text-base` 16 / 500 | 16 / 600 / 24 |
| body | 14 / 400 / 1.5 | 15 / 400 / 22 |
| input text | `text-base` 16 on mobile web, `md:text-sm` (`web/ui/input.tsx`) | 16 / 400 |
| label, button | 14 / 500 | 15 / 500 |
| meta, chip, caption | `text-xs` 12 / 500 chip, 400 caption | 12 / 500 / 18 (never below 12) |
| table header (kept for stat labels) | 12 / 600 muted | 12 / 600 |
| counter | `text-2xl` 24 / 600 tabular | 26 / 600 |
| tab label | 11 (FND 2: label 11 px) | 11 / 500, max `maxFontSizeMultiplier 1.3` |
| display (proposal only) | Playfair Display 28-40 / 600 | not needed unless proposals render natively |

Indic text: never set `lineHeight` below 1.5 x size (OPI 6.4); the 22/15 and 24/16 pairs above satisfy this.

### 1.5 Spacing (4 px grid; CSS/DS 3)

`space = {0:0, 1:4, 2:8, 3:12, 4:16, 5:20, 6:24, 8:32, 10:40, 12:48}`. Web uses: page padding 16 (`p-4`), block gap 20 (`space-y-5`), card padding 16 (`--card-spacing` 4 units; `size="sm"` 12), form field gap 16, row `py-4`/`py-3`. Mobile adds nothing new except layout rules in section 3.
Sizes: `hit = 48` (min target), `iconSm 16`, `icon 20`, `iconLg 24`, `iconStroke 1.75` (DS 6, FND 4.4), `avatar {sm 24, md 32, lg 40}` (`web/ui/avatar.tsx`), mobile list avatar 36 (feed rows use `size-9`).
Control heights: web is compact (Button default `h-8` = 32, sm 28, lg 36, Input `h-8`, Badge `h-5`; `web/ui/button.tsx`), DS says default 40 / lg 44 for mobile primary actions. Mobile: `control {sm 36, md 44, lg 52}` all with 48 dp hit area via `hitSlop` (PROPOSED, UX 1.1 item 6, OPI 7.1).

### 1.6 Proposed `tokens.ts` shape

Location: `packages/design-tokens/src/tokens.ts` (new workspace package; FND 4.5 item 1), consumed by mobile directly and by a script that emits a CSS fragment for the web.

```ts
export const colors = {
  light: { background:'#ffffff', foreground:'#0f1c1a', card:'#ffffff', primary:'#0e8f78',
    primaryHover:'#0b7563', primarySoft:'#e4f5f0', primaryForeground:'#ffffff',
    muted:'#f0f5f4', mutedForeground:'#566865', border:'#dce6e3', input:'#cbd8d4',
    destructive:'#c0392b', placeholder:'#9a8b7e' /* ...every CSS :root var */ },
  dark: undefined, // PROPOSED: same keys, filled in phase 2 (see below)
} as const;
export type Tone = 'info'|'success'|'warning'|'danger'|'neutral'|'violet'|'orange'|'accent';
export const tone: Record<Tone,{fg:string;bg:string}> = { /* section 1.1 */ };
export const radius = { sm:6, md:8, lg:10, xl:14, '2xl':18, '3xl':22, '4xl':26, full:9999 } as const;
export const space = { 1:4, 2:8, 3:12, 4:16, 5:20, 6:24, 8:32 } as const;
export const type = { body:{size:15,line:22,weight:'400'}, /* roles of 1.4 */ } as const;
export const shadow = { card:{ shadowColor:'#0f2823', shadowOffset:{width:0,height:6},
  shadowOpacity:0.1, shadowRadius:16, elevation:2 } } as const;
export const hit = 48;
```
Components read tokens through `useTheme()` returning `colors[scheme]`. Never hardcode hex in components (same rule as DS preamble); lint rule `no-restricted-syntax` for `#[0-9a-f]{6}` outside the tokens package.

Dark mode (PROPOSED, not built): the web ships light only (`CSS` header comment: "dark mode is phase 2"; no `.dark` block). DS 1 proposes dark values (background `#171310`, card `#211C18`, foreground `#F2ECE4`, border `#352E28`, primary `#2BB59B`, primary-soft `#12352F`) but they are warm-brown and clash with the cool-teal light theme (FND 4). Decision: ship light only; `ThemeProvider` forces `light` regardless of system scheme; the `colors.dark` slot is typed so adding it is one file. Before enabling, every tone pair needs a dark pair and the contrast tests of section 5.4 re-run.

### 1.7 Web and mobile must stay in step (drift test idea)

Single source of truth is `globals.css` today. Rules:
1. Any change to a colour, radius, shadow, tone mapping or status-to-tone table lands in BOTH `globals.css` and `tokens.ts` in the same PR.
2. Drift test (Vitest, runs in the web workspace CI): read `globals.css` as text, parse `:root { --name: value; }` into a map (hex lower-cased), map kebab names to camelCase keys of `colors.light`, and assert deep equality both ways; also parse `--radius` (rem x 16) and the shadow strings against `tokens`. Fail on any missing or extra key. Do not parse CSS at runtime in the app (FND 4.5).
3. Status mapping test: import the tone tables from `status-badge.tsx` (export them) and `design-stage-chip.tsx` and compare with the tokens package's `statusTone` map; chips are the most visible place for drift.
4. Preferred end state (PROPOSED): generate the `:root` block of `globals.css` from `tokens.ts` so drift is impossible; the test remains as a guard.

---

## 2. Typography, fonts, numbers

### 2.1 Font

Web UI font is Plus Jakarta Sans (`apps/web/app/layout.tsx`, `next/font/google`, variable `--font-jakarta`), stack `var(--font-jakarta), "Noto Sans Bengali", ui-sans-serif, system-ui` (CSS `--font-sans`); Playfair Display only for proposals (`apps/web/lib/fonts.ts`). It is NOT Inter. Mobile follows the web brand:
- Load with `@expo-google-fonts/plus-jakarta-sans` via `expo-font`/config plugin: weights 400, 500, 600, 700 as separate families (`PlusJakartaSans_400Regular` ...). RN on Android cannot use a variable font weight axis (FND 4.3). The web requests the variable font with no explicit weight list, so which weights are actually used beyond 400/500/600 is UNVERIFIED; 700 is reserved for counters if needed.
- Embed the fonts at build time (config plugin) so there is no flash; keep a splash screen until `useFonts` resolves with a 3 s cap, after which fall back to the system font.
- Playfair Display: do not bundle until a native proposal renderer is decided (FND 4.3).
- Fallback: RN cannot declare a per-script stack in one `fontFamily` (OPI 6.4, UNVERIFIED); Android falls back per glyph to system Noto. Devanagari and Bengali text therefore renders in system Noto automatically; bundle Noto Sans Bengali / Devanagari only if a device test (Android 10 plus a Xiaomi or Realme phone) shows tofu or clipped conjuncts (OPI 1.5, 6.4). The web already names "Noto Sans Bengali" so Bengali is the language to test first.
- Because the Latin brand font and the system Indic font differ in x-height, set `includeFontPadding: false` on Android only for Latin-only labels (chips, tab labels); keep it on for any text that may be Indic (PROPOSED).

### 2.2 Numbers and currency

Source of truth `apps/web/lib/format.ts`; move it to a shared package so both apps import one file (FND 4.5 item 4, a gap).
- Money is whole rupees (no paise on the wire in this API; FND 3.5. OPI 1.5 says paise: the code wins). `formatINR(1250000)` = `₹12,50,000` (en-IN grouping, 0 decimals, `Math.round`).
- Short form for tight space (`formatINRShort`): `>= 1 Cr` -> `₹1.5 Cr`, `>= 1 L` -> `₹90 L`, else full amount; one decimal, trailing zero trimmed; negatives prefixed `-`. Use short form on cards and counters, full form in detail and totals, and put the full amount in `accessibilityLabel` ("90 lakh rupees" is not required; the full digits suffice).
- Hermes `Intl.NumberFormat('en-IN')` correctness on Android is UNVERIFIED (OPI 6.3, FND 3.5). Add a pure-TS fallback grouper (3 then 2s) in the shared `format.ts` and a unit test comparing both on a table of values; ship the hand-written one if the device test fails.
- Always Western digits 0-9 for money and phone numbers, even in Hindi or Bengali UI (OPI 6.3; use `-u-nu-latn`).
- Tabular numbers: `fontVariant: ['tabular-nums']` on every Text showing money, counts, phones, times (web `.tabular` class in CSS). Plus Jakarta Sans tabular support in the Google build is UNVERIFIED; test, and if absent keep right alignment in fixed-width columns.
- Dates: `12 Nov 2026` (`en-GB`, short month), time `3:40 PM` (`en-US` 12 h, upper-case meridiem), always `Asia/Kolkata`, never the phone zone; "today" via `businessDate()` (FND 3.4). Relative: "5 min ago", "3 h ago", "2 days ago", date after 14 days. Phone display `+91 98765 43210`, stored 10 digits (FND 3.6).

---

## 3. Layout rules for phones

### 3.1 Frame
- Safe areas: wrap the app in `SafeAreaProvider`; headers pad `insets.top`, bottom tabs and composers pad `insets.bottom`; never hardcode status-bar heights. Edge-to-edge on Android 15+ (draw behind system bars, content inside insets).
- Gutters: 16 dp left and right on every screen (web `p-4`). Full-bleed items (photo grids, dividers) may touch the edge; text never does. Tablet/landscape: centred column max 640 dp (PROPOSED; web caps forms at 720 px, DS 3).
- Vertical rhythm: 20 between blocks, 16 inside cards, 12 between list rows' contents.
- Targets: 48 x 48 dp minimum, 8 dp between adjacent targets (UX 1.1 item 6; OPI 7.1). Smaller visuals (16-20 px icons, 20 px chips) get `hitSlop` to reach 48. Base `Pressable` helper enforces `minHeight 48, minWidth 48`.
- Thumb zones: primary action and composer in the bottom third; headers carry only navigation, search, overflow (UX 2.5). Never put a destructive action next to the primary one (UX anti-pattern 13); order is Cancel left, Primary right; destructive lives in an overflow menu or a separate row.
- Keyboard: `react-native-keyboard-controller` (STK 1 item 4); composer and sticky save bars ride above the keyboard; `keyboardShouldPersistTaps="handled"` on forms.
- Lists: `FlatList` (chat inverted) or FlashList; memoised rows, stable keys, fixed image aspect boxes (OPI 3.3).
- Large text: layouts wrap, never clip, at 130-200% font scale; two-column tiles fall back to one column when `PixelRatio.getFontScale() > 1.3` (UX 2.5).

### 3.2 Bottom sheet vs dialog (PROPOSED; UX 2.5, web uses `ui/sheet.tsx`, `ui/dialog.tsx`, `ui/alert-dialog.tsx`)
| Use | Pattern |
|---|---|
| Choose one of N, pick status, assign person, attach menu, outcome log, edit forms that continue context | BottomSheet (drag handle, swipe to dismiss, max 90% height, scrollable body, sticky action row) |
| Confirm blocking or irreversible action, discard unsent draft | Centred AlertDialog, max 2 buttons, stacked on large text |
| Long multi-field create (new project, raise complaint) | Full-screen modal route with sticky footer, not a sheet |
| Transient result | Toast |

Android back button and edge swipe dismiss sheets and dialogs; focus moves to the sheet title and returns to the trigger.

### 3.3 Destructive confirmation (web: `alert-dialog` naming the object, DS 5)
1. Name the object and the verb in the title: "Delete 3 photos?", "Delete this post?".
2. Body says what is lost and whether it can be undone.
3. Buttons: Cancel (outline) and the verb ("Delete", destructive style, never "OK"/"Yes").
4. Reversible deletes (own comment, file removal) prefer immediate action with an Undo toast of 5 s; irreversible or customer-visible ones use the dialog (UX 2.5).
5. While the request runs the destructive button shows a spinner and is disabled; failure keeps the dialog open with an inline error.

### 3.4 State patterns (every list or screen defines all five; DS 5)
| State | Pattern |
|---|---|
| Loading | `Skeleton` rows matching the final layout, no full-screen spinner; if cached data exists show it with a thin top progress line (UX anti-pattern 14) |
| Empty | `EmptyState`: 20 px icon, one sentence, one primary action |
| Error | `ErrorState` inline with Retry; copy from `ApiError`: status 0 "Connection lost. Check your internet and try again." (`web/common/error-state.tsx`); never a blank screen; show request id in a "Details" disclosure for support (FND 3.1) |
| Forbidden / not found | calm message; unauthorised = "not found" (DS 5) |
| Offline / slow | persistent `OfflineBanner` (not a modal), queued items carry `SyncChip`; pull-to-refresh disabled when offline with a hint |
Pull-to-refresh on every list. Optimistic updates only for lead status move, to-do check/uncheck, notification read; roll back with a toast (FND 3.2). 409 on actions: toast "Someone else just updated this" then refetch.

---

## 4. Component catalogue

Conventions: file `apps/mobile/src/ui/<Name>.tsx`; every component takes `testID`, uses tokens only, exposes accessibility props (section 5.4), and has a Storybook-style `__demo__` entry. Web counterparts are under `apps/web/components/`.

### 4.1 Primitives

**Button** (web: `ui/button.tsx`). Props: `title`, `variant: 'default'|'outline'|'secondary'|'ghost'|'destructive'|'link'`, `size: 'sm'|'md'|'lg'`, `icon?`, `iconPosition`, `loading`, `disabled`, `onPress`, `fullWidth`. Variants mirror web: default = bg primary, fg white; outline = border `border`, bg background; secondary = bg `secondary`; ghost = transparent; destructive = bg `destructive` at 10% alpha with destructive text (web style `bg-destructive/10 text-destructive`); link = primary text. States: pressed (default -> `primaryHover`, others -> `muted` bg, plus 1 px translateY like web `active:translate-y-px`), disabled (opacity .5), loading (spinner replaces icon, width fixed, disabled). One primary per screen (DS 4). Primary mobile actions use `lg`.

**IconButton** (web: Button `icon*` sizes). Props: `icon`, `label` (required, becomes `accessibilityLabel`), `variant`, `size`, `badge?`. Visual 24-36, hit area 48. States as Button. No tooltip; long-press shows the label as a toast on Android (optional).

**Input / FormField** (web: `ui/input.tsx`, `ui/label.tsx`, `ui/textarea.tsx`, DS 4 Forms). `FormField` props: `label`, `required`, `helper`, `error`, children. `Input` props: `value`, `onChangeText`, `keyboardType`, `prefix?` (e.g. "+91" shown not typed), `secure`, `multiline`, `maxLength`, `autoComplete`, `textContentType`. Visual: height 48, border 1 `input`, radius 10, text 16, placeholder `#9a8b7e`. States: focus (border `ring` + 3 dp translucent ring), disabled (bg `input` 50%, opacity .5), invalid (border `destructive`, ring destructive 20%, error text with a 14 px alert icon in `danger`, never colour alone). Label above, helper below. Errors map from API `data[].path` (FND 3.2); announce with `accessibilityLiveRegion="polite"` and focus the first invalid field. Phone: `phone-pad`, 10 digits.

**Select / ActionSheet** (web: `ui/select.tsx`, `dropdown-menu.tsx`). Props: `value`, `options[{value,label,icon?,description?}]`, `onChange`, `title`, `searchable?` (auto when > 8 options). Renders a field-looking trigger (chevron) that opens a BottomSheet list with a check on the selected row; rows 48 high. `ActionSheet` is the same sheet with action rows (icon, label, destructive tone) used for overflow menus and long-press menus.

**Chip / StatusBadge** (web: `common/status-badge.tsx`, `projects/design-stage-chip.tsx`). Props: `kind: 'lead'|'project'|'design'|'complaint'|'proposal'|'day'|'tone'`, `value`, or `tone` + `label`, `icon?`. Anatomy: pill, `px 8, py 2`, 12 sp / 500, `whiteSpace nowrap` (`numberOfLines={1}`), bg tone.bg, text tone.fg, optional 12 px leading icon; the label is always text. Exact mapping (port 1:1; label, tone):

| Kind | Value | Label | Tone | Source |
|---|---|---|---|---|
| lead | NEW | New | info | `status-badge.tsx` |
| lead | CONTACTED | Contacted | info (DS: outlined variant; code: filled) | code wins |
| lead | VISIT | Visit | violet | |
| lead | PROPOSAL_SENT | Proposal sent | warning | |
| lead | FOLLOW_UP | Follow-up | orange | |
| lead | WON | Won | success | |
| lead | LOST | Lost | danger | |
| project stage | DESIGN / SITE / CLOSED | Design / Site / Closed | violet / info / neutral | |
| design stage | NOT_STARTED / IN_DESIGN / SHARED / APPROVED | Not started / In design / Shared with client / Approved (`DESIGN_STAGE_LABEL`, `apps/web/lib/projects.ts`) | neutral / violet / warning / success | `design-stage-chip.tsx` (FND 4.2 said unmapped: wrong, it is mapped) |
| complaint | OPEN / ASSIGNED / RESOLVED / CLOSED | Open / Assigned / Resolved / Closed | danger / warning / success / neutral | |
| complaint extra | reopenCount > 0 | "Reopened ×N" | orange | `ReopenedChip` in `complaints-view.tsx` (DS 1 does not name a tone; code wins) |
| proposal | DRAFT / SENT / SEEN / NO ACTION | Draft / Sent / Seen / No action | neutral / info / accent / warning | DS 1; SEEN and NO ACTION are derived, API stores DRAFT/SENT only (FND 4.2); no web chip component exists for proposals (GAP: check `components/proposals/*` and export the map) |
| day (attendance) | PRESENT / ABSENT / OFF / FUTURE | Present / Absent / Off / none | success / danger / neutral / hidden | |
| lead flag | stuck | clock icon, warning | additive, not a status | DS 1 |
Empty label renders nothing (`FUTURE`). Chips are not pressable unless wrapped; a pressable chip (filter) gets 48 dp hit area and `accessibilityState.selected`.

**Avatar / AvatarGroup** (web: `ui/avatar.tsx`). Props: `name`, `uri?`, `size 24|32|36|40`, `badge?`. Fallback = initials (`initials()` from format.ts) on `muted` bg (web `AvatarFallback` uses `bg-muted text-muted-foreground`; DS 6 says `primary-soft`; code wins, GAP noted), 1 px `border` hairline. Group overlaps by -8 with 2 px background ring and a "+N" count.

**Card** (web: `ui/card.tsx`). Props: `children`, `onPress?`, `tone?: 'default'|'muted'|'warning'`, `padding 'md'|'sm'` (16 / 12). bg card, border 1, radius 14, shadow card. Pressable cards show pressed state (section 1.3) and have `accessibilityRole="button"`.

**ListRow**. Props: `leading` (avatar/icon/checkbox), `title`, `subtitle`, `meta`, `trailing` (chevron, chip, switch), `onPress`, `onLongPress`, `destructive`, `divider`. Min height 56, padding 16 x 12, bottom hairline `border`. Used in settings, people, folders, More sheet.

### 4.2 Navigation and chrome

**SegmentedTabs** (project top segments; web: `projects/workspace-nav.tsx`, which is a pill row on phones). Items for a project: Chat, To-do, Complaints, Docs (web ids `feed|todos|complaints|docs`; UX 1.4 also proposes Info) filtered by viewer role. Props: `items[{id,label,icon?,badge?}]`, `value`, `onChange`. Anatomy: horizontally scrollable row below the header, each pill `px 12, py 8`, radius 10, 14 sp / 500, icon 16; active = bg `primarySoft`, text `primary`; inactive = text `mutedForeground`. Height 48 incl. padding. `accessibilityRole="tablist"`, items `tab` with `selected`. Swipe between sections is optional; selection persists per project.

**BottomTabs** (web: `shell/bottom-tabs.tsx`; FND 2). Max 5 slots; if a role has more than 5, first 4 plus "More" opening an ActionSheet of the full nav. Slot min height 56, icon 20 (web) / 24 (mobile PROPOSED), label 11 sp always visible (never icon-only; UX Part 3), active = primary colour + medium weight, bg `background`, top hairline `border`, padding `insets.bottom`. Badge: 16 dp red (`danger`) dot or count, text "9+" cap. Per-role slots are defined in the navigation doc (UX 1.2); this component only renders `items`.

**Header**. Props: `title`, `subtitle?`, `onBack?`, `right?` (up to 2 IconButtons), `large?`. Height 56 + top inset, bg background, bottom hairline on scroll (web sticky header = bottom border, DS 3). Title 17 sp / 600 (single line, ellipsis). Back button 48 dp. Project header shows project name, customer, stage chip.

**SearchBar**. Props: `value`, `onChangeText`, `placeholder`, `onSubmit`, `autoFocus`, `loading`. Height 44, bg `muted`, radius 10, leading search icon 16, clear button, debounce 300 ms (PROPOSED). Collapsed into a header icon on screens that already show a title.

### 4.3 States and feedback

**EmptyState** (web: `common/empty-state.tsx`: icon 20 muted, title 500, description muted max-w-sm, action; `py-10`). Props: `icon`, `title`, `description?`, `action?`. Centre aligned, vertical padding 40.

**ErrorState** (web: `common/error-state.tsx`). Props: `error`, `onRetry`, `title='Couldn’t load this'`, `compact`. Row: 16 px alert icon in `danger`, title 500, message 12 muted, Retry outline button. `accessibilityRole="alert"`. Message by error: network = "Connection lost. Check your internet and try again."; `ApiError.message` otherwise; unknown = "Something went wrong. Please try again."

**Skeleton** (web: `ui/skeleton.tsx`: `animate-pulse rounded-md bg-muted`). Props: `width`, `height`, `radius`. bg `muted` (`#f0f5f4`), 1.2 s opacity pulse .5-1 (static when reduce motion is on). Provide composed skeletons per list row type (FeedRowSkeleton, ProjectCardSkeleton).

**Toast** (web: `ui/sonner.tsx`, bottom-right, 3 s, icons check/info/alert/error/spinner 16 px). Mobile: bottom, above the tab bar and keyboard, max 2 lines, swipe to dismiss, 3 s (5 s with an action such as Undo), tone icon + text (never colour only). API `toast.success|error|info(message, {action})`. Announced via `AccessibilityInfo.announceForAccessibility` (UNVERIFIED API availability, see OPI 7.2).

**OfflineBanner / SyncChip** (no web counterpart; OPI 2.10, UX 1.1 item 5). `OfflineBanner`: slim strip under the header, bg `warning-soft`, text `warning`, icon wifi-off, "You are offline. Changes will send when you reconnect." with "N waiting". Hidden when online; the reconnect moment shows "Back online, sending..." for 2 s. `SyncChip` per item: `pending` (clock icon, neutral, "Sending"), `failed` (alert, danger, "Not sent, tap to retry"), `sent` (check, success, quiet). WhatsApp-clock model (UX 1.1). Icon plus text always.

**BottomSheet** (web: `ui/sheet.tsx`). Props: `visible`, `onClose`, `title?`, `snapPoints?`, `children`, `footer?`. bg card, top radius 14, drag handle 36 x 4 `border` colour, backdrop black 40%, safe-area bottom padding, respects keyboard. Android back closes. `accessibilityViewIsModal`.

### 4.4 Photos and files

**PhotoGrid / PhotoViewer** (web: `projects/photos.tsx`). Grid: 1-4 images, 1 image = full width, max height 384 (web `max-h-96`), 2+ = 2 columns square (`aspect-square`), gap 4, radius 8 (`rounded-lg`), a fifth+ image collapses to "+N" overlay on the 4th (black 55%, 20 sp / 600 white). Items use the API's `thumbUrl` (`c_limit,w_480,f_auto,q_auto`); fixed aspect box from `width/height`, `muted` placeholder, `expo-image` with blurhash-less fade 150 ms. Label `Open photo i of n`. Viewer: full-screen pager with pinch-zoom, double-tap zoom, swipe down to close, counter, Save/Share actions, uses `url` at width bucket 1080 (section 5.3). "Save to Docs" action for staff (DS 4 `SaveToDocsButton`).

**PhotoPicker / Composer attachment tray** (web: `projects/photos.tsx` uploader lines ~140-190, `complaints/use-complaint-uploader.ts`). Tray above the composer: 64 dp thumbnails (web `size-16`), radius 8, border; per-item status overlay: uploading (opacity .5 + progress ring), done, failed (retry icon, `RotateCw` on web); remove button 20 dp visual with 48 hit area (black 60% circle, white X). Limits: 20 per post, 5 per comment (FND 3.7). Sources: camera, gallery (multi-select), files. Compress before upload (long edge 1600, q .7; OPI 3.4). Order preserved; drag-reorder optional.

**DocCard / FileViewer** (web: `docs/file-list.tsx` `FileCard`, `TypeTile`). `DocCard` props: `file`, `showFolder?`, `onOpen`, `onMenu`. Big preview (photo or PDF first page `previewUrl`), else `TypeTile`: `secondary` bg, 36 px file icon (FileText for pdf), extension in 12 sp / 600 uppercase. Under: name (1 line), size and date, "Team only" / "Shared" chip (staff only; customer never sees it). Docs grid 3 columns, 2 at large text (UX 1.4); list mode for PDFs. Menu actions: open, download (`downloadUrl`), share, rename, move, share with client, delete (destructive confirm). `FileViewer`: images via PhotoViewer, PDFs via in-app viewer or `expo-sharing`/system handler (decision in the native doc, UNVERIFIED).

### 4.5 Project workspace rows

**FeedRow** (Basecamp-style post row; web: `projects/post-card.tsx`, `projects/feed-rows.tsx`). The web renders a left time column (`RowTime`, 64 px wide, "Today"/"Yesterday"/date over time, hidden below `sm`), avatar 36, then content. Mobile (WhatsApp-style, UX 1.4): bubble layout rather than a time column. Props: `post`, `isOwn`, `visibility: 'TEAM'|'CLIENT'`, `onReply`, `onLongPress`, `status?: SyncState`. Anatomy: avatar for others only; name 14 / 600 + role chip if customer; text 15; PhotoGrid max width 75% of screen; footer time 12 muted + SyncChip + "Edited"; client-visible shows an eye icon, team-only a lock icon and `neutral-soft` tint that the customer app never renders (UX 1.4). Date separators centred ("Today"). Swipe right = reply with a visible overflow equivalent; long-press = ActionSheet. Comments thread below as nested compact rows. Own bubbles right-aligned with `primarySoft` bg (PROPOSED), others `muted`.

**ActivityRow** (web: `feed-rows.tsx` `ActivityRow`: muted 14 text, 6 px muted dot, same grid). Mobile: centred grey system line, 13 sp muted, optional tappable; never a bubble (UX 1.4). Props: `at`, `children`, `onPress?`.

**ComplaintCard** (web: `complaints/complaint-card.tsx`). Anchor card in the chat. Open state: bg `warning-soft` at 20%, border `warning` at 30%, radius 14, padding 12; header row "Complaint" 14 / 600 + StatusBadge + ReopenedChip + customer name ("raised by X"); description; PhotoGrid (max 448 wide); "Assigned to X / Not assigned yet · raised 12 Nov 2026"; then either actions + Reply (when no updates) or an "N updates" expander (chevron rotates). 36 dp round icon: LifeBuoy on `warning-soft`/`warning`. Closed folded state: icon becomes CheckCircle on `muted`; row shows "Complaint closed by NAME on DATE" with a one-line 110-char snippet and a chevron; tap expands in place into a `muted/40` panel with border titled "Complaint (closed)" and a collapse control. `accessibilityState.expanded`. Actions render only from the API `can{}` block (DS 4); 409 -> toast and refetch.

**ComplaintUpdateRow** (web: `complaints/complaint-update-row.tsx`). One event or comment placed in the chat at its time. Quoted header (jumps to the card): `muted` 40% bg, 4 dp left border `warning` at 60%, radius 6, 12 sp: LifeBuoy 14 px warning + bold "Complaint" + muted " · snippet(70)" one line; `accessibilityLabel="Go to the complaint: <snippet 60>"`. Body: comment = author 14 / 600 + "Customer" label if customer + text + PhotoGrid (max 320) + own-comment delete; event = title 500 + note; RESOLVED event gets a `success-soft` 50% panel with `success` 30% border and the resolution photos. The latest update of an open complaint also carries the allowed action buttons and a Reply box.

**TodoRow** (web: `components/todos/todo-bits.tsx`, `todos-tab.tsx`, `todo-drawer.tsx`; UX 1.4). Props: `todo`, `expanded`, `onToggleDone`, `onExpand`, `onEdit`. Collapsed: 48 dp checkbox target (visual 24), title, assignee AvatarGroup, due chip (overdue = danger, due today = warning, otherwise neutral; overdue decided by the business calendar, FND 3.4), comment count. Tap row expands in place (accordion) to show notes, assignee, due date, photos, comments; Edit opens a BottomSheet. `role=checkbox` with `checked`; header "3/8 done". Check/uncheck is optimistic with rollback toast.

**ProjectCard** (web: `projects/projects-view.tsx` `ProjectCard`). Props: `project`, `onPress`. Ongoing: bg card, border, radius 14, shadow card, padding 16; row 1: name (600, 1 line) + customer (12) left, stage StatusBadge right; row 2: DesignStageChip and, when `value != null` and not closed, `formatINRShort(value)` 14 / 600 tabular; row 3: "Designer name or No designer yet" . "opened 3 days ago" 12 muted. Closed: bg `muted` at 40%, text `mutedForeground`, no shadow, no value, whole card greyscale (`grayscale` on web; on RN dim with opacity .75 plus muted colours since there is no CSS filter; test on device), `accessibilityLabel` "<name> (closed)". Closed ones sit under a "Closed" 12 / 600 uppercase muted section heading, shown only when the user asks (web `showClosed`). Phone: single column.

**ComplaintTile** (web: `complaints/complaint-tile.tsx`). Photo-led tile for the Complaints tab: 2 columns on phones (1 column at font scale > 1.3). Content: first image (or LifeBuoy placeholder), problem snippet, StatusBadge (+ reopened chip), assignee, age (`relativeAge`), update count with MessageCircle icon, optional project name when the list spans projects (`showProject`). Done complaints (RESOLVED/CLOSED) are visually quieter. Hiding rule `isActiveForMe`: OPEN/ASSIGNED always shown, RESOLVED shown while `can.close || can.reopen`; the rest sit behind "Show resolved".

**ComposerBar** (web: `projects/feed.tsx` composer ~line 350-470). Bottom-docked, padding `insets.bottom`, top hairline. Row 1 (staff only): visibility chip, a labelled, coloured toggle: "Team only" (lock, `neutral` tone) vs "Client can see" (eye, `success` tone); web default is Team and resets after posting; customers always post to Client with no chip. Posting a photo from a team-only default to a customer re-confirms (UX 1.1 item 7, Part 3 item 7). Row 2: attach (+), camera, multiline input growing to 5 lines, send/mic toggle (send enabled only with text or a ready photo). Attachment tray sits above row 2. Reply quote bar above the tray. Draft persisted per project (UX 1.6). The web "final" toggle (`asFinal`, shows a success note) is a design-stage action and is specified in the project doc.

### 4.6 Not covered here
Lead card, stat card, kanban/board, attendance calendar, salary table: web components exist (`common/stat-card.tsx`, etc.); mobile versions are defined in the per-feature docs and compose the primitives above.

---

## 5. Motion, haptics, icons, imagery, accessibility

### 5.1 Motion and haptics
- Web motion: 150 ms hover/focus, 200 ms sheets, skeleton pulse; no page transitions (DS 7). Mobile: 150 ms for state changes, 200-250 ms sheets and expand-in-place (height with `LayoutAnimation` or Reanimated), native stack transitions for navigation (platform default; the "no page transitions" rule does not carry over).
- Budget for low-end Android: opacity and transform only, at most 1-2 simultaneous animations, none inside long lists, no animated shadows or blur (OPI 3.6). Plain `Animated` with native driver for trivial cases.
- Reduced motion: read `AccessibilityInfo.isReduceMotionEnabled()` plus `reduceMotionChanged` in a `useReducedMotion()` hook; when true, durations -> 0, skeleton static, no expand animation (the web equivalent is the `prefers-reduced-motion` block in CSS that sets 0.01 ms).
- Haptics (`expo-haptics`, PROPOSED): light impact on check-in/check-out success and to-do check, success notification on send and approvals, warning on destructive confirm, none on scroll or typing. Always optional (respect system touch feedback setting), never the only signal.

### 5.2 Icons
Web uses `lucide-react`, 16 px in buttons and nav, 20 px in empty states and tab bar, stroke 1.75 (DS 6). Mobile: `lucide-react-native` (+ `react-native-svg`) with the same names (`LifeBuoy`, `MessagesSquare`, `ListChecks`, `FileText`, `RotateCw`, `TriangleAlert`, `MoreHorizontal`, `Trash2` ...), default `size 20`, `strokeWidth 1.75`, colour from tokens. Wrap in `<Icon name size tone />` so a name is checked at compile time and the import is tree-shaken per icon. Decorative icons `accessibilityElementsHidden`; icon-only controls carry labels. A fallback for the tab bar of 24 px is PROPOSED.

### 5.3 Imagery (Cloudinary)
- The API builds URLs; clients never construct publicIds (FND 3.7). `ImageDto` = `{publicId, url, thumbUrl, width, height}`; `url` = `.../upload/f_auto,q_auto/{id}`, `thumbUrl` = `.../c_limit,w_480,f_auto,q_auto/{id}`. For mobile width buckets derive from `publicId` only if the API exposes the cloud base; otherwise PROPOSED server change: return a `urlTemplate` with a `{w}` slot.
- Width buckets (OPI 3.4): 160 (avatars, tiny), 320 (list thumb, 2-column tiles), 640 (chat bubble), 1080 (viewer). Transform string `f_auto,q_auto,c_limit,w_{bucket}` with `f_auto,q_auto` last. Cache key = bucket so each URL loads once.
- Until the template exists use `thumbUrl` (480) in lists and chat and `url` in the viewer.
- `f_auto` may serve AVIF/WebP; verify `expo-image` on Android 10, fallback `f_webp`/`f_jpg` (OPI 3.4, UNVERIFIED).
- Never decode full-resolution in lists (a 4000 x 3000 image is 48 MB decoded). Fixed aspect box from `width/height`, `muted` placeholder, `cachePolicy="memory-disk"`.
- Upload: compress to long edge 1600, JPEG q .7 (docs 1-1.5 MB at q .8), per-file progress and retry (section 4.4).

### 5.4 Accessibility
- Target: WCAG 2.2 AA plus 48 dp targets (OPI 1.6, 7.1). Every control has `accessibilityRole`, label, and state (`selected`, `checked`, `expanded`, `disabled`, `busy`); `accessible` groups for rows with a composed label ("Ravi, photo, 4:12 PM, client can see").
- Dynamic text: honour system scale; test at 130% and 200%. Cap only chrome: tab labels, chips and badges `maxFontSizeMultiplier 1.3`, header title 1.5; body, inputs, buttons uncapped or 2.0 (OPI 1.6 suggests 1.6-2.0). Layouts wrap, never clip; chips wrap to a second line instead of truncating status labels.
- Status never colour alone: tone chips always have text; sync states icon + text; required fields `*` plus "required" in label; errors with icon + text and live region (DS 8).
- Focus and order: visual order = reading order; moving to a new screen focuses the title; sheets trap focus; no drag-only interaction (provide Move/Reorder buttons; swipe actions have a visible equivalent, UX Part 3 item 5).
- Contrast pairs to unit-test (compute ratio in a Vitest/Jest test from `tokens.ts`; thresholds 4.5:1 text, 3:1 large text and UI; no ratios are asserted here, they are to be computed, not guessed). Primary actions target >= 7:1 for sunlight (OPI 7.3, own judgement) so check whether `#ffffff` on `#0e8f78` reaches it; if not, consider `primaryHover #0b7563` as the resting button colour on mobile (PROPOSED, would diverge from web, so decide with design):
  - foreground on background; mutedForeground on background and on muted; placeholder `#9a8b7e` on background (expected to fail as text, allowed only for placeholder);
  - primaryForeground on primary and on primaryHover; primary on background (link text); primaryHover on primarySoft;
  - each tone fg on its soft bg (8 pairs) and on `#ffffff` (inline text, e.g. `text-success`, `text-danger` used on the web); danger on background (error text); destructive on `destructive/10` (button);
  - input border `#cbd8d4` and border `#dce6e3` against background (UI boundary 3:1 will likely fail for the hairline; input border must pass 3:1 or add a second cue such as the focus ring; flag result to design);
  - muted-foreground on warning-soft/20 and on success-soft/50 composites (complaint panels).
- Screen reader flows to run on a real device with TalkBack: login, post a photo, check in, raise a complaint, mark a to-do done (OPI 7.3).

---

## 6. What differs from the web and why

| Area | Web | Mobile | Why |
|---|---|---|---|
| Styling engine | Tailwind v4 + shadcn/Radix (`globals.css`) | `StyleSheet` + `tokens.ts` | Radix cannot run in RN; NativeWind v5 still RC (STK 1.5) |
| Control height | Button/Input 32 px default (`web/ui/button.tsx`) | 44-52 dp control, 48 dp hit | Touch targets (UX 1.1, OPI 7.1) |
| Body size | 14 px | 15 sp (inputs 16) | Outdoor readability, thumb comfort (UX 2.5) |
| Hover/focus | hover shadows, 3 px focus ring | pressed state, `accessibilityState`, ring only for hardware keyboards | No hover on touch |
| Elevation | CSS box-shadow two layers | one iOS shadow + Android `elevation` + 1 px border | RN limits (FND 4.4) |
| Navigation | sidebar, top bar, workspace left column | bottom tabs (max 5 + More), top segmented tabs per project | Thumb reach, UX 1.1-1.4 |
| Feed | time column + avatar rows | WhatsApp bubbles, swipe-to-reply, system lines | Users know WhatsApp (UX 1.1 item 1) |
| Dialogs | Radix dialog, dropdown, popover, tooltip | bottom sheets + alert dialogs + action sheets; no tooltips | Thumb zone, no hover |
| Tables | stacked into cards below `md` | cards/rows only | Same as web small screens (DS 4) |
| Toasts | sonner bottom-right | bottom, above tabs/keyboard | Layout |
| Dark mode | none (phase 2) | light only; dark slot typed | Palette conflict (FND 4) |
| Fonts | next/font Plus Jakarta (variable), Noto Sans Bengali named | `expo-font` static weights 400-700, system Noto fallback | No variable weights on Android RN |
| Money format | `Intl en-IN` | `Intl` plus hand-written fallback | Hermes Intl uncertainty (OPI 6.3) |
| Connectivity | assumes online; toast on failure | offline banner, queued writes with SyncChip, cached reads | Field staff on poor networks (OPI 1) |
| Images | `<img loading=lazy>` thumbUrl | `expo-image`, width buckets, memory budget | Low-end RAM (OPI 3.4) |
| Motion | no page transitions | native stack transitions, reduce-motion hook | Platform norms; `prefers-reduced-motion` equivalent |
| Proposal builder | full editor | view, share, resend, minor edits | UX Part 2.5 / anti-pattern 3 |

## 7. Open items
- GAP: proposal status chip has no web component to port; export one tone map shared by web and mobile.
- GAP: popover/sheet shadows have no CSS variable.
- Verify on device: Plus Jakarta Sans tabular numerals, Hermes `en-IN` grouping, `f_auto` on Android 10, Bengali conjunct rendering.
- Decide white-on-`#0e8f78` primary contrast outcome (section 5.4) with design.
