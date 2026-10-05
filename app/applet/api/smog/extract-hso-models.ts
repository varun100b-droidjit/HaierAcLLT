import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
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
        error: 'Gemini AI API key is not configured on server. Please check environment variables.' 
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' }
      }
    });

    const cleanBase64 = String(imageBase64).replace(/^data:[^;]+;base64,/, '').trim();
    const prompt = `You are an expert OCR vision specialist analyzing an industrial/manufacturing spreadsheet, screen, or label.
Examine this image carefully.
Look for any outdoor AC models and their associated quantities (e.g. production qty, planned qty, numbers in parentheses like "(900)" or in columns like Qty / Count).

STRICT CRITICAL INSTRUCTIONS:
1. EXTRACT ONLY MODELS WHOSE NAME STARTS WITH "HSO" (case-insensitive, e.g. "HSO17-3NB-I:AC", "HSO18-3NB-I:AC", "HSO24-3", "HSO24-3N", "HSO52-3NB-I:AC", etc.).
2. COMPLETELY IGNORE all other models such as those starting with "HSI" (e.g. HSI17N, HSI18CP), "HTO", or anything that does not start with "HSO". ONLY extract models starting with "HSO".
3. If the image has OCR ambiguity where "HSO" looks like "HS0" (digit zero), normalize it to "HSO".
4. For each matching HSO model:
   - "modelName": Exact clean model name starting with HSO (e.g. "HSO24-3", "HSO18-3NB-I:AC").
   - "qty": The positive integer quantity (e.g. 900, 460, 100).
5. If the same HSO model appears multiple times, combine its total quantity.

OUTPUT FORMAT:
Return ONLY a valid JSON array of objects:
[
  { "modelName": "HSO24-3", "qty": 99 },
  { "modelName": "HSO18-3NB-I:AC", "qty": 460 }
]
No backticks, no markdown formatting, just pure JSON array.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType || 'image/jpeg', data: cleanBase64 } },
          { text: prompt }
        ]
      },
      config: { responseMimeType: 'application/json' }
    });

    let extractedData: any[] = [];
    if (response && response.text) {
      let cleaned = response.text.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/i, '').replace(/```$/g, '').trim();
      else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/g, '').replace(/```$/g, '').trim();

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
        const aggregatedMap = new Map<string, number>();

        for (const item of parsed) {
          if (!item || typeof item.modelName !== 'string') continue;
          let cleanName = String(item.modelName).trim().toUpperCase().replace(/^HS0/i, 'HSO').replace(/[:\-_\.\,\s]+$/, '');
          // Strict requirement: MUST start with HSO
          if (cleanName.startsWith('HSO') && cleanName.length >= 4) {
            const q = Math.max(1, parseInt(String(item.prQty ?? item.qty), 10) || 0);
            const current = aggregatedMap.get(cleanName) || 0;
            aggregatedMap.set(cleanName, current + q);
          }
        }

        extractedData = Array.from(aggregatedMap.entries()).map(([modelName, qty]) => ({
          modelName,
          qty,
          prQty: qty
        }));
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
    console.error('Vercel API Smog OCR extraction error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Error processing photo' });
  }
}
