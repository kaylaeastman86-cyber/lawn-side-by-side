# Instructions for agents updating Lawn Side by Side

This is a static Amazon affiliate comparison site. Every push to `main` rebuilds and publishes the site on Vercel automatically.

## Add a new comparison

1. Copy `content/articles/_TEMPLATE.md` to a new file in `content/articles/`.
   Name it with lowercase words and hyphens, e.g. `push-vs-self-propelled-mower.md`. The file name becomes the page URL: `/compare/push-vs-self-propelled-mower/`.
2. Fill in every front-matter field:
   - `title` — e.g. "Push vs Self-Propelled Mower"
   - `productA`, `productB` — the two things being compared
   - `audience` — exactly `diy` or `pro`
   - `season` — exactly `Spring`, `Summer`, `Fall` or `Winter`
   - `summary` — one sentence, shown on the home page card and in Google results
   - `date` — YYYY-MM-DD
   - `amazonA`, `amazonB` — an Amazon ASIN (10 characters, e.g. `B0ABCD1234`) or search words. These become the buttons at the bottom of the page.
   - `draft: true` hides the page; remove it or set `false` to publish.
3. Write the body in Markdown using the template's sections. Keep the "From the field" tip; it is what makes the page worth reading.
4. Commit and push to `main`.

## Affiliate links

- Never paste a raw Amazon URL with a tag in it. Use the shortcode instead, and the site adds the tag:
  `{{amazon:B0ABCD1234|Check price on Amazon}}` or `{{amazon:cordless leaf blower|See options}}`
- The Amazon tag lives only in `site.config.json` (`amazonTag`). Change it there once and every link updates.

## Product links

- Prefer a specific product's ASIN over search words once you have picked and checked the exact product. Find the ASIN on the Amazon product page under "Product information".
- Focus new articles on the core categories first: cordless blowers, string trimmers, batteries and mowers.

## Rules

- Only state specs (weight, voltage, CFM, price) you verified on the product page. If unsure, describe it qualitatively.
- Do not invent reviews, star ratings, testimonials or "we tested" claims.
- Do not remove the affiliate disclosure (it is added to every page automatically).
- Update `currentSeason` in `site.config.json` when the season changes; the home page marks it "NOW".

## Check your work

Run `node build.js`. If a required field is missing or wrong it prints what to fix and stops, and Vercel will not publish a broken build.
