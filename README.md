# Flynet Tab Split

**Splitting a restaurant bill, settled in $FLY — anchored to a real check-in.**

Splitting a check is still awkward. You either do cash maths at the table or fire off
five disconnected Venmo requests afterwards. This settles the bill **at the table,
in the currency the restaurant already accepts**, and ties the whole thing to a
verifiable visit.

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
intent per seat, before anyone pays.** Stated on the home page and in the footer
of every screen.

**2. The public check-in feed is anonymized.** `GET /check_ins` records carry no
user field, and its `user` filter was removed — passing it is silently ignored and
returns the full unfiltered set. The attributable feed is `GET /users/me/check_ins`,
where the subject comes from the access token. That is what `/visits` reads.

**3. No social graph.** No friends list and no lookup by email or handle, so
guests are either picked explicitly by the host or arrive through a shareable
invite link. Nobody can be added to a bill without their own wallet.

---

## The flow

1. **Check in** at a venue (`/restaurants`).
2. **Open a table** (`/split`) — enter subtotal and tip, pick who's splitting, even or custom.
3. **One payment intent per person** is created immediately, each with a unique id.
4. **Friends pay their share** at `/pay/{intentId}` — a direct link to their own request.
5. **Live status** (`/tabs/{id}`) polls and flips to **settled** when the last share lands.

Because Flynet has **no friends/social API**, guests are either picked explicitly by
the host (demo members) or arrive via a **shareable invite link** and authenticate
themselves. Nobody can be added to a bill without their own wallet.

---

## Running it

```bash
npm ci
npm run dev        # http://localhost:3000
```

That's it. With no credentials present the app runs in **mock mode** against the
bundled fixtures in `src/flynetClient.ts` — a fresh clone works, no env file needed.

```bash
npm test           # unit tests (share math, PKCE)
npm run lint
```

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

Set all the `FLYNET_*` variables and the login page gains a **Connect with Blackbird**
button (Authorization Code + PKCE). Nothing downstream changes — `getCurrentUser()`
just starts reading `/users/me` instead of the fixture.

---

## Demo script

1. Log in as **Miracle** → Pick a venue → check in at **FLYBAR — CLOVER**.
2. **Split the bill** → subtotal `186.40`, tip 20%, tick Friend A and Friend B → *Request 3 payments*.
3. You land on the live table: three pending shares of **74.56 FLY** each.
4. Open **Friend B's** `/pay/...` link → it refuses: *3 FLY balance, 27 FLY short*.
   (Friend B is deliberately poor to show the insufficient-funds path.)
5. Log in as **Friend A** → Pay → the host's board updates live.
6. Pay the host's share → **Table settled**, with the venue's reward campaign shown.

---

## Layout

```
src/
├── money.ts               BigInt wei helpers — no floats, ever
├── splitBill.ts           the even splitter (remainder on the first share)
├── flynetClient.ts        every Flynet HTTP call, mock + live branches
├── types.ts               Flynet wire types
├── venues.ts              restaurant + location composition
├── auth/                  session cookie, OAuth + PKCE, current user
├── tabs/                  tab domain: types, store, service
├── components/            AppShell (nav, balance, sign out) + UI primitives
└── app/
    ├── layout.tsx         mounts the shell around every route
    ├── page.tsx           dashboard: balance, check-in, your tables
    ├── restaurants/       picker + check-in
    ├── split/             open a table
    ├── tabs/[id]/         live status + settled screen
    ├── pay/[intentId]/    one member's payment request
    ├── join/[code]/       invite link
    ├── visits/            your attributable check-in history
    └── api/               route handlers
```

### Design system

`src/app/globals.css` defines the palette as CSS custom properties in `:root` and a
`prefers-color-scheme: dark` block, mapped into Tailwind v4's `@theme` so utilities
and hand-written classes read the same tokens (`--surface`, `--line`, `--ink`,
`--muted`, `--accent`, `--pending`, `--danger`).

Components use the `@layer components` classes — `.card`, `.btn`, `.chip`, `.input`,
`.eyebrow`, `.divider`, `.skeleton` — rather than ad-hoc utility soup, so retheming
is a one-line token edit and no `dark:` variants are needed. `--font-sans` carries a
real system fallback stack, because Geist cannot be fetched in a sandboxed
environment and body text otherwise degrades to Arial.

### Money handling

Every amount is a **stringified integer in wei** (`1 FLY = 10^18`). Parsing, tipping,
splitting and formatting all stay in `BigInt`. `splitBill` gives the remainder to the
first share, and the tests assert the shares always sum back to **exactly** the total —
floating point would silently lose money at this precision.

### Two implementation notes

- **Mock state is derived, not stored.** Turbopack gives the page bundle and each route
  handler their own copy of a module, so an in-memory `Map` is invisible between them.
  Mock ids are therefore derived from their input, and tabs persist to `.data/tabs.json`.
- **Cookies are only written from route handlers.** Next.js throws if you mutate them
  during render, so pages treat the check-in cookie as read-only.

---

## Status

Working end to end in mock mode. Live mode is wired for every Flynet function
(`listRestaurants`, `getRestaurantLocations`, `checkIn`, `listChallenges`,
`getMyProfile`, `getWalletBalance`, `listMyCheckIns`, `createPaymentIntent`,
`confirmPaymentIntent`, `getPaymentIntent`) but has **not** been exercised against the
staging API — that needs real credentials.
