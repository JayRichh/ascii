import { toAscii, charBrightness, CHARS } from './src/js/ascii.js';
import { GifBrowser } from './src/js/gifBrowser.js';

class AsciiGifConverter {
  constructor(gifUrl) {
    this.gifUrl = gifUrl;
    this.gif = null;
    this.asciiFrames = [];
    this.currentFrame = 0;
    this.chars = CHARS;
    this.frameDelay = 100;
    this.lastFrameTime = 0;
    this.renderWidth = 0;
    this.renderHeight = 0;
    this.scaleFactor = 0.1;
    this.isProcessing = false;
    this.isColorMode = false;
    this.startTime = millis();
    this.loadTimeout = null;
    
    // Zoom and interaction properties
    this.scale = 1;
    this.targetScale = 1;
    this.isGrabbed = false;
    this.zoomOriginX = 0;
    this.zoomOriginY = 0;
    this.grabStartX = 0;
    this.grabStartY = 0;
    this.grabOffsetX = 0;
    this.grabOffsetY = 0;
    this.maxScale = 3;
    this.grabbedMaxScale = 5;
    this.minScale = 0.5;
    this.isZoomActive = false;
    this.isDraggingSlider = false;
    this.sliderStartX = 0;
    
    // Bind methods to preserve context
    this.handleError = this.handleError.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    
    // Add event listeners
    document.addEventListener('mousedown', this.handleMouseDown);
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('wheel', this.handleWheel, { passive: false });
    
    // Initialize zoom controls
    this.initZoomControls();
  }

