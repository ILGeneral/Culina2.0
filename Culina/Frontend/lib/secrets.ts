// lib/secrets.ts

// 🧠 Groq credentials
export const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? "";
export const GROQ_MODEL = process.env.EXPO_PUBLIC_GROQ_MODEL ?? "";

// 🍳 Clarifai Personal Access Token (PAT)
export const CLARIFAI_PAT = process.env.EXPO_PUBLIC_CLARIFAI_PAT ?? "";

// 🔎 Clarifai model identifiers
export const CLARIFAI_USER_ID = process.env.EXPO_PUBLIC_CLARIFAI_USER_ID ?? "";
export const CLARIFAI_APP_ID = process.env.EXPO_PUBLIC_CLARIFAI_APP_ID ?? "";
export const CLARIFAI_MODEL_ID = process.env.EXPO_PUBLIC_CLARIFAI_MODEL_ID ?? "";
export const CLARIFAI_MODEL_VERSION_ID = process.env.EXPO_PUBLIC_CLARIFAI_MODEL_VERSION_ID ?? "";
export const SPOONACULAR_API_KEY = process.env.EXPO_PUBLIC_SPOONACULAR_API_KEY ?? "";
