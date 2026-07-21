import { databaseHealth } from "@supply/database";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export async function GET() {
  const database = await databaseHealth();
  return NextResponse.json(
    { status: database.ok ? "ready" : "unavailable", checks: { database } },
    { status: database.ok ? 200 : 503 },
  );
}
