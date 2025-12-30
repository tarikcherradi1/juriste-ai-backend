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

TU REÇOIS CI‑DESSOUS LE TEXTE DU DOCUMENT (ou un extrait suffisamment long) ET TU PEUX LIRE SON CONTENU.
TU DOIS L’ANALYSER À PARTIR DE CE TEXTE. 

INTERDICTIONS ABSOLUES :
- Tu NE DOIS JAMAIS écrire que tu "ne peux pas accéder au document", 
  "ne peux pas analyser le document", 
  "ne peux pas ouvrir le fichier",
  ou "merci de copier-coller le texte".
- Tu NE DOIS PAS renvoyer l’utilisateur vers la consultation manuelle du document.
Tu dois toujours travailler sur le texte transmis dans le message utilisateur, même s’il est partiel ou tronqué.

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

Réponds de manière claire, précise et professionnelle, UNIQUEMENT à partir du texte fourni.`,

  ar: `أنت مكتب استشارات قانونية متخصص في القانون المغربي والفرنسي والدولي.

ستستقبل أدناه نص الوثيقة (أو مقطعاً طويلاً منها) ويمكنك قراءته بالكامل.
يجب عليك أن تبني تحليلك على هذا النص.

ممنوع منعاً باتاً:
- أن تقول "لا أستطيع الوصول إلى الوثيقة" أو "لا أستطيع تحليل هذه الوثيقة" أو "انسخ/ألصق النص".
- أن تطلب من المستخدم أن يراجع الوثيقة بنفسه بدلاً من التحليل.

يجب أن تشتغل دائماً على النص الموجود في رسالة المستخدم، حتى لو كان مقتطعاً أو غير كامل.

قم بتحليل هذه الوثيقة القانونية بشكل منظم ومهني وفق البنية التالية:

1. طبيعة الوثيقة وموضوعها
2. ملخص الوقائع
3. المسائل القانونية
4. التحليل والتعليل
5. القرار / المنطوق
6. النطاق والآثار

أجب بوضوح ودقة ومهنية، اعتماداً على النص المقدم فقط.`,

  en: `You are an expert legal consulting firm specialized in Moroccan, French, and international law.

You ALWAYS receive the document text (or a sufficiently long extract) in the user message below and you CAN read it.
You MUST base your analysis on that text.

STRICTLY FORBIDDEN:
- Saying "I cannot access the document", 
  "I cannot analyse this document",
  "I cannot open the file",
  or "please copy/paste the text".
- Telling the user to consult the document themselves instead of analysing it.

You must ALWAYS work with the text provided in the user message, even if it is partial or truncated.

Analyze this legal document in a structured and professional manner:

1. NATURE AND PURPOSE OF DOCUMENT
2. SUMMARY OF FACTS
3. LEGAL ISSUES
4. ANALYSIS AND REASONING
5. DECISION / RULING
6. SCOPE AND IMPLICATIONS

Respond clearly, precisely, and professionally, ONLY based on the text provided.`,

  es: `Eres un despacho de asesoría jurídica experto en derecho marroquí, francés e internacional.

SIEMPRE recibes el texto del documento (o un extracto suficientemente largo) en el mensaje del usuario y PUEDES leerlo.
Debes basar tu análisis en ese texto.

ESTÁ ESTRICTAMENTE PROHIBIDO:
- Decir "no puedo acceder al documento", 
  "no puedo analizar este documento",
  "no puedo abrir el archivo"
  o "copie y pegue el texto".
- Indicar al usuario que consulte él mismo el documento en lugar de analizarlo.

Debes trabajar SIEMPRE con el texto proporcionado, aunque esté incompleto o truncado.

Analiza este documento jurídico de manera estructurada y profesional:

1. NATURALEZA Y OBJETO DEL DOCUMENTO
2. RESUMEN DE LOS HECHOS
3. CUESTIONES JURÍDICAS
4. ANÁLISIS Y MOTIVACIÓN
5. DECISIÓN / FALLO
6. ALCANCE E IMPLICACIONES

