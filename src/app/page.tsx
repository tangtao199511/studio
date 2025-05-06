// src/app/page.tsx
'use client';

import type {ChangeEvent} from 'react';
import {useState, useRef, useCallback, useEffect} from 'react';
import Image from 'next/image';
import {applyAnalogFilter} from '@/ai/flows/apply-analog-filter';
import {enhancePhotoDetails} from '@/ai/flows/enhance-photo-details';
import {Button} from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {Label} from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {Input} from '@/components/ui/input';
import {Loader2, Upload, Download, Wand2} from 'lucide-react';
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";


export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filteredUrl, setFilteredUrl] = useState<string | null>(null);
  const [analogStyle, setAnalogStyle] = useState<string>('Kodak Portra 400');
  const [sceneCategory, setSceneCategory] = useState<string>('landscape');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Clean up object URLs when component unmounts or file changes
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      if (filteredUrl) {
        URL.revokeObjectURL(filteredUrl);
      }
    };
  }, [previewUrl, filteredUrl]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Revoke previous URLs if they exist
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (filteredUrl) URL.revokeObjectURL(filteredUrl);

      const newPreviewUrl = URL.createObjectURL(file);
      setPreviewUrl(newPreviewUrl);
      setFilteredUrl(null); // Reset filtered image on new file upload
      setProgress(0); // Reset progress
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
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
      const photoDataUri = await readFileAsDataURL(selectedFile);
      setProgress(30); // Progress after reading file

      const result = await applyAnalogFilter({
        photoDataUri,
        analogStyle,
        sceneCategory,
      });
      setProgress(70); // Progress after AI processing

      setFilteredUrl(result.filteredPhotoDataUri);
      toast({
        title: "Filter Applied",
        description: result.enhancementDetails,
      });
      setProgress(100); // Final progress
    } catch (error) {
      console.error('Error applying filter:', error);
      toast({
        title: "Error",
        description: "Failed to apply filter. Please try again.",
        variant: "destructive",
      });
       setProgress(0); // Reset progress on error
    } finally {
      setIsLoading(false);
      // Optionally reset progress after a short delay
      setTimeout(() => setProgress(0), 1000);
    }
  }, [selectedFile, analogStyle, sceneCategory, toast]);


 const handleEnhanceDetails = useCallback(async () => {
    const targetUrl = filteredUrl || previewUrl;
    if (!targetUrl) {
      toast({
        title: "Error",
        description: "Please import or filter a photo first.",
        variant: "destructive",
      });
      return;
    }

    setIsEnhancing(true);
    setProgress(10);

    try {
        // If targetUrl is an object URL, fetch the blob first
        let photoDataUri = targetUrl;
        if (targetUrl.startsWith('blob:')) {
            const response = await fetch(targetUrl);
            const blob = await response.blob();
            photoDataUri = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }
        setProgress(30);


      const result = await enhancePhotoDetails({
        photoDataUri,
        style: analogStyle,
        scene: sceneCategory,
      });
      setProgress(70);

      // Revoke previous filtered URL if it exists and it's an object URL
      if (filteredUrl && filteredUrl.startsWith('blob:')) {
        URL.revokeObjectURL(filteredUrl);
      }
      
      setFilteredUrl(result.enhancedPhotoDataUri);
      toast({
        title: "Details Enhanced",
        description: "Photo details like sharpness and clarity have been improved.",
      });
      setProgress(100);
    } catch (error) {
      console.error('Error enhancing details:', error);
       toast({
        title: "Error",
        description: "Failed to enhance photo details. Please try again.",
        variant: "destructive",
      });
       setProgress(0);
    } finally {
      setIsEnhancing(false);
       // Optionally reset progress after a short delay
      setTimeout(() => setProgress(0), 1000);
    }
  }, [filteredUrl, previewUrl, analogStyle, sceneCategory, toast]);


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
    link.download = `AnalogLens_${analogStyle.replace(/\s+/g, '_')}_${sceneCategory}_${Date.now()}.png`; // Suggest a filename
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

     toast({
        title: "Exported",
        description: "Edited photo saved successfully.",
      });
  };

  const analogStyles = [
    'Kodak Portra 400',
    'Fujifilm Velvia 50',
    'Ilford HP5 Plus 400',
    'CineStill 800T',
    'Agfa Vista 200',
    'Lomography Color Negative 400',
    'Classic Teal & Orange LUT',
    'Vintage Sepia Tone',
    'Cool Cinematic Look',
    'Warm Golden Hour LUT'
  ];

  const sceneCategories = ['landscape', 'portrait', 'flowers', 'waterland', 'street', 'architecture', 'food'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary flex flex-col items-center justify-center p-4 md:p-8">
      <Card className="w-full max-w-4xl shadow-xl overflow-hidden">
        <CardHeader className="bg-card border-b p-4 md:p-6">
          <CardTitle className="text-2xl md:text-3xl font-bold tracking-tight text-center text-primary">
            AnalogLens 📸
          </CardTitle>
          <CardDescription className="text-center text-muted-foreground mt-1">
            Apply analog film styles and enhance your photos with AI.
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
              <Label htmlFor="scene-category" className="text-sm font-medium">3. Select Scene Category</Label>
              <Select value={sceneCategory} onValueChange={setSceneCategory}>
                <SelectTrigger id="scene-category" className="w-full">
                  <SelectValue placeholder="Choose a scene" />
                </SelectTrigger>
                <SelectContent>
                   {sceneCategories.map(scene => (
                     <SelectItem key={scene} value={scene}>{scene}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Apply Filter Button */}
             <div className="space-y-2">
                <Label className="text-sm font-medium">4. Apply & Enhance</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                        onClick={handleApplyFilter}
                        disabled={!selectedFile || isLoading || isEnhancing}
                        className="w-full sm:flex-1 bg-primary hover:bg-primary/90"
                    >
                        {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                         <Wand2 className="mr-2 h-4 w-4" />
                        )}
                        {isLoading ? 'Applying...' : 'Apply Filter'}
                    </Button>
                    <Button
                        onClick={handleEnhanceDetails}
                        disabled={(!previewUrl && !filteredUrl) || isLoading || isEnhancing}
                        variant="secondary"
                        className="w-full sm:flex-1"
                    >
                        {isEnhancing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="m10 14 2 2 4-4"></path><path d="M12 20v-4"></path></svg>
                        )}
                        {isEnhancing ? 'Enhancing...' : 'Enhance Details'}
                    </Button>
                </div>
            </div>

            {/* Progress Bar */}
             {(isLoading || isEnhancing) && (
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
                {filteredUrl ? (
                  <Image
                    src={filteredUrl}
                    alt="Filtered Photo"
                    layout="fill"
                    objectFit="contain"
                    data-ai-hint="filtered image"
                    className="animate-fade-in"
                  />
                ) : previewUrl ? (
                  <Image
                    src={previewUrl}
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
                 {(isLoading || isEnhancing) && (
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
          </div>

        </CardContent>
         <CardFooter className="border-t bg-card p-4 text-center text-xs text-muted-foreground">
           Powered by AI | AnalogLens &copy; {new Date().getFullYear()}
         </CardFooter>
      </Card>
      <Toaster />
    </div>
  );
}

// Add fade-in animation to globals.css if it doesn't exist
// @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
// .animate-fade-in { animation: fadeIn 0.5s ease-in-out; }