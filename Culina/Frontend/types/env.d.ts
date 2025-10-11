declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_CLARIFAI_PAT: string;
    EXPO_PUBLIC_CLARIFAI_USER_ID: string;
    EXPO_PUBLIC_CLARIFAI_APP_ID: string;
    EXPO_PUBLIC_CLARIFAI_MODEL_ID: string;
    EXPO_PUBLIC_CLARIFAI_MODEL_VERSION_ID: string;
    EXPO_PUBLIC_GROQ_API_KEY: string;
    EXPO_PUBLIC_GROQ_MODEL: string;
  }
}
