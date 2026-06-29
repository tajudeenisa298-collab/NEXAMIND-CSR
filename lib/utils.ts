import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

