/* -------------------------------------------------------------------------- */
/* SERVICE DEEPSEEK - ANALYSE ET QUESTIONS                                    */
/* -------------------------------------------------------------------------- */

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

function getApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    throw new Error("DEEPSEEK_API_KEY non configurée");
  }
  return key;
}

/* -------------------------------------------------------------------------- */
/* PROMPTS JURIDIQUES                                                         */
/* -------------------------------------------------------------------------- */

const ANALYSIS_PROMPT = {
  fr: `Tu es un cabinet de conseils juridiques expert spécialisé dans le droit marocain, français et international.

Analyse ce document juridique de manière structurée et professionnelle.

STRUCTURE DE L'ANALYSE :

1. NATURE ET OBJET DU DOCUMENT
- Type de document (arrêt, jugement, contrat, loi, etc.)
- Juridiction ou autorité émettrice
- Date et références

2. RÉSUMÉ DES FAITS
- Contexte factuel
- Parties en présence
- Chronologie des événements clés

3. QUESTIONS JURIDIQUES
- Problèmes de droit soulevés
- Dispositions légales applicables
- Articles et textes de référence

4. ANALYSE ET MOTIVATION
- Raisonnement juridique
- Arguments des parties
- Position de la juridiction/autorité

5. DÉCISION / DISPOSITIF
- Solution retenue
- Mesures ordonnées
- Conséquences juridiques

6. PORTÉE ET IMPLICATIONS
- Précédent jurisprudentiel
- Impact pratique
- Recommandations

Réponds de manière claire, précise et professionnelle.`,

  ar: `أنت مكتب استشارات قانونية متخصص في القانون المغربي والفرنسي والدولي.

قم بتحليل هذه الوثيقة القانونية بشكل منظم ومهني.

هيكل التحليل:

1. طبيعة الوثيقة وموضوعها
2. ملخص الوقائع
3. المسائل القانونية
4. التحليل والتعليل
5. القرار / المنطوق
6. النطاق والآثار

أجب بوضوح ودقة ومهنية.`,

  en: `You are an expert legal consulting firm specialized in Moroccan, French, and international law.

Analyze this legal document in a structured and professional manner.

ANALYSIS STRUCTURE:

1. NATURE AND PURPOSE OF DOCUMENT
2. SUMMARY OF FACTS
3. LEGAL ISSUES
4. ANALYSIS AND REASONING
5. DECISION / RULING
6. SCOPE AND IMPLICATIONS

Respond clearly, precisely, and professionally.`,

  es: `Eres un despacho de asesoría jurídica experto especializado en derecho marroquí, francés e internacional.

Analiza este documento jurídico de manera estructurada y profesional.

ESTRUCTURA DEL ANÁLISIS:

1. NATURALEZA Y OBJETO DEL DOCUMENTO
2. RESUMEN DE LOS HECHOS
3. CUESTIONES JURÍDICAS
4. ANÁLISIS Y MOTIVACIÓN
5. DECISIÓN / FALLO
6. ALCANCE E IMPLICACIONES

Responde de manera clara, precisa y profesional.`,
};

/**
 * Prompt système spécialisé pour les réponses "question + jurisprudence"
 */
