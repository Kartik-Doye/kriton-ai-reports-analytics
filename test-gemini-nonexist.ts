import { GoogleGenAI } from '@google/genai';

async function run() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    await ai.models.generateContent({
      model: 'gemini-nonexist',
      contents: 'Hello',
    });
  } catch(e: any) {
    console.log('status:', e.status);
    console.log('message:', e.message);
  }
}
run();
