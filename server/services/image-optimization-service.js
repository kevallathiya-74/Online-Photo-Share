/**
 * Image Optimization Service
 * Optimizes images before storage to reduce memory usage
 */

import sharp from 'sharp';

class ImageOptimizationService {
    constructor() {
        this.MAX_WIDTH = 2048;
        this.MAX_HEIGHT = 2048;
        this.JPEG_QUALITY = 85;
        this.PNG_QUALITY = 90;
    }

    /**
     * Check if file is an image
     */
    isImage(mimeType) {
        return mimeType && mimeType.startsWith('image/');
    }

    /**
     * Check if image should be optimized
     */
    shouldOptimize(mimeType, size) {
        // Only optimize images larger than 500KB
        return this.isImage(mimeType) && size > 500 * 1024;
    }

    /**
     * Optimize image buffer
     */
    async optimizeImage(buffer, mimeType) {
        try {
            let image = sharp(buffer);

            // Get metadata
            const metadata = await image.metadata();

            // Resize if too large
            if (metadata.width > this.MAX_WIDTH || metadata.height > this.MAX_HEIGHT) {
                image = image.resize(this.MAX_WIDTH, this.MAX_HEIGHT, {
                    fit: 'inside',
                    withoutEnlargement: true,
                });
            }

            // Optimize based on format
            if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
                image = image.jpeg({ quality: this.JPEG_QUALITY, progressive: true });
            } else if (mimeType === 'image/png') {
                image = image.png({ quality: this.PNG_QUALITY, compressionLevel: 9 });
            } else if (mimeType === 'image/webp') {
                image = image.webp({ quality: this.JPEG_QUALITY });
            } else {
                // Convert other formats to JPEG
                image = image.jpeg({ quality: this.JPEG_QUALITY });
            }

            const optimizedBuffer = await image.toBuffer();

            return {
                buffer: optimizedBuffer,
                originalSize: buffer.length,
                optimizedSize: optimizedBuffer.length,
                savings: buffer.length - optimizedBuffer.length,
                savingsPercent: ((buffer.length - optimizedBuffer.length) / buffer.length * 100).toFixed(2),
            };
        } catch (error) {
            console.error('[ImageOptimization] Error:', error.message);
            // Return original buffer if optimization fails
            return {
                buffer,
                originalSize: buffer.length,
                optimizedSize: buffer.length,
                savings: 0,
                savingsPercent: 0,
                error: error.message,
            };
        }
    }

    /**
     * Generate thumbnail
     */
    async generateThumbnail(buffer, width = 300, height = 300) {
        try {
            const thumbnail = await sharp(buffer)
                .resize(width, height, {
                    fit: 'cover',
                    position: 'center',
                })
                .jpeg({ quality: 80 })
                .toBuffer();

            return thumbnail;
        } catch (error) {
            console.error('[ImageOptimization] Thumbnail error:', error.message);
            return null;
        }
    }
}

// Export singleton instance
const imageOptimizationService = new ImageOptimizationService();
export default imageOptimizationService;
