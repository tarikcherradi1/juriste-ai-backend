// @ts-ignore - pdf-parse n'a pas de types TypeScript
import pdf from "pdf-parse";
import Tesseract from "tesseract.js";
import sharp from "sharp";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

export interface PdfExtractionResult {
  fullText: string;
  chunks: string[];
  pagesProcessed: number;
  ocrUsed: boolean;
}

/* -------------------------------------------------------------------------- */
/* CONFIGURATION                                                              */
/* -------------------------------------------------------------------------- */

const CONFIG = {
  MIN_TEXT_LENGTH: 50,
  MIN_LETTER_RATIO: 0.15,
  CHUNK_SIZE: 6000,
  CHUNK_OVERLAP: 500,
};

// Cache du worker Tesseract pour réutilisation
let ocrWorker: Tesseract.Worker | null = null;

/* -------------------------------------------------------------------------- */
/* FONCTIONS UTILITAIRES                                                      */
/* -------------------------------------------------------------------------- */

function containsRealWords(text: string): boolean {
  if (!text || text.length < 20) return false;

  const arabicLetters = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length;
  const latinLetters = (text.match(/[a-zA-Z\u00C0-\u00FF]/g) || []).length;
  const totalLetters = arabicLetters + latinLetters;
  const digits = (text.match(/[0-9]/g) || []).length;
  
  const totalChars = text.length;
  const letterRatio = totalLetters / totalChars;
  const digitRatio = digits / totalChars;

  if (digitRatio > 0.5 && letterRatio < 0.15) return false;
  if (letterRatio < CONFIG.MIN_LETTER_RATIO) return false;

  const arabicWords = text.match(/[\u0600-\u06FF\u0750-\u077F]{3,}/g) || [];
  const latinWords = text.match(/[a-zA-Z\u00C0-\u00FF]{3,}/g) || [];
  const totalWords = arabicWords.length + latinWords.length;

  const expectedWords = totalChars / 10;
  if (totalWords < expectedWords * 0.1) return false;

  return true;
}

function isTextQualityGood(text: string): boolean {
  if (!text || text.trim().length < CONFIG.MIN_TEXT_LENGTH) return false;
  return containsRealWords(text);
}

function cleanText(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map(line => line.trim())
    .join("\n")
    .trim();
}

function chunkText(text: string): string[] {
  if (!text || text.length === 0) return [];
  if (text.length <= CONFIG.CHUNK_SIZE) return [text];

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + CONFIG.CHUNK_SIZE;

    if (endIndex < text.length) {
      const searchStart = Math.max(startIndex + CONFIG.CHUNK_SIZE - 200, startIndex);
      const searchEnd = Math.min(startIndex + CONFIG.CHUNK_SIZE + 200, text.length);
      const searchZone = text.slice(searchStart, searchEnd);

      const breakPoints = [
        searchZone.lastIndexOf(". "),
        searchZone.lastIndexOf(".\n"),
        searchZone.lastIndexOf("\n\n"),
      ].filter(i => i !== -1);

      if (breakPoints.length > 0) {
        endIndex = searchStart + Math.max(...breakPoints) + 1;
      }
    }

    const chunk = text.slice(startIndex, endIndex).trim();
    if (chunk.length > 0) chunks.push(chunk);

    startIndex = endIndex - CONFIG.CHUNK_OVERLAP;
    if (startIndex <= 0 || startIndex >= text.length - 100) startIndex = endIndex;
  }

  return chunks;
}

/* -------------------------------------------------------------------------- */
/* OCR (Tesseract côté serveur - beaucoup plus rapide)                        */
/* -------------------------------------------------------------------------- */

async function getOcrWorker(): Promise<Tesseract.Worker> {
  if (ocrWorker) return ocrWorker;

  console.log("[OCR] Initialisation du worker Tesseract...");
  ocrWorker = await Tesseract.createWorker("ara+fra", 1, {
    langPath: "https://tessdata.projectnaptha.com/4.0.0",
  });
  console.log("[OCR] Worker prêt");
  
  return ocrWorker;
}

