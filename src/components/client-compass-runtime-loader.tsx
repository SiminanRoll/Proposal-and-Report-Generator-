"use client";

import dynamic from "next/dynamic";

const BrowserClientCompassRuntime = dynamic(
  () => import("./client-compass-runtime").then((module) => module.ClientCompassRuntime),
  { ssr: false },
);

export function ClientCompassRuntimeLoader() {
  return <BrowserClientCompassRuntime />;
}
