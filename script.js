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
        },
        DEFAULT_HEADERS: {
            Referer: "https://www.jiotv.com/",
            "User-Agent": "plaYtv/7.1.5 (Linux;Android 13) ExoPlayerLib/2.11.6"
        }
    },
    ADVERTISING: {
        // Full-Page Banner Ad (every 20 channels)
        BANNER_AD: {
            KEY: 'e47e23c42180f22a6878eac897af183c',
            FORMAT: 'iframe',
            WIDTH: '100%',
            HEIGHT: '90px',
            INSERT_EVERY: 20,
            AUTO_HIDE_TIME: 15000
        },
        POPUNDER_URL: 'https://staggermeaningless.com/yabwitfi2?key=37017fa6899fefb91f1220463349fca3',
        // AdBlocker detection fake ad class
        DETECTION_CLASS: 'ad-box',
        DETECTION_STYLE: 'width:1px;height:1px;position:absolute;left:-9999px;top:-9999px;'
    },
    TELEGRAM: {
        CHANNEL_URL: 'https://t.me/+t9rJ42tcRJI2MDFl',
        ENFORCEMENT_MODAL_ID: 'telegram-modal'
    },
    PLAYER: {
        streaming: {
            lowLatencyMode: true,
            bufferingGoal: 15,
            rebufferingGoal: 3,
            bufferBehind: 15,
            retryParameters: {
                timeout: 15000,
                maxAttempts: 4,
                baseDelay: 1000,
                backoffFactor: 2,
                fuzzFactor: 0.5
            },
            stallEnabled: true,
            stallThreshold: 1,
            stallSkip: 0.1
        },
        manifest: {
            retryParameters: {
                timeout: 10000,
                maxAttempts: 3
            },
            dash: {
                ignoreMinBufferTime: true
            }
        },
        abr: {
            enabled: true,
            defaultBandwidthEstimate: 1000000,
            switchInterval: 8,
            bandwidthUpgradeTarget: 0.85,
            bandwidthDowngradeTarget: 0.95
        }
    }
};

// ============================================================================
// APPLICATION STATE
// ============================================================================
const AppState = {
    allChannels: [],
    currentSearchTerm: "",
    currentChannel: null,
    player: null,
    video: null,
    ui: null,
    currentVideoFit: 'contain',
    overlayTimeout: null,
    isOverlayVisible: true,
    playerInitialized: false,
    isRetrying: false,
    popunderShown: false,
    isAdBlockDetected: false,
    isDevToolsOpen: false,
    adCounter: 0,
    devToolsCheckInterval: null,
    isTelegramModalActive: false
};

