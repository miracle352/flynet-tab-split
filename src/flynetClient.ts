import { createHash } from "node:crypto";
import { DEMO_USERS, findDemoUser } from "./auth/demoUsers";
import type {
  Challenge,
  ChallengeList,
  CheckInList,
  FlynetUser,
  Address,
  CheckIn,
  Location,
  LocationList,
  Money,
  PaidPaymentIntent,
  Pagination,
  PaymentIntent,
  PendingPaymentIntent,
  Restaurant,
  RestaurantList,
  WalletList,
} from "./types";

/**
 * All Flynet HTTP goes through this module. Callers must not fetch
 * Flynet URLs directly.
 *
 * Server-only: reads API_KEY, CLIENT secrets, and MOCK_MODE from
 * process.env. Do not import from client components.
 */

const MOCK_LATENCY_MS = 250;

/**
 * Mock mode serves the bundled fixtures instead of calling Flynet.
 *
 * `MOCK_MODE=true|false` always wins. When it is unset, fall back to
 * mock if no API key is configured — a fresh clone should run rather
 * than 500 on the first request because a gitignored file is missing.
 */
function isMockMode(): boolean {
  const flag = process.env.MOCK_MODE;
  if (flag !== undefined && flag !== "") {
    return flag === "true";
  }
  return !process.env.API_KEY;
}

function apiBaseUrl(): string {
  const base = process.env.API_BASE_URL?.replace(/\/$/, "");
  if (!base) {
    throw new Error("API_BASE_URL is not set");
  }
  return base;
}

function apiKey(): string {
  const key = process.env.API_KEY;
  if (!key) {
    throw new Error("API_KEY is not set");
  }
  return key;
}

function merchantId(): string | undefined {
  return process.env.FLYNET_MERCHANT_ID || undefined;
}

/**
 * Payee for payment intents. Flynet routes FLY to a merchant wallet, so
 * this is the venue-side account the table settles with. Falls back to
 * the mock merchant so `MOCK_MODE=true` works with no credentials.
 */
export function resolveMerchantId(): string {
  return merchantId() ?? MOCK_PAYEE_BALANCE_ID;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mockDelay(): Promise<void> {
  await delay(MOCK_LATENCY_MS);
}

export class FlynetClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown = null,
  ) {
    super(message);
    this.name = "FlynetClientError";
  }
}

type AuthMode = "apiKey" | "oauth";

async function flynetFetch<T>(
  path: string,
  options: {
    method?: string;
    auth: AuthMode;
    accessToken?: string;
    body?: unknown;
  },
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "flynet-tab-split",
  };

  if (options.auth === "apiKey") {
    headers["X-API-Key"] = apiKey();
  } else {
    if (!options.accessToken) {
      throw new Error("OAuth access token required");
    }
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${apiBaseUrl()}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    if (!res.ok) {
      throw new FlynetClientError(
        `Flynet ${res.status} with empty body`,
        res.status,
      );
    }
    return undefined as T;
  }

  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    throw new FlynetClientError(
      `Flynet ${res.status} on ${path}`,
      res.status,
      json,
    );
  }

  return json as T;
}

function requireAccessToken(
  accessToken: string | undefined,
  live: boolean,
): string | undefined {
  if (live && !accessToken) {
    throw new Error("OAuth access token required");
  }
  return accessToken;
}

function paginate<T>(
  items: T[],
  page = 0,
  pageSize = 50,
): { items: T[]; pagination: Pagination } {
  const total_count = items.length;
  const total_pages = Math.ceil(total_count / pageSize) || 0;
  const start = page * pageSize;
  const sliced = items.slice(start, start + pageSize);
  const next_page = start + pageSize < total_count ? page + 1 : null;
  return {
    items: sliced,
    pagination: {
      total_count,
      total_pages,
      current_page: page,
      next_page,
      page_size: pageSize,
    },
  };
}

