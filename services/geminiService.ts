import { LabelExtractionResult } from "../types";

export async function extractLabelInfo(base64Image: string): Promise<LabelExtractionResult> {
  try {
    const response = await fetch('/api/extract-label', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64Image }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "เกิดข้อผิดพลาดในการประมวลผลรูปภาพ");
    }

    return await response.json();
  } catch (error: any) {
    console.error("Client API Error:", error);
    throw error;
  }
}
