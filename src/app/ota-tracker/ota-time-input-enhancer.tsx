"use client";

import { useEffect } from "react";

const STANDARD_HOURS = Array.from({ length: 13 }, (_, index) => index + 6); // 6 AM through 6 PM
const OTHER_HOURS = [...Array.from({ length: 6 }, (_, index) => index), ...Array.from({ length: 5 }, (_, index) => index + 19)];
const STANDARD_MINUTES = ["00", "15", "30", "45"];

type MountedPicker = {
  wrapper: HTMLDivElement;
  hourSelect: HTMLSelectElement;
  minuteSelect: HTMLSelectElement;
  sync: () => void;
};

function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12} ${suffix}`;
}

function setNativeTimeValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function styleSelect(select: HTMLSelectElement, width: string) {
  select.style.width = width;
  select.style.height = "34px";
  select.style.padding = "0 8px";
  select.style.color = "#dce9e7";
  select.style.border = "1px solid rgba(160, 203, 194, .18)";
  select.style.borderRadius = "8px";
  select.style.background = "#09171e";
  select.style.font = "inherit";
  select.style.fontSize = "12px";
  select.style.fontWeight = "700";
  select.style.outline = "none";
}

export function OtaTimeInputEnhancer() {
  useEffect(() => {
    const mounted = new Map<HTMLInputElement, MountedPicker>();

    const enhance = (input: HTMLInputElement) => {
      if (mounted.has(input)) return;

      const wrapper = document.createElement("div");
      wrapper.dataset.otaTimePicker = "true";
      wrapper.style.display = "flex";
      wrapper.style.alignItems = "center";
      wrapper.style.gap = "6px";
      wrapper.style.width = "fit-content";
      wrapper.style.maxWidth = "100%";

      const hourSelect = document.createElement("select");
      hourSelect.setAttribute("aria-label", "OTA hour");
      styleSelect(hourSelect, "92px");

      const blankHour = document.createElement("option");
      blankHour.value = "";
      blankHour.textContent = "Hour";
      hourSelect.append(blankHour);

      const standardGroup = document.createElement("optgroup");
      standardGroup.label = "6 AM – 6 PM";
      for (const hour of STANDARD_HOURS) {
        const option = document.createElement("option");
        option.value = String(hour);
        option.textContent = hourLabel(hour);
        standardGroup.append(option);
      }
      hourSelect.append(standardGroup);

      const otherGroup = document.createElement("optgroup");
      otherGroup.label = "Other hours";
      for (const hour of OTHER_HOURS) {
        const option = document.createElement("option");
        option.value = String(hour);
        option.textContent = hourLabel(hour);
        otherGroup.append(option);
      }
      hourSelect.append(otherGroup);

      const minuteSelect = document.createElement("select");
      minuteSelect.setAttribute("aria-label", "OTA minutes");
      styleSelect(minuteSelect, "68px");

      const blankMinute = document.createElement("option");
      blankMinute.value = "";
      blankMinute.textContent = "Min";
      minuteSelect.append(blankMinute);
      for (const minute of STANDARD_MINUTES) {
        const option = document.createElement("option");
        option.value = minute;
        option.textContent = `:${minute}`;
        minuteSelect.append(option);
      }

      wrapper.append(hourSelect, minuteSelect);
      input.insertAdjacentElement("afterend", wrapper);
      input.style.display = "none";

      const ensureHistoricalMinute = (minute: string) => {
        const existing = minuteSelect.querySelector<HTMLOptionElement>('option[data-historical="true"]');
        if (existing && existing.value !== minute) existing.remove();
        if (!minute || STANDARD_MINUTES.includes(minute) || minuteSelect.querySelector(`option[value="${minute}"]`)) return;
        const option = document.createElement("option");
        option.value = minute;
        option.textContent = `:${minute}`;
        option.dataset.historical = "true";
        minuteSelect.insertBefore(option, minuteSelect.children[1] || null);
      };

      const sync = () => {
        const match = input.value.match(/^(\d{2}):(\d{2})/);
        if (!match) {
          if (document.activeElement !== hourSelect) hourSelect.value = "";
          if (document.activeElement !== minuteSelect) minuteSelect.value = "";
          minuteSelect.disabled = !hourSelect.value;
          return;
        }
        const hour = String(Number(match[1]));
        const minute = match[2];
        ensureHistoricalMinute(minute);
        if (document.activeElement !== hourSelect) hourSelect.value = hour;
        if (document.activeElement !== minuteSelect) minuteSelect.value = minute;
        minuteSelect.disabled = false;
      };

      const commit = () => {
        if (!hourSelect.value) {
          minuteSelect.value = "";
          minuteSelect.disabled = true;
          setNativeTimeValue(input, "");
          return;
        }
        if (!minuteSelect.value) minuteSelect.value = "00";
        minuteSelect.disabled = false;
        setNativeTimeValue(input, `${String(Number(hourSelect.value)).padStart(2, "0")}:${minuteSelect.value}`);
      };

      hourSelect.addEventListener("change", commit);
      minuteSelect.addEventListener("change", commit);
      sync();
      mounted.set(input, { wrapper, hourSelect, minuteSelect, sync });
    };

    const scan = () => {
      document.querySelectorAll<HTMLInputElement>('main input[type="time"]').forEach(enhance);
      for (const [input, picker] of mounted) {
        if (!document.contains(input)) {
          picker.wrapper.remove();
          mounted.delete(input);
        }
      }
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(() => {
      scan();
      for (const picker of mounted.values()) picker.sync();
    }, 250);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      for (const [input, picker] of mounted) {
        picker.wrapper.remove();
        input.style.removeProperty("display");
      }
      mounted.clear();
    };
  }, []);

  return null;
}
