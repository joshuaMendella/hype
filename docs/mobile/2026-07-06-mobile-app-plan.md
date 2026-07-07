# Hype Mobile — Build Plan (Android-first APK, iOS-ready)

**Date:** 2026-07-06
**Goal:** Produce a sideloadable Android APK to test Hype on a device, built so the *same* codebase ships to iOS later. First build targets the **core loop only**: login → graph home → chat interviewer → watch nodes grow live.

**Decisions locked (session start):**
- Graph render: **native, d3-force + Skia** (not WebView, not RN-SVG)
- First APK scope: **core loop only**
- Backend host for testing: **local `pnpm dev` over LAN** (Vercel deploy deferred)

---

## ▶ RESUME HERE (updated 2026-07-07 — Phases 2–6 done + Phase 7 build config ready)

**Phase 7 DONE — full core loop verified on a physical Android device (2026-07-07):** login → live Skia graph → chat interviewer → held a conversation → new nodes created and appeared. First real render of Phases 4–6; all confirmed working. Punch list of polish items pending (user: "went well, some points to improve" — capturing next).

**Build/config history (Phase 7 setup):** Config: added `expo-dev-client ~57.0.5`; wrote `apps/mobile/eas.json` (`development` = `developmentClient:true` + `distribution:internal` + Android `buildType:apk`; `preview` = internal APK for Phase 8; `production` = autoIncrement; `appVersionSource:remote`). `app.json`: name→"Hype", slug→"hype", added `android.package` + `ios.bundleIdentifier` = `com.joshuamendella.hype`, `userInterfaceStyle`→"dark"; `eas init --force` linked the project (**projectId `49fdea16-2d86-4b0b-8200-433bdd22540f`**, owner `josh_mendel`, wrote `extra.eas` into app.json). `expo-doctor` 20/20. tsc clean.
- **Bundle identifier is provisional** (`com.joshuamendella.hype`) — user asked about renaming later. It's a namespace users never see; freely changeable until first store submission (Phase 8+), permanent only after that. Display `name` is renamable anytime. Decided: build under it now, finalize at store time.
- **EAS + Windows symlink fix:** first upload failed `EPERM: symlink` recreating `.agents/skills/brainstorming` → `.claude/...` (Claude tooling dirs are symlinked on disk). Fixed with a root **`.easignore`** — note EAS uses `.easignore` *instead of* `.gitignore` when present, so it mirrors the root `.gitignore` rules + excludes `.agents/`, `.claude/`, `docs/`. Re-upload was a slim 1.3 MB. **If a future build hits another `EPERM: symlink <path>`, add that dir to `.easignore`.**
- **Build:** https://expo.dev/accounts/josh_mendel/projects/hype/builds/cd26070c-b011-483f-a10a-6e85d47b35ca (queued 2026-07-07). SDK 54+ auto-configures Metro for the pnpm-hoisted monorepo — no manual metro.config.
- **Dev-profile env:** EAS reported no env vars for the `development` environment — expected. A dev build loads JS from the local Metro server, which reads `apps/mobile/.env` at bundle time; `EXPO_PUBLIC_*` inject locally, nothing needed on EAS. (Preview/Phase 8 differs — bundled JS needs EAS env.)
- **Remaining Phase 7 (after build finishes ~10–20 min):** install APK on phone → `cd apps/web && pnpm dev` (confirm the **Network:** URL matches `EXPO_PUBLIC_API_URL`; open TCP 3000 on Windows Firewall if unreachable) → `cd apps/mobile && npx expo start --dev-client` → open the dev build → verify login → live Skia graph → chat opener → send → graph grows. **First time any mobile UI renders.**

