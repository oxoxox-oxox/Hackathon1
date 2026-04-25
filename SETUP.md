# VR Vocabulary Learning - Setup Guide

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the application:**
   ```bash
   npm start
   ```

This will start both the backend server (port 3000) and the frontend dev server (port 5173) simultaneously.

## Access Points

### Local Access
- **Frontend:** https://localhost:5173
- **Backend API:** http://localhost:3000
- **Health Check:** http://localhost:3000/health
- **Words API:** http://localhost:3000/api/words

### LAN Access

To access the application from other devices on your local network:

1. **Find your local IP address:**
   - Windows: Open Command Prompt and run `ipconfig`
   - macOS/Linux: Open Terminal and run `ifconfig` or `ip a`

2. **Access from other devices:**
   - **Frontend:** `https://YOUR_IP_ADDRESS:5173`
   - **Example:** `https://192.168.1.100:5173`

3. **SSL Certificate Warning:**
   - Since we're using a self-signed certificate, you'll see a security warning
   - Click "Advanced" → "Proceed to website" (unsafe)
   - This is normal for development purposes

## VR Setup

### Required Equipment
- VR Headset (Meta Quest, HTC Vive, etc.)
- Controllers for interaction

### Browser Requirements
- Chrome/Edge with WebXR support
- HTTPS connection (automatically provided)

### Using the VR Experience
1. Open the application in your browser
2. Click "进入 VR" (Enter VR) button
3. Put on your VR headset
4. Use controllers to interact with words and 3D models

## Interaction Guide

### Word Interaction
- **Click on word:** Shows word details and loads 3D model
- **Click on 3D model:** Shows related words' 3D models
- **Click "Next" button:** Advances to the next word

### Controller Buttons
- **Trigger:** Select/Click objects
- **Grip/Buttons:** Navigate in VR space

## API Endpoints

### Words API
- `GET /api/words` - Returns all words
- `GET /api/words/:word` - Returns specific word data

### Models API
- `GET /models/:filename` - Returns 3D model files

### Example API Call
```bash
curl http://localhost:3000/api/words
```

## Project Structure

```
Hackathon1/
├── server.js              # Express backend server
├── package.json           # Project dependencies
├── vite.config.js         # Vite configuration with SSL
├── index.html             # Frontend entry point
├── src/
│   └── main.js            # Main Three.js + WebXR implementation
├── model/                 # 3D models (GLB format)
│   ├── Skeleton_1.glb
│   ├── Skull_1.glb
│   ├── Organ_1.glb
│   ├── Tissue_1.glb
│   └── Artery_1.glb
├── words.json             # Word data
├── .env                   # Environment variables
└── SETUP.md              # This file
```

## Troubleshooting

### VR Not Working
- Ensure your browser supports WebXR
- Make sure you're using HTTPS
- Check if VR headset is properly connected

### LAN Access Issues
- Verify both devices are on the same network
- Check firewall settings (ports 3000 and 5173)
- Ensure SSL certificate is accepted on the accessing device

### Models Not Loading
- Check that model files exist in the `model/` directory
- Verify API endpoints are responding correctly
- Check browser console for errors

### Controller Issues
- Ensure controllers are properly paired
- Check that VR session is active
- Test in a standard WebXR environment first

## Development

### Backend Only
```bash
npm run server
```

### Frontend Only
```bash
npm run dev
```

### Both Together
```bash
npm start
```

## Technology Stack

- **Backend:** Node.js, Express
- **Frontend:** Three.js, WebXR API, Vite
- **3D Models:** GLB format
- **SSL:** @vitejs/plugin-basic-ssl

## Word Data Structure

Each word in `words.json` contains:
- `word`: English word
- `meaning`: Chinese translation
- `sceneA`: Description for 3D model generation
- `sceneB`: Alternative scene description

## 3D Model Naming Convention

Models are named as `{Word}_1.glb` (e.g., `Skeleton_1.glb`)

## Notes

- The application uses a self-signed SSL certificate for development
- LAN access requires accepting the security certificate on client devices
- VR experience requires compatible hardware and browser
- All interactions use controller raycasting for precise selection
- Models are automatically scaled and positioned for optimal viewing