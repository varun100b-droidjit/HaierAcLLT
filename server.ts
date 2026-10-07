import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Modality } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '30mb' }));
  app.use(express.urlencoded({ limit: '30mb', extended: true }));

  // Initialize Gemini Client safely
  const getGenAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  };

  // Real Girl Voice TTS Endpoint using Gemini Audio Modality
  app.post('/api/tts', async (req, res) => {
    try {
      const { text, voice = 'Kore' } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Text prompt is required' });
      }

      const ai = getGenAI();
      if (!ai) {
        return res.json({ fallbackToSpeechSynthesis: true });
      }

      // Clean text for speech output
      const cleanText = text.replace(/[*_~#`]/g, '').trim();

      // Generate female voice audio if supported by Gemini API, with clean fallback
      const modelsToTry = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts', 'gemini-3.8-flash'];
      let response: any = null;

      for (const model of modelsToTry) {
        try {
          response = await ai.models.generateContent({
            model,
            contents: [{ parts: [{ text: `Speak the following text clearly in natural Hindi/Hinglish female voice: "${cleanText}"` }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voice }, // 'Kore'
                },
              },
            },
          });
          if (response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
            break;
          }
        } catch {
          // Model does not support audio modality or quota limit reached - silent fallback
        }
      }

      const part = response?.candidates?.[0]?.content?.parts?.[0];
      const base64Audio = part?.inlineData?.data;
      let mimeType = part?.inlineData?.mimeType || 'audio/wav';

      if (!base64Audio) {
        return res.json({ fallbackToSpeechSynthesis: true });
      }

      // Ensure raw PCM audio has a standard 44-byte WAV header attached
      let finalBuffer = Buffer.from(base64Audio, 'base64');
      if (finalBuffer.length > 4 && finalBuffer.toString('ascii', 0, 4) !== 'RIFF') {
        const header = Buffer.alloc(44);
        const sampleRate = 24000;
        const numChannels = 1;
        const bitDepth = 16;
        const byteRate = (sampleRate * numChannels * bitDepth) / 8;
        const blockAlign = (numChannels * bitDepth) / 8;

        header.write('RIFF', 0);
        header.writeUInt32LE(36 + finalBuffer.length, 4);
        header.write('WAVE', 8);
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16);
        header.writeUInt16LE(1, 20);
        header.writeUInt16LE(numChannels, 22);
        header.writeUInt32LE(sampleRate, 24);
        header.writeUInt32LE(byteRate, 28);
        header.writeUInt16LE(blockAlign, 32);
        header.writeUInt16LE(bitDepth, 34);
        header.write('data', 36);
        header.writeUInt32LE(finalBuffer.length, 40);

        finalBuffer = Buffer.concat([header, finalBuffer]);
        mimeType = 'audio/wav';
      }

      return res.json({
        audio: finalBuffer.toString('base64'),
        mimeType: mimeType
      });
    } catch (err: any) {
      console.error('Gemini TTS server error:', err);
      return res.json({ fallbackToSpeechSynthesis: true });
    }
  });

  // Megha AI Smart Chat Endpoint (Handles both LLT Lab status & General Knowledge / AI questions)
  app.post('/api/megha-ai', async (req, res) => {
    try {
      const { question, labContext, chatHistory } = req.body;
      if (!question) {
        return res.status(400).json({ error: 'Question is required' });
      }

      const ai = getGenAI();
      if (!ai) {
        return res.json({
          reply: `Hi Indrajit! Gemini AI connected nahi hai. Lab status sabhi ok hain.`
        });
      }

      let formattedHistory = "";
      if (Array.isArray(chatHistory) && chatHistory.length > 0) {
        formattedHistory = `\nRECENT CONVERSATION HISTORY (Use this memory context for follow-up questions like "ye machine", "us machine", "kis date ko", "holder kaun hai", "stage kya hai", etc.):\n` +
          chatHistory.map((msg: any) => `${msg.sender}: "${msg.text}"`).join('\n') + '\n';
      }

      const systemContext = `You are "Megha AI", a super-intelligent voice & chat assistant (like ChatGPT) built specifically for Indrajit in the LLT Lab Management System.

Capabilities & Knowledge Scope:
1. GENERAL KNOWLEDGE & ANY QUESTION (ChatGPT Mode): Answer ANY question asked by the user — general knowledge, science, math, technology, everyday questions, advice, history, etc., accurately in clear and polite Hindi / Hinglish.
2. LLT LAB SYSTEM FUNCTION EXPERT & CONVERSATIONAL SEARCH ENGINE:
   - CONVERSATIONAL MEMORY & FOLLOW-UP QUESTIONS: Remember what serial number, unit, or machine was mentioned in the previous turns of the conversation! If the user asks a follow-up question like "ye machine kis date ko diya gaya hai", "is machine ka model name kya hai", "kiske paas hai", "transfer date kya hai", or "ye kis stage me hai" WITHOUT repeating the serial number, look at the RECENT CONVERSATION HISTORY to find which machine/serial number was discussed in previous messages and answer directly for that machine!
   - Search by Machine Serial Number / Last Digits / Requisition Serial No: When the user mentions any number or serial number (e.g. "86566", "machine 12345", "serial number 001"), search through all R&D, Proto, and Field units in the context data. Match exact or partial digits/last digits of 'serialNumber'!
   - Complete Unit Details: Provide details like Model Name, Serial Number, Transfer Date ('transferDate'), Created Date ('createdAt'), Required Date ('requiredBy'), Current Holder ('currentHolder'), Department Persons ('bsrPerson', 'eltPerson', 'rdPerson', 'oqcPerson'), Current Stage ('currentStageIndex'), and Status ('status').
   - Dashboard & Lab Shifts: General Shift (09:00-17:30), Shift A (07:00-15:30), Shift A+B (07:00-24:00), Shift A+B+C (24h continuous).
   - R&D Units: 10 stage testing workflow (Received to Completed).
   - Proto Units: Prototype testing stations and hours.
   - Field Units: Field testing stations and hours.
   - FULL WEBSITE HANDLES & VOICE CONTROL: You can control the entire website interface! If the user asks to open a screen (e.g. "Proto screen kholo", "Dashboard open karo", "Field units open karo", "Settings kholo"), scroll (e.g. "scroll down", "niche jao", "scroll up"), click buttons (e.g. "View button click karo", "Track timeline dekho"), open modals ("add unit modal open karo"), or change theme ("theme badlo"), specify the appropriate 'navigateTab' and 'uiAction' fields in your JSON output!

CRITICAL RULES:
- GENERAL QUESTION RULE: If the user asks ANY general question, conversational query, science, history, joke, math, programming, general knowledge, everyday advice, greeting, or chit-chat (e.g. "aaj mausam kaisa hai", "kya kar rahi ho", "kya haal hai", "India ki rajdhani kya hai", "AI kya hai", "kuch sunao", "chai kaise banate hain", etc.) that is NOT explicitly about LLT lab units, machines, serial numbers, or lab shifts: ANSWER THE GENERAL QUESTION DIRECTLY AND ACCURATELY as a super-intelligent AI assistant like ChatGPT in natural, polite Hindi/Hinglish! Do NOT mention LLT lab, R&D units, or machine count when answering a general question!
- WEBSITE & LAB QUESTION RULE: When answering about ANY website data (R&D units, Proto units, Field units, machine serial numbers, transfer dates, stage timelines, holders, lab shifts): Look at the complete provided labContext (rdUnitsSummary, protoUnitsSummary, fieldUnitsSummary, activeShift) to give accurate answers!
- OVERDUE UNITS RULE: Overdue units in R&D Units are strictly those units whose target requiredBy date has passed AND are currently held by an R&D Person or inside the R&D Area (Step 3, 4, 5). Units at ELT, BSR, or OQC are not counted as R&D Overdue.
- VOICE STOP COMMAND RULE: If the user asks to stop, pause, or turn off Megha voice (e.g. "megha stop", "stop listening", "pause karo", "band karo", "ruk jao"), set "stopListening": true in your JSON output.
- Keep answers short, clear, polite, and concise (1 to 3 sentences) so it sounds natural and crisp when spoken aloud by Megha Voice.
- Always address the user politely as Indrajit when appropriate.`;

      const prompt = `${systemContext}
${formattedHistory}
Current User Question: "${question}"
LLT Lab Context Summary: ${JSON.stringify(labContext || {})}

IMPORTANT:
1. If the user is requesting to change or switch the Lab Shift (e.g. "shift A kar do", "general shift lagao", "A+B shift change karo", "24 hour shift kar do", "shift badal do", etc.):
Determine the requested shift ID: "GENERAL", "SHIFT_A", "SHIFT_AB", or "SHIFT_ABC".

2. If the user is asking to start/stop/finish a Proto unit or Field unit (e.g., "proto unit HSI19T stop kar do", "field unit start kar do"):
Specify protoAction or fieldAction with the unit id and new status ('live', 'stopped', 'finished').

3. If the user asks to open/navigate to any screen or tab:
Specify "navigateTab": "dashboard" | "rd-units" | "proto-units" | "field-units" | "smog" | "reports" | "export-data" | "settings" | "ai-support".

4. If the user asks to scroll, click buttons, open modals, or toggle theme:
Specify "uiAction": "scroll_down" | "scroll_up" | "scroll_top" | "scroll_bottom" | "open_add_unit" | "open_add_proto" | "close_modal" | "toggle_theme" | "click_view".

5. Respond in valid JSON format ONLY:
{
  "reply": "Your polite response in Hindi/Hinglish (1 to 3 sentences)",
  "stopListening": boolean | null,
  "changeShift": "GENERAL" | "SHIFT_A" | "SHIFT_AB" | "SHIFT_ABC" | null,
  "protoAction": { "id": "unit_id", "status": "live" | "stopped" | "finished" } | null,
  "fieldAction": { "id": "unit_id", "status": "live" | "stopped" | "finished" } | null,
  "navigateTab": string | null,
  "uiAction": string | null
}

If no shift change, unit action, or UI command is requested, set those action fields to null.`;

      let responseText = "";
      const modelsToTry = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-flash-latest'];
      for (const model of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
            }
          });
          if (response && response.text) {
            responseText = response.text;
            break;
          }
        } catch {
          // Fallback to next model
        }
      }

      if (!responseText) {
        return res.json({
          reply: null,
          fallback: true
        });
      }

      let reply = "Mujhe samajh nahi aaya, kripya dobara poochein.";
      let stopListening: boolean | null = null;
      let changeShift: string | null = null;
      let protoAction: any = null;
      let fieldAction: any = null;
      let navigateTab: string | null = null;
      let uiAction: string | null = null;

      try {
        let cleaned = responseText.trim();
        if (cleaned.startsWith('```json')) {
          cleaned = cleaned.replace(/^```json/i, '').replace(/```$/g, '').trim();
        } else if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```/g, '').replace(/```$/g, '').trim();
        }
        const jsonRes = JSON.parse(cleaned);
        if (jsonRes.reply) reply = jsonRes.reply;
        if (jsonRes.stopListening) stopListening = Boolean(jsonRes.stopListening);
        if (jsonRes.changeShift) changeShift = jsonRes.changeShift;
        if (jsonRes.protoAction) protoAction = jsonRes.protoAction;
        if (jsonRes.fieldAction) fieldAction = jsonRes.fieldAction;
        if (jsonRes.navigateTab) navigateTab = jsonRes.navigateTab;
        if (jsonRes.uiAction) uiAction = jsonRes.uiAction;
      } catch {
        reply = responseText.trim() || reply;
      }

      return res.json({ reply, stopListening, changeShift, protoAction, fieldAction, navigateTab, uiAction });
    } catch (err: any) {
      console.error('Megha AI route error:', err);
      return res.json({ reply: null, error: err.message });
    }
  });

  // Smog Section OCR: Extract Models starting with "HSO" and their Quantities
  app.post('/api/smog/extract-hso-models', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg' } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ success: false, error: 'Photo or imageBase64 is required.' });
      }

      const ai = getGenAI();
      if (!ai) {
        return res.status(503).json({ 
          success: false, 
          error: 'Gemini AI API key is not configured on server. Please check server settings.' 
        });
      }

      // Clean base64 string
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '').trim();

      const prompt = `You are an expert industrial OCR vision specialist analyzing a manufacturing production plan, whiteboard, screen, paper sheet, or AC unit label.

TASK: Extract EVERY SINGLE outdoor AC model and its production quantity.

CRITICAL INSTRUCTIONS:
1. SCAN ALL ROWS THOROUGHLY (DO NOT STOP AT 3!):
   - In this factory, production boards commonly list 4 or more outdoor model rows (e.g. 18, 24, 36, 52 tonnage variants like HSO18-3NB, HSO24-3NB, HSO36-3NB, HSO52-3NB).
   - If there are 4 rows visible in the photo, YOU MUST RETURN ALL 4 ROWS! Do NOT drop the 4th row! Check all rows right to the bottom of the table/sheet.
   - Even if the 4th row has quantity 0, blank, pending, or is slightly tilted/faint, YOU MUST STILL RETURN IT!
2. MODEL NAME MATCHING & NORMALIZATION:
   - All outdoor models in this section belong to the HSO series.
   - If a row explicitly has "HSO" (e.g. "HSO18-3NB", "HSO24-3", "HSO17-3NB", "HSO52-3NB", "HSO 18", "HS036"), normalize to "HSO...".
   - If subsequent rows omit "HSO" and only write the tonnage or model code (e.g. "52-3NB", "52", "36-3", "24-3NB", "18-3"), YOU MUST PREPEND "HSO" so it becomes "HSO52-3NB" or "HSO52". NEVER omit a model just because "HSO" was not repeatedly printed on that row!
   - If "HSO" looks like "HS0" (digit zero) or "H S O", normalize it to "HSO".
   - Strip row numbering prefixes like "1.", "2)", "Row 3:", "4.", "#4", "[4]". Return only the clean model name.
   - Ignore indoor units starting with "HSI" or "HTO".
3. QUANTITY EXTRACTION:
   - Look for the associated production quantity (Target, Plan, Qty, Count, or numbers like "(450)", "120", "100", "50", "40").
   - Return clean positive integer for qty. If quantity is missing or blank or zero, set qty to 1. NEVER drop a model because of quantity!
4. PRESERVE EVERY ROW:
   - Every single outdoor model row detected in the photo must be its own object in the array. If 4 rows exist, output exactly 4 objects.`;

      const imagePart = {
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: cleanBase64
        }
      };
      const textPart = {
        text: prompt
      };

      // Ultra-fast responsive models: gemini-flash-lite-latest answers in ~750ms-1s without 503 errors
      const modelsToTry = ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-3.5-flash'];
      let extractedData: Array<{ modelName: string; qty: number; prQty: number }> = [];
      let lastError: string | null = null;

      const formatFriendlyErrorMessage = (raw: string | null): string => {
        if (!raw) return 'Photo me se "HSO" models extract nahi ho sake. Kripya HSO models wali photo lein ya "+ Add Model" se manually enter karein.';
        if (raw.includes('503') || raw.includes('high demand') || raw.includes('UNAVAILABLE')) {
          return 'AI service temporarily busy hai. Kripya dobara photo click karein ya "+ Add Model" se enter karein.';
        }
        if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
          return 'AI request limit reached. Kripya thoda wait karke dobara koshish karein.';
        }
        return 'Photo me "HSO" models recognize nahi ho sake. Kripya "+ Add Model" se manually model enter karein.';
      };

      const cleanAndExtractModelName = (raw: string): string | null => {
        if (!raw || typeof raw !== 'string') return null;
        let str = raw.trim();
        // Normalize variations: "H S O", "H-S-O", "H.S.O", "H S 0", "HS0"
        str = str.replace(/H\s*[\.\-_]?\s*S\s*[\.\-_]?\s*[O0]/gi, 'HSO');
        // Strip common row numbering prefixes like "1.", "2)", "Row 4:", "4 - ", "#4 ", "[4]" safely without eating model digits
        str = str.replace(/^([1-9]\s*[\.\)]\s*|[1-9]\s*[-]\s+|row\s*\d+[\:\-]?\s*|\#\d+\s*|\[\d+\]\s*)/i, '').trim();
        
        // Match HSO model pattern
        const hsoMatch = str.match(/HSO[A-Za-z0-9_\-:\.\/\s]*/i);
        if (hsoMatch) {
          let clean = hsoMatch[0].trim();
          clean = clean.replace(/^HSO[\s\-_:]+/i, 'HSO');
          clean = clean.replace(/[:\-_\.\,\s\/]+$/, '');
          const upper = clean.toUpperCase().replace(/\s+/g, '');
          if (upper.startsWith('HSO') && upper.length >= 4) return upper;
        }

        // If no HSO prefix but looks like an AC model number (e.g. "18-3NB", "24-3", "52-3NB", "52")
        const numMatch = str.match(/\b(\d{2}[A-Za-z0-9_\-:\.\/]*)\b/);
        if (numMatch) {
          const candidate = ('HSO' + numMatch[1]).toUpperCase().replace(/\s+/g, '');
          if (candidate.length >= 5) return candidate;
        }
        return null;
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
          // 5-second timeout per model so it never hangs
          const apiPromise = ai.models.generateContent({
            model,
            contents: { parts: [imagePart, textPart] },
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    modelName: { type: 'string' },
                    qty: { type: 'integer' }
                  },
                  required: ['modelName', 'qty']
                }
              }
            }
          });

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout on model ${model}`)), 5000)
          );

          const response: any = await Promise.race([apiPromise, timeoutPromise]);

          if (response && response.text) {
            let cleaned = response.text.trim();
            if (cleaned.startsWith('```json')) {
              cleaned = cleaned.replace(/^```json/i, '').replace(/```$/g, '').trim();
            } else if (cleaned.startsWith('```')) {
              cleaned = cleaned.replace(/^```/g, '').replace(/```$/g, '').trim();
            }

            let parsed: any = null;
            try {
              parsed = JSON.parse(cleaned);
            } catch {
              const match = cleaned.match(/\[[\s\S]*\]/);
              if (match) {
                try {
                  parsed = JSON.parse(match[0]);
                } catch {}
              }
            }

            // Normalize parsed to an array of items
            let candidateList: any[] = [];
            if (Array.isArray(parsed)) {
              candidateList = parsed;
            } else if (parsed && typeof parsed === 'object') {
              if (Array.isArray(parsed.models)) candidateList = parsed.models;
              else if (Array.isArray(parsed.items)) candidateList = parsed.items;
              else if (Array.isArray(parsed.data)) candidateList = parsed.data;
              else {
                // Key-value dictionary e.g. { "HSO18": 100, "HSO24": 200 }
                candidateList = Object.entries(parsed).map(([k, v]) => ({ modelName: k, qty: v }));
              }
            }

            if (candidateList.length > 0) {
              const items: Array<{ modelName: string; qty: number; prQty: number }> = [];

              for (const item of candidateList) {
                if (!item) continue;
                const rawName = item.modelName || item.model || item.name || item.code || '';
                const cleanName = cleanAndExtractModelName(String(rawName));
                if (!cleanName) continue;
                const qty = parseQuantity(item.prQty ?? item.qty ?? item.quantity ?? item.count);
                items.push({
                  modelName: cleanName,
                  qty,
                  prQty: qty
                });
              }

              if (items.length > 0) {
                extractedData = items;
                console.log(`[Smog OCR] Successfully extracted ${items.length} HSO models using ${model}`);
                break;
              }
            }
          }
        } catch (err: any) {
          const errMsg = err?.message || String(err);
          console.warn(`[Smog OCR] Model ${model} note:`, errMsg);
          lastError = errMsg;
        }

        if (extractedData.length > 0) {
          break;
        }
      }

      const totalQty = extractedData.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

      return res.json({
        success: extractedData.length > 0,
        items: extractedData,
        totalCount: extractedData.length,
        totalQty,
        note: extractedData.length === 0 ? formatFriendlyErrorMessage(lastError) : undefined
      });
    } catch (err: any) {
      console.error('Smog OCR extraction error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Error processing photo' });
    }
  });

  // Smog Qty Records server-side persistence fallback & backup
  const smogQtyBackupDir = path.join(process.cwd(), '.data');
  const smogQtyBackupFile = path.join(smogQtyBackupDir, 'smog_qty_records.json');

  const getSmogQtyBackup = (): any[] => {
    try {
      if (fs.existsSync(smogQtyBackupFile)) {
        const raw = fs.readFileSync(smogQtyBackupFile, 'utf-8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.warn('Could not read smog qty backup file:', e);
    }
    return [];
  };

  const saveSmogQtyBackup = (records: any[]) => {
    try {
      if (!fs.existsSync(smogQtyBackupDir)) {
        fs.mkdirSync(smogQtyBackupDir, { recursive: true });
      }
      fs.writeFileSync(smogQtyBackupFile, JSON.stringify(records, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Could not write smog qty backup file:', e);
    }
  };

  // Sync / Save Smog Qty record to server backup
  app.post('/api/smog/sync-qty-record', (req, res) => {
    try {
      const record = req.body;
      if (!record || !record.date || !record.shift) {
        return res.status(400).json({ success: false, error: 'Date and Shift are required' });
      }
      const records = getSmogQtyBackup();
      const existingIdx = records.findIndex(r => r.date === record.date && r.shift === record.shift);
      if (existingIdx >= 0) {
        records[existingIdx] = {
          ...records[existingIdx],
          ...record,
          updatedAt: new Date().toISOString()
        };
      } else {
        records.unshift({
          ...record,
          createdAt: record.createdAt || new Date().toISOString()
        });
      }
      saveSmogQtyBackup(records);
      return res.json({ success: true, count: records.length });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // Retrieve all Smog Qty records from server backup
  app.get('/api/smog/qty-records', (_req, res) => {
    try {
      const records = getSmogQtyBackup();
      return res.json({ success: true, records });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // ========================================================
  // Proto, PP, and Field Units Server-Side Persistence & Live Hours Reduction
  // ========================================================
  const protoUnitsBackupFile = path.join(smogQtyBackupDir, 'proto_units.json');
  const ppUnitsBackupFile = path.join(smogQtyBackupDir, 'pp_units.json');
  const fieldUnitsBackupFile = path.join(smogQtyBackupDir, 'field_units.json');

  const getUnitsFile = (filePath: string): any[] => {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.warn(`Could not read backup file ${filePath}:`, e);
    }
    return [];
  };

  const saveUnitsFile = (filePath: string, list: any[]) => {
    try {
      if (!fs.existsSync(smogQtyBackupDir)) {
        fs.mkdirSync(smogQtyBackupDir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.warn(`Could not write backup file ${filePath}:`, e);
    }
  };

  const formatToYYYYMMDDHHMM = (d: Date): string => {
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const hr = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yr}-${mo}-${da} ${hr}:${mi}`;
  };

  const upsertUnitInFile = (filePath: string, unit: any) => {
    if (!unit || !unit.id) return [];
    const list = getUnitsFile(filePath);
    const idx = list.findIndex(u => u.id === unit.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...unit, updatedAt: unit.updatedAt || new Date().toISOString() };
    } else {
      list.unshift({ ...unit, createdAt: unit.createdAt || new Date().toISOString() });
    }
    saveUnitsFile(filePath, list);
    return list;
  };

  // Proto units endpoints
  app.get('/api/units/proto', (_req, res) => {
    res.json({ success: true, units: getUnitsFile(protoUnitsBackupFile) });
  });

  app.post('/api/units/proto/sync', (req, res) => {
    try {
      const payload = req.body;
      if (Array.isArray(payload)) {
        const list = getUnitsFile(protoUnitsBackupFile);
        const map = new Map(list.map(u => [u.id, u]));
        payload.forEach(u => {
          if (u && u.id) map.set(u.id, { ...map.get(u.id), ...u });
        });
        const merged = Array.from(map.values());
        saveUnitsFile(protoUnitsBackupFile, merged);
        return res.json({ success: true, count: merged.length });
      }
      const updated = upsertUnitInFile(protoUnitsBackupFile, payload);
      return res.json({ success: true, count: updated.length });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.delete('/api/units/proto/:id', (req, res) => {
    try {
      const list = getUnitsFile(protoUnitsBackupFile).filter(u => u.id !== req.params.id);
      saveUnitsFile(protoUnitsBackupFile, list);
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // PP units endpoints
  app.get('/api/units/pp', (_req, res) => {
    res.json({ success: true, units: getUnitsFile(ppUnitsBackupFile) });
  });

  app.post('/api/units/pp/sync', (req, res) => {
    try {
      const payload = req.body;
      if (Array.isArray(payload)) {
        const list = getUnitsFile(ppUnitsBackupFile);
        const map = new Map(list.map(u => [u.id, u]));
        payload.forEach(u => {
          if (u && u.id) map.set(u.id, { ...map.get(u.id), ...u });
        });
        const merged = Array.from(map.values());
        saveUnitsFile(ppUnitsBackupFile, merged);
        return res.json({ success: true, count: merged.length });
      }
      const updated = upsertUnitInFile(ppUnitsBackupFile, payload);
      return res.json({ success: true, count: updated.length });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.delete('/api/units/pp/:id', (req, res) => {
    try {
      const list = getUnitsFile(ppUnitsBackupFile).filter(u => u.id !== req.params.id);
      saveUnitsFile(ppUnitsBackupFile, list);
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // Field units endpoints
  app.get('/api/units/field', (_req, res) => {
    res.json({ success: true, units: getUnitsFile(fieldUnitsBackupFile) });
  });

  app.post('/api/units/field/sync', (req, res) => {
    try {
      const payload = req.body;
      if (Array.isArray(payload)) {
        const list = getUnitsFile(fieldUnitsBackupFile);
        const map = new Map(list.map(u => [u.id, u]));
        payload.forEach(u => {
          if (u && u.id) map.set(u.id, { ...map.get(u.id), ...u });
        });
        const merged = Array.from(map.values());
        saveUnitsFile(fieldUnitsBackupFile, merged);
        return res.json({ success: true, count: merged.length });
      }
      const updated = upsertUnitInFile(fieldUnitsBackupFile, payload);
      return res.json({ success: true, count: updated.length });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.delete('/api/units/field/:id', (req, res) => {
    try {
      const list = getUnitsFile(fieldUnitsBackupFile).filter(u => u.id !== req.params.id);
      saveUnitsFile(fieldUnitsBackupFile, list);
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // Unified Live Unit Hours Reduction Endpoint
  app.post('/api/units/reduce-live-hours', (req, res) => {
    try {
      const { sections = [], hoursToDeduct = 0, clientUnits = {} } = req.body;
      const deductNum = parseFloat(hoursToDeduct);
      if (isNaN(deductNum) || deductNum <= 0) {
        return res.status(400).json({ success: false, error: 'Valid positive hoursToDeduct is required.' });
      }

      const nowMs = Date.now();
      let protoAffected = 0;
      let ppAffected = 0;
      let fieldAffected = 0;

      let updatedProto: any[] = [];
      let updatedPp: any[] = [];
      let updatedField: any[] = [];

      // 1. Proto Units Reduction
      if (sections.includes('proto')) {
        let protos = getUnitsFile(protoUnitsBackupFile);
        if (Array.isArray(clientUnits?.proto) && clientUnits.proto.length > 0) {
          const map = new Map(protos.map(u => [u.id, u]));
          clientUnits.proto.forEach((cu: any) => {
            if (cu && cu.id) map.set(cu.id, { ...(map.get(cu.id) || {}), ...cu });
          });
          protos = Array.from(map.values());
        }
        for (let i = 0; i < protos.length; i++) {
          const u = protos[i];
          if (u && u.status === 'live') {
            const currentDone = typeof u.doneHour === 'number' ? u.doneHour : (parseFloat(String(u.doneHour || 0)) || 0);
            if (currentDone >= deductNum) {
              u.doneHour = Math.max(0, currentDone - deductNum);
            } else {
              const rem = deductNum - currentDone;
              let createdMs = NaN;
              if (u.createdAt) {
                createdMs = new Date(u.createdAt.replace(' ', 'T')).getTime();
                if (isNaN(createdMs)) createdMs = new Date(u.createdAt).getTime();
              }
              if (isNaN(createdMs)) createdMs = nowMs;
              const newCreatedMs = Math.min(nowMs, createdMs + rem * 3600 * 1000);
              const newCreatedAt = formatToYYYYMMDDHHMM(new Date(newCreatedMs));
              u.doneHour = 0;
              u.createdAt = newCreatedAt;
              if (u.reportDetails) {
                u.reportDetails.testCommenced = newCreatedAt;
              }
            }
            u.updatedAt = new Date().toISOString();
            protoAffected++;
          }
        }
        if (protos.length > 0) {
          saveUnitsFile(protoUnitsBackupFile, protos);
        }
        updatedProto = protos;
      }

      // 2. PP Units Reduction
      if (sections.includes('pp')) {
        let pps = getUnitsFile(ppUnitsBackupFile);
        if (Array.isArray(clientUnits?.pp) && clientUnits.pp.length > 0) {
          const map = new Map(pps.map(u => [u.id, u]));
          clientUnits.pp.forEach((cu: any) => {
            if (cu && cu.id) map.set(cu.id, { ...(map.get(cu.id) || {}), ...cu });
          });
          pps = Array.from(map.values());
        }
        for (let i = 0; i < pps.length; i++) {
          const u = pps[i];
          if (u && u.status === 'live') {
            const currentDone = typeof u.doneHour === 'number' ? u.doneHour : (parseFloat(String(u.doneHour || 0)) || 0);
            if (currentDone >= deductNum) {
              u.doneHour = Math.max(0, currentDone - deductNum);
            } else {
              const rem = deductNum - currentDone;
              let createdMs = NaN;
              if (u.createdAt) {
                createdMs = new Date(u.createdAt.replace(' ', 'T')).getTime();
                if (isNaN(createdMs)) createdMs = new Date(u.createdAt).getTime();
              }
              if (isNaN(createdMs)) createdMs = nowMs;
              const newCreatedMs = Math.min(nowMs, createdMs + rem * 3600 * 1000);
              const newCreatedAt = formatToYYYYMMDDHHMM(new Date(newCreatedMs));
              u.doneHour = 0;
              u.createdAt = newCreatedAt;
              if (u.reportDetails) {
                u.reportDetails.testCommenced = newCreatedAt;
              }
            }
            u.updatedAt = new Date().toISOString();
            ppAffected++;
          }
        }
        if (pps.length > 0) {
          saveUnitsFile(ppUnitsBackupFile, pps);
        }
        updatedPp = pps;
      }

      // 3. Field Units Reduction
      if (sections.includes('field')) {
        let fields = getUnitsFile(fieldUnitsBackupFile);
        if (Array.isArray(clientUnits?.field) && clientUnits.field.length > 0) {
          const map = new Map(fields.map(u => [u.id, u]));
          clientUnits.field.forEach((cu: any) => {
            if (cu && cu.id) map.set(cu.id, { ...(map.get(cu.id) || {}), ...cu });
          });
          fields = Array.from(map.values());
        }
        for (let i = 0; i < fields.length; i++) {
          const u = fields[i];
          if (u && u.status === 'live') {
            const currentDone = typeof u.doneHour === 'number' ? u.doneHour : (parseFloat(String(u.doneHour || 0)) || 0);
            if (currentDone >= deductNum) {
              u.doneHour = Math.max(0, currentDone - deductNum);
            } else {
              const rem = deductNum - currentDone;
              const startRaw = u.startDateTime || u.createdAt || '';
              let startMs = NaN;
              if (startRaw) {
                startMs = new Date(startRaw.replace(' ', 'T')).getTime();
                if (isNaN(startMs)) startMs = new Date(startRaw).getTime();
              }
              if (isNaN(startMs)) startMs = nowMs;
              const newStartMs = Math.min(nowMs, startMs + rem * 3600 * 1000);
              const newStartFormatted = formatToYYYYMMDDHHMM(new Date(newStartMs));
              u.doneHour = 0;
              u.startDateTime = newStartFormatted;
              u.createdAt = newStartFormatted;
            }
            u.updatedAt = new Date().toISOString();
            fieldAffected++;
          }
        }
        if (fields.length > 0) {
          saveUnitsFile(fieldUnitsBackupFile, fields);
        }
        updatedField = fields;
      }

      const totalAffected = protoAffected + ppAffected + fieldAffected;
      return res.json({
        success: true,
        affectedCount: totalAffected,
        summary: {
          proto: protoAffected,
          pp: ppAffected,
          field: fieldAffected
        },
        deductedHours: deductNum,
        updatedProto,
        updatedPp,
        updatedField
      });
    } catch (e: any) {
      console.error('Error in reduce-live-hours route:', e);
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