**User runbook (on-device core loop):**
1. `npm install -g eas-cli && eas login` (global install — `npx`/`pnpm dlx` mis-resolve in this hoisted monorepo).
2. From `apps/mobile`: `eas init` (creates the Expo project, writes `extra.eas.projectId` + `owner` into app.json).
3. `eas build --platform android --profile development` → wait for the cloud build → install the APK on the phone (scan the QR/open the link).
4. Web API reachable from the phone: `cd apps/web && pnpm dev` — confirm the printed **Network:** URL matches `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` (`http://192.168.0.193:3000`). If the phone can't reach it, allow inbound TCP 3000 through Windows Firewall (private network), and re-check the LAN IP (`ipconfig` — DHCP may have reassigned it).
5. From `apps/mobile`: `npx expo start --dev-client` → open the installed dev build on the phone → it loads JS over LAN, hot-reloads. **First time any mobile UI actually renders** — verify: login → live graph (Skia) → chat opener → send a message → graph grows (3s/6.5s poll).

**Then Phase 8** — standalone preview APK: `eas build --platform android --profile preview`. Needs the `EXPO_PUBLIC_*` env as EAS env/secrets (the bundled JS won't read local `.env`, and the LAN IP won't work off your wifi — point `EXPO_PUBLIC_API_URL` at the deployed web URL once Vercel is live).

---

### Phase 6 (done)
**Phase 6 done** — `apps/mobile/components/ChatPanel.tsx`: RN overlay porting the web chat contract. AI line up top, single bottom input (one message at a time, no scrollback), reused word-by-word typewriter. `postChat()` attaches `session.access_token` as `Authorization: Bearer` to `POST {EXPO_PUBLIC_API_URL}/api/chat` (bearer path live since Phase 3); route reads only `messages` and derives the user from the token. Opener fetched on mount (`messages: []`); rate-limit + server errors surfaced as the AI line. `graph.tsx` renders it over the canvas and passes `onReply={scheduleRefresh}`, which polls `load()` at 3s + 6.5s (extraction is fire-and-forget `after()` server-side — same poll-twice pattern as web `GraphCanvas`). Empty-graph branch now just shows the dark canvas; the chat opener drives turn one.
- **Deferred (not blockers):** ad `card` in the response is ignored — ad-moment UI is a separate roadmap item. No `<2h` session restore (web does it server-side) — each open fetches a fresh opener. Node-birth animation still pending (poll-refresh currently just re-renders the whole graph).
- **Verified:** mobile `tsc` clean. **NOT seen on a device** — first real chat round-trip is Phase 7 dev-client. Positive bearer path (valid JWT → 200) is exercised there; Phase 3 already proved bogus/no-token → 401.

**Next up: Phase 7** — dev-client build (needs the Expo account for EAS Build) → sideload the APK → boot the full core loop on-device (login → live graph → chat → graph grows). This is the first time any of the mobile UI actually renders. Then Phase 8 (standalone preview APK).

---

