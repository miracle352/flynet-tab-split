import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/currentUser";
import { getMember } from "@/users/store";
import { depositAddresses } from "@/wallet/service";
import { WalletConsole, type WalletTab } from "./WalletConsole";

export const metadata: Metadata = {
  title: "Wallet",
  description: "Fund FLY or USDT, swap between them, and manage your wallet.",
};

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/wallet");
  }

  const { tab } = await searchParams;
  const requested = Array.isArray(tab) ? tab[0] : tab;
  const initialTab: WalletTab =
    requested === "swap" || requested === "wallet" ? requested : "fund";

  const member = await getMember(user.id);
  const addresses = member ? depositAddresses(member) : null;

  if (!addresses) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-7">
      <header className="rise">
        <p className="eyebrow">Funds</p>
        <h1 className="display mt-1.5">Wallet</h1>
        <p className="mt-2 max-w-2xl text-[0.875rem] leading-6 text-[var(--muted)]">
          Hold FLY and USDT, move between them at the live rate, and settle your
          share of any table straight to the venue.
        </p>
      </header>

      <WalletConsole initialTab={initialTab} addresses={addresses} />
    </div>
  );
}
