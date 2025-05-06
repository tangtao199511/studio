// src/app/page.tsx
'use client';

import type { ChangeEvent } from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
// Removed AI imports: import {applyAnalogFilter} from '@/ai/flows/apply-analog-filter';
// Removed AI imports: import {enhancePhotoDetails} from '@/ai/flows/enhance-photo-details';
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
import { Loader2, Upload, Download, Paintbrush } from 'lucide-react'; // Changed Wand2 to Paintbrush
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";


// Helper function to apply filters using Canvas
const applyClientSideFilter = (
  img: HTMLImageElement,
  style: string,
  scene: string,
  mimeType: string = 'image/png'
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

    // Define filter presets based on style
    let filterString = '';
    switch (style) {
      case 'Kodak Portra 400':
        filterString = 'contrast(1.1) saturate(1.1) brightness(1.05) sepia(0.1)';
        break;
      case 'Fujifilm Velvia 50':
        filterString = 'saturate(1.4) contrast(1.2) brightness(0.95)';
        break;
      case 'Ilford HP5 Plus 400':
        filterString = 'grayscale(1) contrast(1.2) brightness(1.1)';
        break;
      case 'CineStill 800T': // Tungsten balanced, often cooler shadows, slight halation (hard to replicate fully)
        filterString = 'contrast(1.15) brightness(1.0) sepia(0.1) hue-rotate(-10deg) saturate(1.1)';
        break;
      case 'Agfa Vista 200': // Warmer tones, good saturation
        filterString = 'contrast(1.05) saturate(1.15) brightness(1.0) sepia(0.15)';
        break;
      case 'Lomography Color Negative 400': // High saturation, sometimes quirky colors
        filterString = 'saturate(1.3) contrast(1.1) brightness(1.0)';
        break;
      case 'Classic Teal & Orange LUT':
        // Approximation using CSS filters - complex LUTs are harder
        filterString = 'contrast(1.1) sepia(0.2) hue-rotate(-15deg) saturate(1.2)';
        break;
      case 'Vintage Sepia Tone':
        filterString = 'sepia(0.7) contrast(1.05) brightness(0.95)';
        break;
      case 'Cool Cinematic Look':
        filterString = 'contrast(1.1) brightness(0.95) hue-rotate(-10deg) saturate(1.1)';
        break;
      case 'Warm Golden Hour LUT':
        filterString = 'sepia(0.25) contrast(1.05) brightness(1.1) saturate(1.1)';
        break;
      default:
        filterString = 'none';
    }

     // Basic scene adjustments (can be expanded)
     switch (scene) {
         case 'portrait':
             // Slightly soften contrast for portraits maybe
             if (!filterString.includes('contrast')) filterString += ' contrast(0.95)';
             // Add slight warmth maybe?
             if (!filterString.includes('sepia')) filterString += ' sepia(0.05)';
             break;
         case 'landscape':
             if (!filterString.includes('contrast')) filterString += ' contrast(1.1)'; // Enhance landscape contrast
             if (!filterString.includes('saturate')) filterString += ' saturate(1.1)'; // Boost saturation slightly
             break;
        case 'flowers':
             if (!filterString.includes('saturate')) filterString += ' saturate(1.2)'; // Boost flower colors
             break;
        case 'street':
             if (!filterString.includes('contrast')) filterString += ' contrast(1.15)'; // Increase contrast for street
             break;
         // Add other scenes if needed
     }


    ctx.filter = filterString.trim() || 'none'; // Ensure 'none' if empty
    ctx.drawImage(img, 0, 0);

    // Reset filter before getting data URL to avoid potential issues
    ctx.filter = 'none';

    try {
       // Always resolve with PNG for broader compatibility and to avoid potential
       // issues with canvas.toDataURL supporting the original mimeType.
       resolve(canvas.toDataURL('image/png'));
    } catch (e) {
        console.error("Error converting canvas to data URL:", e);
        reject(e); // Reject if conversion fails
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


export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filteredUrl, setFilteredUrl] = useState<string | null>(null);
  const [analogStyle, setAnalogStyle] = useState<string>('Kodak Portra 400');
  const [sceneCategory, setSceneCategory] = useState<string>('landscape');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // Removed isEnhancing state
  const [progress, setProgress] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Clean up object URLs when component unmounts or file changes
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      // No need to revoke filteredUrl if it's a data URL
      // if (filteredUrl && filteredUrl.startsWith('blob:')) {
      //   URL.revokeObjectURL(filteredUrl);
      // }
    };
  }, [previewUrl]); // Only previewUrl is an object URL now

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Basic file type check
       if (!file.type.startsWith('image/')) {
            toast({
                title: "Invalid File Type",
                description: "Please select an image file.",
                variant: "destructive",
            });
            return;
        }

      setSelectedFile(file);
      // Revoke previous preview URL if it exists and is an object URL
      if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);

      // Create new object URL for preview
      const newPreviewUrl = URL.createObjectURL(file);
      setPreviewUrl(newPreviewUrl);

      // Reset filtered image and progress on new file upload
      setFilteredUrl(null);
      setProgress(0);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleApplyFilter = useCallback(async () => {
    if (!selectedFile) { // Check selectedFile directly
      toast({
        title: "Error",
        description: "Please import a photo first.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setProgress(10); // Initial progress

    try {
        // Read the file as a Data URL for stable processing
       const dataUrl = await readFileAsDataURL(selectedFile);
       setProgress(20); // Progress after reading file

       const img = new window.Image(); // Use window.Image to avoid conflict with next/image

       img.onload = async () => {
           setProgress(30); // Progress after image loads
           try {
               // Apply filter using the loaded image and get a PNG data URL
               const filteredDataUri = await applyClientSideFilter(img, analogStyle, sceneCategory, 'image/png');
               setProgress(70); // Progress after filtering

               setFilteredUrl(filteredDataUri); // Set the new data URI
               toast({
                 title: "Style Applied",
                 description: `${analogStyle} style applied for ${sceneCategory} scene.`,
               });
               setProgress(100); // Final progress
           } catch (filterError) {
                console.error('Error applying filter:', filterError);
                toast({
                    title: "Filter Error",
                    description: "Failed to apply filter styles. Please try again.",
                    variant: "destructive",
                });
                setProgress(0); // Reset progress on error
           } finally {
               setIsLoading(false);
               // Keep progress bar briefly visible after completion/error
               setTimeout(() => setProgress(0), 1500);
           }
       };

       img.onerror = (error) => { // Added error parameter
            console.error('Error loading image data for filtering:', error);
            toast({
                title: "Image Load Error",
                description: "Could not load the image data for processing. The file might be corrupted or in an unsupported format.",
                variant: "destructive",
            });
            setIsLoading(false);
            setProgress(0);
       }

       // Set the source to the Data URL
       img.src = dataUrl;

    } catch (error) {
      // Catch potential errors from readFileAsDataURL
      console.error('Error reading file for filtering:', error);
      toast({
        title: "File Read Error",
        description: "Could not read the selected image file. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
      setProgress(0); // Reset progress on error
    }
    // No finally here, it's handled inside onload/onerror/catch
  }, [selectedFile, analogStyle, sceneCategory, toast]);


 // Removed handleEnhanceDetails function


  const handleExport = () => {
    if (!filteredUrl) {
      toast({
        title: "Error",
        description: "No edited photo to export.",
        variant: "destructive",
      });
      return;
    }

    const link = document.createElement('a');
    link.href = filteredUrl; // This is now always a data URL

    // Since filteredUrl is always PNG data URL now
    const extension = 'png';
    const safeStyleName = analogStyle.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    link.download = `AnalogLens_${safeStyleName}_${sceneCategory}_${Date.now()}.${extension}`; // Suggest a filename
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

     toast({
        title: "Exported",
        description: "Edited photo saved successfully.",
      });
  };

  const analogStyles = [
    'Kodak Portra 400', // General purpose, warm, good skin tones
    'Fujifilm Velvia 50', // High saturation, vivid colors, good for landscapes
    'Ilford HP5 Plus 400', // Classic black and white, good contrast
    'CineStill 800T', // Tungsten balanced, cinematic, cool shadows
    'Agfa Vista 200', // Warm, saturated, slightly vintage feel
    'Lomography Color Negative 400', // Punchy colors, sometimes experimental look
    'Classic Teal & Orange LUT', // Popular cinematic grading
    'Vintage Sepia Tone', // Old-fashioned brown tint
    'Cool Cinematic Look', // Desaturated blues, moody feel
    'Warm Golden Hour LUT' // Emulates warm, soft light of golden hour
  ];

  const sceneCategories = ['landscape', 'portrait', 'flowers', 'waterland', 'street', 'architecture', 'food', 'general']; // Added general

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary flex flex-col items-center justify-center p-4 md:p-8">
      <Card className="w-full max-w-4xl shadow-xl overflow-hidden">
        <CardHeader className="bg-card border-b p-4 md:p-6">
          <CardTitle className="text-2xl md:text-3xl font-bold tracking-tight text-center text-primary">
            AnalogLens ✨
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground mt-1">
            Apply classic analog film styles to your photos instantly.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-8 grid md:grid-cols-2 gap-6 md:gap-8 items-start">
          {/* Left Column: Controls */}
          <div className="space-y-6">
            {/* Import */}
            <div className="space-y-2">
              <Label htmlFor="photo-upload" className="text-sm font-medium">1. Import Photo</Label>
              <Button onClick={handleImportClick} variant="outline" className="w-full justify-center">
                <Upload className="mr-2 h-4 w-4" />
                {selectedFile ? `Selected: ${selectedFile.name.substring(0, 20)}...` : 'Choose a Photo'}
              </Button>
              <Input
                id="photo-upload"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                ref={fileInputRef}
                className="hidden"
              />
               {previewUrl && !filteredUrl && (
                 <p className="text-xs text-muted-foreground text-center">Original photo loaded.</p>
               )}
            </div>

            {/* Style Selection */}
            <div className="space-y-2">
              <Label htmlFor="analog-style" className="text-sm font-medium">2. Select Analog Style</Label>
              <Select value={analogStyle} onValueChange={setAnalogStyle}>
                <SelectTrigger id="analog-style" className="w-full">
                  <SelectValue placeholder="Choose a style" />
                </SelectTrigger>
                <SelectContent>
                  {analogStyles.map(style => (
                     <SelectItem key={style} value={style}>{style}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Scene Selection */}
            <div className="space-y-2">
              <Label htmlFor="scene-category" className="text-sm font-medium">3. Select Scene Context</Label>
              <Select value={sceneCategory} onValueChange={setSceneCategory}>
                <SelectTrigger id="scene-category" className="w-full">
                  <SelectValue placeholder="Choose a scene context" />
                </SelectTrigger>
                <SelectContent>
                   {sceneCategories.map(scene => (
                     <SelectItem key={scene} value={scene} className="capitalize">{scene}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
               <p className="text-xs text-muted-foreground">Helps fine-tune the selected style.</p>
            </div>

            {/* Apply Filter Button */}
             <div className="space-y-2">
                <Label className="text-sm font-medium">4. Apply Style</Label>
                 <Button
                    onClick={handleApplyFilter}
                    disabled={!selectedFile || isLoading}
                    className="w-full bg-primary hover:bg-primary/90"
                >
                    {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                     <Paintbrush className="mr-2 h-4 w-4" /> // Changed icon
                    )}
                    {isLoading ? 'Applying...' : 'Apply Style'}
                </Button>
                {/* Removed Enhance Details Button */}
            </div>

            {/* Progress Bar */}
             {isLoading && (
                <div className="space-y-1">
                    <Progress value={progress} className="w-full h-2" />
                    <p className="text-xs text-muted-foreground text-center">Processing... {progress}%</p>
                </div>
             )}

          </div>

          {/* Right Column: Image Preview */}
          <div className="space-y-4">
             <Label className="text-sm font-medium block text-center">Preview</Label>
             <div className="aspect-video w-full bg-muted rounded-lg overflow-hidden border flex items-center justify-center relative shadow-inner">
                {/* Display filtered first, then preview, then placeholder */}
                {filteredUrl ? (
                  <Image
                    src={filteredUrl} // Now always a data URL
                    alt={`Photo with ${analogStyle} filter applied`}
                    layout="fill"
                    objectFit="contain"
                    data-ai-hint="filtered image"
                    className="animate-fade-in"
                    unoptimized // Necessary for data URLs in production builds
                  />
                ) : previewUrl ? (
                  <Image
                    src={previewUrl} // Object URL for preview only
                    alt="Original Photo Preview"
                    layout="fill"
                    objectFit="contain"
                    data-ai-hint="original image"
                  />
                ) : (
                  <div className="text-muted-foreground p-8 text-center">
                    <Upload className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    Import a photo to start editing
                  </div>
                )}
                 {isLoading && (
                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center backdrop-blur-sm">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
             </div>

            {filteredUrl && (
                 <Button onClick={handleExport} variant="default" className="w-full">
                    <Download className="mr-2 h-4 w-4" /> Export Edited Photo
                 </Button>
            )}
             {!filteredUrl && previewUrl && (
                 <p className="text-xs text-muted-foreground text-center">Select a style and apply it!</p>
            )}
          </div>

        </CardContent>
         <CardFooter className="border-t bg-card p-4 text-center text-xs text-muted-foreground">
           Client-side Filtering | AnalogLens &copy; {new Date().getFullYear()}
         </CardFooter>
      </Card>
      <Toaster />
    </div>
  );
}

// Ensure fade-in animation is in globals.css
// @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
// .animate-fade-in { animation: fadeIn 0.5s ease-in-out; }
// Make sure globals.css includes:
/*
@layer utilities {
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .animate-fade-in {
    animation: fadeIn 0.5s ease-in-out;
  }
}
*/
