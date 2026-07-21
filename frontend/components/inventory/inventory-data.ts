export type InventoryStatus = "healthy" | "low" | "out" | "review";

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  category: string;
  supplier: string;
  quantity: number;
  unit: string;
  minimum: number;
  active: boolean;
  updated: string;
  status: InventoryStatus;
}