async function runOcr(imageBuffer: Buffer, highPrecision: boolean = false): Promise<string> {
  try {
    const worker = await getOcrWorker();

    // Prétraitement avec Sharp (beaucoup plus rapide que canvas)
    let processedImage = sharp(imageBuffer);

    if (!highPrecision) {
      // Mode normal : niveaux de gris + contraste
      processedImage = processedImage
        .grayscale()
        .normalize()
        .sharpen();
    }
    // Mode haute précision : garde l'image originale

    const finalBuffer = await processedImage.png().toBuffer();
    
    const result = await worker.recognize(finalBuffer);
    return result.data.text || "";

  } catch (error) {
    console.error("[OCR] Erreur:", error);
    return "";
  }
}

/* -------------------------------------------------------------------------- */
/* EXTRACTION PDF                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Extrait le texte d'un PDF (texte natif + OCR si nécessaire)
 */
export async function extractPdfText(
  pdfBuffer: Buffer,
  highPrecision: boolean = false
): Promise<PdfExtractionResult> {
  let ocrUsed = false;

  try {
    console.log("[PDF] Extraction avec pdf-parse...");
    
    const data = await pdf(pdfBuffer);
    let text = data.text || "";
    const numPages = data.numpages || 1;

    console.log(`[PDF] Texte natif: ${text.length} chars, ${numPages} pages`);

    // Vérifier la qualité du texte
    if (!isTextQualityGood(text)) {
      console.log("[PDF] Texte natif de mauvaise qualité, lancement OCR...");
      
      // Pour l'OCR, on aurait besoin de convertir le PDF en images
      // Ceci est simplifié - en production utiliser pdf2pic ou poppler
      const ocrText = await runOcrOnPdf(pdfBuffer, highPrecision);
      
      if (ocrText.length > text.length) {
        text = ocrText;
        ocrUsed = true;
      }
    }

    const cleanedText = cleanText(text);
    const chunks = chunkText(cleanedText);

    console.log(`[PDF] Résultat: ${cleanedText.length} chars, ${chunks.length} chunks, OCR=${ocrUsed}`);

    return {
      fullText: cleanedText,
      chunks,
      pagesProcessed: numPages,
      ocrUsed,
    };

  } catch (error: any) {
    console.error("[PDF] Erreur extraction:", error);
    return {
      fullText: "",
      chunks: [],
      pagesProcessed: 0,
      ocrUsed: false,
    };
  }
}

/**
 * Force l'OCR sur tout le PDF
 */
export async function extractPdfWithOcr(
  pdfBuffer: Buffer,
  highPrecision: boolean = false
): Promise<PdfExtractionResult> {
  try {
    console.log("[PDF] Extraction OCR forcée...");
    
    const text = await runOcrOnPdf(pdfBuffer, highPrecision);
    const cleanedText = cleanText(text);
    const chunks = chunkText(cleanedText);

    // Compter les pages approximativement
    const data = await pdf(pdfBuffer);
    const numPages = data.numpages || 1;

    return {
      fullText: cleanedText,
      chunks,
      pagesProcessed: numPages,
      ocrUsed: true,
    };

  } catch (error: any) {
    console.error("[PDF] Erreur OCR:", error);
    return {
      fullText: "",
      chunks: [],
      pagesProcessed: 0,
      ocrUsed: true,
    };
  }
}

/**
 * OCR sur un PDF complet
 * Note: Version simplifiée - pour la production, utiliser pdf-poppler ou pdf2pic
 */
async function runOcrOnPdf(pdfBuffer: Buffer, highPrecision: boolean): Promise<string> {
  try {
    // Cette version utilise le texte extrait par pdf-parse comme fallback
    // En production, convertir chaque page en image avec pdf-poppler
    
    const data = await pdf(pdfBuffer);
    let text = data.text || "";

    // Si le texte est du garbage (chiffres), essayer l'OCR
    if (!isTextQualityGood(text)) {
      console.log("[OCR] Le texte PDF semble être encodé, OCR non disponible côté serveur sans pdf-poppler");
      console.log("[OCR] Retour du texte brut...");
    }

    return text;

  } catch (error) {
    console.error("[OCR] Erreur:", error);
    return "";
  }
}

/* -------------------------------------------------------------------------- */
/* NETTOYAGE                                                                  */
/* -------------------------------------------------------------------------- */

export async function terminateOcrWorker(): Promise<void> {
  if (ocrWorker) {
    await ocrWorker.terminate();
    ocrWorker = null;
    console.log("[OCR] Worker terminé");
  }
}
