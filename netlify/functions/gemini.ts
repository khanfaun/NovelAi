import { Handler } from "@netlify/functions";
import { GoogleGenAI } from "@google/genai";

export const handler: Handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { model = "gemini-2.5-flash", contents, config } = body;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model,
      contents,
      config,
    });

    // trả về đối tượng có field `text` giống như cái mà frontend đang mong
    return {
      statusCode: 200,
      body: JSON.stringify({ text: response.text }),
    };
  } catch (err: any) {
    console.error("Gemini function error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err?.message ?? String(err) }),
    };
  }
};
