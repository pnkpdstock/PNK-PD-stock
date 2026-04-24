import { LabelExtractionResult } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini with robust key detection and sanitization
const getApiKey = () => {
  // 1. Try standard process.env (AI Studio Build injected)
  // 2. Try Vite's VITE_ prefix (Standard for Vercel/Vite)
  // 3. Try import.meta.env (Fallback)
  const rawKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY || (import.meta as any).env.GEMINI_API_KEY;
  
  if (!rawKey) return null;

  // Cleanup: Remove quotes and whitespace that often get added in Vercel settings
  const cleanKey = String(rawKey).trim().replace(/^["']|["']$/g, '');
  
  // Basic validation: Google API keys usually start with AIza
  if (cleanKey.length < 10) {
    console.warn("⚠️ Gemini API Key seems too short. Found length:", cleanKey.length);
  }
  
  return cleanKey;
};

const apiKey = getApiKey();
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

if (apiKey) {
  console.log("🚀 Gemini API initialized with key length:", apiKey.length, "starts with:", apiKey.substring(0, 4));
}

export async function extractLabelInfo(base64Image: string): Promise<LabelExtractionResult> {
  if (!ai) {
    throw new Error("Gemini API Key is not configured in the environment.");
  }

  try {
    const prompt = `คุณเป็นผู้เชี่ยวชาญด้านคลังยา (Pharmacist Assistant) หน้าที่ของคุณคือสกัดข้อมูลจากรูปภาพฉลากถุงหรือกล่องน้ำยาล้างไต (PD Fluid)
    และส่งกลับเป็น JSON เท่านั้น โดยมีฟิลด์ดังนี้:
    - thaiName: ชื่อภาษาไทย (เช่น น้ำยาล้างไต 2.5% PD-2)
    - englishName: ชื่อภาษาอังกฤษ (เช่น Dianeal PD-2)
    - batchNo: เลข Lot หรือ Batch Number
    - mfd: วันที่ผลิต (YYYY-MM-DD)
    - exp: วันหมดอายุ (YYYY-MM-DD)
    - manufacturer: บริษัทผู้ผลิต (Vantive, Baxter, Fresenius, Lucenxia)
    - aiSearchName: รหัส 3 หลักที่สร้างตามกฎดังนี้:

    **กฎการสร้าง aiSearchName (3 ตัวอักษร):**
    1. **ตัวอักษรที่ 1 (ยี่ห้อ):**
       - 'V' หากพบคำว่า "Ventive" หรือ "Baxter" บนฉลาก
       - 'L' หากพบคำว่า "Lucenxia" (โดยเฉพาะส่วน "Imported by:")
       - 'F' หากไม่พบยี่ห้อข้างต้น (Fresenius)
    2. **ตัวอักษรที่ 2 (ประเภท/ปริมาตร):**
       - 'C' (CAPD) หากพบปริมาตร 2000 ml (เช่น 6 x 2000 ml หรือ 2000 ml x 4)
       - 'A' (APD) หากพบปริมาตร 5000 ml หรือ 6000 ml (เช่น 2 x 5000 ml)
    3. **ตัวอักษรที่ 3 (เปอร์เซ็นต์น้ำยา):**
       - '1' สำหรับความเข้มข้น 1.5% (หรือแถบสีเหลือง)
       - '2' สำหรับความเข้มข้น 2.5% (หรือแถบสีเขียวของ Baxter/Vantive)
       - '4' สำหรับความเข้มข้น 4.25% (หรือแถบสีส้ม)

    ตัวอย่าง: "VC1" (Vantive, CAPD 2000ml, 1.5%), "FA2" (Fresenius, APD 5000ml, 2.5%)

    **กฎการวิเคราะห์จากสี (Color Guide):**
    1. แถบสีส้ม (Orange): 4.25%
    2. แถบสีเขียว (Green): 2.5% (Baxter/Vantive) หรือ 2.3% (Fresenius -> ให้ปัดเป็น '2')
    3. แถบสีเหลือง (Yellow): 1.5%

    กฎสำคัญ:
    - ให้ความสำคัญกับตัวอักษร 3 หลัก aiSearchName มากที่สุด
    - หากข้อมูลฟิลด์ไหนไม่พบ ให้ใส่ค่าว่าง ""
    - ส่งข้อมูลกลับมาในรูปแบบ JSON Object เท่านั้น ห้มมี Markdown block`;

    // Remove the data URI prefix (e.g., "data:image/jpeg;base64,")
    const base64Data = base64Image.split(',')[1];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { text: prompt },
        {
          inlineData: {
            data: base64Data,
            mimeType: "image/jpeg"
          }
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            thaiName: { type: Type.STRING },
            englishName: { type: Type.STRING },
            batchNo: { type: Type.STRING },
            mfd: { type: Type.STRING },
            exp: { type: Type.STRING },
            manufacturer: { type: Type.STRING },
            aiSearchName: { type: Type.STRING },
          },
          required: ["thaiName", "englishName", "batchNo", "mfd", "exp", "manufacturer", "aiSearchName"]
        }
      }
    });

    if (!response.text) {
      throw new Error("AI returned an empty response.");
    }

    try {
      return JSON.parse(response.text.trim());
    } catch (e) {
      console.error("AI returned invalid JSON:", response.text);
      throw new Error("AI returned an invalid data format.");
    }
  } catch (error: any) {
    console.error("Gemini Client Error:", error);
    // Provide a more user-friendly error message
    if (error.message?.includes("API key not valid")) {
      throw new Error("ขออภัย ระบบขัดข้องเกี่ยวกับ API Key กรุณาลองใหม่อีกครั้งในภายหลัง");
    }
    throw new Error(error.message || "เกิดข้อผิดพลาดในการประมวลผลรูปภาพด้วย AI");
  }
}
