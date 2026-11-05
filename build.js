// Lawn Side by Side site builder. No dependencies: run `node build.js`.
// Reads site.config.json + content/articles/*.md, writes the finished site to dist/.
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const OUT = path.join(ROOT, "dist");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));
const css = fs.readFileSync(path.join(ROOT, "src/styles.css"), "utf8");
const SEASONS = ["Spring", "Summer", "Fall", "Winter"];
const AUDS = ["diy", "pro"];

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function amazonUrl(target) {
  const t = target.trim();
  const base = /^[A-Z0-9]{10}$/.test(t)
    ? `https://www.amazon.com/dp/${t}`
    : `https://www.amazon.com/s?k=${encodeURIComponent(t)}`;
  return base + (base.includes("?") ? "&" : "?") + "tag=" + encodeURIComponent(cfg.amazonTag);
}
const amazonLink = (target, label) =>
  `<a class="btn" href="${esc(amazonUrl(target))}" target="_blank" rel="nofollow sponsored noopener">${esc(label || "Check price on Amazon")}</a>`;

// --- front matter: simple `key: value` lines between --- markers
function parse(file) {
  const raw = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${path.basename(file)}: missing front matter`);
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (kv) meta[kv[1].trim()] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return { meta, body: m[2] };
}

// --- small markdown converter: headings, paragraphs, lists, tables, quotes, bold, italics, links, amazon shortcodes
function inline(s) {
  let out = esc(s);
  out = out.replace(/\{\{amazon:([^|}]+)(?:\|([^}]+))?\}\}/g, (_, t, l) => amazonLink(t, l));
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|\W)\*(.+?)\*(?=\W|$)/g, "$1<em>$2</em>");
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, (_, t, u) => {
    const ext = /^https?:/.test(u);
    return `<a href="${u}"${ext ? ' target="_blank" rel="noopener"' : ""}>${t}</a>`;
  });
  return out;
}
function markdown(md) {
  const lines = md.split("\n");
  const html = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^(#{2,3})\s+(.*)/))) { html.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); i++; continue; }
    if (/^\|.*\|\s*$/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.trim().slice(1, -1).split("|").map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(rows[1] && /^\|[\s:-|]+\|$/.test(rows[1].trim()) ? 2 : 1);
      html.push(`<div class="tbl"><table><thead><tr>${head.map((h, j) => `<th scope="col">${j ? inline(h) : ""}</th>`).join("")}</tr></thead><tbody>` +
        body.map((r) => "<tr>" + cells(r).map((c, j) => j ? `<td>${inline(c)}</td>` : `<th scope="row">${inline(c)}</th>`).join("") + "</tr>").join("") +
        "</tbody></table></div>");
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^[-*]\s+/, ""));
      html.push("<ul>" + items.map((t) => `<li>${inline(t)}</li>`).join("") + "</ul>");
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) items.push(lines[i++].replace(/^\d+\.\s+/, ""));
      html.push("<ol>" + items.map((t) => `<li>${inline(t)}</li>`).join("") + "</ol>");
      continue;
    }
    if (/^>\s?/.test(line)) {
      const q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
      html.push(`<blockquote><p>${inline(q.join(" "))}</p></blockquote>`);
      continue;
    }
    const p = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|\||[-*]\s|\d+\.\s|>)/.test(lines[i])) p.push(lines[i++]);
    html.push(`<p>${inline(p.join(" "))}</p>`);
  }
  return html.join("\n");
}

// --- load + validate articles
const dir = path.join(ROOT, "content/articles");
const problems = [];
const articles = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("_")).map((f) => {
  const { meta, body } = parse(path.join(dir, f));
  const slug = f.replace(/\.md$/, "");
  const need = ["title", "productA", "productB", "audience", "season", "summary"];
  need.forEach((k) => { if (!meta[k]) problems.push(`${f}: missing "${k}"`); });
  if (meta.audience && !AUDS.includes(meta.audience)) problems.push(`${f}: audience must be diy or pro`);
  if (meta.season && !SEASONS.includes(meta.season)) problems.push(`${f}: season must be one of ${SEASONS.join(", ")}`);
  return { slug, ...meta, body, draft: meta.draft === "true" };
}).filter((a) => !a.draft).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
if (problems.length) { console.error("Fix these before publishing:\n- " + problems.join("\n- ")); process.exit(1); }

// --- page shell
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&family=Public+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap">';
const logo = `<a class="logo" href="/"><svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><rect x="1" y="1" width="14" height="32" fill="#e8742a"/><rect x="19" y="1" width="14" height="32" fill="#f2f6ef"/></svg>${esc(cfg.siteName)}</a>`;
const nav = `<nav class="nav" aria-label="Main">${logo}<div class="navlinks"><a href="/#comparisons">Comparisons</a><a href="/#diy">DIY</a><a href="/#pro">Pros</a><a href="/#seasons">Year-round guide</a><a href="/#about">About</a></div></nav>`;
const footer = `<footer><div class="wrap"><div><strong>${esc(cfg.siteName)}</strong> · ${esc(cfg.domain.replace(/^https?:\/\//, ""))}</div><div>As an Amazon Associate, ${esc(cfg.siteName)} earns from qualifying purchases. Links to Amazon on this site are affiliate links; prices and availability are set by Amazon and can change.</div><div>© ${new Date().getFullYear()} ${esc(cfg.siteName)}</div></div></footer>`;
function page({ title, description, canonical, head = "", body }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:type" content="website">
${FONTS}<link rel="stylesheet" href="/styles.css">${head}</head><body>${body}${footer}</body></html>`;
}
const vsTitle = (a) => `${esc(a.productA)} <span class="x">vs</span> ${esc(a.productB)}`;
const card = (a) => `<article class="card" data-aud="${a.audience}" data-season="${a.season}"><div class="meta"><span class="tag">${a.season}</span><span class="tag">${a.audience === "pro" ? "Pro" : "DIY"}</span></div><h3>${vsTitle(a)}</h3><p>${esc(a.summary)}</p><a class="more" href="/compare/${a.slug}/">Read the comparison →</a></article>`;

// --- home page
const home = page({
  title: `${cfg.siteName} | Lawn & Yard Gear Compared`,
  description: cfg.description,
  canonical: cfg.domain + "/",
  body: `<header class="mast"><div class="wrap">${nav}
<div class="hero"><div><div class="vs">MOWER <span aria-hidden="true">⇄</span> MOWER</div><h1>Two tools.<br>One <em>verdict.</em></h1></div>
<p>Straight side-by-side comparisons of lawn and yard gear, written by someone who works in lawn care. Pick your lane below: running a crew, or doing your own yard.</p></div></div></header>
<main class="wrap">
<div class="switch" role="group" aria-label="Choose your section"><button id="aud-diy" data-aud="diy" aria-pressed="true">DIY Homeowners<small>Your own yard, your weekend</small></button><button id="aud-pro" data-aud="pro" aria-pressed="false">Pros<small>Crews, routes, uptime</small></button></div>
<section id="comparisons"><div class="section-h"><h2 id="list-title">DIY comparisons</h2><div class="seasons" role="group" aria-label="Filter by season" id="seasons-filter">
${["All", ...SEASONS].map((s) => `<button data-s="${s}" aria-pressed="${s === "All"}">${s}${s === cfg.currentSeason ? '<span class="now">NOW</span>' : ""}</button>`).join("")}
</div></div><div class="grid" id="grid">${articles.map(card).join("")}<div class="empty" id="empty" hidden>No comparisons here yet. New ones are added every week.</div></div></section>
<section id="seasons"><div class="section-h"><h2>The yard never closes</h2><p>What we compare, season by season</p></div><div class="cal">
<div><h4>Spring</h4><span class="mo">MAR – MAY</span><ul><li>Mowers &amp; tune-ups</li><li>Spreaders, seed, aerators</li><li>String trimmers</li></ul></div>
<div><h4>Summer</h4><span class="mo">JUN – AUG</span><ul><li>Edgers &amp; hedge trimmers</li><li>Sprinklers &amp; hoses</li><li>Blades &amp; trimmer line</li></ul></div>
<div><h4>Fall</h4><span class="mo">SEP – NOV</span><ul><li>Leaf blowers &amp; vacuums</li><li>Mulching kits</li><li>Overseeding gear</li></ul></div>
<div><h4>Winter</h4><span class="mo">DEC – FEB</span><ul><li>Snow blowers &amp; shovels</li><li>Blade sharpeners, drills</li><li>Oil changes &amp; storage</li></ul></div></div></section>
<section class="about" id="about"><h2>Real yard work, not a spec sheet copy.</h2><div><p>${esc(cfg.siteName)} is run by someone who works in the lawn care industry and talks with landscapers every week about what holds up and what breaks.</p><p>Each comparison puts two products next to each other, explains the trade-offs in plain words, and tells you which one fits your situation.</p></div></section>
</main>
<script>
(function(){var aud="diy",season="All";var cards=[].slice.call(document.querySelectorAll(".card"));
function render(){document.querySelectorAll(".switch button").forEach(function(b){b.setAttribute("aria-pressed",b.dataset.aud===aud)});
document.querySelectorAll("#seasons-filter button").forEach(function(b){b.setAttribute("aria-pressed",b.dataset.s===season)});
document.getElementById("list-title").textContent=(aud==="pro"?"Pro":"DIY")+" comparisons";var n=0;
cards.forEach(function(c){var show=c.dataset.aud===aud&&(season==="All"||c.dataset.season===season);c.hidden=!show;if(show)n++});
document.getElementById("empty").hidden=n>0}
document.querySelectorAll(".switch button").forEach(function(b){b.addEventListener("click",function(){history.replaceState(null,"","#"+b.dataset.aud);aud=b.dataset.aud;render()})});
document.querySelectorAll("#seasons-filter button").forEach(function(b){b.addEventListener("click",function(){season=b.dataset.s;render()})});
function fromHash(){var h=location.hash.slice(1);if(h==="pro"||h==="diy"){aud=h;render();document.getElementById("comparisons").scrollIntoView()}}
window.addEventListener("hashchange",fromHash);var h=location.hash.slice(1);if(h==="pro"||h==="diy")aud=h;render()})();
</script>`,
});

// --- write output
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "index.html"), home);
fs.writeFileSync(path.join(OUT, "styles.css"), css);
if (fs.existsSync(path.join(ROOT, "public"))) fs.cpSync(path.join(ROOT, "public"), OUT, { recursive: true });

for (const a of articles) {
  const url = `${cfg.domain}/compare/${a.slug}/`;
  const html = page({
    title: `${a.title} | ${cfg.siteName}`,
    description: a.summary,
    canonical: url,
    head: `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: a.title, description: a.summary, datePublished: a.date || undefined, publisher: { "@type": "Organization", name: cfg.siteName } })}</script>`,
    body: `<header class="mast slim"><div class="wrap">${nav}</div></header>
<main class="wrap article"><div class="crumbs"><a href="/">Home</a><span>/</span><a href="/#${a.audience}">${a.audience === "pro" ? "Pros" : "DIY"}</a><span>/</span><span>${a.season}</span></div>
<h1>${vsTitle(a)}</h1><p class="lede">${esc(a.summary)}</p>
<p class="disclose">This page has Amazon affiliate links. If you buy through them, ${esc(cfg.siteName)} earns a small commission at no extra cost to you.</p>
${markdown(a.body)}
<p style="margin-top:32px">${a.amazonA ? amazonLink(a.amazonA, a.productA + " on Amazon") : ""} ${a.amazonB ? amazonLink(a.amazonB, a.productB + " on Amazon") : ""}</p>
</main>`,
  });
  fs.mkdirSync(path.join(OUT, "compare", a.slug), { recursive: true });
  fs.writeFileSync(path.join(OUT, "compare", a.slug, "index.html"), html);
}

const urls = ["/", ...articles.map((a) => `/compare/${a.slug}/`)];
fs.writeFileSync(path.join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${cfg.domain}${u}</loc></url>`).join("\n")}\n</urlset>\n`);
fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${cfg.domain}/sitemap.xml\n`);
console.log(`Built ${articles.length} comparison page(s) into dist/`);
