import express from "express";
import Database from "better-sqlite3";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "graduanda.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_name TEXT NOT NULL,
  phone TEXT,
  parent_name TEXT,
  email TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  concept TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  paid REAL NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  activity_name TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  paid REAL NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);
`);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const money = (n) => Number(n || 0);

app.get("/api/config", (_req, res) => {
  res.json({
    schoolName: process.env.SCHOOL_NAME || "Colegio de Puerto Rico",
    className: process.env.CLASS_NAME || "Clase Graduanda"
  });
});

// Students
app.get("/api/students", (_req, res) => {
  const rows = db.prepare(`
    SELECT s.*,
      COALESCE((SELECT SUM(amount - paid) FROM dues d WHERE d.student_id=s.id),0) AS dues_balance,
      COALESCE((SELECT SUM(amount - paid) FROM activities a WHERE a.student_id=s.id),0) AS activities_balance
    FROM students s
    ORDER BY student_name
  `).all();
  res.json(rows);
});

app.post("/api/students", (req, res) => {
  const { student_name, phone="", parent_name="", email="" } = req.body;
  if (!student_name?.trim()) return res.status(400).json({error:"Nombre requerido"});
  const info = db.prepare(`
    INSERT INTO students(student_name,phone,parent_name,email)
    VALUES(?,?,?,?)
  `).run(student_name.trim(), phone.trim(), parent_name.trim(), email.trim());
  res.json({ id: info.lastInsertRowid });
});

app.delete("/api/students/:id", (req, res) => {
  db.prepare("DELETE FROM students WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// Dues
app.get("/api/dues", (_req, res) => {
  res.json(db.prepare(`
    SELECT d.*, s.student_name, (d.amount-d.paid) AS balance
    FROM dues d JOIN students s ON s.id=d.student_id
    ORDER BY d.date DESC, d.id DESC
  `).all());
});

app.post("/api/dues", (req, res) => {
  const { student_id, concept, amount=0, paid=0, date, notes="" } = req.body;
  if (!student_id || !concept || !date) return res.status(400).json({error:"Datos requeridos incompletos"});
  const info = db.prepare(`
    INSERT INTO dues(student_id,concept,amount,paid,date,notes)
    VALUES(?,?,?,?,?,?)
  `).run(student_id, concept, money(amount), money(paid), date, notes);
  res.json({ id: info.lastInsertRowid });
});

app.delete("/api/dues/:id", (req, res) => {
  db.prepare("DELETE FROM dues WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// Activities
app.get("/api/activities", (_req, res) => {
  res.json(db.prepare(`
    SELECT a.*, s.student_name, (a.amount-a.paid) AS balance
    FROM activities a JOIN students s ON s.id=a.student_id
    ORDER BY a.date DESC, a.id DESC
  `).all());
});

app.post("/api/activities", (req, res) => {
  const { student_id, activity_name, amount=0, paid=0, date, notes="" } = req.body;
  if (!student_id || !activity_name || !date) return res.status(400).json({error:"Datos requeridos incompletos"});
  const info = db.prepare(`
    INSERT INTO activities(student_id,activity_name,amount,paid,date,notes)
    VALUES(?,?,?,?,?,?)
  `).run(student_id, activity_name, money(amount), money(paid), date, notes);
  res.json({ id: info.lastInsertRowid });
});

app.delete("/api/activities/:id", (req, res) => {
  db.prepare("DELETE FROM activities WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// Monthly report
function monthlyReport(month) {
  const start = `${month}-01`;
  const [y,m] = month.split("-").map(Number);
  const next = new Date(y, m, 1);
  const end = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,"0")}-01`;

  const totals = db.prepare(`
    SELECT
      COALESCE((SELECT SUM(amount) FROM dues WHERE date>=? AND date<?),0) AS dues_amount,
      COALESCE((SELECT SUM(paid) FROM dues WHERE date>=? AND date<?),0) AS dues_paid,
      COALESCE((SELECT SUM(amount) FROM activities WHERE date>=? AND date<?),0) AS activities_amount,
      COALESCE((SELECT SUM(paid) FROM activities WHERE date>=? AND date<?),0) AS activities_paid
  `).get(start,end,start,end,start,end,start,end);

  const students = db.prepare(`
    SELECT s.id, s.student_name, s.parent_name, s.phone, s.email,
      COALESCE((SELECT SUM(amount) FROM dues WHERE student_id=s.id AND date>=? AND date<?),0) AS dues_amount,
      COALESCE((SELECT SUM(paid) FROM dues WHERE student_id=s.id AND date>=? AND date<?),0) AS dues_paid,
      COALESCE((SELECT SUM(amount) FROM activities WHERE student_id=s.id AND date>=? AND date<?),0) AS activities_amount,
      COALESCE((SELECT SUM(paid) FROM activities WHERE student_id=s.id AND date>=? AND date<?),0) AS activities_paid
    FROM students s
    ORDER BY s.student_name
  `).all(start,end,start,end,start,end,start,end).map(r => ({
    ...r,
    dues_balance: money(r.dues_amount)-money(r.dues_paid),
    activities_balance: money(r.activities_amount)-money(r.activities_paid),
    total_balance: money(r.dues_amount)-money(r.dues_paid)+money(r.activities_amount)-money(r.activities_paid)
  }));

  return {
    month,
    schoolName: process.env.SCHOOL_NAME || "Colegio de Puerto Rico",
    className: process.env.CLASS_NAME || "Clase Graduanda",
    totals: {
      ...totals,
      total_amount: money(totals.dues_amount)+money(totals.activities_amount),
      total_paid: money(totals.dues_paid)+money(totals.activities_paid),
      total_balance: money(totals.dues_amount)-money(totals.dues_paid)+money(totals.activities_amount)-money(totals.activities_paid)
    },
    students
  };
}

