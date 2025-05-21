// Pixetch Editor - A pixel art editor library
(function() {
    // Styles
    const styles = `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        .pixetch-editor {
            font-family: Arial, sans-serif;
            position: relative;
            width: 100%;
            height: 100%;
        }

        .toolbar {
            display: flex;
            gap: 20px;
            margin-top: 10px;
            justify-content: center;
            position: absolute;
            max-width: 870px;
            left: calc(100% - 50% - 435px);
            padding: 10px;
            background-color: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
            z-index: 99;
        }

        .tool-group {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .tool {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            background-color: #f0f0f0;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .tool:hover {
            background-color: #e0e0e0;
        }

        .tool.active {
            background-color: #007bff;
            color: white;
        }

        .canvas-container {
            position: relative;
            width: 100%;
            height: 100vh;
            overflow: hidden;
            background: #ccc;
            z-index: 0;
        }

        .canvas-wrapper {
            position: absolute;
            transform-origin: 0 0;
            will-change: transform;
        }

        .color-picker {
            width: 30px;
            height: 30px;
            padding: 0;
            border: 3px solid transparent;
            border-radius: 50%;
            cursor: pointer;
            transition: border-color 0.2s;
            -webkit-appearance: none;
            appearance: none;
            background: none;
        }

        .color-picker::-webkit-color-swatch-wrapper {
            padding: 0;
            border-radius: 50%;
        }

        .color-picker::-webkit-color-swatch {
            border: none;
            border-radius: 50%;
        }

        .color-picker.active {
            border-color: #007bff;
        }

        .color-picker:hover {
            border-color: #0056b3;
        }

        .layers-panel {
            position: fixed;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
            width: 220px;
            height: 300px;
            background: #fff;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            display: flex;
            flex-direction: column;
        }

        .layers-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            border-bottom: 1px solid #eee;
            flex-shrink: 0;
        }

        .layers-header h3 {
            margin: 0;
            font-size: 16px;
            color: #333;
        }

        .layers-list {
            flex-grow: 1;
            overflow-y: auto;
            min-height: 0;
        }

        .layer-item {
            display: flex;
            align-items: center;
            padding: 8px 10px;
            cursor: pointer;
            border-bottom: 1px solid #eee;
            transition: background-color 0.2s;
        }

        .layer-item:hover {
            background-color: #f5f5f5;
        }

        .layer-item.active {
            background-color: #e3f2fd;
        }

        .layer-item span {
            flex-grow: 1;
            margin-right: 10px;
            font-size: 14px;
            color: #333;
        }

        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1001;
        }

        .modal.show {
            display: block;
        }

        .modal-content {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            min-width: 300px;
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .modal-header h3 {
            margin: 0;
            font-size: 18px;
        }

        .close-modal {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
        }

        .modal-body {
            margin-bottom: 20px;
        }

        .modal-body input {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-bottom: 10px;
        }

        .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }

        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .btn-primary {
            background-color: #007bff;
            color: white;
        }

        .btn-secondary {
            background-color: #6c757d;
            color: white;
        }

        .config-group {
            margin-bottom: 15px;
        }

        .config-group label {
            display: block;
            margin-bottom: 5px;
            color: #333;
        }

        .config-group input {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
    `;

    // Add styles to document
    const styleSheet = document.createElement("style");
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    // Add Font Awesome
    const fontAwesome = document.createElement("link");
    fontAwesome.rel = "stylesheet";
    fontAwesome.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css";
    document.head.appendChild(fontAwesome);

    // Editor Classes
    class CanvasLayer {
        constructor(id, scaleFactor, width, height, fill = null) {
            this.canvas = document.getElementById(id);
            this.id = id;
            this.canvas.width = width;
            this.canvas.height = height;
            this.ctx = this.canvas.getContext('2d');
            this.ctx.scale(scaleFactor, scaleFactor);
            this.visible = true;
            this.name = this.canvas.getAttribute('data-canvas-name') || 'Layer 1';

            if (fill) {
                this.ctx.fillStyle = fill;
                this.ctx.fillRect(0, 0, width, height);
            }

            this.preventContextMenu();
        }

        preventContextMenu() {
            this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        }

        clear() {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        drawPixel(x, y, color = '#000') {
            this.ctx.fillStyle = color;
            this.ctx.fillRect(x, y, 1, 1);
        }

        clearPixel(x, y) {
            this.ctx.clearRect(x, y, 1, 1);
        }

        setVisibility(visible) {
            this.visible = visible;
            this.canvas.style.display = visible ? 'block' : 'none';
        }

        getImageData() {
            return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        }

        putImageData(imageData) {
            this.ctx.putImageData(imageData, 0, 0);
        }

        setName(name) {
            this.name = name;
            this.canvas.setAttribute('data-canvas-name', name);
        }
    }

    class HistoryManager {
        constructor() {
            this.history = [];
            this.currentIndex = -1;
            this.maxHistory = 50;
        }

        reset() {
            this.history = [];
            this.currentIndex = -1;
        }

        pushState(state, action = 'Drawing') {
            if (this.currentIndex < this.history.length - 1) {
                this.clearFutureStates();
            }

            this.history.push(state);
            this.currentIndex++;

            if (this.history.length > this.maxHistory) {
                this.history.shift();
                this.currentIndex--;
            }
        }

        clearFutureStates() {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }

        undo() {
            if (this.currentIndex > 0) {
                this.currentIndex--;
                return this.history[this.currentIndex];
            }
            return null;
        }

        redo() {
            if (this.currentIndex < this.history.length - 1) {
                this.currentIndex++;
                return this.history[this.currentIndex];
            }
            return null;
        }

        canUndo() {
            return this.currentIndex > 0;
        }

        canRedo() {
            return this.currentIndex < this.history.length - 1;
        }
    }

    class CanvasController {
        constructor(wrapper, container) {
            this.wrapper = wrapper;
            this.container = container;
            this.scale = 1;
            this.translateX = 0;
            this.translateY = 0;
            this.isDragging = false;

            this.centerCanvas();
            this.initZoom();
            this.initPan();
        }

        centerCanvas() {
            this.wrapper.style.transform = 'translate(0px, 0px) scale(1)';
            
            const canvas = this.wrapper.querySelector('canvas');
            if (!canvas) return;
            
            const containerRect = this.container.getBoundingClientRect();
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            
            this.translateX = (containerRect.width - canvasWidth) / 2;
            this.translateY = (containerRect.height - canvasHeight) / 2;
            
            this.updateTransform();
        }

        updateTransform() {
            this.wrapper.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`;
        }

        initZoom() {
            this.container.addEventListener('wheel', e => {
                e.preventDefault();
                const rect = this.container.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
                const newScale = Math.min(Math.max(0.1, this.scale * zoomFactor), 10);
                const scaleChange = newScale - this.scale;

                this.translateX -= (mouseX - this.translateX) * (scaleChange / newScale);
                this.translateY -= (mouseY - this.translateY) * (scaleChange / newScale);

                this.scale = newScale;
                this.updateTransform();
            });
        }

        initPan() {
            this.container.addEventListener('mousedown', e => {
                if (e.button === 1) {
                    this.isDragging = true;
                    this.container.style.cursor = 'grabbing';
                }
            });

            this.container.addEventListener('mousemove', e => {
                if (this.isDragging) {
                    this.translateX += e.movementX;
                    this.translateY += e.movementY;
                    this.updateTransform();
                }
            });

            this.container.addEventListener('mouseup', () => {
                this.isDragging = false;
                this.container.style.cursor = 'default';
            });

            this.container.addEventListener('mouseleave', () => {
                this.isDragging = false;
                this.container.style.cursor = 'default';
            });
        }
    }

    class DrawingTool {
        constructor(layerManager, scaleFactor, container, controller) {
            this.layerManager = layerManager;
            this.scaleFactor = scaleFactor;
            this.container = container;
            this.controller = controller;
            this.isDrawing = false;
            this.currentTool = 'pencil';
            this.currentColor = '#000000';
            this.lastX = 0;
            this.lastY = 0;

            this.initListeners();
        }

        setColor(color) {
            this.currentColor = color;
        }

        setTool(tool) {
            this.currentTool = tool;
        }

        getCanvasCoordinates(e, translateX, translateY, scale) {
            const rect = this.container.getBoundingClientRect();
            const x = (e.clientX - rect.left - translateX) / scale;
            const y = (e.clientY - rect.top - translateY) / scale;
            return { x: Math.floor(x), y: Math.floor(y) };
        }

        initListeners() {
            this.container.addEventListener('mousedown', e => this.handleMouseDown(e));
            this.container.addEventListener('mousemove', e => this.handleMouseMove(e));
            this.container.addEventListener('mouseup', () => this.handleMouseUp());
            this.container.addEventListener('mouseleave', () => this.handleMouseUp());
        }

        handleMouseDown(e) {
            if (e.button !== 0) return;
            
            const { x, y } = this.getCanvasCoordinates(e, this.controller.translateX, this.controller.translateY, this.controller.scale);
            this.isDrawing = true;
            this.lastX = x;
            this.lastY = y;

            if (this.currentTool === 'eraser') {
                this.layerManager.getActiveLayer().clearPixel(x, y);
            } else {
                this.layerManager.getActiveLayer().drawPixel(x, y, this.currentColor);
            }
        }

        handleMouseMove(e) {
            if (!this.isDrawing) return;

            const { x, y } = this.getCanvasCoordinates(e, this.controller.translateX, this.controller.translateY, this.controller.scale);
            
            if (this.currentTool === 'eraser') {
                this.drawLine(this.lastX, this.lastY, x, y, true);
            } else {
                this.drawLine(this.lastX, this.lastY, x, y);
            }

            this.lastX = x;
            this.lastY = y;
        }

        handleMouseUp() {
            if (this.isDrawing) {
                this.isDrawing = false;
                this.layerManager.saveState();
            }
        }

        drawLine(x0, y0, x1, y1, erasing = false) {
            const dx = Math.abs(x1 - x0);
            const dy = Math.abs(y1 - y0);
            const sx = x0 < x1 ? 1 : -1;
            const sy = y0 < y1 ? 1 : -1;
            let err = dx - dy;

            while (true) {
                if (erasing) {
                    this.layerManager.getActiveLayer().clearPixel(x0, y0);
                } else {
                    this.layerManager.getActiveLayer().drawPixel(x0, y0, this.currentColor);
                }

                if (x0 === x1 && y0 === y1) break;
                const e2 = 2 * err;
                if (e2 > -dy) {
                    err -= dy;
                    x0 += sx;
                }
                if (e2 < dx) {
                    err += dx;
                    y0 += sy;
                }
            }
        }
    }

    class ColorPaletteManager {
        constructor(container) {
            this.container = container;
            this.colors = [
                '#000000', '#FFFFFF', '#FF0000', '#00FF00', 
                '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
                '#808080', '#800000'
            ];
            this.currentColor = '#000000';
            this.init();
        }

        init() {
            this.colors.forEach((color, index) => {
                const picker = document.createElement('input');
                picker.type = 'color';
                picker.className = 'color-picker';
                picker.value = color;
                picker.dataset.index = index;
                
                picker.addEventListener('change', (e) => {
                    this.setActiveColor(e.target);
                    this.currentColor = e.target.value;
                });

                if (index === 0) {
                    picker.classList.add('active');
                }

                this.container.appendChild(picker);
            });
        }

        setActiveColor(picker) {
            this.container.querySelectorAll('.color-picker').forEach(p => p.classList.remove('active'));
            picker.classList.add('active');
        }

        getCurrentColor() {
            return this.currentColor;
        }
    }

    class CanvasLayerManager {
        constructor(scaleFactor, canvasSize, skipInitialState = false) {
            this.scaleFactor = scaleFactor;
            this.canvasSize = canvasSize;
            this.layers = [];
            this.activeLayer = null;
            this.historyManager = null;
            this.wrapper = null;
            this.layersList = null;
        }

        initializeBaseLayers() {
            // Create background layer
            const backgroundCanvas = document.createElement('canvas');
            backgroundCanvas.id = 'backgroundLayout';
            backgroundCanvas.setAttribute('data-canvas-type', 'background');
            this.wrapper.appendChild(backgroundCanvas);
            const backgroundLayer = new CanvasLayer('backgroundLayout', this.scaleFactor, this.canvasSize.width, this.canvasSize.height, '#ffffff');
            this.layers.push(backgroundLayer);

            // Create grid layer
            const gridCanvas = document.createElement('canvas');
            gridCanvas.id = 'gridlineLayout';
            gridCanvas.setAttribute('data-canvas-type', 'grid');
            this.wrapper.appendChild(gridCanvas);
            const gridLayer = new CanvasLayer('gridlineLayout', this.scaleFactor, this.canvasSize.width, this.canvasSize.height);
            gridLayer.drawGrid(this.scaleFactor);
            this.layers.push(gridLayer);
        }

        initializeDrawableLayers() {
            this.createNewLayer();
        }

        createNewLayer() {
            const layerId = `layer-${Date.now()}`;
            const canvas = this.createNewCanvas(layerId);
            const layer = new CanvasLayer(layerId, this.scaleFactor, this.canvasSize.width, this.canvasSize.height);
            this.layers.push(layer);
            this.setActiveLayer(layer);
            this.updateLayerZIndices();
            return layer;
        }

        createNewCanvas(layerId) {
            const canvas = document.createElement('canvas');
            canvas.id = layerId;
            canvas.setAttribute('data-canvas-type', 'drawable');
            canvas.setAttribute('data-canvas-name', `Layer ${this.layers.length + 1}`);
            this.wrapper.appendChild(canvas);
            return canvas;
        }

        updateLayerZIndices() {
            this.layers.forEach((layer, index) => {
                layer.canvas.style.zIndex = index;
            });
        }

        setActiveLayer(layer) {
            this.activeLayer = layer;
            this.layersList.querySelectorAll('.layer-item').forEach(item => {
                item.classList.remove('active');
            });
            const layerItem = this.layersList.querySelector(`[data-canvas-name="${layer.name}"]`).closest('.layer-item');
            if (layerItem) {
                layerItem.classList.add('active');
            }
        }

        getActiveLayer() {
            return this.activeLayer;
        }

        getLayer(name) {
            return this.layers.find(layer => layer.name === name);
        }

        saveState(action = 'Drawing') {
            if (this.historyManager) {
                const state = this.getCanvasState();
                this.historyManager.pushState(state, action);
            }
        }

        getCanvasState() {
            return this.layers.map(layer => ({
                id: layer.id,
                name: layer.name,
                imageData: layer.getImageData()
            }));
        }

        restoreState(state) {
            state.forEach(layerState => {
                const layer = this.getLayer(layerState.name);
                if (layer) {
                    layer.putImageData(layerState.imageData);
                }
            });
        }
    }

    class App {
        constructor(selector) {
            this.container = document.querySelector(selector);
            if (!this.container) {
                throw new Error(`Element ${selector} not found`);
            }

            this.container.classList.add('pixetch-editor');
            this.initialize();
        }

        initialize() {
            this.setupContainer();
            this.initComponents();
            this.initConfig();
        }

        setupContainer() {
            // Create toolbar
            const toolbar = document.createElement('div');
            toolbar.className = 'toolbar';
            
            // Tools group
            const toolsGroup = document.createElement('div');
            toolsGroup.className = 'tool-group';
            toolsGroup.innerHTML = `
                <button id="pencil" class="tool active"><span class="fas fa-pencil"></span></button>
                <button id="brush" class="tool"><span class="fas fa-brush"></span></button>
                <button id="fill" class="tool"><span class="fas fa-bucket"></span></button>
                <button id="eraser" class="tool secondary"><span class="fas fa-eraser"></span></button>
            `;
            
            // Colors group
            const colorsGroup = document.createElement('div');
            colorsGroup.className = 'tool-group';
            
            // Actions group
            const actionsGroup = document.createElement('div');
            actionsGroup.className = 'tool-group';
            actionsGroup.innerHTML = `
                <button id="undo" class="tool"><span class="fas fa-undo"></span></button>
                <button id="redo" class="tool"><span class="fas fa-redo"></span></button>
                <button id="download" class="tool"><span class="fas fa-download"></span></button>
                <button id="config" class="tool"><span class="fas fa-file"></span></button>
            `;
            
            toolbar.appendChild(toolsGroup);
            toolbar.appendChild(colorsGroup);
            toolbar.appendChild(actionsGroup);
            
            // Create canvas container
            const canvasContainer = document.createElement('div');
            canvasContainer.className = 'canvas-container';
            
            // Create canvas wrapper
            const canvasWrapper = document.createElement('div');
            canvasWrapper.className = 'canvas-wrapper';
            
            // Create layers panel
            const layersPanel = document.createElement('div');
            layersPanel.className = 'layers-panel';
            layersPanel.innerHTML = `
                <div class="layers-header">
                    <h3>Layers</h3>
                    <button id="add-layer" class="tool"><span class="fas fa-plus"></span></button>
                </div>
                <div class="layers-list" id="layers-list"></div>
            `;
            
            // Create config modal
            const configModal = document.createElement('div');
            configModal.id = 'config-modal';
            configModal.className = 'modal';
            configModal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Canvas Configuration</h3>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="config-group">
                            <label for="pixel-size">Pixel Size:</label>
                            <input type="number" id="pixel-size" min="1" max="50" value="10">
                        </div>
                        <div class="config-group">
                            <label for="canvas-width">Canvas Width:</label>
                            <input type="number" id="canvas-width" min="1" max="2000" value="1280">
                        </div>
                        <div class="config-group">
                            <label for="canvas-height">Canvas Height:</label>
                            <input type="number" id="canvas-height" min="1" max="2000" value="650">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="cancel-config" class="btn btn-secondary">Cancel</button>
                        <button id="save-config" class="btn btn-primary">Save</button>
                    </div>
                </div>
            `;
            
            canvasContainer.appendChild(canvasWrapper);
            this.container.appendChild(toolbar);
            this.container.appendChild(canvasContainer);
            this.container.appendChild(layersPanel);
            this.container.appendChild(configModal);
            
            this.canvasContainer = canvasContainer;
            this.canvasWrapper = canvasWrapper;
            this.toolbar = toolbar;
            this.layersPanel = layersPanel;
            this.configModal = configModal;
        }

        initComponents() {
            this.historyManager = new HistoryManager();
            this.canvasController = new CanvasController(this.canvasWrapper, this.canvasContainer);
            this.colorPalette = new ColorPaletteManager(this.toolbar.querySelector('.tool-group:nth-child(2)'));
            
            // Initialize layer manager
            this.layerManager = new CanvasLayerManager(1, { width: 1280, height: 650 });
            this.layerManager.wrapper = this.canvasWrapper;
            this.layerManager.layersList = this.layersPanel.querySelector('#layers-list');
            this.layerManager.historyManager = this.historyManager;
            
            // Initialize layers
            this.layerManager.initializeBaseLayers();
            this.layerManager.initializeDrawableLayers();
            
            // Initialize drawing tool
            this.drawingTool = new DrawingTool(this.layerManager, 1, this.canvasContainer, this.canvasController);
            
            this.setupEventListeners();
        }

        setupEventListeners() {
            // Tool buttons
            this.toolbar.querySelectorAll('.tool').forEach(button => {
                button.addEventListener('click', (e) => {
                    if (e.target.closest('#pencil')) {
                        this.drawingTool.setTool('pencil');
                        this.setActiveTool(e.target.closest('#pencil'));
                    } else if (e.target.closest('#brush')) {
                        this.drawingTool.setTool('brush');
                        this.setActiveTool(e.target.closest('#brush'));
                    } else if (e.target.closest('#fill')) {
                        this.drawingTool.setTool('fill');
                        this.setActiveTool(e.target.closest('#fill'));
                    } else if (e.target.closest('#eraser')) {
                        this.drawingTool.setTool('eraser');
                        this.setActiveTool(e.target.closest('#eraser'));
                    } else if (e.target.closest('#undo')) {
                        this.undo();
                    } else if (e.target.closest('#redo')) {
                        this.redo();
                    } else if (e.target.closest('#download')) {
                        this.downloadCanvas();
                    } else if (e.target.closest('#config')) {
                        this.showConfigModal();
                    }
                });
            });

            // Add layer button
            this.layersPanel.querySelector('#add-layer').addEventListener('click', () => {
                const layer = this.layerManager.createNewLayer();
                const layerItem = document.createElement('div');
                layerItem.className = 'layer-item active';
                layerItem.innerHTML = `
                    <span>${layer.name}</span>
                    <div class="layer-controls">
                        <button class="visibility-toggle"><span class="fas fa-eye"></span></button>
                        <button class="edit-layer"><span class="fas fa-edit"></span></button>
                        <button class="delete-layer"><span class="fas fa-trash"></span></button>
                    </div>
                `;
                this.layersPanel.querySelector('#layers-list').appendChild(layerItem);
            });
        }

        setActiveTool(toolButton) {
            this.toolbar.querySelectorAll('.tool').forEach(btn => btn.classList.remove('active'));
            toolButton.classList.add('active');
        }

        undo() {
            if (this.historyManager.canUndo()) {
                const state = this.historyManager.undo();
                if (state) {
                    this.layerManager.restoreState(state);
                }
            }
        }

        redo() {
            if (this.historyManager.canRedo()) {
                const state = this.historyManager.redo();
                if (state) {
                    this.layerManager.restoreState(state);
                }
            }
        }

        downloadCanvas() {
            const canvas = document.createElement('canvas');
            canvas.width = 1280;
            canvas.height = 650;
            const ctx = canvas.getContext('2d');
            
            this.layerManager.layers.forEach(layer => {
                if (layer.visible) {
                    ctx.drawImage(layer.canvas, 0, 0);
                }
            });
            
            const link = document.createElement('a');
            link.download = 'pixel-art.png';
            link.href = canvas.toDataURL();
            link.click();
        }

        showConfigModal() {
            this.configModal.classList.add('show');
        }

        hideConfigModal() {
            this.configModal.classList.remove('show');
        }

        initConfig() {
            const closeModal = () => {
                this.hideConfigModal();
            };

            this.configModal.querySelector('.close-modal').addEventListener('click', closeModal);
            this.configModal.querySelector('#cancel-config').addEventListener('click', closeModal);
            
            this.configModal.querySelector('#save-config').addEventListener('click', () => {
                const pixelSize = parseInt(this.configModal.querySelector('#pixel-size').value);
                const width = parseInt(this.configModal.querySelector('#canvas-width').value);
                const height = parseInt(this.configModal.querySelector('#canvas-height').value);
                
                if (this.validateConfig(pixelSize, width, height)) {
                    this.updateConfiguration({ pixelSize, width, height });
                    this.hideConfigModal();
                }
            });
        }

        validateConfig(pixelSize, width, height) {
            if (pixelSize < 1 || pixelSize > 50) {
                alert('Pixel size must be between 1 and 50');
                return false;
            }
            if (width < 1 || width > 2000) {
                alert('Canvas width must be between 1 and 2000');
                return false;
            }
            if (height < 1 || height > 2000) {
                alert('Canvas height must be between 1 and 2000');
                return false;
            }
            return true;
        }

        updateConfiguration(config) {
            // Update canvas sizes
            this.canvasWrapper.querySelectorAll('canvas').forEach(canvas => {
                canvas.width = config.width;
                canvas.height = config.height;
            });
            
            // Update drawing tool scale
            this.drawingTool.scaleFactor = config.pixelSize;
            
            // Center canvas
            this.canvasController.centerCanvas();
        }
    }

    // Export the App class
    window.Pixetch = App;
})();
