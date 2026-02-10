/**
 * Analytics Service
 * Tracks usage statistics without storing personal data
 */

class AnalyticsService {
    constructor() {
        this.stats = {
            totalSessions: 0,
            totalFiles: 0,
            totalUploads: 0,
            totalDownloads: 0,
            totalMessages: 0,
            activeConnections: 0,
            peakConnections: 0,
            fileTypes: new Map(),
            hourlyStats: new Map(),
            startTime: Date.now(),
        };
    }

    // Track session creation
    trackSessionCreated() {
        this.stats.totalSessions++;
        this._updateHourlyStats('sessions');
    }

    // Track file upload
    trackFileUpload(mimeType, size) {
        this.stats.totalUploads++;
        this.stats.totalFiles++;

        // Track file types
        const type = mimeType.split('/')[0] || 'other';
        this.stats.fileTypes.set(type, (this.stats.fileTypes.get(type) || 0) + 1);

        this._updateHourlyStats('uploads');
    }

    // Track file download
    trackFileDownload() {
        this.stats.totalDownloads++;
        this._updateHourlyStats('downloads');
    }

    // Track message sent
    trackMessage() {
        this.stats.totalMessages++;
        this._updateHourlyStats('messages');
    }

    // Track connection
    trackConnection(count) {
        this.stats.activeConnections = count;
        if (count > this.stats.peakConnections) {
            this.stats.peakConnections = count;
        }
    }

    // Update hourly statistics
    _updateHourlyStats(metric) {
        const hour = new Date().getHours();
        const key = `${hour}:00`;

        if (!this.stats.hourlyStats.has(key)) {
            this.stats.hourlyStats.set(key, {
                sessions: 0,
                uploads: 0,
                downloads: 0,
                messages: 0,
            });
        }

        const hourStats = this.stats.hourlyStats.get(key);
        hourStats[metric] = (hourStats[metric] || 0) + 1;

        // Keep only last 24 hours
        if (this.stats.hourlyStats.size > 24) {
            const firstKey = this.stats.hourlyStats.keys().next().value;
            this.stats.hourlyStats.delete(firstKey);
        }
    }

    // Get all statistics
    getStats() {
        const uptime = Date.now() - this.stats.startTime;

        return {
            ...this.stats,
            fileTypes: Object.fromEntries(this.stats.fileTypes),
            hourlyStats: Object.fromEntries(this.stats.hourlyStats),
            uptime: {
                ms: uptime,
                hours: Math.floor(uptime / (1000 * 60 * 60)),
                days: Math.floor(uptime / (1000 * 60 * 60 * 24)),
            },
        };
    }

    // Reset statistics
    reset() {
        this.stats = {
            totalSessions: 0,
            totalFiles: 0,
            totalUploads: 0,
            totalDownloads: 0,
            totalMessages: 0,
            activeConnections: 0,
            peakConnections: 0,
            fileTypes: new Map(),
            hourlyStats: new Map(),
            startTime: Date.now(),
        };
    }
}

// Export singleton instance
const analyticsService = new AnalyticsService();
export default analyticsService;
