import Image from "next/image";
import Link from "next/link";

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Proposal and Report Generator home">
      <span className="brand-mark"><Image src="/advantage-mark.png" width={36} height={36} alt="" priority /></span>
      <span className="brand-copy">
        <Image className="brand-wordmark" src="/advantage-wordmark.png" width={190} height={39} alt="Advantage Technologies" priority />
        <span>Proposal &amp; Report Generator</span>
      </span>
    </Link>
  );
}
