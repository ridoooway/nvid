// Core tracking functions
const trackEvent = (eventName, category, label, value = null) => {
    gtag('event', eventName, {
        'event_category': category,
        'event_label': label,
        'value': value
    });
};

// Track page load time
window.addEventListener('load', () => {
    const pageLoadTime = window.performance.timing.loadEventEnd - window.performance.timing.navigationStart;
    trackEvent('page_load_time', 'performance', 'load_time', pageLoadTime);
});

// Track downloads with status
document.getElementById('downloadBtn')?.addEventListener('click', function() {
    const urlInput = document.getElementById('videoUrl');
    const url = urlInput?.value || 'empty';
    
    trackEvent('download_initiated', 'engagement', 'download_start');
    
    // Track successful downloads
    document.addEventListener('downloadSuccess', (e) => {
        trackEvent('download_complete', 'engagement', 'download_success', {
            url: url,
            format: e.detail.format,
            quality: e.detail.quality
        });
    });

    // Track failed downloads
    document.addEventListener('downloadError', (e) => {
        trackEvent('download_failed', 'error', e.detail.error);
    });
});

// Track format selection with quality
document.getElementById('formatSelect')?.addEventListener('change', function() {
    trackEvent('format_changed', 'interaction', this.value);
});

// Track user engagement time
let startTime = Date.now();
window.addEventListener('beforeunload', () => {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    trackEvent('time_on_page', 'engagement', 'seconds', timeSpent);
});

// Track scroll depth
let maxScroll = 0;
window.addEventListener('scroll', () => {
    const scrollPercent = Math.round((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100);
    if (scrollPercent > maxScroll) {
        maxScroll = scrollPercent;
        if (maxScroll % 25 === 0) { // Track at 25%, 50%, 75%, 100%
            trackEvent('scroll_depth', 'engagement', 'scroll_percentage', maxScroll);
        }
    }
});

// Track error occurrences
window.addEventListener('error', (e) => {
    trackEvent('javascript_error', 'error', e.message);
});

// Track user interactions with FAQ
document.querySelectorAll('.faq-item')?.forEach(item => {
    item.addEventListener('click', (e) => {
        const question = e.target.closest('.faq-item').querySelector('summary').textContent;
        trackEvent('faq_click', 'engagement', question);
    });
});

// Track copy events
document.addEventListener('copy', () => {
    trackEvent('content_copy', 'engagement', 'text_copied');
});

// Track external link clicks
document.querySelectorAll('a[href^="http"]')?.forEach(link => {
    link.addEventListener('click', (e) => {
        trackEvent('external_link', 'navigation', e.target.href);
    });
});

// Track device info
trackEvent('device_info', 'system', {
    screenSize: `${window.screen.width}x${window.screen.height}`,
    language: navigator.language,
    platform: navigator.platform
});

// Track feature usage
const trackFeatureUsage = (featureName) => {
    trackEvent('feature_used', 'feature', featureName);
};

// Track search attempts
document.getElementById('videoUrl')?.addEventListener('input', debounce(() => {
    trackEvent('url_input', 'interaction', 'url_entered');
}, 1000));

// Utility function for debouncing
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