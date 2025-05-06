// Use server directive is required for Genkit flows.
'use server';

/**
 * @fileOverview Applies an analog filter to a photo based on user-selected style and scene category.
 *
 * - applyAnalogFilter - A function that applies the analog filter to the photo.
 * - ApplyAnalogFilterInput - The input type for the applyAnalogFilter function.
 * - ApplyAnalogFilterOutput - The return type for the applyAnalogFilter function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ApplyAnalogFilterInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo to be processed, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  analogStyle: z
    .string()
    .describe("The desired analog style (e.g., film type, LUT preset)."),
  sceneCategory: z
    .string()
    .describe("The scene category (landscape, portrait, flowers, waterland)."),
});
export type ApplyAnalogFilterInput = z.infer<typeof ApplyAnalogFilterInputSchema>;

const ApplyAnalogFilterOutputSchema = z.object({
  filteredPhotoDataUri: z
    .string()
    .describe(
      'The processed photo with the analog filter applied, as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' // keep the backslashes, need to escape the single quote for JSON.
    ),
  enhancementDetails: z
    .string()
    .describe('Details about the enhancements applied to the photo.'),
});
export type ApplyAnalogFilterOutput = z.infer<typeof ApplyAnalogFilterOutputSchema>;

export async function applyAnalogFilter(input: ApplyAnalogFilterInput): Promise<ApplyAnalogFilterOutput> {
  return applyAnalogFilterFlow(input);
}

const applyAnalogFilterPrompt = ai.definePrompt({
  name: 'applyAnalogFilterPrompt',
  input: {schema: ApplyAnalogFilterInputSchema},
  output: {schema: ApplyAnalogFilterOutputSchema},
  prompt: `You are an expert photo editor specializing in applying analog film styles and enhancing photos based on scene categories.

You will take a photo, apply a color filter to mimic the selected analog style, enhance the image based on the scene category, and return the processed photo as a data URI.

Input Photo: {{media url=photoDataUri}}
Analog Style: {{{analogStyle}}}
Scene Category: {{{sceneCategory}}}

Instructions:
1.  Apply a color filter to the input photo that mimics the specified analog style.
2.  Enhance the image based on the specified scene category (e.g., for landscape, emphasize details and colors; for portrait, focus on skin tones and smooth textures).
3.  Return the processed photo as a data URI.
4.  Provide details about the enhancements applied to the photo.

Output Format:
{
  "filteredPhotoDataUri": "data:<mimetype>;base64,<encoded_data>",
  "enhancementDetails": "Details about the enhancements applied to the photo."
}
`,
});

const applyAnalogFilterFlow = ai.defineFlow(
  {
    name: 'applyAnalogFilterFlow',
    inputSchema: ApplyAnalogFilterInputSchema,
    outputSchema: ApplyAnalogFilterOutputSchema,
  },
  async input => {
    const {output} = await applyAnalogFilterPrompt(input);
    return output!;
  }
);
