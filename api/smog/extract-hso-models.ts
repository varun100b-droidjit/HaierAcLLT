import { GoogleGenAI } from '@google/genai';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '30mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'Photo or imageBase64 is required.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        error: 'Gemini AI API key is not configured on server. Please add GEMINI_API_KEY in Vercel settings.'
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '').trim();

    const prompt = `You are an expert industrial OCR vision specialist analyzing a manufacturing production plan, whiteboard, screen, paper sheet, or AC unit label.

TASK: Extract EVERY SINGLE outdoor AC model that starts with "HSO" and its quantity.

CRITICAL INSTRUCTIONS:
1. COMPLETE THOROUGH SCAN: Scan the ENTIRE image thoroughly from top to bottom and left to right. Do NOT stop after finding 2 or 3 models. If there are 4 HSO models visible in the photo, you MUST return all 4 models. Check all rows, columns, headers, tables, handwritten notes, and lists.
2. MODEL NAME MATCHING:
   - Must match models starting with "HSO" (case-insensitive, e.g. "HSO18-3NB-I:AC", "HSO24-3", "HSO17-3NB", "HSO52-3NB", "HSO18", "HSO24-3NB", etc.).
   - If "HSO" looks like "HS0" (digit zero), normalize it to "HSO".
   - If written with spaces like "HSO 18", normalize to "HSO18".
   - Strip row numbering prefixes like "1.", "2)", "Row 3:", "#4", "[4]". Return only the clean model name.
   - Ignore indoor units or models starting with "HSI" or "HTO".
3. QUANTITY EXTRACTION:
   - Look for the associated production quantity (often in columns like Qty, Target, Count, Planned, or in parentheses like "(450)" or numbers following the model).
   - Return clean positive integer for qty. (e.g., "(450)" -> 450, "1,200" -> 1200).
   - If quantity is missing, zero, or unreadable, set qty to 1. NEVER skip a model because its quantity is unclear!
4. PRESERVE EVERY ROW:
   - Do NOT omit or merge distinct rows. Each listed HSO model in the photo must be its own object in the array.

OUTPUT FORMAT:
Return ONLY a valid JSON array of objects:
[
  { "modelName": "HSO18-3NB-I:AC", "qty": 450 },
  { "modelName": "HSO24-3", "qty": 120 },
  { "modelName": "HSO17-3NB", "qty": 100 },
  { "modelName": "HSO52-3NB", "qty": 50 }
]
Pure JSON array only.`;

    const imagePart = {
      inlineData: {
        mimeType: mimeType || 'image/jpeg',
        data: cleanBase64
      }
    };
    const textPart = { text: prompt };

    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
    let extractedData: Array<{ modelName: string; qty: number; prQty: number }> = [];

    const cleanAndExtractModelName = (raw: string): string | null => {
      if (!raw || typeof raw !== 'string') return null;
      let str = raw.trim();
      const match = str.match(/HS[O0][A-Za-z0-9_\-:\.\s]*/i);
      if (!match) return null;
      let clean = match[0].trim();
      clean = clean.replace(/^HS0/i, 'HSO');
      clean = clean.replace(/^HSO\s+/i, 'HSO');
      clean = clean.replace(/[:\-_\.\,\s]+$/, '');
      const upper = clean.toUpperCase();
      return (upper.startsWith('HSO') && upper.length >= 4) ? upper : null;
    };

    const parseQuantity = (raw: any): number => {
      if (typeof raw === 'number' && !isNaN(raw) && raw > 0) return Math.round(raw);
      if (!raw) return 1;
      const str = String(raw).trim();
      const digits = str.replace(/,/g, '').match(/\d+/);
      if (digits) {
        const val = parseInt(digits[0], 10);
        if (!isNaN(val) && val > 0) return val;
      }
      return 1;
    };

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: { parts: [imagePart, textPart] },
          config: { responseMimeType: 'application/json' }
        });

        if (response && response.text) {
          let cleaned = response.text.trim();
          if (cleaned.startsWith('```json')) {
            cleaned = cleaned.replace(/^```json/i, '').replace(/```$/g, '').trim();
          } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```/g, '').replace(/```$/g, '').trim();
          }

          let parsed: any[] = [];
          try {
            parsed = JSON.parse(cleaned);
          } catch {
            const match = cleaned.match(/\[[\s\S]*\]/);
            if (match) {
              try { parsed = JSON.parse(match[0]); } catch {}
            }
          }

          if (Array.isArray(parsed) && parsed.length > 0) {
            const items: Array<{ modelName: string; qty: number; prQty: number }> = [];
            for (const item of parsed) {
              if (!item) continue;
              const rawName = item.modelName || item.model || item.name || item.code || '';
              const cleanName = cleanAndExtractModelName(String(rawName));
              if (!cleanName) continue;
              const qty = parseQuantity(item.prQty ?? item.qty ?? item.quantity ?? item.count);
              items.push({ modelName: cleanName, qty, prQty: qty });
            }

            if (items.length > 0) {
              extractedData = items;
              break;
            }
          }
        }
      } catch (err: any) {
        console.warn(`[Vercel Smog OCR] Model ${model} note:`, err?.message);
      }

      if (extractedData.length > 0) {
        break;
      }
    }

    const totalQty = extractedData.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

    return res.status(200).json({
      success: extractedData.length > 0,
      items: extractedData,
      totalCount: extractedData.length,
      totalQty
    });
  } catch (err: any) {
    console.error('Vercel Smog OCR error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Error processing photo' });
  }
}
