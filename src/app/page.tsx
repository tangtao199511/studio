// src/app/page.tsx
'use client';

import type { ChangeEvent } from 'react';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; // Import Textarea
import { Dialog, DialogContent, DialogTrigger, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Loader2, Upload, Download, Paintbrush, ZoomIn, X, Eye, EyeOff, Sparkles } from 'lucide-react'; // Added Sparkles for AI Tune
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { generateFilterParams, type FilterParamsOutput } from '@/ai/flows/generate-filter-params-flow';


// Helper function to apply filters using Canvas
const applyClientSideFilter = (
  img: HTMLImageElement,
  targetParameters: Record<string, number | undefined>, // These are the values for 100% intensity, expecting 'hueRotate'
  intensity: number, // Add intensity parameter (0-100)
  mimeType: string = 'image/png',
  quality: number = 0.92 // Default quality for JPEG/WebP
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    // --- Default values for filters (represent 0% intensity) ---
    const defaults: Record<string, number> = {
      contrast: 1,
      saturate: 1,
      brightness: 1,
      sepia: 0,
      grayscale: 0,
      hueRotate: 0, // Use hueRotate (camelCase) consistently for parameter objects
    };

    // Ensure all default keys are present in targetParameters, falling back to default if undefined in targetParameters
    const effectiveTargetParams = { ...defaults };
    for (const key in defaults) {
        if (targetParameters[key] !== undefined) {
            effectiveTargetParams[key] = targetParameters[key]!;
        }
    }

    // --- Apply Intensity Interpolation ---
    const intensityFactor = intensity / 100; // Convert percentage to 0-1 range
    let filterString = '';

    for (const filterKey of Object.keys(defaults)) {
        const defaultValue = defaults[filterKey];
        const targetValue = effectiveTargetParams[filterKey]; // Already includes defaults, so direct access is fine

        // Linear interpolation: value = start + (end - start) * factor
        const interpolatedValue = defaultValue + (targetValue - defaultValue) * intensityFactor;

        if (Math.abs(interpolatedValue - defaultValue) > 0.001 || (filterKey === 'grayscale' && targetValue === 1) || (filterKey === 'hueRotate' && Math.abs(interpolatedValue) > 0.001)) {
             if (filterKey === 'hueRotate') { // Note: CSS filter is 'hue-rotate'
                filterString += ` hue-rotate(${Math.round(interpolatedValue)}deg)`;
            } else {
                filterString += ` ${filterKey}(${interpolatedValue.toFixed(3)})`;
            }
        }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = filterString.trim() || 'none';
    ctx.drawImage(img, 0, 0);
    ctx.filter = 'none';

    try {
       let outputMimeType = 'image/png';
       if (mimeType === 'image/jpeg') outputMimeType = 'image/jpeg';
       else if (mimeType === 'image/webp') outputMimeType = 'image/webp';
       resolve(canvas.toDataURL(outputMimeType, quality));
    } catch (e) {
        console.error("Error converting canvas to data URL:", e);
        try { resolve(canvas.toDataURL('image/png')); }
        catch (pngError) {
            console.error("Fallback to PNG also failed:", pngError);
            reject(pngError);
        }
    }
  });
};


// Helper function to read file as Data URL
const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
};

// Function to create a low-resolution preview
const createLowResPreview = (
    img: HTMLImageElement,
    maxDimension: number = 800
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        let { naturalWidth: width, naturalHeight: height } = img;

        if (width > height) {
            if (width > maxDimension) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
            }
        } else {
            if (height > maxDimension) {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
            }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Could not get canvas context for preview')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        try {
            const webpUrl = canvas.toDataURL('image/webp', 0.8);
            if (webpUrl.length > 10) resolve(webpUrl);
            else {
                 const jpegUrl = canvas.toDataURL('image/jpeg', 0.8);
                 if (jpegUrl.length > 10) resolve(jpegUrl);
                 else resolve(canvas.toDataURL('image/png'));
            }
        } catch (e) {
            console.error("Error creating low-res preview:", e);
             try { resolve(canvas.toDataURL('image/png')); }
             catch(pngError){ reject(pngError); }
        }
    });
};

