# 🏛️ JuristeAI Backend

Backend API pour l'application JuristeAI - Extraction OCR et analyse de documents juridiques.

## 🚀 Fonctionnalités

- **Extraction PDF** : Texte natif + OCR automatique si nécessaire
- **OCR multilingue** : Arabe + Français (Tesseract.js)
- **Analyse juridique** : Via DeepSeek API
- **Questions/Réponses** : Chat sur documents
- **Sécurité** : Clé API cachée côté serveur

## 📋 Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/health` | Vérification du serveur |
| POST | `/api/extract` | Extraction texte PDF |
| POST | `/api/analyze` | Extraction + Analyse complète |
| POST | `/api/ask` | Question sur un document |
| POST | `/api/chat` | Proxy DeepSeek (compatibilité) |

## 🛠️ Installation locale

```bash
# 1. Cloner le projet
cd juriste-ai-backend

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.example .env
# Éditer .env et ajouter votre DEEPSEEK_API_KEY

# 4. Démarrer en développement
npm run dev

# Le serveur démarre sur http://localhost:3001
```

## ☁️ Déploiement sur Render.com (GRATUIT)

### Option 1 : Déploiement automatique

1. Créez un compte sur [render.com](https://render.com)
2. Cliquez sur **New** → **Blueprint**
3. Connectez votre repo GitHub
4. Render détecte automatiquement `render.yaml`
5. Ajoutez la variable `DEEPSEEK_API_KEY` dans les settings

### Option 2 : Déploiement manuel

1. Créez un compte sur [render.com](https://render.com)
2. Cliquez sur **New** → **Web Service**
3. Connectez votre repo GitHub
4. Configuration :
   - **Build Command** : `npm install && npm run build`
   - **Start Command** : `npm start`
   - **Plan** : Free
5. Dans **Environment**, ajoutez :
   - `DEEPSEEK_API_KEY` = votre clé

### URL de votre API

Après déploiement : `https://juriste-ai-backend.onrender.com`

## 🔧 Utilisation avec le Frontend

Modifiez `App.tsx` pour utiliser le backend :

```typescript
// AVANT (clé exposée)
const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY;
const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
  headers: { Authorization: `Bearer ${API_KEY}` },
  // ...
});

// APRÈS (via backend sécurisé)
const BACKEND_URL = "https://juriste-ai-backend.onrender.com";
const res = await fetch(`${BACKEND_URL}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ messages }),
});
```

## 📡 Exemples d'appels API

### Extraction PDF

```bash
curl -X POST https://juriste-ai-backend.onrender.com/api/extract \
  -F "file=@document.pdf" \
  -F "highPrecision=true"
```

### Analyse document

```bash
curl -X POST https://juriste-ai-backend.onrender.com/api/analyze \
  -F "file=@document.pdf" \
  -F "language=fr"
```

### Question sur texte

```bash
curl -X POST https://juriste-ai-backend.onrender.com/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Le texte du document...",
    "question": "Quel est le dispositif de cet arrêt?",
    "language": "fr"
  }'
```

## 💰 Coûts

| Service | Coût |
|---------|------|
| Render.com (Free tier) | **0€** |
| DeepSeek API | ~0.001€ / 1000 tokens |

Pour un usage normal (100 documents/mois), coût total : **< 1€/mois**

## 🔒 Sécurité

- ✅ Clé API stockée côté serveur uniquement
- ✅ CORS configuré
- ✅ Limite de taille fichier (50 MB)
- ✅ Pas de stockage de documents (traitement en mémoire)

## 📝 License

MIT