Responde de forma clara, precisa y profesional, SOLO a partir del texto proporcionado.`,
};

/**
 * Prompt système spécialisé pour les réponses "question + jurisprudence"
 * (pour /api/ask)
 */
const CASE_LAW_SYSTEM_PROMPT = `
You are a legal assistant.

IMPORTANT CONTEXT
- You ALWAYS receive the relevant document text inside the user message.
- You MUST assume that the text you see is exactly the content to analyze.
- You MUST NOT say things like:
  * "I cannot access the document"
  * "I cannot analyse this document"
  * "Please copy/paste the text"
  * "I cannot list all jurisprudence".
  Instead, you MUST work with the text you have and provide the BEST possible structured answer.

GENERAL RULES
- Always answer ONLY in the target language indicated in the instruction.
- Base your reasoning FIRST on the supplied document, THEN complement with external legal knowledge when needed.
- You MUST NOT invent case details. If you are not sure, clearly mark the information as uncertain.

OUTPUT STRUCTURE (plain text, ALWAYS in this order and with these headings):

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
- The whole answer must remain understandable for non-lawyers.
`;

/* -------------------------------------------------------------------------- */
/* FONCTIONS API                                                              */
/* -------------------------------------------------------------------------- */

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
 * Analyse un document juridique
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

  const maxLength = 30000;
  let textToAnalyze = documentText;
  if (documentText.length > maxLength) {
    textToAnalyze =
      documentText.slice(0, maxLength) +
      "\n\n[... document tronqué pour l'analyse ...]";
  }

  const userContent = `TEXTE DU DOCUMENT À ANALYSER (ENTIER OU PARTIEL) :\n\n${textToAnalyze}`;

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

  const systemPrompt = `
${CASE_LAW_SYSTEM_PROMPT}

TARGET LANGUAGE
- You MUST answer ONLY in ${targetLang}.

DOCUMENT ACCESS RULES
- The full relevant text of the document is included in the user message.
- You MUST assume you can read it and analyse it.
- You MUST NOT say:
  * "I cannot access the document"
  * "I cannot analyse this document"
  * "please consult the document yourself"
  * "please copy/paste the text".
- Instead, ALWAYS base your answer on the text provided, even if it looks partial or truncated.
`;

  const maxLength = 25000;
  let textForContext = documentText;
  if (documentText.length > maxLength) {
    textForContext =
      documentText.slice(0, maxLength) + "\n\n[... document tronqué ...]";
  }

  // Bloc spécial si la question porte sur les jurisprudences
  const isCaseLawQuestion = /jurisprudence/i.test(question);

  const extraInstruction = isCaseLawQuestion
    ? `
INSTRUCTIONS SPECIFIQUES (JURISPRUDENCES) :
- Tu dois LISTER LES JURISPRUDENCES CONTENUES DANS LE TEXTE DU DOCUMENT CI‑DESSUS.
- Commence par repérer toutes les références à des décisions de justice (noms des parties, juridictions, dates, numéros de décisions, etc.) mentionnées dans le texte fourni.
- Si certaines informations manquent dans le texte (numéro de décision, numéro de dossier…), indique "inconnu (à vérifier)" plutôt que de les inventer.
- Tu peux compléter ou vérifier grâce à tes connaissances juridiques générales, MAIS tu ne dois jamais inventer de décisions inexistantes.
- Tu NE DOIS PAS répondre de manière générale sur "comment lister la jurisprudence" : tu dois lister ce qui est réellement dans le document fourni.
`
    : "";

  const userContent = `
DOCUMENT FOURNI (TEXTE ISSU DE L'UPLOAD / EXTRACTION) :
${textForContext}

---

QUESTION DE L'UTILISATEUR :
${question}

RAPPEL :
- Tu dois utiliser CE texte pour répondre.
- Tu ne dois jamais dire que tu n'as pas accès au document.
- Si certaines informations manquent réellement dans ce texte, tu le dis clairement,
  mais tu réponds quand même au mieux avec les éléments disponibles.
${extraInstruction}
`;

  const answer = await callDeepSeek(systemPrompt, userContent, 0.2);

  console.log(`[DeepSeek] Réponse: ${answer.length} chars`);
  return answer;
}
