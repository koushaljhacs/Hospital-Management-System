/* ====================================================================
   HOSTEL MANAGEMENT SYSTEM - ARCHITECTURE DIAGRAM SCRIPTS
   Extracted from architecture.html for modular organization
   ==================================================================== */

/**
 * Initialize animated title with letter-wave animation
 */
window.onload = function() {
    const titleEl = document.getElementById('mainTitle');
    if (!titleEl) return;
    
    const text = titleEl.innerText;
    const fragment = document.createDocumentFragment();
    
    [...text].forEach((char, i) => {
        const span = document.createElement('span');
        span.innerText = char === ' ' ? '\u00A0' : char;
        span.style.animationDelay = (i * 0.1) + 's';
        fragment.appendChild(span);
    });
    
    titleEl.innerHTML = '';
    titleEl.appendChild(fragment);
    setTimeout(updateZoomUI, 100); 
};

/**
 * Zoom control functionality for Mermaid diagram
 */
let currentZoom = 0.4; 
const zoomElement = document.getElementById('mermaidDiagram');
const zoomIndicator = document.getElementById('zoomPercentage');

function updateZoomUI() {
    if (zoomElement) {
        zoomElement.style.transform = `scale(${currentZoom}) translate3d(0,0,0)`;
    }
    if (zoomIndicator) {
        zoomIndicator.innerText = Math.round(currentZoom * 100) + '%';
    }
}

function adjustZoom(delta) {
    const newZoom = currentZoom + delta;
    if (newZoom >= 0.1 && newZoom <= 3.0) {
        currentZoom = parseFloat(newZoom.toFixed(1));
        updateZoomUI();
    }
}

function resetZoom() {
    currentZoom = 0.4;
    updateZoomUI();
}

/**
 * Initialize Mermaid diagram with configuration
 */
mermaid.initialize({
    startOnLoad: true,
    theme: 'base',
    securityLevel: 'loose',
    flowchart: {
        rankSpacing: 200, 
        nodeSpacing: 130, 
        curve: 'basis',
        useMaxWidth: false,
        htmlLabels: true,
        padding: 40
    },
    themeVariables: {
        primaryColor: '#ffffff',
        primaryTextColor: '#1e293b',
        primaryBorderColor: '#3b82f6',
        lineColor: '#3b82f6',
        fontFamily: 'Plus Jakarta Sans',
        fontSize: '15px',
        nodePadding: 5
    }
});
