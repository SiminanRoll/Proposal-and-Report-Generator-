/**
 * Client-facing Hardware Inventory narrative for presentation and export.
 * Physical replacement-age totals deliberately exclude virtual machines.
 */
export interface HardwareInventoryNarrativeInput {
  totalAssets: number;
  physicalAssets: number;
  virtualAssets: number;
  healthyNow: number;
  planSoon: number;
  replaceNow: number;
  ageToVerify: number;
  osAttention: number;
  storageAttention: number;
  storageReported: number;
}
export interface HardwareInventoryNarrative {
  title: string;
  subtitle: string;
}
function countDevices(n: number): string {
  return n + " device" + (n === 1 ? "" : "s");
}
export function hardwareInventoryNarrative(input: HardwareInventoryNarrativeInput): HardwareInventoryNarrative {
  const {
    totalAssets, physicalAssets, virtualAssets, healthyNow, planSoon, replaceNow,
    ageToVerify, osAttention, storageAttention, storageReported,
  } = input;
  const title = "Hardware health & replacement priorities";
  if (!totalAssets) {
    return { title, subtitle: "A detailed hardware inventory is not yet available. Confirm device ages and support status before making replacement recommendations." };
  }
  const sentences: string[] = [];
  if (physicalAssets > 0) {
    if (replaceNow > 0) {
      sentences.push(replaceNow + " of " + physicalAssets + " physical devices " + (replaceNow === 1 ? "is" : "are") + " at or beyond the recommended replacement age.");
    }
    if (planSoon > 0) {
      sentences.push(planSoon + " additional " + (planSoon === 1 ? "device is" : "devices are") + " approaching the replacement planning window.");
    }
    if (!replaceNow && !planSoon) {
      sentences.push(healthyNow > 0
        ? healthyNow + " of " + physicalAssets + " physical devices " + (healthyNow === 1 ? "is" : "are") + " within the recommended equipment-age range."
        : "Equipment-age status for " + countDevices(physicalAssets) + " still needs to be confirmed.");
    }
    if (ageToVerify > 0) {
      sentences.push("The age of " + ageToVerify + " physical " + (ageToVerify === 1 ? "device" : "devices") + " still needs verification.");
    }
  }
  if (osAttention > 0) {
    sentences.push(countDevices(osAttention) + " " + (osAttention === 1 ? "has" : "have") + " operating-system support concerns that warrant review.");
  }
  if (storageAttention > 0) {
    sentences.push(countDevices(storageAttention) + " " + (storageAttention === 1 ? "needs" : "need") + " storage-capacity attention.");
  } else if (storageReported > 0) {
    sentences.push("Reported storage capacity shows no current concerns.");
  }
  if (virtualAssets > 0) {
    sentences.push(virtualAssets + " virtual " + (virtualAssets === 1 ? "machine is" : "machines are") + " included in the " + totalAssets + "-asset inventory; hardware replacement timing follows " + (virtualAssets === 1 ? "its" : "their") + " physical host.");
  }
  if (!sentences.length) {
    sentences.push("The inventory includes " + countDevices(totalAssets) + ". Replacement and support status should be confirmed against current equipment data.");
  }
  return { title, subtitle: sentences.join(" ") };
}
