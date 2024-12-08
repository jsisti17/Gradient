document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('gradientPreview');
    const ctx = canvas.getContext('2d');
    const color1Input = document.getElementById('color1');
    const color2Input = document.getElementById('color2');
    const hex1Input = document.getElementById('hex1');
    const hex2Input = document.getElementById('hex2');
    const noiseSlider = document.getElementById('noiseSlider');
    const noiseValue = document.getElementById('noiseValue');
    const uploadButton = document.querySelector('.upload-button');
    const imageInput = document.getElementById('imageInput');
    const UNSPLASH_API_KEY = '0UlDXQm3_OH9eHEiOlObNn3QXk4JzkZ7PSh2JdTQ5pI';
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const searchResults = document.querySelector('.search-results');
    const downloadBtn = document.getElementById('downloadBtn');
    
    // Initialize canvas with proper size
    function resizeCanvas() {
        const container = canvas.parentElement;
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
        updateGradient(); // Redraw gradient when canvas is resized
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Generate noise function
    function generateNoise(canvas, opacity) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(canvas.width, canvas.height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const noise = Math.random() * 255;
            data[i] = noise;     // R
            data[i+1] = noise;   // G
            data[i+2] = noise;   // B
            data[i+3] = opacity * 255; // A
        }
        
        ctx.putImageData(imageData, 0, 0);
    }

    function updateGradient() {
        if (!canvas.getContext || !color1Input.value || !color2Input.value) return;
        
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        
        gradient.addColorStop(0, color1Input.value);
        gradient.addColorStop(1, color2Input.value);
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if (noiseSlider.value > 0) {
            const noiseOpacity = noiseSlider.value / 100;
            const noiseCanvas = document.createElement('canvas');
            noiseCanvas.width = canvas.width;
            noiseCanvas.height = canvas.height;
            
            generateNoise(noiseCanvas, noiseOpacity);
            
            ctx.globalCompositeOperation = 'soft-light';
            ctx.drawImage(noiseCanvas, 0, 0);
            ctx.globalCompositeOperation = 'source-over';
        }
    }

    // Color input handlers
    color1Input.addEventListener('input', function() {
        hex1Input.value = this.value.toUpperCase();
        updateGradient();
    });
    
    color2Input.addEventListener('input', function() {
        hex2Input.value = this.value.toUpperCase();
        updateGradient();
    });
    
    hex1Input.addEventListener('input', function() {
        if (this.value.match(/^#[0-9A-Fa-f]{6}$/)) {
            color1Input.value = this.value;
            updateGradient();
        }
    });
    
    hex2Input.addEventListener('input', function() {
        if (this.value.match(/^#[0-9A-Fa-f]{6}$/)) {
            color2Input.value = this.value;
            updateGradient();
        }
    });

    // Noise slider handler
    noiseSlider.addEventListener('input', function() {
        noiseValue.textContent = this.value + '%';
        updateGradient();
    });

    // Image upload handlers
    uploadButton.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadButton.classList.add('dragover');
    });

    uploadButton.addEventListener('dragleave', () => {
        uploadButton.classList.remove('dragover');
    });

    uploadButton.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadButton.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            processImage(file);
        }
    });

    imageInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            processImage(e.target.files[0]);
        }
    });

    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    function getColorContrast(color1, color2) {
        // Calculate relative luminance
        function getLuminance(r, g, b) {
            let [rs, gs, bs] = [r/255, g/255, b/255].map(c => {
                return c <= 0.03928 ? c/12.92 : Math.pow((c + 0.055)/1.055, 2.4);
            });
            return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
        }
        
        const l1 = getLuminance(color1.r, color1.g, color1.b);
        const l2 = getLuminance(color2.r, color2.g, color2.b);
        
        const brightest = Math.max(l1, l2);
        const darkest = Math.min(l1, l2);
        
        return (brightest + 0.05) / (darkest + 0.05);
    }

    function getVibrantColors(imageData) {
        const colors = [];
        const buckets = new Map(); // Store colors in buckets for clustering
        
        // Sample colors from the image
        for (let i = 0; i < imageData.data.length; i += 4) {
            const r = imageData.data[i];
            const g = imageData.data[i + 1];
            const b = imageData.data[i + 2];
            
            // Skip whites, blacks, and grays
            const isGrayish = Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && Math.abs(r - b) < 20;
            const isTooLight = r > 250 && g > 250 && b > 250;
            const isTooLow = r < 5 && g < 5 && b < 5;
            
            if (!isGrayish && !isTooLight && !isTooLow) {
                // Calculate color saturation
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const saturation = (max - min) / max;
                
                // Only keep vibrant colors
                if (saturation > 0.4) {
                    const key = `${Math.round(r/10)},${Math.round(g/10)},${Math.round(b/10)}`;
                    if (!buckets.has(key)) {
                        buckets.set(key, { r, g, b, count: 0 });
                    }
                    buckets.get(key).count++;
                }
            }
        }
        
        // Convert buckets to array and sort by frequency
        const sortedColors = Array.from(buckets.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 10); // Get top 10 most frequent colors
        
        // Find the two most contrasting colors from the top colors
        let maxContrast = 0;
        let bestPair = [sortedColors[0], sortedColors[1]];
        
        for (let i = 0; i < sortedColors.length; i++) {
            for (let j = i + 1; j < sortedColors.length; j++) {
                const contrast = getColorContrast(sortedColors[i], sortedColors[j]);
                if (contrast > maxContrast) {
                    maxContrast = contrast;
                    bestPair = [sortedColors[i], sortedColors[j]];
                }
            }
        }
        
        return bestPair;
    }

    function processImage(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = img.width;
                tempCanvas.height = img.height;
                tempCtx.drawImage(img, 0, 0);

                // Get the image data and extract vibrant colors
                const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                const [color1, color2] = getVibrantColors(imageData);

                // Convert to hex
                const color1Hex = rgbToHex(color1.r, color1.g, color1.b);
                const color2Hex = rgbToHex(color2.r, color2.g, color2.b);

                // Update UI with colors
                color1Input.value = color1Hex;
                color2Input.value = color2Hex;
                hex1Input.value = color1Hex.toUpperCase();
                hex2Input.value = color2Hex.toUpperCase();

                // Show controls and canvas
                document.querySelector('.preview-section').classList.remove('hidden');
                document.querySelector('.color-controls').classList.remove('hidden');
                document.querySelector('#downloadBtn').classList.remove('hidden');
                canvas.classList.remove('hidden');
                
                // Update gradient
                resizeCanvas();
                updateGradient();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // Add tab switching functionality
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    // Add Pexels search functionality
    searchBtn.addEventListener('click', searchPexels);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchPexels();
    });

    async function searchPexels() {
        const query = searchInput.value.trim();
        if (!query) return;

        searchBtn.disabled = true;
        searchResults.innerHTML = 'Searching...';

        try {
            const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=12`, {
                headers: {
                    'Authorization': `Client-ID ${UNSPLASH_API_KEY}`
                }
            });
            
            const data = await response.json();
            
            searchResults.innerHTML = '';
            data.results.forEach(photo => {
                const div = document.createElement('div');
                div.className = 'search-result';
                div.innerHTML = `<img src="${photo.urls.small}" alt="${photo.alt_description || 'Unsplash image'}">`;
                div.addEventListener('click', () => processImageUrl(photo.urls.regular));
                searchResults.appendChild(div);
            });
        } catch (error) {
            searchResults.innerHTML = 'Error searching images. Please try again.';
            console.error('Search error:', error);
        } finally {
            searchBtn.disabled = false;
        }
    }

    // Add function to process images from URLs
    async function processImageUrl(url) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            processImage(blob);
        } catch (error) {
            console.error('Error processing image URL:', error);
        }
    }

    // Add this function to handle the download
    function downloadGradient() {
        // Create a new canvas for the download (with fixed dimensions)
        const downloadCanvas = document.createElement('canvas');
        const downloadCtx = downloadCanvas.getContext('2d');
        downloadCanvas.width = 1920;  // Full HD width
        downloadCanvas.height = 1080; // Full HD height

        // Draw gradient
        const gradient = downloadCtx.createLinearGradient(0, 0, downloadCanvas.width, 0);
        gradient.addColorStop(0, color1Input.value);
        gradient.addColorStop(1, color2Input.value);
        
        downloadCtx.fillStyle = gradient;
        downloadCtx.fillRect(0, 0, downloadCanvas.width, downloadCanvas.height);

        // Add noise if enabled
        if (noiseSlider.value > 0) {
            const noiseCanvas = document.createElement('canvas');
            noiseCanvas.width = downloadCanvas.width;
            noiseCanvas.height = downloadCanvas.height;
            
            generateNoise(noiseCanvas, noiseSlider.value / 100);
            
            downloadCtx.globalCompositeOperation = 'soft-light';
            downloadCtx.drawImage(noiseCanvas, 0, 0);
            downloadCtx.globalCompositeOperation = 'source-over';
        }

        // Create download link
        const link = document.createElement('a');
        link.download = 'gradient.png';
        link.href = downloadCanvas.toDataURL('image/png');
        link.click();
    }

    // Add this with your other event listeners
    downloadBtn.addEventListener('click', downloadGradient);
}); 