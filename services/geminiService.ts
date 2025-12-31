
import { GoogleGenAI, Type } from "@google/genai";
import { ImageSize, AspectRatio, UserArchetype } from "../types";

export const analyzeReadingArchetype = async (
  books: { title: string; author: string }[],
  annotations: string[]
): Promise<UserArchetype> => {
  try {
    // Instantiate right before making the call to ensure latest API key
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

export const generateSceneImage = async (
  prompt: string,
  size: ImageSize,
  aspectRatio: AspectRatio
): Promise<string> => {
  try {
    // Instantiate right before making the call to ensure latest API key
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const isHighRes = size === '2K' || size === '4K';
    const model = isHighRes ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
    
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          // imageSize is only supported for gemini-3-pro-image-preview
          ...(model === 'gemini-3-pro-image-preview' ? { imageSize: size } : {}),
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
  } catch (error: any) {
    console.error("Image Generation Error:", error);
    // If request fails with entity not found, it might be due to missing/expired key for Pro model
    if (error.message?.includes("Requested entity was not found.")) {
        if (typeof window !== 'undefined' && (window as any).aistudio) {
            (window as any).aistudio.openSelectKey();
        }
    }
    throw error;
  }
};

export const editBookImage = async (
  base64Image: string,
  mimeType: string,
  prompt: string
): Promise<string> => {
  try {
    // Instantiate right before making the call
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
  if (typeof window !== 'undefined' && (window as any).aistudio) {
    try {
      const aiStudio = (window as any).aistudio;
      const hasKey = await aiStudio.hasSelectedApiKey();
      if (!hasKey) {
        // Guidelines: assume key selection was successful after triggering openSelectKey
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
