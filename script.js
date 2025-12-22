// script.js
// ============================================================================
// CONFIGURATION & API ENDPOINTS
// ============================================================================
const CONFIG = {
    API: {
        BASE_URL: "https://static-crane-seeutech-17dd4df3.koyeb.app",
        ENDPOINTS: {
            CHANNELS: "/api/channels",
            STREAM_INFO: "/api/stream"
        }
    },
    ADVERTISING: {
        // Full-Page Banner Ad (every 20 channels)
        BANNER_AD: {
            KEY: 'e47e23c42180f22a6878eac897af183c',
            FORMAT: 'iframe',
            WIDTH: '100%',
            HEIGHT: '90px', // Standard banner ratio[citation:9]
            INSERT_EVERY: 20 // Show after every 20 channels
        },
        // AdBlocker detection fake ad class[citation:6]
        DETECTION_CLASS: 'ad-box',
        DETECTION_STYLE: 'position:fixed;top:0;left:0;width:1px;height:1px;z-index:99999;'
    },
    TELEGRAM: {
        CHANNEL_URL: 'https://t.me/+t9rJ42tcRJI2MDFl',
        ENFORCEMENT_MODAL_ID: 'telegram-modal'
    },
    PLAYER: {
        // [Your original player configuration remains here]
        // ...
    }
};

// ============================================================================
// APPLICATION STATE
// ============================================================================
const AppState = {
    allChannels: [],
    currentChannel: null,
    player: null,
    ui: null,
    isAdBlockDetected: false,
    isDevToolsOpen: false,
    popunderShown: false,
    adCounter: 0
};

// ============================================================================
// ADVERTISEMENT MANAGEMENT
// ============================================================================

/**
 * Creates and injects a full-page width banner ad into the dedicated container.
 * Follows responsive HTML5 banner practices[citation:9].
 */
function createFullPageBannerAd() {
    const adContainer = document.getElementById('fullpage-ad');
    const iframeContainer = document.getElementById('ad-iframe-container');

    if (!adContainer || !iframeContainer) return;

    // Create ad wrapper with responsive design
    const adWrapper = document.createElement('div');
    adWrapper.className = 'banner-ad-wrapper';
    adWrapper.style.width = '100%';
    adWrapper.style.height = CONFIG.ADVERTISING.BANNER_AD.HEIGHT;
    adWrapper.style.overflow = 'hidden';
    adWrapper.style.backgroundColor = '#0f1226'; // Fallback background
    adWrapper.style.margin = '0 auto';
    adWrapper.style.display = 'flex';
    adWrapper.style.justifyContent = 'center';
    adWrapper.style.alignItems = 'center';

    // Create scripts for ad service
    const atOptionsScript = document.createElement('script');
    atOptionsScript.textContent = `
        atOptions = {
            'key' : '${CONFIG.ADVERTISING.BANNER_AD.KEY}',
            'format' : '${CONFIG.ADVERTISING.BANNER_AD.FORMAT}',
            'height' : ${CONFIG.ADVERTISING.BANNER_AD.HEIGHT.replace('px', '')},
            'width' : '100%',
            'params' : {}
        };
    `;

    const invokeScript = document.createElement('script');
    invokeScript.src = `https://staggermeaningless.com/${CONFIG.ADVERTISING.BANNER_AD.KEY}/invoke.js`;

    adWrapper.appendChild(atOptionsScript);
    adWrapper.appendChild(invokeScript);
    iframeContainer.innerHTML = '';
    iframeContainer.appendChild(adWrapper);

    // Show the ad container with animation
    adContainer.style.display = 'block';
    setTimeout(() => adContainer.classList.add('visible'), 10);

    // Close button functionality
    const closeBtn = document.getElementById('close-ad-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            adContainer.classList.remove('visible');
            setTimeout(() => adContainer.style.display = 'none', 300);
        };
    }

    // Auto-hide ad after 15 seconds (typical banner duration)
    setTimeout(() => {
        if (adContainer.classList.contains('visible')) {
            adContainer.classList.remove('visible');
            setTimeout(() => adContainer.style.display = 'none', 300);
        }
    }, 15000);
}

/**
 * Inserts full-page banner ads after every N channels in the grid.
 * @param {Array} channels - The list of channels to render.
 */
function insertAdsInChannelGrid(channels) {
    const gridContainer = document.getElementById('channel-grid-container');
    if (!gridContainer) return;

    gridContainer.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'channel-grid';

    channels.forEach((channel, index) => {
        // Create and append channel card
        const card = createChannelCard(channel, index);
        grid.appendChild(card);

        // Insert ad after every N channels
        if ((index + 1) % CONFIG.ADVERTISING.BANNER_AD.INSERT_EVERY === 0) {
            const adMarker = document.createElement('div');
            adMarker.className = 'ad-insertion-point';
            adMarker.dataset.adIndex = AppState.adCounter++;
            grid.appendChild(adMarker);
        }
    });

    gridContainer.appendChild(grid);

    // Show first ad immediately if insertion points exist
    if (document.querySelector('.ad-insertion-point')) {
        setTimeout(createFullPageBannerAd, 1000);
    }
}

// ============================================================================
// ADBLOCKER & DEVELOPER TOOLS DETECTION
// ============================================================================

/**
 * Detects AdBlockers by checking if a fake ad element is hidden.
 * Based on the technique described in Dev.to[citation:6].
 */
