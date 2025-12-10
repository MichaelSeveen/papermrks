import { DEFAULT_BLOCKED_DOMAINS } from "@/config/disposable-emails";
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name: string | null | undefined): string {
  if (!name) {
    return "";
  }

  const trimmedName = name.trim();

  if (/^\+\d+$/.test(trimmedName)) {
    return trimmedName;
  }

  if (/^[A-Z]{2,}$/.test(trimmedName)) {
    return trimmedName;
  }

  const parts = trimmedName.split(/\s+/);

  if (parts.length === 1) {
    return parts[0][0].toUpperCase();
  }

  const initials = parts.map((part) => part[0].toUpperCase()).join("");

  return initials;
}

export function isDisposable(email: string) {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  return DEFAULT_BLOCKED_DOMAINS.has(domain ?? "");
}