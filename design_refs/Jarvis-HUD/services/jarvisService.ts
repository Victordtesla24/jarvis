import { GoogleGenAI, ChatSession, GenerateContentStreamResult, Modality } from "@google/genai";
import { Message } from "../types";

const SYSTEM_INSTRUCTION = `
You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), the advanced AI assistant for Tony Stark (Iron Man).
Your personality is polite, witty, highly efficient, and technically precise.
You address the user as "Sir" or "Mr. Stark".
Keep responses concise and suitable for a Heads-Up Display (HUD).
If the user asks for system status, invent plausible technical metrics (e.g., Arc Reactor output, repulsor charge, armor integrity).
If analyzing an image, provide a tactical assessment of threats, objects, or location data.
Do not use markdown formatting like bold or headers excessively; keep it clean text.
`;

let ai: GoogleGenAI | null = null;
let chatSession: ChatSession | null = null;
let audioContext: AudioContext | null = null;

const getAI = () => {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
};

export const initializeChat = () => {
  const client = getAI();
  chatSession = client.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.7,
      maxOutputTokens: 200, // Keep HUD responses short
    },
  });
};

export const sendMessageToJarvis = async (
  text: string, 
  onChunk: (text: string) => void
): Promise<string> => {
  if (!chatSession) {
    initializeChat();
  }

  if (!chatSession) {
    throw new Error("Failed to initialize J.A.R.V.I.S.");
  }

  let fullResponse = "";
  try {
    const result: GenerateContentStreamResult = await chatSession.sendMessageStream({ message: text });
    
    for await (const chunk of result) {
      const chunkText = chunk.text;
      if (chunkText) {
        fullResponse += chunkText;
        onChunk(fullResponse);
      }
    }
  } catch (error) {
    console.error("J.A.R.V.I.S. Connection Error:", error);
    return "Error connecting to servers, Sir.";
  }
  
  return fullResponse;
};

export const analyzeImage = async (
  base64Image: string,
  prompt: string = "Perform a tactical scan of this visual feed."
): Promise<string> => {
  const client = getAI();
  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image
            }
          },
          { text: prompt }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION
      }
    });
    return response.text || "Scan inconclusive, Sir.";
  } catch (error) {
    console.error("Visual Scan Error:", error);
    return "Visual sensors malfunction, Sir.";
  }
};

export const speakText = async (text: string): Promise<void> => {
  const client = getAI();
  try {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Fenrir' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      await playAudio(base64Audio);
    }
  } catch (error) {
    console.error("TTS Error:", error);
  }
};

const playAudio = async (base64String: string) => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  const audioBuffer = await decodeAudioData(
    decode(base64String),
    audioContext,
    24000,
    1
  );
  
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start();
  
  // Return a promise that resolves when the audio finishes playing
  return new Promise<void>((resolve) => {
    source.onended = () => resolve();
  });
};

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
