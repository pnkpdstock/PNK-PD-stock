
import { GoogleGenAI, Type } from "@google/genai";
import { LabelExtractionResult } from "../types";

export async function extractLabelInfo(base64Image: string): Promise<LabelExtractionResult> {
  // Use process.env.API_KEY directly as per guidelines
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("Gemini API Key is missing in environment variables.");
    throw new Error("ไม่พบ API Key ในระบบกรุณาตรวจสอบการตั้งค่า");
  }

  // Initialize with named parameter
  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze the product label in this image and extract the following information.
    The label is likely for a medical product (e.g., peritoneal dialysis solution).
    Return the data in a strict JSON format.
    
    Fields to extract:
    1. thaiName: The Thai name of the product (e.g., น้ำยาล้างไตทางช่องท้อง).
    2. englishName: The English name of the product.
    3. batchNo: The Batch number (often labeled as "Batch No.", "Lot", "LOT NO").
    4. mfd: Manufacture date. Return in YYYY-MM-DD format if possible.
    5. exp: Expiry date. Return in YYYY-MM-DD format if possible.
    6. manufacturer: The name of the manufacturing company.
    
    If any field is not found, return an empty string for that field.
    Only return the JSON object, do not include any explanatory text or markdown blocks.
  `;

  try {
    const imageData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    
    // Call generateContent with model and contents in one step
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: imageData
            }
          }
        ]
      },
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

    // Access .text property directly (not a method) as per guidelines
    let text = response.text || "{}";
    
    // Fallback cleanup if model returns markdown despite responseMimeType
    if (text.includes('```')) {
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    }

    try {
      return JSON.parse(text) as LabelExtractionResult;
    } catch (parseError) {
      console.error("JSON Parse Error. Raw Text:", text);
      throw new Error("AI ส่งข้อมูลในรูปแบบที่อ่านไม่ได้ กรุณาลองถ่ายใหม่อีกครั้ง");
    }
  } catch (error: any) {
    console.error("Gemini API Full Error:", error);
    
    let userFriendlyMessage = "ไม่สามารถประมวลผลฉลากได้ กรุณาตรวจสอบว่ารูปภาพชัดเจนและมีแสงสว่างเพียงพอ";
    
    if (error.message?.includes('401')) {
      userFriendlyMessage = "API Key ไม่ถูกต้อง หรือไม่ได้ตั้งค่าใน Production";
    } else if (error.message?.includes('429')) {
      userFriendlyMessage = "ใช้งานเกินขีดจำกัด (Rate Limit) กรุณารอสักครู่แล้วลองใหม่";
    } else if (error.message?.includes('Safety')) {
      userFriendlyMessage = "รูปภาพถูกบล็อกโดยระบบความปลอดภัยของ AI กรุณาถ่ายเฉพาะส่วนที่เป็นข้อความฉลาก";
    }

    throw new Error(userFriendlyMessage);
  }
}
