/**
 * Utility for extracting JSON from LLM responses
 */

/**
 * Extract JSON object from a string that may contain additional text
 */
export function extractJSON<T>(content: string): T | null {
  try {
    // Try to find JSON object in the content
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    
    // If no match, try parsing the whole content
    return JSON.parse(content) as T;
  } catch (error) {
    console.error('Failed to extract JSON from content:', error);
    console.error('Content preview:', content.substring(0, 200) + '...');
    return null;
  }
}