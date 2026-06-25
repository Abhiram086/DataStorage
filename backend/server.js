const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp'); 
const { pool, initDB } = require('./db');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// GLOBAL TRAFFIC LOGGER
app.use((req, res, next) => {
    console.log(`➡️  [${req.method}] ${req.url}`);
    next();
});

initDB();

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname); 
    }
});
const upload = multer({ storage: storage });

// 1. UPLOAD ENDPOINT
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    try {
        const folderPath = req.body.path || '';
        await pool.query(
            `INSERT INTO files (name, physical_name, folder_path, size, is_directory) VALUES ($1, $2, $3, $4, false)`,
            [req.file.originalname, req.file.filename, folderPath, req.file.size]
        );
        res.json({ message: 'File uploaded successfully!' });
    } catch (err) {
        res.status(500).json({ error: 'Database insert failed' });
    }
});

// 2. LIST FILES & FOLDERS
app.get('/api/files', async (req, res) => {
    try {
        const currentPath = req.query.path || '';
        const result = await pool.query(
            `SELECT * FROM files WHERE folder_path = $1 AND in_trash = false`,
            [currentPath]
        );
        const fileData = result.rows.map(row => ({
            id: row.id, name: row.name, size: parseInt(row.size), date: row.created_at,
            isDirectory: row.is_directory, path: currentPath === '' ? row.name : `${currentPath}/${row.name}`
        }));
        fileData.sort((a, b) => {
            if (a.isDirectory === b.isDirectory) return new Date(b.date) - new Date(a.date);
            return a.isDirectory ? -1 : 1;
        });
        res.json(fileData);
    } catch (error) {
        res.status(500).json({ error: 'Database query failed' });
    }
});

// 3. GET FULL FOLDER TREE
app.get('/api/tree', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM files WHERE is_directory = true AND in_trash = false`);
        const allFolders = result.rows;
        const buildTree = (folderPath) => {
            return allFolders.filter(f => f.folder_path === folderPath).map(f => {
                const thisPath = folderPath === '' ? f.name : `${folderPath}/${f.name}`;
                return { name: f.name, path: thisPath, children: buildTree(thisPath) };
            });
        };
        res.json([{ name: 'Home', path: '', children: buildTree('') }]);
    } catch (error) {
        res.status(500).json({ error: 'Tree generation failed' });
    }
});

// 4. CREATE NEW VIRTUAL FOLDER
app.post('/api/folder', async (req, res) => {
    try {
        const { currentPath, folderName } = req.body;
        if (!folderName) return res.status(400).json({ error: 'Folder name required' });
        const check = await pool.query(
            `SELECT id FROM files WHERE name = $1 AND folder_path = $2 AND is_directory = true AND in_trash = false`,
            [folderName, currentPath || '']
        );
        if (check.rows.length > 0) return res.status(400).json({ error: 'Folder already exists' });
        await pool.query(
            `INSERT INTO files (name, folder_path, is_directory) VALUES ($1, $2, true)`,
            [folderName, currentPath || '']
        );
        res.json({ message: 'Folder created in DB!' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create folder' });
    }
});

// 5. DELETE (Move to Trash)
app.delete('/api/delete', async (req, res) => {
    try {
        const targetPath = req.body.path;
        if (!targetPath) return res.status(400).json({ error: 'Path required' });
        const parts = targetPath.split('/');
        const name = parts.pop();
        const folderPath = parts.join('/');
        await pool.query(
            `UPDATE files SET in_trash = true WHERE (name = $1 AND folder_path = $2) OR folder_path LIKE $3`,
            [name, folderPath, `${targetPath}/%`]
        );
        res.json({ message: 'Moved to trash' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete' });
    }
});

// 6. DOWNLOAD & VIEW
app.get('/api/download', async (req, res) => { handleFileRequest(req, res, true); });
app.get('/api/view', async (req, res) => { handleFileRequest(req, res, false); });

async function handleFileRequest(req, res, isDownload) {
    try {
        const targetPath = req.query.path;
        const parts = targetPath.split('/');
        const name = parts.pop();
        const folderPath = parts.join('/');
        const result = await pool.query(
            `SELECT physical_name, is_directory FROM files WHERE name = $1 AND folder_path = $2`,
            [name, folderPath]
        );
        if (result.rows.length === 0 || result.rows[0].is_directory) return res.status(404).json({ error: 'File not found' });
        const physicalPath = path.join(uploadDir, result.rows[0].physical_name);
        if (isDownload) res.download(physicalPath, name); 
        else res.sendFile(physicalPath);
    } catch (error) {
        res.status(500).json({ error: 'Request failed' });
    }
}

// 7. RECENT 
app.get('/api/recent', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM files WHERE is_directory = false AND in_trash = false ORDER BY created_at DESC LIMIT 50`);
        const fileData = result.rows.map(row => ({
            name: row.name, size: parseInt(row.size), date: row.created_at, isDirectory: false,
            path: row.folder_path === '' ? row.name : `${row.folder_path}/${row.name}`
        }));
        res.json(fileData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch recent files' });
    }
});

