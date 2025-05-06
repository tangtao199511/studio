

// src/app/page.tsx
'use client';

import type { ChangeEvent } from 'react';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react'; // Added useMemo, useEffect
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

    // --- Filter definitions (Base values at 100% intensity) ---
    const filters: Record<string, Record<string, number>> = {
      'Kodak Portra 400': { contrast: 1.1, saturate: 1.1, brightness: 1.05, sepia: 0.1 },
      'Fujifilm Velvia 50': { saturate: 1.4, contrast: 1.2, brightness: 0.95 },
      'Ilford HP5 Plus 400': { grayscale: 1, contrast: 1.2, brightness: 1.1 },
      'CineStill 800T': { contrast: 1.15, brightness: 1.0, sepia: 0.1, 'hue-rotate': -10, saturate: 1.1 },
      'Agfa Vista 200': { contrast: 1.05, saturate: 1.15, brightness: 1.0, sepia: 0.15 },
      'Lomography Color Negative 400': { saturate: 1.3, contrast: 1.1, brightness: 1.0 },
      'Classic Teal & Orange LUT': { contrast: 1.1, sepia: 0.2, 'hue-rotate': -15, saturate: 1.2 }, // New
      'Vintage Sepia Tone': { sepia: 0.7, contrast: 1.05, brightness: 0.95 }, // New (strong sepia)
      'Cool Cinematic Look': { contrast: 1.1, brightness: 0.95, 'hue-rotate': -10, saturate: 1.1 }, // New (slight adjustment from CineStill)
      'Warm Golden Hour LUT': { sepia: 0.25, contrast: 1.05, brightness: 1.1, saturate: 1.1 }, // New
      'High Contrast B&W': { grayscale: 1, contrast: 1.5, brightness: 1.0 }, // New B&W
      'Faded Vintage Film': { saturate: 0.8, contrast: 0.9, brightness: 1.1, sepia: 0.2 }, // New Faded
      'Vibrant Summer Day': { saturate: 1.3, brightness: 1.05, contrast: 1.05 }, // New Vibrant
      'Cross Processed Look': { saturate: 1.2, contrast: 1.1, 'hue-rotate': 15, brightness: 0.95 }, // New Cross Processed
      'Technicolor Dream': { saturate: 1.6, contrast: 1.1, brightness: 1.0, 'hue-rotate': 10 }, // New - Strong Saturation
      'Bleach Bypass': { contrast: 1.4, saturate: 0.7, brightness: 1.05 }, // New - Desaturated High Contrast
      'Infrared Simulation': { 'hue-rotate': 180, saturate: 1.2, contrast: 1.1, brightness: 1.1 }, // New - Faux Infrared
      'Grungy Matte Look': { contrast: 0.9, saturate: 0.9, brightness: 1.05, sepia: 0.1 }, // New - Low Contrast Matte
      'Neon Noir': { contrast: 1.3, brightness: 0.9, saturate: 1.4, 'hue-rotate': -20 }, // New - High Contrast, Shifted Hues
      'None': {}, // Added None option
    };

    // --- Default values for filters (represent 0% intensity) ---
    const defaults: Record<string, number> = {
      contrast: 1,
      saturate: 1,
      brightness: 1,
      sepia: 0,
      grayscale: 0,
      'hue-rotate': 0,
    };

    let styleFilters = filters[style] || filters['None']; // Get filters for the selected style

    // --- Scene Adjustments (Modify styleFilters based on context) ---
    // These adjustments are applied *after* the base style filters are determined
    // and *before* intensity is applied. They modify the target values.
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
      case 'waterland': // Example for a new context
        sceneAdjustments = { brightness: 1.05, saturate: 1.05, 'hue-rotate': -5 }; // Slightly brighter, more saturated, cooler tones
        break;
      case 'architecture': // Example
        sceneAdjustments = { contrast: 1.15, saturate: 0.9 }; // Higher contrast, slightly desaturated
        break;
      case 'food': // Example
        sceneAdjustments = { saturate: 1.1, brightness: 1.05, sepia: 0.05 }; // Boost saturation, slightly brighter, warmer
        break;
      // Add other scenes if needed
      case 'general':
      default:
        sceneAdjustments = {}; // No adjustment for general/other scenes
    }

    // Combine base style filters with scene adjustments to get the "target" values at 100% intensity
    let targetFilters = { ...styleFilters };
    for (const [filter, adjustmentValue] of Object.entries(sceneAdjustments)) {
        const baseValue = targetFilters[filter] ?? defaults[filter];
        // For additive adjustments like sepia or hue-rotate, add the adjustment
        if (filter === 'sepia' || filter === 'hue-rotate') {
            targetFilters[filter] = baseValue + adjustmentValue;
        }
        // For multiplicative adjustments like contrast, saturate, brightness, grayscale, multiply
        else if (['contrast', 'saturate', 'brightness', 'grayscale'].includes(filter)) {
             targetFilters[filter] = baseValue * adjustmentValue;
             // Clamp values if necessary (e.g., brightness/contrast shouldn't go below 0)
             if (targetFilters[filter] < 0) targetFilters[filter] = 0;
             if (filter === 'grayscale' && targetFilters[filter] > 1) targetFilters[filter] = 1; // Grayscale max 1
        }
        // Potentially handle other filter types or add new ones if needed
    }


    // --- Apply Intensity Interpolation ---
    const intensityFactor = intensity / 100; // Convert percentage to 0-1 range
    let filterString = '';
    // Iterate through all possible filters defined in defaults
    for (const filter of Object.keys(defaults)) {
        const defaultValue = defaults[filter]; // Value at 0% intensity
        // Use the value from combined/adjusted targetFilters if available, otherwise use the default (value at 100% intensity)
        const targetValue = targetFilters[filter] ?? defaultValue;

        // Linear interpolation: value = start + (end - start) * factor
        const interpolatedValue = defaultValue + (targetValue - defaultValue) * intensityFactor;

        // Add to filter string if the interpolated value is different from the default 0% value
        // Or if it's grayscale=1 (to handle B&W at less than 100% intensity)
        // Or if it's hue-rotate with a non-zero value
        if (Math.abs(interpolatedValue - defaultValue) > 0.001 || (filter === 'grayscale' && targetValue === 1) || (filter === 'hue-rotate' && Math.abs(interpolatedValue) > 0.001)) {
             if (filter === 'hue-rotate') {
                filterString += ` ${filter}(${Math.round(interpolatedValue)}deg)`; // hue-rotate needs integer degrees
            } else {
                filterString += ` ${filter}(${interpolatedValue.toFixed(3)})`; // Use more precision for others
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

  // Use refs for values needed inside debounced function to ensure latest value is used
  const intensityRef = useRef(filterIntensity);
  const analogStyleRef = useRef(analogStyle);
  const sceneCategoryRef = useRef(sceneCategory);
  const originalDataUrlRef = useRef(originalDataUrl);
  const currentMimeTypeRef = useRef(currentMimeType);

  // Update refs whenever the corresponding state changes
  useEffect(() => { intensityRef.current = filterIntensity; }, [filterIntensity]);
  useEffect(() => { analogStyleRef.current = analogStyle; }, [analogStyle]);
  useEffect(() => { sceneCategoryRef.current = sceneCategory; }, [sceneCategory]);
  useEffect(() => { originalDataUrlRef.current = originalDataUrl; }, [originalDataUrl]);
  useEffect(() => { currentMimeTypeRef.current = currentMimeType; }, [currentMimeType]);


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
                   // Use the current state values for initial application
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
                    // Use the current state values for initial application
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
  // Renamed parameters to avoid conflict with state variables
  const handleApplyFilter = useCallback(async (
     sourceUrlParam: string | null = originalDataUrlRef.current, // Use ref for default
     styleParam: string = analogStyleRef.current, // Use ref for default
     sceneParam: string = sceneCategoryRef.current, // Use ref for default
     intensityParam: number = intensityRef.current, // Use ref for default
     mimeTypeParam: string = currentMimeTypeRef.current // Use ref for default
     ) => {
    if (!sourceUrlParam) { // Check the source URL parameter
      // Don't toast if called automatically on load before user interaction
      return;
    }

    setIsLoading(true);
    setProgress(10); // Initial progress

    // Use local variable to store the initial filteredUrl state for toast logic
    const wasAlreadyFiltered = filteredUrl !== null;

    try {
       // Use the provided sourceUrlParam for filtering
       const img = new window.Image();

       img.onload = async () => {
           setProgress(30); // Progress after image object loaded in memory
           try {
               // Apply filter to the full-resolution image using the passed parameters
               const filteredDataUri = await applyClientSideFilter(img, styleParam, sceneParam, intensityParam, mimeTypeParam);
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

               // Toast logic based on whether it was already filtered and if parameters changed
               // Use refs here to compare with the parameters passed to the function
               const styleChanged = styleParam !== analogStyleRef.current;
               const sceneChanged = sceneParam !== sceneCategoryRef.current;
               const intensityChanged = intensityParam !== intensityRef.current;

               // Show toast if it wasn't the initial auto-apply OR if parameters actually changed
               if (wasAlreadyFiltered || styleChanged || sceneChanged || intensityChanged) {
                 toast({
                   title: "Style Updated",
                   description: `${styleParam} style applied to ${sceneParam} context at ${intensityParam}% intensity.`, // Use parameters in toast
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

       // Start loading the image data into the Image object using the source URL parameter
       img.src = sourceUrlParam;
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
  // Ensure all dependencies are correctly listed, focusing on state setters and toast
  // Keep handleApplyFilter stable by using refs inside and depending on setters/toast
  }, [toast, setFilteredUrl, setFilteredPreviewUrl, setIsLoading, setProgress, filteredUrl]);


  // Debounced filter application when slider changes
  // Use useMemo to create the debounced function only once
  const debouncedApplyFilter = useMemo(
    () => debounce(() => {
        // Read the latest values from refs when the debounced function actually executes
        handleApplyFilter(
            originalDataUrlRef.current,
            analogStyleRef.current,
            sceneCategoryRef.current,
            intensityRef.current, // Use the ref's current value
            currentMimeTypeRef.current
        );
    }, 500), // Keep debounce delay at 500ms
    [handleApplyFilter] // handleApplyFilter itself depends on setters and toast, which are stable
  );

  const handleIntensityChange = (value: number[]) => {
      const newIntensity = value[0];
      setFilterIntensity(newIntensity); // Update state immediately for the slider UI
      // Update the ref immediately as well - CRITICAL FIX
      intensityRef.current = newIntensity;
      if (originalDataUrlRef.current) { // Check ref for original URL
          debouncedApplyFilter(); // Call the debounced function
      }
  };


  const handleExport = () => {
    if (!filteredUrl || !selectedFile) { // Ensure both filtered image and original file exist
      toast({
        title: "Error",
        description: "No edited photo or original file information to export.",
        variant: "destructive",
      });
      return;
    }

    const link = document.createElement('a');
    link.href = filteredUrl;

    // Determine extension based on MIME type (default to png)
    const mimeType = filteredUrl.split(';')[0].split(':')[1] || 'image/png';
    const extension = mimeType.split('/')[1] || 'png';
    const safeStyleName = analogStyleRef.current.replace(/[^a-z0-9]/gi, '_').toLowerCase(); // Use ref

    // Get original filename without extension
    const originalFileName = selectedFile.name;
    const lastDotIndex = originalFileName.lastIndexOf('.');
    const fileNameWithoutExtension = lastDotIndex === -1 ? originalFileName : originalFileName.substring(0, lastDotIndex);

    // Construct the new filename
    link.download = `${fileNameWithoutExtension}_AnalogLens_${safeStyleName}_${sceneCategoryRef.current}_${intensityRef.current}pct.${extension}`; // Use refs and original filename

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
    'Warm Golden Hour LUT', 'High Contrast B&W', 'Faded Vintage Film',
    'Vibrant Summer Day', 'Cross Processed Look', 'Technicolor Dream',
    'Bleach Bypass', 'Infrared Simulation', 'Grungy Matte Look', 'Neon Noir',
    'None' // Added None
  ];

  const sceneCategories = ['landscape', 'portrait', 'flowers', 'waterland', 'street', 'architecture', 'food', 'general'];

  // Determine which URL to display in the main preview area
  // Prioritize: Original Preview (if toggled) > Filtered Preview > Original Preview > Placeholder
  const displayUrl = showOriginalPreview ? previewUrl : (filteredPreviewUrl || previewUrl);
  const displayAlt = showOriginalPreview ? "Original Photo Preview (Hold)" : (filteredPreviewUrl ? `Photo with ${analogStyle} filter applied` : (previewUrl ? "Original Photo Preview" : "Placeholder"));


  // JSX Return
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 md:p-8"> {/* Use background variable */}
      <Card className="w-full max-w-7xl shadow-lg overflow-hidden border-border/50 rounded-lg"> {/* Slightly softer shadow, border */}
        <CardHeader className="bg-card border-b border-border/50 p-4 md:p-6"> {/* Softer border */}
          <CardTitle className="text-2xl md:text-3xl font-semibold tracking-tight text-center text-primary"> {/* Adjusted font weight */}
            AnalogLens ✨
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground mt-1 text-sm"> {/* Adjusted font size */}
            Apply classic analog film styles to your photos instantly.
          </CardDescription>
        </CardHeader>
        {/* Adjusted grid columns: controls take less space (1/4), preview takes more (3/4) */}
        <CardContent className="p-4 md:p-6 grid md:grid-cols-4 gap-4 md:gap-6 items-start"> {/* Reduced padding slightly */}
          {/* Left Column: Controls (takes 1 part) */}
          <div className="md:col-span-1 space-y-3 md:space-y-4"> {/* Further reduced vertical spacing */}
            {/* Import */}
            <div className="space-y-1"> {/* Reduced space inside control group */}
              <Label htmlFor="photo-upload" className="text-xs font-medium text-foreground/80">1. Import</Label> {/* Softer label color */}
              <Button onClick={handleImportClick} variant="outline" size="sm" className="w-full justify-center text-xs"> {/* Smaller text */}
                <Upload className="mr-1 h-3 w-3" /> {/* Smaller icon and margin */}
                {selectedFile ? `Selected: ${selectedFile.name.substring(0, 12)}...` : 'Choose Photo'}
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
                 <p className="text-xs text-muted-foreground text-center pt-0.5">Applying style...</p> // Reduced padding
               )}
                {filteredUrl && !isLoading && ( // Only show if not currently loading
                 <p className="text-xs text-muted-foreground text-center pt-0.5">Style applied.</p> // Reduced padding
               )}
            </div>

            {/* Style Selection */}
            <div className="space-y-1">
              <Label htmlFor="analog-style" className="text-xs font-medium text-foreground/80">2. Style</Label> {/* Softer label color */}
              <Select
                 value={analogStyle}
                 onValueChange={(value) => {
                    setAnalogStyle(value);
                     // Update the ref immediately
                     analogStyleRef.current = value;
                    // Re-apply filter immediately when style changes, using the current intensity from REF
                    if (originalDataUrlRef.current) handleApplyFilter(originalDataUrlRef.current, value, sceneCategoryRef.current, intensityRef.current, currentMimeTypeRef.current);
                  }}
                  disabled={!originalDataUrl || isLoading} // Disable if no image or loading
                >
                <SelectTrigger id="analog-style" className="w-full h-8 text-xs"> {/* Smaller height and text */}
                  <SelectValue placeholder="Choose a style" />
                </SelectTrigger>
                {/* Adjust SelectContent styling for height */}
                <SelectContent className="max-h-[calc(10*2.2rem)]"> {/* Approximate height for 10 items */}
                  {analogStyles.map(style => (
                     <SelectItem key={style} value={style} className="text-xs">{style}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Scene Selection */}
            <div className="space-y-1">
              <Label htmlFor="scene-category" className="text-xs font-medium text-foreground/80">3. Context</Label> {/* Softer label color */}
              <Select
                 value={sceneCategory}
                 onValueChange={(value) => {
                     setSceneCategory(value);
                      // Update the ref immediately
                      sceneCategoryRef.current = value;
                     // Re-apply filter immediately when scene changes, using the current intensity from REF
                     if (originalDataUrlRef.current) handleApplyFilter(originalDataUrlRef.current, analogStyleRef.current, value, intensityRef.current, currentMimeTypeRef.current);
                  }}
                  disabled={!originalDataUrl || isLoading} // Disable if no image or loading
                >
                <SelectTrigger id="scene-category" className="w-full h-8 text-xs"> {/* Smaller height and text */}
                  <SelectValue placeholder="Choose context" />
                </SelectTrigger>
                <SelectContent>
                   {sceneCategories.map(scene => (
                     <SelectItem key={scene} value={scene} className="capitalize text-xs">{scene}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
               <p className="text-xs text-muted-foreground pt-0.5">Fine-tunes style.</p> {/* Reduced padding */}
            </div>

             {/* Intensity Slider */}
             <div className="space-y-1">
               <Label htmlFor="intensity-slider" className="text-xs font-medium text-foreground/80">4. Intensity ({filterIntensity}%)</Label> {/* Softer label color */}
               <Slider
                 id="intensity-slider"
                 min={0}
                 max={100}
                 step={1}
                 value={[filterIntensity]} // Controlled component based on state
                 onValueChange={handleIntensityChange} // Use the updated handler with debounce
                 className="my-1" // Reduced margin
                 disabled={!originalDataUrl || isLoading} // Disable if no image loaded or loading
               />
             </div>

            {/* Apply Filter Button (Now acts more like a re-apply/refresh if needed) */}
             <div className="space-y-1">
                 <Button
                    onClick={() => handleApplyFilter()} // Call without args to use current REFS
                    disabled={!originalDataUrl || isLoading} // Disable if no original data or loading
                    size="sm" // Smaller button
                    variant="secondary" // Changed variant as primary action is automatic
                    className="w-full text-xs h-8" // Smaller text and height
                >
                    {isLoading ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" /> // Smaller icon and margin
                    ) : (
                     <Paintbrush className="mr-1 h-3 w-3" /> // Smaller icon and margin
                    )}
                    {isLoading ? 'Applying...' : 'Re-apply'}
                </Button>
            </div>

            {/* Progress Bar */}
             {isLoading && (
                <div className="space-y-0.5"> {/* Reduced spacing */}
                    <Progress value={progress} className="w-full h-1 md:h-1.5" /> {/* Even thinner bar */}
                    <p className="text-xs text-muted-foreground text-center">{progress > 0 ? `${progress}%` : ''}</p>
                </div>
             )}

             {/* Preview Original Button */}
             {filteredPreviewUrl && previewUrl && (
                 <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-8" // Smaller text and height
                    onMouseDown={handlePreviewOriginalPress} // Use onMouseDown for press
                    onMouseUp={handlePreviewOriginalRelease} // Use onMouseUp for release
                    onTouchStart={handlePreviewOriginalPress} // Add touch start
                    onTouchEnd={handlePreviewOriginalRelease} // Add touch end
                 >
                    {showOriginalPreview ? <EyeOff className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />} {/* Smaller icon */}
                    {showOriginalPreview ? 'Release' : 'Hold Original'}
                 </Button>
             )}


            {/* Export Button */}
            {filteredUrl && (
                 <Button onClick={handleExport} variant="default" size="sm" className="w-full text-xs h-8"> {/* Smaller text and height */}
                    <Download className="mr-1 h-3 w-3" /> Export {/* Smaller icon */}
                 </Button>
            )}
             {!filteredUrl && previewUrl && !isLoading && ( // Show if preview exists, not filtered yet, and not loading
                 <p className="text-xs text-muted-foreground text-center pt-1">Export enabled soon.</p> // Reduced padding
             )}
             {!previewUrl && (
                 <p className="text-xs text-muted-foreground text-center pt-1">Import image to start.</p> // Reduced padding
             )}

          </div>

          {/* Right Column: Image Preview (takes 3 parts) */}
          <div className="md:col-span-3 space-y-2 md:space-y-3"> {/* Reduced spacing */}
             <Label className="text-sm font-medium block text-center text-foreground/80">Preview</Label> {/* Softer label color */}
             <div
                // Maintained aspect ratio for a good preview shape
                className="aspect-w-16 aspect-h-10 w-full bg-muted/50 rounded-lg overflow-hidden border border-border/50 flex items-center justify-center relative shadow-inner cursor-pointer group" // Softer background and border
                onClick={handleImageClick} // Add click handler to the container
              >
                {displayUrl ? (
                  <>
                    <Image
                      src={displayUrl} // Use the determined display URL
                      alt={displayAlt} // Use the determined alt text
                      fill // Changed layout to fill
                      sizes="(max-width: 768px) 100vw, 75vw" // Adjusted sizes prop
                      style={{ objectFit: 'contain' }} // Use style for objectFit with fill
                      data-ai-hint={showOriginalPreview ? "original preview" : (filteredUrl ? "filtered preview" : "original preview")}
                      // Removed animation class to prevent blinking on state change
                      unoptimized // Use unoptimized for data URLs and frequent changes
                      priority={!filteredUrl} // Prioritize loading the initial original preview
                      // Removed explicit transition class to rely on parent state
                    />
                    {/* Zoom icon overlay - appears on hover over the preview container */}
                    {(filteredUrl || originalDataUrl) && ( // Show zoom if there's something to zoom into
                         <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg"> {/* Added rounded-lg */}
                             <ZoomIn className="h-10 w-10 text-white/90" /> {/* Slightly transparent icon */}
                         </div>
                    )}
                  </>
                ) : (
                  // Placeholder when no image is loaded
                  <div className="text-muted-foreground p-8 text-center flex flex-col items-center justify-center">
                    <Upload className="mx-auto h-10 w-10 md:h-12 md:w-12 mb-2 md:mb-3 opacity-50" /> {/* Smaller margin */}
                    <span className="text-sm">Import a photo to start</span>
                  </div>
                )}
                 {/* Loading overlay */}
                 {isLoading && (
                  <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center backdrop-blur-sm space-y-1 z-10 rounded-lg"> {/* Slightly more transparent, added rounded-lg */}
                      <Loader2 className="h-6 w-6 md:h-8 md:w-8 animate-spin text-primary" /> {/* Slightly smaller spinner */}
                      <p className="text-xs md:text-sm text-muted-foreground">Processing...</p>
                       <Progress value={progress} className="w-2/3 max-w-xs h-1 md:h-1.5" /> {/* Thinner progress */}
                  </div>
                )}
             </div>
          </div>

        </CardContent>
         <CardFooter className="border-t border-border/50 bg-card p-2 md:p-3 text-center text-xs text-muted-foreground"> {/* Reduced padding, softer border */}
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
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10 rounded-lg"> {/* Added rounded-lg */}
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    </div>
                 )}
                 {/* Error message */}
                 {modalImageError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-destructive/20 text-destructive-foreground z-10 p-4 rounded-lg"> {/* Added rounded-lg */}
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
                       "rounded-lg transition-opacity duration-300 shadow-2xl", // Optional styling, stronger shadow for modal
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
