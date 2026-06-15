# Mandarin Starter Component Graph (c01–c30)

> Phase-1 curriculum seed for Suara. The first 30 building blocks in strict
> dependency order, MT-style. Pairs with `PLAN.md §6` and the `components` schema.
> **Review target:** a native-teacher signs off on the *ordering* before build.

## How to read this

Each block lists: the rule it teaches (MT teaches the *generative rule*, not a
word), its prerequisites, and a **recombination hint** — the sentence(s) it
unlocks using only blocks already introduced. Tone sandhi is *revealed in context,
never drilled* (see notes at the end). `kind` matches the schema enum
(`word | connector | function | pattern`).

Design rules baked into the order:
1. First full sentence by **c03**. 2. One cognate hook up front (咖啡 ≈ "coffee").
3. Every block recombines with priors. 4. Reveal structure (question-word position,
是 links only nouns, 有 negates with 没, measure words, time-placement).

---

## Wave A — First sentences + a cognate win

**c01 · 我 (wǒ, 3) — I / me** · `function`
Rule: the subject slot. Everything starts here.
Prereqs: — · Builds: (subject for every verb to come)

**c02 · 要 (yào, 4) — to want** · `function`
Rule: `我 + 要 + THING` = "I want THING."
Prereqs: c01 · Builds: 我要… 

**c03 · 咖啡 (kāfēi, 1-1) — coffee** · `word`
Hook: it already sounds like "coffee" — you know some Chinese.
Prereqs: c02 · Builds: **我要咖啡** "I want coffee." (first full sentence)

**c04 · 茶 (chá, 2) — tea** · `word`
Prereqs: c02 · Builds: 我要茶 (swap the object — the frame holds)

**c05 · 水 (shuǐ, 3) — water** · `word`
Prereqs: c02 · Builds: 我要水

## Wave B — You, question, negation (turn it into a conversation)

**c06 · 你 (nǐ, 3) — you** · `function`
Rule: swap the subject; the rest is unchanged.
Prereqs: c01 · Builds: 你要茶

**c07 · 吗 (ma, neutral) — yes/no question particle** · `function`
Rule: add 吗 to the end → a yes/no question. No word order change.
Prereqs: c02, c06 · Builds: **你要咖啡吗?** "Do you want coffee?"

**c08 · 不 (bù, 4) — not** · `function`
Rule: 不 goes before the verb. *Sandhi:* 不 → **bú** before a 4th-tone (bú yào).
Prereqs: c02 · Builds: 我不要水

## Wave C — Soft wanting + real actions

**c09 · 想 (xiǎng, 3) — would like to / want to** · `function`
Rule: `想 + VERB` = "would like to VERB" (softer than 要; also "to think / miss").
Prereqs: c01, c08 · Builds: 我想… / 我不想…

**c10 · 喝 (hē, 1) — to drink** · `word`
Rule: `想 + 喝 + drink`. 
Prereqs: c09 · Builds: **我想喝茶** "I'd like to drink tea." (recombines c04/c05)

**c11 · 吃 (chī, 1) — to eat** · `word`
Prereqs: c09 · Builds: 我想吃… (needs a food — next)

**c12 · 饭 (fàn, 4) — rice / meal / food** · `word`
Prereqs: c11 · Builds: 我想吃饭 "I'd like to eat."

**c13 · 去 (qù, 4) — to go** · `word`
Rule: `去 + PLACE`.
Prereqs: c09 · Builds: 我想去… (place via question word next)

## Wave D — Question words (the "no movement" rule)

**c14 · 什么 (shénme, 2-neutral) — what** · `function`
Rule (big one): question words sit **where the answer goes** — no fronting.
Prereqs: c02, c11 · Builds: **你要什么?** / 你想吃什么?

**c15 · 哪儿 / 哪里 (nǎr / nǎlǐ, 3) — where** · `function`
Rule: same no-movement rule, with location.
Prereqs: c13 · Builds: 你想去哪儿?

