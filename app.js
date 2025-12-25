// API Configuration
const API_URL = 'https://static-crane-seeutech-17dd4df3.koyeb.app/api/channels';
const SMARTLINK_URL = 'https://staggermeaningless.com/djr63xfh5?key=0594e81080ace7ae2229d79efcbc8072';
const AD_FREQUENCY = 6;

// Ad Configuration
const AD_CONFIG = {
    key: 'e370435c2937a2c6a0c3fa900e0430ac',
    format: 'iframe',
    height: 250,
    width: 300,
    scriptUrl: 'https://staggermeaningless.com/e370435c2937a2c6a0c3fa900e0430ac/invoke.js'
};

// Global State
let allChannels = [];
let filtered = [];
let pendingChannelData = null;
let adOpened = false;
let shakaPlayer = null;
let shakaUI = null;

// DOM Elements
const grid = document.getElementById('grid');
const loader = document.getElementById('loader');
const searchInput = document.getElementById('searchInput');
const errorMsg = document.getElementById('error-msg');
const videoModal = document.getElementById('videoModal');
const videoChannelName = document.getElementById('videoChannelName');
const videoOverlay = document.getElementById('videoOverlay');
const closeVideoBtn = document.getElementById('closeVideoBtn');
const videoPlayer = document.getElementById('videoPlayer');

// Initialize Shaka Player
async function initShakaPlayer() {
    shaka.polyfill.installAll();

    if (!shaka.Player.isBrowserSupported()) {
        console.error('Browser not supported');
        return null;
    }

    const player = new shaka.Player();
    await player.attach(videoPlayer);

    const container = document.querySelector('.shaka-video-container');
    const ui = new shaka.ui.Overlay(player, container, videoPlayer);

    ui.configure({
        controlPanelElements: [
            'play_pause', 'time_and_duration', 'mute', 'volume',
            'spacer', 'language', 'captions', 'picture_in_picture',
            'quality', 'fullscreen'
        ],
        volumeBarColors: {
            base: 'purple',
            level: 'purple'
        },
        seekBarColors: {
            base: 'gold',
            buffered: 'gold',
            played: 'gold'
        }
    });

    player.configure({
        streaming: {
            lowLatencyMode: true,
            bufferingGoal: 15,
            rebufferingGoal: 2,
            bufferBehind: 15,
            retryParameters: {
                timeout: 10000,
                maxAttempts: 5,
                baseDelay: 300,
                backoffFactor: 1.2
            },
            segmentRequestTimeout: 8000,
            segmentPrefetchLimit: 2,
            useNativeHlsOnSafari: true
        },
        manifest: {
            retryParameters: {
                timeout: 8000,
                maxAttempts: 3
            }
        }
    });

    player.addEventListener('error', (event) => {
        console.error('Shaka Player Error:', event.detail);
    });

    return { player, ui };
}