// --- Mock fixtures (stable IDs so list → locations → check-in composes) ---

const EARLIER = "2024-01-15T20:21:23.253929Z";

const FLYBAR_ID = "2cb56d03-4417-4b60-afe3-be819ecde8ac";
const ANTONS_ID = "14339db3-2e7a-42c4-aa98-4c0fb18679eb";
const CLOVER_LOCATION_ID = "c8d79a1f-6cb8-4e6d-9b58-b2796cd6cdad";
const WILLIAMSBURG_LOCATION_ID = "62521fe6-ce1b-40b3-aceb-013245132ab0";
const WEST_VILLAGE_LOCATION_ID = "c54a3b6a-c31b-49b4-8af1-2dfb70ff3eec";

const MOCK_PAYER_BALANCE_ID = "0b9c2d3e-4f5a-6b7c-8d9e-0a1b2c3d4e5f";
const MOCK_PAYEE_BALANCE_ID = "3f1c6d8e-0f12-4a5b-8c9d-1e2f3a4b5c6d";

const flybar: Restaurant = {
  id: FLYBAR_ID,
  object: "restaurant",
  name: "FLYBAR",
  cuisine: ["Italian"],
  cohort: "qsr",
  price: 3,
  tags: [],
  asset: {
    preview_1x:
      "https://images.blackbird.xyz/rock/1x.png?expire=8782ddb89c",
    web_2x: "https://images.blackbird.xyz/rock/2x.png?expire=8782ddb89c",
    full_3x: "https://images.blackbird.xyz/rock/3x.png?expire=8782ddb89c",
  },
  website_url: "https://barbutonyc.com",
  instagram_url: null,
  created_at: EARLIER,
  updated_at: "2026-06-11T09:00:48.460864Z",
};

const antons: Restaurant = {
  id: ANTONS_ID,
  object: "restaurant",
  name: "Anton's",
  cuisine: ["American"],
  cohort: "fsr",
  price: 3,
  tags: [],
  asset: {
    preview_1x: "https://images.blackbird.xyz/antons/1x.png",
    web_2x: "https://images.blackbird.xyz/antons/2x.png",
    full_3x: "https://images.blackbird.xyz/antons/3x.png",
  },
  website_url: "https://antonsnyc.com",
  instagram_url: null,
  created_at: "2023-10-31T18:07:26.000Z",
  updated_at: "2024-07-08T14:16:58.000Z",
};

const nycAddress = (overrides: Address): Address => ({
  street2: "",
  country: "USA",
  ...overrides,
});

const clover: Location = {
  id: CLOVER_LOCATION_ID,
  object: "location",
  name: "CLOVER",
  restaurant: flybar,
  neighborhood: {
    id: "df7c85e9-907e-41cf-84f2-efb86175e89b",
    object: "neighborhood",
    name: "Astoria",
    region: "New York, NY",
  },
  slug: "flybar-clover",
  address: nycAddress({
    street: "14-01 Broadway",
    city: "Astoria",
    state: "NY",
    zipcode: "11106",
  }),
  coordinate: { latitude: 40.72556, longitude: -73.99513 },
  phone_number: "+19176229717",
  time_zone: "America/New_York",
  payments_enabled: true,
  is_club: false,
  reservation_url: null,
  reservations_enabled: false,
  google_place_id: null,
  created_at: "2026-05-11T17:20:12.798637Z",
  updated_at: "2026-06-09T17:57:08.762073Z",
};

