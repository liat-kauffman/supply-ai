import type { LucideIcon } from "lucide-react";

export type Tone = "amber" | "mint" | "blue" | "red" | "green";

export interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
}

export interface Metric {
  label: string;
  value: string;
  detail: string;
  emphasis?: string;
  trend?: "up" | "down";
  icon: LucideIcon;
  tone: Tone;
}

export interface AttentionTask {
  title: string;
  detail: string;
  tag: string;
  icon: LucideIcon;
  tone: "amber" | "mint" | "blue";
}

export interface StockItem {
  name: string;
  meta: string;
  value: number;
  status: string;
  tone: "danger" | "good";
}

export interface SupplierCutoffData {
  name: string;
  logo: string;
  deliveryLabel: string;
  cutoffLabel: string;
  basketValue: number;
  minimumValue: number;
  currency: string;
  remainingMessage: string;
}
