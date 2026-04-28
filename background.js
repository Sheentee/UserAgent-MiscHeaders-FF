// background.js

let stateCache = null;
let statePromise = null;

// Helper to reliably get state, dealing with MV3 background script suspension
async function getState() {
    if (stateCache) return stateCache;
    if (statePromise) return statePromise;
    
    statePromise = new Promise((resolve) => {
        const storageAPI = (typeof browser !== 'undefined' ? browser : chrome).storage.local;
        storageAPI.get(['userAgent', 'customHeaders', 'tabStates'], (data) => {
            stateCache = {
                userAgent: data.userAgent || navigator.userAgent,
                customHeaders: data.customHeaders || [],
                tabStates: data.tabStates || {}
            };
            resolve(stateCache);
        });
    });
    
    return statePromise;
}

// Keep stateCache synchronized with popup changes
(typeof browser !== 'undefined' ? browser : chrome).storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && stateCache) {
        if (changes.userAgent) stateCache.userAgent = changes.userAgent.newValue || navigator.userAgent;
        if (changes.customHeaders) stateCache.customHeaders = changes.customHeaders.newValue || [];
        if (changes.tabStates) stateCache.tabStates = changes.tabStates.newValue || {};
    }
});

// Listen for messages from the popup
(typeof browser !== 'undefined' ? browser : chrome).runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_RULES') {
        const { tabId, userAgent, customHeaders, enabled } = message;
        // Update cache immediately to avoid waiting for storage.onChanged
        if (stateCache) {
            stateCache.userAgent = userAgent;
            stateCache.customHeaders = customHeaders;
            stateCache.tabStates[tabId] = enabled;
        }
        console.log(`[Background] Updated rules for Tab ${tabId}. Enabled: ${enabled}`);
        sendResponse({ status: 'success' });
    }
    return true;
});

// Clean up state when a tab is closed
(typeof browser !== 'undefined' ? browser : chrome).tabs.onRemoved.addListener(async (tabId) => {
    const state = await getState();
    if (state.tabStates.hasOwnProperty(tabId)) {
        delete state.tabStates[tabId];
        const storageAPI = (typeof browser !== 'undefined' ? browser : chrome).storage.local;
        storageAPI.set({ tabStates: state.tabStates });
    }
});

// webRequest Blocking Listener
const webRequestAPI = (typeof browser !== 'undefined' ? browser : chrome).webRequest;
webRequestAPI.onBeforeSendHeaders.addListener(
    async function(details) {
        const state = await getState();

        // If the request doesn't belong to a tab, or the tab isn't enabled, don't modify headers
        if (details.tabId === -1 || !state.tabStates[details.tabId]) {
            return { requestHeaders: details.requestHeaders };
        }

        console.log(`[webRequest] Intercepting request for tab ${details.tabId}: ${details.url}`);

        let newHeaders = [];
        let uaModified = false;
        let modifiedCustomHeaders = new Set();

        // Iterate through existing headers to modify them safely
        for (let header of details.requestHeaders) {
            let headerName = header.name.toLowerCase();
            let newValue = header.value;

            // Modify User-Agent
            if (headerName === 'user-agent' && state.userAgent) {
                newValue = state.userAgent;
                uaModified = true;
            }

            // Modify Custom Headers if they already exist
            if (state.customHeaders && state.customHeaders.length > 0) {
                for (let customHeader of state.customHeaders) {
                    if (headerName === customHeader.name.toLowerCase()) {
                        newValue = customHeader.value;
                        modifiedCustomHeaders.add(customHeader.name.toLowerCase());
                    }
                }
            }

            newHeaders.push({ name: header.name, value: newValue });
        }

        // If User-Agent wasn't found in the original request, add it
        if (!uaModified && state.userAgent) {
            newHeaders.push({ name: 'User-Agent', value: state.userAgent });
        }

        // Add Custom Headers that weren't in the original request
        if (state.customHeaders && state.customHeaders.length > 0) {
            for (let customHeader of state.customHeaders) {
                if (!modifiedCustomHeaders.has(customHeader.name.toLowerCase())) {
                    newHeaders.push({ name: customHeader.name, value: customHeader.value });
                }
            }
        }

        return { requestHeaders: newHeaders };
    },
    { urls: ["<all_urls>"] },
    ["blocking", "requestHeaders"]
);
