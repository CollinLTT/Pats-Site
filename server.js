require('dotenv').config(); // Load .env first
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcrypt');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();

// ====== Data File Setup ======
const DATA_FILE = path.join(__dirname, 'site-data.json');

// Initialize JSON file if missing
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
        tagline: "Welcome to Patz Brat!",
        links: [
            { name: "OnlyFans", url: "https://onlyfans.com/", icon: "fa-brands fa-onlyfans", smallTagline: "Exclusive content" },
            { name: "Instagram", url: "https://instagram.com/", icon: "fab fa-instagram", smallTagline: "See my daily posts" },
            { name: "Twitter / X", url: "https://twitter.com/", icon: "fab fa-x-twitter", smallTagline: "Follow my updates" },
            { name: "TikTok", url: "https://tiktok.com/", icon: "fab fa-tiktok", smallTagline: "Fun clips here" }
        ]
    }, null, 2));
}

// ====== Middleware ======
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ====== Persistent Session Setup (SQLite) ======
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.sqlite',   // File name for session storage
        dir: __dirname           // Store alongside server.js
    }),
    secret: process.env.SESSION_SECRET || 'fallback-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 1 day
        httpOnly: true,
        secure: false,               // true if using HTTPS
        sameSite: 'lax'
    }
}));

// ====== Ensure Uploads Folder ======
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// ====== Multer Setup for Image Uploads ======
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// ====== Auth Setup ======
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const DEFAULT_PASS = process.env.ADMIN_PASS || 'password123';
const ADMIN_HASH = process.env.ADMIN_HASH || bcrypt.hashSync(DEFAULT_PASS, 10);

function requireLogin(req, res, next) {
    if (!req.session.loggedIn) return res.redirect('/admin/login.html');
    next();
}

app.get('/api/check-auth', (req, res) => {
    res.status(req.session.loggedIn ? 200 : 401).json({ loggedIn: !!req.session.loggedIn });
});

// ====== Site Data APIs ======
app.get('/api/site-data', (req, res) => {
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: "Failed to load site data" });
        res.json(JSON.parse(data));
    });
});

app.post('/api/update-site-data', requireLogin, (req, res) => {
    fs.writeFile(DATA_FILE, JSON.stringify(req.body, null, 2), err => {
        if (err) return res.status(500).json({ error: "Failed to save" });
        res.json({ success: true });
    });
});

// ====== Serve Pages ======
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin/upload.html', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin', 'upload.html'));
});

// ====== Login & Logout ======
app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && await bcrypt.compare(password, ADMIN_HASH)) {
        req.session.loggedIn = true;
        res.redirect('/admin/upload.html');
    } else {
        res.send('Invalid login');
    }
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/admin/login.html');
    });
});

// ====== Upload & Gallery APIs ======
app.post('/admin/upload', requireLogin, upload.single('image'), (req, res) => {
    console.log('Image uploaded:', req.file.filename);
    res.status(200).send('OK');
});

app.get('/api/images', (req, res) => {
    fs.readdir('uploads', (err, files) => {
        if (err) return res.status(500).json({ error: 'Error reading uploads' });
        const images = files.filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file));
        res.json(images);
    });
});

app.delete('/api/delete/:filename', requireLogin, (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    fs.unlink(filePath, err => {
        if (err) return res.status(500).send('Failed to delete');
        console.log('Image deleted:', req.params.filename);
        res.send('Deleted');
    });
});

// ===== Persistent View Count =====
app.get('/api/views', (req, res) => {
    // Load data
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

    // Increment and save
    data.views = (data.views || 0) + 1;
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

    // Return the count
    res.json({ views: data.views });
});


// ====== Static Files ======
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ====== Start Server ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running: http://localhost:${PORT}`));
