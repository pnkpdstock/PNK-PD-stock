
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import nodemailer from 'nodemailer';

const app = express();
const PORT = process.env.PORT || 3000;

// Configure Nodemailer for Gmail with pooling enabled to handle high frequency alerts
const transporter = process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD ? nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  pool: true, // Use a pool of connections
  maxConnections: 3, // Keep this low to stay within Gmail limits
  maxMessages: 100
}) : null;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// API Endpoint for Email Alerts
app.post('/api/send-alert', async (req, res) => {
  try {
    const { product, currentStock, criticalLevel, recipients } = req.body;
    
    if (!transporter) {
      return res.status(500).json({ error: "Email service (Gmail) is not configured on the server." });
    }

    if (!recipients || recipients.length === 0) {
      return res.status(400).json({ error: "No recipients provided." });
    }

    const toEmails = Array.isArray(recipients) ? recipients.join(', ') : recipients;

    const mailOptions = {
      from: `"PNK PD Stock Alert" <${process.env.GMAIL_USER}>`,
      to: toEmails,
      subject: `⚠️ แจ้งเตือน: สินค้า ${product} ต่ำกว่าจุดวิกฤต`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #b91c1c;">⚠️ แจ้งเตือนสินค้าต่ำกว่าระดับวิกฤต</h2>
          <p style="font-size: 16px;">เรียน ผู้ดูแลระบบ,</p>
          <p style="font-size: 16px;">ขณะนี้สินค้า <strong>"${product}"</strong> ในคลังออนไลน์มีจำนวนคงเหลือต่ำกว่าที่กำหนด</p>
          <div style="background-color: #fef2f2; border: 1px solid #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;">📦 <strong>จำนวนคงเหลือ:</strong> ${currentStock} ชิ้น</p>
            <p style="margin: 5px 0;">🔔 <strong>จุดวิกฤตที่ตั้งไว้:</strong> ${criticalLevel} ชิ้น</p>
          </div>
          <p style="font-size: 14px; color: #64748b;">กรุณาตรวจสอบระบบและดำเนินการสั่งซื้อสินค้าเพิ่มเติม</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
          <p style="font-size: 12px; color: #94a3b8;">ส่งโดยระบบ PNK PD Online Stock v.1.0</p>
        </div>
      `
    };

    // Retry logic for SMTP 421 errors
    let attempts = 0;
    const maxAttempts = 3;
    let lastError: any = null;

    while (attempts < maxAttempts) {
      try {
        await transporter.sendMail(mailOptions);
        return res.json({ success: true, attempts: attempts + 1 });
      } catch (error: any) {
        attempts++;
        lastError = error;
        console.warn(`Email attempt ${attempts} failed:`, error.message);
        
        // If it's a temporary error, wait and retry
        if (error.message.includes('421') || error.message.includes('Temporary')) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempts)); // Exponential backoff
          continue;
        }

        // If it's a "Too many login attempts" (454) or "Daily limit exceeded" (550), break early
        if (error.message.includes('454') || error.message.includes('4.7.0') || error.message.includes('550') || error.message.includes('5.4.5')) {
          console.error("Breaking early due to Gmail limits (454/550)");
          break;
        }
        
        // If it's a permanent error (like 535 auth), break early
        break;
      }
    }

    throw lastError;
  } catch (error: any) {
    console.error("Email API Route Error:", error);
    res.status(500).json({ error: error.message });
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
