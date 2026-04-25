const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Allow LAN access

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load words data
let wordsData;
try {
    const wordsContent = fs.readFileSync(path.join(__dirname, 'words.json'), 'utf8');
    wordsData = JSON.parse(wordsContent);
    console.log('✅ Words data loaded successfully');
} catch (error) {
    console.error('❌ Error loading words.json:', error);
    process.exit(1);
}

// API Routes

// Get all words
app.get('/api/words', (req, res) => {
    try {
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