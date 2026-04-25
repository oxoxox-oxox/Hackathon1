const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Allow LAN access
const wordsFilePath = path.join(__dirname, 'words.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function loadWordsData() {
    const wordsContent = fs.readFileSync(wordsFilePath, 'utf8');
    return JSON.parse(wordsContent);
}

try {
    const wordsData = loadWordsData();
    console.log(`✅ Words data loaded successfully (${wordsData.length} words)`);
} catch (error) {
    console.error('❌ Error loading words.json:', error);
    process.exit(1);
}

// API Routes

// Get all words
app.get('/api/words', (req, res) => {
    try {
        // Add cache control headers to prevent browser caching
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        const wordsData = loadWordsData();
        res.json({
            success: true,
            data: wordsData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve words data'
        });
    }
});

// Get specific word
app.get('/api/words/:word', (req, res) => {
    try {
        // Add cache control headers to prevent browser caching
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        const wordsData = loadWordsData();
        const word = req.params.word;
        const wordData = wordsData.find(w => w.word.toLowerCase() === word.toLowerCase());

        if (!wordData) {
            return res.status(404).json({
                success: false,
                error: 'Word not found'
            });
        }

        res.json({
            success: true,
            data: wordData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve word data'
        });
    }
});

// Serve 3D models
app.get('/models/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(__dirname, 'model', filename);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: 'Model not found'
            });
        }

        // Set appropriate headers for GLB files
        res.setHeader('Content-Type', 'model/gltf-binary');
        res.sendFile(filePath);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to load model'
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    // Add cache control headers to prevent browser caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const wordsData = loadWordsData();
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        wordsCount: wordsData.length
    });
});

// Start server
app.listen(PORT, HOST, () => {
    console.log(`
╔════════════════════════════════════════════╗
║   🚀 Server Started Successfully!          ║
╠════════════════════════════════════════════╣
║   📡 Server Address: http://${HOST}:${PORT}       ║
║   🔗 API Endpoint:  http://localhost:${PORT}/api/words  ║
║   📝 Health Check:  http://localhost:${PORT}/health    ║
╚════════════════════════════════════════════╝
    `);
    console.log(`🌐 LAN access enabled. Other devices can connect using your local IP address.`);
});