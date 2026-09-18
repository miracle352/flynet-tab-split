/**
 * Flynet API response types.
 *
 * Field names and shapes follow the published OpenAPI schemas and
 * docs examples (https://docs.flynet.org/llms-full.txt,
 * https://docs.flynet.org/api-reference/openapi.yaml). Keep these
 * identical to the live wire format so mocks swap out with no changes.
 */

export interface Pagination {
  total_count: number;
  total_pages: number;
  current_page: number;
  next_page: number | null;
  page_size: number;
}

/** `{ value, currency }` — FLY amounts are wei strings, never floats. */
export interface Money {
  value: string;
  currency: "FLY";
}

export interface RestaurantAsset {
  preview_1x: string | null;
  web_2x: string | null;
  full_3x: string | null;
}

export interface Restaurant {
  id: string;
  object: "restaurant";
  name: string;
  cuisine: string[];
  cohort: string | null;
  price: number | null;
  tags: Record<string, unknown>[];
  asset: RestaurantAsset | null;
  website_url: string | null;
  instagram_url: string | null;
  created_at: string;
  updated_at: string;
}

/** GET /restaurants */
export interface RestaurantList {
  restaurants: Restaurant[];
  pagination: Pagination;
}

export interface Neighborhood {
  id?: string;
  object?: "neighborhood";
  name: string;
  region: string;
}

export interface Address {
  street?: string;
  street2?: string | null;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
}

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface Location {
  id: string;
  object: "location";
  name: string | null;
  restaurant: Restaurant;
  neighborhood: Neighborhood;
  slug?: string;
  address: Address;
  coordinate?: Coordinate | null;
  phone_number?: string | null;
  time_zone: string;
  payments_enabled: boolean;
  is_club: boolean;
  reservations_enabled: boolean;
  reservation_url?: string | null;
  google_place_id?: string | null;
  created_at: string;
  updated_at: string;
}

/** GET /locations */
export interface LocationList {
  locations: Location[];
  pagination: Pagination;
}

/**
 * Check-in object (GET /check_ins/{id}, items in GET /check_ins).
 * No user field — the venue feed is anonymized.
 */
export interface CheckIn {
  id: string;
  object: "check_in";
  location: Location;
  blackbird_pay_enabled: boolean;
  created_at: string;
  ended_at: string | null;
}

export type PaymentIntentStatus =
  | "pending"
  | "paid"
  | "canceled"
  | "refunded"
  | "expired";

export interface PaymentIntentBase {
  id: string;
  object: "payment_intent";
  payer_account_balance_id: string;
  payee_account_balance_id: string;
  amount: Money;
  description: string;
  expires_at: string | null;
  canceled_at: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface PendingPaymentIntent extends PaymentIntentBase {
  status: "pending";
  paid_at: null;
  canceled_at: null;
  refunded_at: null;
}

export interface PaidPaymentIntent extends PaymentIntentBase {
  status: "paid";
  paid_at: string;
  canceled_at: null;
  refunded_at: null;
}

export interface CanceledPaymentIntent extends PaymentIntentBase {
  status: "canceled";
  canceled_at: string;
  paid_at: null;
  refunded_at: null;
}

export interface RefundedPaymentIntent extends PaymentIntentBase {
  status: "refunded";
  paid_at: string;
  refunded_at: string;
}

export interface ExpiredPaymentIntent extends PaymentIntentBase {
  status: "expired";
  paid_at: null;
  refunded_at: null;
}

export type PaymentIntent =
  | PendingPaymentIntent
  | PaidPaymentIntent
  | CanceledPaymentIntent
  | RefundedPaymentIntent
  | ExpiredPaymentIntent;

export type WalletType = "MEMBERSHIP" | "SPENDING";

export interface Wallet {
  id: string;
  object: "user_wallet";
  wallet_type: WalletType;
  address: string;
  created_at: string;
  updated_at: string;
}

/** Owner-level aggregate FLY balance (not per-wallet). */
export interface AccountBalance {
  id: string;
  object: "account_balance";
  owner_id: string;
  owner_type: "user" | "flynet_merchant";
  balance: {
    value: string;
    currency: "fly";
  };
  balance_usd: {
    value: number;
    currency: "usd";
  };
}

/**
 * GET /users/me/wallets
 *
 * Markdown examples show `{ wallets: [...] }` only. OpenAPI requires
 * `balance` as well — include it so the mock matches the live contract.
 */
export interface WalletList {
  wallets: Wallet[];
  balance: AccountBalance;
}

/** GET /users/me/check_ins */
export interface CheckInList {
  check_ins: CheckIn[];
  pagination: Pagination;
}

export type ChallengeType = "PAYMENT" | "REFERRALS" | "DINES" | "PASSPORT";

/**
 * GET /challenges — a restaurant's reward campaign. Money fields are
 * wei strings; the docs warn currency casing is not guaranteed.
 */
export interface Challenge {
  id: string;
  object: "challenge";
  type: ChallengeType;
  title: string;
  description: string;
  image: string | null;
  threshold: {
    spend_threshold?: { value: string; currency: string };
    dine_threshold?: number;
    referral_threshold?: number;
    minimum_spend?: { value: string; currency: string };
  };
  fly_reward: { value: string; currency: string };
  start_time: string | null;
  end_time: string | null;
  terms: string[];
  accepted_currencies: string[];
  created_at: string;
  updated_at: string;
}

/** GET /challenges */
export interface ChallengeList {
  challenges: Challenge[];
  pagination: Pagination;
}

/** GET /users/me */
export interface FlynetUser {
  id: string;
  object: "user";
  first_name: string;
  last_name: string;
  email: string | null;
  created_at?: string;
  updated_at?: string;
}
