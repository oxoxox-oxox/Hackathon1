import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';

class VRVocabularyApp {
    constructor() {
        this.state = 'remember';
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

        this.init();
    }

    async init() {
        this.setupScene();
        this.setupLights();
        this.setupControllers();
        this.setupXR();
        this.loadWordsData();
        await this.loadFont();
        this.setupUI();
        this.startFirstWord();
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
            if (result.success) {
                this.wordsData = result.data;
                console.log('Words data loaded:', this.wordsData);
            }
        } catch (error) {
            console.error('Error loading words data:', error);
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
        this.NextButton.position.set(-0.8, 1, -2);
        this.NextButton.userData.type = 'next-button';
        this.scene.add(this.NextButton);

        this.NextButton.visible = false; // Initially hidden

        // Add "Next" text
        const createLabel = (text, x) => {
            const geo = new TextGeometry(text, {
                font: this.font,
                size: 0.05,
                height: 0.01
            });

            const mesh = new THREE.Mesh(
                geo,
                new THREE.MeshStandardMaterial({ color: 0xffffff })
            );

            mesh.position.set(x - 0.15, 1.1, -2);
            this.scene.add(mesh);
            this.uiElements.push(mesh);
        };

        createLabel('Know', -0.6);
        createLabel('Unsure', 0);
        createLabel('Forget', 0.6);

        this.uiElements.push(
            this.IKonwButton,
            this.NotSureButton,
            this.ForgetButton
        );
    }

    async startFirstWord() {
        if (this.wordsData.length === 0) {
            console.error('No words data available');
            return;
        }

        this.currentWordIndex = 0;
        await this.displayWord(this.wordsData[0]);
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

    async loadAndDisplayModel(modelName) {
        try {
            const modelUrl = `/models/${modelName}_1.glb`;
            console.log('Loading model:', modelUrl);

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

            this.scene.add(model);
            this.currentWordModel = model;
            this.modelObjects.push(model);

            console.log('Model loaded successfully');
            return model;
        } catch (error) {
            console.error('Error loading model:', error);
            return null;
        }
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
    }

    onControllerSelect(event) {
        const controller = event.target;
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

        // Get all interactable objects
        const interactableObjects = [
            ...this.wordObjects,
            ...this.modelObjects,
            ...this.uiElements
        ];

        console.log('Interactable objects:', interactableObjects.length);

        const intersections = this.raycaster.intersectObjects(interactableObjects, true);
        console.log('Intersections found:', intersections.length);

        if (intersections.length > 0) {
            const object = intersections[0].object;
            console.log('Hit object type:', object.userData.type);

            if (object.userData.type === 'I-know-button') {
                this.state = 'remember';
                console.log('I Know button clicked - switching to Remember state');
                this.debugInfo.lastInteraction = 'I Know Button Click';
                this.NotSureButton.visible = true;
                this.ForgetButton.visible = true;
            } else if (object.userData.type === 'not-sure-button') {
                this.state = 'unsure';
                console.log('Not Sure button clicked - switching to Unsure state');
                this.debugInfo.lastInteraction = 'Not Sure Button Click';
                this.NotSureButton.visible = false; // Hide the Not Sure button after clicking
                this.ForgetButton.visible = false; // Hide the Forget button after clicking
                this.IKonwButton.visible = false;
            }
            else if (object.userData.type === 'forget-button') {
                this.state = 'forget';
                console.log('Forget button clicked - switching to Forget state');
                this.debugInfo.lastInteraction = 'Forget Button Click';
                this.ForgetButton.visible = false; // Hide the Forget button after clicking
                this.NotSureButton.visible = false; // Hide the Not Sure button after clicking
                this.IKonwButton.visible = false;
            }
            else if (object.userData.type === 'next-button') {
                console.log('Next button clicked - moving to next word');
                this.NextButton.visible = false; // Hide the Next button after clicking
                this.debugInfo.lastInteraction = 'Next Button Click';
                this.nextWord();
                this.NotSureButton.visible = true;
                this.ForgetButton.visible = true;
                this.IKonwButton.visible = true;
            }
            else if (object.userData.type === 'word') {
                console.log('Word clicked');
                this.debugInfo.lastInteraction = 'Word Click';
                this.onWordClick(object);
            } else if (object.userData.type === '3d-model') {
                console.log('3D model clicked');
                this.debugInfo.lastInteraction = 'Model Click';
                this.onModelClick(object);
            }
        } else {
            console.log('No intersection detected - pointing into empty space');
        }
        if (this.state == 'remember') {
            this.nextWord();
        }
        else {
            this.handleNeedModel();
        }

        this.updateDebugPanel();
    }

    async handleNeedModel() {
        if (this.hasAnswered) return; // 防止重复点

        this.hasAnswered = true;

        const wordData = this.wordsData[this.currentWordIndex];

        // 清除文字
        this.IKonwButton.visible = false;
        this.NotSureButton.visible = false;
        this.ForgetButton.visible = false;

        // 显示模型
        await this.loadAndDisplayModel(wordData.word);

        // 显示 Next 按钮
        this.showNextButton();
    }

    onControllerSelectStart(event) {
        console.log('Controller select start event');
        this.debugInfo.lastInteraction = 'Controller Press Start';
        this.updateDebugPanel();
        // This method is kept for compatibility
        this.onControllerSelect(event);
    }

    async onWordClick(wordObject) {
        const wordData = wordObject.userData.wordData;
        console.log('Word clicked:', wordData.word);

        // Remove word text and load 3D model
        this.ForgetButton.visible = false; // Hide the Forget button after clicking
        this.NotSureButton.visible = false; // Hide the Not Sure button after clicking
        this.IKonwButton.visible = false;
        this.interactionState = 'model';

        // Load and display the 3D model
        await this.loadAndDisplayModel(wordData.word);
    }

    showNextButton() {
        this.nextButton.visible = true;
    }

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

        this.nextButton.visible = false;

        this.currentWordIndex = (this.currentWordIndex + 1) % this.wordsData.length;
        const nextWord = this.wordsData[this.currentWordIndex];
        await this.displayWord(nextWord);
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

                // Visual feedback - highlight objects under cursor
                const interactableObjects = [
                    ...this.wordObjects,
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

