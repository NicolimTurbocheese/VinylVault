import { defineSecret } from "firebase-functions/params";

// Backed by Secret Manager (Firebase Functions v2). Set with:
//   firebase functions:secrets:set GEMINI_API_KEY
// When listed in a function's `secrets` option, Firebase injects the value into
// process.env.GEMINI_API_KEY at runtime — matching what getGeminiClient() reads.
export const geminiApiKeySecret = defineSecret("GEMINI_API_KEY");