**c16 · 这个 (zhège, 4-neutral) — this (one)** · `function`
Rule: points at a thing; the 个 inside is a measure word (revealed at c29).
Prereqs: c02 · Builds: 我要这个 "I want this one."

## Wave E — This/that + to be

**c17 · 那个 (nàge, 4-neutral) — that (one)** · `function`
Prereqs: c16 · Builds: 我要那个 (contrast this/that)

**c18 · 是 (shì, 4) — to be** · `function`
Rule: `A 是 B` links **two nouns**. **Never** before a description/adjective.
Prereqs: c01, c16 · Builds: 这个是茶 / 我是…

**c19 · 的 (de, neutral) — 's / of (possessive + modifier)** · `function`
Rule: 我的 = my, 你的 = your; `X的Y` = "X's Y."
Prereqs: c01, c06 · Builds: **这个是我的咖啡** "This is my coffee."

## Wave F — Connect ideas

**c20 · 因为 (yīnwèi, 1-4) — because** · `connector`
Rule: `因为 + reason`.
Prereqs: c09, c10 · Builds: 我想喝咖啡因为…

**c21 · 但是 (dànshì, 4-4) — but** · `connector`
Rule: `clause 但是 clause`.
Prereqs: c08 · Builds: 我想喝茶但是不要咖啡

**c22 · 和 (hé, 2) — and** · `connector`
Rule: 和 joins **nouns**, not clauses (structure reveal).
Prereqs: c04, c05 · Builds: 我要茶和水

## Wave G — Politeness, permission, quantity

**c23 · 请 (qǐng, 3) — please / to invite** · `word`
Rule: `请 + VERB` softens into a polite request.
Prereqs: c10 · Builds: 请喝茶

**c24 · 可以 (kěyǐ, 3-3) — can / may** · `function`
Rule: `可以 + VERB` = permission/ability. *Sandhi:* 3+3 → **2-3** (kéyǐ).
Prereqs: c02, c07 · Builds: **我可以喝茶吗?** "May I drink tea?"

**c25 · 一点 (yìdiǎn, 4-3) — a little / a bit** · `word`
Rule: `VERB + 一点 + noun`. *Sandhi:* 一 → yì before a 3rd-tone.
Prereqs: c10 · Builds: 我想喝一点茶

**c26 · 有 (yǒu, 3) — to have / there is** · `function`
Rule: `SUBJECT + 有 + THING`.
Prereqs: c01, c06 · Builds: 你有水吗?

## Wave H — The 有 exception, counting, time

**c27 · 没有 (méiyǒu, 2-3) — don't have / there isn't** · `function`
Rule (exception): 有 negates with **没**, not 不.
Prereqs: c26, c08 · Builds: 我没有咖啡

**c28 · 一 (yī, 1) — one** · `function`
Rule: the number one; foundation for counting. *Sandhi:* yī → yì / yí by next tone.
Prereqs: c16 · Builds: (number for the measure word next)

**c29 · 个 (gè, 4 / neutral) — general measure word** · `function`
Rule: reveal the system — `NUMBER + 个 + noun`. Now re-read 这个/那个.
Prereqs: c28, c16 · Builds: 我要一个… 

**c30 · 现在 (xiànzài, 4-4) — now** · `word`
Rule: time words go **early** (after subject, before verb).
Prereqs: c09 · Builds: 我现在想喝咖啡

---

## What the learner can say by c30 (using only these 30 blocks)

- 我现在想喝一点茶，因为我没有咖啡。
  *"I'd like a little tea now, because I don't have coffee."*
- 你可以吃这个吗?  *"Can you eat this?"*
- 你想去哪儿?  *"Where do you want to go?"*
- 这个是我的水，那个是你的茶。  *"This is my water, that's your tea."*
- 我要茶和水，但是不要咖啡。  *"I want tea and water, but not coffee."*

That range from 30 blocks is the MT payoff — recombination, not memorization.

