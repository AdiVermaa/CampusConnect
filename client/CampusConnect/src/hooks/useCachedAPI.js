import { useState, useEffect, useCallback } from 'react';
import cacheManager from '../utils/cacheManager';

export const useCachedAPI = (apiCall, cacheKey, options = {}) => {
    const {
        dependencies = [],
        cacheDuration = 5 * 60 * 1000,
        skipCache = false,
        onSuccess,
        onError
    } = options;

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async (forceRefresh = false) => {
        if (!skipCache && !forceRefresh) {
            const cached = cacheManager.get(cacheKey);
            if (cached) {
                setData(cached);
                setLoading(false);
                return cached;
            }
        }

        setLoading(true);
        setError(null);

        try {
            const result = await apiCall();
            const responseData = result.data || result;

            setData(responseData);

            if (!skipCache) {
                cacheManager.set(cacheKey, responseData, cacheDuration);
            }

            if (onSuccess) {
                onSuccess(responseData);
            }

            setLoading(false);
            return responseData;
        } catch (err) {
            console.error('API Error:', err);
            setError(err);
            setLoading(false);

            if (onError) {
                onError(err);
            }

            throw err;
        }
    }, [apiCall, cacheKey, cacheDuration, skipCache, onSuccess, onError]);

    useEffect(() => {
        fetchData();
    }, dependencies);

    const invalidate = useCallback(() => {
        cacheManager.invalidate(cacheKey);
    }, [cacheKey]);

    const refresh = useCallback(() => {
        return fetchData(true);
    }, [fetchData]);

    return {
        data,
        loading,
        error,
        refresh,
        invalidate,
        setData
    };
};

export const useOptimisticUpdate = (cacheKey) => {
    const updateCache = useCallback((updater) => {
        const cached = cacheManager.get(cacheKey);
        if (cached) {
            const updated = typeof updater === 'function' ? updater(cached) : updater;
            cacheManager.set(cacheKey, updated);
            return updated;
        }
        return null;
    }, [cacheKey]);

    return { updateCache };
};
