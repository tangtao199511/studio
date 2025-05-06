// enhance-photo-details.ts
'use server';

/**
 * @fileOverview Enhances the details of a photo by improving sharpness and clarity.
 *
 * - enhancePhotoDetails - A function that handles the photo detail enhancement process.
 * - EnhancePhotoDetailsInput - The input type for the enhancePhotoDetails function.
 * - EnhancePhotoDetailsOutput - The return type for the enhancePhotoDetails function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EnhancePhotoDetailsInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo to be enhanced, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  style: z.string().describe('The desired analog style for the photo.'),
  scene: z.string().describe('The scene category of the photo (e.g., landscape, portrait, flowers, waterland).'),
});
export type EnhancePhotoDetailsInput = z.infer<typeof EnhancePhotoDetailsInputSchema>;

const EnhancePhotoDetailsOutputSchema = z.object({
  enhancedPhotoDataUri: z
    .string()
    .describe('The enhanced photo as a data URI.'),
});
export type EnhancePhotoDetailsOutput = z.infer<typeof EnhancePhotoDetailsOutputSchema>;

export async function enhancePhotoDetails(input: EnhancePhotoDetailsInput): Promise<EnhancePhotoDetailsOutput> {
  return enhancePhotoDetailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'enhancePhotoDetailsPrompt',
  input: {schema: EnhancePhotoDetailsInputSchema},
  output: {schema: EnhancePhotoDetailsOutputSchema},
  prompt: `You are a professional photo editor specializing in enhancing photo details while applying analog film styles.

  Given the photo, style, and scene, enhance the photo details such as sharpness, clarity, and overall image quality.
  The enhanced photo should also incorporate the characteristics of the specified analog style and scene.

  Photo: {{media url=photoDataUri}}
  Style: {{{style}}}
  Scene: {{{scene}}}

  Return the enhanced photo as a data URI.
  `,
});

const enhancePhotoDetailsFlow = ai.defineFlow(
  {
    name: 'enhancePhotoDetailsFlow',
    inputSchema: EnhancePhotoDetailsInputSchema,
    outputSchema: EnhancePhotoDetailsOutputSchema,
  },
  async input => {
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp',
      prompt: [
        {media: {url: input.photoDataUri}},
        {text: `Enhance this photo with ${input.style} style for a ${input.scene} scene, improving sharpness and clarity.`},
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    return {enhancedPhotoDataUri: media.url!};
  }
);
