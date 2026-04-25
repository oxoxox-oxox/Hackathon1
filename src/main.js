import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';

class VRVocabularyApp {
    constructor() {
        this.state = 'model';
        this.hasAnswered = false;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controller1 = null;
        this.controller2 = null;
        this.raycaster = new THREE.Raycaster();
        this.glftLoader = new GLTFLoader();
        this.fontLoader = new FontLoader();

        this.currentWordIndex = 0;
        this.wordsData = [];
        this.currentWordModel = null;
        this.relatedWordsModels = [];
        this.interactionState = 'word'; // 'word' or 'model'

        // Model state management for folder-based models
        this.currentModelIndex = 0; // tracks first (0) or second (1) model
        this.isSecondModel = false; // tracks if currently showing second model
        this.hasFolderStructure = {}; // cache which words have folder structures


        this.wordObjects = [];
        this.modelObjects = [];
        this.uiElements = [];

        // Debug information
        this.debugInfo = {
            controllersConnected: false,
            controllersActive: 0,
            vrSessionActive: false,
            lastInteraction: null,
            currentWord: null
        };

        this.isLoading = true;
        this.font = null;

        // Debounce timing to prevent multiple button triggers
        this.lastClickTime = 0;
        this.clickDebounceTime = 500; // 500ms minimum between clicks

        this.init();
    }

    async init() {
        this.setupScene();
        this.setupLights();
        this.setupControllers();
        this.setupXR();

        // ❗必须等待数据
        await this.loadWordsData();
        await this.loadFont();

        this.setupUI();

        await this.startFirstWord(); // ❗也建议 await

        this.hideLoadingScreen();
        this.animate();
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 1.6, 3);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.xr.enabled = true;

        document.getElementById('canvas-container').appendChild(this.renderer.domElement);

