import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-pro-latest'];
  for (const m of models) {
    try {
      const r = await ai.models.generateContent({ model: m, contents: 'hi' });
      console.log(m, "SUCCESS", r.text);
    } catch (e: any) {
      console.log(m, "ERROR", e.status, e.message);
    }
  }
}
test();
