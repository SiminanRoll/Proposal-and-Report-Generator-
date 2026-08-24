"use client";

import { useEffect } from "react";

const STORAGE_KEY = "ota_tracker_last_backfill_month_v1";
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type MountedDatePicker = {
  wrapper: HTMLDivElement;
  monthSelect: HTMLSelectElement;
  daySelect: HTMLSelectElement;
  sync: () => void;
};

function validMonthKey(value: string | null): value is string {
  return Boolean(value && /^20\d{2}-(0[1-9]|1[0-2])$/.test(value));
}

function daysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

function monthKeys(centerYear: number): string[] {
  const keys: string[] = [];
  for (let year = centerYear + 1; year >= centerYear - 9; year -= 1) {
    for (let month = 12; month >= 1; month -= 1) {
      keys.push(`${year}-${String(month).padStart(2, "0")}`);
    }
  }
  return keys;
}

function setNativeDateValue(input: HTMLInputElement, value: string) {
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

function isOtaDateInput(input: HTMLInputElement): boolean {
  const aria = input.getAttribute("aria-label") || "";
  if (/presentation date/i.test(aria)) return false;
  const labelText = input.closest("label")?.textContent || "";
  return /ota date/i.test(labelText);
}

export function OtaDateInputEnhancer() {
  useEffect(() => {
    const mounted = new Map<HTMLInputElement, MountedDatePicker>();
    const currentYear = new Date().getFullYear();
    const availableMonths = monthKeys(currentYear);

    const rememberedMonth = () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (validMonthKey(stored)) return stored;
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    };

    const enhance = (input: HTMLInputElement) => {
      if (mounted.has(input) || !isOtaDateInput(input)) return;

      const wrapper = document.createElement("div");
      wrapper.dataset.otaDatePicker = "true";
      wrapper.style.display = "flex";
      wrapper.style.alignItems = "center";
      wrapper.style.gap = "6px";
      wrapper.style.width = "fit-content";
      wrapper.style.maxWidth = "100%";

      const monthSelect = document.createElement("select");
      monthSelect.setAttribute("aria-label", "OTA month and year");
      styleSelect(monthSelect, "112px");

      const monthValues = [...availableMonths];
      const existingMonth = input.value.match(/^(20\d{2}-\d{2})-/)?.[1] || "";
      const stickyMonth = rememberedMonth();
      if (validMonthKey(existingMonth) && !monthValues.includes(existingMonth)) monthValues.unshift(existingMonth);
      if (validMonthKey(stickyMonth) && !monthValues.includes(stickyMonth)) monthValues.unshift(stickyMonth);
      for (const key of monthValues) {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = monthLabel(key);
        monthSelect.append(option);
      }

      const daySelect = document.createElement("select");
      daySelect.setAttribute("aria-label", "OTA day");
      styleSelect(daySelect, "66px");

      const rebuildDays = (selectedDay = "") => {
        daySelect.replaceChildren();
        const blank = document.createElement("option");
        blank.value = "";
        blank.textContent = "Day";
        daySelect.append(blank);
        const total = daysInMonth(monthSelect.value);
        for (let day = 1; day <= total; day += 1) {
          const option = document.createElement("option");
          option.value = String(day);
          option.textContent = String(day);
          daySelect.append(option);
        }
        daySelect.value = selectedDay;
      };

      wrapper.append(monthSelect, daySelect);
      input.insertAdjacentElement("afterend", wrapper);
      input.style.display = "none";

      const sync = () => {
        const match = input.value.match(/^(20\d{2}-\d{2})-(\d{2})$/);
        if (match) {
          const month = match[1];
          const day = String(Number(match[2]));
          if (!monthSelect.querySelector(`option[value="${month}"]`)) {
            const option = document.createElement("option");
            option.value = month;
            option.textContent = monthLabel(month);
            monthSelect.prepend(option);
          }
          if (document.activeElement !== monthSelect) monthSelect.value = month;
          if (document.activeElement !== daySelect) rebuildDays(day);
          localStorage.setItem(STORAGE_KEY, month);
          return;
        }

        const sticky = rememberedMonth();
        if (!monthSelect.querySelector(`option[value="${sticky}"]`)) {
          const option = document.createElement("option");
          option.value = sticky;
          option.textContent = monthLabel(sticky);
          monthSelect.prepend(option);
        }
        if (document.activeElement !== monthSelect) monthSelect.value = sticky;
        if (document.activeElement !== daySelect) rebuildDays("");
      };

      const commitMonth = () => {
        localStorage.setItem(STORAGE_KEY, monthSelect.value);
        const existingDay = daySelect.value;
        rebuildDays(existingDay && Number(existingDay) <= daysInMonth(monthSelect.value) ? existingDay : "");
        if (daySelect.value) {
          setNativeDateValue(input, `${monthSelect.value}-${String(Number(daySelect.value)).padStart(2, "0")}`);
        } else if (input.value) {
          setNativeDateValue(input, "");
        }
      };

      const commitDay = () => {
        localStorage.setItem(STORAGE_KEY, monthSelect.value);
        if (!daySelect.value) {
          setNativeDateValue(input, "");
          return;
        }
        setNativeDateValue(input, `${monthSelect.value}-${String(Number(daySelect.value)).padStart(2, "0")}`);
      };

      monthSelect.addEventListener("change", commitMonth);
      daySelect.addEventListener("change", commitDay);
      sync();
      mounted.set(input, { wrapper, monthSelect, daySelect, sync });
    };

    const scan = () => {
      document.querySelectorAll<HTMLInputElement>('main input[type="date"]').forEach(enhance);
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
