/**
 * StreamMax - Premium Live Streaming Platform
 * Main Application Script
 */

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
    API: {
        BASE_URL: "https://static-crane-seeutech-17dd4df3.koyeb.app",
        ENDPOINTS: {
            CHANNELS: "/api/channels",
            STREAM: "/api/stream",
        },
        HEADERS: {
            'Referer': 'https://www.jiotv.com/',
            'User-Agent': 'StreamMax/1.0.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        TIMEOUT: 15000
    },
    
    PLAYER: {
        BUFFERING_GOAL: 15,
        REBUFFERING_GOAL: 3,
        ABR_ENABLED: true,
        DEFAULT_BANDWIDTH: 2000000,
        LOW_LATENCY: true,
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 2000
    },
    
    ADS: {
        ENABLED: true,
        PRE_ROLL: true,
        MID_ROLL: true,
        SKIP_TIMER: 5, // seconds before skip is enabled
        AD_DURATION: 30, // seconds
        MID_ROLL_INTERVAL: 300, // show mid-roll every 5 minutes
        
        // Mock ad servers (replace with your actual ad URLs)
        SERVERS: {
            PRE_ROLL: [
                'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
                'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4'
            ],
            MID_ROLL: [
                'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'
            ]
        },
        
        TRACKING: {
            IMPRESSION: 'https://ad-tracker.example.com/impression',
            SKIP: 'https://ad-tracker.example.com/skip',
            COMPLETE: 'https://ad-tracker.example.com/complete'
        }
    },
    
    UI: {
        OVERLAY_TIMEOUT: 3000,
        ANIMATION_DURATION: 300,
        DEBOUNCE_DELAY: 250
    }
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================
const AppState = {
    // Player State
    player: null,
    ui: null,
    video: null,
    isPlaying: false,
    isFullscreen: false,
    quality: 'auto',
    
    // Channel State
    channels: [],
    filteredChannels: [],
    currentChannel: null,
    categories: [],
    
    // Ad State
    adPlayer: null,
    currentAd: null,
    isAdPlaying: false,
    adQueue: [],
    skipTimer: null,
    skipTimeLeft: CONFIG.ADS.SKIP_TIMER,
    adProgressInterval: null,
    midRollScheduled: false,
    
    // UI State
    isLoading: false,
    isError: false,
    isSidebarOpen: true,
    searchQuery: '',
    
    // Player Instance
    playerInstance: null
};

// ============================================================================
// DOM ELEMENTS
// ============================================================================
const DOM = {
    // Sidebar
    sidebar: document.getElementById('sidebar'),
    menuToggle: document.getElementById('menu-toggle'),
    searchInput: document.getElementById('search-input'),
    channelsContainer: document.getElementById('channels-container'),
    
    // Player
    videoContainer: document.getElementById('video-container'),
    videoPlayer: document.getElementById('video-player'),
    
    // Current Channel Info
    currentChannelInfo: document.getElementById('current-channel-info'),
    channelCurrentLogo: document.querySelector('.channel-current-logo'),
    channelCurrentTitle: document.querySelector('.channel-current-title'),
    channelCurrentStatus: document.querySelector('.channel-current-status'),
    
    // Ad System
    adOverlay: document.getElementById('ad-overlay'),
    adControlsOverlay: document.getElementById('ad-controls-overlay'),
    midrollIndicator: document.getElementById('midroll-indicator'),
    adTimer: document.getElementById('ad-timer'),
    adCountdown: document.getElementById('ad-countdown'),
    adBigCountdown: document.getElementById('ad-big-countdown'),
    adMessage: document.getElementById('ad-message'),
    skipAdBtn: document.getElementById('skip-ad-btn'),
    skipTimer: document.getElementById('skip-timer'),
    skipAdBtnSmall: document.getElementById('skip-ad-btn-small'),
    skipTimerSmall: document.getElementById('skip-timer-small'),
    adProgressFill: document.getElementById('ad-progress-fill'),
    adTime: document.getElementById('ad-time'),
    midrollCountdown: document.getElementById('midroll-countdown'),
    
    // UI States
    loadingState: document.getElementById('loading-state'),
    loadingText: document.getElementById('loading-text'),
    errorState: document.getElementById('error-state'),
    errorMessage: document.getElementById('error-message'),
    errorDetails: document.getElementById('error-details'),
    retryButton: document.getElementById('retry-button'),
    
    // Controls
    fullscreenBtn: document.getElementById('fullscreen-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    qualityBtn: document.getElementById('quality-btn')
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
const Utils = {
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    formatTime: (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },
    
    getChannelLogo: (channel) => {
        return channel.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(channel.title)}&background=6366F1&color=fff&size=128`;
    },
    
    showElement: (element) => {
        element.style.display = 'flex';
        setTimeout(() => {
            element.style.opacity = '1';
            element.style.visibility = 'visible';
        }, 10);
    },
    
    hideElement: (element) => {
        element.style.opacity = '0';
        element.style.visibility = 'hidden';
        setTimeout(() => {
            element.style.display = 'none';
        }, CONFIG.UI.ANIMATION_DURATION);
    },
    
    showToast: (message, type = 'info') => {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            </div>
            <div class="toast-message">${message}</div>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Add to body
        document.body.appendChild(toast);
        
        // Show toast
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
        
        // Close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        });
    }
};

// ============================================================================
// CHANNEL MANAGEMENT
// ============================================================================
const ChannelManager = {
    async loadChannels() {
        try {
            DOM.loadingText.textContent = 'Loading channels...';
            Utils.showElement(DOM.loadingState);
            
            const response = await fetch(`${CONFIG.API.BASE_URL}${CONFIG.API.ENDPOINTS.CHANNELS}`, {
                headers: CONFIG.API.HEADERS
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success && Array.isArray(data.data)) {
                AppState.channels = data.data;
                AppState.filteredChannels = [...data.data];
                
                // Extract categories
                AppState.categories = [...new Set(data.data.map(ch => ch.category).filter(Boolean))];
                
                this.renderChannels();
                Utils.hideElement(DOM.loadingState);
                
                Utils.showToast(`Loaded ${AppState.channels.length} channels`, 'success');
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error('Failed to load channels:', error);
            Utils.showToast('Failed to load channels. Please try again.', 'error');
            
            // Show error state
            DOM.errorMessage.textContent = 'Failed to Load Channels';
            DOM.errorDetails.textContent = error.message;
            Utils.showElement(DOM.errorState);
            Utils.hideElement(DOM.loadingState);
        }
    },
    
    renderChannels() {
        DOM.channelsContainer.innerHTML = '';
        
        if (AppState.filteredChannels.length === 0) {
            DOM.channelsContainer.innerHTML = `
                <div style="text-align: center; padding: 48px 24px; color: var(--text-tertiary);">
                    <i class="fas fa-search" style="font-size: 48px; margin-bottom: 16px;"></i>
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">No channels found</div>
                    <div style="font-size: 14px;">Try a different search term</div>
                </div>
            `;
            return;
        }
        
        // Group by category
        const groupedChannels = {};
        AppState.filteredChannels.forEach(channel => {
            const category = channel.category || 'General';
            if (!groupedChannels[category]) {
                groupedChannels[category] = [];
            }
            groupedChannels[category].push(channel);
        });
        
        // Render each category
        Object.entries(groupedChannels).forEach(([category, channels], index) => {
            const section = document.createElement('div');
            section.className = 'channels-section';
            section.innerHTML = `
                <div class="section-header">
                    <div class="section-title">${category}</div>
                    <div class="channels-count">${channels.length}</div>
                </div>
                <div class="channels-grid" style="animation-delay: ${index * 0.1}s">
                    ${channels.map((channel, idx) => this.createChannelCard(channel, idx)).join('')}
                </div>
            `;
            DOM.channelsContainer.appendChild(section);
        });
    },
    
    createChannelCard(channel, index) {
        const isActive = AppState.currentChannel?.id === channel.id;
        const logoUrl = Utils.getChannelLogo(channel);
        
        return `
            <div class="channel-card ${isActive ? 'active' : ''}" 
                 data-channel-id="${channel.id}"
                 style="animation-delay: ${index * 0.05}s">
                <div class="channel-logo">
                    <img src="${logoUrl}" 
                         alt="${channel.title}"
                         onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(channel.title)}&background=6366F1&color=fff&size=128'">
                </div>
                <div class="channel-info">
                    <div class="channel-title">${channel.title}</div>
                    <div class="channel-meta">
                        <span class="live-badge">LIVE</span>
                        <span>${channel.resolution || 'HD'}</span>
                    </div>
                    ${channel.tags ? `
                        <div class="category-tags">
                            ${channel.tags.split(',').map(tag => `
                                <span class="category-tag">${tag.trim()}</span>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },
    
    filterChannels(query) {
        AppState.searchQuery = query.toLowerCase().trim();
        
        if (!AppState.searchQuery) {
            AppState.filteredChannels = [...AppState.channels];
        } else {
            AppState.filteredChannels = AppState.channels.filter(channel =>
                channel.title.toLowerCase().includes(AppState.searchQuery) ||
                (channel.category && channel.category.toLowerCase().includes(AppState.searchQuery)) ||
                (channel.tags && channel.tags.toLowerCase().includes(AppState.searchQuery))
            );
        }
        
        this.renderChannels();
    },
    
    selectChannel(channel) {
        if (AppState.currentChannel?.id === channel.id) return;
        
        // Update UI
        AppState.currentChannel = channel;
        this.updateCurrentChannelInfo();
        
        // Highlight active card
        document.querySelectorAll('.channel-card').forEach(card => {
            card.classList.remove('active');
        });
        const activeCard = document.querySelector(`[data-channel-id="${channel.id}"]`);
        if (activeCard) {
            activeCard.classList.add('active');
            activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        
        // Play channel
        PlayerManager.playChannel(channel);
        
        // Close sidebar on mobile
        if (window.innerWidth < 1024) {
            AppState.isSidebarOpen = false;
            DOM.sidebar.classList.add('hidden');
        }
        
        Utils.showToast(`Switched to ${channel.title}`, 'success');
    },
    
    updateCurrentChannelInfo() {
        if (!AppState.currentChannel) return;
        
        const channel = AppState.currentChannel;
        const logoUrl = Utils.getChannelLogo(channel);
        
        DOM.channelCurrentLogo.innerHTML = `<img src="${logoUrl}" alt="${channel.title}" style="width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-md);">`;
        DOM.channelCurrentTitle.textContent = channel.title;
        
        if (AppState.isAdPlaying) {
            DOM.channelCurrentStatus.innerHTML = `
                <span class="status-indicator" style="background: var(--accent);"></span>
                <span>Advertisement Playing</span>
            `;
        } else if (AppState.isPlaying) {
            DOM.channelCurrentStatus.innerHTML = `
                <span class="status-indicator"></span>
                <span>Live • Watching Now</span>
            `;
        } else {
            DOM.channelCurrentStatus.innerHTML = `
                <span class="status-indicator" style="background: var(--text-tertiary);"></span>
                <span>Ready to Play</span>
            `;
        }
    }
};

// ============================================================================
// PLAYER MANAGEMENT
// ============================================================================
const PlayerManager = {
    async init() {
        try {
            // Check browser support
            if (!shaka.Player.isBrowserSupported()) {
                throw new Error('Browser not supported for video playback');
            }
            
            // Initialize Shaka Player
            shaka.polyfill.installAll();
            
            AppState.player = new shaka.Player();
            AppState.video = DOM.videoPlayer;
            
            // Attach player to video element
            await AppState.player.attach(DOM.videoPlayer);
            
            // Configure player
            this.configurePlayer();
            
            // Initialize UI
            this.initUI();
            
            // Setup event listeners
            this.setupEventListeners();
            
            console.log('Player initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize player:', error);
            this.showError('Player Initialization Failed', error.message);
        }
    },
    
    configurePlayer() {
        AppState.player.configure({
            streaming: {
                bufferingGoal: CONFIG.PLAYER.BUFFERING_GOAL,
                rebufferingGoal: CONFIG.PLAYER.REBUFFERING_GOAL,
                lowLatencyMode: CONFIG.PLAYER.LOW_LATENCY,
                retryParameters: {
                    maxAttempts: CONFIG.PLAYER.RETRY_ATTEMPTS,
                    baseDelay: CONFIG.PLAYER.RETRY_DELAY,
                    backoffFactor: 2,
                    fuzzFactor: 0.5
                }
            },
            abr: {
                enabled: CONFIG.PLAYER.ABR_ENABLED,
                defaultBandwidthEstimate: CONFIG.PLAYER.DEFAULT_BANDWIDTH,
                switchInterval: 8,
                bandwidthDowngradeTarget: 0.95,
                bandwidthUpgradeTarget: 0.85
            },
            manifest: {
                retryParameters: {
                    timeout: 10000,
                    maxAttempts: 3
                },
                dash: {
                    ignoreMinBufferTime: true
                }
            }
        });
    },
    
    initUI() {
        // Create Shaka UI
        const videoContainer = DOM.videoContainer;
        AppState.ui = new shaka.ui.Overlay(AppState.player, videoContainer, DOM.videoPlayer);
        
        // Configure UI
        AppState.ui.configure({
            controlPanelElements: [
                'play_pause',
                'time_and_duration',
                'mute',
                'volume',
                'spacer',
                'quality',
                'playback_rate',
                'overflow_menu',
                'fullscreen'
            ],
            addSeekBar: true,
            addBigPlayButton: true,
            seekBarColors: {
                base: 'rgba(255, 255, 255, 0.3)',
                buffered: 'rgba(255, 255, 255, 0.5)',
                played: 'var(--primary)'
            },
            volumeBarColors: {
                base: 'rgba(255, 255, 255, 0.3)',
                level: 'var(--primary)'
            }
        });
    },
    
    setupEventListeners() {
        // Player events
        AppState.player.addEventListener('error', (event) => {
            const error = event.detail;
            console.error('Player error:', error);
            this.showError('Playback Error', error.message);
        });
        
        AppState.player.addEventListener('buffering', (event) => {
            if (event.buffering) {
                DOM.loadingText.textContent = 'Buffering stream...';
                Utils.showElement(DOM.loadingState);
            } else {
                Utils.hideElement(DOM.loadingState);
            }
        });
        
        // Video events
        AppState.video.addEventListener('play', () => {
            AppState.isPlaying = true;
            ChannelManager.updateCurrentChannelInfo();
        });
        
        AppState.video.addEventListener('pause', () => {
            AppState.isPlaying = false;
            ChannelManager.updateCurrentChannelInfo();
        });
        
        AppState.video.addEventListener('ended', () => {
            AppState.isPlaying = false;
            ChannelManager.updateCurrentChannelInfo();
        });
        
        // Fullscreen
        DOM.fullscreenBtn.addEventListener('click', this.toggleFullscreen);
        
        // Handle fullscreen change
        document.addEventListener('fullscreenchange', () => {
            AppState.isFullscreen = !!document.fullscreenElement;
            DOM.fullscreenBtn.innerHTML = AppState.isFullscreen ? 
                '<i class="fas fa-compress"></i>' : 
                '<i class="fas fa-expand"></i>';
        });
    },
    
    async playChannel(channel) {
        try {
            // Show loading
            DOM.loadingText.textContent = 'Loading channel...';
            Utils.showElement(DOM.loadingState);
            
            // Clean up previous playback
            if (AppState.player) {
                await AppState.player.unload();
            }
            
            // Hide error if shown
            Utils.hideElement(DOM.errorState);
            
            // Configure DRM if needed
            if (channel.key && channel.key.includes(':')) {
                const [keyId, keyValue] = channel.key.split(':');
                AppState.player.configure({
                    drm: {
                        clearKeys: {
                            [keyId]: keyValue
                        }
                    }
                });
            }
            
            // Setup network filters
            this.setupNetworkFilters(channel);
            
            // Check if we should play ad first
            if (CONFIG.ADS.ENABLED && CONFIG.ADS.PRE_ROLL) {
                await AdManager.playPreRollAd(channel);
            } else {
                // Load and play main content directly
                await this.loadMainContent(channel);
            }
            
        } catch (error) {
            console.error('Failed to play channel:', error);
            this.showError('Playback Failed', error.message);
        }
    },
    
    async loadMainContent(channel) {
        try {
            // Load the stream
            await AppState.player.load(channel.url);
            
            // Attempt autoplay
            try {
                await AppState.video.play();
                AppState.isPlaying = true;
            } catch (error) {
                console.warn('Autoplay failed:', error);
                // User interaction will be required
            }
            
            // Schedule mid-roll ads
            if (CONFIG.ADS.ENABLED && CONFIG.ADS.MID_ROLL) {
                AdManager.scheduleMidRollAds();
            }
            
            // Update UI
            ChannelManager.updateCurrentChannelInfo();
            Utils.hideElement(DOM.loadingState);
            
            Utils.showToast(`Now playing: ${channel.title}`, 'success');
            
        } catch (error) {
            throw error;
        }
    },
    
    setupNetworkFilters(channel) {
        const net = AppState.player.getNetworkingEngine();
        net.clearAllRequestFilters();
        net.clearAllResponseFilters();
        
        net.registerRequestFilter((type, request) => {
            // Add required headers
            request.headers = {
                ...request.headers,
                ...CONFIG.API.HEADERS
            };
            
            // Add cookies if available
            if (channel.cookie) {
                request.headers['Cookie'] = channel.cookie;
                
                // Handle hdnea parameter
                const hdneaMatch = channel.cookie.match(/__hdnea__=[^;]+/);
                if (hdneaMatch && request.uris && request.uris[0]) {
                    const url = new URL(request.uris[0]);
                    if (!url.searchParams.has('__hdnea__')) {
                        request.uris[0] += (url.search ? '&' : '?') + hdneaMatch[0];
                    }
                }
            }
        });
    },
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            DOM.videoContainer.requestFullscreen().catch(err => {
                console.error('Failed to enter fullscreen:', err);
            });
        } else {
            document.exitFullscreen();
        }
    },
    
    showError(title, message) {
        DOM.errorMessage.textContent = title;
        DOM.errorDetails.textContent = message;
        Utils.showElement(DOM.errorState);
        Utils.hideElement(DOM.loadingState);
    }
};

// ============================================================================
// ADVERTISEMENT MANAGEMENT
// ============================================================================
const AdManager = {
    init() {
        // Create ad video element
        AppState.adPlayer = document.createElement('video');
        AppState.adPlayer.style.display = 'none';
        document.body.appendChild(AppState.adPlayer);
        
        // Setup ad player events
        AppState.adPlayer.addEventListener('timeupdate', this.updateAdProgress.bind(this));
        AppState.adPlayer.addEventListener('ended', this.onAdEnded.bind(this));
        AppState.adPlayer.addEventListener('error', this.onAdError.bind(this));
        
        // Setup skip button events
        DOM.skipAdBtn.addEventListener('click', this.skipAd.bind(this));
        DOM.skipAdBtnSmall.addEventListener('click', this.skipAd.bind(this));
        
        console.log('Ad system initialized');
    },
    
    async playPreRollAd(channel) {
        // Store channel for after ad
        AppState.currentChannel = channel;
        
        // Prepare ad
        const ad = {
            id: `preroll-${Date.now()}`,
            url: CONFIG.ADS.SERVERS.PRE_ROLL[Math.floor(Math.random() * CONFIG.ADS.SERVERS.PRE_ROLL.length)],
            type: 'pre-roll',
            duration: CONFIG.ADS.AD_DURATION
        };
        
        // Show ad overlay with countdown
        this.showAdOverlay(ad, 'Pre-roll advertisement starting soon');
    },
    
    scheduleMidRollAds() {
        if (AppState.midRollScheduled) return;
        
        AppState.midRollScheduled = true;
        
        AppState.video.addEventListener('timeupdate', () => {
            if (AppState.isAdPlaying) return;
            
            const currentTime = Math.floor(AppState.video.currentTime);
            
            // Check if it's time for mid-roll ad
            if (currentTime > 0 && currentTime % CONFIG.ADS.MID_ROLL_INTERVAL === 0) {
                this.playMidRollAd();
            }
        });
    },
    
    async playMidRollAd() {
        // Pause main content
        AppState.video.pause();
        
        // Show mid-roll indicator
        this.showMidRollIndicator();
    },
    
    showAdOverlay(ad, message) {
        // Reset state
        this.resetAdState();
        
        // Store current ad
        AppState.currentAd = ad;
        AppState.isAdPlaying = true;
        
        // Update UI
        DOM.adMessage.textContent = message;
        ChannelManager.updateCurrentChannelInfo();
        
        // Show overlays
        DOM.adOverlay.classList.add('active');
        DOM.adControlsOverlay.classList.add('active');
        
        // Start countdown
        this.startAdCountdown();
    },
    
    showMidRollIndicator() {
        DOM.midrollIndicator.classList.add('active');
        
        let countdown = 3;
        DOM.midrollCountdown.textContent = countdown;
        
        const interval = setInterval(() => {
            countdown--;
            DOM.midrollCountdown.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(interval);
                DOM.midrollIndicator.classList.remove('active');
                
                // Prepare and play mid-roll ad
                const ad = {
                    id: `midroll-${Date.now()}`,
                    url: CONFIG.ADS.SERVERS.MID_ROLL[Math.floor(Math.random() * CONFIG.ADS.SERVERS.MID_ROLL.length)],
                    type: 'mid-roll',
                    duration: CONFIG.ADS.AD_DURATION
                };
                
                this.showAdOverlay(ad, 'Mid-roll advertisement');
            }
        }, 1000);
    },
    
    startAdCountdown() {
        let countdown = 3;
        DOM.adCountdown.textContent = countdown;
        DOM.adBigCountdown.textContent = countdown;
        
        const countdownInterval = setInterval(() => {
            countdown--;
            DOM.adCountdown.textContent = countdown;
            DOM.adBigCountdown.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                this.startAdPlayback();
            }
        }, 1000);
    },
    
    async startAdPlayback() {
        try {
            // Hide countdown overlay
            DOM.adOverlay.classList.remove('active');
            
            // Load ad video
            AppState.adPlayer.src = AppState.currentAd.url;
            AppState.adPlayer.volume = AppState.video.volume;
            
            // Start playing ad
            await AppState.adPlayer.play();
            
            // Start skip timer
            this.startSkipTimer();
            
            // Start progress tracking
            this.startProgressTracking();
            
            // Track ad impression
            this.trackAdEvent('impression');
            
        } catch (error) {
            console.error('Failed to play ad:', error);
            this.skipAd();
        }
    },
    
    startSkipTimer() {
        AppState.skipTimeLeft = CONFIG.ADS.SKIP_TIMER;
        DOM.skipTimer.textContent = AppState.skipTimeLeft;
        DOM.skipTimerSmall.textContent = AppState.skipTimeLeft;
        
        DOM.skipAdBtn.disabled = true;
        DOM.skipAdBtnSmall.disabled = true;
        
        AppState.skipTimer = setInterval(() => {
            AppState.skipTimeLeft--;
            DOM.skipTimer.textContent = AppState.skipTimeLeft;
            DOM.skipTimerSmall.textContent = AppState.skipTimeLeft;
            
            if (AppState.skipTimeLeft <= 0) {
                clearInterval(AppState.skipTimer);
                DOM.skipAdBtn.disabled = false;
                DOM.skipAdBtnSmall.disabled = false;
            }
        }, 1000);
    },
    
    startProgressTracking() {
        if (AppState.adProgressInterval) {
            clearInterval(AppState.adProgressInterval);
        }
        
        AppState.adProgressInterval = setInterval(() => {
            this.updateAdProgress();
        }, 100);
    },
    
    updateAdProgress() {
        if (!AppState.adPlayer || !AppState.currentAd) return;
        
        const currentTime = AppState.adPlayer.currentTime || 0;
        const duration = AppState.currentAd.duration || 30;
        const progress = (currentTime / duration) * 100;
        
        // Update progress bar
        DOM.adProgressFill.style.width = `${progress}%`;
        
        // Update time display
        DOM.adTime.textContent = `${Utils.formatTime(currentTime)} / ${Utils.formatTime(duration)}`;
        
        // Auto-complete at 98% to avoid timing issues
        if (progress >= 98) {
            this.completeAd();
        }
    },
    
    skipAd() {
        if (AppState.skipTimeLeft > 0) return;
        
        // Track skip event
        this.trackAdEvent('skip');
        
        // Clean up ad playback
        this.cleanupAdPlayback();
        
        // Resume main content
        this.resumeMainContent();
        
        Utils.showToast('Advertisement skipped', 'info');
    },
    
    completeAd() {
        // Track completion
        this.trackAdEvent('complete');
        
        // Clean up ad playback
        this.cleanupAdPlayback();
        
        // Resume main content
        this.resumeMainContent();
    },
    
    onAdEnded() {
        this.completeAd();
    },
    
    onAdError() {
        console.error('Ad playback error');
        this.skipAd();
    },
    
    cleanupAdPlayback() {
        // Clear timers
        if (AppState.skipTimer) {
            clearInterval(AppState.skipTimer);
        }
        if (AppState.adProgressInterval) {
            clearInterval(AppState.adProgressInterval);
        }
        
        // Stop ad player
        if (AppState.adPlayer) {
            AppState.adPlayer.pause();
            AppState.adPlayer.src = '';
        }
        
        // Reset state
        AppState.currentAd = null;
        AppState.isAdPlaying = false;
        AppState.skipTimeLeft = CONFIG.ADS.SKIP_TIMER;
        
        // Hide overlays
        DOM.adOverlay.classList.remove('active');
        DOM.adControlsOverlay.classList.remove('active');
        
        // Update channel info
        ChannelManager.updateCurrentChannelInfo();
    },
    
    async resumeMainContent() {
        if (!AppState.currentChannel) return;
        
        try {
            // Load and play main content
            await PlayerManager.loadMainContent(AppState.currentChannel);
        } catch (error) {
            console.error('Failed to resume main content:', error);
            PlayerManager.showError('Resume Failed', error.message);
        }
    },
    
    resetAdState() {
        this.cleanupAdPlayback();
    },
    
    trackAdEvent(event) {
        if (!AppState.currentAd) return;
        
        // In production, send to your ad tracking server
        const trackingData = {
            adId: AppState.currentAd.id,
            type: AppState.currentAd.type,
            event: event,
            timestamp: Date.now(),
            userId: 'anonymous', // Replace with actual user ID
            channelId: AppState.currentChannel?.id
        };
        
        console.log('Ad event:', trackingData);
        
        // Example tracking call (uncomment and configure for production)
        /*
        fetch(CONFIG.ADS.TRACKING[event.toUpperCase()], {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trackingData)
        }).catch(console.error);
        */
    }
};

