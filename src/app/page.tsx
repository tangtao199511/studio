
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
import { Slider } from "@/components/ui/slider"; // Import Slider component
import { Loader2, Upload, Download, Paintbrush, ZoomIn, X, Eye, EyeOff } from 'lucide-react'; // Added Eye, EyeOff
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";


// Helper function to apply filters using Canvas
const applyClientSideFilter = (
  img: HTMLImageElement,
  style: string,
  scene: string,
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

    // --- Filter definitions ---
    const filters: Record<string, Record<string, number>> = {
      'Kodak Portra 400': { contrast: 1.1, saturate: 1.1, brightness: 1.05, sepia: 0.1 },
      'Fujifilm Velvia 50': { saturate: 1.4, contrast: 1.2, brightness: 0.95 },
      'Ilford HP5 Plus 400': { grayscale: 1, contrast: 1.2, brightness: 1.1 },
      'CineStill 800T': { contrast: 1.15, brightness: 1.0, sepia: 0.1, 'hue-rotate': -10, saturate: 1.1 },
      'Agfa Vista 200': { contrast: 1.05, saturate: 1.15, brightness: 1.0, sepia: 0.15 },
      'Lomography Color Negative 400': { saturate: 1.3, contrast: 1.1, brightness: 1.0 },
      'Classic Teal & Orange LUT': { contrast: 1.1, sepia: 0.2, 'hue-rotate': -15, saturate: 1.2 },
      'Vintage Sepia Tone': { sepia: 0.7, contrast: 1.05, brightness: 0.95 },
      'Cool Cinematic Look': { contrast: 1.1, brightness: 0.95, 'hue-rotate': -10, saturate: 1.1 },
      'Warm Golden Hour LUT': { sepia: 0.25, contrast: 1.05, brightness: 1.1, saturate: 1.1 },
      'None': {}, // Added None option
    };

    // --- Default values for filters ---
    const defaults: Record<string, number> = {
      contrast: 1,
      saturate: 1,
      brightness: 1,
      sepia: 0,
      grayscale: 0,
      'hue-rotate': 0,
    };

    let styleFilters = filters[style] || filters['None']; // Get filters for the selected style

    // --- Scene Adjustments (Modify styleFilters directly) ---
    // These adjustments are applied *after* the base style filters are determined
    // and *before* intensity is applied.
    let sceneAdjustments: Record<string, number> = {};
    switch (scene) {
      case 'portrait':
        sceneAdjustments = { contrast: 0.95, sepia: 0.05 }; // Slightly soften contrast, add warmth
        break;
      case 'landscape':
        sceneAdjustments = { contrast: 1.05, saturate: 1.05 }; // Enhance contrast and saturation
        break;
      case 'flowers':
        sceneAdjustments = { saturate: 1.1 }; // Boost saturation
        break;
      case 'street':
        sceneAdjustments = { contrast: 1.1 }; // Increase contrast
        break;
      // Add other scenes if needed
      default:
        sceneAdjustments = {}; // No adjustment for general/other scenes
    }

    // Combine base style filters with scene adjustments
    let combinedFilters = { ...styleFilters };
    for (const [filter, adjustmentValue] of Object.entries(sceneAdjustments)) {
        const baseValue = combinedFilters[filter] ?? defaults[filter];
        // For additive adjustments like sepia or hue-rotate, add the adjustment
        if (filter === 'sepia' || filter === 'hue-rotate') {
            combinedFilters[filter] = baseValue + adjustmentValue;
        }
        // For multiplicative adjustments like contrast, saturate, brightness, multiply
        else if (filter === 'contrast' || filter === 'saturate' || filter === 'brightness' || filter === 'grayscale') {
             combinedFilters[filter] = baseValue * adjustmentValue;
        }
        // Potentially handle other filter types or add new ones if needed
    }


    // --- Apply Intensity Interpolation ---
    const intensityFactor = intensity / 100;
    let filterString = '';
    // Iterate through all possible filters defined in defaults
    for (const filter of Object.keys(defaults)) {
        const defaultValue = defaults[filter];
        // Use the value from combinedFilters if available, otherwise use the default
        const targetValue = combinedFilters[filter] ?? defaultValue;

        // Apply intensity interpolation only if the target value is different from the default
        if (targetValue !== defaultValue) {
            const interpolatedValue = defaultValue + (targetValue - defaultValue) * intensityFactor;
            if (filter === 'hue-rotate') {
                filterString += ` ${filter}(${Math.round(interpolatedValue)}deg)`; // hue-rotate needs integer degrees
            } else {
                filterString += ` ${filter}(${interpolatedValue.toFixed(3)})`; // Use more precision for others
            }
        }
        // If target value is the same as default, but the style explicitly set it (e.g., grayscale: 1)
        // and intensity is 100%, apply it directly. For intensity < 100%, it won't be applied if it matches default.
        else if (styleFilters[filter] !== undefined && intensityFactor === 1) {
             if (filter === 'hue-rotate') {
                filterString += ` ${filter}(${Math.round(targetValue)}deg)`;
            } else {
                filterString += ` ${filter}(${targetValue.toFixed(3)})`;
            }
        }
    }


    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply the calculated filter string
    ctx.filter = filterString.trim() || 'none'; // Ensure 'none' if empty

    // Draw the image ONCE with the filter applied
    ctx.drawImage(img, 0, 0);

    // Reset filter before getting data URL (important for subsequent draws if any)
    ctx.filter = 'none';

    try {
       // Determine output format based on input mime type, default to PNG
       let outputMimeType = 'image/png';
       if (mimeType === 'image/jpeg') {
           outputMimeType = 'image/jpeg';
       } else if (mimeType === 'image/webp') {
           outputMimeType = 'image/webp';
       }
       // Use the determined mime type and quality for JPEG/WebP
       resolve(canvas.toDataURL(outputMimeType, quality));
    } catch (e) {
        console.error("Error converting canvas to data URL:", e);
        // Fallback to PNG if specific format fails
        try {
            resolve(canvas.toDataURL('image/png'));
        } catch (pngError) {
            console.error("Fallback to PNG also failed:", pngError);
            reject(pngError); // Reject if PNG conversion also fails
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
    maxDimension: number = 800 // Max width/height for preview
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

        if (!ctx) {
            reject(new Error('Could not get canvas context for preview'));
            return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        try {
            // Use WebP for preview if possible, fallback to JPEG, then PNG
            const webpUrl = canvas.toDataURL('image/webp', 0.8); // Lower quality for preview
            if (webpUrl.length > 10) { // Basic check for successful conversion
                 resolve(webpUrl);
            } else {
                 const jpegUrl = canvas.toDataURL('image/jpeg', 0.8);
                 if (jpegUrl.length > 10) {
                     resolve(jpegUrl);
                 } else {
                     resolve(canvas.toDataURL('image/png')); // Fallback to PNG
                 }
            }
        } catch (e) {
            console.error("Error creating low-res preview:", e);
             try {
                resolve(canvas.toDataURL('image/png')); // Final fallback to PNG
             } catch(pngError){
                 reject(pngError);
             }
        }
    });
};

// Debounce helper function
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
    const context = this;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}


