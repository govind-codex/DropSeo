import Link from "next/link";

export function Logo() {
  return (
    <Link className="brand shrink-0" href="/" aria-label="AudiFox home">
      <span className="brand-mark" aria-hidden="true">
        <img src="/audifox-logo.png" alt="" width="40" height="40" />
      </span>
      AudiFox<span>.</span>
    </Link>
  );
}
