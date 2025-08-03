require('dotenv').config(); // Load .env first
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcrypt');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');

const app = express();

// ====== MongoDB Setup ======
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Schema for Site Data
const siteDataSchema = new mongoose.Schema({
    tagline: { type: String, default: "💖 Welcome to Patz Brat 💖" },
    views: { type: Number, default: 0 },
    links: { type: Array, default: [] },
    images: { type: [String], default: [] }
});

// Only one document for your site
const SiteData = mongoose.model('SiteData', siteDataSchema);

async function getSiteData() {
    let data = await SiteData.findOne();
    if (!data) {
        data = await SiteData.create({});
    }
    return data;
}

// ====== Middleware ======
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ====== Persistent Session Setup (SQLite) ======
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

// ====== Multer Setup for Temporary Storage ======
const upload = multer({ dest: '/tmp' }); // Files stored in ephemeral /tmp

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
app.get('/api/site-data', async (req, res) => {
    const data = await getSiteData();
    res.json(data);
});

app.post('/api/update-site-data', requireLogin, async (req, res) => {
    let data = await getSiteData();
    data.tagline = req.body.tagline;
    data.links = req.body.links;
    await data.save();
    res.json({ success: true });
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

// ====== Upload & Gallery APIs (Cloudinary + MongoDB) ======
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
    const data = await getSiteData();
    res.json(data.images || []);
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
    const countVisit = req.query.count === 'true';
    const data = await getSiteData();
    if (countVisit) {
        data.views += 1;
        await data.save();
    }
    res.json({ views: data.views });
});

// ====== Static Files ======
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ====== Start Server ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running: http://localhost:${PORT}`));
