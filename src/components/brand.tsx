import Image from "next/image";
import Link from "next/link";

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Client Compass home">
      <span className="brand-mark"><Image src="/advantage-mark.png" width={36} height={36} alt="" priority /></span>
      <span className="brand-copy">
        <Image className="brand-wordmark" src="/advantage-wordmark-no-a.png" width={160} height={40} alt="Advantage Technologies" priority />
        <span>Client Compass</span>
      </span>
    </Link>
  );
}
