import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type SuggestionState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data?: Array<{ ingredient: string; alternatives: string[] }>;
  error?: string;
};

type DatabaseRecipe = {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  ingredients: string[];
  category?: string;
  area?: string;
  tags?: string[];
  sourceUrl?: string | null;
  readyInMinutes?: number | null;
  servings?: number | null;
  provider: 'spoonacular' | 'mealdb';
  matchResult?: any;
  matchScore?: number;
};

interface RecipeDatabaseState {
  scrollPosition: number;
  suggestions: Record<string, SuggestionState>;
  recipes: DatabaseRecipe[];
  lastUpdated: number;
}

interface RecipeDatabaseContextValue {
  state: RecipeDatabaseState;
  updateScrollPosition: (position: number) => void;
  updateSuggestions: (suggestions: Record<string, SuggestionState>) => void;
  updateRecipes: (recipes: DatabaseRecipe[]) => void;
  clearState: () => void;
}

const RecipeDatabaseContext = createContext<RecipeDatabaseContextValue | undefined>(undefined);

const initialState: RecipeDatabaseState = {
  scrollPosition: 0,
  suggestions: {},
  recipes: [],
  lastUpdated: Date.now(),
};

export function RecipeDatabaseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RecipeDatabaseState>(initialState);

  const updateScrollPosition = useCallback((position: number) => {
    setState(prev => ({
      ...prev,
      scrollPosition: position,
      lastUpdated: Date.now(),
    }));
  }, []);

  const updateSuggestions = useCallback((suggestions: Record<string, SuggestionState>) => {
    setState(prev => ({
      ...prev,
      suggestions,
      lastUpdated: Date.now(),
    }));
  }, []);

  const updateRecipes = useCallback((recipes: DatabaseRecipe[]) => {
    setState(prev => ({
      ...prev,
      recipes,
      lastUpdated: Date.now(),
    }));
  }, []);

  const clearState = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <RecipeDatabaseContext.Provider
      value={{
        state,
        updateScrollPosition,
        updateSuggestions,
        updateRecipes,
        clearState,
      }}
    >
      {children}
    </RecipeDatabaseContext.Provider>
  );
}

export function useRecipeDatabaseState() {
  const context = useContext(RecipeDatabaseContext);
  if (context === undefined) {
    throw new Error('useRecipeDatabaseState must be used within a RecipeDatabaseProvider');
  }
  return context;
}