  initZoomControls() {
    this.zoomControls = document.getElementById('zoom-controls');
    this.zoomStatus = this.zoomControls.querySelector('.zoom-status');
    this.zoomValue = this.zoomControls.querySelector('.zoom-value');
    this.zoomTrack = this.zoomControls.querySelector('.zoom-track');
    this.zoomHandle = this.zoomControls.querySelector('.zoom-handle');
    this.zoomFill = this.zoomControls.querySelector('.zoom-fill');
    this.resetZoomBtn = this.zoomControls.querySelector('.reset-zoom');
    this.minZoomText = this.zoomControls.querySelector('.min-zoom');
    this.maxZoomText = this.zoomControls.querySelector('.max-zoom');

    // Bind slider events
    this.zoomTrack.addEventListener('mousedown', this.handleSliderClick.bind(this));
    this.zoomHandle.addEventListener('mousedown', this.handleHandleGrab.bind(this));
    this.resetZoomBtn.addEventListener('click', () => this.resetZoom());

    // Keyboard controls for slider
    this.zoomHandle.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const delta = e.key === 'ArrowLeft' ? -0.1 : 0.1;
        this.updateZoom(Math.max(this.minScale, Math.min(this.maxScale, this.scale + delta)));
      }
    });
  }

  handleSliderClick(e) {
    if (e.target === this.zoomHandle) return;
    const rect = this.zoomTrack.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    const newScale = this.minScale + percentage * (this.maxScale - this.minScale);
    this.updateZoom(newScale);
  }

  handleHandleGrab(e) {
    e.stopPropagation();
    this.isDraggingSlider = true;
    this.sliderStartX = e.clientX;
    
    const handleMouseMove = (e) => {
      if (!this.isDraggingSlider) return;
      
      const rect = this.zoomTrack.getBoundingClientRect();
      const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const newScale = this.minScale + percentage * (this.maxScale - this.minScale);
      this.updateZoom(newScale);
    };
    
    const handleMouseUp = () => {
      this.isDraggingSlider = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  updateZoom(newScale, animate = true) {
    const duration = animate ? 0.3 : 0;
    this.targetScale = newScale;
    
    gsap.to(this, {
      scale: this.targetScale,
      duration,
      ease: "power2.out",
      onUpdate: () => this.updateZoomUI()
    });
  }

  updateZoomUI() {
    if (!this.isZoomActive) return;
    
    // Update zoom value text
    this.zoomValue.textContent = `${this.scale.toFixed(1)}x`;
    
    // Update slider position
    const percentage = (this.scale - this.minScale) / (this.maxScale - this.minScale);
    this.zoomHandle.style.left = `${percentage * 100}%`;
    this.zoomFill.style.width = `${percentage * 100}%`;
    
    // Update ARIA values
    this.zoomHandle.setAttribute('aria-valuenow', this.scale.toFixed(1));
  }

  resetZoom() {
    gsap.to(this, {
      scale: 1,
      zoomOriginX: 0,
      zoomOriginY: 0,
      duration: 0.3,
      ease: "power2.out",
      onUpdate: () => this.updateZoomUI(),
      onComplete: () => {
        this.isZoomActive = false;
        this.zoomControls.classList.add('inactive');
        this.zoomStatus.textContent = 'Click to activate controls';
      }
    });
  }

  activateZoom() {
    if (this.isZoomActive) return;
    
    this.isZoomActive = true;
    this.zoomControls.classList.remove('inactive');
    this.zoomStatus.textContent = 'Zoom Controls';
    
    gsap.to(this.zoomControls, {
      opacity: 1,
      duration: 0.3,
      ease: "power2.out"
    });
    
    this.updateZoomUI();
  }

  preload() {
    this.showLoading();
    this.isProcessing = true;
    
    this.loadTimeout = setTimeout(() => {
      if (this.isProcessing) {
        this.handleError(new Error('Loading timeout after 10s'));
      }
    }, 10000);

    try {
      this.gif = loadImage(this.gifUrl, () => {
        clearTimeout(this.loadTimeout);
        this.processGifFrames();
        setTimeout(() => this.windowResized(), 0);
        this.hideLoading();
      }, this.handleError);
    } catch (err) {
      this.handleError(err);
    }
  }

  showLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.remove('hidden');
    const loadingText = overlay.querySelector('p');
    loadingText.textContent = 'Loading GIF...';
  }

  hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
  }

  handleError(err) {
    console.error('Error loading GIF:', err);
    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
    }
    this.hideLoading();
    this.reset(true);
    alert('Error loading GIF. Please check the URL and try again.');
  }

  reset(skipReload = false) {
    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
    }
    
    // Reset zoom and interaction properties
    gsap.killTweensOf(this);
    this.scale = 1;
    this.targetScale = 1;
    this.isGrabbed = false;
    this.zoomOriginX = 0;
    this.zoomOriginY = 0;
    this.isZoomActive = false;
    canvas.classList.remove('grabbing');
    this.zoomControls.classList.add('inactive');
    this.zoomStatus.textContent = 'Click to activate controls';
    this.updateZoomUI();
    
    this.gif = null;
    this.asciiFrames = [];
    this.currentFrame = 0;
    this.isProcessing = false;
    this.startTime = millis();
    background(0);
    document.getElementById('gif-url').value = '';
    document.getElementById('color-toggle').checked = false;
    this.isColorMode = false;
    this.updateStats();
    
    if (!skipReload) {
      gifConverter = new AsciiGifConverter(
        "https://upload.wikimedia.org/wikipedia/commons/2/2c/Rotating_earth_%28large%29.gif"
      );
      gifConverter.preload();
    }
  }

  processGifFrames() {
    if (!this.gif) return;
    this.gif.play();
    this.gif.pause();
    this.asciiFrames = [];
    this.fitToWindow();
    const totalFrames = this.gif.numFrames();
    for (let i = 0; i < totalFrames; i++) {
      this.gif.setFrame(i);
      const frame = this.gif.get();
      this.asciiFrames.push(this.convertToAscii(frame));
    }
    
    this.frameDelay = this.gif.frameDelay || 100;
    this.gif.play();
    this.isProcessing = false;
  }

  convertToAscii(img) {
    img.resize(this.renderWidth * this.scaleFactor, this.renderHeight * this.scaleFactor);
    img.loadPixels();
    return toAscii(img.pixels, img.width, img.height, this.chars);
  }

  update() {
    if (this.isProcessing || this.asciiFrames.length === 0) return;
    const currentTime = millis();
    if (currentTime - this.lastFrameTime >= this.frameDelay) {
      this.currentFrame = (this.currentFrame + 1) % this.asciiFrames.length;
      this.lastFrameTime = currentTime;
    }
  }

  handleMouseDown(e) {
    // Check if click is on canvas
    if (!e.target.matches('canvas')) return;
    
    if (e.button === 0 && !this.isProcessing && this.asciiFrames.length > 0) { // Left click only
      if (!this.isZoomActive) {
        this.activateZoom();
      }
      
      this.isGrabbed = true;
      canvas.classList.add('grabbing');
      
      // Store grab start position
      const rect = canvas.getBoundingClientRect();
      this.grabStartX = e.clientX - rect.left;
      this.grabStartY = e.clientY - rect.top;
      this.grabOffsetX = this.zoomOriginX;
      this.grabOffsetY = this.zoomOriginY;

      // Increase zoom when grabbing
      const newScale = Math.min(this.scale * 1.5, this.grabbedMaxScale);
      this.updateZoom(newScale);
    }
  }

  handleMouseMove(e) {
    // Only track mouse position if over canvas or already grabbed
    if (!e.target.matches('canvas') && !this.isGrabbed) return;
    
    if (!this.isProcessing && this.asciiFrames.length > 0) {
      const rect = canvas.getBoundingClientRect();
      
      if (this.isGrabbed) {
        // Calculate drag distance
        const dragX = (e.clientX - rect.left - this.grabStartX) / rect.width;
        const dragY = (e.clientY - rect.top - this.grabStartY) / rect.height;
        
        // Add drag offset to original grab offset
        const targetX = this.grabOffsetX - dragX;
        const targetY = this.grabOffsetY - dragY;
        
        // Allow more movement when zoomed in
        const maxPan = 0.5 + (this.scale - 1) * 0.3;
        const boundedX = Math.max(-maxPan, Math.min(maxPan, targetX));
        const boundedY = Math.max(-maxPan, Math.min(maxPan, targetY));
        
        this.zoomOriginX = boundedX;
        this.zoomOriginY = boundedY;
      } else if (this.isZoomActive) {
        // Normal cursor follow when not grabbed
        const targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 0.5;
        const targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 0.5;
        
        // Smooth cursor follow
        gsap.to(this, {
          zoomOriginX: targetX,
          zoomOriginY: targetY,
          duration: 0.3,
          ease: "power2.out"
        });
      }
    }
  }

  handleMouseUp() {
    if (this.isGrabbed) {
      this.isGrabbed = false;
      canvas.classList.remove('grabbing');
      
      // Smooth transition back to normal zoom
      const newScale = Math.max(1, this.scale * 0.8);
      this.updateZoom(newScale);
      
      // Keep current position but add smooth movement back
      const currentX = this.zoomOriginX;
      const currentY = this.zoomOriginY;
      gsap.to(this, {
        zoomOriginX: currentX * 0.5,
        zoomOriginY: currentY * 0.5,
        duration: 0.5,
        ease: "power2.out"
      });
    }
  }

  handleWheel(e) {
    // Only handle wheel events on canvas
    if (!e.target.matches('canvas')) return;
    
    if (!this.isProcessing && this.asciiFrames.length > 0) {
      e.preventDefault();
      
      if (!this.isZoomActive) {
        this.activateZoom();
      }

      const delta = -Math.sign(e.deltaY) * 0.1;
      const maxAllowedScale = this.isGrabbed ? this.grabbedMaxScale : this.maxScale;
      
      // Allow zooming out more based on current pan position
      const panDistance = Math.sqrt(this.zoomOriginX * this.zoomOriginX + this.zoomOriginY * this.zoomOriginY);
      const minScale = Math.max(this.minScale, 1 - panDistance);
      
      const newScale = Math.max(minScale, Math.min(maxAllowedScale, this.scale + delta));
      this.updateZoom(newScale);
      
      if (newScale <= 1) {
        gsap.to(this, {
          zoomOriginX: 0,
          zoomOriginY: 0,
          duration: 0.3,
          ease: "power2.out"
        });
      }
    }
  }

  draw() {
    if (this.isProcessing) return;
    if (this.asciiFrames.length > 0) {
      background(0);
      push();
      translate(width/2, height/2);
      scale(this.scale);
      translate(-width/2, -height/2);
      
      // Apply zoom origin offset with inverted direction and adjusted sensitivity
      if (this.scale > 1) {
        const sensitivity = this.isGrabbed ? 1.5 : 1;
        const offsetX = -this.zoomOriginX * width * sensitivity;
        const offsetY = -this.zoomOriginY * height * sensitivity;
        translate(offsetX * (this.scale - 1) / this.scale, offsetY * (this.scale - 1) / this.scale);
      }

      const currentAsciiFrame = this.asciiFrames[this.currentFrame];
      if (currentAsciiFrame) {
        textFont("monospace");
        const rows = currentAsciiFrame.length;
        const columns = currentAsciiFrame[0].length;
        const maxTextWidth = width / columns;
        const maxTextHeight = height / rows;
        const textSizeValue = Math.min(maxTextWidth, maxTextHeight);
        textSize(textSizeValue);
        textAlign(LEFT, TOP);
        noStroke();
        const asciiWidth = columns * textSizeValue;
        const asciiHeight = rows * textSizeValue;
        const startX = (width - asciiWidth) / 2;
        const startY = (height - asciiHeight) / 2;
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < currentAsciiFrame[row].length; col++) {
            const char = currentAsciiFrame[row][col];
            const brightness = this.getCharBrightness(char);
            if (this.isColorMode) {
              fill(brightness, 255 - brightness, brightness);
            } else {
              fill(255);
            }
            text(
              char,
              startX + col * textSizeValue,
              startY + row * textSizeValue
            );
          }
        }
        this.updateStats();
      }
      pop();
    }
  }

  getCharBrightness(char) {
    return charBrightness(char, this.chars);
  }

  updateStats() {
    document.getElementById("current-frame").textContent = this.currentFrame + 1;
    document.getElementById("total-frames").textContent = this.asciiFrames.length;
    document.getElementById("frame-time").textContent = this.frameDelay;
    document.getElementById("elapsed-time").textContent = floor(
      (millis() - this.startTime) / 1000
    );
    document.getElementById(
      "resolution"
    ).textContent = `${this.renderWidth}x${this.renderHeight}`;
  }

  windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    if (!this.gif) return;
    this.processGifFrames();
  }

  fitToWindow() {
    const aspectRatio = this.gif.width / this.gif.height;
    if (windowWidth / windowHeight < aspectRatio) {
      this.renderWidth = windowWidth;
      this.renderHeight = this.renderWidth / aspectRatio;
    } else {
      this.renderHeight = windowHeight;
      this.renderWidth = this.renderHeight * aspectRatio;
    }
  }

  async handleDownload(format) {
    this.showLoading();
    try {
      switch (format) {
        case "gif":
          await this.downloadGif();
          break;
        case "ascii":
          await this.downloadAscii();
          break;
        case "json":
          await this.downloadJson();
          break;
        case "csv":
          await this.downloadCsv();
          break;
        case "canvas":
          await this.downloadCanvas();
          break;
        default:
          console.error("Unknown format:", format);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Error during export. Please try again.');
    } finally {
      this.hideLoading();
    }
  }

  downloadGif() {
    return new Promise((resolve, reject) => {
      try {
        const rows = this.asciiFrames[0].length;
        const columns = this.asciiFrames[0][0].length;
        const aspectRatio = columns / rows;
        
        let exportWidth, exportHeight;
        if (aspectRatio > 1) {
          exportWidth = 1200;
          exportHeight = Math.round(exportWidth / aspectRatio);
        } else {
          exportHeight = 1200;
          exportWidth = Math.round(exportHeight * aspectRatio);
        }

        const gif = new GIF({
          workers: 2,
          quality: 10,
          width: exportWidth,
          height: exportHeight,
          workerScript: window.gifWorkerPath
        });

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = exportWidth;
        tempCanvas.height = exportHeight;
        const ctx = tempCanvas.getContext('2d');
        
        const charSize = Math.min(exportWidth / columns, exportHeight / rows);
        ctx.font = `${Math.floor(charSize)}px monospace`;
        ctx.textBaseline = 'top';
        
        const startX = (exportWidth - (columns * charSize)) / 2;
        const startY = (exportHeight - (rows * charSize)) / 2;

        this.asciiFrames.forEach((frame) => {
          ctx.fillStyle = 'black';
          ctx.fillRect(0, 0, exportWidth, exportHeight);
          ctx.fillStyle = 'white';
          frame.forEach((row, i) => {
            const y = startY + (i * charSize);
            for (let j = 0; j < row.length; j++) {
              const x = startX + (j * charSize);
              ctx.fillText(row[j], x, y);
            }
          });
          gif.addFrame(tempCanvas, { 
            delay: Math.round(this.frameDelay), 
            copy: true 
          });
        });

        gif.on('finished', (blob) => {
          saveAs(blob, 'ascii-animation.gif');
          resolve();
        });

        gif.on('error', (error) => {
          console.error('GIF generation error:', error);
          reject(new Error('Failed to generate GIF. Please try again.'));
        });
        gif.render();
      } catch (error) {
        reject(error);
      }
    });
  }

  async downloadAscii() {
    const asciiText = this.asciiFrames.map(frame => frame.join('\n')).join('\n\n');
    const blob = new Blob([asciiText], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, 'ascii-animation.txt');
  }

  async downloadJson() {
    const blob = new Blob([JSON.stringify(this.asciiFrames, null, 2)], 
      { type: 'application/json;charset=utf-8' });
    saveAs(blob, 'ascii-frames.json');
  }

  async downloadCsv() {
    const csvContent = this.asciiFrames
      .map(frame => frame.join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, 'ascii-frames.csv');
  }

  async downloadCanvas() {
    canvas.toBlob((blob) => {
      saveAs(blob, 'ascii-canvas.png');
    });
  }

  cleanup() {
    // Clear any pending timeouts
    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
    }
    
    // Remove event listeners
    document.removeEventListener('mousedown', this.handleMouseDown);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('wheel', this.handleWheel);
    
    // Kill any active GSAP animations
    gsap.killTweensOf(this);
    
    // Reset cursor and zoom UI
    canvas.classList.remove('grabbing');
    if (this.zoomControls) {
      this.zoomControls.classList.add('inactive');
      this.zoomStatus.textContent = 'Click to activate controls';
      this.isZoomActive = false;
      this.updateZoomUI();
    }
    
    // Clear any existing error states
    document.getElementById('loading-overlay').classList.add('hidden');
    
    // Reset all instance properties
    this.gif = null;
    this.asciiFrames = [];
    this.currentFrame = 0;
    this.isProcessing = false;
    this.scale = 1;
    this.targetScale = 1;
    this.isGrabbed = false;
    this.zoomOriginX = 0;
    this.zoomOriginY = 0;
  }
}