## Tone-sandhi moments (reveal gently, in context — never drill)

- **不**: bù → **bú** before a 4th tone (不要 → búyào). Introduced at c08.
- **一**: yī → **yì** before 1st/2nd/3rd tones, **yí** before a 4th tone. At c25/c28.
- **3 + 3 → 2 + 3**: two 3rd tones in a row, the first rises (可以 → kéyǐ,
  哪里 → nálǐ). At c24.

The brain mentions these the first time they surface, then just models them
correctly thereafter — the learner absorbs the pattern without a "rule lesson."

---

## JSON seed (loadable; matches the `components` schema)

```json
{
  "lang": "cmn",
  "components": [
    { "id": "c01", "kind": "function", "surface": "我 (wǒ)", "gloss_en": "I / me", "expected_tones": "3", "prereq_ids": [], "recomb_hint": "subject slot for every verb" },
    { "id": "c02", "kind": "function", "surface": "要 (yào)", "gloss_en": "to want", "expected_tones": "4", "prereq_ids": ["c01"], "recomb_hint": "我 + 要 + thing" },
    { "id": "c03", "kind": "word", "surface": "咖啡 (kāfēi)", "gloss_en": "coffee (loanword)", "expected_tones": "1-1", "prereq_ids": ["c02"], "recomb_hint": "我要咖啡 — first full sentence" },
    { "id": "c04", "kind": "word", "surface": "茶 (chá)", "gloss_en": "tea", "expected_tones": "2", "prereq_ids": ["c02"], "recomb_hint": "swap object: 我要茶" },
    { "id": "c05", "kind": "word", "surface": "水 (shuǐ)", "gloss_en": "water", "expected_tones": "3", "prereq_ids": ["c02"], "recomb_hint": "swap object: 我要水" },
    { "id": "c06", "kind": "function", "surface": "你 (nǐ)", "gloss_en": "you", "expected_tones": "3", "prereq_ids": ["c01"], "recomb_hint": "swap subject: 你要茶" },
    { "id": "c07", "kind": "function", "surface": "吗 (ma)", "gloss_en": "yes/no question particle", "expected_tones": "0", "prereq_ids": ["c02","c06"], "recomb_hint": "你要咖啡吗?" },
    { "id": "c08", "kind": "function", "surface": "不 (bù)", "gloss_en": "not", "expected_tones": "4", "prereq_ids": ["c02"], "recomb_hint": "我不要水; sandhi bú before 4th tone" },
    { "id": "c09", "kind": "function", "surface": "想 (xiǎng)", "gloss_en": "would like to / want to", "expected_tones": "3", "prereq_ids": ["c01","c08"], "recomb_hint": "想 + VERB" },
    { "id": "c10", "kind": "word", "surface": "喝 (hē)", "gloss_en": "to drink", "expected_tones": "1", "prereq_ids": ["c09"], "recomb_hint": "我想喝茶 (recombines c04/c05)" },
    { "id": "c11", "kind": "word", "surface": "吃 (chī)", "gloss_en": "to eat", "expected_tones": "1", "prereq_ids": ["c09"], "recomb_hint": "needs a food object (c12)" },
    { "id": "c12", "kind": "word", "surface": "饭 (fàn)", "gloss_en": "rice / meal / food", "expected_tones": "4", "prereq_ids": ["c11"], "recomb_hint": "我想吃饭" },
    { "id": "c13", "kind": "word", "surface": "去 (qù)", "gloss_en": "to go", "expected_tones": "4", "prereq_ids": ["c09"], "recomb_hint": "去 + PLACE (place via c15)" },
    { "id": "c14", "kind": "function", "surface": "什么 (shénme)", "gloss_en": "what", "expected_tones": "2-0", "prereq_ids": ["c02","c11"], "recomb_hint": "question word stays in answer position: 你要什么?" },
    { "id": "c15", "kind": "function", "surface": "哪儿 / 哪里 (nǎr / nǎlǐ)", "gloss_en": "where", "expected_tones": "3", "prereq_ids": ["c13"], "recomb_hint": "你想去哪儿?" },
    { "id": "c16", "kind": "function", "surface": "这个 (zhège)", "gloss_en": "this (one)", "expected_tones": "4-0", "prereq_ids": ["c02"], "recomb_hint": "我要这个; contains 个 (revealed at c29)" },
    { "id": "c17", "kind": "function", "surface": "那个 (nàge)", "gloss_en": "that (one)", "expected_tones": "4-0", "prereq_ids": ["c16"], "recomb_hint": "contrast this/that" },
    { "id": "c18", "kind": "function", "surface": "是 (shì)", "gloss_en": "to be (links nouns only)", "expected_tones": "4", "prereq_ids": ["c01","c16"], "recomb_hint": "A 是 B; never before adjectives: 这个是茶" },
    { "id": "c19", "kind": "function", "surface": "的 (de)", "gloss_en": "'s / of (possessive)", "expected_tones": "0", "prereq_ids": ["c01","c06"], "recomb_hint": "我的/你的; 这个是我的咖啡" },
    { "id": "c20", "kind": "connector", "surface": "因为 (yīnwèi)", "gloss_en": "because", "expected_tones": "1-4", "prereq_ids": ["c09","c10"], "recomb_hint": "我想喝咖啡因为…" },
    { "id": "c21", "kind": "connector", "surface": "但是 (dànshì)", "gloss_en": "but", "expected_tones": "4-4", "prereq_ids": ["c08"], "recomb_hint": "我想喝茶但是不要咖啡" },
    { "id": "c22", "kind": "connector", "surface": "和 (hé)", "gloss_en": "and (joins nouns)", "expected_tones": "2", "prereq_ids": ["c04","c05"], "recomb_hint": "我要茶和水; joins nouns not clauses" },
    { "id": "c23", "kind": "word", "surface": "请 (qǐng)", "gloss_en": "please / to invite", "expected_tones": "3", "prereq_ids": ["c10"], "recomb_hint": "请 + VERB: 请喝茶" },
    { "id": "c24", "kind": "function", "surface": "可以 (kěyǐ)", "gloss_en": "can / may", "expected_tones": "3-3", "prereq_ids": ["c02","c07"], "recomb_hint": "我可以喝茶吗?; sandhi 3+3 → kéyǐ" },
    { "id": "c25", "kind": "word", "surface": "一点 (yìdiǎn)", "gloss_en": "a little / a bit", "expected_tones": "4-3", "prereq_ids": ["c10"], "recomb_hint": "我想喝一点茶; 一 sandhi" },
    { "id": "c26", "kind": "function", "surface": "有 (yǒu)", "gloss_en": "to have / there is", "expected_tones": "3", "prereq_ids": ["c01","c06"], "recomb_hint": "你有水吗?" },
    { "id": "c27", "kind": "function", "surface": "没有 (méiyǒu)", "gloss_en": "don't have / there isn't", "expected_tones": "2-3", "prereq_ids": ["c26","c08"], "recomb_hint": "有 negates with 没 not 不: 我没有咖啡" },
    { "id": "c28", "kind": "function", "surface": "一 (yī)", "gloss_en": "one", "expected_tones": "1", "prereq_ids": ["c16"], "recomb_hint": "number for the measure word; 一 sandhi" },
    { "id": "c29", "kind": "function", "surface": "个 (gè)", "gloss_en": "general measure word", "expected_tones": "4", "prereq_ids": ["c28","c16"], "recomb_hint": "NUMBER + 个 + noun: 我要一个…; re-read 这个/那个" },
    { "id": "c30", "kind": "word", "surface": "现在 (xiànzài)", "gloss_en": "now", "expected_tones": "4-4", "prereq_ids": ["c09"], "recomb_hint": "time words go early: 我现在想喝咖啡" }
  ]
}
```