// Play Channel in Video Player
async function playChannelInPlayer(channelData) {
    videoChannelName.textContent = channelData.title;
    videoModal.classList.add('active');
    videoOverlay.classList.remove('hide');

    // Auto-hide overlay after 3 seconds
    let hideTimeout = setTimeout(() => {
        videoOverlay.classList.add('hide');
    }, 3000);

    // Show overlay on mouse move or touch
    const showOverlay = () => {
        videoOverlay.classList.remove('hide');
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
            videoOverlay.classList.add('hide');
        }, 3000);
    };

    videoModal.addEventListener('mousemove', showOverlay);
    videoModal.addEventListener('touchstart', showOverlay);
    videoModal.addEventListener('click', showOverlay);

    // Request fullscreen
    if (videoModal.requestFullscreen) {
        try {
            await videoModal.requestFullscreen();
        } catch (err) {
            console.log('Fullscreen request failed:', err);
        }
    } else if (videoModal.webkitRequestFullscreen) {
        videoModal.webkitRequestFullscreen();
    } else if (videoModal.mozRequestFullScreen) {
        videoModal.mozRequestFullScreen();
    } else if (videoModal.msRequestFullscreen) {
        videoModal.msRequestFullscreen();
    }

    if (!shakaPlayer) {
        const result = await initShakaPlayer();
        if (result) {
            shakaPlayer = result.player;
            shakaUI = result.ui;
        }
    }

    if (!shakaPlayer) {
        console.error('Failed to initialize player');
        return;
    }

    try {
        // Reset player configuration
        shakaPlayer.resetConfiguration();

        // Parse DRM key from channel data
        let drmConfig = null;
        if (channelData.key && channelData.licenseType === 'clearkey') {
            const [keyId, keyValue] = channelData.key.split(':');
            if (keyId && keyValue) {
                drmConfig = {
                    clearKeys: {
                        [keyId]: keyValue
                    }
                };
            }
        }

        // Get cookie from channel data
        let cookieHeader = channelData.cookie || '';

        // Configure player
        const config = {
            streaming: {
                lowLatencyMode: true,
                bufferingGoal: 15,
                rebufferingGoal: 2,
                bufferBehind: 15,
                retryParameters: {
                    timeout: 10000,
                    maxAttempts: 5,
                    baseDelay: 300,
                    backoffFactor: 1.2
                },
                segmentRequestTimeout: 8000,
                segmentPrefetchLimit: 2,
                useNativeHlsOnSafari: true
            },
            manifest: {
                retryParameters: {
                    timeout: 8000,
                    maxAttempts: 3
                }
            }
        };

        // Add DRM config if available
        if (drmConfig) {
            config.drm = drmConfig;
        }

        shakaPlayer.configure(config);

        // Register request filter for headers and cookies
        shakaPlayer.getNetworkingEngine().registerRequestFilter((type, request) => {
            // Add standard headers for JioTV streams
            if (channelData.url.includes('jio.com')) {
                request.headers['Referer'] = 'https://www.jiotv.com/';
                request.headers['User-Agent'] = "plaYtv/7.1.5 (Linux;Android 13) ExoPlayerLib/2.11.6";
            }

            // Add cookie if available
            if (cookieHeader) {
                request.headers['Cookie'] = cookieHeader;

                // Append cookie to URL if not already present (for JioTV)
                if (
                    (type === shaka.net.NetworkingEngine.RequestType.MANIFEST ||
                        type === shaka.net.NetworkingEngine.RequestType.SEGMENT) &&
                    request.uris[0] && 
                    !request.uris[0].includes('__hdnea=') &&
                    channelData.url.includes('jio.com')
                ) {
                    const separator = request.uris[0].includes('?') ? '&' : '?';
                    request.uris[0] += separator + cookieHeader;
                }
            }
        });

        // Load the stream URL from channel data
        const streamUrl = channelData.url;
        console.log('Loading stream:', streamUrl);
        console.log('With DRM:', drmConfig ? 'Yes' : 'No');
        console.log('With Cookie:', cookieHeader ? 'Yes' : 'No');
        
        await shakaPlayer.load(streamUrl);

        // Set volume before playing
        videoPlayer.volume = 0.8;

        // Attempt autoplay
        videoPlayer.muted = false;
        try {
            await videoPlayer.play();
            console.log('Unmuted autoplay successful');
        } catch (error) {
            console.log('Unmuted autoplay failed, trying muted');
            videoPlayer.muted = true;
            try {
                await videoPlayer.play();
                console.log('Muted autoplay successful');
            } catch (mutedError) {
                console.error('Both autoplay attempts failed:', mutedError);
            }
        }

        // Enable sound on interaction
        let hasUserInteracted = false;
        const enableSoundOnInteraction = () => {
            if (!hasUserInteracted && videoPlayer.muted) {
                videoPlayer.muted = false;
                videoPlayer.volume = 0.8;
                hasUserInteracted = true;
                console.log('Sound enabled after user interaction');
            }
        };
        ['click', 'touchstart', 'keydown'].forEach(event => {
            document.addEventListener(event, enableSoundOnInteraction, { once: true });
        });

    } catch (error) {
        console.error('Load error:', error);
        alert('Failed to load channel: ' + error.message);
    }
}

