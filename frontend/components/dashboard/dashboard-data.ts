import {
  BarChart3,
  Box,
  Camera,
  CircleDollarSign,
  Clock3,
  Home,
  PackageOpen,
  ReceiptText,
  ShoppingBag,
  TriangleAlert,
  Users,
} from "lucide-react";
import type {
  AttentionTask,
  Metric,
  NavigationItem,
  StockItem,
  SupplierCutoffData,
} from "./types";

export const navigation: NavigationItem[] = [
  { label: "Today", href: "/", icon: Home },
  { label: "Inventory", href: "/inventory", icon: Box },
  { label: "Orders", href: "/orders", icon: ShoppingBag },
  { label: "Receipts", href: "/receipts", icon: ReceiptText },
  { label: "Activity", href: "#activity", icon: Clock3 },
  { label: "Workers", href: "/company/workers", icon: Users },
];

export const metrics: Metric[] = [
  {
    label: "Waiting for review",
    value: "3",
    emphasis: "2 receipts",
    detail: "and 1 order",
    icon: ReceiptText,
    tone: "amber",
  },
  {
    label: "Low stock items",
    value: "6",
    emphasis: "2 critical",
    detail: "before tomorrow",
    icon: TriangleAlert,
    tone: "red",
  },
  {
    label: "Orders this week",
    value: "₪2,840",
    emphasis: "↓ 8%",
    detail: "from last week",
    trend: "down",
    icon: CircleDollarSign,
    tone: "green",
  },
  {
    label: "Stock confidence",
    value: "87%",
    emphasis: "↑ 4%",
    detail: "after yesterday’s count",
    trend: "up",
    icon: BarChart3,
    tone: "blue",
  },
];

export const tasks: AttentionTask[] = [
  {
    icon: ReceiptText,
    title: "Review Fresh Fields receipt",
    detail: "8 lines · AI confidence 92%",
    tag: "Approval",
    tone: "amber",
  },
  {
    icon: Camera,
    title: "Check under-counter fridge",
    detail: "Milk count is 2 days old",
    tag: "1 photo",
    tone: "mint",
  },
  {
    icon: PackageOpen,
    title: "Approve dairy order",
    detail: "Cutoff today at 14:00",
    tag: "₪486",
    tone: "blue",
  },
];

export const stock: StockItem[] = [
  {
    name: "Oat milk",
    meta: "4 cartons · 1.3 days",
    value: 32,
    status: "Low",
    tone: "danger",
  },
  {
    name: "Coffee beans",
    meta: "7.8 kg · 4.1 days",
    value: 67,
    status: "Healthy",
    tone: "good",
  },
  {
    name: "Croissants",
    meta: "18 units · 0.8 days",
    value: 22,
    status: "Order",
    tone: "danger",
  },
];

export const supplier: SupplierCutoffData = {
  name: "Dairy Direct",
  logo: "D",
  deliveryLabel: "Delivery tomorrow",
  cutoffLabel: "1h 42m",
  basketValue: 486,
  minimumValue: 600,
  currency: "₪",
  remainingMessage: "₪114 more to reach free delivery",
};
