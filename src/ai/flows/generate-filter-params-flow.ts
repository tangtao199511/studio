'use server';
/**
 * @fileOverview Generates photo filter parameters based on a user's mood description and an optional base style.
 *
 * - generateFilterParams - A function that calls the Genkit flow to get filter parameters.
 * - GenerateFilterParamsInput - The input type for the flow.
 * - FilterParamsOutput - The return type for the flow, containing filter parameters.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit'; 

// Define the schema for the filter parameters we expect from the LLM
const FilterParamsSchema = z.object({
  contrast: z.number().min(0).max(3).optional().describe('Contrast adjustment. Default is 1.0 (no change). Values between 0 (no contrast) and 3 (high contrast).'),
  saturate: z.number().min(0).max(3).optional().describe('Saturation adjustment. Default is 1.0 (no change). Values between 0 (grayscale) and 3 (super saturated).'),
  brightness: z.number().min(0).max(3).optional().describe('Brightness adjustment. Default is 1.0 (no change). Values between 0 (black) and 3 (very bright).'),
  sepia: z.number().min(0).max(1).optional().describe('Sepia effect strength. Default is 0 (no sepia). Values between 0 and 1 (full sepia).'),
  grayscale: z.number().min(0).max(1).optional().describe('Grayscale effect strength. Default is 0 (no grayscale). Values between 0 and 1 (full grayscale).'),
  hueRotate: z.number().min(-360).max(360).optional().describe('Hue rotation in degrees. Default is 0 (no change). Values from -360 to 360. This can create stylized color shifts, similar to applying a colored lens. For subtle effects, use small values (e.g., -15 to 15). For strong stylization, larger values can be used.'),
}).describe('A set of filter parameters to adjust a photo. If a parameter is not suitable for the mood or style, omit it or use its default value.');

export type FilterParamsOutput = z.infer<typeof FilterParamsSchema>;

const GenerateFilterParamsInputSchema = z.object({
  baseStyle: z.string().optional().describe('The name of the base analog film style selected by the user (e.g., "Kodak Portra 400", "Ilford HP5 Plus 400"). If "None" or omitted, generate parameters based primarily on mood.'),
  moodDescription: z.string().describe("The user's description of the mood, feeling, or context they want to convey in the photo (e.g., 'A melancholic rainy day', 'Joyful summer evening', 'Mysterious forest path'). This is the primary driver for filter generation."),
});
export type GenerateFilterParamsInput = z.infer<typeof GenerateFilterParamsInputSchema>;

export async function generateFilterParams(input: GenerateFilterParamsInput): Promise<FilterParamsOutput> {
  return generateFilterParamsFlow(input);
}

const filterParamsPrompt = ai.definePrompt({
  name: 'generateFilterParamsPrompt',
  input: { schema: GenerateFilterParamsInputSchema },
  output: { schema: FilterParamsSchema },
  prompt: `You are an expert photo editing assistant. Your primary task is to suggest adjustments to photo filter parameters (contrast, saturation, brightness, sepia, grayscale, hueRotate) to achieve a specific mood, based on the user's description. An optional base analog film style might be provided for context.

User's Desired Mood/Context (Primary Driver): {{{moodDescription}}}

{{#if baseStyle}}
Optional Base Analog Style: {{{baseStyle}}}
If a '{{{baseStyle}}}' is provided and is not "None", consider its characteristics. For example, if it's a vibrant style, you might enhance saturation further for a joyful mood, or slightly desaturate for a melancholic mood. If it's a B&W style, only grayscale and contrast are relevant in conjunction with the mood (hueRotate, saturate, sepia would typically be 0 or omitted).
{{else}}
No base style selected. Generate filter parameters solely based on the desired mood.
{{/if}}

Provide filter parameter values that would best reflect the '{{{moodDescription}}}'. If a '{{{baseStyle}}}' was provided (and not "None"), your suggestions should enhance or modify that style to fit the mood. If no base style was provided, or it was "None", generate parameters from scratch based on the mood.

Consider using 'hueRotate' for more stylized or artistic effects, especially if the mood suggests a specific color tint or a surreal atmosphere. For example, a 'dreamy underwater scene' might use a hueRotate towards blue/cyan, while a 'fiery sunset' might use a slight rotation towards red/orange.

Output JSON with the following parameters. If a parameter is not applicable or should remain at its default (no change), you can omit it or provide its default value (e.g., contrast: 1.0, saturate: 1.0, brightness: 1.0, sepia: 0, grayscale: 0, hueRotate: 0).

- contrast: (0.0 to 3.0, default 1.0)
- saturate: (0.0 to 3.0, default 1.0)
- brightness: (0.0 to 3.0, default 1.0)
- sepia: (0.0 to 1.0, default 0)
- grayscale: (0.0 to 1.0, default 0)
- hueRotate: (-360 to 360 degrees, default 0)

For example, for a 'Joyful summer evening' mood with 'Kodak Portra 400' base style, you might suggest:
{ "saturate": 1.2, "brightness": 1.05, "hueRotate": 5 }

For a 'Mysterious forest path' mood with 'Ilford HP5 Plus 400' (a B&W film), you might suggest:
{ "contrast": 1.3, "brightness": 0.9, "grayscale": 1.0 } // hueRotate would be 0 or omitted

For a 'Nostalgic and dreamy' mood with no base style (or base style "None"), you might suggest:
{ "sepia": 0.2, "brightness": 1.05, "contrast": 0.9, "saturate": 0.9, "hueRotate": -10 }

For a 'Surreal alien landscape' mood, you might suggest:
{ "saturate": 1.5, "contrast": 1.2, "hueRotate": 90 }

Only output the JSON object containing the filter parameters.
`,
});

const generateFilterParamsFlow = ai.defineFlow(
  {
    name: 'generateFilterParamsFlow',
    inputSchema: GenerateFilterParamsInputSchema,
    outputSchema: FilterParamsSchema,
  },
  async (input) => {
    // If baseStyle is "None", treat it as if it wasn't provided to the AI model for cleaner prompting.
    const flowInput = { ...input };
    if (flowInput.baseStyle === 'None') {
      flowInput.baseStyle = undefined;
    }

    const { output } = await filterParamsPrompt(flowInput);
    if (!output) {
      throw new Error('AI failed to generate filter parameters.');
    }
    // Ensure hueRotate is a number, even if LLM returns it as a string from prompt example
    if (typeof output.hueRotate === 'string') {
        output.hueRotate = parseFloat(output.hueRotate);
    }
    return output;
  }
);

