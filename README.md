# Flynet Tab Split

**Splitting a restaurant bill, settled in $FLY — anchored to a real check-in.**

Splitting a check is still awkward. You either do cash maths at the table or fire off
five disconnected payment requests afterwards. This settles the bill **at the table,
in the currency the venue already accepts**, and ties the whole thing to a verifiable
visit — with a wallet, a live FLY quote, and a history behind every payment.

---

## Why this is a Flynet app and not a Splitwise clone

It uses all three Flynet pillars in one short flow, and each one is load-bearing:

| Pillar | What it does here | Why Venmo/Splitwise can't |
|---|---|---|
| **Check-in** | Anchors the bill to a real visit at a real venue | They have no idea you were at a restaurant |
| **Member identity** | Each diner's own wallet pays their own share | No shared member graph to settle against |
| **Payment Intents** | FLY moves from each member to the venue | Not settled in the venue's own currency |
| **Challenges** | The settled screen shows the venue's live reward campaigns | No connection to the restaurant's loyalty system |

### Three constraints, each visible in the product

**1. No peer-to-peer transfer.** A Payment Intent only moves FLY from a member's
wallet to a **merchant's** wallet. So this app does not reimburse whoever fronted
the cash — instead **the table settles the check with the venue directly, one
intent per seat, before anyone pays.** Stated on the home page, in the footer of
every screen, and walked through in full at `/how-it-works`.

**2. The public check-in feed is anonymized.** `GET /check_ins` records carry no
user field, and its `user` filter was removed — passing it is silently ignored and
returns the full unfiltered set. The attributable feed is `GET /users/me/check_ins`,
where the subject comes from the access token. That is what `/visits` reads.

**3. Flynet has no friends API.** So the people graph lives in this app: search by
name or handle, follow a personal invite link, or get picked by the host at the
table. Every payer is a real signed-in account with their own wallet — nobody is
ever added to a bill as a name on a list.

---

## The flow

1. **Sign in or create an account** (`/login`). Email and password, or *Connect with
   Blackbird* when OAuth is configured. New accounts open with a wallet, a starter
   balance, and a deposit address for FLY and USDT.
2. **Fund the wallet** (`/wallet`). Connect an external wallet or create a
   self-custody one, deposit FLY or USDT, and swap between them at the live quote
   with the 0.30% fee shown before it is taken.
3. **Check in** at a venue (`/restaurants`).
4. **Open a table** (`/split`) — subtotal, tip, and either an even split or a
   different amount per seat. Leave seats open for people who are still on their way.
5. **One payment request per seat** is created immediately, each with a unique id.
6. **People pay their share** at `/pay/{intentId}` — a direct link to their own
   request, or through the table board.
7. **Live status** (`/tabs/{id}`) polls and flips to **settled** when the last share
   lands, with the venue's reward campaign alongside it.

### Money, plainly

- Prices are quoted in **microdollars** (`1 USD = 1,000,000`) and re-read every five
  seconds from `GET /api/price` (`no-store`), so every dollar figure on screen is the
  current one. The quote is deterministic per five-second bucket, which is what keeps
  server render and first client paint identical.
- Balances are held in **FLY** and **USDT**. A table share is always charged in FLY;
  you can fund it with USDT by swapping first.
- A table settles when **every declared seat is paid**. If a seat was declared and
  nobody claimed it, the host either **covers** the remainder or **closes** the table
  with what was actually collected — the shortfall is stated, never hidden.
- **Idle tables close themselves.** A table with no activity for `TAB_IDLE_MINUTES`
  (default **120**) is reaped: it disappears from the board and every paid share is
  refunded.
- **The host can cancel** a table at any point. Pending requests are dropped and
  settled shares are refunded, with a reason recorded on the table.

---

## Running it

```bash
npm ci
npm run dev        # http://localhost:3000
```

That's it. With no credentials present the app runs in **mock mode** against the
bundled fixtures in `src/flynetClient.ts` — a fresh clone works, no env file needed.