const CASE_LAW_SYSTEM_PROMPT = `
You are a legal assistant.

GENERAL RULES
- Always answer ONLY in the target language indicated in the instruction.
- Base your reasoning FIRST on the supplied document, THEN complement with external legal sources when needed.
- You MUST search conceptually in specialized and official legal sources (government and court websites, official law databases) when information is missing, but you MUST NOT invent case details.
- If you are NOT sure of any information (country, date, court, decision number, case number, legal rule), you MUST explicitly say that it is incomplete or uncertain.

OUTPUT STRUCTURE (plain text, but ALWAYS in this order and with these headings):

1. Règle générale (max 100 caractères)
   - One concise sentence summarizing the general legal rule or the core idea.

2. Base légale (max 100 caractères)
   - Main statutes / articles / key legal terms that apply.

3. Jurisprudence
   For each relevant case, present it as a block using EXACTLY this sub-structure:

   - Pays :
   - Date :
   - Tribunal :
   - Num décision :
   - Num dossier :
   - Règle de droit appliquée :
   - Résumé (compréhensible pour un non-juriste, 3 à 5 phrases max) :

CASE SELECTION RULES
- Select only cases that are RELEVANT to the user's question AND to the content of the provided document.
- Always TRY to include at least:
  * 2 cases from Morocco
  * 1 case from France
  * 1 case from Spain
  * 1 case from Egypt
- If you cannot find enough reliable information for one country, you MUST:
  * state clearly that information is incomplete for that country,
  * NEVER fabricate fake dates, courts, or numbers.

VALIDATION RULES
- If a field is unknown or uncertain, write "inconnu (à vérifier)" instead of inventing.
- Do NOT say that you "cannot list all jurisprudence"; instead, give the BEST FEW cases you can find according to the constraints above.
- The whole answer must remain understandable for non-lawyers.
`;

/* -------------------------------------------------------------------------- */
/* FONCTIONS API                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Appelle l'API DeepSeek
 */
async function callDeepSeek(
  systemPrompt: string,
  userContent: string,
  temperature: number = 0.3
): Promise<string> {
  const apiKey = getApiKey();

  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${error}`);
  }

  const data: any = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Analyse un document juridique (structure d'analyse générale)
 */
export async function analyzeDocument(
  documentText: string,
  language: string = "fr"
): Promise<string> {
  console.log(
    `[DeepSeek] Analyse document (${documentText.length} chars, langue: ${language})`
  );

  const systemPrompt =
    ANALYSIS_PROMPT[language as keyof typeof ANALYSIS_PROMPT] ||
    ANALYSIS_PROMPT.fr;

  // Limiter le texte si trop long
  const maxLength = 30000;
  let textToAnalyze = documentText;
  if (documentText.length > maxLength) {
    textToAnalyze =
      documentText.slice(0, maxLength) +
      "\n\n[... document tronqué pour l'analyse ...]";
  }

  const userContent = `Voici le document à analyser :\n\n${textToAnalyze}`;

  const analysis = await callDeepSeek(systemPrompt, userContent);

  console.log(`[DeepSeek] Analyse terminée: ${analysis.length} chars`);
  return analysis;
}

/**
 * Répond à une question sur un document + jurisprudence structurée
 */
export async function askQuestion(
  documentText: string,
  question: string,
  language: string = "fr"
): Promise<string> {
  console.log(
    `[DeepSeek] Question: "${question.slice(0, 50)}..." (langue: ${language})`
  );

  const langNames: Record<string, string> = {
    fr: "French",
    ar: "Arabic",
    en: "English",
    es: "Spanish",
  };

  const targetLang = langNames[language] || "French";

  // Prompt système spécialisé pour Q/R + jurisprudence
  const systemPrompt = `
${CASE_LAW_SYSTEM_PROMPT}

TARGET LANGUAGE
- You MUST answer ONLY in ${targetLang}.
`;

  // Limiter le texte si trop long
  const maxLength = 25000;
  let textForContext = documentText;
  if (documentText.length > maxLength) {
    textForContext =
      documentText.slice(0, maxLength) + "\n\n[... document tronqué ...]";
  }

  const userContent = `
Document (contexte) :
${textForContext}

---

Question de l'utilisateur :
${question}

Tâche :
1. Identifier la règle générale de droit applicable (max 100 caractères).
2. Identifier la base légale (articles de loi, codes, mots-clés) en max 100 caractères.
3. Proposer des jurisprudences pertinentes (Maroc, France, Espagne, Égypte) en respectant STRICTEMENT la structure demandée.
4. Rester compréhensible pour des non-juristes.
`;

  const answer = await callDeepSeek(systemPrompt, userContent, 0.2);

  console.log(`[DeepSeek] Réponse: ${answer.length} chars`);
  return answer;
}
