import { LabelExtractionResult } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini on the client side as per AI Studio Build best practices
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export async function extractLabelInfo(base64Image: string): Promise<LabelExtractionResult> {
  if (!ai) {
    throw new Error("Gemini API Key is not configured in the environment.");
  }

  try {
    const prompt = `คุณเป็นผู้เชี่ยวชาญด้านคลังยา (Pharmacist Assistant) หน้าที่ของคุณคือสกัดข้อมูลจากรูปภาพฉลากถุงหรือกล่องน้ำยาล้างไต (PD Fluid)
    และส่งกลับเป็น JSON เท่านั้น โดยมีฟิลด์ดังนี้:
    - thaiName: ชื่อภาษาไทย (เช่น น้ำยาล้างไต 2.5% PD-2, น้ำยาล้างไต 1.5% PD-4)
    - englishName: ชื่อภาษาอังกฤษ (เช่น Dianeal PD-2, Dianeal PD-4 Low Calcium, CAPD/DPCA 19)
    - batchNo: เลข Lot หรือ Batch Number (เช่น A25U100, A26B079, GGHH 051 C)
    - mfd: วันที่ผลิต (รูปแบบ YYYY-MM-DD)
    - exp: วันหมดอายุ (รูปแบบ YYYY-MM-DD)
    - manufacturer: บริษัทผู้ผลิต (Vantive, Baxter, Fresenius)
    
    **กฎการวิเคราะห์จากสีและยี่ห้อ (Focus on Color & Brand):**
    1. สีส้ม (Orange): หมายถึงความเข้มข้น 4.25% (ใช้กับทุกยี่ห้อ)
    2. สีเขียว (Green): 
       - หากเป็นยี่ห้อ Baxter หรือ Vantive จะเป็นความเข้มข้น 2.5%
       - หากเป็นยี่ห้อ Fresenius จะเป็นความเข้มข้น 2.3%
    3. สีเหลือง (Yellow): หมายถึงความเข้มข้น 1.5% (ใช้กับทุกยี่ห้อ)

    ตัวอย่างการสกัดข้อมูล:
    1. ฉลากเขียว Baxter/Vantive: englishName="Dianeal PD-2", thaiName="น้ำยาล้างไต 2.5% PD-2", manufacturer="Baxter"
    2. ฉลากฟ้า/เหลือง PD-4: englishName="Dianeal PD-4 Low Calcium", thaiName="น้ำยาล้างไต 1.5% PD-4"
    3. ฉลากส้ม: thaiName="น้ำยาล้างไต 4.25%", englishName="Dianeal PD-4"
    4. ฉลาก Fresenius เขียว: thaiName="CAPD/DPCA 19 (2.3% Glucose)", englishName="CAPD/DPCA 19", manufacturer="Fresenius"

    กฎสำคัญ:
    - ให้ความสำคัญกับ "สีของแถบสีบนฉลาก" เพื่อยืนยันความเข้มข้น
    - หากข้อมูลฟิลด์ไหนไม่พบ ให้ใส่ค่าว่าง ""
    - ส่งข้อมูลกลับมาในรูปแบบ JSON Object เท่านั้น ห้ามมี Markdown block`;

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
          },
          required: ["thaiName", "englishName", "batchNo", "mfd", "exp", "manufacturer"]
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