// Close Video Player
function closeVideoPlayer() {
    // Exit fullscreen first
    if (document.fullscreenElement) {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
    
    videoModal.classList.remove('active');
    if (shakaPlayer) {
        shakaPlayer.unload();
    }
    videoPlayer.pause();
}

// Initialize App
async function init() {
    try {
        const res = await fetch(API_URL);
        const json = await res.json();
        
        if (json.success && Array.isArray(json.data)) {
            allChannels = json.data;
            renderGrid(allChannels);
        } else {
            throw new Error("Invalid data format");
        }
    } catch (err) {
        errorMsg.style.display = 'block';
        errorMsg.textContent = "Unable to load channels. Please try again later.";
        console.error(err);
    } finally {
        loader.style.display = 'none';
    }
}

// Apply Filters
function applyFilters() {
    const query = searchInput.value.toLowerCase().trim();
    
    filtered = allChannels.filter(c => {
        const matchesSearch = !query || c.title.toLowerCase().includes(query);
        return matchesSearch;
    });

    renderGrid(filtered);
}

// Create Ad Card
function createAdCard() {
    const adCard = document.createElement('div');
    adCard.className = 'ad-card';
    
    const adId = 'ad-' + Math.random().toString(36).substr(2, 9);
    
    adCard.innerHTML = `
        <div class="ad-label">ADVERTISEMENT</div>
        <div class="ad-container" id="${adId}"></div>
    `;
    
    setTimeout(() => {
        const container = document.getElementById(adId);
        if (!container) return;
        
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'width:100%;height:120px;border:none;display:block;background:#0a0a0c;';
        iframe.setAttribute('scrolling', 'no');
        iframe.setAttribute('frameborder', '0');
        
        container.appendChild(iframe);
        
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        margin: 0;
                        padding: 10px;
                        background: #0a0a0c;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100px;
                        overflow: hidden;
                    }
                </style>
            </head>
            <body>
                <script type="text/javascript">
                    atOptions = {
                        'key': '${AD_CONFIG.key}',
                        'format': '${AD_CONFIG.format}',
                        'height': ${AD_CONFIG.height},
                        'width': ${AD_CONFIG.width},
                        'params': {}
                    };
                <\/script>
                <script type="text/javascript" src="${AD_CONFIG.scriptUrl}"><\/script>
            </body>
            </html>
        `);
        doc.close();
        
    }, 50);
    
    return adCard;
}

// Handle Channel Click
function handleChannelClick(item) {
    // Check if running in Android WebView
    if (window.Android && window.Android.playChannel) {
        // Store channel data for later playback
        pendingChannelData = item;
        adOpened = true;
        
        // Open smart link ad in new window/tab (external browser)
        const adWindow = window.open(SMARTLINK_URL, '_blank');
        
        // If popup was blocked or failed, try direct navigation
        if (!adWindow || adWindow.closed || typeof adWindow.closed === 'undefined') {
            console.log('Popup blocked, trying direct navigation');
            window.location.href = SMARTLINK_URL;
        }
        
        // Play channel after short delay (fallback if user closes ad quickly)
        setTimeout(() => {
            if (pendingChannelData && window.Android && window.Android.playChannel) {
                window.Android.playChannel(JSON.stringify(pendingChannelData));
                pendingChannelData = null;
                adOpened = false;
            }
        }, 3000);
    } else {
        // Web browser: Show ad first, then play
        // Open smartlink in new tab
        const adWindow = window.open(SMARTLINK_URL, '_blank');
        
        // Wait a moment then play video
        setTimeout(() => {
            playChannelInPlayer(item);
        }, 1000);
    }
}

// Render Grid
function renderGrid(data) {
    grid.innerHTML = '';
    
    if (data.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-dim);">No channels match your search</div>`;
        return;
    }

    data.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'channel-card';
        card.innerHTML = `
            <div class="logo-box">
                <img src="${item.logo}" alt="" onerror="this.src='https://via.placeholder.com/150/1c1c1f/ffffff?text=TV'">
            </div>
            <div class="channel-meta">
                <div class="channel-name">${item.title}</div>
                <div class="channel-tag">${item.groupTitle || 'LIVE'}</div>
            </div>
        `;
        
        card.onclick = () => handleChannelClick(item);
        grid.appendChild(card);

        if ((index + 1) % AD_FREQUENCY === 0 && index < data.length - 1) {
            const adCard = createAdCard();
            grid.appendChild(adCard);
        }
    });
    
    if (data.length > AD_FREQUENCY) {
        const adCard = createAdCard();
        grid.appendChild(adCard);
    }
}

// Handle visibility change (for Android app)
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && pendingChannelData && adOpened) {
        setTimeout(() => {
            if (window.Android && window.Android.playChannel) {
                window.Android.playChannel(JSON.stringify(pendingChannelData));
            }
            pendingChannelData = null;
            adOpened = false;
        }, 500);
    }
});

// Handle window focus (for Android app)
window.addEventListener('focus', function() {
    if (pendingChannelData && adOpened) {
        setTimeout(() => {
            if (window.Android && window.Android.playChannel) {
                window.Android.playChannel(JSON.stringify(pendingChannelData));
            }
            pendingChannelData = null;
            adOpened = false;
        }, 500);
    }
});

// Event Listeners
searchInput.addEventListener('input', applyFilters);
closeVideoBtn.addEventListener('click', closeVideoPlayer);

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && videoModal.classList.contains('active')) {
        closeVideoPlayer();
    }
});

// Start the app
init();
