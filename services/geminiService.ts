
import { GoogleGenAI } from "@google/genai";
import { ImageSize, AspectRatio } from "../types";

// Инициализируем клиент только в момент вызова, когда ключ уже точно выбран
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found. Please connect your API key.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateSceneImage = async (
  prompt: string,
  size: ImageSize,
  aspectRatio: AspectRatio
): Promise<string> => {
  const ai = getAiClient();
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          { text: prompt }
        ]
      },
      config: {
        imageConfig: {
          imageSize: size,
          aspectRatio: aspectRatio
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64 = part.inlineData.data;
        return `data:image/png;base64,${base64}`;
      }
    }
    throw new Error("No image data returned from model.");
  } catch (error) {
    console.error("Image Generation Error:", error);
    throw error;
  }
};

export const editBookImage = async (
  base64Image: string,
  mimeType: string,
  prompt: string
): Promise<string> => {
  const ai = getAiClient();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType
            }
          },
          { text: prompt }
        ]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64 = part.inlineData.data;
        return `data:image/png;base64,${base64}`;
      }
    }
    throw new Error("No edited image returned.");
  } catch (error) {
    console.error("Image Editing Error:", error);
    throw error;
  }
};

export const checkAndRequestApiKey = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  
  const aiStudio = window.aistudio;
  if (!aiStudio) return !!process.env.API_KEY;

  try {
    const hasKey = await aiStudio.hasSelectedApiKey();
    if (!hasKey) {
      await aiStudio.openSelectKey();
      return true; // Предполагаем успех после открытия диалога
    }
    return true;
  } catch (e) {
    console.error("Error checking/requesting API key", e);
    return false;
  }
};
