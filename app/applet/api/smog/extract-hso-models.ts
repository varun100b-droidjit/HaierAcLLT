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
    const prompt = `You are an expert OCR vision specialist analyzing an industrial/manufacturing spreadsheet, label, screen, or paperwork.
Examine this image carefully.
Look for any model names, machine series codes, and their associated quantities (e.g. production qty, planned qty, numbers in parentheses like "(900)" or in columns like Qty / Count).

CRITICAL INSTRUCTIONS:
1. Identify all models and their production quantities listed in the image.
   - If outdoor smog models starting with or containing "HSO" are present (e.g. "HSO17-3NB-I:AC", "HSO18-3NB-I:AC", "HSO19-5NB-I:AC", "HSO52-3NB-I:AC", "HSO52-5NB-I:AC"), extract them with highest priority.
   - If other model codes are listed with quantities (e.g., "HS18", "18-3NB", "HSO17", etc.), extract them as well.
2. For each model:
   - "modelName": Clean, exact model name string (e.g. "HSO17-3NB-I:AC" or "HSO18-3NB-I:AC").
   - "qty": The positive integer quantity (e.g. 900, 460, 150).
3. Ignore header rows or summaries like "Total", "Grand Total", "(All)".

OUTPUT FORMAT:
Return ONLY a valid JSON array of objects, strictly in this format:
[
  { "modelName": "HSO17-3NB-I:AC", "qty": 900 },
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
        const hsoList = parsed.filter(item => 
          item && typeof item.modelName === 'string' && /HSO/i.test(item.modelName)
        );
        const chosenList = hsoList.length > 0 ? hsoList : parsed.filter(item => 
          item && typeof item.modelName === 'string' && 
          !/^(total|grand total|all|summary)$/i.test(item.modelName.trim()) &&
          item.modelName.trim().length > 1
        );
        extractedData = chosenList.map(item => {
          const cleanName = String(item.modelName || '').trim().toUpperCase();
          const q = Math.max(1, parseInt(String(item.prQty ?? item.qty), 10) || 0);
          return { modelName: cleanName, qty: q, prQty: q };
        }).filter(item => item.modelName.length > 1 && item.qty > 0);
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
