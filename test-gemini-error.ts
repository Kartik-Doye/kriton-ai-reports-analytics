import { GoogleGenAI } from '@google/genai';

async function run() {
  const ai = new GoogleGenAI({ apiKey: 'invalid_key' });
  try {
    await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: 'Hello',
    });
  } catch(e: any) {
    console.log(Object.keys(e));
    console.log('status:', e.status);
    console.log('code:', e.code);
    console.log('statusCode:', e.statusCode);
  }
}
run();
