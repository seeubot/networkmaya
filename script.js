/**
 * Channel Hub - Live TV Player
 * Main application script
 */

// ============================================================================
// API CONFIGURATION
// ============================================================================
const API_CONFIG = {
    BASE_URL: "https://static-crane-seeutech-17dd4df3.koyeb.app",
    ENDPOINTS: {
        CHANNELS: "/api/channels",
        STREAM_INFO: "/api/stream", // Example additional endpoint
    },
    DEFAULT_HEADERS: {
        Referer: "https://www.jiotv.com/",
        "User-Agent": "plaYtv/7.1.5 (Linux;Android 13) ExoPlayerLib/2.11.6"
    }
};

// ============================================================================
// PLAYER CONFIGURATION
// ============================================================================
const PLAYER_CONFIG = {
    streaming: {
        lowLatencyMode: true,
        bufferingGoal: 10,
        rebufferingGoal: 2,
        bufferBehind: 10,
        retryParameters: {
            timeout: 10000,
            maxAttempts: 3,
            baseDelay: 1000,
            backoffFactor: 2
        }
    },
    manifest: {
        retryParameters: {
            timeout: 8000,
            maxAttempts: 2
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
    isOverlayVisible: true
};

// ============================================================================
// DOM ELEMENTS
// ============================================================================
const DOM = {
    channelSearchInput: null,
    channelGrid: null,
    channelsSidebar: null,
    toggleSidebarBtn: null,
    currentChannelName: null,
    currentChannelStatus: null,
    errorBanner: null,
    errorText: null,
    errorRetry: null,
    aspectRatioControls: null,
    playerOverlayTop: null,
    videoContainer: null
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Debounce function to limit rate of function calls
 */
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

/**
 * Creates a placeholder URL for channel logos
 */
function getPlaceholderUrl(title) {
    const truncated = encodeURIComponent(title.substring(0, 16));
    return `https://placehold.co/300x100/10131D/9CA3AF?text=${truncated}`;
}

/**
 * Safely scrolls an element into view
 */
function scrollIntoViewSafely(element, options = { behavior: 'smooth', block: 'nearest' }) {
    if (element && typeof element.scrollIntoView === 'function') {
        element.scrollIntoView(options);
    }
}

// ============================================================================
// UI FUNCTIONS
// ============================================================================

/**
 * Shows the error banner with a message
 */
function showError(message) {
    DOM.errorText.textContent = message;
    DOM.errorBanner.style.display = "flex";
}

/**
 * Hides the error banner
 */
function hideError() {
    DOM.errorBanner.style.display = "none";
}

/**
 * Shows loading state in the channel list
 */
function showLoading() {
    DOM.channelGrid.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            <p>Loading channels...</p>
        </div>
    `;
    hideError();
}

/**
 * Updates the current channel information display
 */
function updateChannelInfo(name, status) {
    DOM.currentChannelName.textContent = name;
    DOM.currentChannelStatus.textContent = status;
}

/**
 * Auto-hide overlay after a delay when video is playing
 */
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

/**
 * Show overlay on mouse movement
 */
function handleMouseMove() {
    if (!AppState.isOverlayVisible) {
        DOM.playerOverlayTop.classList.remove('hidden');
        AppState.isOverlayVisible = true;
    }
    setupOverlayAutoHide();
}

// ============================================================================
// CHANNEL MANAGEMENT
// ============================================================================

/**
 * Filters and renders channels based on search term
 */
function handleSearch(searchTerm) {
    AppState.currentSearchTerm = searchTerm.toLowerCase().trim();
    renderChannels();
}

/**
 * Renders channel cards in the sidebar
 */
function renderChannels() {
    const filteredChannels = AppState.currentSearchTerm.length > 0
        ? AppState.allChannels.filter((c) =>
            c.title.toLowerCase().includes(AppState.currentSearchTerm)
        )
        : AppState.allChannels;

    if (!filteredChannels.length) {
        DOM.channelGrid.innerHTML = `
            <div class="loading">
                <p>No channels found for "${AppState.currentSearchTerm}".</p>
            </div>
        `;
        return;
    }

    DOM.channelGrid.innerHTML = "";
    
    const sectionLabel = document.createElement("div");
    sectionLabel.className = "channel-section-label";
    sectionLabel.textContent = AppState.currentSearchTerm.length > 0 
        ? "Search Results" 
        : `All Channels (${filteredChannels.length})`;
    DOM.channelGrid.appendChild(sectionLabel);

    filteredChannels.forEach((channel, index) => {
        const card = createChannelCard(channel, index);
        DOM.channelGrid.appendChild(card);
    });
}

/**
 * Creates a channel card element
 */
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
        </div>
        <div class="channel-info">
            <div class="channel-title">${channel.title}</div>
            <div class="channel-meta">Live • HD</div>
        </div>
    `;

    // Event listeners
    card.addEventListener("click", () => playChannel(channel));
    card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            playChannel(channel);
        }
    });

    return card;
}

/**
 * Fetches channels from the API
 */
