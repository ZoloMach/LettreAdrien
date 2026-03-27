import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

async function fetchFormationContent(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const html = await res.text()
    // Extrait le texte brut : vire les scripts/styles puis les balises
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
    // Limite à ~4000 caractères pour ne pas exploser le prompt
    return text.slice(0, 4000) || null
  } catch {
    return null
  }
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
app.use(express.json())
app.use(cors())

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PROFILE = {
  prenom: 'Adrien',
  nom: 'Assaf',
  specialites: 'Mathématiques et SES',
  activites: '7 ans de judo en club, 6 ans de football en club',
  experiences: "Stage chez L'Oréal : découverte des métiers et du fonctionnement d'un groupe leader mondial de la cosmétique",
  qualites: 'Déterminé, sérieux et impliqué quand il est passionné, persévérant, esprit compétiteur forgé par le sport',
  projet: 'Monter son propre projet entrepreneurial — recherche une formation rigoureuse pour acquérir les fondations business, la discipline et le sérieux nécessaires',
  nationalite: 'Double nationalité franco-libanaise — sensibilité naturelle aux enjeux interculturels et internationaux',
}

const SYSTEM_PROMPT = `Tu es un expert en rédaction de lettres de motivation Parcoursup. Tu rédiges des lettres percutantes, sincères et personnalisées pour des lycéens français.

RÈGLES STRICTES :
- Maximum 1500 caractères ESPACES COMPRIS. C'est la limite Parcoursup. Ne la dépasse JAMAIS.
- Vise entre 1350 et 1490 caractères pour être safe.
- Pas de formule de politesse type "Madame, Monsieur" ni de signature.
- Pas de titre ni d'en-tête.
- Ton sincère, direct, naturel — celui d'un lycéen de terminale qui s'exprime bien mais pas comme un adulte.
- Phrases courtes. Vocabulaire simple et concret. Zéro mot compliqué inutile (pas de "catalyseur", "vecteur", "paradigme", etc.).
- INTERDIT : les tirets (—, -, –) dans les phrases. Reformule toujours avec une virgule, un point ou une nouvelle phrase.
- Pas de tournures trop formelles ou littéraires. Un lycéen motivé écrit clairement, pas pompeusement.
- Structure claire : accroche → pourquoi CETTE formation en particulier → ce qu'il apporte → ce qu'il en attend.
- Utilise des éléments CONCRETS du profil. Pas de généralités.
- La lettre doit sonner vrai, comme si Adrien l'avait écrite lui-même après réflexion.
- Mets en avant son côté entrepreneur et déterminé sans en faire trop.
- Le sport (judo + foot en club pendant des années) montre sa discipline et sa persévérance — utilise-le sobrement, pas comme un cliché.
- Le stage chez L'Oréal est un vrai atout différenciant — exploite-le concrètement.
- Il veut entreprendre : la formation est un tremplin, pas une fin en soi.
- OBLIGATOIRE : mentionne un élément SPÉCIFIQUE et concret de la formation visée (un cours, une pédagogie, un axe, un partenariat, une valeur propre à l'établissement) qui a attiré Adrien. Pas une généralité — quelque chose de précis lié à ce que l'utilisateur a décrit.
- Si la formation a une dimension internationale, mentionne naturellement la double nationalité franco-libanaise d'Adrien comme un atout de sensibilité interculturelle.`

app.post('/api/generate', async (req, res) => {
  const { formation } = req.body
  if (!formation) return res.status(400).json({ error: 'Formation manquante' })

  try {
    // Si c'est une URL, on essaie de récupérer le contenu de la page
    let formationContent = formation
    const isUrl = /^https?:\/\//i.test(formation.trim())
    if (isUrl) {
      const fetched = await fetchFormationContent(formation.trim())
      if (fetched) {
        formationContent = `URL fournie : ${formation}\n\nContenu de la page :\n${fetched}`
      } else {
        formationContent = `URL fournie : ${formation}\n(page inaccessible — utilise l'URL pour déduire le nom de la formation et l'établissement)`
      }
    }

    const userPrompt = `Génère une lettre de motivation Parcoursup (max 1500 caractères espaces compris) pour cet élève :

PROFIL :
- Prénom : ${PROFILE.prenom} ${PROFILE.nom}
- Classe : Terminale Générale
- Spécialités : ${PROFILE.specialites}
- Activités extrascolaires : ${PROFILE.activites}
- Expériences : ${PROFILE.experiences}
- Qualités : ${PROFILE.qualites}
- Projet : ${PROFILE.projet}
- Nationalité : ${PROFILE.nationalite}

FORMATION VISÉE :
${formationContent}

RAPPEL CRITIQUE : 1500 caractères MAX espaces compris. Vise 1400-1490.
RAPPEL : intègre un élément SPÉCIFIQUE à cette formation qui a attiré Adrien. Si dimension internationale, mentionne la double nationalité franco-libanaise.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('')
    res.json({ letter: text })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// Sert le frontend
app.use(express.static(join(__dirname, 'public')))
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'))
})

const PORT = process.env.PORT || 3002
app.listen(PORT, () => console.log(`✓ LettreAdrien sur le port ${PORT}`))
