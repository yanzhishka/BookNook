
import { GoogleGenAI } from "@google/genai";
import { ImageSize, AspectRatio } from "../types";

// Fix: Obtaining API key exclusively from process.env.API_KEY as per guidelines
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API Key not found. Please connect your API key via the Studio.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateSceneImage = async (
  prompt: string,
  size: ImageSize,
  aspectRatio: AspectRatio
): Promise<string> => {
  // Fix: Create instance right before API call
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

    // Fix: Iterating through parts to find the image part
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
  // Fix: Create instance right before API call
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

    // Fix: Iterating through parts to find the image part
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

// Fix: Updated checkAndRequestApiKey to use process.env.API_KEY and follow Veo guidelines
export const checkAndRequestApiKey = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  
  const aiStudio = window.aistudio;
  if (!aiStudio) return !!process.env.API_KEY;

  try {
    const hasKey = await aiStudio.hasSelectedApiKey();
    if (!hasKey) {
      await aiStudio.openSelectKey();
      // Fix: Assume key selection was successful after triggering openSelectKey()
      return true;
    }
    return true;
  } catch (e) {
    console.error("Error checking/requesting API key", e);
    return false;
  }
};