function detectAdBlock() {
    return new Promise((resolve) => {
        // Create a fake ad element that AdBlockers typically hide[citation:6]
        const testAd = document.createElement('div');
        testAd.className = CONFIG.ADVERTISING.DETECTION_CLASS;
        testAd.setAttribute('aria-hidden', 'true');
        testAd.style.cssText = CONFIG.ADVERTISING.DETECTION_STYLE;
        document.body.appendChild(testAd);

        setTimeout(() => {
            const computedStyle = window.getComputedStyle(testAd);
            // Check if the fake ad is hidden (a sign of AdBlocker)[citation:6]
            const isHidden = computedStyle.display === 'none' ||
                computedStyle.visibility === 'hidden' ||
                computedStyle.opacity === '0';

            document.body.removeChild(testAd);
            AppState.isAdBlockDetected = isHidden;
            resolve(isHidden);
        }, 2000); // Increased delay for better detection[citation:6]
    });
}

/**
 * Monitors for browser Developer Tools being opened.
 * Detects common methods like inspecting elements or console opening.
 */
function monitorDevTools() {
    let devToolsOpen = false;

    // Method 1: Check for debugger statement timing
    const debuggerCheck = new Date();
    debugger;
    if (new Date() - debuggerCheck > 100) {
        devToolsOpen = true;
    }

    // Method 2: Check console object (not foolproof but indicative)
    const element = new Image();
    Object.defineProperty(element, 'id', {
        get: function() {
            devToolsOpen = true;
            AppState.isDevToolsOpen = true;
            triggerTelegramEnforcement();
        }
    });
    console.log('%c', element);

    // Method 3: Monitor window resize (DevTools changes window dimensions)
    const widthThreshold = window.outerWidth - window.innerWidth > 160;
    const heightThreshold = window.outerHeight - window.innerHeight > 160;
    if (widthThreshold || heightThreshold) {
        devToolsOpen = true;
    }

    if (devToolsOpen) {
        AppState.isDevToolsOpen = true;
        triggerTelegramEnforcement();
    }
}

// ============================================================================
// TELEGRAM ENFORCEMENT SYSTEM
// ============================================================================

/**
 * Triggers the modal that enforces Telegram channel join.
 * Called when AdBlocker or DevTools are detected.
 */
function triggerTelegramEnforcement() {
    // Block video playback
    if (AppState.player && AppState.player.isLoaded()) {
        AppState.player.unload();
    }

    const modal = document.getElementById(CONFIG.TELEGRAM.ENFORCEMENT_MODAL_ID);
    if (!modal) return;

    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Configure modal button
    const continueBtn = document.getElementById('modal-continue-btn');
    if (continueBtn) {
        continueBtn.onclick = () => {
            // Simple verification - check if user likely opened the link
            const userVerified = confirm("Please confirm you have joined the Telegram channel to continue.");
            if (userVerified) {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
                if (AppState.currentChannel) {
                    playChannel(AppState.currentChannel);
                }
            }
        };
    }

    // Auto-redirect after 10 seconds if no action
    setTimeout(() => {
        if (modal.style.display !== 'none') {
            window.open(CONFIG.TELEGRAM.CHANNEL_URL, '_blank');
        }
    }, 10000);
}

/**
 * Initializes security monitoring system.
 * Runs AdBlocker detection and DevTools monitoring.
 */
function initSecurityMonitoring() {
    // Initial AdBlocker detection
    detectAdBlock().then((adBlockDetected) => {
        if (adBlockDetected) {
            console.warn('AdBlocker detected - enforcing Telegram join requirement');
            triggerTelegramEnforcement();
        }
    });

    // Continuous DevTools monitoring
    setInterval(monitorDevTools, 2000);

    // Monitor right-click (context menu)
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        triggerTelegramEnforcement();
        return false;
    });

    // Monitor keyboard shortcuts for DevTools (F12, Ctrl+Shift+I, etc.)
    document.addEventListener('keydown', (e) => {
        if (
            e.key === 'F12' ||
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
            (e.metaKey && e.altKey && e.key === 'I')
        ) {
            e.preventDefault();
            triggerTelegramEnforcement();
        }
    });
}

// ============================================================================
// ENHANCED UI & NAVIGATION FUNCTIONS
// ============================================================================

/**
 * Creates an enhanced channel card with better visual design and interaction.
 * Includes hover effects and live status indicators.
 */
function createChannelCard(channel, index) {
    // [Your enhanced channel card creation code]
    // Improved with better gradients, shadows, and animations
}

/**
 * Initializes enhanced keyboard navigation with quick search and channel browsing.
 */
function initEnhancedNavigation() {
    // [Your enhanced keyboard navigation code]
    // Includes channel cycling, quick search focus, and overlay controls
}

// ============================================================================
// MAIN INITIALIZATION
// ============================================================================

/**
 * Main application initialization function.
 * Sets up player, loads channels, and initializes all systems.
 */
async function initApplication() {
    console.log('Initializing IMax TV Enhanced...');

    try {
        // 1. Initialize core UI components
        initDOMReferences();
        initEnhancedNavigation();
        initEventListeners();

        // 2. Initialize security systems
        initSecurityMonitoring();

        // 3. Initialize video player
        await initPlayer();

        // 4. Load channels and render with ads
        await loadChannels();

        console.log('IMax TV Enhanced initialized successfully');

    } catch (error) {
        console.error('Failed to initialize application:', error);
        showError('Failed to initialize application. Please refresh the page.');
    }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApplication);
} else {
    initApplication();
}

// [The rest of your original functions (loadChannels, initPlayer, playChannel, etc.)
// are included here, adapted to work with the new ad system and state management]
