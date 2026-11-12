# Vastu Kitchen mobile app: UX pattern research

Date: 2026-11-12. Scope: design docs only, no code changes.
Evidence key: [V] = read in a primary/vendor source this session (URL given). [S] = from a web-search snippet, not opened in full. UNVERIFIED = general industry knowledge or inference, not confirmed on the live web today; check before relying on it.
Honesty note: several design-system sites (m3.material.io, Apple HIG) are JS-rendered and could not be fetched in full, so some guideline numbers are marked UNVERIFIED or backed by secondary pages.

---

## Part 1. Recommended patterns for Vastu

### 1.1 Principles (decisions)

1. **WhatsApp-native feel for the workspace.** Staff and customers already know WhatsApp: bottom composer, bubbles, swipe-to-reply, quoted replies, photo send-with-caption. Copy these interactions; do not invent new ones. (Basis: WhatsApp India reach, Part 2.6.)
2. **Bottom tab bar, 4 tabs for staff + "More"; 3 tabs for customers.** Material's navigation bar is for 3 to 5 destinations ([SAP Fiori M3 usage](https://www.sap.com/design-system/fiori-design-android/v26-4/components/m3-standard-components/navigation-bar/usage) [S]; [Simple A summary](https://simplea.com/blog/material-design-3-navigation-bar) [S]). Never use a hamburger drawer as the primary nav on these users' phones.
3. **Role-specific home, shared skeleton.** Same shell, different tabs and Home content per role (Part 1.3).
4. **One-tap actions where the work happens**: call, WhatsApp, navigate (map), log outcome. Post-call outcome sheet is mandatory for SALES.
5. **Offline-tolerant, low-data by default**: queue posts/photos, compress before upload, show "Sending / Sent / Failed - tap to retry" per message (WhatsApp clock-tick model).
6. **Big targets and big text**: 48dp minimum targets with 8dp spacing ([Android Accessibility Help](https://support.google.com/accessibility/android/answer/7101858) [V]), layouts that survive 130-200% font scale.
7. **Team-only vs client-visible must be unmissable** in the composer (a persistent toggle chip with colour + lock icon), because a wrong-audience post is the costliest mistake in this product.

### 1.2 Per-role bottom tabs

| Role | Tab 1 | Tab 2 | Tab 3 | Tab 4 | Tab 5 / More |
|---|---|---|---|---|---|
| ADMIN | Glance (home) | Projects | Leads | Inbox (approvals, alerts, notifications) | More: Customers, Attendance (team), Templates, Settings |
| SALES | Today | Leads | Projects (read + post, limited) | Alerts | More: Customers, My attendance, Proposals |
| DESIGNER | Today (my tasks, pending client approvals) | Projects | Docs/Designs (cross-project recent) | Alerts | More: My attendance |
| TECHNICIAN | Today (sites + check-in) | Projects (assigned only) | Complaints | Alerts | More: My attendance |
| OFFICE | Today (visitors/calls, leads to enter) | Leads (quick-add FAB) | Customers | Alerts | More: Attendance, Projects |
| HR | Attendance (team) | People | Alerts | n/a | More: Settings |
| CUSTOMER | My Project (home = timeline + what's next) | Chat | Docs | n/a | Profile/Help in top-bar icon, not a tab |

Notes:
- Attendance check-in should NOT be buried: put a persistent "Check in" card at top of Today for all field roles, plus a home-screen shortcut/widget later (UNVERIFIED feasibility on RN).
- Notifications are an "Alerts/Inbox" tab with a badge; Basecamp consolidated Pings/Campfires into a single Hey! notifications destination to reduce tab sprawl ([37signals: Basecamp 3 redesign](https://signalvnoise.com/svn3/basecamp-3-redesign-phase-1-new-nav-and-a-unified-hey-inbox/) [S]; [simpler](https://signalvnoise.com/svn3/basecamp-3-just-got-a-whole-lot-simpler) [S]).
- Customer with several projects: Home opens the single project directly when they have one; a project switcher chip in the top bar when more than one.

### 1.3 Role home screens

**ADMIN "Glance"** (owner on the move; top to bottom, each row tappable to a filtered list):
1. Needs your attention (count chips): pending approvals/quotes, open complaints older than N days, overdue to-dos, leads with no contact in 48h. (Inbox-style, borrowed from approval inboxes; see Part 2.4.)
2. Today: staff checked in vs absent (avatars, tap for GPS/time), site visits scheduled.
3. Pipeline strip: horizontal stat chips by status (New, Contacted, Visit, Proposal sent, Follow-up) with count; Won/Lost this month.
4. Active projects list sorted by latest activity with unread dot.
Avoid charts beyond a sparkline; numbers + deltas read faster outdoors.

**SALES "Today"**: (1) Check-in card; (2) Follow-ups due today and overdue (lead card with Call, WhatsApp, Map buttons); (3) Visits today; (4) New leads unassigned/untouched. Zoho CRM's home lists the day's meetings, tasks and calls with one-tap complete ([Zoho iPhone home screen](https://help.zoho.com/portal/en/kb/crm/crm-mobile/apple/getting-started/articles/organizing-the-home-screen) [S]); Android shows the week with day toggles ([Zoho Android home](https://help.zoho.com/portal/en/kb/crm/crm-mobile/android/articles/customizing-home-screen) [S]). Borrow: day-strip + pending/completed grouping.

**TECHNICIAN/DESIGNER "Today"**: Check-in card, today's sites/projects (address + navigate button), my open to-dos, complaints assigned to me.

**CUSTOMER "My Project"**: see 1.5.

### 1.4 Mapping the web workspace to phone screens

| Web workspace piece | Phone screen / pattern |
|---|---|
| Project list | Projects tab: card list (project name, customer, stage chip, last-activity line, unread dot). Search at top. |
| Project workspace shell | Project screen with a **top segmented control / scrollable tabs: Chat, To-dos, Docs, Complaints, Info**. Chat is default. (Top segmented inside a bottom-tab app is the common pattern; Basecamp keeps tools per project in a list instead ([Basecamp features](https://basecamp.com/features) [S]).) |
| Chat feed with photos/comments/replies | Full-screen WhatsApp-style thread: bubbles, date separators, swipe-right to reply with quoted preview, long-press menu (reply, copy, mark team-only/visible if allowed, delete own). Photo bubbles in a 2x2 grid for multi-photo; tap to open a pager with pinch-zoom. |
| Team-only vs client-visible posts | Composer chip "Team only" / "Client can see" (default per role: staff default Team only for text, explicit pick for photos meant for the customer). Client-visible bubbles get a small eye icon; team-only get a lock and a tinted background that the customer app never renders. |
| Complaint cards inline | Compact card bubble in feed (title, status chip, photo thumb); tap opens Complaint detail screen (full-screen push, not modal). |
| Update rows inline (status changes) | Centered grey system line like WhatsApp "X added Y", single line, tappable. Never a bubble. |
| To-dos with expand-in-place | To-dos tab: list with checkbox at left (48dp), tap row expands in place (accordion) to show notes, assignee, due date, photos. Keep expand-in-place on phone: it avoids a navigation hop. Edit opens a bottom sheet. |
| Docs gallery with folders | Docs tab: breadcrumb + folder rows first, then a 3-column thumbnail grid (2 columns at large font scale); list/grid toggle. Long-press to multi-select. |
| Complaints as tiles | Complaints tab: 2-column tiles on phones (photo, title, status chip, age); switch to single-column list at large text. |
| Notifications | Alerts tab (staff) / bell icon (customer). Group by project; tap deep-links into the exact message. |
| Leads pipeline | **List first, grouped by status with a horizontal status chip filter bar** (Part 2.2). Optional board view in the admin only, one column per screen width with swipe between columns. |
| Lead detail | Header (name, phone, source, status chip), four large actions (Call, WhatsApp, Directions, Log), then timeline (calls, visits, proposals, notes). |
| Proposal sent over WhatsApp | "Send proposal" button on lead: confirm-number sheet (lead's by default, editable without changing lead), then WhatsApp template send; record in timeline. Same as web behaviour. |
| Proposal builder (long form) | Not on mobile at launch: mobile = view, share link, resend, minor edits (price/discount line, validity) only. Full editor stays on web (Part 2.5). |
| Attendance GPS check-in | Persistent card on Today: large button "Check in", shows GPS accuracy state, location name, retry. Offline: store timestamp+coords and sync. |
| Customers | List + detail (More for SALES/ADMIN; tab for OFFICE). |

### 1.5 Customer app recipe (non-technical homeowner)

- **No tabs beyond three**: Project (timeline + what's next), Chat, Docs. Everything else under a profile icon.
- **"What's next" card at top of Project**: one sentence, one date, one button ("Approve design", "Pick a time for visit"). Pending approvals are always on top, red-dot badged.
- **Timeline**: vertical stages (Design, Approval, Factory/Production, Delivery, Installation, Handover) with a clear current step and plain-language dates; photos from client-visible posts appear under the step.
- **Approvals**: full-screen preview of the design, big green "Approve" and secondary "Ask a change" (opens chat prefilled, quotes the item). Confirmation sheet states exactly what is being approved; record time + user. Buildertrend does approvals + e-sign for change orders in its mobile app ([Buildertrend app](https://buildertrend.com/app/) [S]); Houzz Pro keeps all client approvals in the messaging history ([Houzz client dashboard](https://pro.houzz.com/for-pros/customer-experience) [S]). Borrow: approvals live in the same thread as the conversation, so there is an audit trail.
- **Trust signals**: designer/site-lead name + photo + a "message them" button; "last updated 2 hours ago"; real site photos; warranty/complaint button always reachable ("Raise a complaint" with photo, 3 fields max).
- **Complaint raising**: 1 screen: photo(s), what's wrong (voice-to-text allowed via keyboard mic), room dropdown, submit. Show ticket status as chips.
- **Login**: phone number + OTP (Part 2.3). Remember session for months; biometric is optional, never required.
- **Entry from WhatsApp**: staff share an https link from the web domain; verified App Links open the app directly with the right project/approval (Part 2.3). If app not installed, link lands on a responsive web page that works without install (preserves the web approvals flow). This is the most important adoption lever.

### 1.6 Composer behaviour (chat)

- Single-line input that grows to 5 lines; icons: attach (+), camera, send/mic toggle. Camera icon opens an in-app camera (not the system camera) with multi-shot, then a review strip where each photo can be cropped/annotated and given one shared caption. Mirrors WhatsApp media flow (UNVERIFIED in detail; widely known behaviour).
- Photo annotation: pen (3 colours), arrow, text, crop. Procore sends users straight to markup after capture and saves the original ([Procore Markup Mode](https://www.procore.com/whats-new/speed-up-your-job-walks-with-markup-mode-and-save-on-mobile) [S]; [Procore mark up photo](https://support.procore.com/procore-mobile-ios/user-guide/photos-ios/tutorials/mark-up-a-photo-ios?mt-view=f1) [S]). Borrow: keep the original, store the markup as an overlay or flattened copy.
- Compress to ~1600px long edge JPEG before upload; show progress on the bubble; allow "send original" only for ADMIN/DESIGNER (UNVERIFIED target numbers; choose by testing on a low-end device).
- Reply: swipe a bubble right, quoted block above the composer, tap quote scrolls to original.
- Unread: per-project unread count on the list, an "N new messages" divider and a jump-to-bottom FAB in the thread.
- Drafts persist per project.

### 1.7 Sales call and visit flow

1. Lead card: Call button launches dialer (tel:), records start time.
2. On return to the app, an **outcome bottom sheet** appears: Connected / No answer / Busy / Wrong number; next status (pre-selected suggestion); follow-up date quick chips (Tomorrow, 3 days, 1 week, Pick date); one-line note. Pipedrive shows a Call Summary after an answered outgoing call to add notes and schedule follow-ups ([Pipedrive help](https://support.pipedrive.com/hc/en-us/articles/360001535578-Calling-and-Logging-calls-in-the-Mobile-App) [S]); note its iOS limit that only calls placed from inside the app can be logged. Android can detect call-end via foreground state return; auto call-log reading needs the Call Log permission, which Google Play restricts (UNVERIFIED current policy; plan on the "return to app" prompt, not call-log scraping).
3. Visit: "Check in at visit" on the lead stores GPS and time; "Check out" ends it with a notes/photo sheet. LeadSquared does lead/opportunity-level Check-In and Check-Out with route/time reporting ([LeadSquared help](https://help.leadsquared.com/?p=24938) [S]) and runs offline (add leads, notes, calls) ([LeadSquared Field Force](https://leadsquared.com/field-force-automation-software) [S]).
4. Quick-add lead: FAB on Leads with 3 fields (name, phone, source) plus optional voice note; everything else later. Duplicate-phone check inline.
5. Swipe actions on list rows: swipe right = Call, swipe left = WhatsApp (or log). Zoho Android added swipe actions in lists ([Zoho community](https://help.zoho.com/portal/en/community/topic/introducing-swipe-actions-in-the-zoho-crm-android-app) [S]). Swipe must have a visible button equivalent (accessibility and discoverability).

---

## Part 2. Evidence

### 2.1 Chat-first project workspaces on phones

- **Basecamp mobile.** Basecamp 3 consolidated tabs to four memorable places: Home (projects), Hey! (notifications), Activity, Find (search); Pings later got their own menu again, Campfire stayed inside Hey ([redesign phase 1](https://signalvnoise.com/svn3/basecamp-3-redesign-phase-1-new-nav-and-a-unified-hey-inbox/), [pings menu is back](https://signalvnoise.com/svn3/the-pings-menu-is-back/), [Android update](https://signalvnoise.com/svn3/new-year-new-updates-for-basecamp-3-on-android/)) [S]. A 2026 "Basecamp 5" is announced with a unified top menu ([basecamp.com/new](https://basecamp.com/new) [S]); its mobile tab bar is UNVERIFIED. Take-away: few tabs, notifications as its own destination, search reachable everywhere.
- **WhatsApp groups/reply/media.** Behaviour recalled from product knowledge: swipe-to-reply with quote, multi-photo send with caption, delivery ticks, low-data setting for calls. Only the low-data setting and Android version cut-off were confirmed in search: WhatsApp drops Android below 6.0 on 8 Sep 2026 ([Lowyat](https://www.lowyat.net/2026/391157/whatsapp-drop-support-older-android-phones-sept-2026/) [S], [Heise](https://heise.de/-11278268) [S]). UNVERIFIED: detailed interaction specs; verify by hands-on use before finalising.
- **Slack, Trello, Asana, Monday.** No primary sources were read this session. Commonly known patterns (all UNVERIFIED here): Slack bottom tabs Home/DMs/Activity/You; Trello board horizontally paged columns; Asana "My tasks" home with Inbox tab. Use only as inspiration.
- **Buildertrend.** Mobile does daily logs (drafts, photos, location, weather), photo annotation on plans/photos, messages as comments attached to logs/tasks/photos/docs, offline for essential tasks, client portal approvals, e-signed change orders, notifications for activity/approvals/messages ([Buildertrend app](https://buildertrend.com/app/) [S]). A G2 reviewer notes some features are friendlier on desktop ([G2](https://www.g2.com/products/buildertrend/reviews_and_filters) [S]); Connecteam calls desktop screens dense ([review](https://connecteam.com/reviews/buildertrend/) [S]). Take-away: comments attached to items (Vastu already does this) and don't port dense desktop tables to phone. Navigation docs: [Buildertrend mobile navigation](https://buildertrend.com/help-article/introduction-to-mobile-navigation/) (listed; not read).
- **Houzz Pro.** Messaging tool keeps chat, photos, docs, invoices, change orders, approvals as one history; daily logs push photos and approval/payment reminders to clients; AI summaries/translation in mobile app (July 2026 post) ([Houzz Pro client collaboration](https://pro.houzz.com/for-pros/customer-experience), [Houzz Pro AI mobile tools](https://pro.houzz.com/pro-learn/blog/how-houzz-pro-ai-powered-mobile-tools-keep-projects-moving) [S]). Closest analogue to Vastu's customer view.
- **Procore / Fieldwire.** Procore offline: only cached/recently viewed items viewable offline; edits queue until back online ([Procore FAQ](https://support.procore.com/faq/can-i-use-procores-mobile-application-offline?mt-view=f1) [S]). Fieldwire works offline once logged in and project enabled; Smart Sync limits full sync to wifi; offline photos keep GPS ([Fieldwire mobile](https://www.fieldwire.com/support/fieldwire-on-mobile) [S]). Whether markup works offline is not confirmed by either (UNVERIFIED). Take-away: explicit "available offline" prefetch for assigned projects and wifi-only heavy sync option.
- **CoConstruct / JobNimbus**: not researched in depth; UNVERIFIED.

### 2.2 Mobile CRM / field sales

- **Zoho CRM**: Home lists day's meetings/tasks/calls with complete-in-place; Android has week strip; swipe actions in list views (Calls: Reschedule, Cancel, Complete) ([Zoho iOS home](https://help.zoho.com/portal/en/kb/crm/crm-mobile/apple/getting-started/articles/organizing-the-home-screen), [Zoho swipe actions](https://help.zoho.com/portal/en/community/topic/introducing-swipe-actions-in-the-zoho-crm-android-app)) [S]. A community post says the after-call prompt used to exist but stopped working; no official doc found ([Zoho community](https://help.zoho.com/portal/en/community/topic/phone-log) [S]). Lesson: do not depend on OS-level call detection.
- **Pipedrive**: call summary screen after answered outgoing calls; call from deal/person detail or phone icon in people list; coloured labels in pipeline view ([Pipedrive KB](https://support.pipedrive.com/hc/en-us/articles/360001535578-Calling-and-Logging-calls-in-the-Mobile-App) [S]).
- **LeadSquared (India)**: lead-level check-in/out with route and time metrics; daily check-in/out, distance, halt hours; offline add leads/notes/calls; geo-fenced activity logging; manager "My Team" view ([Check-in help](https://help.leadsquared.com/?p=24938), [Field Force Insights](https://help.leadsquared.com/?p=27969), [iOS release notes](https://help.leadsquared.com/?p=27746)) [S]. Closest to Vastu's attendance + visit needs.
- **HubSpot, Salesforce, Freshsales**: not researched in this pass. UNVERIFIED claims from general knowledge: Salesforce mobile uses a "Today"/Home plus Kanban; HubSpot mobile has a call-logging prompt. Do not cite.
- **Board vs list on small screens** (UNVERIFIED, design reasoning): kanban columns wider than the viewport force horizontal scrolling and make drag-drop with a thumb error-prone; status change is better as a tap on the status chip opening a bottom sheet with 7 options. Provide list grouped by status as default; board optional for ADMIN.

### 2.3 Customer-side, OTP and deep links

- **WhatsApp OTP**: authentication templates support zero-tap (code broadcast to app, no URLs/media/emojis), one-tap autofill, copy code fallback; Android-only for the first two; needs handshake, package name + signing key hash, user logged in to WhatsApp with that number, notifications enabled; PendingIntent handshake deprecated 15 Oct 2026, use the OTP Android SDK `com.whatsapp.otp:whatsapp-otp-android-sdk:1.0.0` ([Meta docs](https://developers.facebook.com/docs/whatsapp/business-management-api/authentication-templates/zero-tap-authentication-templates) [V]). Decision: send the login code via WhatsApp (repo already has a login-code template via WA AGENT) with one-tap autofill; always show manual 6-digit entry and a resend with countdown. RN SDK availability for the native module: UNVERIFIED.
- **SMS autofill**: SMS Retriever works without extra permissions and requires an app hash in the SMS ([Google Identity](https://developers.google.com/identity/sms-retriever/overview) [V]). The Android docs URL I tried returned 404. Use as fallback only if SMS is ever added (cost, DLT registration in India UNVERIFIED).
- **App Links**: verified links open directly in the app without the disambiguation dialog on Android 6+ with Google services ([Android developers](https://developer.android.com/training/app-links) [V]). Requires `assetlinks.json` on the web domain (details UNVERIFIED here). iOS equivalent is Universal Links (UNVERIFIED). WhatsApp opens in-app browser sometimes; always have a web fallback page with an "Open in app" button (UNVERIFIED behaviour, test).
- **Customer timeline/approvals**: see Buildertrend and Houzz sources above.

### 2.4 Role-based IA and glance dashboards

- Navigation bar 3 to 5 destinations; use rail/drawer beyond that ([SAP Fiori M3 nav bar](https://www.sap.com/design-system/fiori-design-android/v26-4/components/m3-standard-components/navigation-bar/usage), [Simple A](https://simplea.com/blog/material-design-3-navigation-bar)) [S]. Material 3 Expressive replaced the original bar with a shorter "flexible navigation bar" and is moving drawers to rails ([9to5Google](https://9to5google.com/2025/05/14/material-3-expressive-navigation/) [S]); official m3.material.io page could not be fetched.
- "More" tab: keep rarely used and admin-only items there; label it "More", not an icon-only kebab (UNVERIFIED best practice).
- Owner glance numbers: no source found on what owners want; the list in 1.3 is recommended design (UNVERIFIED), derived from Vastu workflows (approvals, complaints, follow-ups, attendance).
- Manager-level visibility patterns exist: LeadSquared "My Team" shows check-in status, distance, leads, tasks ([iOS notes](https://help.leadsquared.com/?p=27746) [S]).

### 2.5 Touch, accessibility, forms, galleries, dark mode

- Targets: at least 48x48dp, 8dp spacing; extend hit area beyond the visual icon (padding / `TouchDelegate`) ([Android accessibility help](https://support.google.com/accessibility/android/answer/7101858) [V]; [web.dev](https://web.dev/articles/accessible-tap-targets) [V] says ~48 px, 8 px apart).
- iOS: 44x44 pt minimum and Dynamic Type via system text styles ([Apple HIG accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)). The fetched content was a stub; figures are UNVERIFIED against the live page, but 44pt is the long-standing documented value.
- Thumb zone: primary actions in the bottom third; destructive actions never next to primary ones (UNVERIFIED but standard). Outdoor: high-contrast, min 16sp body text, avoid light-grey on white; test in sunlight.
- Bottom sheets vs dialogs (UNVERIFIED, no source fetched): sheets for choices/forms that continue the current context (status picker, outcome log, attach menu); dialogs only for blocking confirmations (delete, discard unsent). Destructive: confirm with a specific verb ("Delete 3 photos"), red button, Undo snackbar preferred for reversible deletes.
- Empty/error/offline states: each list gets an empty state with one action; offline banner (not modal) + queued item badges; errors say what to do next in plain language.
- Forms: one question per screen only for onboarding/complaint flow; otherwise a single scroll with grouped sections and sticky Save. Use correct keyboard types (`phone-pad`, `numeric`, `email-address`), `autoComplete`/`textContentType` hints, native date picker with quick chips (Today, Tomorrow, +1 week) (UNVERIFIED but standard).
- Long-form proposal editing: do not port the full web builder; provide (a) template-picker + fill key fields (customer, amount, validity) as stepped form, (b) preview, (c) send. Full layout editing remains web.
- Galleries: grid for photo/doc browsing with folder rows on top; list view with filename/date/size for documents (PDFs) since thumbnails are meaningless; tiles for complaints because they are photo-led, but fall back to list at large font scale.
- Dark mode: support system setting with a tested palette (contrast on status chips); on AMOLED mid-range devices dark saves some battery (UNVERIFIED). Make it follow system; no custom toggle at v1 except in settings.

### 2.6 Indian context

- WhatsApp's India base is huge but app downloads fell ~49% YoY while MAU grew 6% (Sensor Tower via [TechCrunch Dec 2025](https://techcrunch.com/2025/12/14/whatsapps-biggest-market-is-becoming-its-toughest-test/) [S]); WhatsApp has a user-enabled low-data setting for calls ([ZeeBiz](https://zeebiz.com/technology/news-how-to-save-mobile-data-on-whatsapp-step-by-step-guide-for-android-ios-67134) [S]). WhatsApp planned mandatory SIM binding in India ([LatestLY](https://www.latestly.com/technology/whatsapp-to-introduce-mandatory-sim-binding-in-india-new-liquid-glass-interface-for-ios-beta-users-spotted-7327032.html) [S]); impact on WhatsApp OTP delivery is UNVERIFIED, so keep an alternative login path.
- No source found for share of low-end Android in India in 2026: UNVERIFIED. Design to a budget: target Android 8+, 3 to 4 GB RAM, assume 3G-like bursts; keep APK small, lazy-load galleries, thumbnails of ~20 to 40 KB (UNVERIFIED targets).
- Language: ship English first with all strings externalised; Hindi and Bengali translations next. Mixed-script is normal (names in English, labels in Hindi/Bengali); use a font stack with Noto Sans Bengali/Devanagari bundled or system fallback, and allow a language switch at login and in profile. Chat content is user text, never translated automatically at v1 (Houzz Pro offers translation of messages in 10 languages, [Houzz Pro Learn](https://pro.houzz.com/pro-learn/blog/how-houzz-pro-ai-powered-mobile-tools-keep-projects-moving) [S], as a future option). Bengali/Hindi strings run 20-40% longer (UNVERIFIED): no truncated tab labels.
- Large text: layouts must not clip at 200% font scale; use flexible rows; wrap tab labels to max 2 lines or hide inactive labels never (always show labels).
- Voice input: rely on keyboard mic for Hindi/Bengali dictation; a notes field next to a mic icon is high value for site staff (UNVERIFIED).

---

## Part 3. Anti-patterns to avoid

1. **Hamburger/drawer as primary navigation**: hides the 4 things people use daily.
2. **More than 5 bottom tabs** or icon-only tabs; unlabeled icons for non-tech customers.
3. **Porting desktop tables/dense forms** (Buildertrend reviewers flag desktop-dense UIs, [Connecteam](https://connecteam.com/reviews/buildertrend/)). The proposal builder stays on web.
4. **Kanban as the default pipeline view on a phone**: horizontal scroll plus drag with a thumb.
5. **Swipe-only actions** with no visible equivalent; swipe next to the edge-back gesture causing accidental triggers.
6. **Relying on OS call-log or call-end detection** (Zoho users report the prompt stopping; Pipedrive iOS limit).
7. **Ambiguous audience in the composer**: a tiny icon for team-only vs client-visible. Make it a labelled, coloured chip, and re-confirm when posting a photo from a team-only default to a client.
8. **Full-resolution photo uploads** on mobile data; no progress/retry; losing the draft when the app is killed.
9. **Modal dialogs for everything**, especially blocking ones on first launch (permission walls). Ask for location only at first check-in, camera at first capture, notifications after first meaningful event.
10. **Forcing app install**: customers arriving from a WhatsApp link must be able to view and approve on a web page.
11. **Login by password for customers**: use OTP; do not make the customer register or remember anything.
12. **Auto-translating or rewriting user chat** without consent.
13. **Placing destructive actions (delete, lose changes) beside primary buttons** or confirming with "Are you sure?" without naming the object.
14. **Spinner-only loading**: use skeletons and cached content, show last-synced time.
15. **Assuming sunlight readability**: light-grey text, thin fonts, low-contrast status colours.

---

## Part 4. Open items to verify before build

- Hands-on review of WhatsApp composer/media flow, Slack, Trello/Asana/Monday, Zoho, HubSpot, Salesforce, Freshsales mobile apps (not covered by primary sources here).
- m3.material.io navigation bar and bottom sheet guidance, and Apple HIG tab bar guidance (pages not fetchable with static fetch).
- Whether WhatsApp OTP SDK can be wrapped in React Native and how it behaves with SIM-binding in India.
- Android App Links `assetlinks.json` requirements and WhatsApp in-app browser behaviour; iOS Universal Links.
- Real device test of photo compression targets and cold-start time on a 3 GB RAM phone.
