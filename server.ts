import express from 'express';
import path from 'path';
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

      const prompt = `You are an expert OCR vision specialist analyzing an industrial/manufacturing spreadsheet or filter screen.
Examine this image carefully.
Look at the list of models and their associated quantities (e.g. inside parentheses like "(900)" or in adjoining text/columns).

STRICT FILTERING REQUIREMENT:
- Extract ONLY the models whose model name starts with "HSO" (case-insensitive, e.g. "HSO17-3NB-I:AC", "HSO18-3NB-I:AC", "HSO19-5NB-I:AC", "HSO52-3NB-I:AC", "HSO52-5NB-I:AC", etc.).
- Completely IGNORE all other models such as those starting with "HSI" (e.g. HSI17N, HSI18CP, HSI19GHD, HSI52VP) or "HTO" or "(All)". ONLY EXTRACT MODELS STARTING WITH "HSO".
- For each matching HSO model, parse:
  1. "modelName": Exact model string starting with HSO (e.g. "HSO17-3NB-I:AC").
  2. "qty": The numerical quantity (integer) associated with that model, such as the number in parentheses (e.g., if it says "(900)", qty is 900; "(460)" -> 460).

OUTPUT FORMAT:
Return ONLY a valid JSON array of objects:
[
  { "modelName": "HSO17-3NB-I:AC", "qty": 900 },
  { "modelName": "HSO18-3NB-I:AC", "qty": 460 }
]
No backticks, no markdown, just clean raw JSON array.`;

      const imagePart = {
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: cleanBase64
        }
      };
      const textPart = {
        text: prompt
      };

      const modelsToTry = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
      let extractedData: Array<{ modelName: string; qty: number; prQty: number }> = [];
      let lastError: string | null = null;

      // Clean/sanitize error message to avoid exposing raw JSON/tracebacks to client
      const formatFriendlyErrorMessage = (raw: string | null): string => {
        if (!raw) return 'Photo me se model extract nahi ho sake. Kripya photo dobara lein ya "+ Add Model" se manually enter karein.';
        if (raw.includes('503') || raw.includes('high demand') || raw.includes('UNAVAILABLE')) {
          return 'AI service abhi temporarily busy hai. Kripya 3-5 second baad dobara try karein ya "+ Add Model" se enter karein.';
        }
        if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
          return 'AI request limit reached. Kripya thoda wait karke dobara koshish karein.';
        }
        if (raw.includes('400') || raw.includes('INVALID_ARGUMENT') || raw.includes('Unable to process input image')) {
          return 'Photo clear nahi thi ya readable nahi hai. Kripya clear photo lein ya "+ Add Model" se enter karein.';
        }
        return 'Photo me models recognize nahi ho sake. Kripya "+ Add Model" se manually model enter karein.';
      };

      for (const model of modelsToTry) {
        // Try up to 2 attempts per model with a small delay on transient 503
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const response = await ai.models.generateContent({
              model,
              contents: { parts: [imagePart, textPart] },
              config: {
                responseMimeType: 'application/json'
              }
            });

            if (response && response.text) {
              let cleaned = response.text.trim();
              if (cleaned.startsWith('```json')) {
                cleaned = cleaned.replace(/^```json/i, '').replace(/```$/g, '').trim();
              } else if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/^```/g, '').replace(/```$/g, '').trim();
              }

              const parsed = JSON.parse(cleaned);
              if (Array.isArray(parsed)) {
                extractedData = parsed
                  .filter(item => item && typeof item.modelName === 'string' && item.modelName.trim().toUpperCase().startsWith('HSO'))
                  .map(item => {
                    const q = Math.max(1, parseInt(String(item.prQty ?? item.qty), 10) || 0);
                    return {
                      modelName: item.modelName.trim().toUpperCase(),
                      qty: q,
                      prQty: q
                    };
                  });
                if (extractedData.length > 0) {
                  break;
                }
              }
            }
          } catch (err: any) {
            const errMsg = err?.message || String(err);
            console.warn(`[Smog OCR] Model ${model} attempt ${attempt + 1} note:`, errMsg);
            lastError = errMsg;
            // If it's a 503 high-demand spike, wait 700ms before retry or next model
            if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE')) {
              await new Promise(r => setTimeout(r, 700));
            }
          }
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
