import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  const models = ['gemini-3.6-flash', 'gemini-3.6-pro', 'gemini-pro-latest'];
  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        model: model,
        contents: 'hello'
      });
      console.log(model + " success: " + res.text);
    } catch (e: any) {
      console.log(model + " error: " + e.status + " " + e.message);
    }
  }
}
test();
