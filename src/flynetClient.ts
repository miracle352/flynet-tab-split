import type {
  AccountBalance,
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
  Wallet,
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

function isMockMode(): boolean {
  return process.env.MOCK_MODE === "true";
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
const MOCK_OWNER_ID = "be9caffa-7f30-462a-b7ab-9cca9edb8ab8";

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

function mockWallets(): WalletList {
  const created = "2026-05-11T20:21:07.812609Z";
  const wallets: Wallet[] = [
    {
      id: "726182e2-865d-4660-b07d-c58e47f482d6",
      object: "user_wallet",
      wallet_type: "MEMBERSHIP",
      address: "0xaF8A2609EEaf253838E90353881987d8218c8056",
      created_at: created,
      updated_at: "2026-05-11T20:21:07.812621Z",
    },
    {
      id: "1a11f75b-f893-4eb2-976b-0b35a9ffd410",
      object: "user_wallet",
      wallet_type: "SPENDING",
      address: "0x0DC3837d4Ec7732733fD72736279B365DbC10229",
      created_at: "2026-05-11T20:21:07.824437Z",
      updated_at: "2026-05-11T20:21:07.824449Z",
    },
  ];
  const balance: AccountBalance = {
    id: MOCK_PAYER_BALANCE_ID,
    object: "account_balance",
    owner_id: MOCK_OWNER_ID,
    owner_type: "user",
    balance: { value: "500250000000000000000", currency: "fly" },
    balance_usd: { value: 500, currency: "usd" },
  };
  return { wallets, balance };
}

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
    const created: CheckIn = {
      id: crypto.randomUUID(),
      object: "check_in",
      location: locationById(locationId),
      blackbird_pay_enabled: true,
      created_at: new Date().toISOString(),
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
    const merchant = input.flynet_merchant_id ?? merchantId() ?? MOCK_PAYEE_BALANCE_ID;
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
      id: crypto.randomUUID(),
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

  const body = {
    flynet_merchant_id: input.flynet_merchant_id ?? merchantId(),
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
): Promise<WalletList> {
  const live = !isMockMode();
  const token = requireAccessToken(accessToken, live);

  if (isMockMode()) {
    await mockDelay();
    return mockWallets();
  }

  return flynetFetch<WalletList>("/users/me/wallets", {
    auth: "oauth",
    accessToken: token,
  });
}
