/**
 * Represents a single canvas layer in the editor
 */
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

    drawGrid(scaleFactor) {
        const oldFill = this.ctx.fillStyle;
        this.ctx.fillStyle = '#888';
        for (let i = 0; i < this.canvas.width / scaleFactor; i++) {
            for (let j = 0; j < this.canvas.height / scaleFactor; j++) {
                this.ctx.fillRect(i, j, 0.1, 0.1);
            }
        }
        this.ctx.fillStyle = oldFill;
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

/**
 * Manages the history of canvas states and operations
 */
class HistoryManager {
    constructor() {
        this.history = [];
        this.currentIndex = -1;
        this.maxHistory = 50;
        this.historyList = document.getElementById('history-list');
    }

    reset() {
        this.history = [];
        this.currentIndex = -1;
        this.historyList.innerHTML = '';
    }

    addHistoryItem(action) {
        const item = document.createElement('div');
        item.className = 'history-item';
        
        const icon = this.getActionIcon(action);
        item.innerHTML = `<i class="fas ${icon}"></i><span>${action}</span>`;

        this.historyList.appendChild(item);
        this.updateHistoryPanel();
    }

    getActionIcon(action) {
        if (action.startsWith('Draw')) return 'fa-pencil';
        if (action.startsWith('Erase')) return 'fa-eraser';
        if (action.startsWith('Create')) return 'fa-plus';
        if (action.startsWith('Changed')) return 'fa-edit';
        if (action.startsWith('Deleted')) return 'fa-trash';
        return 'fa-history';
    }

    updateHistoryPanel() {
        const items = this.historyList.children;
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            item.classList.toggle('active', i === this.currentIndex);
            item.classList.toggle('disabled', i > this.currentIndex);
            item.style.cursor = i > this.currentIndex ? 'not-allowed' : 'pointer';
        }

        const activeItem = items[this.currentIndex];
        if (activeItem) {
            activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    jumpToState(index) {
        if (index < 0 || index >= this.history.length) return;
        
        this.currentIndex = index;
        this.updateHistoryPanel();
        return this.history[index];
    }

    clearFutureStates() {
        this.history = this.history.slice(0, this.currentIndex + 1);
        
        const items = this.historyList.children;
        while (items.length > this.currentIndex + 1) {
            this.historyList.removeChild(items[this.currentIndex + 1]);
        }
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
            this.historyList.removeChild(this.historyList.firstChild);
        }

        this.addHistoryItem(action);
    }

    undo() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.updateHistoryPanel();
            return this.history[this.currentIndex];
        }
        return null;
    }

    redo() {
        if (this.currentIndex < this.history.length - 1) {
            this.currentIndex++;
            this.updateHistoryPanel();
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

/**
 * Controls canvas panning and zooming
 */
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

    getTransform() {
        return {
            scale: this.scale,
            translateX: this.translateX,
            translateY: this.translateY
        };
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
                this.startX = e.clientX - this.translateX;
                this.startY = e.clientY - this.translateY;
                this.container.classList.add('dragging');
                e.preventDefault();
            }
        });

        ['mouseup', 'mouseleave'].forEach(evt =>
            this.container.addEventListener(evt, () => {
                this.isDragging = false;
                this.container.classList.remove('dragging');
            })
        );

        this.container.addEventListener('mousemove', e => {
            if (!this.isDragging) return;
            this.translateX = e.clientX - this.startX;
            this.translateY = e.clientY - this.startY;
            this.updateTransform();
        });
    }
}

/**
 * Manages canvas layers and their interactions
 */
class CanvasLayerManager {
    constructor(scaleFactor, canvasSize, skipInitialState = false) {
        this.scaleFactor = scaleFactor;
        this.canvasSize = canvasSize;
        this.layers = this.initializeBaseLayers();
        this.drawableLayers = this.initializeDrawableLayers();
        this.activeLayer = this.drawableLayers[0];
        this.nextLayerId = this.drawableLayers.length;
        this.historyManager = new HistoryManager();
        
        if (!skipInitialState) {
            this.saveState('Initial State');
        }
        
        this.initLayersList();
        this.initAddLayerButton();
        this.initUndoRedo();
        this.initLayerNameModal();
        this.initExportButton();
    }

