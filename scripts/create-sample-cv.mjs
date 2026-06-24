/**
 * Generates a minimal but valid PDF with extractable text for the TrueHire AI e2e demo.
 * Uses raw PDF syntax — no external dependencies required.
 */
import { writeFileSync } from "fs";

const cvContent = [
  "Jane Doe",
  "Senior ML Engineer",
  "jane.doe@email.com | github.com/janedoe | linkedin.com/in/janedoe",
  "",
  "SUMMARY",
  "ML Engineer with 3 years of experience building production recommendation systems",
  "and REST APIs. Specialised in Python, FastAPI, and scikit-learn.",
  "",
  "EXPERIENCE",
  "ML Engineer, TechCorp Inc. (2021-2024)",
  "- Designed and deployed a collaborative filtering recommendation system",
  "  serving 1.2M active users, using ALS matrix factorization via scikit-learn.",
  "- Built a FastAPI microservice for real-time inference, achieving <50ms P99 latency",
  "  via Redis caching with 24h TTL and connection pooling to PostgreSQL.",
  "- Reduced model cold-start problem with hybrid popularity-based fallback for new users.",
  "- Containerised all services with Docker; deployed via GitHub Actions to AWS ECS.",
  "",
  "Software Engineer Intern, DataSolutions Ltd. (2020-2021)",
  "- Developed ETL pipelines using Pandas and Apache Airflow for data ingestion.",
  "- Wrote unit tests with pytest; maintained 90%+ code coverage.",
  "",
  "PROJECTS",
  "1. ML Recommendation System (TechCorp)",
  "   ALS-based collaborative filtering model trained on 500M interaction events.",
  "   Tech: Python, scikit-learn, PostgreSQL, Redis, FastAPI, Docker",
  "",
  "2. Real-Time Fraud Detection API",
  "   FastAPI service with XGBoost classifier for detecting fraudulent transactions.",
  "   Achieved 98.2% precision on holdout set. Tech: Python, FastAPI, XGBoost, SQLite",
  "",
  "EDUCATION",
  "BSc Computer Science, Stanford University, 2021",
  "Relevant coursework: Machine Learning, Distributed Systems, Algorithms",
  "",
  "SKILLS",
  "Languages: Python, SQL, JavaScript, Bash",
  "Frameworks: FastAPI, scikit-learn, Pandas, NumPy, XGBoost, Airflow",
  "Databases: PostgreSQL, Redis, SQLite",
  "Infrastructure: Docker, AWS ECS, GitHub Actions, Linux",
  "",
  "CLAIMED TECHNOLOGIES",
  "Python, FastAPI, PostgreSQL, scikit-learn, Redis, Docker, XGBoost,",
  "Pandas, NumPy, Airflow, AWS ECS, GitHub Actions",
];

function escapePdfString(str) {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

// Build content stream
let streamLines = ["BT", "/F1 9 Tf", "50 750 Td", "14 TL"];
for (let i = 0; i < cvContent.length; i++) {
  const line = cvContent[i] ?? "";
  if (i === 0) {
    streamLines.push(`(${escapePdfString(line)}) Tj T*`);
  } else {
    streamLines.push(`(${escapePdfString(line)}) Tj T*`);
  }
}
streamLines.push("ET");
const streamContent = streamLines.join("\n") + "\n";
const streamBuffer = Buffer.from(streamContent, "latin1");

// Build PDF objects and track byte offsets
const parts = [];
const offsets = {};
let bytePos = 0;

function addPart(str) {
  const buf = Buffer.from(str, "latin1");
  parts.push(buf);
  bytePos += buf.length;
  return buf.length;
}

// Header
addPart("%PDF-1.4\n");

// Object 1: Catalog
offsets[1] = bytePos;
addPart("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

// Object 2: Pages
offsets[2] = bytePos;
addPart("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

// Object 3: Page
offsets[3] = bytePos;
addPart(
  "3 0 obj\n" +
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]\n" +
    "   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\n" +
    "endobj\n",
);

// Object 4: Content stream
offsets[4] = bytePos;
addPart(
  `4 0 obj\n<< /Length ${streamBuffer.length} >>\nstream\n`,
);
parts.push(streamBuffer);
bytePos += streamBuffer.length;
addPart("\nendstream\nendobj\n");

// Object 5: Font
offsets[5] = bytePos;
addPart(
  "5 0 obj\n" +
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica\n" +
    "   /Encoding /WinAnsiEncoding >>\n" +
    "endobj\n",
);

// xref table
const xrefPos = bytePos;
let xref = "xref\n0 6\n";
xref += "0000000000 65535 f \n";
for (let i = 1; i <= 5; i++) {
  xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
}
xref += "trailer\n<< /Size 6 /Root 1 0 R >>\n";
xref += `startxref\n${xrefPos}\n%%EOF\n`;
addPart(xref);

const pdfBuffer = Buffer.concat(parts);
const outPath = "/tmp/sample-cv.pdf";
writeFileSync(outPath, pdfBuffer);
console.log(`PDF created at ${outPath} (${pdfBuffer.length} bytes)`);
