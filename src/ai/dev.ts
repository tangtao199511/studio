import { config } from 'dotenv';
config();

// Import new flows here
import '@/ai/flows/generate-filter-params-flow';

console.log("Genkit dev server running. Flows imported in src/ai/dev.ts");