// ============================================================================
// DOM ELEMENTS
// ============================================================================
const DOM = {
    channelSearchInput: null,
    channelGridContainer: null,
    channelsSidebar: null,
    playerArea: null,
    toggleSidebarBtn: null,
    currentChannelName: null,
    currentChannelStatus: null,
    errorBanner: null,
    errorText: null,
    errorRetry: null,
    playerOverlayTop: null,
    videoContainer: null,
    fullpageAd: null,
    adIframeContainer: null,
    closeAdBtn: null,
    telegramModal: null,
    modalContinueBtn: null
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function getPlaceholderUrl(title) {
    const truncated = encodeURIComponent(title.substring(0, 16));
    return `https://placehold.co/300x200/0f1226/9CA3AF?text=${truncated}`;
}

function scrollIntoViewSafely(element, options = { behavior: 'smooth', block: 'nearest' }) {
    if (element && typeof element.scrollIntoView === 'function') {
        element.scrollIntoView(options);
    }
}

// ============================================================================
// ADVERTISEMENT MANAGEMENT
// ============================================================================

/**
 * Creates and injects a full-page width banner ad into the dedicated container.
 */
function createFullPageBannerAd() {
    if (!DOM.fullpageAd || !DOM.adIframeContainer) {
        console.warn('Ad containers not found');
        return;
    }

    // Clear previous ad
    DOM.adIframeContainer.innerHTML = '';
    
    // Create ad wrapper
    const adWrapper = document.createElement('div');
    adWrapper.className = 'banner-ad-wrapper';
    adWrapper.style.width = '100%';
    adWrapper.style.height = '100%';
    adWrapper.style.overflow = 'hidden';
    adWrapper.style.backgroundColor = '#0f1226';
    adWrapper.style.display = 'flex';
    adWrapper.style.justifyContent = 'center';
    adWrapper.style.alignItems = 'center';

    // Create ad scripts
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
    invokeScript.onerror = () => {
        console.warn('Ad script failed to load');
        hideFullPageAd();
    };

    adWrapper.appendChild(atOptionsScript);
    adWrapper.appendChild(invokeScript);
    DOM.adIframeContainer.appendChild(adWrapper);

    // Show the ad with animation
    DOM.fullpageAd.style.display = 'block';
    setTimeout(() => DOM.fullpageAd.classList.add('visible'), 10);

    // Auto-hide ad after configured time
    setTimeout(() => {
        if (DOM.fullpageAd.classList.contains('visible')) {
            hideFullPageAd();
        }
    }, CONFIG.ADVERTISING.BANNER_AD.AUTO_HIDE_TIME);
}

function hideFullPageAd() {
    if (DOM.fullpageAd) {
        DOM.fullpageAd.classList.remove('visible');
        setTimeout(() => {
            DOM.fullpageAd.style.display = 'none';
        }, 300);
    }
}

function showPopunder() {
    if (!AppState.popunderShown && !AppState.isAdBlockDetected) {
        try {
            const popunder = window.open(CONFIG.ADVERTISING.POPUNDER_URL, '_blank');
            if (popunder) {
                AppState.popunderShown = true;
                setTimeout(() => {
                    popunder.blur();
                    window.focus();
                }, 100);
            }
        } catch (e) {
            console.warn('Popunder blocked:', e);
        }
    }
}

// ============================================================================
// ADBLOCKER & DEVELOPER TOOLS DETECTION
// ============================================================================

function detectAdBlock() {
    return new Promise((resolve) => {
        // Create fake ad element
        const testAd = document.createElement('div');
        testAd.className = CONFIG.ADVERTISING.DETECTION_CLASS;
        testAd.innerHTML = '&nbsp;';
        testAd.style.cssText = CONFIG.ADVERTISING.DETECTION_STYLE;
        
        // Add bait attributes that adblockers target
        testAd.setAttribute('class', 'ad-box ad-banner adsbygoogle');
        testAd.setAttribute('data-ad-client', 'ca-pub-123456789');
        testAd.setAttribute('data-ad-slot', '1234567890');
        
        document.body.appendChild(testAd);

        setTimeout(() => {
            const computedStyle = window.getComputedStyle(testAd);
            const isHidden = computedStyle.display === 'none' ||
                computedStyle.visibility === 'hidden' ||
                computedStyle.opacity === '0' ||
                computedStyle.width === '0px' ||
                computedStyle.height === '0px';
            
            // Additional check for ad blocker modifications
            const baitLink = document.createElement('a');
            baitLink.className = 'adsbygoogle';
            baitLink.href = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
            document.body.appendChild(baitLink);
            
            setTimeout(() => {
                const isLinkHidden = window.getComputedStyle(baitLink).display === 'none';
                
                document.body.removeChild(testAd);
                document.body.removeChild(baitLink);
                
                AppState.isAdBlockDetected = isHidden || isLinkHidden;
                console.log('AdBlock detection result:', AppState.isAdBlockDetected);
                resolve(AppState.isAdBlockDetected);
            }, 100);
        }, 500);
    });
}

function monitorDevTools() {
    const threshold = 160;
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    
    // Check for devtools by monitoring window size differences
    if (widthDiff > threshold || heightDiff > threshold) {
        if (!AppState.isDevToolsOpen) {
            AppState.isDevToolsOpen = true;
            console.warn('DevTools detected via window size');
            triggerTelegramEnforcement();
        }
        return true;
    }
    
    // Check for console open via debugger
    const startTime = performance.now();
    debugger; // This will only pause if debugger is open
    const endTime = performance.now();
    
    if (endTime - startTime > 100) {
        if (!AppState.isDevToolsOpen) {
            AppState.isDevToolsOpen = true;
            console.warn('DevTools detected via debugger');
            triggerTelegramEnforcement();
        }
        return true;
    }
    
    // Check for eval override (some devtools override eval)
    try {
        const originalEval = window.eval;
        window.eval = function() {};
        window.eval = originalEval;
    } catch (e) {
        if (!AppState.isDevToolsOpen) {
            AppState.isDevToolsOpen = true;
            console.warn('DevTools detected via eval');
            triggerTelegramEnforcement();
        }
        return true;
    }
    
    return false;
}

// ============================================================================
// TELEGRAM ENFORCEMENT SYSTEM
// ============================================================================

function triggerTelegramEnforcement() {
    if (AppState.isTelegramModalActive) return;
    
    AppState.isTelegramModalActive = true;
    
    // Stop video playback if playing
    if (AppState.player && AppState.player.isLoaded()) {
        try {
            AppState.player.unload();
        } catch (e) {
            console.warn('Error unloading player:', e);
        }
    }
    
    if (AppState.video) {
        AppState.video.pause();
        AppState.video.src = '';
    }
    
    // Show modal
    if (DOM.telegramModal) {
        DOM.telegramModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Focus on the continue button
        setTimeout(() => {
            if (DOM.modalContinueBtn) {
                DOM.modalContinueBtn.focus();
            }
        }, 100);
        
        // Auto-redirect after 15 seconds
        setTimeout(() => {
            if (DOM.telegramModal.style.display !== 'none') {
                window.open(CONFIG.TELEGRAM.CHANNEL_URL, '_blank');
            }
        }, 15000);
    } else {
        // Fallback redirect if modal not found
        window.open(CONFIG.TELEGRAM.CHANNEL_URL, '_blank');
    }
}

function initSecurityMonitoring() {
    // Initial AdBlock detection
    detectAdBlock().then((adBlockDetected) => {
        if (adBlockDetected) {
            console.warn('AdBlocker detected - enforcing Telegram join requirement');
            showError('Ad blocker detected. Please disable it to continue.');
            setTimeout(triggerTelegramEnforcement, 2000);
        }
    });
    
    // Continuous DevTools monitoring
    AppState.devToolsCheckInterval = setInterval(monitorDevTools, 1000);
    
    // Right-click detection
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!AppState.isDevToolsOpen) {
            AppState.isDevToolsOpen = true;
            triggerTelegramEnforcement();
        }
        return false;
    });
    
    // Keyboard shortcuts for DevTools
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
            (e.metaKey && e.altKey && e.key === 'I') ||
            (e.ctrlKey && e.key === 'U')) {
            e.preventDefault();
            if (!AppState.isDevToolsOpen) {
                AppState.isDevToolsOpen = true;
                triggerTelegramEnforcement();
            }
        }
    });
    
    // Monitor console usage
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    
    console.log = function(...args) {
        if (!AppState.isDevToolsOpen) {
            AppState.isDevToolsOpen = true;
            setTimeout(triggerTelegramEnforcement, 100);
        }
        return originalConsoleLog.apply(console, args);
    };
    
    console.error = function(...args) {
        if (!AppState.isDevToolsOpen) {
            AppState.isDevToolsOpen = true;
            setTimeout(triggerTelegramEnforcement, 100);
        }
        return originalConsoleError.apply(console, args);
    };
    
    console.warn = function(...args) {
        if (!AppState.isDevToolsOpen) {
            AppState.isDevToolsOpen = true;
            setTimeout(triggerTelegramEnforcement, 100);
        }
        return originalConsoleWarn.apply(console, args);
    };
}