async function loadChannels() {
    showLoading();
    hideError();
    
    try {
        const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CHANNELS}`;
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
            
            // Auto-play first channel if available
            if (AppState.allChannels.length > 0) {
                await playChannel(AppState.allChannels[0]);
            }
        } else {
            throw new Error("Invalid channel response format");
        }
    } catch (error) {
        console.error("Failed to load channels:", error);
        showError(`Failed to load channels: ${error.message}`);
        DOM.channelGrid.innerHTML = `
            <div class="loading">
                <p>Failed to load channels.</p>
                <button onclick="loadChannels()" style="margin-top: 10px; padding: 8px 16px; background: #4CAF50; border: none; border-radius: 6px; color: white; cursor: pointer;">Retry</button>
            </div>
        `;
    }
}

// ============================================================================
// VIDEO PLAYER FUNCTIONS
// ============================================================================

/**
 * Attempts to play video with autoplay fallback
 */
async function attemptAutoplay() {
    if (!AppState.video) return false;
    
    try {
        AppState.video.muted = false;
        await AppState.video.play();
        return true;
    } catch (error) {
        try {
            // Fallback to muted autoplay
            AppState.video.muted = true;
            await AppState.video.play();
            console.log("Playing with muted fallback");
            return true;
        } catch (mutedError) {
            console.warn("Autoplay failed even with mute:", mutedError);
            return false;
        }
    }
}

/**
 * Attempts to enter fullscreen mode
 */
async function enterFullscreen() {
    const container = DOM.videoContainer;
    if (!container) return;
    
    try {
        if (container.requestFullscreen) {
            await container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
            await container.webkitRequestFullscreen();
        } else if (container.mozRequestFullScreen) {
            await container.mozRequestFullScreen();
        } else if (container.msRequestFullscreen) {
            await container.msRequestFullscreen();
        }
    } catch (error) {
        console.warn("Fullscreen request failed:", error);
    }
}

/**
 * Sets the video aspect ratio/fit mode
 */
function setVideoFit(fit) {
    if (!AppState.video) return;
    
    const fitClass = `video-fit-${fit}`;
    AppState.video.className = AppState.video.className.replace(/video-fit-\w+/g, '').trim();
    AppState.video.classList.add(fitClass);
    AppState.currentVideoFit = fit;

    // Update button states
    document.querySelectorAll('#aspect-ratio-controls button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeBtn = document.querySelector(`button[data-fit="${fit}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

/**
 * Initializes aspect ratio control buttons
 */
function initAspectRatioControls() {
    setVideoFit('contain');

    DOM.aspectRatioControls.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (button && button.dataset.fit) {
            setVideoFit(button.dataset.fit);
        }
    });
}

/**
 * Configures DRM for the player
 */
function configureDRM(channel) {
    if (channel.key && channel.key.includes(":")) {
        const [keyId, keyValue] = channel.key.split(":");
        AppState.player.configure({
            drm: {
                clearKeys: {
                    [keyId]: keyValue
                }
            }
        });
    } else {
        AppState.player.configure({ drm: { clearKeys: {} } });
    }
}

/**
 * Sets up network request filters for streaming
 */
