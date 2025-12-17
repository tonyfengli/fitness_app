import fs from 'fs/promises';
import path from 'path';

export default async function EquityStructure2Page() {
  // Read the HTML file
  const htmlPath = path.join(process.cwd(), 'src/app/(business)/equity-structure/equity-structure.html');
  const htmlContent = await fs.readFile(htmlPath, 'utf-8');
  
  // Extract just the body content and styles
  const styleMatch = htmlContent.match(/<style>([\s\S]*?)<\/style>/);
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  
  const styles = styleMatch ? styleMatch[1] : '';
  const bodyContent = bodyMatch ? bodyMatch[1] : '';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div dangerouslySetInnerHTML={{ __html: bodyContent }} />
    </>
  );
}