import type { CurrentUser } from "./types";

const CREATED_AT = "2026-05-11T20:21:07.812609Z";

export const DEMO_USERS: CurrentUser[] = [
  {
    id: "be9caffa-7f30-462a-b7ab-9cca9edb8ab8",
    object: "user",
    first_name: "Miracle",
    last_name: "Iyanuoluwa",
    email: "miracle@example.com",
    wallets: [
      {
        id: "726182e2-865d-4660-b07d-c58e47f482d6",
        object: "user_wallet",
        wallet_type: "MEMBERSHIP",
        address: "0xaF8A2609EEaf253838E90353881987d8218c8056",
        created_at: CREATED_AT,
        updated_at: CREATED_AT,
      },
      {
        id: "1a11f75b-f893-4eb2-976b-0b35a9ffd410",
        object: "user_wallet",
        wallet_type: "SPENDING",
        address: "0x0DC3837d4Ec7732733fD72736279B365DbC10229",
        created_at: CREATED_AT,
        updated_at: CREATED_AT,
      },
    ],
    balance: {
      id: "0b9c2d3e-4f5a-6b7c-8d9e-0a1b2c3d4e5f",
      object: "account_balance",
      owner_id: "be9caffa-7f30-462a-b7ab-9cca9edb8ab8",
      owner_type: "user",
      balance: { value: "12000000000000000000", currency: "fly" },
      balance_usd: { value: 1200, currency: "usd" },
    },
  },
  {
    id: "6e2c4a91-3b7d-4f18-9c0a-1d5e8f2b4a70",
    object: "user",
    first_name: "Friend",
    last_name: "A",
    email: "friend-a@example.com",
    wallets: [
      {
        id: "a11c0001-0000-4000-8000-0000000000a1",
        object: "user_wallet",
        wallet_type: "MEMBERSHIP",
        address: "0x6441FCaBB1bA6b26301e04beC1147E0fF2ee239b",
        created_at: CREATED_AT,
        updated_at: CREATED_AT,
      },
      {
        id: "a11c0002-0000-4000-8000-0000000000a2",
        object: "user_wallet",
        wallet_type: "SPENDING",
        address: "0xecb241bA29D219a753E37bEE253236e2Fbd1Fa45",
        created_at: CREATED_AT,
        updated_at: CREATED_AT,
      },
    ],
    balance: {
      id: "a11c0003-0000-4000-8000-0000000000a3",
      object: "account_balance",
      owner_id: "6e2c4a91-3b7d-4f18-9c0a-1d5e8f2b4a70",
      owner_type: "user",
      balance: { value: "5000000000000000000", currency: "fly" },
      balance_usd: { value: 500, currency: "usd" },
    },
  },
  {
    id: "9c8b7a65-4d3e-4210-8f9a-0b1c2d3e4f50",
    object: "user",
    first_name: "Friend",
    last_name: "B",
    email: "friend-b@example.com",
    wallets: [
      {
        id: "b11c0001-0000-4000-8000-0000000000b1",
        object: "user_wallet",
        wallet_type: "MEMBERSHIP",
        address: "0x1111111111111111111111111111111111111111",
        created_at: CREATED_AT,
        updated_at: CREATED_AT,
      },
      {
        id: "b11c0002-0000-4000-8000-0000000000b2",
        object: "user_wallet",
        wallet_type: "SPENDING",
        address: "0x2222222222222222222222222222222222222222",
        created_at: CREATED_AT,
        updated_at: CREATED_AT,
      },
    ],
    balance: {
      id: "b11c0003-0000-4000-8000-0000000000b3",
      object: "account_balance",
      owner_id: "9c8b7a65-4d3e-4210-8f9a-0b1c2d3e4f50",
      owner_type: "user",
      balance: { value: "1500000000000000000", currency: "fly" },
      balance_usd: { value: 150, currency: "usd" },
    },
  },
];

export function findDemoUser(userId: string): CurrentUser | undefined {
  return DEMO_USERS.find((user) => user.id === userId);
}

export function displayName(user: Pick<CurrentUser, "first_name" | "last_name">): string {
  return `${user.first_name} ${user.last_name}`.trim();
}