function setupNetworkFilters(channel) {
    const net = AppState.player.getNetworkingEngine();
    net.clearAllRequestFilters();
    
    net.registerRequestFilter((type, request) => {
        // Add default headers
        request.headers["Referer"] = API_CONFIG.DEFAULT_HEADERS.Referer;
        request.headers["User-Agent"] = API_CONFIG.DEFAULT_HEADERS["User-Agent"];

        // Add channel-specific cookie if available
        if (channel.cookie) {
            request.headers["Cookie"] = channel.cookie;
        }

        // Handle hdnea parameter in URL
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
}

/**
 * Plays a selected channel
 */
async function playChannel(channel) {
    if (!AppState.player) {
        console.error("Player not initialized");
        return;
    }

    hideError();

    // Deactivate all channel cards
    document.querySelectorAll(".channel-card").forEach((c) =>
        c.classList.remove("active")
    );
    
    AppState.currentChannel = channel;
    updateChannelInfo(channel.title, "Loading live stream…");

    // Highlight selected card
    const cards = document.querySelectorAll(".channel-card");
    cards.forEach((card) => {
        if (card.getAttribute("data-channel-id") === channel.id) {
            card.classList.add("active");
            card.focus();
        }
    });

    // Close sidebar on mobile
    if (window.innerWidth <= 900) {
        DOM.channelsSidebar.classList.remove("open");
    }

    try {
        // Unload previous stream
        await AppState.player.unload();

        // Configure DRM
        configureDRM(channel);

        // Setup network filters
        setupNetworkFilters(channel);

        // Load and play the stream
        await AppState.player.load(channel.url);
        await attemptAutoplay();
        
        updateChannelInfo(channel.title, "Live • Watching Now");
        setupOverlayAutoHide();
        
        // Enter fullscreen
        await enterFullscreen();
        
    } catch (error) {
        console.error("Playback error:", error);
        updateChannelInfo(channel.title, "Error loading channel");
        showError(`Failed to play ${channel.title}. ${error.message || 'Please try again.'}`);
    }
}

/**
 * Initializes the Shaka Player
 */
async function initPlayer() {
    // Install polyfills
    shaka.polyfill.installAll();

    // Check browser support
    if (!shaka.Player.isBrowserSupported()) {
        showError("Your browser does not support video playback.");
        return;
    }

    // Get video element
    AppState.video = document.querySelector("video");
    AppState.player = new shaka.Player();

    // Attach player to video element
    await AppState.player.attach(AppState.video);

    // Initialize UI overlay
    const container = DOM.videoContainer;
    AppState.ui = new shaka.ui.Overlay(AppState.player, container, AppState.video);

    // Configure UI
    AppState.ui.configure({
        controlPanelElements: [
            "play_pause",
            "time_and_duration",
            "mute",
            "volume",
            "spacer",
            "quality",
            "fullscreen"
        ],
        addSeekBar: true,
        addBigPlayButton: true,
        volumeBarColors: { base: "#475569", level: "#4CAF50" },
        seekBarColors: {
            base: "#6B7280",
            buffered: "#F59E0B",
            played: "#4CAF50"
        }
    });

    // Configure player
    AppState.player.configure(PLAYER_CONFIG);

    // Error handling
    AppState.player.addEventListener("error", (event) => {
        console.error("Player error:", event.detail);
        showError(`Playback error: ${event.detail.message || 'Unknown error'}`);
        updateChannelInfo(
            AppState.currentChannel?.title || "Error",
            "Playback error"
        );
    });

    // Set default volume
    AppState.video.volume = 0.9;

    // Setup overlay auto-hide on play
    AppState.video.addEventListener('play', () => {
        setupOverlayAutoHide();
    });

    AppState.video.addEventListener('pause', () => {
        clearTimeout(AppState.overlayTimeout);
        DOM.playerOverlayTop.classList.remove('hidden');
        AppState.isOverlayVisible = true;
    });
}

// ============================================================================
// KEYBOARD NAVIGATION
// ============================================================================

/**
 * Initializes keyboard navigation and shortcuts
 */
function initKeyboardNavigation() {
    document.addEventListener("keydown", (e) => {
        // ESC: Close sidebar on mobile
        if (e.key === "Escape") {
            DOM.channelsSidebar.classList.remove("open");
        }

        // Ctrl/Cmd+K: Focus search
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            DOM.channelSearchInput.focus();
        }

        // Arrow Up/Down: Navigate channel list
        if (
            (e.key === "ArrowDown" || e.key === "ArrowUp") &&
            document.activeElement.classList.contains("channel-card")
        ) {
            const current = document.activeElement;
            const index = parseInt(current.getAttribute("data-index") || "0", 10);
            const nextIndex = e.key === "ArrowDown" ? index + 1 : index - 1;
            const next = DOM.channelGrid.querySelector(
                `.channel-card[data-index="${nextIndex}"]`
            );
            
            if (next) {
                e.preventDefault();
                next.focus();
                scrollIntoViewSafely(next);
            }
        }

        // Space: Show/hide overlay when video is focused
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

/**
 * Initializes event listeners
 */
function initEventListeners() {
    // Search input with debounce
    const debouncedSearch = debounce((value) => handleSearch(value), 300);
    DOM.channelSearchInput.addEventListener("input", (e) =>
        debouncedSearch(e.target.value)
    );

    // Toggle sidebar button
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

    // Error retry button
    DOM.errorRetry.addEventListener("click", () => {
        hideError();
        if (AppState.currentChannel) {
            playChannel(AppState.currentChannel);
        } else {
            loadChannels();
        }
    });

    // Mouse move for overlay
    const debouncedMouseMove = debounce(handleMouseMove, 100);
    document.querySelector('.player-area').addEventListener('mousemove', debouncedMouseMove);

    // Window resize handler
    window.addEventListener('resize', debounce(() => {
        if (window.innerWidth > 900) {
            DOM.channelsSidebar.classList.remove('open');
        }
    }, 250));
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initializes DOM element references
 */
function initDOMReferences() {
    DOM.channelSearchInput = document.getElementById("channel-search");
    DOM.channelGrid = document.getElementById("channel-grid");
    DOM.channelsSidebar = document.getElementById("channels-sidebar");
    DOM.toggleSidebarBtn = document.getElementById("toggle-sidebar");
    DOM.currentChannelName = document.getElementById("current-channel-name");
    DOM.currentChannelStatus = document.getElementById("current-channel-status");
    DOM.errorBanner = document.getElementById("error-banner");
    DOM.errorText = document.getElementById("error-text");
    DOM.errorRetry = document.getElementById("error-retry");
    DOM.aspectRatioControls = document.getElementById("aspect-ratio-controls");
    DOM.playerOverlayTop = document.getElementById("player-overlay-top");
    DOM.videoContainer = document.querySelector(".shaka-video-container");
}

/**
 * Main application initialization
 */
async function initApp() {
    try {
        initDOMReferences();
        initAspectRatioControls();
        await initPlayer();
        await loadChannels();
        initKeyboardNavigation();
        initEventListeners();
        
        console.log("Channel Hub initialized successfully");
    } catch (error) {
        console.error("Failed to initialize app:", error);
        showError("Failed to initialize application. Please refresh the page.");
    }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}
