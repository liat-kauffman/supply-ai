import { prisma } from "@supply/database";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse, requireApiCompany } from "@/lib/auth/api";
import { generateGeminiContent } from "@/lib/gemini";

export const runtime = "nodejs";

const observationSchema = z.object({
  catalogCode: z.string().min(1),
  observed: z.boolean(),
  count: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
  evidence: z.string(),
  warnings: z.array(z.string()).default([]),
});

const resultSchema = z.object({
  observations: z.array(observationSchema),
  unrecognizedItems: z.array(z.string()).default([]),
  globalWarnings: z.array(z.string()).default([]),
});

function parseJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return resultSchema.parse(JSON.parse(cleaned));
}

export async function POST(request: Request) {
  try {
    const company = await requireApiCompany(["owner", "manager", "employee"]);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey)
      return NextResponse.json(
        { error: "Area photo counting is not configured yet." },
        { status: 503 },
      );

    const form = await request.formData();
    const image = form.get("image");
    const storageAreaId = String(form.get("storageAreaId") ?? "").trim();
    if (!(image instanceof File) || !image.type.startsWith("image/"))
      return NextResponse.json(
        { error: "Upload a supported image file" },
        { status: 400 },
      );
    if (image.size > 10 * 1024 * 1024)
      return NextResponse.json(
        { error: "The image must be smaller than 10 MB" },
        { status: 413 },
      );

    if (storageAreaId) {
      const area = await prisma.storageArea.findFirst({
        where: {
          id: storageAreaId,
          active: true,
          location: { businessId: company.organizationId },
        },
        select: { id: true },
      });
      if (!area)
        return NextResponse.json(
          { error: "That storage area is not available in this company." },
          { status: 404 },
        );
    }

    const products = await prisma.product.findMany({
      where: {
        businessId: company.organizationId,
        active: true,
        ...(storageAreaId ? { primaryStorageAreaId: storageAreaId } : {}),
      },
      orderBy: { name: "asc" },
      take: 80,
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        baseUnit: true,
      },
    });
    if (!products.length)
      return NextResponse.json(
        {
          error:
            "Add at least one active inventory item before scanning an area.",
        },
        { status: 409 },
      );

    const catalog = products.map((product, index) => ({
      catalogCode: String(index + 1),
      productId: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      unit: product.baseUnit,
    }));
    const base64Image = Buffer.from(await image.arrayBuffer()).toString(
      "base64",
    );
    const result = await generateGeminiContent({
      apiKey,
      timeoutMs: 35_000,
      body: {
        contents: [
          {
            role: "user",
            parts: [
              {
                inline_data: { mime_type: image.type, data: base64Image },
              },
              {
                text: `You are counting stock in one storage area. The image may contain several products. Match products only to this catalog; never invent a product and never use a product name as a substitute for its catalogCode.

Catalog:
${JSON.stringify(catalog)}

Return one observation for each catalog item that is visibly present. Count physical product units, not text labels, price tags, or the same item twice. If an item is partially hidden, state that in warnings and reduce confidence. Do not claim an item is absent just because it is outside the camera view. Include unrecognized products separately. This is a proposal for a human to review; it must never change inventory automatically.

Return JSON with observations, unrecognizedItems, and globalWarnings. Each observation must contain catalogCode, observed, count, confidence from 0 to 1, evidence, and warnings.`,
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
              observations: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    catalogCode: { type: "STRING" },
                    observed: { type: "BOOLEAN" },
                    count: { type: "INTEGER" },
                    confidence: { type: "NUMBER" },
                    evidence: { type: "STRING" },
                    warnings: { type: "ARRAY", items: { type: "STRING" } },
                  },
                  required: [
                    "catalogCode",
                    "observed",
                    "count",
                    "confidence",
                    "evidence",
                    "warnings",
                  ],
                },
              },
              unrecognizedItems: { type: "ARRAY", items: { type: "STRING" } },
              globalWarnings: { type: "ARRAY", items: { type: "STRING" } },
            },
            required: ["observations", "unrecognizedItems", "globalWarnings"],
          },
        },
      },
    });

    if (!result.ok)
      return NextResponse.json(
        { error: "Gemini is temporarily busy. Try the area photo again." },
        { status: 503 },
      );
    const text = result.payload?.candidates?.[0]?.content?.parts?.find(
      (part) => part.text,
    )?.text;
    if (!text)
      return NextResponse.json(
        { error: "The area photo returned no usable result" },
        { status: 502 },
      );

    const parsed = parseJson(text);
    const catalogByCode = new Map(
      catalog.map((item) => [item.catalogCode, item]),
    );
    const observations = parsed.observations
      .flatMap((observation) => {
        const product = catalogByCode.get(observation.catalogCode);
        if (!product || !observation.observed) return [];
        return [
          {
            productId: product.productId,
            name: product.name,
            unit: product.unit,
            count: observation.count,
            confidence: observation.confidence,
            evidence: observation.evidence,
            warnings: observation.warnings,
          },
        ];
      })
      .filter(
        (
          observation,
        ): observation is NonNullable<typeof observation> & {
          productId: string;
        } => Boolean(observation.productId),
      );

    const scan = await prisma.inventoryScan.create({
      data: {
        businessId: company.organizationId,
        storageAreaId: storageAreaId || null,
        createdById: company.userId,
        observations,
        globalWarnings: parsed.globalWarnings,
        unrecognizedItems: parsed.unrecognizedItems,
      },
      select: { id: true },
    });

    return NextResponse.json({
      scanId: scan.id,
      observations,
      unrecognizedItems: parsed.unrecognizedItems,
      globalWarnings: [
        ...parsed.globalWarnings,
        ...(products.length === 80
          ? [
              "Only the first 80 active catalog items were included. Narrow the catalog before scanning larger inventories.",
            ]
          : []),
      ],
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error: "The AI returned an invalid area count. Try a clearer photo.",
        },
        { status: 502 },
      );
    return apiErrorResponse(error, "Unable to analyze this area photo");
  }
}
