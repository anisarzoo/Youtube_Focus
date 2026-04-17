const CONFIG_MAP = {
    'hideComments': 'yt-focus-hide-comments',
    'hideSidebar': 'yt-focus-hide-sidebar',
    'hideShorts': 'yt-focus-hide-shorts',
    'hideAds': 'yt-focus-hide-ads',
    'hideDescription': 'yt-focus-hide-description',
    'hideEndScreen': 'yt-focus-hide-endscreen'
};

let isAdsHidden = false; // Local cache for ad-hide state

function applySettings() {
    chrome.storage.sync.get(Object.keys(CONFIG_MAP), (result) => {
        // Cache the ad setting locally to avoid excessive API calls
        isAdsHidden = !!result['hideAds'];

        Object.keys(CONFIG_MAP).forEach(key => {
            const className = CONFIG_MAP[key];
            if (result[key]) {
                document.documentElement.classList.add(className);
            } else {
                document.documentElement.classList.remove(className);
            }
        });
    });
}

// Initial application
applySettings();

/**
 * PURE NATIVE AD HANDLING (NO APIs)
 * This logic handles video ads and anti-adblock popups.
 */
function handleNativeAds() {
    // Return immediately if the user hasn't enabled ad-hiding in the extension
    if (!isAdsHidden) return;

    try {
        // 1. Skip Video Ads
        const skipButton = document.querySelector([
            '.ytp-ad-skip-button',
            '.ytp-ad-skip-button-modern',
            '.ytp-skip-ad-button', 
            '.ytp-ad-skip-button-container',
            '[class*="skip-button"]'
        ].join(','));

        if (skipButton) {
            // Simulated real-user click (more effective than .click())
            const events = ['mousedown', 'mouseup', 'click'];
            events.forEach(type => {
                skipButton.dispatchEvent(new MouseEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    view: window
                }));
            });
            console.log('YouTube Zen: Advanced skip triggered.');
        }

        const video = document.querySelector('video');
        // Target the player container specifically for better ad detection
        const player = document.querySelector('.html5-video-player');
        const isAdVisible = player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'));
        const adBadge = document.querySelector('.ytp-ad-player-overlay, [class*="ad-badge"]');
        
        if ((isAdVisible || adBadge) && video) {
            // Forcefully lock speed to 16x and mute
            video.playbackRate = 16;
            video.muted = true;
            // Seek to end if allowed by the player
            if (isFinite(video.duration) && video.duration > 0 && video.currentTime < video.duration - 0.5) {
                video.currentTime = video.duration - 0.1;
            }
        }


        // Force hide standard overlay ads that might not pause the video
        const standardOverlays = document.querySelectorAll('.ytp-ad-overlay-container, .ytp-ad-message-container');
        standardOverlays.forEach(overlay => overlay.style.display = 'none');

        // 2. Remove Anti-Adblock & Premium Popups
        const overlays = [
            'ytd-enforcement-message-view-model',
            'tp-yt-paper-dialog',
            'ytd-popup-container',
            '#upsell-dialog',
            'ytd-banner-promo-renderer',
            'ytd-primetime-promo-renderer',
            '#masthead-ad'
        ];

        overlays.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                if (element.innerText.includes('Ad blockers') || element.innerText.includes('Premium')) {
                    element.remove();
                    if (video && video.paused) video.play();
                } else if (selector === '#masthead-ad' || selector === 'ytd-banner-promo-renderer') {
                    element.remove();
                }
            }
        });
        
        // 3. Homepage 'Sponsored' Tile Remover (Brute Force)
        const renderers = document.querySelectorAll('ytd-rich-item-renderer, ytd-video-renderer, ytd-ad-slot-renderer');
        renderers.forEach(renderer => {
            // Check for 'Sponsored' text in the renderer's content
            if (renderer.innerText.includes('Sponsored')) {
                renderer.remove();
            }
        });

        const ironOverlay = document.querySelector('tp-yt-iron-overlay-backdrop');
        if (ironOverlay) ironOverlay.remove();


    } catch (e) {
        // Fail silently so we don't break the page if an element gets partially removed
    }
}

// Listen for storage changes to update UI instantly
try {
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'toggle_change') {
            const className = CONFIG_MAP[message.id];
            
            // Update our local cache if it's the ad toggle
            if (message.id === 'hideAds') {
                isAdsHidden = message.state;
            }

            if (className) {
                if (message.state) {
                    document.documentElement.classList.add(className);
                } else {
                    document.documentElement.classList.remove(className);
                }
            }
        }
    });

    // Use a MutationObserver for instant reaction to new DOM elements (ads)
    const nativeObserver = new MutationObserver(() => {
        handleNativeAds();
    });

    nativeObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // Fallback interval just in case
    setInterval(handleNativeAds, 500);

} catch (e) {
    // Context invalidated (extension reloaded/updated).
    // The new content script initialized by the reload will take over.
    console.log('YouTube Zen: Context invalidated, will restart on next reload.');
}

