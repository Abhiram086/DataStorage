// IMPORTING MODULES
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// MIDDLEWARE SETUP
app.use(cors());
app.use(express.json());

// DIRECTORY SETUP
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// --- SECURITY HELPER ---
const getSafePath = (targetPath) => {
    const safePath = path.normalize(path.join(uploadDir, targetPath || ''));
    if (!safePath.startsWith(uploadDir)) {
        throw new Error('Invalid path traversal detected');
    }
    return safePath;
};

// MULTER CONFIGURATION
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        try {
            // Because React now sends 'path' BEFORE 'file', req.body.path works perfectly!
            const folderPath = getSafePath(req.body.path || '');
            cb(null, folderPath);
        } catch (err) {
            cb(err);
        }
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// 1. UPLOAD ENDPOINT
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ message: 'File uploaded successfully!' });
});

// 2. LIST FILES & FOLDERS (For the Center View)
app.get('/api/files', (req, res) => {
    try {
        const currentPath = req.query.path || '';
        const targetDir = getSafePath(currentPath);

        if (!fs.existsSync(targetDir)) return res.json([]);

        fs.readdir(targetDir, (err, files) => {
            if (err) return res.status(500).json({ error: 'Unable to scan directory' });

            const fileData = files.map(filename => {
                const stats = fs.statSync(path.join(targetDir, filename));
                return {
                    name: filename,
                    size: stats.isDirectory() ? 0 : stats.size,
                    date: stats.mtime,
                    isDirectory: stats.isDirectory(),
                    path: path.posix.join(currentPath, filename)
                };
            });

            fileData.sort((a, b) => {
                if (a.isDirectory === b.isDirectory) return b.date - a.date;
                return a.isDirectory ? -1 : 1;
            });
            res.json(fileData);
        });
    } catch (error) {
        res.status(400).json({ error: 'Invalid path' });
    }
});

// 3. GET FULL FOLDER TREE (For the Right Sidebar)
app.get('/api/tree', (req, res) => {
    const getDirectoryTree = (dir, basePath = '') => {
        if (!fs.existsSync(dir)) return [];
        const items = fs.readdirSync(dir);
        let tree = [];
        
        items.forEach(item => {
            const fullPath = path.join(dir, item);
            const relativePath = path.posix.join(basePath, item);
            if (fs.statSync(fullPath).isDirectory()) {
                tree.push({
                    name: item,
                    path: relativePath,
                    children: getDirectoryTree(fullPath, relativePath)
                });
            }
        });
        return tree;
    };

    try {
        res.json([{ name: 'Home', path: '', children: getDirectoryTree(uploadDir) }]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate tree' });
    }
});

// 4. CREATE NEW FOLDER
app.post('/api/folder', (req, res) => {
    try {
        const { currentPath, folderName } = req.body;
        if (!folderName) return res.status(400).json({ error: 'Folder name required' });
        
        const newFolderPath = getSafePath(path.posix.join(currentPath || '', folderName));
        if (!fs.existsSync(newFolderPath)) {
            fs.mkdirSync(newFolderPath);
            res.json({ message: 'Folder created!' });
        } else {
            res.status(400).json({ error: 'Folder already exists' });
        }
    } catch (error) {
        res.status(400).json({ error: 'Invalid operation' });
    }
});

// 5. DELETE FILE OR FOLDER
app.delete('/api/delete', (req, res) => {
    try {
        const targetPath = getSafePath(req.body.path);
        if (targetPath === uploadDir) return res.status(400).json({ error: 'Cannot delete root directory' });

        if (fs.existsSync(targetPath)) {
            fs.rmSync(targetPath, { recursive: true, force: true });
        }
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: 'Failed to delete' });
    }
});

// 6. DOWNLOAD FILE
app.get('/api/download', (req, res) => {
    try {
        const targetPath = getSafePath(req.query.path);
        if (fs.statSync(targetPath).isDirectory()) {
            return res.status(400).json({ error: 'Cannot download whole folders yet' });
        }
        res.download(targetPath);
    } catch (error) {
        res.status(400).json({ error: 'File not found' });
    }
});

// 7. GET RECENT FILES GLOBALLY (New feature)
app.get('/api/recent', (req, res) => {
    const getAllFiles = (dir, basePath = '') => {
        if (!fs.existsSync(dir)) return [];
        let results = [];
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const relativePath = path.posix.join(basePath, item);
            const stats = fs.statSync(fullPath);
            
            if (stats.isDirectory()) {
                results = results.concat(getAllFiles(fullPath, relativePath));
            } else {
                results.push({
                    name: item,
                    size: stats.size,
                    date: stats.mtime,
                    isDirectory: false,
                    path: relativePath
                });
            }
        }
        return results;
    };

    try {
        let allFiles = getAllFiles(uploadDir);
        // Sort by newest modification date
        allFiles.sort((a, b) => b.date - a.date);
        // Return only the top 5 most recent files
        res.json(allFiles.slice(0, 5));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch recent files' });
    }
});

// START SERVER
app.listen(PORT, () => {
    console.log(`🚀 Storage Engine running on http://localhost:${PORT}`);
});