import type { Metadata } from "next";
import { ClearedOtaRecovery } from "./cleared-ota-recovery";
import { OtaDateInputEnhancer } from "../ota-date-input-enhancer";
import { OtaTcInputEnhancer } from "../ota-tc-input-enhancer";
import { OtaTimeInputEnhancer } from "../ota-time-input-enhancer";

export const metadata: Metadata = {
  title: "Cleared OTAs | Advantage Technologies",
  description: "Recovery list for OTAs cleared from the active tracker and all reporting metrics.",
};

export default function ClearedOtasPage() {
  return <>
    <OtaTimeInputEnhancer />
    <OtaDateInputEnhancer />
    <OtaTcInputEnhancer />
    <ClearedOtaRecovery />
  </>;
}
