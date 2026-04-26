// popup.js

document.addEventListener('DOMContentLoaded', async () => {
    const enableToggle = document.getElementById('enable-toggle');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const userAgentInput = document.getElementById('user-agent-input');
    const resetUaBtn = document.getElementById('reset-ua-btn');
    const headersList = document.getElementById('headers-list');
    const newHeaderName = document.getElementById('new-header-name');
    const newHeaderValue = document.getElementById('new-header-value');
    const addHeaderBtn = document.getElementById('add-header-btn');

    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tab.id;
    console.log(`[Popup] Active Tab ID: ${tabId}`);

    // Load settings from storage
    // Structure: { 
    //   global: { userAgent: "...", customHeaders: [...] }, 
    //   tabs: { [tabId]: { enabled: boolean } } 
    // }
    // Or simpler: just store everything.
    // Requirement: "user agent string header contents... allow the user to modify it" - implies global or per-tab?
    // "The modified user agent sting and the arbitrary header added by the user should then be injected into each request."
    // "allow for the insertion of headers into requests while the extension is active on that tab."
    // This implies the configuration might be global, but the activation is per-tab.
    // Let's stick to: Configuration is global (or persistent), Activation is per-tab.

    // Load global settings
    const data = await chrome.storage.local.get(['userAgent', 'customHeaders', 'tabStates']);

    let userAgent = data.userAgent || navigator.userAgent;
    let customHeaders = data.customHeaders || [];
    let tabStates = data.tabStates || {};

    // Initialize UI
    userAgentInput.value = userAgent;
    renderHeaders();
    updateStatus(tabStates[tabId]);

    // Event Listeners
    enableToggle.addEventListener('change', () => {
        const isEnabled = enableToggle.checked;
        tabStates[tabId] = isEnabled;
        saveAndApply();
    });

    userAgentInput.addEventListener('change', () => {
        userAgent = userAgentInput.value;
        saveAndApply();
    });

    resetUaBtn.addEventListener('click', () => {
        userAgent = navigator.userAgent;
        userAgentInput.value = userAgent;
        saveAndApply();
    });

    addHeaderBtn.addEventListener('click', () => {
        const name = newHeaderName.value.trim();
        const value = newHeaderValue.value.trim();
        if (name && value) {
            customHeaders.push({ name, value });
            newHeaderName.value = '';
            newHeaderValue.value = '';
            renderHeaders();
            saveAndApply();
        }
    });

    function renderHeaders() {
        headersList.innerHTML = '';
        customHeaders.forEach((header, index) => {
            const item = document.createElement('div');
            item.className = 'source-item';
            
            // Container for text
            const textContainer = document.createElement('div');
            textContainer.style.overflow = 'hidden';
            textContainer.style.textOverflow = 'ellipsis';
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'header-name-label';
            nameDiv.textContent = header.name;
            
            const valueDiv = document.createElement('div');
            valueDiv.className = 'value';
            valueDiv.style.fontSize = '14px';
            valueDiv.textContent = header.value;
            
            textContainer.appendChild(nameDiv);
            textContainer.appendChild(valueDiv);
            
            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-icon delete-header';
            deleteBtn.dataset.index = index;
            
            // SVG for delete button
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("width", "16");
            svg.setAttribute("height", "16");
            svg.setAttribute("viewBox", "0 0 24 24");
            svg.setAttribute("fill", "none");
            svg.setAttribute("stroke", "currentColor");
            svg.setAttribute("stroke-width", "2");
            
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", "M18 6L6 18M6 6l12 12");
            
            svg.appendChild(path);
            deleteBtn.appendChild(svg);
            
            // Assemble item
            item.appendChild(textContainer);
            item.appendChild(deleteBtn);
            headersList.appendChild(item);
        });

        // Add delete listeners
        document.querySelectorAll('.delete-header').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Find close button even if SVG is clicked
                const target = e.target.closest('.delete-header');
                if (target) {
                    const index = parseInt(target.dataset.index);
                    customHeaders.splice(index, 1);
                    renderHeaders();
                    saveAndApply();
                }
            });
        });
    }

    function updateStatus(enabled) {
        enableToggle.checked = !!enabled;
        if (enabled) {
            statusDot.className = 'dot online';
            statusText.textContent = 'Active';
            statusText.style.color = 'var(--success-color)';
        } else {
            statusDot.className = 'dot offline';
            statusText.textContent = 'Inactive';
            statusText.style.color = 'var(--text-secondary)';
        }
    }

    async function saveAndApply() {
        // Save to storage
        await chrome.storage.local.set({
            userAgent,
            customHeaders,
            tabStates
        });

        updateStatus(tabStates[tabId]);

        // Send to background
        chrome.runtime.sendMessage({
            type: 'UPDATE_RULES',
            tabId,
            userAgent,
            customHeaders,
            enabled: tabStates[tabId]
        });
    }
});
