import type { ReactNode } from "react";

export default function SignalGeographyMapLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        html, body {
          width: 100%;
          height: 100%;
          margin: 0;
          overflow: hidden !important;
          background: transparent !important;
          background-color: transparent !important;
          color-scheme: dark;
        }
        body > * {
          background-color: transparent !important;
        }
      `}</style>
      {children}
    </>
  );
}
