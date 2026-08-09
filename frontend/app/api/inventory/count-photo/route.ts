import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse, requireApiCompany } from "@/lib/auth/api";
import { generateGeminiContent } from "@/lib/gemini";

export const runtime = "nodejs";

const countResultSchema = z.object({
  canCount: z.boolean(),
  count: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
  explanation: z.string(),
  warnings: z.array(z.string()),
});

export async function POST(request: Request) {
  try {
    await requireApiCompany(["owner", "manager", "employee"]);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey)
      return NextResponse.json(
        {
          error:
            "Photo counting is not configured yet. Add GEMINI_API_KEY to enable it.",
        },
        { status: 503 },
      );

    const form = await request.formData();
    const image = form.get("image");
    const itemName = String(form.get("itemName") ?? "").trim();
    const unit = String(form.get("unit") ?? "items").trim();

    if (!(image instanceof File) || !image.type.startsWith("image/"))
      return NextResponse.json(
        { error: "Upload a supported image file" },
        { status: 400 },
      );
    if (!itemName)
      return NextResponse.json(
        { error: "Item name is required" },
        { status: 400 },
      );
    if (image.size > 10 * 1024 * 1024)
      return NextResponse.json(
        { error: "The image must be smaller than 10 MB" },
        { status: 413 },
      );

    const base64Image = Buffer.from(await image.arrayBuffer()).toString(
      "base64",
    );
    const result = await generateGeminiContent({
      apiKey,
      timeoutMs: 30_000,
      body: {
        contents: [
          {
            role: "user",
            parts: [
              {
                inline_data: {
                  mime_type: image.type,
                  data: base64Image,
                },
              },
              {
                text: `Count the visible instances of the inventory item named "${itemName}". The inventory unit is "${unit}". Count only clearly visible matching items. If items overlap, are hidden, the unit is weight/volume, or the image is not suitable for a reliable count, set canCount to false. Explain uncertainty briefly. This is a proposal for a human to approve, never an automatic inventory write.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              canCount: { type: "BOOLEAN" },
              count: { type: "INTEGER" },
              confidence: { type: "NUMBER" },
              explanation: { type: "STRING" },
              warnings: { type: "ARRAY", items: { type: "STRING" } },
            },
            required: [
              "canCount",
              "count",
              "confidence",
              "explanation",
              "warnings",
            ],
          },
        },
      },
    });

    const payload = result.payload;
    if (!result.ok)
      return NextResponse.json(
        {
          error:
            "Service is temporarily busy after automatic retries. Try again.",
        },
        { status: 503 },
      );

    const text = payload?.candidates?.[0]?.content?.parts?.find(
      (part) => part.text,
    )?.text;
    if (!text)
      return NextResponse.json(
        { error: "The photo count returned no usable result" },
        { status: 502 },
      );

    try {
      const cleaned = text
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "");
      return NextResponse.json(countResultSchema.parse(JSON.parse(cleaned)));
    } catch {
      return NextResponse.json(
        { error: "The photo count returned an invalid result" },
        { status: 502 },
      );
    }
  } catch (error) {
    return apiErrorResponse(error, "Unable to count this inventory photo");
  }
}
