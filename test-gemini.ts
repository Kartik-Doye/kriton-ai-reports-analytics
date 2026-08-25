import { GoogleGenAI, Type } from '@google/genai';

async function run() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt1 = `You are a data-cleaning planner.`;
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt1,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            columns: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                }
              }
            }
          }
        }
      }
    });
    console.log(res.text);
  } catch(e: any) {
    console.error('Error:', e.status, e.message);
  }
}
run();
