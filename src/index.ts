import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import { extractPdfText, extractPdfWithOcr } from "./pdfService";
import { analyzeDocument, askQuestion } from "./deepseekService";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Multer pour upload fichiers (stockage en mémoire)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
});

/* -------------------------------------------------------------------------- */
/* ROUTES                                                                     */
/* -------------------------------------------------------------------------- */

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * POST /api/extract
 * Extrait le texte d'un PDF (natif + OCR si nécessaire)
 */
app.post("/api/extract", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Aucun fichier fourni" });
    }

    const highPrecision = req.body.highPrecision === "true";
    const forceOcr = req.body.forceOcr === "true";

    console.log(
      `[API] Extraction PDF: ${req.file.originalname} (${req.file.size} bytes)`
    );
    console.log(
      `[API] Options: highPrecision=${highPrecision}, forceOcr=${forceOcr}`
    );

    const startTime = Date.now();

    let result;
    if (forceOcr) {
      result = await extractPdfWithOcr(req.file.buffer, highPrecision);
    } else {
      result = await extractPdfText(req.file.buffer, highPrecision);
    }

    const duration = Date.now() - startTime;
    console.log(
      `[API] Extraction terminée en ${duration}ms: ${result.fullText.length} chars, ${result.chunks.length} chunks`
    );

    res.json({
      success: true,
      fullText: result.fullText,
      chunks: result.chunks,
      pagesProcessed: result.pagesProcessed,
      ocrUsed: result.ocrUsed,
      processingTime: duration,
    });
  } catch (error: any) {
    console.error("[API] Erreur extraction:", error);
    res
      .status(500)
      .json({ error: error.message || "Erreur extraction PDF" });
  }
});

/**
 * POST /api/analyze
 * Extrait et analyse un document PDF
 */
app.post("/api/analyze", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Aucun fichier fourni" });
    }

    const language = req.body.language || "fr";
    const highPrecision = req.body.highPrecision === "true";

    console.log(`[API] Analyse document: ${req.file.originalname}`);

    // 1. Extraction du texte
    const extraction = await extractPdfText(req.file.buffer, highPrecision);

    if (!extraction.fullText || extraction.fullText.length < 50) {
      return res
        .status(400)
        .json({ error: "Aucun texte détecté dans le PDF" });
    }

    // 2. Analyse par DeepSeek
    const analysis = await analyzeDocument(extraction.fullText, language);

    res.json({
      success: true,
      fullText: extraction.fullText,
      chunks: extraction.chunks,
      analysis: analysis,
      ocrUsed: extraction.ocrUsed,
    });
  } catch (error: any) {
    console.error("[API] Erreur analyse:", error);
    res
      .status(500)
      .json({ error: error.message || "Erreur analyse document" });
  }
});

/**
 * POST /api/ask
 * Pose une question sur un texte/document
 */
app.post("/api/ask", async (req, res) => {
  try {
    const { text, question, language } = req.body as {
      text?: string;
      question?: string;
      language?: string;
    };

    // Validation des paramètres
    if (!text || typeof text !== "string" || text.trim().length < 20) {
      return res
        .status(400)
        .json({ error: "Texte du document manquant ou trop court" });
    }

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return res
        .status(400)
        .json({ error: "Question requise" });
    }

    const lang = (language && typeof language === "string" ? language : "fr") as
      | "fr"
      | "ar"
      | "en"
      | "es";

    console.log(
      `[API] /api/ask - langue=${lang}, question="${question.slice(
        0,
        80
      )}...", textLength=${text.length}`
    );

    // Appel au service DeepSeek (avec prompts renforcés)
    const answer = await askQuestion(text, question, lang);

    res.json({
      success: true,
      answer,
    });
  } catch (error: any) {
    console.error("[API] Erreur question:", error);
    res
      .status(500)
      .json({ error: error.message || "Erreur lors de la réponse" });
  }
});

/**
 * POST /api/chat
 * Proxy simple vers DeepSeek (pour compatibilité frontend existant)
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages requis" });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Clé API non configurée" });
    }

    const response = await fetch(
      "https://api.deepseek.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: messages,
          temperature: 0.3,
          max_tokens: 4000,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error("[API] Erreur chat:", error);
    res.status(500).json({ error: error.message || "Erreur API" });
  }
});

/* -------------------------------------------------------------------------- */
/* DÉMARRAGE                                                                  */
/* -------------------------------------------------------------------------- */

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 JuristeAI Backend démarré                             ║
║                                                            ║
║   Port: ${PORT}                                              ║
║   Endpoints:                                               ║
║     POST /api/extract  - Extraction PDF                    ║
║     POST /api/analyze  - Extraction + Analyse              ║
║     POST /api/ask      - Question sur document             ║
║     POST /api/chat     - Proxy DeepSeek                    ║
║     GET  /health       - Vérification serveur              ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