// ============================================================================
// UI FUNCTIONS
// ============================================================================

function showError(message) {
    if (DOM.errorText && DOM.errorBanner) {
        DOM.errorText.textContent = message;
        DOM.errorBanner.style.display = "flex";
    }
}

function hideError() {
    if (DOM.errorBanner) {
        DOM.errorBanner.style.display = "none";
    }
}

function showLoading() {
    if (DOM.channelGridContainer) {
        DOM.channelGridContainer.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Loading channels...</p>
            </div>
        `;
    }
    hideError();
}

function updateChannelInfo(name, status) {
    if (DOM.currentChannelName) {
        DOM.currentChannelName.textContent = name;
    }
    if (DOM.currentChannelStatus) {
        const statusSpan = DOM.currentChannelStatus.querySelector('span:last-child');
        if (statusSpan) {
            statusSpan.textContent = status;
        }
    }
}

function setupOverlayAutoHide() {
    clearTimeout(AppState.overlayTimeout);
    
    if (!DOM.playerOverlayTop) return;
    
    DOM.playerOverlayTop.classList.remove('hidden');
    AppState.isOverlayVisible = true;
    
    AppState.overlayTimeout = setTimeout(() => {
        if (AppState.video && !AppState.video.paused) {
            DOM.playerOverlayTop.classList.add('hidden');
            AppState.isOverlayVisible = false;
        }
    }, 3000);
}

function handleMouseMove() {
    if (!AppState.isOverlayVisible) {
        DOM.playerOverlayTop.classList.remove('hidden');
        AppState.isOverlayVisible = true;
    }
    setupOverlayAutoHide();
}

function showPlayer() {
    if (DOM.channelsSidebar) {
        DOM.channelsSidebar.classList.add('with-player');
    }
    if (DOM.playerArea) {
        DOM.playerArea.classList.add('visible');
    }
}

// ============================================================================
// CHANNEL MANAGEMENT
// ============================================================================

function handleSearch(searchTerm) {
    AppState.currentSearchTerm = searchTerm.toLowerCase().trim();
    renderChannels();
}

function renderChannels() {
    if (!DOM.channelGridContainer) return;
    
    const filteredChannels = AppState.currentSearchTerm.length > 0
        ? AppState.allChannels.filter((c) =>
            c.title.toLowerCase().includes(AppState.currentSearchTerm)
        )
        : AppState.allChannels;

    if (!filteredChannels.length) {
        DOM.channelGridContainer.innerHTML = `
            <div class="loading">
                <p>No channels found for "${AppState.currentSearchTerm}".</p>
            </div>
        `;
        return;
    }

    DOM.channelGridContainer.innerHTML = "";
    
    const sectionLabel = document.createElement("div");
    sectionLabel.className = "channel-section-label";
    sectionLabel.textContent = AppState.currentSearchTerm.length > 0 
        ? "Search Results" 
        : `Live Channels • ${filteredChannels.length}`;
    DOM.channelGridContainer.appendChild(sectionLabel);

    const grid = document.createElement("div");
    grid.className = "channel-grid";
    grid.id = "channel-grid";

    filteredChannels.forEach((channel, index) => {
        const card = createChannelCard(channel, index);
        grid.appendChild(card);
        
        // Insert ad marker after every N channels
        if ((index + 1) % CONFIG.ADVERTISING.BANNER_AD.INSERT_EVERY === 0 && index < filteredChannels.length - 1) {
            const adMarker = document.createElement('div');
            adMarker.className = 'ad-insertion-point';
            adMarker.dataset.adIndex = AppState.adCounter++;
            grid.appendChild(adMarker);
            
            // Show ad for the first insertion point
            if (index === CONFIG.ADVERTISING.BANNER_AD.INSERT_EVERY - 1) {
                setTimeout(createFullPageBannerAd, 1000);
            }
        }
    });

    DOM.channelGridContainer.appendChild(grid);
}

function createChannelCard(channel, index) {
    const card = document.createElement("div");
    card.className = "channel-card";
    card.tabIndex = 0;
    card.setAttribute("data-channel-id", channel.id);
    card.setAttribute("data-index", index.toString());

    if (AppState.currentChannel && AppState.currentChannel.id === channel.id) {
        card.classList.add("active");
    }

    const placeholderUrl = getPlaceholderUrl(channel.title);

    card.innerHTML = `
        <div class="channel-logo-wrapper">
            <img src="${channel.logo || placeholderUrl}"
                 alt="${channel.title}"
                 class="channel-logo"
                 onerror="this.src='${placeholderUrl}'">
            <div class="live-badge">LIVE</div>
        </div>
        <div class="channel-info">
            <div class="channel-title">${channel.title}</div>
        </div>
    `;

    card.addEventListener("click", () => {
        if (AppState.isAdBlockDetected || AppState.isDevToolsOpen) {
            triggerTelegramEnforcement();
            return;
        }
        playChannel(channel);
        showPopunder();
    });
    
    card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (AppState.isAdBlockDetected || AppState.isDevToolsOpen) {
                triggerTelegramEnforcement();
                return;
            }
            playChannel(channel);
            showPopunder();
        }
    });

    return card;
}

async function loadChannels() {
    showLoading();
    hideError();
    
    try {
        const url = `${CONFIG.API.BASE_URL}${CONFIG.API.ENDPOINTS.CHANNELS}`;
        const response = await fetch(url, { 
            cache: "no-store",
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success && Array.isArray(data.data)) {
            AppState.allChannels = data.data;
            renderChannels();
            console.log(`Loaded ${AppState.allChannels.length} channels`);
        } else {
            throw new Error("Invalid channel response format");
        }
    } catch (error) {
        console.error("Failed to load channels:", error);
        showError(`Failed to load channels: ${error.message}`);
        if (DOM.channelGridContainer) {
            DOM.channelGridContainer.innerHTML = `
                <div class="loading">
                    <p>Failed to load channels.</p>
                    <button onclick="location.reload()" style="margin-top: 14px; padding: 10px 20px; background: linear-gradient(135deg, #6366F1 0%, #A855F7 100%); border: none; border-radius: 10px; color: white; cursor: pointer; font-weight: 600;">Retry</button>
                </div>
            `;
        }
    }
}

// ============================================================================
// VIDEO PLAYER FUNCTIONS
// ============================================================================

async function attemptAutoplay() {
    if (!AppState.video) return false;
    
    try {
        AppState.video.muted = false;
        await AppState.video.play();
        return true;
    } catch (error) {
        try {
            AppState.video.muted = true;
            await AppState.video.play();
            console.log("Playing with muted fallback");
            setTimeout(() => {
                if (AppState.video) {
                    AppState.video.muted = false;
                }
            }, 1000);
            return true;
        } catch (mutedError) {
            console.warn("Autoplay failed:", mutedError);
            return false;
        }
    }
}

function setVideoFit(fit) {
    if (!AppState.video) return;
    
    const fitClass = `video-fit-${fit}`;
    AppState.video.className = AppState.video.className.replace(/video-fit-\w+/g, '').trim();
    AppState.video.classList.add(fitClass);
    AppState.currentVideoFit = fit;
}

function configureDRM(channel) {
    if (!AppState.player) return;

    if (channel.key && channel.key.includes(":")) {
        const [keyId, keyValue] = channel.key.split(":");
        AppState.player.configure({
            drm: {
                clearKeys: {
                    [keyId]: keyValue
                }
            }
        });
        console.log("DRM configured with clearKeys");
    } else {
        AppState.player.configure({ drm: { clearKeys: {} } });
    }
}

function setupNetworkFilters(channel) {
    if (!AppState.player) return;

    const net = AppState.player.getNetworkingEngine();
    net.clearAllRequestFilters();
    net.clearAllResponseFilters();
    
    net.registerRequestFilter((type, request) => {
        request.headers["Referer"] = CONFIG.API.DEFAULT_HEADERS.Referer;
        request.headers["User-Agent"] = CONFIG.API.DEFAULT_HEADERS["User-Agent"];

        if (channel.cookie) {
            request.headers["Cookie"] = channel.cookie;
        }

        if (
            channel.cookie &&
            (type === shaka.net.NetworkingEngine.RequestType.MANIFEST ||
             type === shaka.net.NetworkingEngine.RequestType.SEGMENT)
        ) {
            const hdneaMatch = channel.cookie.match(/__hdnea__=[^;]+/);
            if (hdneaMatch && !request.uris[0].includes("__hdnea__=")) {
                const sep = request.uris[0].includes("?") ? "&" : "?";
                request.uris[0] += sep + hdneaMatch[0];
            }
        }
    });

    console.log("Network filters configured");
}

async function playChannel(channel) {
    if (AppState.isAdBlockDetected || AppState.isDevToolsOpen) {
        triggerTelegramEnforcement();
        return;
    }
    
    if (!AppState.player) {
        console.error("Player not initialized");
        return;
    }

    if (AppState.isRetrying) {
        console.log("Already retrying, skipping...");
        return;
    }

    hideError();
    showPlayer();

    document.querySelectorAll(".channel-card").forEach((c) =>
        c.classList.remove("active")
    );
    
    AppState.currentChannel = channel;
    updateChannelInfo(channel.title, "Loading stream…");

    const cards = document.querySelectorAll(".channel-card");
    cards.forEach((card) => {
        if (card.getAttribute("data-channel-id") === channel.id) {
            card.classList.add("active");
            scrollIntoViewSafely(card);
        }
    });

    if (window.innerWidth <= 900) {
        DOM.channelsSidebar.classList.remove("open");
    }

    try {
        AppState.isRetrying = true;

        await AppState.player.unload();
        
        configureDRM(channel);
        setupNetworkFilters(channel);

        console.log(`Loading stream: ${channel.url}`);
        await AppState.player.load(channel.url);
        
        const played = await attemptAutoplay();
        
        if (played) {
            updateChannelInfo(channel.title, "Live • Watching Now");
            setupOverlayAutoHide();
            console.log(`Playing: ${channel.title}`);
        } else {
            updateChannelInfo(channel.title, "Click play to start");
        }
        
    } catch (error) {
        console.error("Playback error:", error);
        updateChannelInfo(channel.title, "Error loading channel");
        
        let errorMsg = "Failed to play channel";
        if (error.code === 1001) {
            errorMsg = "Network error - check your connection";
        } else if (error.code === 6007) {
            errorMsg = "Stream format not supported";
        } else if (error.message) {
            errorMsg = error.message;
        }
        
        showError(`${errorMsg}. Please try again.`);
    } finally {
        AppState.isRetrying = false;
    }
}

async function initPlayer() {
    try {
        shaka.polyfill.installAll();

        if (!shaka.Player.isBrowserSupported()) {
            showError("Your browser does not support video playback.");
            return;
        }

        AppState.video = document.querySelector("video");
        if (!AppState.video) {
            throw new Error("Video element not found");
        }

        AppState.player = new shaka.Player();
        await AppState.player.attach(AppState.video);

        const container = DOM.videoContainer;
        AppState.ui = new shaka.ui.Overlay(AppState.player, container, AppState.video);

        // Configure UI with fit controls in settings
        const config = {
            controlPanelElements: [
                "play_pause",
                "time_and_duration",
                "mute",
                "volume",
                "spacer",
                "quality",
                "playback_rate",
                "overflow_menu",
                "fullscreen"
            ],
            addSeekBar: false,
            addBigPlayButton: true,
            volumeBarColors: { base: "#475569", level: "#6366F1" },
            seekBarColors: {
                base: "#6B7280",
                buffered: "#F59E0B",
                played: "#6366F1"
            },
            overflowMenuButtons: ['quality', 'playback_rate', 'captions']
        };

        AppState.ui.configure(config);
        
        // Add custom video fit controls to overflow menu
        addVideoFitControls();

        AppState.player.configure(CONFIG.PLAYER);

        AppState.player.addEventListener("error", (event) => {
            const error = event.detail;
            console.error("Player error:", error);
            
            let errorMsg = "Playback error occurred";
            if (error.code === 1001) {
                errorMsg = "Network error - stream unavailable";
            } else if (error.code === 6007) {
                errorMsg = "Unsupported stream format";
            } else if (error.message) {
                errorMsg = error.message;
            }
            
            showError(errorMsg);
            updateChannelInfo(
                AppState.currentChannel?.title || "Error",
                "Playback error"
            );
        });

        AppState.player.addEventListener("buffering", (event) => {
            if (event.buffering) {
                updateChannelInfo(
                    AppState.currentChannel?.title || "Buffering",
                    "Buffering stream..."
                );
            } else if (AppState.currentChannel) {
                updateChannelInfo(
                    AppState.currentChannel.title,
                    "Live • Watching Now"
                );
            }
        });

        AppState.video.volume = 0.8;

        AppState.video.addEventListener('play', () => {
            setupOverlayAutoHide();
        });

        AppState.video.addEventListener('pause', () => {
            clearTimeout(AppState.overlayTimeout);
            DOM.playerOverlayTop.classList.remove('hidden');
            AppState.isOverlayVisible = true;
        });

        // Set default fit
        setVideoFit('contain');

        AppState.playerInitialized = true;
        console.log("Player initialized successfully");

    } catch (error) {
        console.error("Failed to initialize player:", error);
        showError("Failed to initialize video player. Please refresh the page.");
    }
}

function addVideoFitControls() {
    setTimeout(() => {
        const overflowMenu = document.querySelector('.shaka-overflow-menu');
        if (overflowMenu) {
            const fitButton = document.createElement('button');
            fitButton.className = 'shaka-overflow-menu-button';
            fitButton.textContent = 'Video Fit';
            fitButton.onclick = () => {
                const currentFit = AppState.currentVideoFit;
                const fits = ['contain', 'cover', 'fill'];
                const nextIndex = (fits.indexOf(currentFit) + 1) % fits.length;
                setVideoFit(fits[nextIndex]);
                fitButton.textContent = `Video Fit: ${fits[nextIndex]}`;
            };
            
            overflowMenu.appendChild(fitButton);
        }
    }, 1000);
}

// ============================================================================
// KEYBOARD NAVIGATION
// ============================================================================

function initKeyboardNavigation() {
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            DOM.channelsSidebar.classList.remove("open");
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            DOM.channelSearchInput.focus();
        }

        if (
            (e.key === "ArrowDown" || e.key === "ArrowUp") &&
            document.activeElement.classList.contains("channel-card")
        ) {
            const current = document.activeElement;
            const index = parseInt(current.getAttribute("data-index") || "0", 10);
            const nextIndex = e.key === "ArrowDown" ? index + 1 : index - 1;
            const next = document.querySelector(
                `.channel-card[data-index="${nextIndex}"]`
            );
            
            if (next) {
                e.preventDefault();
                next.focus();
                scrollIntoViewSafely(next);
            }
        }

        if (e.key === " " && document.activeElement === AppState.video) {
            e.preventDefault();
            if (AppState.isOverlayVisible) {
                DOM.playerOverlayTop.classList.add('hidden');
                AppState.isOverlayVisible = false;
            } else {
                DOM.playerOverlayTop.classList.remove('hidden');
                AppState.isOverlayVisible = true;
                setupOverlayAutoHide();
            }
        }
    });
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function initEventListeners() {
    const debouncedSearch = debounce((value) => handleSearch(value), 300);
    if (DOM.channelSearchInput) {
        DOM.channelSearchInput.addEventListener("input", (e) =>
            debouncedSearch(e.target.value)
        );
    }

    if (DOM.toggleSidebarBtn) {
        DOM.toggleSidebarBtn.addEventListener("click", () => {
            DOM.channelsSidebar.classList.toggle("open");
            
            if (DOM.channelsSidebar.classList.contains("open")) {
                const activeCard = DOM.channelsSidebar.querySelector(".channel-card.active");
                const target = activeCard || DOM.channelsSidebar.querySelector(".channel-card");
                
                if (target) {
                    target.focus();
                    scrollIntoViewSafely(target);
                }
            }
        });
    }

    if (DOM.errorRetry) {
        DOM.errorRetry.addEventListener("click", () => {
            hideError();
            if (AppState.currentChannel) {
                playChannel(AppState.currentChannel);
            }
        });
    }

    if (DOM.closeAdBtn) {
        DOM.closeAdBtn.addEventListener("click", hideFullPageAd);
    }

    if (DOM.modalContinueBtn) {
        DOM.modalContinueBtn.addEventListener("click", () => {
            const userVerified = confirm("Please confirm you have joined the Telegram channel to continue.");
            if (userVerified) {
                DOM.telegramModal.style.display = 'none';
                document.body.style.overflow = 'auto';
                AppState.isTelegramModalActive = false;
                if (AppState.currentChannel) {
                    playChannel(AppState.currentChannel);
                }
            }
        });
    }

    const debouncedMouseMove = debounce(handleMouseMove, 100);
    const playerArea = document.querySelector('.player-area');
    if (playerArea) {
        playerArea.addEventListener('mousemove', debouncedMouseMove);
    }

    window.addEventListener('resize', debounce(() => {
        if (window.innerWidth > 900) {
            DOM.channelsSidebar.classList.remove('open');
        }
    }, 250));
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function initDOMReferences() {
    DOM.channelSearchInput = document.getElementById("channel-search");
    DOM.channelGridContainer = document.getElementById("channel-grid-container");
    DOM.channelsSidebar = document.getElementById("channels-sidebar");
    DOM.playerArea = document.getElementById("player-area");
    DOM.toggleSidebarBtn = document.getElementById("toggle-sidebar");
    DOM.currentChannelName = document.getElementById("current-channel-name");
    DOM.currentChannelStatus = document.getElementById("current-channel-status");
    DOM.errorBanner = document.getElementById("error-banner");
    DOM.errorText = document.getElementById("error-text");
    DOM.errorRetry = document.getElementById("error-retry");
    DOM.playerOverlayTop = document.getElementById("player-overlay-top");
    DOM.videoContainer = document.querySelector(".shaka-video-container");
    DOM.fullpageAd = document.getElementById("fullpage-ad");
    DOM.adIframeContainer = document.getElementById("ad-iframe-container");
    DOM.closeAdBtn = document.getElementById("close-ad-btn");
    DOM.telegramModal = document.getElementById("telegram-modal");
    DOM.modalContinueBtn = document.getElementById("modal-continue-btn");
}

async function initApp() {
    try {
        console.log("Initializing IMax TV Enhanced...");
        
        initDOMReferences();
        await initPlayer();
        initSecurityMonitoring();
        await loadChannels();
        initKeyboardNavigation();
        initEventListeners();
        
        console.log("IMax TV Enhanced initialized successfully");
    } catch (error) {
        console.error("Failed to initialize app:", error);
        showError("Failed to initialize application. Please refresh the page.");
    }
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (AppState.devToolsCheckInterval) {
        clearInterval(AppState.devToolsCheckInterval);
    }
    if (AppState.player) {
        AppState.player.destroy();
    }
});

if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}
