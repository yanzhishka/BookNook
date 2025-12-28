
import React, { useState, useRef, useEffect } from 'react';
import { generateSceneImage, editBookImage, checkAndRequestApiKey } from '../services/geminiService';
import { ImageSize, AspectRatio } from '../types';
import { Wand2, Image as ImageIcon, Upload, Loader2, Download, AlertCircle, Palette } from 'lucide-react';

export const Studio: React.FC = () => {
  const [mode, setMode] = useState<'generate' | 'edit'>('generate');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [checkingAccess, setCheckingAccess] = useState<boolean>(true);

  // Generation State
  const [genPrompt, setGenPrompt] = useState('');
  const [genSize, setGenSize] = useState<ImageSize>('1K');
  const [genRatio, setGenRatio] = useState<AspectRatio>('1:1');

  // Edit State
  const [editPrompt, setEditPrompt] = useState('');
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [sourceMimeType, setSourceMimeType] = useState<string>('image/png');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check API Key Access on Mount
  useEffect(() => {
    const init = async () => {
      const allowed = await checkAndRequestApiKey();
      setHasAccess(allowed);
      setCheckingAccess(false);
    };
    init();
  }, []);

  const handleGenerate = async () => {
    if (!genPrompt) return;
    setLoading(true);
    setError(null);
    try {
      const img = await generateSceneImage(genPrompt, genSize, genRatio);
      setResultImage(img);
    } catch (e) {
      setError("Failed to generate image. Please try again. Ensure you have a valid API key selected.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!sourceImage || !editPrompt) return;
    setLoading(true);
    setError(null);
    
    // Convert data URL to base64 string (remove prefix)
    const base64Data = sourceImage.split(',')[1];

    try {
      const img = await editBookImage(base64Data, sourceMimeType, editPrompt);
      setResultImage(img);
    } catch (e) {
      setError("Failed to edit image. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setSourceImage(ev.target?.result as string);
        setSourceMimeType(file.type);
        // Clear result when new source is uploaded
        setResultImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const requestAccess = async () => {
    setCheckingAccess(true);
    const allowed = await checkAndRequestApiKey();
    setHasAccess(allowed);
    setCheckingAccess(false);
  };

  if (checkingAccess) {
     return (
         <div className="flex flex-col items-center justify-center h-full min-h-[400px] animate-pulse">
             <div className="w-12 h-12 bg-stone-200 rounded-full mb-4"></div>
             <div className="h-4 bg-stone-200 rounded w-48"></div>
         </div>
     )
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] max-w-2xl mx-auto text-center p-6 animate-fade-in-up">
        <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-6 shadow-lg animate-bounce">
           <Wand2 size={40} />
        </div>
        <h2 className="text-3xl font-serif font-bold text-stone-800 mb-4">Unlock Creative Studio</h2>
        <p className="text-stone-600 mb-8 text-lg">
          To use our advanced AI generation and editing tools (powered by Gemini 3 Pro & 2.5 Flash), you need to connect your Google Cloud Project API key.
        </p>
        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm mb-8 w-full text-left hover:shadow-md transition-shadow">
            <h3 className="font-bold text-stone-800 mb-2 flex items-center gap-2">
                <AlertCircle size={18} className="text-blue-500"/>
                Billing Information
            </h3>
            <p className="text-stone-500 text-sm mb-2">
                Some features track usage against your billing account. Please ensure your API key is associated with a billing-enabled project.
            </p>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                Read more about Gemini API billing &rarr;
            </a>
        </div>
        <button 
          onClick={requestAccess}
          className="bg-stone-900 text-white px-8 py-3 rounded-full text-lg font-medium hover:bg-stone-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0"
        >
          Connect API Key
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 animate-fade-in-up">
        <h2 className="text-3xl font-bold text-stone-800 serif mb-2">Creative Studio</h2>
        <p className="text-stone-500">Bring your reading imagination to life with AI.</p>
      </div>

      {/* Toggle */}
      <div className="flex p-1 bg-stone-200 rounded-xl w-fit mb-8 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <button
          onClick={() => setMode('generate')}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
            mode === 'generate' ? 'bg-white text-stone-900 shadow-sm scale-105' : 'text-stone-500 hover:text-stone-700 hover:bg-stone-200/50'
          }`}
        >
          Scene Generator
        </button>
        <button
          onClick={() => setMode('edit')}
          className={`px-6 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
            mode === 'edit' ? 'bg-white text-stone-900 shadow-sm scale-105' : 'text-stone-500 hover:text-stone-700 hover:bg-stone-200/50'
          }`}
        >
          Magic Editor
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Controls Panel */}
        <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm animate-slide-in-right origin-left" style={{ animationDelay: '200ms' }}>
          {mode === 'generate' ? (
            <div className="space-y-6 animate-fade-in-up">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">Describe the scene</label>
                <textarea
                  value={genPrompt}
                  onChange={(e) => setGenPrompt(e.target.value)}
                  placeholder="e.g. A moody cyberpunk street from Neuromancer, neon rain, high detail..."
                  className="w-full p-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-800 focus:border-transparent outline-none h-32 resize-none transition-shadow"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">Image Size</label>
                  <select 
                    value={genSize}
                    onChange={(e) => setGenSize(e.target.value as ImageSize)}
                    className="w-full p-2 rounded-lg border border-stone-200 bg-white hover:border-stone-400 transition-colors cursor-pointer"
                  >
                    <option value="1K">1K (Standard)</option>
                    <option value="2K">2K (High Res)</option>
                    <option value="4K">4K (Ultra)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">Aspect Ratio</label>
                  <select 
                    value={genRatio}
                    onChange={(e) => setGenRatio(e.target.value as AspectRatio)}
                    className="w-full p-2 rounded-lg border border-stone-200 bg-white hover:border-stone-400 transition-colors cursor-pointer"
                  >
                    <option value="1:1">Square (1:1)</option>
                    <option value="16:9">Landscape (16:9)</option>
                    <option value="9:16">Portrait (9:16)</option>
                    <option value="3:4">Classic (3:4)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading || !genPrompt}
                className="w-full bg-stone-900 text-white py-3 rounded-xl font-medium hover:bg-stone-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 active:scale-95 hover:shadow-lg"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Wand2 size={20} />}
                Generate Scene
              </button>
              <p className="text-xs text-stone-400 text-center">Powered by Gemini 3 Pro Image</p>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in-up">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">1. Upload Reference</label>
                <div 
                  onClick={triggerFileSelect}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
                    sourceImage ? 'border-emerald-400 bg-emerald-50' : 'border-stone-200 hover:border-stone-400 hover:bg-stone-50 hover:scale-[1.02]'
                  }`}
                >
                   <input 
                     type="file" 
                     ref={fileInputRef} 
                     className="hidden" 
                     accept="image/*" 
                     onChange={handleFileSelect}
                   />
                   {sourceImage ? (
                     <div className="relative animate-scale-in">
                        <img src={sourceImage} alt="Source" className="max-h-40 mx-auto rounded shadow-sm" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded opacity-0 hover:opacity-100 transition-opacity backdrop-blur-sm">
                           <span className="text-white text-sm font-medium bg-black/50 px-2 py-1 rounded shadow-lg transform hover:scale-110 transition-transform">Change</span>
                        </div>
                     </div>
                   ) : (
                     <div className="flex flex-col items-center text-stone-400">
                       <Upload size={32} className="mb-2" />
                       <span className="text-sm">Click to upload image</span>
                     </div>
                   )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">2. Edit Instruction</label>
                <textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="e.g. Add a retro filter, Remove the person in the background..."
                  className="w-full p-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-stone-800 focus:border-transparent outline-none h-32 resize-none transition-shadow"
                />
              </div>

              <button
                onClick={handleEdit}
                disabled={loading || !sourceImage || !editPrompt}
                className="w-full bg-stone-900 text-white py-3 rounded-xl font-medium hover:bg-stone-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 active:scale-95 hover:shadow-lg"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <ImageIcon size={20} />}
                Apply Edits
              </button>
              <p className="text-xs text-stone-400 text-center">Powered by Gemini 2.5 Flash Image</p>
            </div>
          )}
        </div>

        {/* Preview Panel */}
        <div className="lg:col-span-8 bg-stone-900 rounded-2xl overflow-hidden min-h-[500px] flex items-center justify-center relative shadow-2xl animate-slide-in-right origin-right transition-all duration-500" style={{ animationDelay: '300ms' }}>
          {loading ? (
             <div className="text-stone-400 flex flex-col items-center animate-pulse">
               <Wand2 size={48} className="mb-4 opacity-50 animate-bounce" />
               <p className="text-lg font-light tracking-wider">Dreaming up your vision...</p>
             </div>
          ) : resultImage ? (
            <div className="relative w-full h-full flex items-center justify-center p-4 animate-scale-in">
              <img src={resultImage} alt="Result" className="max-w-full max-h-[700px] rounded-lg shadow-2xl" />
              <a 
                href={resultImage} 
                download={`bnook-creation-${Date.now()}.png`}
                className="absolute bottom-8 right-8 bg-white text-stone-900 p-3 rounded-full shadow-lg hover:bg-stone-100 hover:scale-110 transition-all"
                title="Download"
              >
                <Download size={24} />
              </a>
            </div>
          ) : (
            <div className="text-stone-600 flex flex-col items-center p-8 text-center animate-fade-in-up" style={{ animationDelay: '400ms' }}>
              <div className="w-24 h-24 bg-stone-800 rounded-full flex items-center justify-center mb-4 group hover:scale-110 transition-transform duration-500">
                 <Palette size={40} className="opacity-50 group-hover:opacity-80 transition-opacity duration-500 text-stone-300" />
              </div>
              <h3 className="text-xl font-bold text-stone-400 mb-2">Ready to Create</h3>
              <p className="max-w-md">Select your tools on the left to generate new scenes from your favorite books or edit existing images.</p>
            </div>
          )}
          
          {error && (
            <div className="absolute bottom-4 left-4 right-4 bg-red-500/90 text-white p-4 rounded-lg backdrop-blur-sm flex items-center gap-3 animate-slide-in-right shadow-lg">
              <AlertCircle size={20} />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto text-sm underline hover:text-red-100">Dismiss</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};