// Debounce helper function
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
    const context = this;
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => { func.apply(context, args); }, wait);
  };
}


// Base filter definitions (used if AI tuning is not applied or fails)
// Keys should match the `defaults` in `applyClientSideFilter` (e.g., use `hueRotate`)
const baseStyleDefinitions: Record<string, Record<string, number | undefined>> = {
  'None': {}, // Add "None" style
  'Kodak Portra 400': { contrast: 1.1, saturate: 1.1, brightness: 1.05, sepia: 0.1 },
  'Fujifilm Velvia 50': { saturate: 1.4, contrast: 1.2, brightness: 0.95 },
  'Ilford HP5 Plus 400': { grayscale: 1, contrast: 1.2, brightness: 1.1 },
  'CineStill 800T': { contrast: 1.15, brightness: 1.0, sepia: 0.1, hueRotate: -10, saturate: 1.1 },
  'Agfa Vista 200': { contrast: 1.05, saturate: 1.15, brightness: 1.0, sepia: 0.15 },
  'Lomography Color Negative 400': { saturate: 1.3, contrast: 1.1, brightness: 1.0 },
  'Classic Teal & Orange LUT': { contrast: 1.1, sepia: 0.2, hueRotate: -15, saturate: 1.2 },
  'Vintage Sepia Tone': { sepia: 0.7, contrast: 1.05, brightness: 0.95 },
  'Cool Cinematic Look': { contrast: 1.1, brightness: 0.95, hueRotate: -10, saturate: 1.1 },
  'Warm Golden Hour LUT': { sepia: 0.25, contrast: 1.05, brightness: 1.1, saturate: 1.1 },
  'High Contrast B&W': { grayscale: 1, contrast: 1.5, brightness: 1.0 },
  'Faded Vintage Film': { saturate: 0.8, contrast: 0.9, brightness: 1.1, sepia: 0.2 },
  'Vibrant Summer Day': { saturate: 1.3, brightness: 1.05, contrast: 1.05 },
  'Cross Processed Look': { saturate: 1.2, contrast: 1.1, hueRotate: 15, brightness: 0.95 },
  'Technicolor Dream': { saturate: 1.6, contrast: 1.1, brightness: 1.0, hueRotate: 10 },
  'Bleach Bypass': { contrast: 1.4, saturate: 0.7, brightness: 1.05 },
  'Infrared Simulation': { hueRotate: 180, saturate: 1.2, contrast: 1.1, brightness: 1.1 },
  'Grungy Matte Look': { contrast: 0.9, saturate: 0.9, brightness: 1.05, sepia: 0.1 },
  'Neon Noir': { contrast: 1.3, brightness: 0.9, saturate: 1.4, hueRotate: -20 },
};