export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalDataUrl, setOriginalDataUrl] = useState<string | null>(null); // Store original full-res data URL
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // This will hold the low-res preview
  const [filteredUrl, setFilteredUrl] = useState<string | null>(null); // Holds full-res filtered image
  const [filteredPreviewUrl, setFilteredPreviewUrl] = useState<string | null>(null); // Optional: low-res filtered preview
  const [analogStyle, setAnalogStyle] = useState<string>('Kodak Portra 400');
  const [sceneCategory, setSceneCategory] = useState<string>('landscape');
  const [filterIntensity, setFilterIntensity] = useState<number>(100); // Add state for intensity (0-100)
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false); // State for modal visibility
  const [isModalImageLoading, setIsModalImageLoading] = useState<boolean>(true); // State for modal image loading
  const [modalImageError, setModalImageError] = useState<boolean>(false); // State for modal image error
  const [currentMimeType, setCurrentMimeType] = useState<string>('image/png'); // Store the original mime type
  const [showOriginalPreview, setShowOriginalPreview] = useState<boolean>(false); // State for preview toggle


  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Clean up object URLs if they exist (Blob URLs)
    // Data URLs don't need explicit cleanup like Blob URLs
    return () => {
       // No explicit cleanup needed for data URLs stored in state
       // If blob URLs were used, they would be revoked here:
       // if (previewUrl && previewUrl.startsWith('blob:')) { URL.revokeObjectURL(previewUrl); }
    };
  }, []); // Run only on mount/unmount

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
       if (!file.type.startsWith('image/')) {
            toast({
                title: "Invalid File Type",
                description: "Please select an image file (JPEG, PNG, WEBP, etc.).",
                variant: "destructive",
            });
            return;
        }

      setIsLoading(true); // Show loading indicator
      setProgress(5); // Initial progress

      try {
          const dataUrl = await readFileAsDataURL(file);
          setOriginalDataUrl(dataUrl); // Store the full-res original
          setCurrentMimeType(file.type); // Store mime type
          setProgress(15);

          const img = new window.Image();
          img.onload = async () => {
              try {
                  const lowRes = await createLowResPreview(img);
                  setPreviewUrl(lowRes); // Set the low-res preview
                  setSelectedFile(file);
                  setFilteredUrl(null); // Reset filtered images
                  setFilteredPreviewUrl(null);
                  setProgress(100);
                   toast({ title: "Image Loaded", description: "Preview generated successfully." });
                   // Automatically apply the default filter once the image is loaded
                   handleApplyFilter(dataUrl, analogStyle, sceneCategory, filterIntensity, file.type);
              } catch (previewError: any) {
                   console.error("Error generating preview:", previewError);
                   // If preview fails, still try to load the original full res as preview
                   setPreviewUrl(dataUrl);
                   setSelectedFile(file);
                   setFilteredUrl(null);
                   setFilteredPreviewUrl(null);
                   setProgress(100);
                   toast({ title: "Preview Error", description: "Could not generate low-res preview, using original.", variant: "default"});
                    // Automatically apply the default filter even if preview fails
                   handleApplyFilter(dataUrl, analogStyle, sceneCategory, filterIntensity, file.type);
              } finally {
                  setIsLoading(false);
                  setTimeout(() => setProgress(0), 1000);
              }
          };
          img.onerror = (errorEvent) => {
              console.error('Error loading image data:', errorEvent);
              toast({
                  title: "Image Load Error",
                  description: "Could not load image data. File might be corrupt or unsupported.",
                  variant: "destructive",
              });
              // Reset states
              setOriginalDataUrl(null);
              setPreviewUrl(null);
              setSelectedFile(null);
              setFilteredUrl(null);
              setFilteredPreviewUrl(null);
              setIsLoading(false);
              setProgress(0);
          }
          img.src = dataUrl; // Start loading image
          setProgress(25); // Progress update

      } catch (readError: any) {
          console.error("Error reading file:", readError);
          toast({
              title: "File Read Error",
              description: `Could not read the file: ${readError.message || 'Unknown error'}.`,
              variant: "destructive",
          });
          setIsLoading(false);
          setProgress(0);
      }

    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // Updated handleApplyFilter to accept parameters directly
  const handleApplyFilter = useCallback(async (
     sourceUrl: string | null = originalDataUrl, // Default to state if not passed
     style: string = analogStyle,
     scene: string = sceneCategory,
     intensity: number = filterIntensity,
     mimeType: string = currentMimeType
     ) => {
    if (!sourceUrl) { // Check if the source URL (original or passed) is available
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
       // Use the provided sourceUrl for filtering
       const img = new window.Image();

       img.onload = async () => {
           setProgress(30); // Progress after image object loaded in memory
           try {
               // Apply filter to the full-resolution image with intensity
               const filteredDataUri = await applyClientSideFilter(img, style, scene, intensity, mimeType);
               setProgress(70); // Progress after filtering

               setFilteredUrl(filteredDataUri); // Store full-res filtered image

               // Generate low-res preview of the filtered image for the main display
               const filteredImgForPreview = new window.Image();
               filteredImgForPreview.onload = async () => {
                   try {
                       const lowResFiltered = await createLowResPreview(filteredImgForPreview, 800);
                       setFilteredPreviewUrl(lowResFiltered); // Update low-res filtered preview state
                   } catch (previewError) {
                       console.warn("Could not generate filtered preview:", previewError);
                       setFilteredPreviewUrl(filteredDataUri); // Fallback to full-res filtered if preview fails
                   }
                   setProgress(90); // Progress after filtered preview (potential) generation
               };
               filteredImgForPreview.onerror = () => {
                  console.warn("Error loading filtered image for preview generation");
                  setFilteredPreviewUrl(filteredDataUri); // Fallback
                   setProgress(90); // Still update progress
               };
               filteredImgForPreview.src = filteredDataUri; // Load the generated full-res filtered image

               // Only show toast if it wasn't triggered by the initial auto-apply
               // We can check if filteredUrl was null before this call
               // Or add a flag/parameter if needed for more complex scenarios
               if (filteredUrl !== null) { // Simple check: only toast on subsequent manual applies
                 toast({
                   title: "Style Updated",
                   description: `${style} style applied at ${intensity}% intensity.`, // Updated toast message
                 });
               }
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
            console.error('Error loading image data for filtering:', errorEvent instanceof ErrorEvent ? errorEvent.message : errorEvent);
            toast({
                title: "Image Load Error",
                description: `Could not load the image data for processing: ${errorEvent instanceof ErrorEvent ? errorEvent.message : 'Unknown image load error.'}`,
                variant: "destructive",
            });
            setIsLoading(false);
            setProgress(0); // Reset progress on error
       }

       // Start loading the image data into the Image object
       img.src = sourceUrl;
       setProgress(25); // Progress update while image decodes

    } catch (error: any) { // Catch errors related to the overall process initiation
      console.error('Error preparing for filtering:', error);
      toast({
        title: "Processing Error",
        description: `An unexpected error occurred: ${error.message || 'Please try again.'}`,
        variant: "destructive",
      });
      setIsLoading(false);
      setProgress(0); // Reset progress on error
    }
  // Removed dependency array elements that are now passed as arguments
  }, [toast, setFilteredUrl, setFilteredPreviewUrl, setIsLoading, setProgress, originalDataUrl, analogStyle, sceneCategory, filterIntensity, currentMimeType, filteredUrl]); // Added filteredUrl to dependency


  // Debounced filter application when slider changes
  // Wrapped handleApplyFilter call to pass current state values
  const debouncedApplyFilter = useCallback(
    debounce(() => {
      handleApplyFilter(originalDataUrl, analogStyle, sceneCategory, filterIntensity, currentMimeType);
    }, 500), // Increased debounce delay to 500ms
    [handleApplyFilter, originalDataUrl, analogStyle, sceneCategory, filterIntensity, currentMimeType] // Include all dependencies used in the debounced call
  );

  const handleIntensityChange = (value: number[]) => {
      setFilterIntensity(value[0]);
      if (originalDataUrl) { // Only apply if an image is loaded
          debouncedApplyFilter(); // Use debounced version for smoother UX
      }
  };


  const handleExport = () => {
    if (!filteredUrl) { // Export the full-res filtered image
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

    link.download = `AnalogLens_${safeStyleName}_${sceneCategory}_${filterIntensity}pct_${Date.now()}.${extension}`; // Include intensity in filename
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

     toast({
        title: "Exported",
        description: "Edited photo saved successfully.",
      });
  };

  const handleImageClick = () => {
    // Always open the full-res filtered image in the modal if available
    if (filteredUrl) {
        setIsModalImageLoading(true); // Reset loading state each time modal opens
        setModalImageError(false); // Reset error state
        setIsModalOpen(true);
    } else if (previewUrl) { // If no filtered image, show the original preview (which is low-res)
        toast({
            title: "Preview",
            description: "This is the original image preview. Apply a style first to view the edited version.",
            variant: "default",
        });
        // Optionally, allow viewing the full-res original in the modal
        // if (originalDataUrl) {
        //     setIsModalImageLoading(true);
        //     setModalImageError(false);
        //     // Temp set filteredUrl to original for modal display? Or add another state?
        //     // For simplicity, just showing a toast might be better unless specifically requested.
        //     setIsModalOpen(true); // If you want to view original large
        // }
    }
  }


  const handleModalOpenChange = (open: boolean) => {
      setIsModalOpen(open);
      if (!open) {
          // Reset modal-specific states when it closes
          setIsModalImageLoading(true);
          setModalImageError(false);
      }
  }

   // Handlers for the 'Preview Original' button
   const handlePreviewOriginalPress = () => {
    if (filteredPreviewUrl) { // Only allow if a filtered image exists
        setShowOriginalPreview(true);
    }
   };

   const handlePreviewOriginalRelease = () => {
       setShowOriginalPreview(false);
   };

  const analogStyles = [
    'Kodak Portra 400', 'Fujifilm Velvia 50', 'Ilford HP5 Plus 400',
    'CineStill 800T', 'Agfa Vista 200', 'Lomography Color Negative 400',
    'Classic Teal & Orange LUT', 'Vintage Sepia Tone', 'Cool Cinematic Look',
    'Warm Golden Hour LUT', 'None' // Added None
  ];

  const sceneCategories = ['landscape', 'portrait', 'flowers', 'waterland', 'street', 'architecture', 'food', 'general'];

  // Determine which URL to display in the main preview area
  // Prioritize: Original Preview (if toggled) > Filtered Preview > Original Preview > Placeholder
  const displayUrl = showOriginalPreview ? previewUrl : (filteredPreviewUrl || previewUrl);
  const displayAlt = showOriginalPreview ? "Original Photo Preview (Hold)" : (filteredPreviewUrl ? `Photo with ${analogStyle} filter applied` : (previewUrl ? "Original Photo Preview" : "Import a photo"));


  // JSX Return
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary flex flex-col items-center justify-center p-4 md:p-8">
      <Card className="w-full max-w-6xl shadow-xl overflow-hidden"> {/* Increased max-w */}
        <CardHeader className="bg-card border-b p-4 md:p-6">
          <CardTitle className="text-2xl md:text-3xl font-bold tracking-tight text-center text-primary">
            AnalogLens ✨
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground mt-1">
            Apply classic analog film styles to your photos instantly.
          </CardDescription>
        </CardHeader>
        {/* Adjusted grid columns: controls take less space (e.g., 1/3), preview takes more (e.g., 2/3) */}
        <CardContent className="p-4 md:p-8 grid md:grid-cols-3 gap-6 md:gap-8 items-start">
          {/* Left Column: Controls (takes 1 part) */}
          <div className="md:col-span-1 space-y-4 md:space-y-5"> {/* Reduced vertical spacing slightly */}
            {/* Import */}
            <div className="space-y-1.5"> {/* Reduced space inside control group */}
              <Label htmlFor="photo-upload" className="text-xs md:text-sm font-medium">1. Import Photo</Label>
              <Button onClick={handleImportClick} variant="outline" size="sm" className="w-full justify-center text-xs md:text-sm"> {/* Smaller button */}
                <Upload className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" /> {/* Smaller icon */}
                {selectedFile ? `Selected: ${selectedFile.name.substring(0, 15)}...` : 'Choose Photo'}
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
                 <p className="text-xs text-muted-foreground text-center">Original loaded. Applying default style...</p>
               )}
                {filteredUrl && (
                 <p className="text-xs text-muted-foreground text-center">Style applied.</p>
               )}
            </div>

            {/* Style Selection */}
            <div className="space-y-1.5">
              <Label htmlFor="analog-style" className="text-xs md:text-sm font-medium">2. Select Style</Label>
              <Select
                 value={analogStyle}
                 onValueChange={(value) => {
                    setAnalogStyle(value);
                    if (originalDataUrl) handleApplyFilter(originalDataUrl, value, sceneCategory, filterIntensity, currentMimeType);
                  }}
                  disabled={!originalDataUrl || isLoading} // Disable if no image or loading
                >
                <SelectTrigger id="analog-style" className="w-full h-9 text-xs md:text-sm"> {/* Smaller trigger */}
                  <SelectValue placeholder="Choose a style" />
                </SelectTrigger>
                <SelectContent>
                  {analogStyles.map(style => (
                     <SelectItem key={style} value={style} className="text-xs md:text-sm">{style}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Scene Selection */}
            <div className="space-y-1.5">
              <Label htmlFor="scene-category" className="text-xs md:text-sm font-medium">3. Select Context</Label>
              <Select
                 value={sceneCategory}
                 onValueChange={(value) => {
                     setSceneCategory(value);
                     if (originalDataUrl) handleApplyFilter(originalDataUrl, analogStyle, value, filterIntensity, currentMimeType);
                  }}
                  disabled={!originalDataUrl || isLoading} // Disable if no image or loading
                >
                <SelectTrigger id="scene-category" className="w-full h-9 text-xs md:text-sm"> {/* Smaller trigger */}
                  <SelectValue placeholder="Choose context" />
                </SelectTrigger>
                <SelectContent>
                   {sceneCategories.map(scene => (
                     <SelectItem key={scene} value={scene} className="capitalize text-xs md:text-sm">{scene}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
               <p className="text-xs text-muted-foreground">Fine-tunes the style.</p>
            </div>

             {/* Intensity Slider */}
             <div className="space-y-1.5">
               <Label htmlFor="intensity-slider" className="text-xs md:text-sm font-medium">4. Adjust Intensity ({filterIntensity}%)</Label>
               <Slider
                 id="intensity-slider"
                 min={0}
                 max={100}
                 step={1}
                 value={[filterIntensity]}
                 onValueChange={handleIntensityChange} // Use the updated handler
                 className="my-2" // Add some margin
                 disabled={!originalDataUrl || isLoading} // Disable if no image loaded or loading
               />
             </div>

            {/* Apply Filter Button (Now acts more like a re-apply/refresh if needed) */}
             <div className="space-y-1.5">
                {/* Maybe hide this button or change its text, as filters apply on change now */}
                 <Button
                    onClick={() => handleApplyFilter()} // Call without args to use current state
                    disabled={!originalDataUrl || isLoading} // Disable if no original data or loading
                    size="sm" // Smaller button
                    variant="secondary" // Changed variant as primary action is automatic
                    className="w-full text-xs md:text-sm"
                >
                    {isLoading ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4 animate-spin" />
                    ) : (
                     <Paintbrush className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" />
                    )}
                    {isLoading ? 'Applying...' : 'Re-apply Style'}
                </Button>
            </div>

            {/* Progress Bar */}
             {isLoading && (
                <div className="space-y-1">
                    <Progress value={progress} className="w-full h-1.5 md:h-2" /> {/* Slightly thinner bar */}
                    <p className="text-xs text-muted-foreground text-center">{progress}%</p>
                </div>
             )}

             {/* Preview Original Button */}
             {filteredPreviewUrl && previewUrl && (
                 <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs md:text-sm"
                    onMouseDown={handlePreviewOriginalPress} // Use onMouseDown for press
                    onMouseUp={handlePreviewOriginalRelease} // Use onMouseUp for release
                    onTouchStart={handlePreviewOriginalPress} // Add touch start
                    onTouchEnd={handlePreviewOriginalRelease} // Add touch end
                 >
                    {showOriginalPreview ? <EyeOff className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" /> : <Eye className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" />}
                    {showOriginalPreview ? 'Release for Filtered' : 'Hold to Preview Original'}
                 </Button>
             )}


            {/* Export Button (moved to controls column) */}
            {filteredUrl && (
                 <Button onClick={handleExport} variant="default" size="sm" className="w-full text-xs md:text-sm">
                    <Download className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" /> Export Edited
                 </Button>
            )}
             {!filteredUrl && previewUrl && (
                 <p className="text-xs text-muted-foreground text-center pt-2">Style applied. Export enabled.</p>
            )}
             {!previewUrl && (
                 <p className="text-xs text-muted-foreground text-center pt-2">Import an image to begin.</p>
            )}

          </div>

          {/* Right Column: Image Preview (takes 2 parts) */}
          <div className="md:col-span-2 space-y-3 md:space-y-4"> {/* Slightly reduced spacing */}
             <Label className="text-sm font-medium block text-center">Preview</Label>
             <div
                // Increased aspect ratio for a larger preview area
                className="aspect-w-16 aspect-h-10 w-full bg-muted rounded-lg overflow-hidden border flex items-center justify-center relative shadow-inner cursor-pointer group"
                onClick={handleImageClick} // Add click handler to the container
              >
                {displayUrl ? (
                  <>
                    <Image
                      src={displayUrl} // Use the determined display URL
                      alt={displayAlt} // Use the determined alt text
                      fill // Changed layout to fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 66vw, 800px" // Add sizes prop
                      style={{ objectFit: 'contain' }} // Use style for objectFit with fill
                      data-ai-hint={showOriginalPreview ? "original preview" : (filteredUrl ? "filtered preview" : "original preview")}
                      // Removed animation class to prevent blinking on state change
                      unoptimized // Use unoptimized for data URLs and frequent changes
                      priority={!filteredUrl} // Prioritize loading the initial original preview
                    />
                    {/* Zoom icon overlay - appears on hover over the preview container */}
                    {(filteredUrl || originalDataUrl) && ( // Show zoom if there's something to zoom into (filtered or original full-res)
                         <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                             <ZoomIn className="h-10 w-10 text-white" />
                         </div>
                    )}
                  </>
                ) : (
                  // Placeholder when no image is loaded
                  <div className="text-muted-foreground p-8 text-center">
                    <Upload className="mx-auto h-10 w-10 md:h-12 md:w-12 mb-3 md:mb-4 opacity-50" /> {/* Slightly smaller icon */}
                    Import a photo to start
                  </div>
                )}
                 {/* Loading overlay (only shows when isLoading is true) */}
                 {isLoading && (
                  <div className="absolute inset-0 bg-background/70 flex flex-col items-center justify-center backdrop-blur-sm space-y-2 z-10">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Processing...</p>
                       <Progress value={progress} className="w-3/4 max-w-xs h-1.5 md:h-2" />
                  </div>
                )}
             </div>
          </div>

        </CardContent>
         <CardFooter className="border-t bg-card p-3 md:p-4 text-center text-xs text-muted-foreground">
           Client-side Filtering | AnalogLens &copy; {new Date().getFullYear()}
         </CardFooter>
      </Card>
      <Toaster />

      {/* Modal Dialog for Full View */}
       <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
         {/* Content sized based on viewport, padding removed, background transparent */}
         <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-[85vw] lg:max-w-[80vw] xl:max-w-[75vw] p-0 border-0 bg-transparent shadow-none flex items-center justify-center min-h-[60vh]">
            <DialogHeader className="absolute -top-96 left-0"> {/* Visually hidden header for accessibility */}
             <DialogTitle>Full Size Image Preview</DialogTitle>
           </DialogHeader>
           {/* Check filteredUrl (which holds the full-res filtered image) */}
           {filteredUrl && (
             <div className="relative w-full h-auto max-h-[85vh]"> {/* Removed aspect ratio */}
                 {/* Loading indicator */}
                 {isModalImageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    </div>
                 )}
                 {/* Error message */}
                 {modalImageError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-destructive/20 text-destructive-foreground z-10 p-4">
                       <p className="text-center">Error loading full-size image.</p>
                    </div>
                 )}
                 {/* The Image component */}
                 <Image
                   src={filteredUrl} // Display the full-res filtered image here
                   alt={`Filtered photo - ${analogStyle} - Full size`}
                   width={1920} // Provide estimated width
                   height={1080} // Provide estimated height
                   style={{ // Use style for responsive sizing and contain
                     width: '100%',
                     height: 'auto',
                     maxHeight: '85vh',
                     objectFit: 'contain'
                   }}
                   data-ai-hint="zoomed filtered image"
                   unoptimized // Important for Data URLs
                   className={cn(
                       "rounded-lg transition-opacity duration-300", // Optional styling
                       isModalImageLoading || modalImageError ? "opacity-0" : "opacity-100" // Hide image while loading or on error
                   )}
                   onLoad={() => setIsModalImageLoading(false)} // Use onLoad instead of onLoadingComplete for better compatibility maybe?
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
           {/* Close button provided by DialogContent */}
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
    
