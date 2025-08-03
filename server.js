require('dotenv').config(); // Load .env first
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcrypt');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');

const app = express();

// ====== MongoDB Setup ======
mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 30000, // Wait up to 30s for initial connection
})
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));


// Schema for Site Data
const siteDataSchema = new mongoose.Schema({
    tagline: { type: String, default: "💖 Welcome to Patz Brat 💖" },
    views: { type: Number, default: 0 },
    links: { type: Array, default: [] },
    images: { type: [String], default: [] }
});

const SiteData = mongoose.model('SiteData', siteDataSchema);

// Legacy JSON file path
const DATA_FILE = path.join(__dirname, 'site-data.json');

// ====== Auto-Migration on First Run ======
async function migrateLegacyData() {
    try {
        const existing = await SiteData.findOne();
        if (existing) {
            console.log('ℹ️ MongoDB already initialized, skipping migration.');
            return;
        }

        if (fs.existsSync(DATA_FILE)) {
            try {
                const legacyRaw = fs.readFileSync(DATA_FILE, 'utf8').trim();
                const legacy = legacyRaw ? JSON.parse(legacyRaw) : {};

                await SiteData.create({
                    tagline: legacy.tagline || "💖 Welcome to Patz Brat 💖",
                    views: legacy.views || 0,
                    links: legacy.links || [],
                    images: legacy.images || []
                });
                console.log('✅ Migrated site-data.json to MongoDB!');
            } catch (err) {
                console.error('⚠️ Failed to migrate site-data.json:', err);
                await SiteData.create({});
            }
        } else {
            await SiteData.create({});
            console.log('ℹ️ No legacy JSON found. Created empty site data in MongoDB.');
        }
    } catch (err) {
        console.error('❌ Migration failed:', err);
        // Ensure DB has a fallback document
        const existing = await SiteData.findOne();
        if (!existing) await SiteData.create({});
    }
}

// ====== Utility ======
async function getSiteData() {
    let data = await SiteData.findOne();
    if (!data) data = await SiteData.create({});
    return data;
}

// ====== Middleware ======
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ====== CSP Header for Security (allow fonts & cloudinary) ======
app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; " +
        "img-src 'self' data: https:; " +
        "style-src 'self' 'unsafe-inline' https:; " +
        "script-src 'self' 'unsafe-inline'; " +
        "font-src 'self' https: data:;"
    );
    next();
});

// ====== Session Setup ======
app.use(session({
    store: new SQLiteStore({ db: 'sessions.sqlite', dir: __dirname }),
    secret: process.env.SESSION_SECRET || 'fallback-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24,
        httpOnly: true,
        secure: false,
        sameSite: 'lax'
    }
}));

// ====== Cloudinary Config ======
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ====== Multer Setup (Ephemeral Storage) ======
const upload = multer({ dest: '/tmp' });

// ====== Auth Setup ======
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const DEFAULT_PASS = process.env.ADMIN_PASS || 'password123';
const ADMIN_HASH = process.env.ADMIN_HASH || bcrypt.hashSync(DEFAULT_PASS, 10);

function requireLogin(req, res, next) {
    if (!req.session.loggedIn) return res.redirect('/admin/login.html');
    next();
}

// ====== Auth Routes ======
app.get('/api/check-auth', (req, res) => {
    res.status(req.session.loggedIn ? 200 : 401).json({ loggedIn: !!req.session.loggedIn });
});

app.get('/admin/login', (req, res) => {
    res.redirect('/admin/login.html');
});

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

// ====== Site Data APIs ======
app.get('/api/site-data', async (req, res) => {
    try {
        const data = await getSiteData();
        res.json(data);
    } catch (err) {
        console.error('Error loading site-data:', err);
        res.status(500).json({ error: 'Failed to load site data' });
    }
});

app.post('/api/update-site-data', requireLogin, async (req, res) => {
    try {
        let data = await getSiteData();
        data.tagline = req.body.tagline;
        data.links = req.body.links;
        await data.save();
        res.json({ success: true });
    } catch (err) {
        console.error('Error saving site-data:', err);
        res.status(500).json({ success: false, error: 'Save failed' });
    }
});

// ====== Upload & Gallery APIs ======
app.post('/admin/upload', requireLogin, upload.single('image'), async (req, res) => {
    try {
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'patz-brat-gallery'
        });

        console.log('Image uploaded to Cloudinary:', result.secure_url);

        let data = await getSiteData();
        data.images.push(result.secure_url);
        await data.save();

        res.json({ success: true, url: result.secure_url });
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        res.status(500).json({ success: false, error: 'Upload failed' });
    }
});

app.get('/api/images', async (req, res) => {
    try {
        const data = await getSiteData();
        res.json(data.images || []);
    } catch (err) {
        console.error('Error loading images:', err);
        res.status(500).json({ error: 'Failed to load images' });
    }
});

app.delete('/api/delete', requireLogin, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'Image URL required' });

        const data = await getSiteData();
        const index = data.images.indexOf(url);
        if (index === -1) return res.status(404).json({ error: 'Image not found' });

        data.images.splice(index, 1);
        await data.save();

        const publicId = url.split('/').slice(-2).join('/').replace(/\.[^/.]+$/, "");
        console.log('Deleting Cloudinary file:', publicId);
        await cloudinary.uploader.destroy(publicId);

        res.json({ success: true, removedUrl: url });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

// ====== View Counter ======
app.get('/api/views', async (req, res) => {
    try {
        const countVisit = req.query.count === 'true';
        const data = await getSiteData();
        if (countVisit) {
            data.views += 1;
            await data.save();
        }
        res.json({ views: data.views });
    } catch (err) {
        console.error('Error fetching view count:', err);
        res.status(500).json({ views: 0 });
    }
});

// ====== Static Files ======
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ====== Start Server ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`✅ Server running: http://localhost:${PORT}`);
    await migrateLegacyData(); // Auto-import legacy site-data.json
});
