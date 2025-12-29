
import { GoogleGenAI } from "@google/genai";
import { ImageSize, AspectRatio } from "../types";

// Универсальный способ получения ключа
const getApiKey = () => {
  return process.env.API_KEY || (window as any).VITE_API_KEY;
};

const getAiClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key not found. Please set API_KEY environment variable.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateSceneImage = async (
  prompt: string,
  size: ImageSize,
  aspectRatio: AspectRatio
): Promise<string> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: prompt }]
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
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data returned.");
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
  try {
    const ai = getAiClient();
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
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No edited image returned.");
  } catch (error) {
    console.error("Image Editing Error:", error);
    throw error;
  }
};

export const checkAndRequestApiKey = async (): Promise<boolean> => {
  // Если ключ уже есть в переменных окружения, доступ разрешен
  if (getApiKey()) return true;
  
  // Если мы в среде AI Studio, пытаемся открыть диалог
  if (typeof window !== 'undefined' && (window as any).aistudio) {
    try {
      const aiStudio = (window as any).aistudio;
      const hasKey = await aiStudio.hasSelectedApiKey();
      if (!hasKey) {
        await aiStudio.openSelectKey();
        return true; 
      }
      return true;
    } catch (e) {
      return false;
    }
  }
  
  return false;
};