export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalDataUrl, setOriginalDataUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filteredUrl, setFilteredUrl] = useState<string | null>(null);
  const [filteredPreviewUrl, setFilteredPreviewUrl] = useState<string | null>(null);
  const [analogStyle, setAnalogStyle] = useState<string>('None'); // Default to "None"
  const [moodDescription, setMoodDescription] = useState<string>('');
  const [aiGeneratedFilterParams, setAiGeneratedFilterParams] = useState<FilterParamsOutput | null>(null);
  const [filterIntensity, setFilterIntensity] = useState<number>(100);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTuningWithAI, setIsTuningWithAI] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isModalImageLoading, setIsModalImageLoading] = useState<boolean>(true);
  const [modalImageError, setModalImageError] = useState<boolean>(false);
  const [currentMimeType, setCurrentMimeType] = useState<string>('image/png');
  const [showOriginalPreview, setShowOriginalPreview] = useState<boolean>(false);

  const intensityRef = useRef(filterIntensity);
  const analogStyleRef = useRef(analogStyle);
  const moodDescriptionRef = useRef(moodDescription);
  const aiGeneratedFilterParamsRef = useRef(aiGeneratedFilterParams);
  const originalDataUrlRef = useRef(originalDataUrl);
  const currentMimeTypeRef = useRef(currentMimeType);

  useEffect(() => { intensityRef.current = filterIntensity; }, [filterIntensity]);
  useEffect(() => { analogStyleRef.current = analogStyle; }, [analogStyle]);
  useEffect(() => { moodDescriptionRef.current = moodDescription; }, [moodDescription]);
  useEffect(() => { aiGeneratedFilterParamsRef.current = aiGeneratedFilterParams; }, [aiGeneratedFilterParams]);
  useEffect(() => { originalDataUrlRef.current = originalDataUrl; }, [originalDataUrl]);
  useEffect(() => { currentMimeTypeRef.current = currentMimeType; }, [currentMimeType]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
       if (!file.type.startsWith('image/')) {
            toast({ title: "Invalid File Type", description: "Please select an image file.", variant: "destructive" });
            return;
        }
      setIsLoading(true); setProgress(5);
      try {
          const dataUrl = await readFileAsDataURL(file);
          setOriginalDataUrl(dataUrl); setCurrentMimeType(file.type); setProgress(15);
          const img = new window.Image();
          img.onload = async () => {
              try {
                  const lowRes = await createLowResPreview(img);
                  setPreviewUrl(lowRes);
              } catch (previewError) {
                  console.error("Error generating preview:", previewError);
                  setPreviewUrl(dataUrl); // Fallback
                  toast({ title: "Preview Error", description: "Using original image for preview.", variant: "default"});
              } finally {
                  setSelectedFile(file);
                  setFilteredUrl(null); setFilteredPreviewUrl(null);
                  setAiGeneratedFilterParams(null);
                  setProgress(100); setIsLoading(false); setTimeout(() => setProgress(0), 1000);
                  // Auto-apply effect based on current settings (which will be "None" initially or last selection)
                  await applyCurrentFilterEffect(dataUrl, analogStyleRef.current, null, intensityRef.current, file.type);
              }
          };
          img.onerror = () => {
              toast({ title: "Image Load Error", description: "Could not load image data.", variant: "destructive" });
              setOriginalDataUrl(null); setPreviewUrl(null); setSelectedFile(null); setFilteredUrl(null); setFilteredPreviewUrl(null);
              setIsLoading(false); setProgress(0);
          }
          img.src = dataUrl; setProgress(25);
      } catch (readError: any) {
          toast({ title: "File Read Error", description: `Could not read file: ${readError.message}.`, variant: "destructive" });
          setIsLoading(false); setProgress(0);
      }
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const applyCurrentFilterEffect = useCallback(async (
     sourceUrl: string | null = originalDataUrlRef.current,
     styleName: string = analogStyleRef.current,
     aiParams: FilterParamsOutput | null = aiGeneratedFilterParamsRef.current,
     intensity: number = intensityRef.current,
     mimeType: string = currentMimeTypeRef.current
  ) => {
    if (!sourceUrl) return;

    setIsLoading(true); setProgress(10);
    const wasFiltered = filteredUrl !== null;

    try {
        const img = new window.Image();
        img.onload = async () => {
            setProgress(30);
            try {
                let targetParamsForFilter;
                if (aiParams) {
                    targetParamsForFilter = aiParams;
                } else if (styleName !== 'None') {
                    const baseStyle = baseStyleDefinitions[styleName] || {};
                    targetParamsForFilter = { ...baseStyle };
                    if (baseStyle['hue-rotate'] !== undefined) { // compatibility for old key
                        targetParamsForFilter.hueRotate = baseStyle['hue-rotate'];
                        delete targetParamsForFilter['hue-rotate'];
                    }
                } else {
                    targetParamsForFilter = {}; // No base style, no AI params = empty filter (effectively defaults)
                }

                const filteredDataUri = await applyClientSideFilter(img, targetParamsForFilter, intensity, mimeType);
                setProgress(70);
                setFilteredUrl(filteredDataUri);

                const filteredImgForPreview = new window.Image();
                filteredImgForPreview.onload = async () => {
                    try {
                        const lowResFiltered = await createLowResPreview(filteredImgForPreview);
                        setFilteredPreviewUrl(lowResFiltered);
                    } catch (previewError) {
                        setFilteredPreviewUrl(filteredDataUri);
                    }
                    setProgress(90);
                };
                filteredImgForPreview.onerror = () => setFilteredPreviewUrl(filteredDataUri);
                filteredImgForPreview.src = filteredDataUri;

                if (wasFiltered || aiParams || styleName !== 'None') {
                    toast({
                        title: aiParams ? "AI Tune Applied" : (styleName !== 'None' ? "Style Updated" : "Filter Intensity Updated"),
                        description: `${styleName !== 'None' ? styleName + " style" : ""} ${aiParams ? "tuned by AI " : ""}${styleName !== 'None' || aiParams ? "applied" : "updated"} at ${intensity}% intensity.`,
                    });
                }
                setProgress(100);
            } catch (filterError: any) {
                toast({ title: "Filter Error", description: `Failed to apply style: ${filterError.message}.`, variant: "destructive" });
                setProgress(0);
            } finally {
                setIsLoading(false); setTimeout(() => setProgress(0), 1500);
            }
        };
        img.onerror = () => {
            toast({ title: "Image Load Error", description: "Could not load image for processing.", variant: "destructive" });
            setIsLoading(false); setProgress(0);
        };
        img.src = sourceUrl; setProgress(25);
    } catch (error: any) {
        toast({ title: "Processing Error", description: `An unexpected error occurred: ${error.message}.`, variant: "destructive" });
        setIsLoading(false); setProgress(0);
    }
  }, [toast, setFilteredUrl, setFilteredPreviewUrl, setIsLoading, setProgress, filteredUrl]);


  const handleTuneWithAI = async () => {
    if (!originalDataUrlRef.current || !moodDescriptionRef.current.trim()) {
        toast({ title: "Missing Input", description: "Please describe the mood/context for AI tuning.", variant: "destructive" });
        return;
    }
    setIsTuningWithAI(true); setProgress(10);
    try {
        setProgress(30);
        const params = await generateFilterParams({
            baseStyle: analogStyleRef.current === 'None' ? undefined : analogStyleRef.current, // Pass undefined if "None"
            moodDescription: moodDescriptionRef.current,
        });
        setProgress(70);
        setAiGeneratedFilterParams(params);
        aiGeneratedFilterParamsRef.current = params;
        toast({ title: "AI Tuning Complete", description: "Filter parameters generated by AI." });
        await applyCurrentFilterEffect(
            originalDataUrlRef.current,
            analogStyleRef.current, // Base style still relevant for display name / context
            params,
            intensityRef.current,
            currentMimeTypeRef.current
        );
        setProgress(100);
    } catch (error: any) {
        console.error("AI Tuning Error:", error);
        toast({ title: "AI Tuning Failed", description: error.message || "Could not generate AI parameters.", variant: "destructive" });
        setAiGeneratedFilterParams(null);
        aiGeneratedFilterParamsRef.current = null;
        // Re-apply base style or "None" if AI fails
        await applyCurrentFilterEffect(originalDataUrlRef.current, analogStyleRef.current, null, intensityRef.current, currentMimeTypeRef.current);
        setProgress(0);
    } finally {
        setIsTuningWithAI(false);
        setTimeout(() => setProgress(isTuningWithAI ? 0 : progress), 1500);
    }
  };

  const debouncedApplyFilterForIntensity = useMemo(
    () => debounce(() => {
        applyCurrentFilterEffect(
            originalDataUrlRef.current,
            analogStyleRef.current,
            aiGeneratedFilterParamsRef.current,
            intensityRef.current,
            currentMimeTypeRef.current
        );
    }, 500),
    [applyCurrentFilterEffect]
  );

  const handleIntensityChange = (value: number[]) => {
      const newIntensity = value[0];
      setFilterIntensity(newIntensity);
      intensityRef.current = newIntensity; // Update ref immediately
      if (originalDataUrlRef.current) {
          debouncedApplyFilterForIntensity();
      }
  };

  const handleAnalogStyleChange = (newStyle: string) => {
    setAnalogStyle(newStyle);
    analogStyleRef.current = newStyle; // Update ref immediately
    // If AI parameters were active, we keep them unless the user re-tunes.
    // If no AI params, or newStyle is 'None', AI params are effectively reset for the next plain style application.
    // if (newStyle === 'None') {
    //   setAiGeneratedFilterParams(null);
    //   aiGeneratedFilterParamsRef.current = null;
    // }
    if (originalDataUrlRef.current) {
        applyCurrentFilterEffect(
            originalDataUrlRef.current,
            newStyle,
            aiGeneratedFilterParamsRef.current, // Keep existing AI params if any, otherwise null
            intensityRef.current,
            currentMimeTypeRef.current
        );
    }
  };

  const handleExport = () => {
    if (!filteredUrl || !selectedFile) {
      toast({ title: "Error", description: "No edited photo to export.", variant: "destructive" });
      return;
    }
    const link = document.createElement('a');
    link.href = filteredUrl;
    const mimeType = filteredUrl.split(';')[0].split(':')[1] || 'image/png';
    const extension = mimeType.split('/')[1] || 'png';
    
    const originalFileName = selectedFile.name;
    const lastDotIndex = originalFileName.lastIndexOf('.');
    const fileNameWithoutExtension = lastDotIndex === -1 ? originalFileName : originalFileName.substring(0, lastDotIndex);
    
    const safeStyleName = analogStyleRef.current === 'None' ? 'custom' : analogStyleRef.current.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const aiTuneIndicator = aiGeneratedFilterParamsRef.current ? "_AI-tuned" : "";

    link.download = `${fileNameWithoutExtension}_AIMoodLens_${safeStyleName}${aiTuneIndicator}_${intensityRef.current}pct.${extension}`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    toast({ title: "Exported", description: "Edited photo saved." });
  };

  const handleImageClick = () => {
    if (filteredUrl) {
        setIsModalImageLoading(true); setModalImageError(false); setIsModalOpen(true);
    } else if (previewUrl) {
        toast({ title: "Preview", description: "Original image preview. Apply a style or tune with AI." });
    }
  };

  const handleModalOpenChange = (open: boolean) => {
      setIsModalOpen(open);
      if (!open) { setIsModalImageLoading(true); setModalImageError(false); }
  };

   const handlePreviewOriginalPress = () => { if (filteredPreviewUrl) setShowOriginalPreview(true); };
   const handlePreviewOriginalRelease = () => setShowOriginalPreview(false);

  const analogStyles = Object.keys(baseStyleDefinitions);

  const displayUrl = showOriginalPreview ? previewUrl : (filteredPreviewUrl || previewUrl);
  const displayAlt = showOriginalPreview ? "Original Photo Preview (Hold)" : (filteredPreviewUrl ? `Photo with ${analogStyle} style` : (previewUrl ? "Original Photo Preview" : "Placeholder"));

  return (
    <div className="h-screen bg-background flex flex-col items-center justify-center p-4 md:p-6">
      <Card className="w-full max-w-7xl shadow-lg overflow-hidden border-border/50 rounded-lg flex flex-col flex-grow">
        <CardHeader className="bg-card border-b border-border/50 p-3 md:p-4 flex-shrink-0">
          <CardTitle className="text-xl md:text-2xl font-semibold tracking-tight text-center text-primary">AI MoodLens 🎨</CardTitle>
          <CardDescription className="text-center text-muted-foreground mt-0.5 text-xs md:text-sm">Whisper your mood, let AI paint its hue. Enhance with a classic touch, if you wish to.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 grid md:grid-cols-4 gap-4 md:gap-6 items-start flex-grow">
          <div className="md:col-span-1 space-y-3 md:space-y-4 overflow-y-auto h-full pr-2">
            {/* 1. Import */}
            <div className="space-y-1">
              <Label htmlFor="photo-upload" className="text-xs font-medium text-foreground/80">1. Import Photo</Label>
              <Button onClick={handleImportClick} variant="outline" size="sm" className="w-full justify-center text-xs">
                <Upload className="mr-1 h-3 w-3" />
                {selectedFile ? `Selected: ${selectedFile.name.substring(0,12)}...` : 'Choose Photo'}
              </Button>
              <Input id="photo-upload" type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} className="hidden" />
              {previewUrl && !filteredUrl && !isLoading && (<p className="text-xs text-muted-foreground text-center pt-0.5">Applying base style...</p>)}
              {filteredUrl && !isLoading && (<p className="text-xs text-muted-foreground text-center pt-0.5">Style applied.</p>)}
            </div>

            {/* 2. Mood Input & AI Tune */}
            <div className="space-y-1">
              <Label htmlFor="mood-description" className="text-xs font-medium text-foreground/80">2. Describe Mood/Context</Label>
              <Textarea
                id="mood-description"
                placeholder="e.g., 'A melancholic rainy day', 'Joyful summer evening', 'Mysterious forest path'"
                value={moodDescription}
                onChange={(e) => setMoodDescription(e.target.value)}
                className="text-xs min-h-[80px] md:min-h-[100px]"
                disabled={!originalDataUrl || isLoading || isTuningWithAI}
              />
              <Button onClick={handleTuneWithAI} size="sm" className="w-full text-xs h-8 mt-1" disabled={!originalDataUrl || !moodDescription.trim() || isLoading || isTuningWithAI}>
                {isTuningWithAI ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                {isTuningWithAI ? 'Tuning...' : 'Tune with AI'}
              </Button>
              {aiGeneratedFilterParams && !isTuningWithAI && (<p className="text-xs text-muted-foreground text-center pt-0.5">AI parameters applied.</p>)}
            </div>
            
            {/* 3. Style Selection (Optional) */}
            <div className="space-y-1">
              <Label htmlFor="analog-style" className="text-xs font-medium text-foreground/80">3. Enhance by Preset:</Label>
              <Select value={analogStyle} onValueChange={handleAnalogStyleChange} disabled={!originalDataUrl || isLoading || isTuningWithAI}>
                <SelectTrigger id="analog-style" className="w-full h-8 text-xs"><SelectValue placeholder="Choose a style" /></SelectTrigger>
                <SelectContent className="max-h-[calc(6*2.2rem)]">
                  {analogStyles.map(style => (<SelectItem key={style} value={style} className="text-xs">{style}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            {/* 4. Intensity Slider */}
            <div className="space-y-1">
              <Label htmlFor="intensity-slider" className="text-xs font-medium text-foreground/80">4. Intensity ({filterIntensity}%)</Label>
              <Slider id="intensity-slider" min={0} max={100} step={1} value={[filterIntensity]} onValueChange={handleIntensityChange} className="my-1" disabled={!originalDataUrl || isLoading || isTuningWithAI} />
            </div>

            {/* Re-apply Button */}
            <div className="space-y-1">
                 <Button
                    onClick={() => applyCurrentFilterEffect()}
                    disabled={!originalDataUrl || isLoading || isTuningWithAI}
                    size="sm" variant="secondary" className="w-full text-xs h-8"
                >
                    {(isLoading && !isTuningWithAI) ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Paintbrush className="mr-1 h-3 w-3" />}
                    {(isLoading && !isTuningWithAI) ? 'Applying...' : 'Re-apply Style'}
                </Button>
            </div>

             {(isLoading || isTuningWithAI) && (
                <div className="space-y-0.5">
                    <Progress value={progress} className="w-full h-1 md:h-1.5" />
                    <p className="text-xs text-muted-foreground text-center">{progress > 0 ? `${isTuningWithAI ? 'AI Tuning: ': 'Processing: '}${progress}%` : ''}</p>
                </div>
             )}

             {filteredPreviewUrl && previewUrl && (
                 <Button variant="outline" size="sm" className="w-full text-xs h-8"
                    onMouseDown={handlePreviewOriginalPress} onMouseUp={handlePreviewOriginalRelease}
                    onTouchStart={handlePreviewOriginalPress} onTouchEnd={handlePreviewOriginalRelease}
                 >
                    {showOriginalPreview ? <EyeOff className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />}
                    {showOriginalPreview ? 'Release' : 'Hold Original'}
                 </Button>
             )}

            {filteredUrl && (
                 <Button onClick={handleExport} variant="default" size="sm" className="w-full text-xs h-8">
                    <Download className="mr-1 h-3 w-3" /> Export
                 </Button>
            )}
             {!filteredUrl && previewUrl && !isLoading && !isTuningWithAI && (<p className="text-xs text-muted-foreground text-center pt-1">Export enabled soon.</p>)}
             {!previewUrl && (<p className="text-xs text-muted-foreground text-center pt-1">Import image to start.</p>)}
          </div>

          {/* Right Column: Image Preview */}
          <div className="md:col-span-3 space-y-2 md:space-y-3 flex flex-col h-full">
             <Label className="text-sm font-medium block text-center text-foreground/80 flex-shrink-0">Preview</Label>
             <div className="w-full bg-muted/50 rounded-lg overflow-hidden border border-border/50 flex items-center justify-center relative shadow-inner cursor-pointer group flex-grow" onClick={handleImageClick}>
                {displayUrl ? (
                  <>
                    <Image src={displayUrl} alt={displayAlt} fill sizes="(max-width: 768px) 100vw, 75vw" style={{ objectFit: 'contain' }} data-ai-hint={showOriginalPreview ? "original preview" : (filteredUrl ? "filtered preview" : "original preview")} unoptimized priority={!filteredUrl} />
                    {(filteredUrl || originalDataUrl) && (
                         <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg">
                             <ZoomIn className="h-10 w-10 text-white/90" />
                         </div>
                    )}
                  </>
                ) : (
                  <div className="text-muted-foreground p-8 text-center flex flex-col items-center justify-center">
                    <Upload className="mx-auto h-10 w-10 md:h-12 md:w-12 mb-2 md:mb-3 opacity-50" />
                    <span className="text-sm">Import a photo to start</span>
                  </div>
                )}
                 {(isLoading || isTuningWithAI) && (
                  <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center backdrop-blur-sm space-y-1 z-10 rounded-lg">
                      <Loader2 className="h-6 w-6 md:h-8 md:w-8 animate-spin text-primary" />
                      <p className="text-xs md:text-sm text-muted-foreground">{isTuningWithAI ? 'AI Tuning...' : 'Processing...'}</p>
                       <Progress value={progress} className="w-2/3 max-w-xs h-1 md:h-1.5" />
                  </div>
                )}
             </div>
          </div>
        </CardContent>
         <CardFooter className="border-t border-border/50 bg-card p-2 md:p-3 text-center text-xs text-muted-foreground flex-shrink-0">
           AI-Powered Photo Styling | AI MoodLens &copy; {new Date().getFullYear()}
         </CardFooter>
      </Card>
      <Toaster />

      <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
         <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-[85vw] lg:max-w-[80vw] xl:max-w-[75vw] p-0 border-0 bg-transparent shadow-none flex items-center justify-center min-h-[60vh]">
            <DialogHeader className="absolute -top-96 left-0"><DialogTitle>Full Size Image Preview</DialogTitle></DialogHeader>
           {filteredUrl && (
             <div className="relative w-full h-auto max-h-[85vh]">
                 {isModalImageLoading && (<div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10 rounded-lg"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>)}
                 {modalImageError && (<div className="absolute inset-0 flex items-center justify-center bg-destructive/20 text-destructive-foreground z-10 p-4 rounded-lg"><p className="text-center">Error loading full-size image.</p></div>)}
                 <Image
                   src={filteredUrl} alt={`Filtered photo - ${analogStyle} - Full size`}
                   width={1920} height={1080}
                   style={{ width: '100%', height: 'auto', maxHeight: '85vh', objectFit: 'contain' }}
                   data-ai-hint="zoomed filtered image" unoptimized
                   className={cn("rounded-lg transition-opacity duration-300 shadow-2xl", isModalImageLoading || modalImageError ? "opacity-0" : "opacity-100")}
                   onLoad={() => setIsModalImageLoading(false)}
                   onError={() => { setIsModalImageLoading(false); setModalImageError(true); toast({ title: "Zoom Error", description: "Could not load full-size image.", variant: "destructive" }); }}
                 />
             </div>
           )}
         </DialogContent>
       </Dialog>
    </div>
  );
}


