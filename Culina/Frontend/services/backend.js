import { getAuth } from 'firebase/auth';

// Use your permanent Vercel URL
const API_BASE = 'https://culina-backend.vercel.app/api';

// Helper to get Firebase Auth token
const getAuthToken = async () => {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Not authenticated');
  }
  return await user.getIdToken();
};

// Generate Recipe
export const generateRecipe = async (model = 'llama3-70b-8192') => {
  try {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE}/generate-recipe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ model }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate recipe');
    }

    const data = await response.json();
    return data.recipe;
  } catch (error) {
    console.error('Generate recipe error:', error);
    throw error;
  }
};

// Confirm Recipe Use
export const confirmRecipeUse = async (recipeId) => {
  try {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE}/confirm-recipe-use`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ recipeId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to confirm recipe use');
    }

    return await response.json();
  } catch (error) {
    console.error('Confirm recipe error:', error);
    throw error;
  }
};

// Rate Recipe
export const rateRecipe = async (recipeId, score) => {
  try {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE}/rate-recipe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ recipeId, score }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to rate recipe');
    }

    return await response.json();
  } catch (error) {
    console.error('Rate recipe error:', error);
    throw error;
  }
};

// Submit Report
export const submitReport = async (type, description, appVersion, device) => {
  try {
    const token = await getAuthToken();
    const response = await fetch(`${API_BASE}/submit-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ type, description, appVersion, device }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to submit report');
    }

    return await response.json();
  } catch (error) {
    console.error('Submit report error:', error);
    throw error;
  }
};