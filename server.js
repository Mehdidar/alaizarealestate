require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for your GoDaddy domain
app.use(cors({
    origin: ['https://alaizarealestate.com', 'http://127.0.0.1:5500', 'http://localhost:3000'],
    credentials: true
}));

// Render Persistence Logic (for SQLite & Uploads)
const diskPath = process.env.RENDER_DISK_PATH || '.';
const uploadDir = path.join(diskPath, 'uploads');
const dbFile = path.join(diskPath, 'inquiries.db');

// Ensure directories exist
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer Storage Configuration (Points to persistent disk if on Render)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// 1. Initialize SQLite Database
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) return console.error(err.message);
    console.log(`Connected to database at ${dbFile}`);
});

// Create table with image support
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS inquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT NOT NULL,
        interest TEXT,
        budget TEXT,
        message TEXT NOT NULL,
        image_path TEXT,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// 2. Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
// Never serve server-side files (database, source, config) as public static files
const BLOCKED_PATHS = /^\/(inquiries\.db|server\.js|package(-lock)?\.json|node_modules|admin\.html)(\/|$)/i;
app.use((req, res, next) => {
    if (BLOCKED_PATHS.test(req.path) || req.path.endsWith('.db')) return res.status(404).end();
    next();
});
app.use(express.static(path.join(__dirname), { dotfiles: 'deny' }));
app.use('/uploads', express.static(uploadDir));

// 3. Email Transporter Setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// 4. Submission Route
app.post('/api/inquiry', upload.single('image'), async (req, res) => {
    const { name, phone, email, interest, budget, message } = req.body;
    const imagePath = req.file ? req.file.path : null;

    if (!name || !email || !message) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    // Save to Database
    const sql = `INSERT INTO inquiries (name, phone, email, interest, budget, message, image_path) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [name, phone, email, interest, budget, message, imagePath], function(err) {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: "Failed to save inquiry" });
        }

        const inquiryId = this.lastID;

        // Admin Notification with Attachment
        const adminMailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.ADMIN_EMAIL,
            subject: `New Inquiry from ${name} [${interest || "General"}]`,
            html: `<h3>New Inquiry Received</h3>
                   <p><strong>Name:</strong> ${name}</p>
                   <p><strong>Phone:</strong> ${phone || "N/A"}</p>
                   <p><strong>Email:</strong> ${email}</p>
                   <p><strong>Interest:</strong> ${interest || "General Inquiry"}</p>
                   <p><strong>Budget Range:</strong> ${budget || "Not Specified"}</p>
                   <p><strong>Message:</strong> ${message}</p>`,
            attachments: imagePath ? [{ filename: req.file.originalname, path: imagePath }] : []
        };

        // User Confirmation
        const userMailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "We've Received Your Inquiry - Al Aiza Real Estate",
            html: `<h3>Hello ${name},</h3>
                   <p>Thank you for reaching out to Al Aiza Real Estate. Our team has received your inquiry.</p>
                   <p>A specialist will review your request and reach out within 24 hours.</p>
                   <p>Best Regards,<br><strong>Al Aiza Real Estate Team</strong></p>`
        };

        transporter.sendMail(adminMailOptions).catch(err => console.error("Admin Email Error:", err));
        transporter.sendMail(userMailOptions).catch(err => console.error("User Email Error:", err));

        res.json({ message: "Inquiry received successfully", id: inquiryId });
    });
});

// 5. Admin Routes (passcode sent in a header, never in the URL)
const crypto = require('crypto');
const ADMIN_PASS = process.env.ADMIN_PASS;
if (!ADMIN_PASS) console.warn('ADMIN_PASS is not set — the admin dashboard is disabled.');

function isAdmin(req) {
    const given = req.get('x-admin-pass') || '';
    if (!ADMIN_PASS || !given) return false;
    const a = Buffer.from(given), b = Buffer.from(ADMIN_PASS);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// The page itself holds no data; it asks for the passcode and calls the API below
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// 6. Fetch Inquiries API
app.get('/api/inquiries', (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: "Unauthorized" });

    db.all(`SELECT * FROM inquiries ORDER BY submitted_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
