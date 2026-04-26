// background.js

const RESOURCE_TYPES = [
    "main_frame", "sub_frame", "stylesheet", "script", "image", "font",
    "object", "xmlhttprequest", "ping", "csp_report", "media", "websocket", "other"
];

// Helper to get the next available rule ID
async function getNextRuleId() {
    const data = await chrome.storage.session.get('nextRuleId');
    let nextId = data.nextRuleId || 1;
    // Ensure we stay within 32-bit integer range (1 to 2^31 - 1)
    if (nextId >= 2000000000) {
        nextId = 1;
    }
    await chrome.storage.session.set({ nextRuleId: nextId + 1 });
    return nextId;
}

// Helper to get rule IDs for a tab
async function getRuleIdsForTab(tabId) {
    const data = await chrome.storage.session.get('tabRules');
    const tabRules = data.tabRules || {};
    return tabRules[tabId] || [];
}

// Helper to set rule IDs for a tab
async function setRuleIdsForTab(tabId, ruleIds) {
    const data = await chrome.storage.session.get('tabRules');
    const tabRules = data.tabRules || {};
    if (ruleIds.length > 0) {
        tabRules[tabId] = ruleIds;
    } else {
        delete tabRules[tabId];
    }
    await chrome.storage.session.set({ tabRules });
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_RULES') {
        updateRules(message.tabId, message.userAgent, message.customHeaders, message.enabled)
            .then(() => sendResponse({ status: 'success' }))
            .catch(err => {
                console.error("Error updating rules:", err);
                sendResponse({ status: 'error', message: err.toString() });
            });
        return true; // Keep channel open for async response
    }
});

// Clean up rules when a tab is closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
    const ruleIdsToRemove = await getRuleIdsForTab(tabId);
    if (ruleIdsToRemove.length > 0) {
        await chrome.declarativeNetRequest.updateSessionRules({
            removeRuleIds: ruleIdsToRemove
        });
        await setRuleIdsForTab(tabId, []);
    }
});

async function updateRules(tabId, userAgent, customHeaders, enabled) {
    console.log(`[Background] Updating rules for Tab ${tabId}. Enabled: ${enabled}`);

    if (!tabId) {
        console.error("[Background] Invalid tabId:", tabId);
        return;
    }

    // 1. Get and remove existing rules for this tab
    const oldRuleIds = await getRuleIdsForTab(tabId);

    // Prepare removal
    const updateOptions = {
        removeRuleIds: oldRuleIds
    };

    if (!enabled) {
        console.log(`[Background] Disabling rules for Tab ${tabId}`);
        await chrome.declarativeNetRequest.updateSessionRules(updateOptions);
        await setRuleIdsForTab(tabId, []);
        return;
    }

    // 2. Generate new rules
    const newRules = [];

    // Rule for User-Agent
    if (userAgent) {
        const id = await getNextRuleId();
        newRules.push({
            id: id,
            priority: 1,
            action: {
                type: 'modifyHeaders',
                requestHeaders: [
                    { header: 'User-Agent', operation: 'set', value: userAgent }
                ]
            },
            condition: {
                tabIds: [parseInt(tabId, 10)],
                resourceTypes: RESOURCE_TYPES
            }
        });
    }

    // Rules for Custom Headers
    if (customHeaders && Array.isArray(customHeaders)) {
        for (const header of customHeaders) {
            if (header.name && header.value) {
                const id = await getNextRuleId();
                newRules.push({
                    id: id,
                    priority: 1,
                    action: {
                        type: 'modifyHeaders',
                        requestHeaders: [
                            { header: header.name, operation: 'set', value: header.value }
                        ]
                    },
                    condition: {
                        tabIds: [parseInt(tabId, 10)],
                        resourceTypes: RESOURCE_TYPES
                    }
                });
            }
        }
    }

    // 3. Apply updates
    updateOptions.addRules = newRules;
    console.log(`[Background] Adding ${newRules.length} rules for Tab ${tabId}`, newRules);

    await chrome.declarativeNetRequest.updateSessionRules(updateOptions);

    // 4. Save new rule IDs
    const newRuleIds = newRules.map(r => r.id);
    await setRuleIdsForTab(tabId, newRuleIds);

    console.log(`[Background] Rules updated successfully for Tab ${tabId}`);
}