const williamsburg: Location = {
  id: WILLIAMSBURG_LOCATION_ID,
  object: "location",
  name: "FLYBAR — Williamsburg",
  restaurant: flybar,
  neighborhood: {
    id: "9f4b1c20-7e3a-4d18-9c2f-1a5d6b8e0c44",
    object: "neighborhood",
    name: "Williamsburg",
    region: "New York, NY",
  },
  slug: "flybar-williamsburg",
  address: nycAddress({
    street: "570 Bedford Ave",
    city: "Brooklyn",
    state: "NY",
    zipcode: "11211",
  }),
  coordinate: { latitude: 40.7142, longitude: -73.9614 },
  phone_number: "+17185550100",
  time_zone: "America/New_York",
  payments_enabled: true,
  is_club: false,
  reservation_url: null,
  reservations_enabled: false,
  google_place_id: null,
  created_at: "2026-05-11T17:20:12.798637Z",
  updated_at: "2026-06-09T17:57:08.762073Z",
};

const westVillage: Location = {
  id: WEST_VILLAGE_LOCATION_ID,
  object: "location",
  name: "West Village",
  restaurant: antons,
  neighborhood: {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    object: "neighborhood",
    name: "West Village",
    region: "New York, NY",
  },
  slug: "antons-west-village",
  address: nycAddress({
    street: "570 Hudson St",
    city: "New York",
    state: "NY",
    zipcode: "10014",
  }),
  coordinate: { latitude: 40.734, longitude: -74.002 },
  phone_number: "+12125550114",
  time_zone: "America/New_York",
  payments_enabled: true,
  is_club: false,
  reservation_url: null,
  reservations_enabled: false,
  google_place_id: null,
  created_at: "2026-05-11T17:20:12.798637Z",
  updated_at: "2026-06-09T17:57:08.762073Z",
};

const MOCK_RESTAURANTS: Restaurant[] = [flybar, antons];
const MOCK_LOCATIONS: Location[] = [clover, williamsburg, westVillage];

const mockCheckInsByLocation = new Map<string, CheckIn>();
const mockPaymentIntents = new Map<string, PaymentIntent>();
const mockIdempotencyKeys = new Map<string, string>();

function locationById(locationId: string): Location {
  return (
    MOCK_LOCATIONS.find((location) => location.id === locationId) ?? {
      ...clover,
      id: locationId,
      name: clover.name,
      slug: `mock-${locationId.slice(0, 8)}`,
    }
  );
}

/**
 * Deterministic stand-in for `crypto.randomUUID()`.
 *
 * In dev, Turbopack gives the page bundle and each route handler their
 * own instance of this module, so the mock maps below are NOT shared
 * across them — a page render and an API call would otherwise mint two
 * different objects for the same input. Deriving ids from the input
 * keeps every instance in agreement without shared state, and is closer
 * to the live contract (Flynet returns stable ids).
 */