Phases 1B and **2 are done**. State verified (`expo-doctor` 20/20 ✓, `apps/mobile` tsc clean, `apps/web` build passes under hoisted linker):
- Native deps installed via `npx expo install` (SDK-57 versions): `@shopify/react-native-skia@2.6.2`, `react-native-gesture-handler`, `react-native-reanimated@4.5.0` **+ `react-native-worklets`** (required peer for reanimated 4), `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill`, `expo-router@57.0.4`, `react-native-safe-area-context`, `react-native-screens`, `expo-linking`, `expo-constants`. Skia postinstall runs (`allowBuilds` in `pnpm-workspace.yaml`).
- **SDK-57 gotchas resolved:** (a) **No babel.config.js** — `babel-preset-expo` auto-configures the reanimated plugin; the old "reanimated plugin last" note is obsolete. (b) reanimated 4 needs `react-native-worklets` explicitly. (c) **AsyncStorage, not expo-secure-store**, for the Supabase session — Android SecureStore's ~2KB per-value cap truncates the JWT; AsyncStorage is the documented Supabase-RN store (removed the unused secure-store dep).
- expo-router wired: `package.json main = expo-router/entry`; app.json `scheme: "hype"` + `experiments.typedRoutes`; deleted old `App.tsx`/`index.ts`.
- Files: `app/_layout.tsx` (GestureHandlerRootView + SafeAreaProvider + Stack), `app/index.tsx` (auth-gate redirect), `app/login.tsx` (signInWithPassword), `app/graph.tsx` (**placeholder** — shows RLS'd `vault_notes` count + sign out; real Skia canvas is Phase 4/5), `lib/supabase.ts` (supabase-js + AsyncStorage + AppState autorefresh).
- react pinned to `19.2.4` (matches `apps/web`, dedupes workspace react) via `expo.install.exclude` in mobile package.json.
- **`.env` is gitignored** — copy `apps/mobile/.env.example` → `.env` and fill `EXPO_PUBLIC_SUPABASE_ANON_KEY` (URL prefilled) + `EXPO_PUBLIC_API_URL` (PC LAN IP). Not yet created; needed before the app runs.

**Next steps, in order:**
1. ~~Create `apps/mobile/.env`~~ — **done** (anon key + LAN IP `192.168.0.193`).
2. ~~**Phase 3** — bearer-token auth on `/api/chat`~~ — **done** (see top marker).
3. ~~**Phase 4** — `GraphCanvasSkia` against a static fixture~~ — **done** (see top marker).
4. ~~Phase 5 live data~~ ~~Phase 6 ChatPanel~~ — **done** (see top marker). → Phase 7 dev-client build + sideload → Phase 8 preview APK.

**Not yet run on a device** — no Metro/dev-client boot this session (Windows, no emulator wired). First real boot happens at Phase 7 (`eas build --profile development`), or earlier via `npx expo start --dev-client` once `.env` exists.

**Workflow:** Opus plans/reviews, Sonnet writes code (dispatch via Agent). Double-check every change for errors + optimizations. Ponytail mode on.

---

## 1. The key architectural insight

The web app is already split in a way that makes this port cheap:

| Layer | Where it lives | Mobile reuse |
|-------|---------------|--------------|
| AI interviewer, extraction, ad flow | `apps/web/app/api/chat/route.ts` (+ `lib/ai/*`) | **Reused as-is** — mobile calls the same HTTP endpoint |
| Graph *layout* | `d3-force` (pure JS) inside `GraphCanvas.tsx` | **Reused as-is** — runs natively in RN, no DOM |
| Graph *render* | SVG/DOM + D3 selections | **Re-implemented** in Skia (the only real new code) |
| Auth | Supabase, **cookie**-based (`@supabase/ssr`) | **Adapted** — mobile uses bearer JWT |
| Data | Supabase Postgres + RLS | **Reused as-is** — mobile queries directly with the user's JWT |

**No AI/extraction logic is rewritten.** The interviewer prompt, Gemini/Cerebras fallback, synthesize→extractFacts pipeline, and the whole vault schema stay exactly where they are. Mobile is a second client on the same backend.

**The one required backend change:** `/api/chat` currently authenticates via `supabase.auth.getUser()` reading the session cookie. Mobile sends `Authorization: Bearer <access_token>` instead. We add a tiny header-aware auth path (below). Middleware doesn't block `/api/*` (matcher is only `/graph`, `/login`, `/signup`), so nothing else fights us.

---

## 2. Tech stack (and why — with the alternatives I rejected)

| Concern | Choice | Why / what I rejected |
|---------|--------|----------------------|
| Framework | **Expo (managed) + EAS Build** | Owner is Windows-only, no Mac — EAS builds both APK and iOS in the cloud. Bare RN gives us nothing here and costs native-toolchain pain. |
| Runtime for Skia | **EAS dev client** (not Expo Go) | Skia is a custom native module; Expo Go can't load it. A one-time `eas build --profile development` gives an installable dev client that hot-reloads JS like Expo Go. |
| Navigation | **Expo Router** (file-based) | Mirrors the Next.js App Router mental model already in `apps/web`. Rejected raw React Navigation — more boilerplate, no benefit. |
| Graph render | **@shopify/react-native-skia** | Chosen. 60fps canvas, keeps the glow/elastic-pop node-birth animations. Layout stays d3-force. |
| Gestures/anim | **react-native-gesture-handler + react-native-reanimated** | Pan/zoom/drag on the Skia canvas, driven on the UI thread. These are Expo-supported out of the box. |
| Auth + data | **@supabase/supabase-js** + **expo-secure-store** | The plain JS client (NOT `@supabase/ssr`, which is cookie/SSR-specific). Session token persisted in secure-store, not AsyncStorage, since it's a credential. |
| HTTP to AI | native `fetch` | Same JSON contract the web ChatPanel already uses. |
| Shared code | **`packages/shared`** workspace pkg | `pnpm-workspace.yaml` already globs `packages/*`. Holds types + pure graph helpers so web and mobile don't drift. Kept minimal. |
| State | React state + existing **poll-twice-after-reply** pattern | Reuse the web's `refreshTrigger` approach verbatim first. Supabase Realtime is the noted upgrade, not first-APK work. |

---

## 3. Monorepo structure after this work

```
hype/
├── apps/
│   ├── web/                    ← unchanged except the bearer-auth tweak in /api/chat
│   └── mobile/                 ← NEW: Expo app
│       ├── app/                ← Expo Router: (auth)/login, (app)/graph
│       ├── components/
│       │   ├── graph/GraphCanvasSkia.tsx   ← the one big new file
│       │   └── chat/ChatPanel.tsx          ← ported from web (RN primitives)
│       ├── lib/supabase.ts     ← supabase-js + secure-store session
│       ├── app.json / eas.json
│       └── package.json
└── packages/
    └── shared/                 ← NEW, tiny
        ├── types.ts            ← moved from apps/web/types/database.ts
        └── graph-layout.ts     ← extracted pure helpers: nodeRadius, You-node
                                   synthesis, force config, palette/color map
```

**What moves into `packages/shared` (pure, no DOM, no Next):**
- `types/database.ts` → `types.ts`
- `lib/graph/palettes.ts` color map + `nodeColorFor` (drop the `localStorage` fns; those are web-only cosmetics)
- Extract from `GraphCanvas.tsx` into `graph-layout.ts`: `nodeRadius`, the degree map, and the **"You"-node synthesis + union-find rootless-anchor logic** (lines 68–103) — this is subtle, correctness-critical, and must not be re-implemented twice.

Web imports these back from `packages/shared` so there's a single source of truth. Ponytail: extract *only* those helpers — don't abstract the render loop, it's genuinely different per platform.

---

## 4. Feature port map

### In the first APK (core loop)
| Web feature | Mobile approach |
|-------------|-----------------|
| Login | Expo Router `(auth)/login` screen; `supabase.auth.signInWithPassword`; token → secure-store. (Signup deferred — test with an existing account.) |
| Graph home | `GraphCanvasSkia` — d3-force layout (reused) + Skia render + gesture-handler pan/zoom/drag. Same data query as `graph/page.tsx`. |
| Chat interviewer | Ported `ChatPanel` using RN `View`/`TextInput`; same `fetch('/api/chat')` contract; typewriter reveal reused (pure JS). |
| Live graph growth | Reuse the poll-twice-after-reply trigger; re-query `vault_notes`/`vault_links`, diff new node IDs, animate them in via Skia. |
| Session restore (<2h) | Same query as `graph/page.tsx` does server-side; run it on mount in the app. |

### Deliberately deferred (NOT first APK)
Onboarding walkthrough polish · profile edit · graph settings drawer · manage/delete nodes · vault export (zip) · ad-moment card · signup. All already exist on web; port after the core loop is proven on-device.

---

## 5. The graph port (the only hard part) — detail

`GraphCanvas.tsx` today does four things; only #3 is thrown away:

1. **Data → nodes/links** + "You"-node synthesis + degree/radius. → **reuse** from `packages/shared`.
2. **d3-force simulation** (`forceLink/forceManyBody/forceCenter/forceCollide`, same constants). → **reuse verbatim** — d3-force mutates plain `{x,y}` objects, zero DOM.
3. **SVG render + D3 selections + zoom/drag.** → **replace** with Skia draw calls + gesture-handler.
4. **Tooltips (HTML div), ResizeObserver.** → replace with a Skia/RN overlay + `onLayout`.

**Render loop:** run the d3-force sim in JS; on each tick, push node positions into a Reanimated shared value; a Skia `Canvas` reads them and draws `Circle` (core + glow) and `Line` (edges, colored by `link_type`). Node-birth animation (elastic pop + glow pulse) → Reanimated `withTiming`/`withSpring`. Pan/zoom = a `Group` transform driven by pinch/pan gestures; node drag = hit-test nearest node, set `fx/fy` like the web drag handler.

**Risk & mitigation:** Skia render is the biggest new surface. Mitigation — build it against a **static fixture graph first** (hardcoded nodes/links), get pan/zoom/draw/animation right with no network, *then* wire live Supabase data. This decouples the render bug-hunt from auth/data bugs.

---

## 6. Backend change (small, required)

Add bearer-token auth to `/api/chat` (and later any API the app calls). Sketch:

```ts
// resolve the user from either the cookie (web) or an Authorization: Bearer (mobile)
const authz = req.headers.get("authorization")
const supabase = authz?.startsWith("Bearer ")
  ? createClient(URL, ANON_KEY, { global: { headers: { Authorization: authz } } }) // RLS still applies to this token
  : await createClient() // existing cookie path
const { data: { user } } = await supabase.auth.getUser()
```

RLS is preserved because we pass the *user's* JWT, not the service role. No new security surface. `ponytail:` factor this into one `lib/supabase/fromRequest.ts` helper when a second API route needs it — not before.

---

## 7. Run / build pipeline

**To iterate (daily):**
1. `apps/web`: `pnpm dev` (your PC, note the LAN IP, e.g. `192.168.x.x:3000`).
2. `apps/mobile`: `EXPO_PUBLIC_API_URL=http://<LAN-ip>:3000` + Supabase env in `.env`.
3. `npx expo start --dev-client` → scan from the dev-client build → JS hot-reloads.

**To produce the testable APK:**
- One-time: `eas build --profile development --platform android` → install the **dev client** APK (needed once because of Skia).
- For a standalone shareable APK: `eas build --profile preview --platform android` (internal-distribution APK, not an `.aab`).
- iOS later: same `eas build --platform ios` from the same code — no Mac needed.

**LAN caveat:** phone and PC on the same WiFi; Android allows cleartext HTTP to a LAN IP via a dev `network_security_config` (Expo dev builds permit this). Vercel deploy is the later step that removes the "PC must be running" constraint.

---

## 8. Execution phases (order of attack)

1. **Scaffold** `apps/mobile` (Expo + Router + EAS config) and `packages/shared`; move types + pure graph helpers; wire web to import them back (proves no regressions).
2. **Auth**: login screen + secure-store session + a `supabase.ts` client; land on a placeholder graph route.
3. **Backend tweak**: bearer auth on `/api/chat`; verify from the phone with curl/fetch that chat responds to a Bearer token.
4. **Graph, offline**: `GraphCanvasSkia` against a static fixture — pan/zoom/drag/draw/birth-animation.
5. **Graph, live**: wire real Supabase data + the session-restore query.
6. **Chat**: port `ChatPanel` (RN primitives, same fetch contract, typewriter); wire `onReply` → poll-twice graph refresh.
7. **Dev-client build** → sideload → **test the full core loop on-device.**
8. **Preview APK** build for standalone testing.

Each phase is independently verifiable; 4 is the riskiest and is deliberately isolated from data/auth.

---

## 9. Open items / risks

- **Skia render effort** — the one genuinely new build; mitigated by the fixture-first approach (phase 4).
- **d3-force perf in the JS thread** on a large graph — fine for hundreds of nodes; if it stutters, move the sim into a worklet/`InteractionManager`. Not a first-APK concern.
- **Android cleartext-to-LAN** config for dev — Expo dev builds handle this; verify on first `preview` build.
- **Cosmetic graph settings / palette persistence** — web uses `localStorage`; mobile equivalent is AsyncStorage, deferred with the settings drawer.
- **Vercel deploy + GDPR account-deletion blocker** (from CLAUDE.md) — not needed for LAN testing; becomes required before off-network distribution.

---

## 10. Explicitly NOT building yet (YAGNI)

Offline mode, push notifications, biometric unlock, a shared UI component library, Supabase Realtime, deep-link email confirmation, in-app purchases, and any iOS-specific polish. All revisit-after-core-loop.