app.get("/api/reports/monthly", (req, res) => {
  const month = req.query.month;
  if (!/^\d{4}-\d{2}$/.test(month || "")) return res.status(400).json({error:"Mes inválido"});
  res.json(monthlyReport(month));
});

app.post("/api/reports/monthly/send", async (req, res) => {
  const { month, to } = req.body;
  if (!/^\d{4}-\d{2}$/.test(month || "")) return res.status(400).json({error:"Mes inválido"});

  const report = monthlyReport(month);
  const recipient = to || process.env.REPORT_TO;
  if (!recipient) return res.status(400).json({error:"Falta email destinatario"});

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(400).json({error:"Configura SMTP en .env antes de enviar"});
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });

  const fmt = n => `$${money(n).toFixed(2)}`;
  const rows = report.students.map(s => `
    <tr>
      <td>${s.student_name}</td>
      <td>${fmt(s.dues_balance)}</td>
      <td>${fmt(s.activities_balance)}</td>
      <td><strong>${fmt(s.total_balance)}</strong></td>
    </tr>
  `).join("");

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:900px;margin:auto">
    <h2>${report.schoolName}</h2>
    <h3>${report.className} — Reporte mensual ${report.month}</h3>
    <p>
      Total asignado: <strong>${fmt(report.totals.total_amount)}</strong><br>
      Total cobrado: <strong>${fmt(report.totals.total_paid)}</strong><br>
      Balance pendiente: <strong>${fmt(report.totals.total_balance)}</strong>
    </p>
    <table style="width:100%;border-collapse:collapse" border="1" cellpadding="8">
      <thead>
        <tr>
          <th>Estudiante</th>
          <th>Balance cuotas</th>
          <th>Balance actividades</th>
          <th>Balance total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;

  await transporter.sendMail({
    from: process.env.REPORT_FROM || process.env.SMTP_USER,
    to: recipient,
    subject: `${report.className} - Balance mensual ${report.month}`,
    html
  });

  res.json({ ok: true, to: recipient });
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Clase Graduanda PR corriendo en http://localhost:${process.env.PORT || 3000}`);
});