// ============================================================================
// UI CONTROLS
// ============================================================================
const UIControls = {
    init() {
        // Menu toggle
        DOM.menuToggle.addEventListener('click', () => {
            AppState.isSidebarOpen = !AppState.isSidebarOpen;
            DOM.sidebar.classList.toggle('hidden', !AppState.isSidebarOpen);
        });
        
        // Search input
        const debouncedSearch = Utils.debounce((value) => {
            ChannelManager.filterChannels(value);
        }, CONFIG.UI.DEBOUNDE_DELAY);
        
        DOM.searchInput.addEventListener('input', (e) => {
            debouncedSearch(e.target.value);
        });
        
        // Channel click delegation
        DOM.channelsContainer.addEventListener('click', (e) => {
            const channelCard = e.target.closest('.channel-card');
            if (channelCard) {
                const channelId = channelCard.dataset.channelId;
                const channel = AppState.channels.find(c => c.id === channelId);
                if (channel) {
                    ChannelManager.selectChannel(channel);
                }
            }
        });
        
        // Retry button
        DOM.retryButton.addEventListener('click', () => {
            Utils.hideElement(DOM.errorState);
            if (AppState.currentChannel) {
                PlayerManager.playChannel(AppState.currentChannel);
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Space to play/pause (when not in input)
            if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
                e.preventDefault();
                if (AppState.isAdPlaying) return;
                
                if (AppState.video.paused) {
                    AppState.video.play();
                } else {
                    AppState.video.pause();
                }
            }
            
            // F for fullscreen
            if (e.code === 'KeyF' && e.target.tagName !== 'INPUT') {
                e.preventDefault();
                PlayerManager.toggleFullscreen();
            }
            
            // Escape to skip ad (when available)
            if (e.code === 'Escape' && AppState.isAdPlaying && AppState.skipTimeLeft <= 0) {
                AdManager.skipAd();
            }
            
            // Ctrl/Cmd + K to focus search
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') {
                e.preventDefault();
                DOM.searchInput.focus();
            }
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth >= 1024) {
                DOM.sidebar.classList.remove('hidden');
                AppState.isSidebarOpen = true;
            } else if (AppState.isSidebarOpen) {
                DOM.sidebar.classList.add('hidden');
                AppState.isSidebarOpen = false;
            }
        });
    }
};

