import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

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
}

const SYSTEM_PROMPT = `Tu es un expert en rédaction de lettres de motivation Parcoursup. Tu rédiges des lettres percutantes, sincères et personnalisées pour des lycéens français.

RÈGLES STRICTES :
- Maximum 1500 caractères ESPACES COMPRIS. C'est la limite Parcoursup. Ne la dépasse JAMAIS.
- Vise entre 1350 et 1490 caractères pour être safe.
- Pas de formule de politesse type "Madame, Monsieur" ni de signature.
- Pas de titre ni d'en-tête.
- Ton naturel mais sérieux. Pas de phrases creuses ou clichés.
- Structure claire : accroche → parcours/motivations → compétences/expériences → projection dans la formation.
- Utilise des éléments CONCRETS du profil de l'élève.
- Adapte le vocabulaire et les arguments à la formation visée.
- La lettre doit donner l'impression qu'elle a été écrite par un lycéen motivé, pas par une IA.
- Écris en français.
- Mets en avant son côté entrepreneur et déterminé sans en faire trop.
- Le sport (judo + foot en club pendant des années) montre sa discipline, sa persévérance et son esprit d'équipe — utilise-le intelligemment, pas comme un cliché.
- Le stage chez L'Oréal est un vrai atout différenciant — exploite-le bien.
- Il veut entreprendre, donc la formation est un tremplin vers son projet, pas une fin en soi.`

app.post('/api/generate', async (req, res) => {
  const { formation } = req.body
  if (!formation) return res.status(400).json({ error: 'Formation manquante' })

  try {
    const userPrompt = `Génère une lettre de motivation Parcoursup (max 1500 caractères espaces compris) pour cet élève :

PROFIL :
- Prénom : ${PROFILE.prenom} ${PROFILE.nom}
- Classe : Terminale Générale
- Spécialités : ${PROFILE.specialites}
- Activités extrascolaires : ${PROFILE.activites}
- Expériences : ${PROFILE.experiences}
- Qualités : ${PROFILE.qualites}
- Projet : ${PROFILE.projet}

FORMATION VISÉE :
${formation}

RAPPEL CRITIQUE : 1500 caractères MAX espaces compris. Vise 1400-1490.`

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