    initializeBaseLayers() {
        return {
            bg: new CanvasLayer('backgroundLayout', this.scaleFactor, ...this.canvasSize, '#fff'),
            grid: new CanvasLayer('gridlineLayout', this.scaleFactor, ...this.canvasSize),
            cursor: new CanvasLayer('cursorLayout', this.scaleFactor, ...this.canvasSize)
        };
    }

    initializeDrawableLayers() {
        return ['mainLayer'].map(id => new CanvasLayer(id, this.scaleFactor, ...this.canvasSize));
    }

    initLayerNameModal() {
        this.modal = document.getElementById('layer-name-modal');
        this.nameInput = document.getElementById('layer-name-input');
        this.currentEditingLayer = null;

        this.setupModalEventListeners();
    }

    setupModalEventListeners() {
        const closeModal = () => {
            this.modal.classList.remove('show');
            this.currentEditingLayer = null;
            this.nameInput.value = '';
        };

        document.querySelector('.close-modal').addEventListener('click', closeModal);
        document.getElementById('cancel-rename').addEventListener('click', closeModal);

        document.getElementById('save-rename').addEventListener('click', () => {
            if (this.currentEditingLayer) {
                const newName = this.nameInput.value.trim();
                if (newName) {
                    this.currentEditingLayer.setName(newName);
                    this.initLayersList();
                    this.saveState();
                }
            }
            closeModal();
        });

        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                closeModal();
            }
        });

        this.nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('save-rename').click();
            }
        });
    }

    getNextLayerName() {
        const usedNames = new Set(this.drawableLayers.map(layer => layer.name));
        let index = 1;
        let name;
        do {
            name = `Layer ${index}`;
            index++;
        } while (usedNames.has(name));
        return name;
    }

    saveState(action = 'Drawing', layer = null) {
        const state = {
            layers: this.drawableLayers.map(layer => ({
                id: layer.id,
                imageData: layer.getImageData(),
                visible: layer.visible,
                name: layer.name
            })),
            activeLayerId: this.activeLayer.id
        };

        let actionText = action;
        if (layer) {
            actionText = `${action} on "${layer.name}"`;
        }
        this.historyManager.pushState(state, actionText);
    }

    restoreState(state) {
        if (!state) return;

        this.cleanupExistingLayers();
        this.restoreLayersFromState(state);
        this.updateLayerZIndices();
        this.initLayersList();
    }

    cleanupExistingLayers() {
        this.drawableLayers.forEach(layer => {
            const canvas = document.getElementById(layer.id);
            if (canvas) {
                canvas.remove();
            }
        });
        this.drawableLayers = [];
    }

    restoreLayersFromState(state) {
        state.layers.forEach(layerState => {
            const canvas = this.createCanvasFromState(layerState);
            const layer = new CanvasLayer(layerState.id, this.scaleFactor, ...this.canvasSize);
            layer.putImageData(layerState.imageData);
            layer.setVisibility(layerState.visible);
            layer.setName(layerState.name);
            
            this.drawableLayers.push(layer);
        });

        const activeLayer = this.drawableLayers.find(l => l.id === state.activeLayerId);
        if (activeLayer) {
            this.setActiveLayer(activeLayer);
        }
    }

    createCanvasFromState(layerState) {
        const canvas = document.createElement('canvas');
        canvas.id = layerState.id;
        canvas.setAttribute('data-canvas-type', 'drawable');
        canvas.setAttribute('data-canvas-name', layerState.name);
        
        const wrapper = document.querySelector('.canvas-wrapper');
        const cursorCanvas = document.getElementById('cursorLayout');
        wrapper.insertBefore(canvas, cursorCanvas);
        
        return canvas;
    }

    updateLayerZIndices() {
        this.drawableLayers.forEach((layer, index) => {
            const canvas = document.getElementById(layer.id);
            if (canvas) {
                canvas.style.zIndex = 3 + index;
            }
        });
    }

    createNewLayer() {
        const layerId = `layer${this.nextLayerId}`;
        if (document.getElementById(layerId)) {
            console.error(`Layer with ID ${layerId} already exists`);
            return null;
        }

        const canvas = this.createNewCanvas(layerId);
        const newLayer = new CanvasLayer(layerId, this.scaleFactor, ...this.canvasSize);
        this.drawableLayers.push(newLayer);
        this.nextLayerId++;
        
        this.updateLayerZIndices();
        this.initLayersList();
        this.setActiveLayer(newLayer);
        this.saveState('Create new', newLayer);
        
        return newLayer;
    }

    createNewCanvas(layerId) {
        const canvas = document.createElement('canvas');
        canvas.id = layerId;
        canvas.setAttribute('data-canvas-type', 'drawable');
        canvas.setAttribute('data-canvas-name', this.getNextLayerName());
        
        const wrapper = document.querySelector('.canvas-wrapper');
        const cursorCanvas = document.getElementById('cursorLayout');
        wrapper.insertBefore(canvas, cursorCanvas);
        
        return canvas;
    }

    initAddLayerButton() {
        const addButton = document.getElementById('add-layer');
        if (addButton) {
            addButton.addEventListener('click', () => this.createNewLayer());
        }
    }

    initLayersList() {
        const layersList = document.getElementById('layers-list');
        layersList.innerHTML = '';

        this.drawableLayers.slice().reverse().forEach(layer => {
            const layerItem = this.createLayerListItem(layer);
            layersList.appendChild(layerItem);
        });
    }

    createLayerListItem(layer) {
        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';
        layerItem.setAttribute('data-layer-id', layer.id);
        
        if (layer === this.activeLayer) {
            layerItem.classList.add('active');
        }

        const controls = this.createLayerControls(layer);
        const layerName = document.createElement('span');
        layerName.textContent = layer.name;

        layerItem.appendChild(layerName);
        layerItem.appendChild(controls);

        layerItem.onclick = (e) => {
            if (!e.target.closest('button')) {
                this.setActiveLayer(layer);
            }
        };

        return layerItem;
    }

    createLayerControls(layer) {
        const controls = document.createElement('div');
        controls.className = 'layer-controls';

        const visibilityToggle = this.createVisibilityToggle(layer);
        const editButton = this.createEditButton(layer);
        const deleteButton = this.createDeleteButton(layer);

        controls.appendChild(visibilityToggle);
        controls.appendChild(editButton);
        controls.appendChild(deleteButton);

        return controls;
    }

    createVisibilityToggle(layer) {
        const button = document.createElement('button');
        button.className = 'visibility-toggle';
        button.innerHTML = '<i class="fas fa-eye"></i>';
        button.onclick = () => this.toggleLayerVisibility(layer);
        return button;
    }

    createEditButton(layer) {
        const button = document.createElement('button');
        button.className = 'edit-layer';
        button.innerHTML = '<i class="fas fa-cog"></i>';
        button.onclick = (e) => {
            e.stopPropagation();
            this.editLayerName(layer);
        };
        return button;
    }

    createDeleteButton(layer) {
        const button = document.createElement('button');
        button.className = 'delete-layer';
        button.innerHTML = '<i class="fas fa-trash"></i>';
        button.onclick = (e) => {
            e.stopPropagation();
            this.deleteLayer(layer);
        };
        return button;
    }

    editLayerName(layer) {
        this.currentEditingLayer = layer;
        this.nameInput.value = layer.name;
        this.modal.classList.add('show');
        this.nameInput.focus();
        this.nameInput.select();
    }

    deleteLayer(layer) {
        if (this.drawableLayers.length <= 1) {
            alert('Cannot delete the last layer');
            return;
        }

        const canvas = document.getElementById(layer.id);
        if (canvas) {
            canvas.remove();
        }

        const index = this.drawableLayers.indexOf(layer);
        if (index > -1) {
            this.drawableLayers.splice(index, 1);
        }

        if (layer === this.activeLayer) {
            this.setActiveLayer(this.drawableLayers[this.drawableLayers.length - 1]);
        }

        this.initLayersList();
        this.saveState('Deleted layer', layer);
    }

    setActiveLayer(layer) {
        this.activeLayer = layer;
        
        document.querySelectorAll('.layer-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-layer-id') === layer.id);
        });
    }

    toggleLayerVisibility(layer) {
        layer.setVisibility(!layer.visible);
        const layerItem = document.querySelector(`[data-layer-id="${layer.id}"]`);
        const visibilityIcon = layerItem.querySelector('.visibility-toggle i');
        visibilityIcon.className = layer.visible ? 'fas fa-eye' : 'fas fa-eye-slash';
        this.saveState();
    }

    getLayer(name) {
        return this.layers[name];
    }

    getActiveLayer() {
        return this.activeLayer;
    }

    clearLayer(layer) {
        layer.clear();
    }

    drawGridlines() {
        this.layers.grid.drawGrid(this.scaleFactor);
    }

    initUndoRedo() {
        const undoButton = document.getElementById('undo');
        const redoButton = document.getElementById('redo');

        if (undoButton) {
            undoButton.addEventListener('click', () => {
                const state = this.historyManager.undo();
                if (state) {
                    this.restoreState(state);
                }
            });
        }

        if (redoButton) {
            redoButton.addEventListener('click', () => {
                const state = this.historyManager.redo();
                if (state) {
                    this.restoreState(state);
                }
            });
        }
    }

    initExportButton() {
        const exportButton = document.getElementById('export');
        if (exportButton) {
            exportButton.addEventListener('click', () => this.exportActiveLayer());
        }
    }

    exportActiveLayer() {
        if (!this.activeLayer) return;

        // Create a temporary canvas to handle the export
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvasSize[0];
        tempCanvas.height = this.canvasSize[1];
        const tempCtx = tempCanvas.getContext('2d');

        // Draw the active layer onto the temporary canvas
        tempCtx.drawImage(this.activeLayer.canvas, 0, 0);

        // Generate filename with timestamp
        const now = new Date();
        const timestamp = [
            now.getDate().toString().padStart(2, '0'),
            (now.getMonth() + 1).toString().padStart(2, '0'),
            now.getFullYear(),
            now.getHours().toString().padStart(2, '0'),
            now.getMinutes().toString().padStart(2, '0'),
            now.getSeconds().toString().padStart(2, '0'),
            now.getMilliseconds().toString().padStart(3, '0')
        ].join('_');

        const filename = `pixetch_${timestamp}.png`;

        // Create download link
        const link = document.createElement('a');
        link.download = filename;
        link.href = tempCanvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

/**
 * Manages the drawing tool and its interactions
 */
class DrawingTool {
    constructor(layerManager, scaleFactor, container, controller) {
        this.controller = controller;
        this.layerManager = layerManager;
        this.scaleFactor = scaleFactor;
        this.container = container;

        this.drawing = false;
        this.erasing = false;
        this.tool = 'pencil';
        this.color = '#000000';
        this.lastX = null;
        this.lastY = null;
        this.hasDrawn = false;

        this.initListeners();
    }

    setColor(color) {
        this.color = color;
        const cursorLayer = this.layerManager.getLayer('cursor');
        if (cursorLayer && cursorLayer.ctx) {
            cursorLayer.ctx.fillStyle = color;
        }
    }

    getCanvasCoordinates(e, translateX, translateY, scale) {
        const rect = this.container.getBoundingClientRect();
        const x = (e.clientX - rect.left - translateX) / scale;
        const y = (e.clientY - rect.top - translateY) / scale;
        return [~~(x / this.scaleFactor), ~~(y / this.scaleFactor)];
    }

    drawCursor(e, translateX, translateY, scale) {
        const [x, y] = this.getCanvasCoordinates(e, translateX, translateY, scale);
        const cursorLayer = this.layerManager.getLayer('cursor');
        cursorLayer.clear();
        cursorLayer.drawPixel(x, y, this.color);
    }

    drawPixel(x, y, erasing = false) {
        const activeLayer = this.layerManager.getActiveLayer();
        if (!activeLayer || !activeLayer.visible || !activeLayer.ctx) return;

        const method = erasing ? 'clearPixel' : 'drawPixel';
        activeLayer[method](x, y, this.color);
    }

    initListeners() {
        const cursorCanvas = this.layerManager.getLayer('cursor').canvas;

        cursorCanvas.addEventListener('mousedown', e => this.handleMouseDown(e));
        cursorCanvas.addEventListener('mousemove', e => this.handleMouseMove(e));
        cursorCanvas.addEventListener('mouseup', () => this.handleMouseUp());
        cursorCanvas.addEventListener('mouseleave', () => this.handleMouseUp());
    }

    handleMouseDown(e) {
        if (e.button !== 0 && e.button !== 2) return;
        const { translateX, translateY, scale } = this.controller.getTransform();
        const [x, y] = this.getCanvasCoordinates(e, translateX, translateY, scale);
        
        /*if (this.tool === 'fill') {
            const activeLayer = this.layerManager.getActiveLayer();
            const imageData = activeLayer.getImageData();
            const pixels = imageData.data;
            const pos = (y * activeLayer.canvas.width + x) * 4;
            
            // Get the color of the clicked pixel
            const targetColor = this.rgbToHex(
                pixels[pos],
                pixels[pos + 1],
                pixels[pos + 2]
            );
            
            this.floodFill(x, y, targetColor, this.color);
            this.layerManager.saveState('Fill', activeLayer);
            return;
        } */

        if (this.tool === 'fill') {
            const activeLayer = this.layerManager.getActiveLayer();
            const imageData = activeLayer.getImageData();
            const pixels = imageData.data;
            const pos = (y * activeLayer.canvas.width + x) * 4;
        
            // boundary color — чёрный (#000000), можно сделать настраиваемым
            const boundaryColor = '#000000';
            const fillColor = this.color;
        
            this.boundaryFill(x, y, boundaryColor, fillColor);
            this.layerManager.saveState('Boundary Fill', activeLayer);
            return;
        }

        this.drawing = true;
        this.erasing = e.button === 2;
        this.lastX = x;
        this.lastY = y;
        this.hasDrawn = false;
        this.drawPixel(x, y, this.erasing);
    }

    handleMouseMove(e) {
        const { translateX, translateY, scale } = this.controller.getTransform();
        const [x, y] = this.getCanvasCoordinates(e, translateX, translateY, scale);
        this.drawCursor(e, translateX, translateY, scale);
        
        if (!this.drawing) return;
        
        if (this.lastX !== null && this.lastY !== null) {
            this.drawLine(this.lastX, this.lastY, x, y);
            this.hasDrawn = true;
        }
        
        this.lastX = x;
        this.lastY = y;
    }

    handleMouseUp() {
        if (this.drawing) {
            const activeLayer = this.layerManager.getActiveLayer();
            if (this.hasDrawn || (this.lastX !== null && this.lastY !== null)) {
                this.layerManager.saveState(
                    this.erasing ? 'Erase' : 'Draw',
                    activeLayer
                );
            }
        }
        this.resetDrawingState();
    }

    resetDrawingState() {
        this.drawing = false;
        this.erasing = false;
        this.lastX = null;
        this.lastY = null;
        this.hasDrawn = false;
    }

    drawLine(x0, y0, x1, y1) {
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        while (true) {
            this.drawPixel(x0, y0, this.erasing);
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

    floodFill(x, y, targetColor, replacementColor) {
        const activeLayer = this.layerManager.getActiveLayer();
        if (!activeLayer || !activeLayer.visible || !activeLayer.ctx) return;

        const imageData = activeLayer.getImageData();
        const pixels = imageData.data;
        const width = activeLayer.canvas.width;
        const height = activeLayer.canvas.height;

        // Convert target color to RGB
        const targetRGB = this.hexToRgb(targetColor);
        const replacementRGB = this.hexToRgb(replacementColor);

        // If target color is the same as replacement color, no need to fill
        if (targetColor === replacementColor) return;

        // Color tolerance settings
        const tolerance = {
            r: 30,
            g: 30,
            b: 30,
            a: 10
        };

        // Use a more efficient data structure for visited pixels
        const visited = new Uint8Array(width * height);
        const queue = [[x, y]];
        let queueIndex = 0;

        // Function to get pixel color at position
        const getPixelColor = (pos) => ({
            r: pixels[pos],
            g: pixels[pos + 1],
            b: pixels[pos + 2],
            a: pixels[pos + 3]
        });

        // Function to check if colors are similar within tolerance
        const colorsAreSimilar = (color1, color2) => {
            return Math.abs(color1.r - color2.r) <= tolerance.r &&
                   Math.abs(color1.g - color2.g) <= tolerance.g &&
                   Math.abs(color1.b - color2.b) <= tolerance.b &&
                   Math.abs(color1.a - color2.a) <= tolerance.a;
        };

        // Function to check if a pixel is valid for filling
        const isValidPixel = (px, py) => {
            if (px < 0 || px >= width || py < 0 || py >= height) return false;
            const index = py * width + px;
            return !visited[index];
        };

        // Get the color at the starting point
        const startPos = (y * width + x) * 4;
        const startColor = getPixelColor(startPos);

        // If the starting point is transparent or already the target color, return
        if (startColor.a === 0 || colorsAreSimilar(startColor, replacementRGB)) {
            console.log('Starting point is not valid for filling');
            return;
        }

        // Main flood fill loop using a queue for better performance
        while (queueIndex < queue.length) {
            const [currentX, currentY] = queue[queueIndex++];
            const pos = (currentY * width + currentX) * 4;
            const index = currentY * width + currentX;

            // Skip if already visited
            if (visited[index]) continue;

            // Get current pixel color
            const currentColor = getPixelColor(pos);

            // Skip if color is too different from the starting color
            if (!colorsAreSimilar(currentColor, startColor)) continue;

            // Fill the current pixel
            pixels[pos] = replacementRGB.r;
            pixels[pos + 1] = replacementRGB.g;
            pixels[pos + 2] = replacementRGB.b;
            pixels[pos + 3] = replacementRGB.a || 255;

            visited[index] = 1;

            // Check adjacent pixels in all 8 directions
            const directions = [
                [1, 0],   // right
                [-1, 0],  // left
                [0, 1],   // down
                [0, -1],  // up
                [1, 1],   // down-right
                [-1, 1],  // down-left
                [1, -1],  // up-right
                [-1, -1]  // up-left
            ];

            // Process directions in a more natural order
            for (const [dx, dy] of directions) {
                const nx = currentX + dx;
                const ny = currentY + dy;
                
                if (isValidPixel(nx, ny)) {
                    const nPos = (ny * width + nx) * 4;
                    const neighborColor = getPixelColor(nPos);
                    
                    // Only add to queue if the neighbor color is similar to the starting color
                    if (colorsAreSimilar(neighborColor, startColor)) {
                        queue.push([nx, ny]);
                    }
                }
            }
        }

        // Apply the changes to the canvas
        activeLayer.putImageData(imageData);
    }

    boundaryFill(x, y, boundaryHex, fillHex) {
        const activeLayer = this.layerManager.getActiveLayer();
        if (!activeLayer || !activeLayer.visible || !activeLayer.ctx) return;
    
        const imageData = activeLayer.getImageData();
        const data = imageData.data;
        const width = activeLayer.canvas.width;
        const height = activeLayer.canvas.height;
    
        const getPos = (x, y) => (y * width + x) * 4;
    
        const hexToRGBA = (hex) => {
            const bigint = parseInt(hex.slice(1), 16);
            return {
                r: (bigint >> 16) & 255,
                g: (bigint >> 8) & 255,
                b: bigint & 255,
                a: 255
            };
        };
    
        const isSameColor = (pos, color) =>
            data[pos] === color.r &&
            data[pos + 1] === color.g &&
            data[pos + 2] === color.b &&
            data[pos + 3] === color.a;
    
        const boundary = hexToRGBA(boundaryHex);
        const fill = hexToRGBA(fillHex);
    
        const visited = new Uint8Array(width * height);
        const queue = [[x, y]];
    
        while (queue.length > 0) {
            const [cx, cy] = queue.pop();
            if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
    
            const pos = getPos(cx, cy);
            const index = cy * width + cx;
    
            if (visited[index]) continue;
    
            if (
                isSameColor(pos, boundary) ||
                isSameColor(pos, fill)
            ) continue;
    
            // Fill the pixel
            data[pos] = fill.r;
            data[pos + 1] = fill.g;
            data[pos + 2] = fill.b;
            data[pos + 3] = fill.a;
    
            visited[index] = 1;
    
            // Add 8-connected neighbors
            queue.push([cx + 1, cy]);
            queue.push([cx - 1, cy]);
            queue.push([cx, cy + 1]);
            queue.push([cx, cy - 1]);
            queue.push([cx + 1, cy + 1]);
            queue.push([cx - 1, cy + 1]);
            queue.push([cx + 1, cy - 1]);
            queue.push([cx - 1, cy - 1]);
        }
    
        activeLayer.putImageData(imageData);
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    rgbToHex(r, g, b) {
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    setTool(tool) {
        this.tool = tool;
        // Reset drawing state when switching tools
        this.resetDrawingState();
    }
}

/**
 * Manages the color palette and color selection
 */
class ColorPaletteManager {
    constructor(paletteSelector, callback) {
        this.paletteSelector = paletteSelector;
        this.callback = callback;
        this.defaultColors = [
            '#000000', '#DDDDDD', '#FF0000', '#00FF00', '#0000FF',
            '#FFFF00', '#FF00FF', '#00FFFF', '#2277BB', '#E74C3C'
        ];
        this.activeIndex = 0;
        this.init();
    }

    init() {
        let colors = JSON.parse(localStorage.getItem('paletteColors')) || this.defaultColors;
        localStorage.setItem('paletteColors', JSON.stringify(colors));

        for (let i = 0; i < 10; i++) {
            const picker = document.getElementById(`${this.paletteSelector}-${i}`);
            picker.value = colors[i];
            if (i === 0) picker.classList.add('active');

            this.setupPickerListeners(picker, i, colors);
        }

        this.callback(colors[0]);
    }

    setupPickerListeners(picker, index, colors) {
        // Handle color change
        picker.addEventListener('change', e => {
            colors[index] = e.target.value;
            localStorage.setItem('paletteColors', JSON.stringify(colors));
            if (index === this.activeIndex) {
                this.callback(e.target.value);
            }
        });

        // Handle click for color selection
        picker.addEventListener('click', e => {
            // If it's a right click, let the default behavior happen (showing color picker)
            if (e.button === 2) {
                return;
            }

            // For left click, prevent default and select color
            e.preventDefault();
            document.querySelectorAll('.color-picker').forEach(p => p.classList.remove('active'));
            picker.classList.add('active');
            this.activeIndex = index;
            this.callback(picker.value);
        });

        // Handle right click to show color picker
        picker.addEventListener('contextmenu', e => {
            e.preventDefault();
            picker.showPicker();
        });

        // Prevent double click from opening color picker
        picker.addEventListener('dblclick', e => e.preventDefault());
    }
}

/**
 * Main application class that initializes and coordinates all components
 */
class App {
    constructor() {
        this.config = null;
        this.container = null;
        this.wrapper = null;
        this.controller = null;
        this.layerManager = null;
        this.tool = null;
        this.palette = null;
        
        this.showConfigModal();
    }

    showConfigModal() {
        const configElements = this.getConfigElements();
        this.setupConfigModal(configElements);
        configElements.modal.classList.add('show');
    }

    initialize(config) {
        this.config = config;
        this.setupContainer();
        this.initCanvasLayers();
        this.initComponents();
    }

    setupContainer() {
        this.container = document.querySelector('.canvas-container');
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'canvas-wrapper';
        this.container.appendChild(this.wrapper);
    }

    initComponents() {
        this.controller = new CanvasController(this.wrapper, this.container);
        this.layerManager.drawGridlines();
        this.tool = new DrawingTool(this.layerManager, this.config.scaleFactor, this.container, this.controller);
        this.palette = new ColorPaletteManager('color-picker', color => this.tool.setColor(color));
        this.initToolSelection();
    }

    initToolSelection() {
        const tools = {
            'pencil': document.getElementById('pencil'),
            'brush': document.getElementById('brush'),
            'fill': document.getElementById('fill'),
            'eraser': document.getElementById('eraser')
        };

        Object.entries(tools).forEach(([tool, button]) => {
            if (button) {
                button.addEventListener('click', () => {
                    // Remove active class from all tools
                    Object.values(tools).forEach(btn => btn?.classList.remove('active'));
                    // Add active class to selected tool
                    button.classList.add('active');
                    // Set the tool
                    this.tool.setTool(tool);
                });
            }
        });
    }

    initCanvasLayers(skipInitialState = false) {
        this.cleanupExistingCanvases();
        this.createBaseCanvases();
        this.createInitialDrawableLayer();
        this.initializeLayerManager(skipInitialState);
    }

    cleanupExistingCanvases() {
        const existingDrawableCanvases = this.wrapper.querySelectorAll('canvas[data-canvas-type="drawable"]');
        existingDrawableCanvases.forEach(canvas => canvas.remove());
        this.wrapper.innerHTML = '';
    }

    createBaseCanvases() {
        const baseCanvases = {
            background: { id: 'backgroundLayout', fill: '#fff' },
            grid: { id: 'gridlineLayout' },
            cursor: { id: 'cursorLayout' }
        };

        Object.values(baseCanvases).forEach(canvasConfig => {
            const canvas = document.createElement('canvas');
            canvas.id = canvasConfig.id;
            if (canvasConfig.fill) {
                canvas.style.backgroundColor = canvasConfig.fill;
            }
            this.wrapper.appendChild(canvas);
        });
    }

    createInitialDrawableLayer() {
        const mainLayer = document.createElement('canvas');
        mainLayer.id = 'mainLayer';
        mainLayer.setAttribute('data-canvas-type', 'drawable');
        mainLayer.setAttribute('data-canvas-name', 'Background');
        this.wrapper.appendChild(mainLayer);
    }

    initializeLayerManager(skipInitialState) {
        this.layerManager = new CanvasLayerManager(
            this.config.scaleFactor,
            this.config.canvasSize,
            skipInitialState
        );
    }

    getConfigElements() {
        return {
            button: document.getElementById('config'),
            modal: document.getElementById('config-modal'),
            pixelSize: document.getElementById('pixel-size'),
            canvasWidth: document.getElementById('canvas-width'),
            canvasHeight: document.getElementById('canvas-height'),
            saveButton: document.getElementById('save-config'),
            cancelButton: document.getElementById('cancel-config'),
            closeButton: document.getElementById('config-modal').querySelector('.close-modal')
        };
    }

    setupConfigModal(elements) {
        this.setInitialConfigValues(elements);
        this.setupConfigEventListeners(elements);
    }

    setInitialConfigValues(elements) {
        elements.pixelSize.value = '10';
        elements.canvasWidth.value = '350';
        elements.canvasHeight.value = '350';
    }

    setupConfigEventListeners(elements) {
        elements.button.addEventListener('click', () => elements.modal.classList.add('show'));

        const closeModal = () => {
            elements.modal.classList.remove('show');
            this.resetConfigInputs(elements);
        };

        elements.closeButton.addEventListener('click', closeModal);
        elements.cancelButton.addEventListener('click', closeModal);
        elements.modal.addEventListener('click', e => {
            if (e.target === elements.modal) closeModal();
        });

        elements.saveButton.addEventListener('click', () => this.handleConfigSave(elements));
    }

    resetConfigInputs(elements) {
        elements.pixelSize.value = '10';
        elements.canvasWidth.value = '350';
        elements.canvasHeight.value = '350';
    }

    handleConfigSave(elements) {
        const newConfig = this.validateConfigInputs(elements);
        if (!newConfig) return;

        elements.modal.classList.remove('show');
        this.initialize({
            scaleFactor: newConfig.newScaleFactor,
            canvasSize: [newConfig.newWidth, newConfig.newHeight]
        });
    }

    validateConfigInputs(elements) {
        const newScaleFactor = parseInt(elements.pixelSize.value);
        const newWidth = parseInt(elements.canvasWidth.value);
        const newHeight = parseInt(elements.canvasHeight.value);

        if (newScaleFactor < 1 || newScaleFactor > 50) {
            alert('Pixel size must be between 1 and 50');
            return null;
        }

        if (newWidth < 1 || newWidth > 2000 || newHeight < 1 || newHeight > 2000) {
            alert('Canvas dimensions must be between 1 and 2000');
            return null;
        }

        return { newScaleFactor, newWidth, newHeight };
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => new App());