// 8. THUMBNAIL GENERATOR (High Quality)
app.get('/api/thumbnail', async (req, res) => {
    try {
        const targetPath = req.query.path;
        const parts = targetPath.split('/');
        const name = parts.pop();
        const folderPath = parts.join('/');

        const result = await pool.query(
            `SELECT physical_name FROM files WHERE name = $1 AND folder_path = $2 AND is_directory = false`,
            [name, folderPath]
        );
        if (result.rows.length === 0) return res.status(404).send('Not found');

        const physicalPath = path.join(uploadDir, result.rows[0].physical_name);
        const ext = name.split('.').pop().toLowerCase();
        
        if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
            res.type(`image/${ext === 'jpg' ? 'jpeg' : ext}`);
            // UPGRADED: 500x500 resolution, 90% quality for crisp thumbnails
            const transform = sharp(physicalPath).resize(500, 500, { fit: 'cover' }).jpeg({ quality: 90 });
            transform.pipe(res);
        } else {
            res.sendFile(physicalPath); 
        }
    } catch (error) {
        res.status(500).json({ error: 'Thumbnail failed' });
    }
});

// 9. SEARCH ENDPOINT (Upgraded to return full UI data)
app.get('/api/search', async (req, res) => {
    try {
        const q = req.query.q;
        if (!q) return res.json([]);
        const result = await pool.query(
            `SELECT * FROM files WHERE name ILIKE $1 AND in_trash = false LIMIT 50`,
            [`%${q}%`]
        );
        const fileData = result.rows.map(row => ({
            name: row.name, 
            size: parseInt(row.size) || 0,
            date: row.created_at,
            isDirectory: row.is_directory,
            folderPath: row.folder_path,
            path: row.folder_path === '' ? row.name : `${row.folder_path}/${row.name}`
        }));
        res.json(fileData);
    } catch (error) {
        res.status(500).json({ error: 'Search failed' });
    }
});

// 10. TRASH MANAGEMENT
app.get('/api/trash', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM files WHERE in_trash = true ORDER BY created_at DESC`);
        const fileData = result.rows.map(row => ({
            name: row.name, size: parseInt(row.size), date: row.created_at, isDirectory: row.is_directory,
            path: row.folder_path === '' ? row.name : `${row.folder_path}/${row.name}`
        }));
        res.json(fileData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch trash' });
    }
});

app.post('/api/restore', async (req, res) => {
    try {
        const targetPath = req.body.path;
        const parts = targetPath.split('/');
        const name = parts.pop();
        const folderPath = parts.join('/');
        await pool.query(`UPDATE files SET in_trash = false WHERE (name = $1 AND folder_path = $2) OR folder_path LIKE $3`, 
            [name, folderPath, `${targetPath}/%`]);
        res.json({ message: 'Restored' });
    } catch (error) {
        res.status(500).json({ error: 'Restore failed' });
    }
});

app.delete('/api/empty-trash', async (req, res) => {
    try {
        const files = await pool.query(`SELECT physical_name FROM files WHERE in_trash = true AND is_directory = false`);
        files.rows.forEach(row => {
            const p = path.join(uploadDir, row.physical_name);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        });
        await pool.query(`DELETE FROM files WHERE in_trash = true`);
        res.json({ message: 'Trash emptied permanently' });
    } catch (error) {
        res.status(500).json({ error: 'Empty trash failed' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Storage Engine running on http://localhost:${PORT}`);
});