```bash
npm test           # unit tests (share math, price buckets, table states, PKCE)
npm run lint
npm run build
```

State lives in `.data/` (gitignored JSON). Delete the folder to start clean; the
seeded members re-appear on the next request.

### Accounts

Create your own from `/login`, or use one of the seeded members with the shared
password **`flynet-table-2026`**:

| Name | Email | Handle | Balance |
|---|---|---|---|
| Miracle Iyanuoluwa | `miracle@flynet.xyz` | `@miracle` | 842.5 FLY · 310.25 USDT |
| Amara Osei | `amara.osei@flynet.xyz` | `@amara` | 412.8 FLY · 64 USDT |
| Kwame Mensah | `kwame@flynet.xyz` | `@kwame` | **3 FLY · no USDT** — short on purpose |
| Sofía Rossi | `sofia.rossi@flynet.xyz` | `@sofia` | 196.4 FLY · 488 USDT |
| Yuki Tanaka | `yuki.tanaka@flynet.xyz` | `@yuki` | 77.1 FLY · 15.5 USDT |
| Diego Marín | `diego.marin@flynet.xyz` | `@diego` | 1240 FLY · 9.25 USDT |

Kwame is deliberately short so the funding path is easy to walk: pick him at a
table, watch his payment refused with the exact shortfall, then top him up from
USDT and pay again.

### Environment

Copy `.env.example` to `.env.local`. Everything is optional in mock mode.

| Variable | Purpose |
|---|---|
| `MOCK_MODE` | `true`/`false`. Unset means: mock if no `API_KEY`, otherwise live. |
| `API_BASE_URL` | e.g. `https://api.staging.blackbird.xyz/flynet/v1` |
| `API_KEY` | Discovery routes (`/restaurants`, `/locations`, `/check_ins`, `/challenges`) |
| `FLYNET_MERCHANT_ID` | Payee for payment intents — **required** for live payments |
| `FLYNET_CLIENT_ID` / `_SECRET` | OAuth app credentials |
| `FLYNET_OAUTH_REDIRECT_URI` | Must match the one registered with your app |
| `FLYNET_OAUTH_AUTHORIZE_URL` / `_TOKEN_URL` | OAuth endpoints |
| `FLYNET_OAUTH_SCOPES` | Defaults to `read:profile read:wallets read:user_checkins payments` |
| `TAB_IDLE_MINUTES` | How long a quiet table stays open before it closes and refunds. Default `120`. |

Set all the `FLYNET_*` variables and the login page gains a **Connect with Blackbird**
button (Authorization Code + PKCE). Nothing downstream changes — `getCurrentUser()`
just starts reading `/users/me` instead of the local member store, and payment
intents are created and confirmed against the real API.

---

## A full pass, end to end

1. Sign in as **Miracle** → **Venues** → check in at **FLYBAR — CLOVER**.
2. **Split the bill** → subtotal `186.40`, tip 20%, pick Amara and Kwame, leave one
   seat open → *Open the table*.
3. The live board shows three shares of **74.56 FLY** and a countdown to the idle
   window.
4. Open Kwame's request → it refuses: **3 FLY balance, 71.56 short**.
5. Kwame deposits USDT, swaps it into FLY, and pays. The board updates live.
6. Somebody new arrives through the join link, creates an account, claims the open
   seat and pays their share.
7. Pay the host's share → **Table settled**, with the venue's reward campaign shown.
8. **Activity** holds every movement — deposits, swaps, shares, refunds — and
   **Visits** holds the check-ins behind them.

---

## Layout

