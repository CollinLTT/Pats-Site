require('dotenv').config(); // Load .env first
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcrypt');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const cloudinary = require('cloudinary').v2; // ✅ Added

const app = express();

// ====== Data File Setup ======
const DATA_FILE = path.join(__dirname, 'site-data.json');

// Initialize JSON file if missing
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
        tagline: "Welcome to Patz Brat!",
        views: 0,
        links: [
            { name: "OnlyFans", url: "https://onlyfans.com/", icon: "fa-brands fa-onlyfans", smallTagline: "Exclusive content" },
            { name: "Instagram", url: "https://instagram.com/", icon: "fab fa-instagram", smallTagline: "See my daily posts" },
            { name: "Twitter / X", url: "https://twitter.com/", icon: "fab fa-x-twitter", smallTagline: "Follow my updates" },
            { name: "TikTok", url: "https://tiktok.com/", icon: "fab fa-tiktok", smallTagline: "Fun clips here" }
        ],
        images: []
    }, null, 2));
}

// ====== Middleware ======
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ====== Persistent Session Setup (SQLite) ======
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.sqlite',
        dir: __dirname
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

// ====== Cloudinary Config ======
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ====== Multer Setup for Temporary Storage ======
const upload = multer({ dest: '/tmp' }); // ✅ Files stored in ephemeral /tmp

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

// ====== Upload & Gallery APIs (Cloudinary) ======
app.post('/admin/upload', requireLogin, upload.single('image'), async (req, res) => {
    try {
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'patz-brat-gallery' // Optional Cloudinary folder
        });

        console.log('Image uploaded to Cloudinary:', result.secure_url);

        // Update site-data.json with new image URL
        let data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        if (!data.images) data.images = [];
        data.images.push(result.secure_url);
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

        res.json({ success: true, url: result.secure_url });
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        res.status(500).json({ success: false, error: 'Upload failed' });
    }
});

app.get('/api/images', (req, res) => {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    res.json(data.images || []);
});

app.delete('/api/delete', requireLogin, async (req, res) => {
    try {
        const { url } = req.body; // URL sent in JSON
        if (!url) return res.status(400).json({ error: 'Image URL required' });

        let data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

        // Remove from site-data.json
        const index = data.images.indexOf(url);
        if (index === -1) return res.status(404).json({ error: 'Image not found' });

        data.images.splice(index, 1);
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

        // Extract Cloudinary public_id from URL
        // Example: https://res.cloudinary.com/<cloud>/image/upload/v1234/patz-brat-gallery/file.jpg
        const publicId = url
            .split('/')
            .slice(-2) // ["patz-brat-gallery","file.jpg"]
            .join('/')
            .replace(/\.[^/.]+$/, ""); // remove file extension

        console.log('Deleting Cloudinary file:', publicId);

        // Delete from Cloudinary
        await cloudinary.uploader.destroy(publicId);

        res.json({ success: true, removedUrl: url });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});


// --- Public route for website views ---
app.get('/api/views', (req, res) => {
    try {
        const countVisit = req.query.count === 'true';
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

        if (data.views === undefined) data.views = 0;

        if (countVisit) {
            data.views += 1;
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        }

        res.json({ views: data.views });
    } catch (err) {
        console.error('Error handling view count:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ====== Static Files ======
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ====== Start Server ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running: http://localhost:${PORT}`));