let gifConverter;
let gifBrowser;

// Make p5.js functions global
window.preload = function() {
  gifBrowser = new GifBrowser();
  gifConverter = new AsciiGifConverter(
    "https://upload.wikimedia.org/wikipedia/commons/2/2c/Rotating_earth_%28large%29.gif"
  );
  gifConverter.preload();
};

window.setup = function() {
  createCanvas(windowWidth, windowHeight);
  frameRate(30);
  const colorToggle = document.getElementById("color-toggle");
  colorToggle.addEventListener("change", () => {
    gifConverter.isColorMode = colorToggle.checked;
  });
  const goButton = document.getElementById("go-button");
  const resetButton = document.getElementById("reset-button");
  const gifInput = document.getElementById("gif-url");
  
  goButton.addEventListener("click", () => {
    const newUrl = gifInput.value.trim();
    if (!newUrl) {
      alert('Please enter a GIF URL');
      return;
    }
    
    // Ensure proper cleanup of existing instance
    if (gifConverter) {
      gifConverter.cleanup();
      // Clear any existing error states
      document.getElementById('loading-overlay').classList.add('hidden');
    }
    
    try {
      // Basic URL validation
      new URL(newUrl);
      // Create new instance and preload
      gifConverter = new AsciiGifConverter(newUrl);
      gifConverter.preload();
    } catch (error) {
      alert('Please enter a valid URL');
      return;
    }
  });

  resetButton.addEventListener("click", () => {
    if (gifConverter) {
      gifConverter.cleanup();
      gifConverter.reset();
    }
  });
}

window.draw = function() {
  if (gifConverter) {
    gifConverter.update();
    gifConverter.draw();
  }
}

window.windowResized = function() {
  if (gifConverter) {
    gifConverter.windowResized();
  }
}

function setupDownloadControls() {
  const downloadButton = document.getElementById("download-button");
  const dropdown = document.getElementById("download-dropdown");

  downloadButton.addEventListener("click", () => {
    dropdown.classList.toggle("hidden");
    downloadButton.setAttribute('aria-expanded', 
      dropdown.classList.contains('hidden') ? 'false' : 'true');
  });

  document.querySelectorAll(".download-option").forEach((option) => {
    option.addEventListener("click", async (event) => {
      const format = event.target.getAttribute("data-type");
      dropdown.classList.add("hidden");
      downloadButton.setAttribute('aria-expanded', 'false');
      await gifConverter.handleDownload(format);
    });
  });

  document.addEventListener("click", (event) => {
    if (!downloadButton.contains(event.target) && !dropdown.contains(event.target)) {
      dropdown.classList.add("hidden");
      downloadButton.setAttribute('aria-expanded', 'false');
    }
  });
}

setupDownloadControls();
