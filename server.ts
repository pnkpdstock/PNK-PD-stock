
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// API Endpoint for Secure Gemini Processing
app.post('/api/extract-label', async (req, res) => {
  try {
    const { image } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API Key is not configured on the server." });
    }

    const genAI = new GoogleGenAI({ apiKey });

    const prompt = `คุณเป็นผู้เชี่ยวชาญด้านคลังยา (Pharmacist Assistant) หน้าที่ของคุณคือสกัดข้อมูลจากรูปภาพฉลากถุงน้ำยาล้างไต (PD Fluid) 
    และส่งกลับเป็น JSON เท่านั้น โดยมีฟิลด์ดังนี้:
    - thaiName: ชื่อภาษาไทย (เช่น น้ำยาล้างไต 2.5%)
    - englishName: ชื่อภาษาอังกฤษ
    - batchNo: เลข Lot หรือ Batch Number
    - mfd: วันที่ผลิต (รูปแบบ YYYY-MM-DD)
    - exp: วันหมดอายุ (รูปแบบ YYYY-MM-DD)
    - manufacturer: บริษัทผู้ผลิต (เช่น Baxter, Fresenius)
    
    หากข้อมูลฟิลด์ไหนไม่พบ ให้ใส่ค่าว่าง ""
    ส่งข้อมูลกลับมาในรูปแบบ JSON Object เท่านั้น ห้ามมี Markdown block`;

    const response = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: image.split(',')[1],
              mimeType: "image/jpeg"
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

    const text = response.text || "{}";
    const data = JSON.parse(text);

    res.json(data);
  } catch (error: any) {
    console.error("Gemini Server Error:", error);
    res.status(500).json({ error: error.message || "Failed to process image" });
  }
});

// Vite integration
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

setupVite().then(() => {
  if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running at http://0.0.0.0:${PORT}`);
    });
  }
});

export default app;
