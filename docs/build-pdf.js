/**
 * Converts the Fixity markdown docs into styled PDFs using
 * headless Chrome. No dependencies beyond Node and Chrome.
 *
 *   node docs/build-pdf.js
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const DOCS = path.join(__dirname);
const OUT = path.join(DOCS, "pdf");

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  process.env.LOCALAPPDATA +
    "/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((p) => p && fs.existsSync(p));

if (!CHROME) {
  console.error("Chrome or Edge not found.");
  process.exit(1);
}

const FILES = [
  { file: "../README.md", title: "Fixity — Overview" },
  { file: "FEATURES.md", title: "Fixity — Feature Documentation" },
  { file: "API.md", title: "Fixity — API Reference" },
  { file: "ARCHITECTURE.md", title: "Fixity — Technical Architecture" },
  { file: "INTERVIEW-PREP.md", title: "Fixity — Interview Prep" },
  { file: "TESTING.md", title: "Fixity — Testing Guide" },
];

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2">$1</a>'
    );
}

function markdownToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let inCode = false;
  let inTable = false;
  let listType = null;

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  const closeTable = () => {
    if (inTable) {
      out.push("</tbody></table></div>");
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      closeList();
      closeTable();

      if (inCode) {
        out.push("</code></pre>");
        inCode = false;
      } else {
        out.push("<pre><code>");
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      out.push(escapeHtml(line));
      continue;
    }

    // Tables
    if (line.trim().startsWith("|")) {
      const cells = line
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim());

      const isSeparator = cells.every((c) =>
        /^:?-{2,}:?$/.test(c)
      );

      if (isSeparator) {
        continue;
      }

      if (!inTable) {
        closeList();
        out.push(
          '<div class="table-wrap"><table><thead><tr>' +
            cells
              .map((c) => `<th>${inline(c)}</th>`)
              .join("") +
            "</tr></thead><tbody>"
        );
        inTable = true;
      } else {
        out.push(
          "<tr>" +
            cells
              .map((c) => `<td>${inline(c)}</td>`)
              .join("") +
            "</tr>"
        );
      }
      continue;
    }

    closeTable();

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(
        `<h${level}>${inline(heading[2])}</h${level}>`
      );
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      closeList();
      out.push("<hr>");
      continue;
    }

    const ordered = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (ordered) {
      if (listType !== "ol") {
        closeList();
        out.push("<ol>");
        listType = "ol";
      }
      out.push(`<li>${inline(ordered[2])}</li>`);
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      if (listType !== "ul") {
        closeList();
        out.push("<ul>");
        listType = "ul";
      }
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      closeList();
      out.push(
        `<blockquote>${inline(quote[1])}</blockquote>`
      );
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  closeTable();

  return out.join("\n");
}

const CSS = `
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body {
  font-family: "Segoe UI", -apple-system, system-ui, sans-serif;
  color: #1c2b27; font-size: 10.5pt; line-height: 1.62; margin: 0;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.cover {
  page-break-after: always; display: flex; flex-direction: column;
  justify-content: center; min-height: 232mm; padding: 0 6mm;
  border-left: 5px solid #0b5d54;
}
.cover .brand {
  font-size: 11pt; font-weight: 800; letter-spacing: .18em;
  color: #0b5d54; text-transform: uppercase; margin-bottom: 14px;
}
.cover h1 {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 34pt; line-height: 1.1; margin: 0 0 16px; color: #16211e;
  border: 0; padding: 0;
}
.cover .sub { font-size: 12pt; color: #5c6b66; max-width: 120mm; }
.cover .meta {
  margin-top: 30px; font-size: 9.5pt; color: #7a8884;
  border-top: 1px solid #dcd8ca; padding-top: 12px;
}
h1, h2, h3, h4 {
  font-family: Georgia, "Times New Roman", serif;
  color: #16211e; page-break-after: avoid; line-height: 1.25;
}
h1 { font-size: 21pt; margin: 26px 0 12px; padding-bottom: 7px; border-bottom: 2px solid #0b5d54; }
h2 { font-size: 15.5pt; margin: 22px 0 9px; color: #0b5d54; }
h3 { font-size: 12.5pt; margin: 16px 0 6px; }
h4 { font-size: 11pt; margin: 13px 0 5px; }
p { margin: 0 0 9px; }
ul, ol { margin: 0 0 11px; padding-left: 20px; }
li { margin-bottom: 5px; }
code {
  font-family: "Cascadia Mono", Consolas, monospace; font-size: 9pt;
  background: #eef3f1; color: #0b4f48; padding: 1.5px 5px; border-radius: 3px;
}
pre {
  background: #f5f7f6; border: 1px solid #dfe6e3; border-left: 3px solid #0b5d54;
  border-radius: 5px; padding: 11px 13px; overflow-x: auto;
  page-break-inside: avoid; margin: 0 0 12px;
}
pre code { background: none; padding: 0; font-size: 8.6pt; color: #26332f; line-height: 1.5; }
.table-wrap { page-break-inside: avoid; margin: 0 0 14px; }
table { width: 100%; border-collapse: collapse; font-size: 9pt; }
th {
  background: #0b5d54; color: #fff; text-align: left; padding: 7px 9px;
  font-weight: 600; font-size: 8.6pt; letter-spacing: .02em;
}
td { padding: 6px 9px; border-bottom: 1px solid #e4eae8; vertical-align: top; }
tbody tr:nth-child(even) { background: #f7faf9; }
blockquote {
  margin: 0 0 12px; padding: 9px 14px; background: #eef5f3;
  border-left: 3px solid #0b5d54; color: #33443f; font-style: italic;
}
hr { border: 0; border-top: 1px solid #dcd8ca; margin: 20px 0; }
a { color: #0b5d54; text-decoration: none; }
strong { color: #16211e; }
`;

if (!fs.existsSync(OUT)) {
  fs.mkdirSync(OUT, { recursive: true });
}

const today = new Date().toLocaleDateString("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

for (const doc of FILES) {
  const src = path.join(DOCS, doc.file);

  if (!fs.existsSync(src)) {
    console.log(`skipped (missing): ${doc.file}`);
    continue;
  }

  const md = fs.readFileSync(src, "utf8");
  const body = markdownToHtml(md);
  const base = path.basename(doc.file, ".md");

  const subtitle = doc.title.split("—")[1]?.trim() || "";

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${doc.title}</title>
<style>${CSS}</style></head>
<body>
<div class="cover">
  <div class="brand">Fixity</div>
  <h1>${subtitle || doc.title}</h1>
  <p class="sub">Civic issue reporting platform &mdash; citizens report, authorities fix, everyone verifies.</p>
  <div class="meta">Project documentation &middot; Generated ${today}</div>
</div>
${body}
</body></html>`;

  const tmpHtml = path.join(OUT, `${base}.html`);
  fs.writeFileSync(tmpHtml, html, "utf8");

  const pdfPath = path.join(OUT, `Fixity-${base}.pdf`);

  execFileSync(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--no-pdf-header-footer",
      `--print-to-pdf=${pdfPath}`,
      "file:///" + tmpHtml.replace(/\\/g, "/"),
    ],
    { stdio: "ignore" }
  );

  fs.unlinkSync(tmpHtml);

  const kb = Math.round(
    fs.statSync(pdfPath).size / 1024
  );
  console.log(
    `built: ${path.basename(pdfPath)} (${kb} KB)`
  );
}

console.log(`\nPDFs written to ${OUT}`);
