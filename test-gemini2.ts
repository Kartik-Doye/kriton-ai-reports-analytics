import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
ai.models.generateContent({ model: 'gemini-3.7-flash', contents: 'hi' })
  .then(r => console.log(r.text))
  .catch(e => console.log(e.status, e.message));
