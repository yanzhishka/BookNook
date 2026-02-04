

import { GoogleGenAI, Type } from "@google/genai";
import { UserArchetype, ImageSize, AspectRatio } from "../types";

export const analyzeReadingArchetype = async (
  books: { title: string; author: string }[],
  annotations: string[]
): Promise<UserArchetype> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Проанализируй читательский профиль. Книги: ${books.map(b => b.title).join(', ')}. Заметки: ${annotations.join(' | ')}. 
      Определи "Литературный Архетип" пользователя. Придумай поэтичное название, описание (2-3 предложения), 3 ключевых качества, подходящий цвет (hex) и один эмодзи. 
      Ответь строго в формате JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            traits: { type: Type.ARRAY, items: { type: Type.STRING } },
            color: { type: Type.STRING },
            icon: { type: Type.STRING }
          },
          required: ["title", "description", "traits", "color", "icon"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return result as UserArchetype;
  } catch (error) {
    console.error("Archetype Analysis Error:", error);
    throw error;
  }
};

// Added generateSceneImage for AI image generation based on user prompt and config
export const generateSceneImage = async (
  prompt: string,
  size: ImageSize = '1K',
  ratio: AspectRatio = '1:1'
): Promise<string> => {
  // Use gemini-3-pro-image-preview for high quality (2K/4K), otherwise use gemini-2.5-flash-image
  const model = size === '1K' ? 'gemini-2.5-flash-image' : 'gemini-3-pro-image-preview';
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const config: any = {
    imageConfig: {
      aspectRatio: ratio,
    }
  };

  // imageSize is only supported for gemini-3-pro-image-preview
  if (model === 'gemini-3-pro-image-preview') {
    config.imageConfig.imageSize = size;
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [{ text: prompt }] },
      config
    });

    // Iterate through response parts to find the image data
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data returned from model");
  } catch (error) {
    console.error("generateSceneImage Error:", error);
    throw error;
  }
};

// Added editBookImage for AI image editing using text instructions and an existing image
export const editBookImage = async (
  base64Data: string,
  mimeType: string,
  prompt: string
): Promise<string> => {
  // Editing defaults to gemini-2.5-flash-image
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    });

    // Iterate through response parts to find the edited image data
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No edited image data returned from model");
  } catch (error) {
    console.error("editBookImage Error:", error);
    throw error;
  }
};

export const checkAndRequestApiKey = async (): Promise<boolean> => {
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
  return !!process.env.API_KEY;
};
