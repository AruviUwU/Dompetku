import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase/server";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Daftar model fallback — dicoba urut dari atas
const MODELS = ["gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-flash"];

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

const PROMPT = `
Analisis gambar struk belanja ini.

Ekstrak informasi berikut:
- merchant: nama toko
- date: tanggal transaksi
- total: total pembayaran
- category: kategori pengeluaran
- description: deskripsi singkat

Kategori yang diperbolehkan:
Makanan
Transportasi
Belanja
Hiburan
Tagihan
Pendidikan
Kesehatan
Langganan
Lainnya

Berikan HANYA JSON dengan format:

{
  "merchant": "string",
  "date": "YYYY-MM-DD",
  "total": number,
  "category": "string",
  "description": "string"
}

Jika informasi tidak terbaca, gunakan null.
Jangan menebak nominal yang tidak terlihat.
`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithRetry(
  model: string,
  mimeType: string,
  base64Image: string,
  maxRetries = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType, data: base64Image } },
              { text: PROMPT },
            ],
          },
        ],
      });
      return response;
    } catch (err: unknown) {
      const isOverloaded =
        err instanceof Error && err.message.includes("503");
      const isLastAttempt = attempt === maxRetries;

      if (isOverloaded && !isLastAttempt) {
        // Tunggu makin lama tiap retry: 2s, 4s, 8s
        const delay = 2000 * Math.pow(2, attempt - 1);
        console.log(
          `Model ${model} overloaded, retry ${attempt}/${maxRetries} dalam ${delay}ms...`
        );
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
}

export async function POST(request: Request) {
  try {
    // 1) Wajib login: app mengirim token sesi lewat header Authorization
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return NextResponse.json({ error: "Silakan masuk dulu." }, { status: 401 });
    }
    const supabase = createUserClient(token);
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) {
      return NextResponse.json({ error: "Sesi berakhir. Masuk lagi." }, { status: 401 });
    }

    // Tolak unggahan besar sebelum dibaca ke memori
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES + 100_000) {
      return NextResponse.json({ error: "Ukuran foto maksimal 10 MB." }, { status: 413 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "File struk tidak ditemukan" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Format harus JPG, PNG, atau WEBP" },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Ukuran foto maksimal 10 MB." }, { status: 413 });
    }

    // 2) Batas pemakaian per user (dan batas harian global) dihitung di database
    const { data: allowed, error: quotaError } = await supabase.rpc("consume_scan_quota");
    if (quotaError) {
      console.error("Quota check error:", quotaError);
      return NextResponse.json({ error: "Gagal memeriksa batas pemakaian." }, { status: 500 });
    }
    if (!allowed) {
      return NextResponse.json({ error: "Batas scan tercapai. Coba lagi nanti." }, { status: 429 });
    }

    const bytes = await file.arrayBuffer();
    const base64Image = Buffer.from(bytes).toString("base64");

    // Coba setiap model secara bergantian
    let lastError: unknown;
    for (const model of MODELS) {
      try {
        console.log(`Mencoba model: ${model}`);
        const response = await generateWithRetry(model, file.type, base64Image);

        const text = response?.text;
        if (!text) throw new Error("Gemini tidak memberikan hasil");

        // Bersihkan markdown code fence jika Gemini mengembalikannya
        const cleaned = text
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        const data = JSON.parse(cleaned);
        console.log(`Berhasil dengan model: ${model}`);
        return NextResponse.json(data);
      } catch (err) {
        console.warn(`Model ${model} gagal:`, err);
        lastError = err;
        // Lanjut ke model berikutnya
      }
    }

    throw lastError;
  } catch (error) {
    console.error("Receipt scanning error:", error);

    const message =
      error instanceof Error && error.message.includes("503")
        ? "Server AI sedang sibuk, coba beberapa saat lagi."
        : "Gagal membaca struk";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}