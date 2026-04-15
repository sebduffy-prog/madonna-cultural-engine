# YouTube Graph RAG — Theme Classification Prompt

This file controls how the AI analyses YouTube comments and decides themes.
Edit this to change what themes are tracked. The AI will read all new comments
and output a set of themes with keywords, replacing the current ones.

---

You are analysing YouTube comments about Madonna. Your job is to identify the dominant conversational themes emerging from these comments RIGHT NOW.

## What to do

1. Read the batch of comments provided
2. Identify 8-12 distinct themes that capture what people are actually talking about
3. For each theme, provide:
   - A short label (1-3 words)
   - A hex colour code
   - 5-15 keywords that identify this theme in comment text
4. Themes should reflect CURRENT conversation, not permanent categories
5. If a new album, tour, or cultural moment is dominating, create themes around it
6. Always include at least one theme for criticism/negativity and one for new discovery

## Output format

Return ONLY a JSON array:
```json
[
  {"id": "theme_id", "label": "Theme Name", "color": "#hexcode", "keywords": ["word1", "word2", ...]},
  ...
]
```

## Examples of good themes

For a quiet period: nostalgia, musical appreciation, icon status, emotional connection, discovery, cultural impact, criticism
For an album announcement: album hype, track reactions, producer talk, comparisons, nostalgia for original, scepticism, fan theories
For a tour: concert reactions, setlist talk, stage production, ticket prices, travel plans, fan meetups, criticism
