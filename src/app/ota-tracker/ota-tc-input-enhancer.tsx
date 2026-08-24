"use client";

import { useEffect } from "react";
import {
  CONSULTANT_CONTACTS_CHANGED_EVENT,
  consultantContactFor,
  loadConsultantContacts,
  type ConsultantContact,
} from "@/lib/outcomes/consultant-contacts";

const CUSTOM_VALUE = "__custom__";
const REQUIRED_OTA_TCS: ConsultantContact[] = [
  { name: "Matt Minicozzi", aliases: ["Matthew Minicozzi"], role: "Technology Consultant" },
];

type MountedTcPicker = {
  wrapper: HTMLDivElement;
  select: HTMLSelectElement;
  customInput: HTMLInputElement;
  sync: () => void;
  refreshOptions: () => void;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeName(value: unknown): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function setNativeTextValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function styleControl(control: HTMLSelectElement | HTMLInputElement, width: string) {
  control.style.width = width;
  control.style.height = "34px";
  control.style.padding = "0 8px";
  control.style.color = "#dce9e7";
  control.style.border = "1px solid rgba(160, 203, 194, .18)";
  control.style.borderRadius = "8px";
  control.style.background = "#09171e";
  control.style.font = "inherit";
  control.style.fontSize = "12px";
  control.style.fontWeight = "700";
  control.style.outline = "none";
}

function sortedContacts(): ConsultantContact[] {
  const contacts = loadConsultantContacts();
  for (const required of REQUIRED_OTA_TCS) {
    const names = [required.name, ...(required.aliases ?? [])].map(normalizeName);
    const exists = contacts.some((contact) => [contact.name, ...(contact.aliases ?? [])]
      .map(normalizeName)
      .some((name) => names.includes(name)));
    if (!exists) contacts.push({ ...required, aliases: [...(required.aliases ?? [])] });
  }
  return contacts.toSorted((left, right) => left.name.localeCompare(right.name));
}

function isAssignedTcLabel(label: HTMLLabelElement): boolean {
  const ownText = Array.from(label.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent || "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return /^assigned tc\b/i.test(ownText) || /^tc\b/i.test(ownText);
}

export function OtaTcInputEnhancer() {
  useEffect(() => {
    const mounted = new Map<HTMLInputElement, MountedTcPicker>();

    const enhance = (input: HTMLInputElement) => {
      if (mounted.has(input)) return;
      const label = input.closest("label");
      if (!(label instanceof HTMLLabelElement) || !isAssignedTcLabel(label)) return;

      const wrapper = document.createElement("div");
      wrapper.dataset.otaTcPicker = "true";
      wrapper.style.display = "flex";
      wrapper.style.alignItems = "center";
      wrapper.style.gap = "6px";
      wrapper.style.width = "100%";
      wrapper.style.maxWidth = "260px";

      const select = document.createElement("select");
      select.setAttribute("aria-label", "Assigned TC");
      styleControl(select, "178px");

      const customInput = document.createElement("input");
      customInput.type = "text";
      customInput.placeholder = "TC name";
      customInput.setAttribute("aria-label", "Custom assigned TC");
      styleControl(customInput, "150px");
      customInput.style.display = "none";

      wrapper.append(select, customInput);
      input.insertAdjacentElement("afterend", wrapper);
      input.style.display = "none";

      let contacts = sortedContacts();

      const refreshOptions = () => {
        const currentSelection = select.value;
        contacts = sortedContacts();
        select.replaceChildren();

        const blank = document.createElement("option");
        blank.value = "";
        blank.textContent = "Unassigned";
        select.append(blank);

        for (const contact of contacts) {
          const option = document.createElement("option");
          option.value = contact.name;
          option.textContent = contact.name;
          select.append(option);
        }

        const custom = document.createElement("option");
        custom.value = CUSTOM_VALUE;
        custom.textContent = "Other / custom…";
        select.append(custom);

        if (Array.from(select.options).some((option) => option.value === currentSelection)) {
          select.value = currentSelection;
        }
      };

      const sync = () => {
        const value = clean(input.value);
        if (!value) {
          if (document.activeElement !== select) select.value = "";
          customInput.style.display = "none";
          return;
        }

        const contact = consultantContactFor(value, contacts);
        if (contact) {
          if (document.activeElement !== select) select.value = contact.name;
          customInput.style.display = "none";
          return;
        }

        if (document.activeElement !== select) select.value = CUSTOM_VALUE;
        if (document.activeElement !== customInput) customInput.value = value;
        customInput.style.display = "block";
      };

      select.addEventListener("change", () => {
        if (select.value === CUSTOM_VALUE) {
          customInput.value = clean(input.value);
          customInput.style.display = "block";
          customInput.focus();
          return;
        }
        customInput.style.display = "none";
        setNativeTextValue(input, select.value);
      });

      customInput.addEventListener("input", () => {
        setNativeTextValue(input, customInput.value);
      });

      customInput.addEventListener("change", () => {
        setNativeTextValue(input, customInput.value.trim());
      });

      refreshOptions();
      sync();
      mounted.set(input, { wrapper, select, customInput, sync, refreshOptions });
    };

    const scan = () => {
      document.querySelectorAll<HTMLLabelElement>("main label").forEach((label) => {
        if (!isAssignedTcLabel(label)) return;
        const input = Array.from(label.children).find((child): child is HTMLInputElement => child instanceof HTMLInputElement);
        if (input) enhance(input);
      });

      for (const [input, picker] of mounted) {
        if (!document.contains(input)) {
          picker.wrapper.remove();
          mounted.delete(input);
        }
      }
    };

    const refreshRoster = () => {
      for (const picker of mounted.values()) {
        picker.refreshOptions();
        picker.sync();
      }
      scan();
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener(CONSULTANT_CONTACTS_CHANGED_EVENT, refreshRoster);

    const timer = window.setInterval(() => {
      scan();
      for (const picker of mounted.values()) picker.sync();
    }, 250);

    return () => {
      observer.disconnect();
      window.removeEventListener(CONSULTANT_CONTACTS_CHANGED_EVENT, refreshRoster);
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