```
src/
├── money.ts               BigInt wei helpers — no floats, ever
├── splitBill.ts           the even splitter (remainder on the first share)
├── flynetClient.ts        every Flynet HTTP call, mock + live branches
├── types.ts               Flynet wire types
├── venues.ts              restaurant + location composition
├── price/fly.ts           the live quote: microdollar price, 5s buckets, series
├── auth/                  session cookie, OAuth + PKCE, scrypt passwords, current user
├── users/                 member store, seeded accounts, people graph
├── wallet/service.ts      deposits, wallet creation, USDT ↔ FLY swaps
├── ledger/store.ts        the movement history behind Activity
├── tabs/                  tab domain: types, store, service
├── lib/jsonStore.ts       atomic, queue-serialised JSON persistence under .data/
├── proxy.ts               auth gate for pages (Next 16's middleware convention)
├── components/            AppShell (nav, live price, sign out) + UI primitives
└── app/
    ├── layout.tsx         mounts the shell around every route
    ├── page.tsx           dashboard: balance, check-in, your tables
    ├── login/             sign in, create an account, or connect with Blackbird
    ├── wallet/            fund, create/connect a wallet, swap
    ├── account/           profile, wallet summary, invite link, sign out
    ├── restaurants/       picker + check-in
    ├── split/             open a table
    ├── tabs/[id]/         live board, empty-seat handling, cancel
    ├── pay/[intentId]/    one member's payment request
    ├── join/[code]/       join a table by link or code
    ├── people/            your people: search, connect, split history
    ├── invite/[handle]/   a personal invite, open to signed-out visitors
    ├── activity/          the ledger
    ├── visits/            your attributable check-in history
    ├── how-it-works/      settlement explained, public
    └── api/               route handlers
```

`/login`, `/invite/*` and `/how-it-works` are open to signed-out visitors; everything
else redirects to `/login?next=…`, and `next` is only honoured for same-origin paths.

### Design system

`src/app/globals.css` defines the palette as CSS custom properties in `:root` and a
`prefers-color-scheme: dark` block, mapped into Tailwind v4's `@theme` so utilities
and hand-written classes read the same tokens (`--surface`, `--line`, `--ink`,
`--muted`, `--accent`, `--pending`, `--danger`).

Components use the `@layer components` classes — `.card`, `.btn`, `.chip`, `.input`,
`.eyebrow`, `.divider`, `.tabbar`, `.sheet`, `.skeleton` — rather than ad-hoc utility
soup, so retheming is a one-line token edit and no `dark:` variants are needed. The
layout is built mobile-first: a bottom tab bar below `lg`, a sidebar above it.

Type is self-hosted through the `geist` package rather than `next/font/google`, so the
build never reaches out to a font CDN and the app renders identically offline.

### Money handling

Every amount is a **stringified integer in wei** (`1 FLY = 10^18`). Parsing, tipping,
splitting, swapping and formatting all stay in `BigInt`. `splitBill` gives the
remainder to the first share, and the tests assert the shares always sum back to
**exactly** the total — floating point would silently lose money at this precision.
USD figures are microdollars, and swaps scale between the two inside a single
fraction so no microdollar is truncated on the way through.

### Three implementation notes

- **Mock state is derived, not stored.** Turbopack gives the page bundle and each route
  handler their own copy of a module, so an in-memory `Map` is invisible between them.
  Mock ids are therefore derived from their input, and members, tabs and the ledger
  persist to `.data/*.json`.
- **Cookies are only written from route handlers.** Next.js throws if you mutate them
  during render, so pages treat the check-in cookie as read-only.
- **Nothing ticks inside an effect.** Countdowns and "x minutes ago" read a single
  shared clock store via `useSyncExternalStore`, so server and client agree on the
  first paint and the linter stays honest about it.

---

## Status

Working end to end in mock mode, exercised over HTTP: sign up, fund, swap, check in,
open a table, join by link, pay, cover or close empty seats, cancel with refund, idle
expiry with refund, ledger, and sign out. Live mode is wired for every Flynet function
(`listRestaurants`, `getRestaurantLocations`, `checkIn`, `listChallenges`,
`getMyProfile`, `getWalletBalance`, `listMyCheckIns`, `createPaymentIntent`,
`confirmPaymentIntent`, `cancelPaymentIntent`, `getPaymentIntent`) but has **not** been
exercised against the staging API — that needs real credentials.
