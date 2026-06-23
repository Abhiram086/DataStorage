// IMPORTING MODULES
const express = require('express');   // The web framework
const cors = require('cors');         // Cross-Origin Resource Sharing (lets React talk to Node)
const multer = require('multer');     // Middleware for handling multipart/form-data (file uploads)
const fs = require('fs');             // File System module (built into Node.js)
const path = require('path');         // Helps construct safe file paths

const app = express();
const PORT = 3001;

// MIDDLEWARE SETUP
// We need CORS so our React app on port 5173 can send requests to port 3001
app.use(cors());
app.use(express.json());

// DIRECTORY SETUP
// We create an 'uploads' folder inside the backend folder to store files
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// MULTER CONFIGURATION
// This tells Multer exactly where to save files and what to name them
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir); // Save to the 'uploads' folder
    },
    filename: function (req, file, cb) {
        // Add a timestamp to the file name so multiple files with the same name don't overwrite each other
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// UPLOAD ENDPOINT (POST)
// React sends the file here. Multer intercepts it, saves it, and then we return a success message.
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({ 
        message: 'File uploaded successfully!', 
        filename: req.file.filename,
        size: req.file.size
    });
});

// LIST FILES ENDPOINT (GET)
// React calls this to get an array of files to display in the UI.
app.get('/api/files', (req, res) => {
    fs.readdir(uploadDir, (err, files) => {
        if (err) return res.status(500).json({ error: 'Unable to scan directory' });

        // Map through files to get their sizes and creation dates using fs.statSync
        const fileData = files.map(filename => {
            const stats = fs.statSync(path.join(uploadDir, filename));
            return {
                name: filename,
                size: stats.size,
                date: stats.mtime
            };
        });

        // Sort by newest first
        fileData.sort((a, b) => b.date - a.date);
        res.json(fileData);
    });
});

// START SERVER
app.listen(PORT, () => {
    console.log(`🚀 Storage Engine running on http://localhost:${PORT}`);
});