        // Add a floor
        const floorGeometry = new THREE.PlaneGeometry(20, 20);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x2d2d2d,
            roughness: 0.8
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        this.scene.add(floor);
    }

    setupLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7);
        this.scene.add(directionalLight);

        // Point lights for better model lighting
        const pointLight1 = new THREE.PointLight(0x667eea, 1, 10);
        pointLight1.position.set(2, 3, 2);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x764ba2, 1, 10);
        pointLight2.position.set(-2, 3, 2);
        this.scene.add(pointLight2);
    }

    setupControllers() {
        // Controller 1
        this.controller1 = this.renderer.xr.getController(0);
        this.controller1.addEventListener('select', this.onControllerSelect.bind(this));
        this.controller1.addEventListener('selectstart', this.onControllerSelectStart.bind(this));
        this.scene.add(this.controller1);

        // Controller 2
        this.controller2 = this.renderer.xr.getController(1);
        this.controller2.addEventListener('select', this.onControllerSelect.bind(this));
        this.controller2.addEventListener('selectstart', this.onControllerSelectStart.bind(this));
        this.scene.add(this.controller2);

        // Add controller lines for visual feedback
        const controllerGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -5)
        ]);
        const controllerMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });

        const line1 = new THREE.Line(controllerGeometry, controllerMaterial);
        line1.name = 'line';
        this.controller1.add(line1.clone());

        const line2 = new THREE.Line(controllerGeometry, controllerMaterial);
        line2.name = 'line';
        this.controller2.add(line2.clone());

        // Add controller model for visual feedback
        const controllerModel1 = this.renderer.xr.getControllerGrip(0);
        this.scene.add(controllerModel1);

        const controllerModel2 = this.renderer.xr.getControllerGrip(1);
        this.scene.add(controllerModel2);

        // Monitor controller connection
        this.renderer.xr.addEventListener('sessionstart', () => {
            console.log('VR Session started');
            this.debugInfo.vrSessionActive = true;
            this.updateDebugPanel();
        });

        this.renderer.xr.addEventListener('sessionend', () => {
            console.log('VR Session ended');
            this.debugInfo.vrSessionActive = false;
            this.updateDebugPanel();
        });

        // Check controller connection status
        const checkControllers = () => {
            let connectedControllers = 0;
            if (this.controller1) connectedControllers++;
            if (this.controller2) connectedControllers++;

            this.debugInfo.controllersActive = connectedControllers;
            this.debugInfo.controllersConnected = connectedControllers > 0;
            this.updateDebugPanel();
        };

        // Initial check and periodic monitoring
        checkControllers();
        setInterval(checkControllers, 1000);

        console.log('Controllers setup complete');
    }

    setupXR() {
        const vrButton = document.getElementById('vr-button');

        if (navigator.xr) {
            navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
                if (supported) {
                    vrButton.addEventListener('click', async () => {
                        console.log('VR button clicked, starting session...');

                        try {
                            // Request VR session
                            const session = await navigator.xr.requestSession('immersive-vr', {
                                optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
                            });

                            console.log('VR session started:', session);
                            await this.renderer.xr.setSession(session);

                            // Hide VR button after successful connection
                            vrButton.style.display = 'none';
                            document.getElementById('info-panel').style.display = 'none';

                            // Show debug panel in VR
                            this.debugInfo.vrSessionActive = true;
                            this.updateDebugPanel();

                        } catch (error) {
                            console.error('Failed to start VR session:', error);
                            alert('无法启动VR会话: ' + error.message);
                        }
                    });
                } else {
                    vrButton.disabled = true;
                    vrButton.textContent = 'VR not supported';
                    console.log('VR not supported');
                }
            });
        } else {
            vrButton.disabled = true;
            vrButton.textContent = 'WebXR not available';
            console.log('WebXR not available');
        }
    }

    async loadWordsData() {
        try {
            const response = await fetch('/api/words');
            const result = await response.json();

            if (result.success && Array.isArray(result.data)) {
                this.wordsData = result.data;
            } else {
                console.error('words data invalid');
                this.wordsData = [];
            }

        } catch (error) {
            console.error('Error loading words data:', error);
            this.wordsData = [];
        }
    }

    async loadFont() {
        return new Promise((resolve, reject) => {
            this.fontLoader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
                (font) => {
                    this.font = font;
                    console.log('Font loaded successfully');
                    resolve();
                },
                undefined,
                (error) => {
                    console.error('Error loading font:', error);
                    reject(error);
                }
            );
        });
    }

    setupUI() {
        // Create VR UI elements
        this.createVRUI();
    }

    createVRUI() {
        // Create "Next" button in VR
        const buttonGeometry = new THREE.BoxGeometry(0.5, 0.2, 0.1);
        const buttonMaterial = new THREE.MeshStandardMaterial({
            color: 0x667eea,
            roughness: 0.3
        });
        this.IKonwButton = new THREE.Mesh(buttonGeometry, buttonMaterial);
        this.IKonwButton.position.set(-0.8, 1, -2);
        this.IKonwButton.userData.type = 'I-know-button';
        this.scene.add(this.IKonwButton);

        this.NotSureButton = new THREE.Mesh(buttonGeometry, buttonMaterial);
        this.NotSureButton.position.set(0, 1.2, -2);
        this.NotSureButton.userData.type = 'not-sure-button';
        this.scene.add(this.NotSureButton);

        this.ForgetButton = new THREE.Mesh(buttonGeometry, buttonMaterial);
        this.ForgetButton.position.set(0.8, 1, -2);
        this.ForgetButton.userData.type = 'forget-button';
        this.scene.add(this.ForgetButton);

        this.NextButton = new THREE.Mesh(buttonGeometry, buttonMaterial);
        this.NextButton.position.set(0, 0.8, -2);
        this.NextButton.userData.type = 'next-button';
        this.scene.add(this.NextButton);

        this.NextButton.visible = false; // Initially hidden

        // Add "Next" text
        const createLabel = (text, x, y) => {
            const geo = new TextGeometry(text, {
                font: this.font,
                size: 0.05,
                height: 0.01
            });

            const mesh = new THREE.Mesh(
                geo,
                new THREE.MeshStandardMaterial({ color: 0xffffff })
            );

            mesh.position.set(x, y, -2);
            this.scene.add(mesh);
            this.uiElements.push(mesh);
        };

        createLabel('Know', -0.8, 1.2);
        createLabel('Unsure', 0, 1.4);
        createLabel('Forget', 0.8, 1.2);

        this.uiElements.push(
            this.IKonwButton,
            this.NotSureButton,
            this.ForgetButton,
            this.NextButton
        );
    }

    async startFirstWord() {
        if (!this.font) {
            console.warn('Font not loaded yet');
            return;
        }

        if (this.wordsData.length === 0) {
            console.error('No words data available');
            return;
        }

        this.currentWordIndex = 0;
        await this.displayWord(this.wordsData[0]);

        // Ensure the word is visible by waiting a bit for rendering
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('First word displayed:', this.wordsData[0].word);
    }

    async displayWord(wordData) {
        this.clearScene();
        this.interactionState = 'word';

        // Create word display
        await this.createWordDisplay(wordData);

        // Update info panel
        this.updateInfoPanel(wordData);
    }

    async createWordDisplay(wordData) {
        // Create 3D text for the word
        if (this.font) {
            const textGeometry = new TextGeometry(wordData.word, {
                font: this.font,
                size: 0.3,
                height: 0.05,
                curveSegments: 12,
                bevelEnabled: true,
                bevelThickness: 0.01,
                bevelSize: 0.01,
                bevelSegments: 5
            });

            const textMaterial = new THREE.MeshStandardMaterial({
                color: 0x667eea,
                roughness: 0.3
            });
            const textMesh = new THREE.Mesh(textGeometry, textMaterial);
            textMesh.position.set(0, 2, -2);
            textMesh.userData.type = 'word';
            textMesh.userData.wordData = wordData;
            this.scene.add(textMesh);
            this.wordObjects.push(textMesh);
        }
    }

    async loadAndDisplayModel(modelName, modelIndex = 0) {
        try {
            let modelUrl;

            // Check if word has folder structure
            const hasFolder = this.checkFolderStructure(modelName);

            if (hasFolder) {
                // Load from folder structure: /models/Word/Word1.glb or /models/Word/Word2.glb
                modelUrl = `/models/${modelName}/${modelName}${modelIndex + 1}.glb`;
                console.log(`Loading folder-based model ${modelIndex + 1}:`, modelUrl);
            } else {
                // Load single file structure: /models/Word_1.glb
                modelUrl = `/models/${modelName}_1.glb`;
                console.log('Loading single file model:', modelUrl);
            }

            const gltf = await this.glftLoader.loadAsync(modelUrl);
            const model = gltf.scene;

            // Scale and position the model
            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 1.5 / maxDim;
            model.scale.set(scale, scale, scale);

            model.position.set(0, 3, -3);
            model.rotation.y = 0;

            model.userData.type = '3d-model';
            model.userData.modelName = modelName;
            model.userData.modelIndex = modelIndex;
            model.userData.isSecondModel = modelIndex === 1;
            model.userData.hasFolderStructure = hasFolder;

            this.scene.add(model);
            this.currentWordModel = model;
            this.modelObjects.push(model);

            // Update model state
            this.currentModelIndex = modelIndex;
            this.isSecondModel = modelIndex === 1;

            console.log(`Model loaded successfully (index ${modelIndex}, second model: ${this.isSecondModel})`);
            return model;
        } catch (error) {
            console.error('Error loading model:', error);
            return null;
        }
    }

    checkFolderStructure(word) {
        // Check if this word has a folder structure (multiple models)
        const folderBasedWords = ['Transform', 'Shatter'];
        return folderBasedWords.includes(word);
    }

    async displayRelatedWords(wordData) {
        const relatedWords = this.wordsData.filter(w => w.word !== wordData.word);

        for (let i = 0; i < relatedWords.length && i < 4; i++) {
            const relatedWord = relatedWords[i];
            const angle = (i / Math.min(relatedWords.length, 4)) * Math.PI * 2;
            const radius = 1.5;

            const position = new THREE.Vector3(
                Math.sin(angle) * radius,
                1.5,
                -3 + Math.cos(angle) * radius
            );

            // Load related word model
            const model = await this.loadAndDisplayModel(relatedWord.word);
            if (model) {
                model.position.copy(position);
                model.scale.multiplyScalar(0.5); // Smaller scale for related words
                model.userData.relatedWord = relatedWord;
            }
        }
    }

    updateInfoPanel(wordData) {
        const panel = document.getElementById('info-panel');
        const title = document.getElementById('word-title');
        const meaning = document.getElementById('word-meaning');
        const scene = document.getElementById('word-scene');

        title.textContent = wordData.word;
        meaning.textContent = `含义: ${wordData.meaning}`;
        scene.textContent = `场景A: ${wordData.sceneA}`;

        panel.style.display = 'block';

        // Update debug info
        this.debugInfo.currentWord = wordData.word;
        this.updateDebugPanel();
    }

    updateDebugPanel() {
        const debugPanel = document.getElementById('debug-panel');
        const debugInfo = document.getElementById('debug-info');

        const info = `
Controllers: ${this.debugInfo.controllersActive}/2 connected
VR Session: ${this.debugInfo.vrSessionActive ? 'Active' : 'Inactive'}
Current Word: ${this.debugInfo.currentWord || 'None'}
Last Action: ${this.debugInfo.lastInteraction || 'None'}
Interaction State: ${this.interactionState}
        `;

        debugInfo.textContent = info.trim();
        debugPanel.style.display = 'block';

        // Auto-hide after 5 seconds of no activity
        clearTimeout(this.debugTimeout);
        this.debugTimeout = setTimeout(() => {
            debugPanel.style.display = 'none';
        }, 5000);
    }

    clearScene() {
        // Remove word objects
        this.wordObjects.forEach(obj => {
            this.scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });
        this.wordObjects = [];

        // Remove model objects
        this.modelObjects.forEach(obj => {
            this.scene.remove(obj);
        });
        this.modelObjects = [];

        this.currentWordModel = null;

        // Reset model state variables
        this.currentModelIndex = 0;
        this.isSecondModel = false;
    }

    onControllerSelect(event) {
        const controller = event.target;

        // Debounce check to prevent multiple rapid triggers
        const currentTime = Date.now();
        if (currentTime - this.lastClickTime < this.clickDebounceTime) {
            console.log('Click ignored - too soon since last click');
            return;
        }
        this.lastClickTime = currentTime;

        console.log('Controller select event detected from:', controller.id);
        this.debugInfo.lastInteraction = 'Controller Click';
        this.updateDebugPanel();

        // Create direction vector from controller
        const tempMatrix = new THREE.Matrix4();
        tempMatrix.extractRotation(controller.matrixWorld);

        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyMatrix4(tempMatrix);

        // Set up raycaster from controller position and direction
        this.raycaster.set(controller.position, direction);

        // Get all interactable objects (excluding word objects to prevent raycasting issues)
        const interactableObjects = [
            ...this.modelObjects,
            ...this.uiElements
        ];

        console.log('Interactable objects:', interactableObjects.length);

        const intersections = this.raycaster.intersectObjects(interactableObjects, true);
        console.log('Intersections found:', intersections.length);

        if (intersections.length > 0) {
            this.state = 'model';
            const object = intersections[0].object;
            console.log('Hit object type:', object.userData.type);

            if (object.userData.type === 'I-know-button') {
                console.log('I Know button clicked - moving to next word directly');
                this.debugInfo.lastInteraction = 'I Know Button Click';
                this.nextWord(); // Go directly to next word
            } else if (object.userData.type === 'not-sure-button') {
                this.state = 'unsure';
                console.log('Not Sure button clicked - switching to Unsure state');
                this.debugInfo.lastInteraction = 'Not Sure Button Click';
                this.handleNeedModel(); // Show model
            }
            else if (object.userData.type === 'forget-button') {
                this.state = 'forget';
                console.log('Forget button clicked - switching to Forget state');
                this.debugInfo.lastInteraction = 'Forget Button Click';
                this.handleNeedModel(); // Show model
            }
            else if (object.userData.type === 'next-button') {
                console.log('Next button clicked - moving to next word');
                this.debugInfo.lastInteraction = 'Next Button Click';
                this.nextWord(); // Go to next word
            }
            else if (object.userData.type === 'word') {
                console.log('Word clicked - ignoring per requirements');
                this.debugInfo.lastInteraction = 'Word Click (Ignored)';
                // Word clicking is disabled per requirements - no action taken
            } else if (object.userData.type === '3d-model') {
                console.log('3D model clicked');
                this.debugInfo.lastInteraction = 'Model Click';
                this.onModelClick(object);
            }
        } else {
            console.log('No intersection detected - pointing into empty space');
        }

        this.updateDebugPanel();
    }

    async handleNeedModel() {
        if (this.hasAnswered) return;

        this.hasAnswered = true;

        const wordData = this.wordsData[this.currentWordIndex];

        // Step 1: Hide all three buttons first
        this.IKonwButton.visible = false;
        this.NotSureButton.visible = false;
        this.ForgetButton.visible = false;

        // Step 2: Clear the scene (remove word and any existing models)
        this.clearScene();

        // Step 3: Load and display the model
        await this.loadAndDisplayModel(wordData.word);

        // Step 4: Show the Next button
        this.NextButton.visible = true;

        console.log('Model loaded and Next button shown for word:', wordData.word);
    }

    async onModelClick(modelObject) {
        const modelName = modelObject.userData.modelName;
        const hasFolder = modelObject.userData.hasFolderStructure;
        const currentModelIndex = modelObject.userData.modelIndex;

        console.log(`Model clicked: ${modelName}, has folder: ${hasFolder}, current index: ${currentModelIndex}`);

        if (hasFolder) {
            if (currentModelIndex === 0) {
                // First model clicked - switch to second model
                console.log('First model clicked - switching to second model');

                // Remove the first model
                this.scene.remove(modelObject);
                const index = this.modelObjects.indexOf(modelObject);
                if (index > -1) {
                    this.modelObjects.splice(index, 1);
                }

                // Clear resources
                if (modelObject.geometry) modelObject.geometry.dispose();
                if (modelObject.material) {
                    if (Array.isArray(modelObject.material)) {
                        modelObject.material.forEach(m => m.dispose());
                    } else {
                        modelObject.material.dispose();
                    }
                }

                // Load and display the second model
                await this.loadAndDisplayModel(modelName, 1);

                console.log('Switched to second model for word:', modelName);
            } else {
                // Second model clicked - should not be clickable
                console.log('Second model clicked - ignoring per requirements');
                this.debugInfo.lastInteraction = 'Second Model Click (Ignored)';
            }
        } else {
            // Single file model clicked - log but no action needed
            console.log('Single file model clicked - no action required');
            this.debugInfo.lastInteraction = 'Single Model Click';
        }
    }

    onControllerSelectStart(event) {
        console.log('Controller select start event');
        this.debugInfo.lastInteraction = 'Controller Press Start';
        this.updateDebugPanel();
        // This method is kept for compatibility
        this.onControllerSelect(event);
    }

    // onWordClick method has been removed per requirements - word clicking is disabled

    async showRelatedWords(wordData) {
        // Remove current model and show related words' models
        this.clearScene();

        // Display related words' models
        await Promise.all(
            relatedWords.map(w => this.loadAndDisplayModel(w.word))
        );
    }

    async nextWord() {

        this.hasAnswered = false;

        // Step 1: Reset state for new word
        this.state = 'remember';

        // Step 2: Hide Next button
        this.NextButton.visible = false;

        // Step 3: Force cleanup of previous word's models and text
        this.clearScene();

        // Step 4: Move to next word (with wraparound)
        this.currentWordIndex =
            (this.currentWordIndex + 1) % this.wordsData.length;

        const nextWord = this.wordsData[this.currentWordIndex];

        // Step 5: Display the new word
        await this.displayWord(nextWord);

        // Step 6: Show all three buttons (Know, Unsure, Forget)
        this.IKonwButton.visible = true;
        this.NotSureButton.visible = true;
        this.ForgetButton.visible = true;

        console.log('Advanced to next word:', nextWord.word);
    }

    hideLoadingScreen() {
        setTimeout(() => {
            const loadingScreen = document.getElementById('loading-screen');
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }, 1000);
    }

    animate() {
        this.renderer.setAnimationLoop(this.render.bind(this));
    }

    render() {
        // Rotate models slightly for visual effect
        this.modelObjects.forEach(model => {
            if (!model.userData.relatedWord) {
                model.rotation.y += 0.005;
            }
        });

        // Update raycaster positions
        this.updateRaycasters();

        this.renderer.render(this.scene, this.camera);
    }

    updateRaycasters() {
        // Update raycasters from controllers
        const controllers = [this.controller1, this.controller2];

        controllers.forEach(controller => {
            if (controller && controller.position) {
                // Create direction vector from controller rotation
                const tempMatrix = new THREE.Matrix4();
                tempMatrix.extractRotation(controller.matrixWorld);

                const direction = new THREE.Vector3(0, 0, -1);
                direction.applyMatrix4(tempMatrix);

                // Set raycaster from controller position and direction
                this.raycaster.set(controller.position, direction);

                // Visual feedback - highlight objects under cursor (excluding word objects)
                const interactableObjects = [
                    ...this.modelObjects,
                    ...this.uiElements
                ];

                const intersections = this.raycaster.intersectObjects(interactableObjects, true);

                // Reset all object materials
                interactableObjects.forEach(obj => {
                    if (obj.material && obj.material.emissive) {
                        obj.material.emissive.setHex(0x000000);
                    }
                });

                // Highlight hovered objects
                intersections.forEach(intersection => {
                    if (intersection.object.material && intersection.object.material.emissive) {
                        intersection.object.material.emissive.setHex(0x333333);
                    }
                });
            }
        });
    }
}

// Initialize the app when the page loads
window.addEventListener('load', () => {
    const app = new VRVocabularyApp();
    console.log('VR Vocabulary Learning App initialized');
});

// Handle window resize
window.addEventListener('resize', () => {
    // Handle resize if needed
});

