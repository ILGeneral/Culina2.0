// Parses ingredient lines like "2 tomatoes", "100 g chicken breast", "1/2 cup rice"
export function parseIngredients(ingredientLines: string[]) {
    const results: { name: string; quantity: number; unit?: string }[] = [];
  
    const fractionToDecimal = (str: string): number => {
      if (str.includes("/")) {
        const [num, den] = str.split("/").map(Number);
        return den ? num / den : 0;
      }
      return parseFloat(str);
    };
  
    ingredientLines.forEach((line) => {
      const lower = line.toLowerCase().trim();
  
      // Match patterns like "2 cups rice" or "100g chicken"
      const match = lower.match(
        /^(\d+(?:[.,]\d+)?|\d+\s*\d*\/\d*)\s*([a-zA-Z]*)?\s*(.*)$/
      );
  
      if (match) {
        const quantity = fractionToDecimal(match[1]);
        const unit = match[2] || undefined;
        const name = match[3]?.trim() || "";
        results.push({ name, quantity, unit });
      } else {
        // Fallback: no number, assume quantity = 1
        results.push({ name: lower, quantity: 1 });
      }
    });
  
    return results;
  }
  