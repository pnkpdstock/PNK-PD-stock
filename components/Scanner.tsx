
import React, { useState, useRef } from 'react';

interface ScannerProps {
  onScan: (base64Image: string) => void;
  isLoading: boolean;
  label: string;
}

export const Scanner: React.FC<ScannerProps> = ({ onScan, isLoading, label }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          // Compress image to a manageable size (max 1024px width/height)
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1024;
          
          if (width > height) {
            if (width > maxDim) {
              height *= maxDim / width;
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width *= maxDim / height;
              height = maxDim;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
          setTempImage(compressedBase64);
          setIsConfirming(true);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
    // Reset input to allow selecting same file again
    e.target.value = '';
  };

  const confirmPhoto = () => {
    if (tempImage) {
      setPreview(tempImage);
      setIsConfirming(false);
      onScan(tempImage);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4 p-6 bg-white rounded-3xl shadow-sm border border-slate-100">
      <div className="w-full flex justify-between items-center mb-2">
        <h2 className="text-lg font-black text-blue-900">{label}</h2>
        <span className="text-[10px] font-black text-purple-600 bg-purple-50 px-2 py-1 rounded-full uppercase tracking-widest">AI Vision</span>
      </div>

      <div 
        className={`relative w-full aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all overflow-hidden ${
          preview ? 'border-purple-400 bg-purple-50' : 'border-slate-200 bg-slate-50'
        }`}
      >
        {preview ? (
          <img src={preview} alt="Preview" className="w-full h-full object-contain" />
        ) : (
          <div className="text-center p-6">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto mb-4 text-3xl">
              📸
            </div>
            <p className="text-sm font-bold text-slate-400 italic">ถ่ายรูปฉลากเพื่อให้ AI ช่วยระบุข้อมูล</p>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center z-10 animate-in fade-in">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm font-black text-blue-900 text-center px-4">กำลังวิเคราะห์ข้อมูล...<br/><span className="text-[10px] opacity-60 font-bold uppercase tracking-widest">Processing Image</span></p>
          </div>
        )}
      </div>

      {/* Confirmation Modal - Simple Preview No Crop/Zoom */}
      {isConfirming && tempImage && (
        <div className="fixed inset-0 bg-blue-900/95 z-[500] flex flex-col items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-lg space-y-6">
            <div className="text-center">
              <h3 className="text-white text-2xl font-black">ยืนยันความชัดเจน</h3>
              <p className="text-purple-200 text-sm mt-1 font-bold">หากรูปภาพมืดหรือเบลอเกินไป AI อาจอ่านข้อมูลผิดพลาด</p>
            </div>

            <div className="relative w-full aspect-square bg-slate-900 rounded-[2.5rem] overflow-hidden border-4 border-white/10 flex items-center justify-center shadow-2xl">
              <img src={tempImage} alt="Confirm" className="max-w-full max-h-full object-contain" />
              
              {/* Static Framing Guides */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-[80%] h-[60%] border-2 border-white/20 rounded-xl relative">
                  <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-purple-400 rounded-tl-xl"></div>
                  <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-purple-400 rounded-tr-xl"></div>
                  <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-purple-400 rounded-bl-xl"></div>
                  <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-purple-400 rounded-br-xl"></div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => { setIsConfirming(false); setTempImage(null); }}
                className="flex-1 py-5 bg-white/10 text-white font-black rounded-3xl hover:bg-white/20 transition-all border border-white/10"
              >
                ถ่ายใหม่
              </button>
              <button 
                onClick={confirmPhoto}
                className="flex-[2] py-5 bg-purple-500 text-white font-black rounded-3xl shadow-2xl shadow-purple-900/50 transition-all active:scale-95 text-lg"
              >
                ยืนยันเพื่อสแกน
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 w-full">
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          capture="environment"
          className="hidden"
        />
        <button
          disabled={isLoading || isConfirming}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 py-5 rounded-2xl font-black transition-all shadow-sm active:scale-95 ${
            isLoading || isConfirming ? 'bg-slate-100 text-slate-400' : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
        >
          <span className="text-2xl">📸</span>
          <span className="text-xs uppercase tracking-widest">เปิดกล้องถ่ายรูป</span>
        </button>

        <input 
          type="file" 
          ref={galleryInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
        <button
          disabled={isLoading || isConfirming}
          onClick={() => galleryInputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 py-5 rounded-2xl font-black transition-all shadow-sm active:scale-95 ${
            isLoading || isConfirming ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 text-blue-900 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <span className="text-2xl">🖼️</span>
          <span className="text-xs uppercase tracking-widest">เลือกจากคลังภาพ</span>
        </button>
      </div>
    </div>
  );
};
