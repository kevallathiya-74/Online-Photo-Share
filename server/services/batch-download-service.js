/**
 * Batch Download Service
 * Creates ZIP archives of multiple files
 */

import archiver from 'archiver';

class BatchDownloadService {
    /**
     * Create ZIP archive from files
     * @param {Array} files - Array of file objects with buffer and filename
     * @returns {Promise<Buffer>} - ZIP file buffer
     */
    async createZip(files) {
        return new Promise((resolve, reject) => {
            const archive = archiver('zip', {
                zlib: { level: 6 } // Compression level (0-9)
            });

            const chunks = [];

            archive.on('data', (chunk) => {
                chunks.push(chunk);
            });

            archive.on('end', () => {
                const buffer = Buffer.concat(chunks);
                resolve(buffer);
            });

            archive.on('error', (err) => {
                reject(err);
            });

            // Add files to archive
            for (const file of files) {
                if (file.buffer && file.filename) {
                    archive.append(file.buffer, { name: file.filename });
                }
            }

            // Finalize the archive
            archive.finalize();
        });
    }

    /**
     * Get estimated ZIP size
     * @param {Array} files - Array of file objects
     * @returns {number} - Estimated size in bytes
     */
    getEstimatedSize(files) {
        // ZIP typically compresses to 60-80% of original size
        const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
        return Math.floor(totalSize * 0.7); // Estimate 70% of original
    }
}

// Export singleton instance
const batchDownloadService = new BatchDownloadService();
export default batchDownloadService;