// ============================================================================
// INITIALIZATION
// ============================================================================
class StreamMaxApp {
    static async init() {
        try {
            console.log('Initializing StreamMax...');
            
            // Initialize subsystems
            await PlayerManager.init();
            AdManager.init();
            UIControls.init();
            
            // Load channels
            await ChannelManager.loadChannels();
            
            // Auto-select first channel (optional)
            // if (AppState.channels.length > 0) {
            //     setTimeout(() => {
            //         ChannelManager.selectChannel(AppState.channels[0]);
            //     }, 1000);
            // }
            
            console.log('StreamMax initialized successfully');
            
            // Add custom toast styles
            this.addToastStyles();
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            PlayerManager.showError('Initialization Failed', error.message);
        }
    }
    
    static addToastStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .toast {
                position: fixed;
                top: 24px;
                right: 24px;
                background: var(--bg-overlay);
                backdrop-filter: blur(20px);
                border: 1px solid var(--border-light);
                border-radius: var(--radius-lg);
                padding: 16px;
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: var(--z-tooltip);
                opacity: 0;
                transform: translateX(100%);
                transition: all var(--transition-base);
                max-width: 400px;
                box-shadow: var(--shadow-xl);
            }
            
            .toast.show {
                opacity: 1;
                transform: translateX(0);
            }
            
            .toast-icon {
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
            }
            
            .toast-success .toast-icon { color: var(--success); }
            .toast-error .toast-icon { color: var(--danger); }
            .toast-info .toast-icon { color: var(--primary); }
            
            .toast-message {
                flex: 1;
                font-size: 14px;
                font-weight: 500;
                color: var(--text-primary);
            }
            
            .toast-close {
                background: transparent;
                border: none;
                color: var(--text-tertiary);
                cursor: pointer;
                padding: 4px;
                border-radius: var(--radius-sm);
                transition: all var(--transition-fast);
            }
            
            .toast-close:hover {
                color: var(--text-primary);
                background: var(--bg-tertiary);
            }
            
            @media (max-width: 768px) {
                .toast {
                    top: 16px;
                    right: 16px;
                    left: 16px;
                    max-width: none;
                    transform: translateY(-100%);
                }
                
                .toast.show {
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// ============================================================================
// START APPLICATION
// ============================================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => StreamMaxApp.init());
} else {
    StreamMaxApp.init();
}
