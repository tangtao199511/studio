// src/app/page.tsx
'use client';

import type { ChangeEvent } from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';
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
import { Dialog, DialogContent, DialogTrigger, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog"; // Import Dialog components
import { Loader2, Upload, Download, Paintbrush, ZoomIn, X } from 'lucide-react';
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
  const [progress, setProgress] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false); // State for modal visibility
  const [isModalImageLoading, setIsModalImageLoading] = useState<boolean>(true); // State for modal image loading
  const [modalImageError, setModalImageError] = useState<boolean>(false); // State for modal image error

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Clean up object URLs when component unmounts or file changes
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      // No need to revoke filteredUrl as it's a data URL
    };
  }, [previewUrl]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
       if (!file.type.startsWith('image/')) {
            toast({
                title: "Invalid File Type",
                description: "Please select an image file.",
                variant: "destructive",
            });
            return;
        }

      setSelectedFile(file);
      // Revoke previous blob URL if it exists
      if (previewUrl && previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrl);
      }

      const newPreviewUrl = URL.createObjectURL(file);
      setPreviewUrl(newPreviewUrl);
      setFilteredUrl(null); // Reset filtered image when new file is selected
      setProgress(0);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleApplyFilter = useCallback(async () => {
    if (!selectedFile) {
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
       const dataUrl = await readFileAsDataURL(selectedFile);
       setProgress(20); // Progress after reading file

       const img = new window.Image();

       img.onload = async () => {
           setProgress(30); // Progress after image object loaded in memory
           try {
               const filteredDataUri = await applyClientSideFilter(img, analogStyle, sceneCategory, 'image/png');
               setProgress(70); // Progress after filtering

               setFilteredUrl(filteredDataUri);
               toast({
                 title: "Style Applied",
                 description: `${analogStyle} style applied for ${sceneCategory} scene.`,
               });
               setProgress(100); // Final progress
           } catch (filterError: any) {
                console.error('Error applying filter:', filterError);
                toast({
                    title: "Filter Error",
                    description: `Failed to apply filter styles: ${filterError.message || 'Please try again.'}`,
                    variant: "destructive",
                });
                setProgress(0); // Reset progress on error
           } finally {
               setIsLoading(false);
               // Keep progress bar at 100 for a short while, then reset
               setTimeout(() => setProgress(0), 1500);
           }
       };

       img.onerror = (errorEvent) => { // Use error event for details
            console.error('Error loading image data for filtering:', errorEvent);
            toast({
                title: "Image Load Error",
                description: "Could not load the image data for processing. The file might be corrupted or in an unsupported format.",
                variant: "destructive",
            });
            setIsLoading(false);
            setProgress(0); // Reset progress on error
       }

       // Start loading the image data into the Image object
       img.src = dataUrl;
       setProgress(25); // Progress update while image decodes

    } catch (error: any) {
      console.error('Error reading file for filtering:', error);
      toast({
        title: "File Read Error",
        description: `Could not read the selected image file: ${error.message || 'Please try again.'}`,
        variant: "destructive",
      });
      setIsLoading(false);
      setProgress(0); // Reset progress on error
    }
  }, [selectedFile, analogStyle, sceneCategory, toast]);


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
    link.href = filteredUrl;

    // Determine extension based on MIME type (default to png)
    const mimeType = filteredUrl.split(';')[0].split(':')[1] || 'image/png';
    const extension = mimeType.split('/')[1] || 'png';
    const safeStyleName = analogStyle.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    link.download = `AnalogLens_${safeStyleName}_${sceneCategory}_${Date.now()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

     toast({
        title: "Exported",
        description: "Edited photo saved successfully.",
      });
  };

  const handleImageClick = () => {
    if (filteredUrl) {
        setIsModalImageLoading(true); // Reset loading state each time modal opens
        setModalImageError(false); // Reset error state
        setIsModalOpen(true);
    } else if (previewUrl) {
        // Optionally open original in modal too
        // setIsModalImageLoading(true); // Reset loading state
        // setModalImageError(false);
        // setIsModalOpen(true); // If you want to view original large
        toast({
            title: "Preview",
            description: "This is the original image. Apply a style first to view the edited version.",
            variant: "default",
        });
    }
  }

  const handleModalOpenChange = (open: boolean) => {
      setIsModalOpen(open);
      if (!open) {
          // Optional: Clean up states when modal closes if needed
          // setIsModalImageLoading(true);
          // setModalImageError(false);
      }
  }

  const analogStyles = [
    'Kodak Portra 400', 'Fujifilm Velvia 50', 'Ilford HP5 Plus 400',
    'CineStill 800T', 'Agfa Vista 200', 'Lomography Color Negative 400',
    'Classic Teal & Orange LUT', 'Vintage Sepia Tone', 'Cool Cinematic Look',
    'Warm Golden Hour LUT'
  ];

  const sceneCategories = ['landscape', 'portrait', 'flowers', 'waterland', 'street', 'architecture', 'food', 'general'];

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
                     <Paintbrush className="mr-2 h-4 w-4" />
                    )}
                    {isLoading ? 'Applying...' : 'Apply Style'}
                </Button>
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
             <div
                className="aspect-video w-full bg-muted rounded-lg overflow-hidden border flex items-center justify-center relative shadow-inner cursor-pointer group" // Added cursor-pointer and group
                onClick={handleImageClick} // Add click handler to the container
              >
                {/* Display filtered first, then preview, then placeholder */}
                {filteredUrl ? (
                  <>
                    <Image
                      src={filteredUrl}
                      alt={`Photo with ${analogStyle} filter applied`}
                      layout="fill"
                      objectFit="contain"
                      data-ai-hint="filtered image"
                      className="animate-fade-in"
                      unoptimized // Crucial for Data URLs
                    />
                    {/* Zoom icon overlay */}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                         <ZoomIn className="h-10 w-10 text-white" />
                    </div>
                  </>
                ) : previewUrl ? (
                   <>
                    <Image
                        src={previewUrl}
                        alt="Original Photo Preview"
                        layout="fill"
                        objectFit="contain"
                        data-ai-hint="original image"
                    />
                    {/* Optional: Hint to apply style */}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <p className="text-white text-sm">Apply a style to zoom</p>
                    </div>
                   </>
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

      {/* Modal Dialog for Full View */}
       <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
         <DialogContent className="max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw] xl:max-w-[60vw] p-0 border-0 bg-transparent shadow-none flex items-center justify-center min-h-[50vh]">
            <DialogHeader className="hidden"> {/* Visually hidden header for accessibility */}
             <DialogTitle>Filtered Image Preview</DialogTitle>
           </DialogHeader>
           {filteredUrl && (
             <div className="relative w-full h-auto aspect-[4/3] md:aspect-video"> {/* Adjust aspect ratio as needed */}
                 {/* Loading indicator */}
                 {isModalImageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    </div>
                 )}
                 {/* Error message */}
                 {modalImageError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-destructive/20 text-destructive-foreground z-10">
                       <p>Error loading image.</p>
                    </div>
                 )}
                 {/* The Image component */}
                 <Image
                   src={filteredUrl}
                   alt={`Filtered photo - ${analogStyle}`}
                   layout="fill"
                   objectFit="contain"
                   data-ai-hint="zoomed filtered image"
                   unoptimized // Important for Data URLs
                   className={cn(
                       "rounded-lg transition-opacity duration-300", // Optional styling
                       isModalImageLoading || modalImageError ? "opacity-0" : "opacity-100" // Hide image while loading or on error
                   )}
                   onLoadingComplete={() => setIsModalImageLoading(false)}
                   onError={() => {
                       setIsModalImageLoading(false);
                       setModalImageError(true);
                       toast({
                           title: "Zoom Error",
                           description: "Could not load the full-size image.",
                           variant: "destructive"
                       });
                   }}
                 />
             </div>
           )}
           {/* Close button is automatically handled by ShadCN Dialog */}
         </DialogContent>
       </Dialog>
    </div>
  );
}


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
