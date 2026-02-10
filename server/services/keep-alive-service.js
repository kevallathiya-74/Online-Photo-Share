/**
 * Keep-Alive Service
 * Pings the server periodically to prevent Render free tier spin-down
 * Only runs in production on Render
 */

class KeepAliveService {
    constructor() {
        this.intervalId = null;
        this.isRunning = false;
        // Ping every 10 minutes (Render spins down after 15 minutes of inactivity)
        this.PING_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds
    }

    /**
     * Start the keep-alive service
     * @param {string} serverUrl - The URL of the server to ping
     */
    start(serverUrl) {
        // Only run in production and if RENDER environment variable is set
        if (process.env.NODE_ENV !== 'production' || !process.env.RENDER) {
            console.log('[KeepAlive] Not running (development mode or not on Render)');
            return;
        }

        if (this.isRunning) {
            console.log('[KeepAlive] Service already running');
            return;
        }

        console.log(`[KeepAlive] Starting service - will ping ${serverUrl} every 10 minutes`);

        this.isRunning = true;

        // Ping immediately on start
        this.ping(serverUrl);

        // Set up recurring pings
        this.intervalId = setInterval(() => {
            this.ping(serverUrl);
        }, this.PING_INTERVAL);
    }

    /**
     * Ping the server
     * @param {string} serverUrl - The URL to ping
     */
    async ping(serverUrl) {
        try {
            const url = `${serverUrl}/health`;
            const startTime = Date.now();

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'KeepAlive-Service'
                }
            });

            const duration = Date.now() - startTime;

            if (response.ok) {
                console.log(`[KeepAlive] Ping successful (${duration}ms)`);
            } else {
                console.warn(`[KeepAlive] Ping returned status ${response.status}`);
            }
        } catch (error) {
            console.error('[KeepAlive] Ping failed:', error.message);
        }
    }

    /**
     * Stop the keep-alive service
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            this.isRunning = false;
            console.log('[KeepAlive] Service stopped');
        }
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            pingIntervalMinutes: this.PING_INTERVAL / 60000
        };
    }
}

// Export singleton instance
const keepAliveService = new KeepAliveService();
export default keepAliveService;