function stableUuid(namespace: string, input: string): string {
  const hex = createHash("sha1").update(`${namespace}:${input}`).digest("hex");
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

/** Stable id + timestamp for a venue's mock check-in. */
function mockCheckInIdentity(locationId: string): {
  id: string;
  created_at: string;
} {
  const offsetMinutes =
    createHash("sha1")
      .update(`flynet-mock-check-in-at:${locationId}`)
      .digest()
      .readUInt16BE(0) % 360;

  // A stable moment near the other fixtures' updated_at values.
  const opened = Date.parse("2026-06-11T18:30:00.000Z");

  return {
    id: stableUuid("flynet-mock-check-in", locationId),
    created_at: new Date(opened + offsetMinutes * 60_000).toISOString(),
  };
}

/**
 * Mock wallets for a specific member, so the insufficient-funds check
 * is meaningful. Without `userId` it falls back to the first demo user.
 */
function mockWallets(userId?: string): WalletList {
  const user = (userId && findDemoUser(userId)) || DEMO_USERS[0];
  return { wallets: user.wallets, balance: user.balance };
}

const MOCK_CHALLENGE: Challenge = {
  id: "c1a2b3c4-d5e6-4f70-8a9b-0c1d2e3f4a5b",
  object: "challenge",
  type: "PAYMENT",
  title: "Pay with Blackbird",
  description: "Settle your table in FLY to earn a reward.",
  image: null,
  threshold: { spend_threshold: { value: "5000", currency: "USD" } },
  fly_reward: { value: "1000000000000000000", currency: "FLY" },
  start_time: null,
  end_time: null,
  terms: ["One reward per member."],
  accepted_currencies: ["USD"],
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
};

export interface ListOptions {
  page?: number;
  page_size?: number;
}

export interface CreatePaymentIntentInput {
  customer_user_id: string;
  amount: Money;
  description: string;
  idempotency_key: string;
  flynet_merchant_id?: string;
  expires_at?: string;
  metadata?: Record<string, unknown> | null;
}

/** GET /restaurants — API key */
export async function listRestaurants(
  options: ListOptions = {},
): Promise<RestaurantList> {
  if (isMockMode()) {
    await mockDelay();
    const { items, pagination } = paginate(
      MOCK_RESTAURANTS,
      options.page ?? 0,
      options.page_size ?? 50,
    );
    return { restaurants: items, pagination };
  }

  const params = new URLSearchParams({
    page: String(options.page ?? 0),
    page_size: String(options.page_size ?? 50),
  });
  return flynetFetch<RestaurantList>(`/restaurants?${params}`, {
    auth: "apiKey",
  });
}

/** GET /restaurants/{id}/locations — API key */
export async function getRestaurantLocations(
  restaurantId: string,
  options: ListOptions = {},
): Promise<LocationList> {
  if (isMockMode()) {
    await mockDelay();
    const matches = MOCK_LOCATIONS.filter(
      (location) => location.restaurant.id === restaurantId,
    );
    const { items, pagination } = paginate(
      matches,
      options.page ?? 0,
      options.page_size ?? 50,
    );
    return { locations: items, pagination };
  }

  const params = new URLSearchParams({
    page: String(options.page ?? 0),
    page_size: String(options.page_size ?? 50),
  });
  return flynetFetch<LocationList>(
    `/restaurants/${restaurantId}/locations?${params}`,
    { auth: "apiKey" },
  );
}

/**
 * Returns a check-in at the given location.
 * Live: GET /check_ins?location={id} (API key, read:checkins).
 * There is no partner POST to create a check-in.
 */
export async function checkIn(locationId: string): Promise<CheckIn> {
  if (isMockMode()) {
    await mockDelay();
    const existing = mockCheckInsByLocation.get(locationId);
    if (existing) {
      return existing;
    }
    const identity = mockCheckInIdentity(locationId);
    const created: CheckIn = {
      ...identity,
      object: "check_in",
      location: locationById(locationId),
      blackbird_pay_enabled: true,
      ended_at: null,
    };
    mockCheckInsByLocation.set(locationId, created);
    return created;
  }

  const params = new URLSearchParams({
    location: locationId,
    page: "0",
    page_size: "1",
  });
  const list = await flynetFetch<{
    check_ins: CheckIn[];
    pagination: Pagination;
  }>(`/check_ins?${params}`, { auth: "apiKey" });

  const checkInRecord = list.check_ins[0];
  if (!checkInRecord) {
    throw new FlynetClientError(
      `No check-in found for location ${locationId}`,
      404,
      list,
    );
  }
  return checkInRecord;
}

/** POST /payment_intents — OAuth bearer */
export async function createPaymentIntent(
  input: CreatePaymentIntentInput,
  accessToken?: string,
): Promise<PendingPaymentIntent> {
  const live = !isMockMode();
  const token = requireAccessToken(accessToken, live);

  if (isMockMode()) {
    await mockDelay();
    const merchant = input.flynet_merchant_id ?? resolveMerchantId();
    const idemKey = `${merchant}:${input.idempotency_key}`;
    const existingId = mockIdempotencyKeys.get(idemKey);
    if (existingId) {
      const existing = mockPaymentIntents.get(existingId);
      if (existing && existing.status === "pending") {
        return existing;
      }
      if (existing) {
        throw new FlynetClientError(
          "Idempotency key already used for a non-pending intent",
          400,
          existing,
        );
      }
    }

    const now = new Date().toISOString();
    const intent: PendingPaymentIntent = {
      id: stableUuid("flynet-mock-payment-intent", idemKey),
      object: "payment_intent",
      payer_account_balance_id: MOCK_PAYER_BALANCE_ID,
      payee_account_balance_id: MOCK_PAYEE_BALANCE_ID,
      amount: input.amount,
      description: input.description,
      status: "pending",
      expires_at: input.expires_at ?? null,
      canceled_at: null,
      paid_at: null,
      refunded_at: null,
      metadata: input.metadata ?? null,
      created_at: now,
      updated_at: now,
    };
    mockPaymentIntents.set(intent.id, intent);
    mockIdempotencyKeys.set(idemKey, intent.id);
    return intent;
  }

  const merchant = input.flynet_merchant_id ?? merchantId();
  if (!merchant) {
    // The docs require this on every create; omitting it 400s upstream.
    throw new Error("FLYNET_MERCHANT_ID is not set");
  }

  const body = {
    flynet_merchant_id: merchant,
    customer_user_id: input.customer_user_id,
    amount: input.amount,
    description: input.description,
    idempotency_key: input.idempotency_key,
    ...(input.expires_at ? { expires_at: input.expires_at } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };

  return flynetFetch<PendingPaymentIntent>("/payment_intents", {
    method: "POST",
    auth: "oauth",
    accessToken: token,
    body,
  });
}

/** POST /payment_intents/{id}/confirm — OAuth bearer */
export async function confirmPaymentIntent(
  paymentIntentId: string,
  userId: string,
  accessToken?: string,
): Promise<PaidPaymentIntent> {
  const live = !isMockMode();
  const token = requireAccessToken(accessToken, live);

  if (isMockMode()) {
    await mockDelay();
    const current = mockPaymentIntents.get(paymentIntentId);
    if (!current) {
      throw new FlynetClientError(
        `Payment intent ${paymentIntentId} not found`,
        404,
      );
    }
    if (current.status === "paid") {
      return current;
    }
    if (current.status !== "pending") {
      throw new FlynetClientError(
        "Intent is not in a confirmable state",
        400,
        current,
      );
    }
    const now = new Date().toISOString();
    const paid: PaidPaymentIntent = {
      ...current,
      status: "paid",
      paid_at: now,
      canceled_at: null,
      refunded_at: null,
      updated_at: now,
    };
    mockPaymentIntents.set(paid.id, paid);
    return paid;
  }

  return flynetFetch<PaidPaymentIntent>(
    `/payment_intents/${paymentIntentId}/confirm`,
    {
      method: "POST",
      auth: "oauth",
      accessToken: token,
      body: { user_id: userId },
    },
  );
}

/** GET /payment_intents/{id} — OAuth bearer */
export async function getPaymentIntent(
  paymentIntentId: string,
  accessToken?: string,
): Promise<PaymentIntent> {
  const live = !isMockMode();
  const token = requireAccessToken(accessToken, live);

  if (isMockMode()) {
    await mockDelay();
    const intent = mockPaymentIntents.get(paymentIntentId);
    if (!intent) {
      throw new FlynetClientError(
        `Payment intent ${paymentIntentId} not found`,
        404,
      );
    }
    return intent;
  }

  return flynetFetch<PaymentIntent>(`/payment_intents/${paymentIntentId}`, {
    auth: "oauth",
    accessToken: token,
  });
}

/** GET /users/me/wallets — OAuth bearer (`read:wallets`) */
export async function getWalletBalance(
  accessToken?: string,
  mockUserId?: string,
): Promise<WalletList> {
  const live = !isMockMode();
  const token = requireAccessToken(accessToken, live);

  if (isMockMode()) {
    await mockDelay();
    return mockWallets(mockUserId);
  }

  return flynetFetch<WalletList>("/users/me/wallets", {
    auth: "oauth",
    accessToken: token,
  });
}

/**
 * GET /users/me/check_ins - OAuth bearer (`read:user_checkins`).
 *
 * This is the attributable check-in feed: the subject comes from the
 * access token. `GET /check_ins` is anonymized and cannot prove who
 * visited, so anything that needs proof of a visit uses this.
 */
export async function listMyCheckIns(
  accessToken?: string,
  mockLocationId?: string,
): Promise<CheckInList> {
  const live = !isMockMode();
  const token = requireAccessToken(accessToken, live);

  if (isMockMode()) {
    await mockDelay();
    // A small deterministic history so the visits screen has something
    // real to render. The member's current venue comes first.
    const history: CheckIn[] = [];
    if (mockLocationId) {
      history.push(await checkIn(mockLocationId));
    }
    const past: [string, number][] = [
      [WILLIAMSBURG_LOCATION_ID, 3],
      [WEST_VILLAGE_LOCATION_ID, 11],
      [CLOVER_LOCATION_ID, 26],
    ];
    for (const [locationId, daysAgo] of past) {
      if (locationId === mockLocationId) {
        continue;
      }
      const base = await checkIn(locationId);
      history.push({
        ...base,
        created_at: new Date(
          Date.now() - daysAgo * 86_400_000,
        ).toISOString(),
        ended_at: new Date(
          Date.now() - daysAgo * 86_400_000 + 5_400_000,
        ).toISOString(),
      });
    }
    history.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return {
      check_ins: history,
      pagination: {
        ...emptyPagination(),
        total_count: history.length,
        total_pages: 1,
      },
    };
  }

  const params = new URLSearchParams({ page: "0", page_size: "25" });
  return flynetFetch<CheckInList>(`/users/me/check_ins?${params}`, {
    auth: "oauth",
    accessToken: token,
  });
}

/** GET /challenges?restaurant={id} - API key (`read:restaurant_challenges`). */
export async function listChallenges(
  restaurantId: string,
  options: ListOptions = {},
): Promise<ChallengeList> {
  if (isMockMode()) {
    await mockDelay();
    return {
      challenges: [MOCK_CHALLENGE],
      pagination: { ...emptyPagination(), total_count: 1, total_pages: 1 },
    };
  }

  const params = new URLSearchParams({
    restaurant: restaurantId,
    page: String(options.page ?? 0),
    page_size: String(options.page_size ?? 50),
  });
  return flynetFetch<ChallengeList>(`/challenges?${params}`, { auth: "apiKey" });
}

function emptyPagination(): Pagination {
  return {
    total_count: 0,
    total_pages: 0,
    current_page: 0,
    next_page: null,
    page_size: 50,
  };
}

/** GET /users/me — OAuth bearer (`read:profile`). */
export async function getMyProfile(accessToken?: string): Promise<FlynetUser> {
  const live = !isMockMode();
  const token = requireAccessToken(accessToken, live);

  if (isMockMode()) {
    await mockDelay();
    const user = DEMO_USERS[0];
    return {
      id: user.id,
      object: "user",
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
    };
  }

  return flynetFetch<FlynetUser>("/users/me", { auth: "oauth", accessToken: token });
}

/**
 * GET /users/me + GET /users/me/wallets merged into the app's
 * `CurrentUser` shape, so nothing downstream changes between mock and
 * live.
 */
export async function fetchLiveCurrentUser(
  accessToken: string,
): Promise<import("./auth/types").CurrentUser> {
  const [profile, wallets] = await Promise.all([
    getMyProfile(accessToken),
    getWalletBalance(accessToken),
  ]);
  return {
    id: profile.id,
    object: "user",
    first_name: profile.first_name,
    last_name: profile.last_name,
    email: profile.email ?? "",
    wallets: wallets.wallets,
    balance: wallets.balance,
  };
}
