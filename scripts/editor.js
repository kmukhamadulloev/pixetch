/**
 * Represents a single canvas layer in the editor
 */
class CanvasLayer {
    constructor(id, scaleFactor, width, height, fill = null) {
        this.canvas = document.getElementById(id);
        this.id = id;
        this.scaleFactor = scaleFactor;
        this.logicalWidth = width;
        this.logicalHeight = height;
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
        this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
    }

    drawPixel(x, y, color = '#000') {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y, 1, 1);
    }

    clearPixel(x, y) {
        this.ctx.clearRect(x, y, 1, 1);
    }

    drawGrid(scaleFactor) {
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.fillStyle = '#888';

        for (let x = 0; x < this.canvas.width; x += scaleFactor) {
            for (let y = 0; y < this.canvas.height; y += scaleFactor) {
                this.ctx.fillRect(x, y, 1, 1);
            }
        }

        this.ctx.restore();
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

    drawCanvasContent(sourceCanvas, offsetX = 0, offsetY = 0) {
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(sourceCanvas, offsetX, offsetY);
        this.ctx.restore();
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
        this.maxHistoryBytes = 64 * 1024 * 1024;
        this.currentBytes = 0;
        this.historyList = document.getElementById('history-list');
    }

    reset() {
        this.history = [];
        this.currentIndex = -1;
        this.currentBytes = 0;
        this.historyList.innerHTML = '';
    }

    addHistoryItem(action) {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.dataset.historyIndex = String(this.history.length - 1);
        
        const icon = this.getActionIcon(action);
        item.innerHTML = `<i class="fas ${icon}"></i><span>${action}</span>`;
        item.onclick = () => {
            const index = Number(item.dataset.historyIndex);
            if (index > this.currentIndex) return;
            const state = this.jumpToState(index);
            if (state && this.onStateSelected) {
                this.onStateSelected(state);
            }
        };

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
            item.dataset.historyIndex = String(i);
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
        const futureStates = this.history.slice(this.currentIndex + 1);
        futureStates.forEach(state => {
            this.currentBytes -= state.sizeBytes || 0;
        });
        this.history = this.history.slice(0, this.currentIndex + 1);
        
        const items = this.historyList.children;
        while (items.length > this.currentIndex + 1) {
            this.historyList.removeChild(items[this.currentIndex + 1]);
        }
    }

    pushState(state, action = 'Drawing', sizeBytes = 0) {
        if (this.currentIndex < this.history.length - 1) {
            this.clearFutureStates();
        }

        state.sizeBytes = sizeBytes;
        this.history.push(state);
        this.currentIndex++;
        this.currentBytes += sizeBytes;

        while (
            this.history.length > this.maxHistory ||
            (this.currentBytes > this.maxHistoryBytes && this.history.length > 1)
        ) {
            const removedState = this.history.shift();
            this.currentBytes -= removedState.sizeBytes || 0;
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
        this.spacePressed = false;
        this.boundHandlers = {};

        this.centerCanvas();
        this.initZoom();
        this.initPan();
        this.initKeyboardPan();
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
        this.boundHandlers.wheel = e => {
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
        };

        this.container.addEventListener('wheel', this.boundHandlers.wheel);
    }

    initPan() {
        this.boundHandlers.mouseDown = e => {
            if (e.button === 1 || (e.button === 0 && this.spacePressed)) {
                this.isDragging = true;
                this.startX = e.clientX - this.translateX;
                this.startY = e.clientY - this.translateY;
                this.container.classList.add('dragging');
                e.preventDefault();
            }
        };
        this.container.addEventListener('mousedown', this.boundHandlers.mouseDown);

        this.boundHandlers.stopDrag = () => {
                this.isDragging = false;
                this.container.classList.remove('dragging');
            };
        ['mouseup', 'mouseleave'].forEach(evt =>
            this.container.addEventListener(evt, this.boundHandlers.stopDrag)
        );

        this.boundHandlers.mouseMove = e => {
            if (!this.isDragging) return;
            this.translateX = e.clientX - this.startX;
            this.translateY = e.clientY - this.startY;
            this.updateTransform();
        };
        this.container.addEventListener('mousemove', this.boundHandlers.mouseMove);
    }

    initKeyboardPan() {
        this.boundHandlers.keyDown = e => {
            if (e.code === 'Space' && !this.isTypingInField(e.target)) {
                this.spacePressed = true;
                this.container.classList.add('space-pan');
                e.preventDefault();
            }
        };
        document.addEventListener('keydown', this.boundHandlers.keyDown);

        this.boundHandlers.keyUp = e => {
            if (e.code === 'Space') {
                this.spacePressed = false;
                this.container.classList.remove('space-pan');
            }
        };
        document.addEventListener('keyup', this.boundHandlers.keyUp);

        this.boundHandlers.blur = () => {
            this.spacePressed = false;
            this.isDragging = false;
            this.container.classList.remove('space-pan', 'dragging');
        };
        window.addEventListener('blur', this.boundHandlers.blur);
    }

    isTypingInField(target) {
        return target instanceof HTMLElement &&
            (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable);
    }

    destroy() {
        this.container.removeEventListener('wheel', this.boundHandlers.wheel);
        this.container.removeEventListener('mousedown', this.boundHandlers.mouseDown);
        this.container.removeEventListener('mousemove', this.boundHandlers.mouseMove);
        ['mouseup', 'mouseleave'].forEach(evt =>
            this.container.removeEventListener(evt, this.boundHandlers.stopDrag)
        );
        document.removeEventListener('keydown', this.boundHandlers.keyDown);
        document.removeEventListener('keyup', this.boundHandlers.keyUp);
        window.removeEventListener('blur', this.boundHandlers.blur);
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
        this.historyManager.onStateSelected = state => this.restoreState(state);
        
        if (!skipInitialState) {
            this.saveState('Initial State');
        }
        
        this.initLayersList();
        this.initAddLayerButton();
        this.initMergeLayerButton();
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

        this.modal.querySelector('.close-modal').onclick = closeModal;
        document.getElementById('cancel-rename').onclick = closeModal;

        document.getElementById('save-rename').onclick = () => {
            if (this.currentEditingLayer) {
                const newName = this.nameInput.value.trim();
                if (newName) {
                    this.currentEditingLayer.setName(newName);
                    this.initLayersList();
                    this.saveState();
                }
            }
            closeModal();
        };

        this.modal.onclick = e => {
            if (e.target === this.modal) {
                closeModal();
            }
        };

        this.nameInput.onkeypress = e => {
            if (e.key === 'Enter') {
                document.getElementById('save-rename').click();
            }
        };
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
        let stateBytes = 0;
        const state = {
            canvasSize: [...this.canvasSize],
            layers: this.drawableLayers.map(layer => {
                const imageData = layer.getImageData();
                stateBytes += imageData.data.byteLength;

                return {
                    id: layer.id,
                    imageData,
                    visible: layer.visible,
                    name: layer.name
                };
            }),
            activeLayerId: this.activeLayer.id
        };

        let actionText = action;
        if (layer) {
            actionText = `${action} on "${layer.name}"`;
        }
        this.historyManager.pushState(state, actionText, stateBytes);
    }

    restoreState(state) {
        if (!state) return;

        if (state.canvasSize) {
            this.canvasSize = [...state.canvasSize];
        }

        this.cleanupExistingLayers();
        this.restoreLayersFromState(state);
        this.updateLayerZIndices();
        this.syncNextLayerId();
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
            this.nextLayerId++;
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

    captureArtworkSnapshot() {
        return {
            canvasSize: [...this.canvasSize],
            layers: this.drawableLayers.map(layer => {
                const snapshotCanvas = document.createElement('canvas');
                snapshotCanvas.width = layer.canvas.width;
                snapshotCanvas.height = layer.canvas.height;
                const snapshotCtx = snapshotCanvas.getContext('2d');
                snapshotCtx.imageSmoothingEnabled = false;
                snapshotCtx.drawImage(layer.canvas, 0, 0);

                return {
                    id: layer.id,
                    name: layer.name,
                    visible: layer.visible,
                    canvas: snapshotCanvas
                };
            }),
            activeLayerId: this.activeLayer?.id || null
        };
    }

    restoreArtworkSnapshot(snapshot, anchor = 'middle-center') {
        if (!snapshot?.layers?.length) return;

        this.cleanupExistingLayers();
        const [oldWidth, oldHeight] = snapshot.canvasSize || this.canvasSize;
        const [offsetX, offsetY] = this.getAnchorOffset(
            anchor,
            oldWidth,
            oldHeight,
            this.canvasSize[0],
            this.canvasSize[1]
        );

        snapshot.layers.forEach(layerState => {
            this.createCanvasFromState(layerState);
            const layer = new CanvasLayer(layerState.id, this.scaleFactor, ...this.canvasSize);
            layer.setName(layerState.name);
            layer.setVisibility(layerState.visible);
            layer.drawCanvasContent(layerState.canvas, offsetX, offsetY);
            this.drawableLayers.push(layer);
        });

        const activeLayer = this.drawableLayers.find(layer => layer.id === snapshot.activeLayerId);
        this.activeLayer = activeLayer || this.drawableLayers[this.drawableLayers.length - 1];
        this.updateLayerZIndices();
        this.syncNextLayerId();
        this.initLayersList();
        this.clearHistory();
    }

    getAnchorOffset(anchor, oldWidth, oldHeight, newWidth, newHeight) {
        const horizontalMap = {
            left: 0,
            center: Math.round((newWidth - oldWidth) / 2),
            right: newWidth - oldWidth
        };
        const verticalMap = {
            top: 0,
            middle: Math.round((newHeight - oldHeight) / 2),
            bottom: newHeight - oldHeight
        };
        const [vertical = 'middle', horizontal = 'center'] = anchor.split('-');
        return [
            horizontalMap[horizontal] ?? horizontalMap.center,
            verticalMap[vertical] ?? verticalMap.middle
        ];
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
            addButton.onclick = () => this.createNewLayer();
        }
    }

    initMergeLayerButton() {
        const mergeButton = document.getElementById('merge-layer');
        if (mergeButton) {
            mergeButton.onclick = () => this.mergeActiveLayerDown();
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

    mergeActiveLayerDown() {
        if (!this.activeLayer) return;

        const activeIndex = this.drawableLayers.indexOf(this.activeLayer);
        if (activeIndex <= 0) {
            alert('Select a layer above another layer to merge down');
            return;
        }

        const sourceLayer = this.activeLayer;
        const targetLayer = this.drawableLayers[activeIndex - 1];

        targetLayer.ctx.save();
        targetLayer.ctx.setTransform(1, 0, 0, 1, 0, 0);
        targetLayer.ctx.imageSmoothingEnabled = false;
        targetLayer.ctx.drawImage(sourceLayer.canvas, 0, 0);
        targetLayer.ctx.restore();

        const sourceCanvas = document.getElementById(sourceLayer.id);
        if (sourceCanvas) {
            sourceCanvas.remove();
        }

        this.drawableLayers.splice(activeIndex, 1);
        this.setActiveLayer(targetLayer);
        this.updateLayerZIndices();
        this.initLayersList();
        this.saveState('Merged layer', targetLayer);
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
            undoButton.onclick = () => {
                const state = this.historyManager.undo();
                if (state) {
                    this.restoreState(state);
                }
            };
        }

        if (redoButton) {
            redoButton.onclick = () => {
                const state = this.historyManager.redo();
                if (state) {
                    this.restoreState(state);
                }
            };
        }
    }

    initExportButton() {
        const exportButton = document.getElementById('export');
        if (exportButton) {
            exportButton.onclick = () => this.exportImage();
        }
    }

    exportImage() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvasSize[0];
        tempCanvas.height = this.canvasSize[1];
        const tempCtx = tempCanvas.getContext('2d');

        this.drawableLayers.forEach(layer => {
            if (layer.visible) {
                tempCtx.drawImage(layer.canvas, 0, 0);
            }
        });

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

    clearHistory() {
        this.historyManager.reset();
        this.saveState('Initial State');
    }

    syncNextLayerId() {
        const maxLayerNumber = this.drawableLayers.reduce((max, layer) => {
            const match = layer.id.match(/(\d+)$/);
            return match ? Math.max(max, Number(match[1]) + 1) : max;
        }, 1);
        this.nextLayerId = maxLayerNumber;
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

        if (erasing) {
            activeLayer.clearPixel(x, y);
            return;
        }

        if (this.tool === 'brush') {
            this.drawBrushStroke(activeLayer, x, y);
            return;
        }

        activeLayer.drawPixel(x, y, this.color);
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
        if (this.controller.spacePressed) return;
        const { translateX, translateY, scale } = this.controller.getTransform();
        const [x, y] = this.getCanvasCoordinates(e, translateX, translateY, scale);

        if (this.tool === 'fill') {
            const activeLayer = this.layerManager.getActiveLayer();
            this.floodFill(x, y, activeLayer, this.color);
            this.layerManager.saveState('Fill', activeLayer);
            return;
        }

        this.drawing = true;
        this.erasing = e.button === 2;
        this.lastX = x;
        this.lastY = y;
        this.hasDrawn = false;
        this.drawPixel(x, y, this.erasing);
    }

    drawBrushStroke(layer, x, y) {
        const radius = 1;
        for (let offsetY = -radius; offsetY <= radius; offsetY++) {
            for (let offsetX = -radius; offsetX <= radius; offsetX++) {
                if (offsetX * offsetX + offsetY * offsetY <= radius * radius + 0.2) {
                    layer.drawPixel(x + offsetX, y + offsetY, this.color);
                }
            }
        }
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

    floodFill(x, y, activeLayer, replacementColor) {
        if (!activeLayer || !activeLayer.visible || !activeLayer.ctx) return;

        const imageData = activeLayer.getImageData();
        const pixels = imageData.data;
        const scaleFactor = activeLayer.scaleFactor;
        const width = Math.floor(activeLayer.canvas.width / scaleFactor);
        const height = Math.floor(activeLayer.canvas.height / scaleFactor);
        const replacementRGBA = this.parseColorToRgba(replacementColor);
        if (!replacementRGBA) return;
        const targetRGBA = this.getCellColor(pixels, activeLayer.canvas.width, scaleFactor, x, y);

        if (this.rgbaEquals(targetRGBA, replacementRGBA)) return;

        const visited = new Uint8Array(width * height);
        const queue = [[x, y]];
        let queueIndex = 0;

        const isValidPixel = (px, py) => {
            if (px < 0 || px >= width || py < 0 || py >= height) return false;
            const index = py * width + px;
            return !visited[index];
        };

        while (queueIndex < queue.length) {
            const [currentX, currentY] = queue[queueIndex++];
            const index = currentY * width + currentX;

            if (visited[index]) continue;

            const currentColor = this.getCellColor(
                pixels,
                activeLayer.canvas.width,
                scaleFactor,
                currentX,
                currentY
            );
            if (!this.rgbaEquals(currentColor, targetRGBA)) continue;

            this.fillCellColor(
                pixels,
                activeLayer.canvas.width,
                scaleFactor,
                currentX,
                currentY,
                replacementRGBA
            );

            visited[index] = 1;

            const directions = [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1]
            ];

            for (const [dx, dy] of directions) {
                const nx = currentX + dx;
                const ny = currentY + dy;
                
                if (isValidPixel(nx, ny)) {
                    queue.push([nx, ny]);
                }
            }
        }

        activeLayer.putImageData(imageData);
    }

    getCellColor(pixels, canvasWidth, scaleFactor, x, y) {
        const sampleX = x * scaleFactor;
        const sampleY = y * scaleFactor;
        const pos = (sampleY * canvasWidth + sampleX) * 4;

        return {
            r: pixels[pos],
            g: pixels[pos + 1],
            b: pixels[pos + 2],
            a: pixels[pos + 3]
        };
    }

    fillCellColor(pixels, canvasWidth, scaleFactor, x, y, color) {
        const startX = x * scaleFactor;
        const startY = y * scaleFactor;

        for (let offsetY = 0; offsetY < scaleFactor; offsetY++) {
            for (let offsetX = 0; offsetX < scaleFactor; offsetX++) {
                const pos = ((startY + offsetY) * canvasWidth + startX + offsetX) * 4;
                pixels[pos] = color.r;
                pixels[pos + 1] = color.g;
                pixels[pos + 2] = color.b;
                pixels[pos + 3] = color.a;
            }
        }
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    hexToRgba(hex) {
        const rgb = this.hexToRgb(hex);
        return rgb ? { ...rgb, a: 255 } : null;
    }

    parseColorToRgba(color) {
        if (typeof color !== 'string') return null;

        const hexColor = this.hexToRgba(color);
        if (hexColor) return hexColor;

        const normalized = color.trim().toLowerCase();
        if (!normalized.startsWith('rgb(') && !normalized.startsWith('rgba(')) {
            return null;
        }

        const start = normalized.indexOf('(');
        const end = normalized.lastIndexOf(')');
        if (start === -1 || end === -1 || end <= start + 1) {
            return null;
        }

        const parts = normalized.slice(start + 1, end).split(',').map(part => part.trim());
        if (parts.length < 3 || parts.length > 4) {
            return null;
        }

        const [r, g, b, alpha = '1'] = parts;
        const alphaValue = Number(alpha);

        return {
            r: this.clampChannel(Number(r)),
            g: this.clampChannel(Number(g)),
            b: this.clampChannel(Number(b)),
            a: this.clampAlpha(alphaValue <= 1 ? Math.round(alphaValue * 255) : alphaValue)
        };
    }

    rgbaEquals(colorA, colorB) {
        return colorA.r === colorB.r &&
            colorA.g === colorB.g &&
            colorA.b === colorB.b &&
            colorA.a === colorB.a;
    }

    clampChannel(value) {
        return Math.min(255, Math.max(0, Math.round(value)));
    }

    clampAlpha(value) {
        return Math.min(255, Math.max(0, Math.round(value)));
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
            { r: 0, g: 0, b: 0, a: 255 },
            { r: 221, g: 221, b: 221, a: 255 },
            { r: 255, g: 0, b: 0, a: 255 },
            { r: 0, g: 255, b: 0, a: 255 },
            { r: 0, g: 0, b: 255, a: 255 },
            { r: 255, g: 255, b: 0, a: 255 },
            { r: 255, g: 0, b: 255, a: 255 },
            { r: 0, g: 255, b: 255, a: 255 },
            { r: 34, g: 119, b: 187, a: 255 },
            { r: 231, g: 76, b: 60, a: 255 }
        ];
        this.activeIndex = 0;
        this.colorModal = document.getElementById('color-edit-modal');
        this.colorSurface = document.getElementById('color-surface');
        this.colorSurfaceCursor = document.getElementById('color-surface-cursor');
        this.hueInput = document.getElementById('color-hue');
        this.alphaInput = document.getElementById('color-alpha');
        this.hexInput = document.getElementById('color-hex');
        this.alphaNumberInput = document.getElementById('color-alpha-input');
        this.opacityNumberInput = document.getElementById('color-opacity-input');
        this.rInput = document.getElementById('color-r');
        this.gInput = document.getElementById('color-g');
        this.bInput = document.getElementById('color-b');
        this.currentPreview = document.getElementById('color-preview-current');
        this.nextPreview = document.getElementById('color-preview-next');
        this.editingIndex = null;
        this.currentEditColor = null;
        this.originalEditColor = null;
        this.isDraggingSurface = false;
        this.isUpdatingControls = false;
        this.init();
    }

    init() {
        let colors = this.normalizeStoredColors(JSON.parse(localStorage.getItem('paletteColors')));
        this.colors = colors;
        this.persistColors();

        for (let i = 0; i < 10; i++) {
            const picker = document.getElementById(`${this.paletteSelector}-${i}`);
            this.renderPicker(picker, colors[i]);
            if (i === 0) picker.classList.add('active');

            this.setupPickerListeners(picker, i, colors);
        }

        this.setupColorModalListeners();
        this.callback(this.toCssColor(colors[0]));
    }

    setupColorModalListeners() {
        const closeModal = () => {
            this.colorModal.classList.remove('show');
            this.editingIndex = null;
            this.originalEditColor = null;
            this.currentEditColor = null;
        };

        this.colorModal.querySelector('.close-modal').onclick = closeModal;
        document.getElementById('cancel-color-edit').onclick = closeModal;
        this.colorModal.onclick = e => {
            if (e.target === this.colorModal) {
                closeModal();
            }
        };

        document.getElementById('save-color-edit').onclick = () => {
            if (this.editingIndex === null) {
                closeModal();
                return;
            }

            const picker = document.getElementById(`${this.paletteSelector}-${this.editingIndex}`);
            const nextColor = this.cloneColor(this.currentEditColor);
            this.colors[this.editingIndex] = nextColor;
            this.renderPicker(picker, nextColor);
            this.persistColors();

            if (this.editingIndex === this.activeIndex) {
                this.callback(this.toCssColor(nextColor));
            }

            closeModal();
        };

        this.setupColorSurfaceInteractions();
        this.hueInput.oninput = () => {
            if (!this.currentEditColor) return;
            const hsv = this.rgbToHsv(this.currentEditColor);
            const next = this.hsvToRgb(Number(this.hueInput.value), hsv.s, hsv.v);
            this.currentEditColor = { ...this.currentEditColor, ...next };
            this.syncColorModalFromState('surface');
        };

        this.alphaInput.oninput = () => {
            if (!this.currentEditColor) return;
            this.currentEditColor.a = Math.round((Number(this.alphaInput.value) / 100) * 255);
            this.syncColorModalFromState();
        };

        this.hexInput.oninput = () => {
            const parsed = this.parseHex(this.hexInput.value);
            if (!parsed || !this.currentEditColor) return;
            this.currentEditColor = { ...this.currentEditColor, ...parsed };
            this.syncColorModalFromState('rgb');
        };

        [this.rInput, this.gInput, this.bInput].forEach((input, channelIndex) => {
            input.oninput = () => {
                if (!this.currentEditColor || this.isUpdatingControls) return;
                const channelNames = ['r', 'g', 'b'];
                const channel = channelNames[channelIndex];
                this.currentEditColor[channel] = this.clamp(Number(input.value), 0, 255);
                this.syncColorModalFromState('rgb');
            };
        });

        this.alphaNumberInput.oninput = () => {
            if (!this.currentEditColor || this.isUpdatingControls) return;
            this.currentEditColor.a = this.clamp(Number(this.alphaNumberInput.value), 0, 255);
            this.syncColorModalFromState();
        };

        this.opacityNumberInput.oninput = () => {
            if (!this.currentEditColor || this.isUpdatingControls) return;
            const alpha = Math.round((this.clamp(Number(this.opacityNumberInput.value), 0, 100) / 100) * 255);
            this.currentEditColor.a = alpha;
            this.syncColorModalFromState();
        };
    }

    setActiveColor(index) {
        const picker = document.getElementById(`${this.paletteSelector}-${index}`);
        document.querySelectorAll('.color-picker').forEach(colorPicker => colorPicker.classList.remove('active'));
        picker.classList.add('active');
        this.activeIndex = index;
        this.callback(this.toCssColor(this.colors[index]));
    }

    openColorModal(index) {
        this.editingIndex = index;
        this.setActiveColor(index);
        this.originalEditColor = this.cloneColor(this.colors[index]);
        this.currentEditColor = this.cloneColor(this.colors[index]);
        this.syncColorModalFromState();
        this.colorModal.classList.add('show');
    }

    setupPickerListeners(picker, index, colors) {
        picker.onmousedown = e => {
            if (e.button === 0) {
                e.preventDefault();
            }
        };

        picker.onchange = e => {
            const parsed = this.parseHex(e.target.value);
            if (!parsed) return;
            colors[index] = { ...colors[index], ...parsed };
            this.renderPicker(picker, colors[index]);
            this.persistColors();
            if (index === this.activeIndex) {
                this.callback(this.toCssColor(colors[index]));
            }
        };

        picker.onclick = e => {
            e.preventDefault();
            this.setActiveColor(index);
        };

        picker.oncontextmenu = e => {
            e.preventDefault();
            this.openColorModal(index);
        };

        picker.ondblclick = e => {
            e.preventDefault();
            this.openColorModal(index);
        };
    }

    setCallback(callback) {
        this.callback = callback;
        const activeColor = this.colors[this.activeIndex];
        if (activeColor) {
            this.callback(this.toCssColor(activeColor));
        }
    }

    setupColorSurfaceInteractions() {
        const updateFromPointer = e => {
            if (!this.currentEditColor) return;
            const rect = this.colorSurface.getBoundingClientRect();
            const x = this.clamp(e.clientX - rect.left, 0, rect.width);
            const y = this.clamp(e.clientY - rect.top, 0, rect.height);
            const saturation = rect.width === 0 ? 0 : x / rect.width;
            const value = rect.height === 0 ? 0 : 1 - (y / rect.height);
            const hue = Number(this.hueInput.value);
            const nextRgb = this.hsvToRgb(hue, saturation, value);
            this.currentEditColor = { ...this.currentEditColor, ...nextRgb };
            this.syncColorModalFromState('surface');
        };

        this.colorSurface.onmousedown = e => {
            this.isDraggingSurface = true;
            updateFromPointer(e);
        };

        window.addEventListener('mousemove', e => {
            if (!this.isDraggingSurface) return;
            updateFromPointer(e);
        });

        window.addEventListener('mouseup', () => {
            this.isDraggingSurface = false;
        });
    }

    syncColorModalFromState(source = 'all') {
        if (!this.currentEditColor) return;

        this.isUpdatingControls = true;
        const { r, g, b, a } = this.currentEditColor;
        const hsv = this.rgbToHsv(this.currentEditColor);

        if (source !== 'surface') {
            this.hueInput.value = String(Math.round(hsv.h));
        }

        this.colorSurface.style.backgroundImage = [
            'linear-gradient(to top, black, transparent)',
            `linear-gradient(to right, white, hsl(${Math.round(hsv.h)} 100% 50%))`
        ].join(', ');

        this.colorSurfaceCursor.style.left = `${hsv.s * 100}%`;
        this.colorSurfaceCursor.style.top = `${(1 - hsv.v) * 100}%`;
        this.alphaInput.value = String(Math.round((a / 255) * 100));
        this.alphaInput.style.background = `linear-gradient(90deg, rgba(${r}, ${g}, ${b}, 0), rgba(${r}, ${g}, ${b}, 1))`;
        this.hexInput.value = this.rgbToHex(r, g, b);
        this.rInput.value = String(r);
        this.gInput.value = String(g);
        this.bInput.value = String(b);
        this.alphaNumberInput.value = String(a);
        this.opacityNumberInput.value = String(Math.round((a / 255) * 100));
        this.currentPreview.style.setProperty('--preview-color', this.toCssColor(this.originalEditColor || this.currentEditColor));
        this.nextPreview.style.setProperty('--preview-color', this.toCssColor(this.currentEditColor));
        this.isUpdatingControls = false;
    }

    renderPicker(picker, color) {
        picker.value = this.rgbToHex(color.r, color.g, color.b);
        picker.style.opacity = `${Math.max(0.25, color.a / 255)}`;
        picker.title = `${this.rgbToHex(color.r, color.g, color.b)} · ${Math.round((color.a / 255) * 100)}%`;
    }

    persistColors() {
        localStorage.setItem('paletteColors', JSON.stringify(this.colors));
    }

    normalizeStoredColors(storedColors) {
        if (!Array.isArray(storedColors) || storedColors.length !== 10) {
            return this.defaultColors.map(color => ({ ...color }));
        }

        return storedColors.map((color, index) => {
            if (typeof color === 'string') {
                const parsed = this.parseHex(color);
                return parsed ? { ...parsed, a: 255 } : { ...this.defaultColors[index] };
            }

            if (color && typeof color === 'object') {
                return {
                    r: this.clamp(Number(color.r), 0, 255),
                    g: this.clamp(Number(color.g), 0, 255),
                    b: this.clamp(Number(color.b), 0, 255),
                    a: this.clamp(color.a ?? 255, 0, 255)
                };
            }

            return { ...this.defaultColors[index] };
        });
    }

    parseHex(hex) {
        const match = /^#?([a-f\d]{6})$/i.exec((hex || '').trim());
        if (!match) return null;
        const value = match[1];
        return {
            r: parseInt(value.slice(0, 2), 16),
            g: parseInt(value.slice(2, 4), 16),
            b: parseInt(value.slice(4, 6), 16)
        };
    }

    rgbToHex(r, g, b) {
        return `#${[r, g, b].map(value => this.clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')).join('')}`;
    }

    toCssColor(color) {
        const safeColor = color || { r: 0, g: 0, b: 0, a: 255 };
        return `rgba(${safeColor.r}, ${safeColor.g}, ${safeColor.b}, ${(safeColor.a / 255).toFixed(3)})`;
    }

    rgbToHsv(color) {
        const r = color.r / 255;
        const g = color.g / 255;
        const b = color.b / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        let hue = 0;

        if (delta !== 0) {
            if (max === r) {
                hue = 60 * (((g - b) / delta) % 6);
            } else if (max === g) {
                hue = 60 * (((b - r) / delta) + 2);
            } else {
                hue = 60 * (((r - g) / delta) + 4);
            }
        }

        if (hue < 0) hue += 360;

        return {
            h: hue,
            s: max === 0 ? 0 : delta / max,
            v: max
        };
    }

    hsvToRgb(h, s, v) {
        const chroma = v * s;
        const huePrime = (h % 360) / 60;
        const second = chroma * (1 - Math.abs((huePrime % 2) - 1));
        let r1 = 0;
        let g1 = 0;
        let b1 = 0;

        if (huePrime >= 0 && huePrime < 1) {
            r1 = chroma;
            g1 = second;
        } else if (huePrime < 2) {
            r1 = second;
            g1 = chroma;
        } else if (huePrime < 3) {
            g1 = chroma;
            b1 = second;
        } else if (huePrime < 4) {
            g1 = second;
            b1 = chroma;
        } else if (huePrime < 5) {
            r1 = second;
            b1 = chroma;
        } else {
            r1 = chroma;
            b1 = second;
        }

        const match = v - chroma;
        return {
            r: Math.round((r1 + match) * 255),
            g: Math.round((g1 + match) * 255),
            b: Math.round((b1 + match) * 255)
        };
    }

    cloneColor(color) {
        return { ...color };
    }

    clamp(value, min, max) {
        if (Number.isNaN(value)) return min;
        return Math.min(max, Math.max(min, Math.round(value)));
    }
}

/**
 * Main application class that initializes and coordinates all components
 */
class App {
    constructor() {
        this.defaultConfig = {
            scaleFactor: 10,
            canvasSize: [350, 350]
        };
        this.config = { ...this.defaultConfig, canvasSize: [...this.defaultConfig.canvasSize] };
        this.resizeAnchor = 'middle-center';
        this.container = null;
        this.wrapper = null;
        this.controller = null;
        this.layerManager = null;
        this.tool = null;
        this.palette = null;
        this.configElements = this.getConfigElements();

        this.setupConfigModal(this.configElements);
        this.initToolSelection();
        this.initKeyboardShortcuts();
        this.palette = new ColorPaletteManager('color-picker', color => this.tool?.setColor(color));
        this.showConfigModal();
    }

    showConfigModal() {
        this.resetConfigInputs(this.configElements);
        this.configElements.modal.classList.add('show');
    }

    initialize(config) {
        this.config = config;
        this.setupContainer();
        this.initCanvasLayers();
        this.initComponents();
    }

    setupContainer() {
        this.container = document.querySelector('.canvas-container');
        this.wrapper = this.container.querySelector('.canvas-wrapper');

        if (!this.wrapper) {
            this.wrapper = document.createElement('div');
            this.wrapper.className = 'canvas-wrapper';
            this.container.appendChild(this.wrapper);
        }
    }

    initComponents() {
        this.controller?.destroy();
        this.controller = new CanvasController(this.wrapper, this.container);
        this.layerManager.drawGridlines();
        this.tool = new DrawingTool(this.layerManager, this.config.scaleFactor, this.container, this.controller);
        this.palette.setCallback(color => this.tool.setColor(color));
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
                button.onclick = () => {
                    // Remove active class from all tools
                    Object.values(tools).forEach(btn => btn?.classList.remove('active'));
                    // Add active class to selected tool
                    button.classList.add('active');
                    // Set the tool
                    this.tool?.setTool(tool);
                };
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
            resizeAnchor: document.getElementById('resize-anchor'),
            saveButton: document.getElementById('save-config'),
            cancelButton: document.getElementById('cancel-config'),
            closeButton: document.getElementById('config-modal').querySelector('.close-modal')
        };
    }

    setupConfigModal(elements) {
        this.setInitialConfigValues(elements);
        this.setupAnchorSelection(elements.resizeAnchor);
        this.setupConfigEventListeners(elements);
    }

    setupAnchorSelection(anchorGrid) {
        if (!anchorGrid || anchorGrid.dataset.initialized === 'true') return;

        anchorGrid.dataset.initialized = 'true';
        anchorGrid.querySelectorAll('.anchor-point').forEach(button => {
            button.onclick = () => {
                this.resizeAnchor = button.dataset.anchor || 'middle-center';
                this.syncAnchorSelection(anchorGrid);
            };
        });
    }

    syncAnchorSelection(anchorGrid) {
        if (!anchorGrid) return;

        anchorGrid.querySelectorAll('.anchor-point').forEach(button => {
            button.classList.toggle('active', button.dataset.anchor === this.resizeAnchor);
        });
    }

    setInitialConfigValues(elements) {
        elements.pixelSize.value = String(this.defaultConfig.scaleFactor);
        elements.canvasWidth.value = String(this.defaultConfig.canvasSize[0]);
        elements.canvasHeight.value = String(this.defaultConfig.canvasSize[1]);
    }

    setupConfigEventListeners(elements) {
        elements.button.onclick = () => {
            this.resetConfigInputs(elements);
            elements.modal.classList.add('show');
        };

        const closeModal = () => {
            elements.modal.classList.remove('show');
            this.resetConfigInputs(elements);
        };

        elements.closeButton.onclick = closeModal;
        elements.cancelButton.onclick = closeModal;
        elements.modal.onclick = e => {
            if (e.target === elements.modal) closeModal();
        };

        elements.saveButton.onclick = () => this.handleConfigSave(elements);
    }

    resetConfigInputs(elements) {
        const [width, height] = this.config.canvasSize;
        elements.pixelSize.value = String(this.config.scaleFactor);
        elements.canvasWidth.value = String(width);
        elements.canvasHeight.value = String(height);
        this.syncAnchorSelection(elements.resizeAnchor);
    }

    handleConfigSave(elements) {
        const newConfig = this.validateConfigInputs(elements);
        if (!newConfig) return;

        const sizeChanged = !this.config ||
            this.config.scaleFactor !== newConfig.newScaleFactor ||
            this.config.canvasSize[0] !== newConfig.newWidth ||
            this.config.canvasSize[1] !== newConfig.newHeight;
        const artworkSnapshot = this.layerManager && sizeChanged
            ? this.layerManager.captureArtworkSnapshot()
            : null;

        elements.modal.classList.remove('show');
        if (this.layerManager && !sizeChanged) {
            return;
        }

        this.initialize({
            scaleFactor: newConfig.newScaleFactor,
            canvasSize: [newConfig.newWidth, newConfig.newHeight]
        });

        if (artworkSnapshot) {
            this.layerManager.restoreArtworkSnapshot(artworkSnapshot, this.resizeAnchor);
        }
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

    initKeyboardShortcuts() {
        document.addEventListener('keydown', e => {
            const target = e.target;
            const isTyping = target instanceof HTMLElement &&
                (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
            if (isTyping) return;

            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                document.getElementById('undo')?.click();
                return;
            }

            if (
                (e.ctrlKey || e.metaKey) &&
                (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))
            ) {
                e.preventDefault();
                document.getElementById('redo')?.click();
                return;
            }

            const toolMap = {
                b: 'brush',
                p: 'pencil',
                e: 'eraser',
                g: 'fill'
            };

            const toolId = toolMap[e.key.toLowerCase()];
            if (toolId) {
                document.getElementById(toolId)?.click();
            }
        });
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => new App());
