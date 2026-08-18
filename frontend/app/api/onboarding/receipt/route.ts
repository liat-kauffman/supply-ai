import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiAccessError, requireApiCompany } from "@/lib/auth/api";
import { displayText } from "@/lib/display";
import { generateGeminiContent } from "@/lib/gemini";
import { MAX_API_UPLOAD_BYTES, MAX_API_UPLOAD_LABEL } from "@/lib/uploads";

export const runtime = "nodejs";

const receiptDraftSchema = z.object({
  supplierName: z.string().catch(""),
  receiptDate: z.string().catch(""),
  invoiceNumber: z.string().catch(""),
  confidence: z.coerce.number().min(0).max(1).catch(0),
  vatAmount: z.coerce.number().nonnegative().catch(0),
  totalAmount: z.coerce.number().nonnegative().catch(0),
  items: z
    .array(
      z.object({
        name: z.string().catch(""),
        description: z.string().catch(""),
        category: z.string().catch("Uncategorized"),
        supplierSku: z.string().catch(""),
        packageCount: z.coerce.number().nonnegative().catch(0),
        unitsPerPackage: z.coerce.number().positive().catch(1),
        quantity: z.coerce.number().nonnegative().catch(0),
        unit: z.string().catch("units"),
        packagePrice: z.coerce.number().nonnegative().catch(0),
      }),
    )
    .catch([]),
  warnings: z.array(z.string()).catch([]),
});

function parseModelJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("No JSON object found");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

function fallbackDraft(warning: string) {
  return {
    supplierName: "",
    receiptDate: "",
    invoiceNumber: "",
    confidence: 0,
    vatAmount: 0,
    totalAmount: 0,
    items: [],
    warnings: [warning],
  };
}

export async function POST(request: Request) {
  try {
    await requireApiCompany(["owner", "manager"]);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey)
      return NextResponse.json(
        { error: "Add GEMINI_API_KEY to enable receipt extraction" },
        { status: 503 },
      );

    const form = await request.formData();
    const receipt = form.get("receipt");
    if (
      !(receipt instanceof File) ||
      (!receipt.type.startsWith("image/") && receipt.type !== "application/pdf")
    )
      return NextResponse.json(
        { error: "Upload an image or PDF receipt" },
        { status: 400 },
      );
    if (receipt.size > MAX_API_UPLOAD_BYTES)
      return NextResponse.json(
        { error: `The receipt must be smaller than ${MAX_API_UPLOAD_LABEL}` },
        { status: 413 },
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
                inline_data: {
                  mime_type: receipt.type,
                  data: Buffer.from(await receipt.arrayBuffer()).toString(
                    "base64",
                  ),
                },
              },
              {
                text: "Extract this supplier receipt for initial inventory setup. Return the supplier name, receipt date, invoice number, receipt VAT amount if shown, the full receipt total if shown, and every purchased line item. Packaging is important: packageCount is how many packages were bought, unitsPerPackage is the fixed number of base units inside one supplier package, and quantity is the total base units received (packageCount multiplied by unitsPerPackage). For example, 3 cartons of 12 bottles means packageCount 3, unitsPerPackage 12, quantity 36, and unit bottles. Packaging printed as 6x2, 12 units, case of 24, or similar describes unitsPerPackage and should not be folded into the item name. When no package structure is printed, use unitsPerPackage 1 and packageCount equal to quantity. For each line infer a short inventory name, useful description, broad category, supplier SKU if printed, practical base unit such as units, kg, or bottles, and the price for one package (not the full line total). Do not invent unreadable values; use an empty SKU or zero price when unknown. Keep partial rows and explain uncertainty in warnings. This is an editable draft that a manager will approve.",
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
              supplierName: { type: "STRING" },
              receiptDate: { type: "STRING" },
              invoiceNumber: { type: "STRING" },
              confidence: { type: "NUMBER" },
              vatAmount: { type: "NUMBER" },
              totalAmount: { type: "NUMBER" },
              items: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    name: { type: "STRING" },
                    description: { type: "STRING" },
                    category: { type: "STRING" },
                    supplierSku: { type: "STRING" },
                    packageCount: { type: "NUMBER" },
                    unitsPerPackage: { type: "NUMBER" },
                    quantity: { type: "NUMBER" },
                    unit: { type: "STRING" },
                    packagePrice: { type: "NUMBER" },
                  },
                  required: [
                    "name",
                    "description",
                    "category",
                    "supplierSku",
                    "packageCount",
                    "unitsPerPackage",
                    "quantity",
                    "unit",
                    "packagePrice",
                  ],
                },
              },
              warnings: { type: "ARRAY", items: { type: "STRING" } },
            },
            required: [
              "supplierName",
              "receiptDate",
              "invoiceNumber",
              "confidence",
              "vatAmount",
              "totalAmount",
              "items",
              "warnings",
            ],
          },
        },
      },
    });

    const payload = result.payload;
    if (!result.ok)
      return NextResponse.json(
        fallbackDraft(
          "Gemini was busy after automatic retries. Try extraction again, or review the editable draft manually.",
        ),
      );

    const text = payload?.candidates?.[0]?.content?.parts?.find(
      (part) => part.text,
    )?.text;
    if (!text)
      return NextResponse.json(
        fallbackDraft(
          "No readable receipt data was returned. Add the details below.",
        ),
      );

    try {
      const draft = receiptDraftSchema.parse(parseModelJson(text));
      return NextResponse.json({
        ...draft,
        supplierName: displayText(draft.supplierName, ""),
        receiptDate: displayText(draft.receiptDate, ""),
        invoiceNumber: displayText(draft.invoiceNumber, ""),
        warnings: draft.warnings
          .map((warning) => displayText(warning, ""))
          .filter(Boolean),
        items: draft.items.map((item) => ({
          ...item,
          name: displayText(item.name, ""),
          description: displayText(item.description, ""),
          category: displayText(item.category, "Uncategorized"),
          supplierSku: displayText(item.supplierSku, ""),
          unit: displayText(item.unit, "units"),
          packageCount: Math.round(item.packageCount * 1000) / 1000,
          unitsPerPackage: Math.round(item.unitsPerPackage * 1000) / 1000,
          quantity:
            Math.round(
              (item.packageCount > 0
                ? item.packageCount * item.unitsPerPackage
                : item.quantity) * 1000,
            ) / 1000,
        })),
      });
    } catch {
      return NextResponse.json(
        fallbackDraft(
          "Some receipt data could not be structured. Review the editable draft manually.",
        ),
      );
    }
  } catch (error) {
    if (error instanceof ApiAccessError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error(error);
    return NextResponse.json(
      fallbackDraft(
        "OCR could not finish. Review the editable draft manually.",
      ),
    );
  }
}
