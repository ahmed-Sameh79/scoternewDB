import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(num).replace("MYR", "RM");
}

export function formatDate(date: string | Date | number): string {
  return format(new Date(date), "dd MMM yyyy");
}

export function formatDateTime(date: string | Date | number): string {
  return format(new Date(date), "dd MMM yyyy HH:mm");
}
