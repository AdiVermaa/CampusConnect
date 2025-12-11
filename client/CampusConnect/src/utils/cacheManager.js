const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const CACHE_PREFIX = 'cc_cache_';

class CacheManager {
    constructor() {
        this.memoryCache = new Map();
    }

    set(key, data, duration = CACHE_DURATION) {
        const cacheData = {
            data,
            timestamp: Date.now(),
            duration
        };

        this.memoryCache.set(key, cacheData);

        try {
            localStorage.setItem(
                `${CACHE_PREFIX}${key}`,
                JSON.stringify(cacheData)
            );
        } catch (error) {
            console.warn('LocalStorage is full, using memory cache only:', error);
        }
    }

    get(key) {
        if (this.memoryCache.has(key)) {
            const cached = this.memoryCache.get(key);
            if (this.isValid(cached)) {
                return cached.data;
            }
            this.memoryCache.delete(key);
        }

        try {
            const stored = localStorage.getItem(`${CACHE_PREFIX}${key}`);
            if (stored) {
                const cached = JSON.parse(stored);
                if (this.isValid(cached)) {
                    this.memoryCache.set(key, cached);
                    return cached.data;
                }
                localStorage.removeItem(`${CACHE_PREFIX}${key}`);
            }
        } catch (error) {
            console.warn('Error reading from localStorage:', error);
        }

        return null;
    }

    isValid(cached) {
        if (!cached || !cached.timestamp) return false;
        const age = Date.now() - cached.timestamp;
        return age < cached.duration;
    }

    invalidate(key) {
        this.memoryCache.delete(key);
        try {
            localStorage.removeItem(`${CACHE_PREFIX}${key}`);
        } catch (error) {
            console.warn('Error removing from localStorage:', error);
        }
    }

    invalidatePattern(pattern) {
        const regex = new RegExp(pattern);

        for (const key of this.memoryCache.keys()) {
            if (regex.test(key)) {
                this.memoryCache.delete(key);
            }
        }

        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(CACHE_PREFIX) && regex.test(key.substring(CACHE_PREFIX.length))) {
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {
            console.warn('Error invalidating pattern from localStorage:', error);
        }
    }

    clear() {
        this.memoryCache.clear();

        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(CACHE_PREFIX)) {
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {
            console.warn('Error clearing localStorage:', error);
        }
    }

    clearExpired() {
        for (const [key, cached] of this.memoryCache.entries()) {
            if (!this.isValid(cached)) {
                this.memoryCache.delete(key);
            }
        }

        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(CACHE_PREFIX)) {
                    try {
                        const cached = JSON.parse(localStorage.getItem(key));
                        if (!this.isValid(cached)) {
                            localStorage.removeItem(key);
                        }
                    } catch (e) {
                        localStorage.removeItem(key);
                    }
                }
            });
        } catch (error) {
            console.warn('Error clearing expired from localStorage:', error);
        }
    }
}

const cacheManager = new CacheManager();

setInterval(() => {
    cacheManager.clearExpired();
}, 60000);

export default cacheManager;

export const CACHE_KEYS = {
    USER_PROFILE: 'user_profile',
    POSTS_FEED: 'posts_feed',
    USER_CONNECTIONS: 'user_connections',
    EVENTS_LIST: 'events_list',
    CONVERSATIONS: 'conversations',
    SEARCH_RESULTS: (query) => `search_${query}`,
    USER_DATA: (userId) => `user_${userId}`,
    POST_COMMENTS: (postId) => `post_comments_${postId}`,
};
