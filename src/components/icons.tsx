import type { SVGProps } from "react";

/**
 * The icon set. Hand-drawn paths at a 24px grid, stroke-based so they
 * inherit `currentColor` and read the same at 16px and 28px.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
      <path d="M9.5 20.5v-6h5v6" />
    </Icon>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21s6.5-5.4 6.5-10.2A6.5 6.5 0 0 0 5.5 10.8C5.5 15.6 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2.4" />
    </Icon>
  );
}

export function ReceiptIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 3.5h12v17l-2.2-1.5-2.2 1.5-2.2-1.5L9.2 20.5 7 19l-1 1.5z" />
      <path d="M9 8.5h6M9 12.5h4" />
    </Icon>
  );
}

export function PeopleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16.5 6.6a3 3 0 0 1 0 5.8M17.5 14.9c2 .6 3.3 2.3 3.3 4.6" />
    </Icon>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 8.5A2.5 2.5 0 0 1 6 6h11.5A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20H6a2.5 2.5 0 0 1-2.5-2.5z" />
      <path d="M3.5 9.5h13a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-13" />
      <circle cx="16.4" cy="13" r="0.9" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function SwapIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 8.5h13l-3.2-3.2M20 15.5H7l3.2 3.2" />
    </Icon>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4.5v15M6.5 14 12 19.5 17.5 14" />
    </Icon>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 19.5v-15M6.5 10 12 4.5 17.5 10" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 12h15M14 6.5 19.5 12 14 17.5" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12.8 9.6 17.4 19 7.6" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.6V12l3 1.9" />
    </Icon>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.4" />
      <path d="M15.5 5.5H7a2 2 0 0 0-2 2v8.5" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.6 15.6 4 4" />
    </Icon>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14.5 4.5H7A2 2 0 0 0 5 6.5v11a2 2 0 0 0 2 2h7.5" />
      <path d="M16 8.5 19.5 12 16 15.5M10.5 12h9" />
    </Icon>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 11v5.2M12 8.1h.01" />
    </Icon>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10.2 13.8a3.6 3.6 0 0 0 5.2 0l2.6-2.6a3.7 3.7 0 0 0-5.2-5.2l-1.3 1.3" />
      <path d="M13.8 10.2a3.6 3.6 0 0 0-5.2 0L6 12.8a3.7 3.7 0 0 0 5.2 5.2l1.3-1.3" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function XIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
    </Icon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 19 6v6c0 4-3 7-7 8.5-4-1.5-7-4.5-7-8.5V6z" />
      <path d="m9.2 12 2 2 3.6-3.8" />
    </Icon>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4.2 13.7 9l4.8 1.7-4.8 1.7L12 17.2 10.3 12.4 5.5 10.7 10.3 9z" />
      <path d="M18.4 16.2 19.2 18l1.8.8-1.8.8-.8 1.8-.8-1.8-1.8-.8 1.8-.8z" />
    </Icon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8.6" r="3.4" />
      <path d="M5.5 19.5c0-3.3 2.9-5.4 6.5-5.4s6.5 2.1 6.5 5.4" />
    </Icon>
  );
}

export function QrIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="4" width="6" height="6" rx="1.4" />
      <rect x="14" y="4" width="6" height="6" rx="1.4" />
      <rect x="4" y="14" width="6" height="6" rx="1.4" />
      <path d="M14 14h2.5v2.5H14zM19.5 14H20v.5M14 19.5h2.5V20M19.5 19.5H20V20" />
    </Icon>
  );
}

export function TableIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 9.5h16M6.5 9.5 8 19.5M17.5 9.5 16 19.5" />
      <path d="M3.5 6.5h17a1 1 0 0 1 1 1v1.2a.8.8 0 0 1-.8.8H3.3a.8.8 0 0 1-.8-.8V7.5a1 1 0 0 1 1-1Z" />
    </Icon>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9.5 6 6 6-6 6" />
    </Icon>
  );
}

export function GiftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="9.5" width="16" height="10.5" rx="2" />
      <path d="M4 13.5h16M12 9.5v10.5" />
      <path d="M12 9.5S10.8 5 8.6 5a2 2 0 0 0 0 4.5zM12 9.5S13.2 5 15.4 5a2 2 0 0 1 0 4.5z" />
    </Icon>
  );
}
