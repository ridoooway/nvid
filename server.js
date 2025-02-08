const express = require('express');
const ytdl = require('@distube/ytdl-core');
const path = require('path');
const sanitizeName = require('sanitize-filename');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const cookieParser = require('cookie-parser');
const app = express();

// Add this near the top of your file
process.env.YTDL_NO_UPDATE = 'true';

// Set ffmpeg path
if (process.env.NODE_ENV === 'production') {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
} else {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Add cookie parser middleware
app.use(cookieParser());

// Routes
app.get('/', (req, res) => {
    res.render('index', {
        title: 'YouTube Shorts Downloader',
        // Initialize empty values for video data
        videoData: {
            title: '',
            thumbnail: '',
            duration: ''
        },
        showVideo: false // Flag to control whether to show video info
    });
});

// Contact page
app.get('/contact', (req, res) => {
    res.render('contact', { 
        title: 'Contact Us - ShortsDownloader.online'
    });
});

// Privacy Policy page
app.get('/privacy', (req, res) => {
    res.render('privacy', { 
        title: 'Privacy Policy - ShortsDownloader.online'
    });
});

// Terms of Service page
app.get('/terms', (req, res) => {
    res.render('terms', { 
        title: 'Terms of Service - ShortsDownloader.online'
    });
});

// DMCA page
app.get('/dmca', (req, res) => {
    res.render('dmca', { 
        title: 'DMCA Policy - ShortsDownloader.online'
    });
});

// Add this helper function at the top with other functions
function getVideoId(url) {
    try {
        // Handle different URL formats
        if (url.includes('/shorts/')) {
            // Handle shorts URLs
            const shortsPath = url.split('/shorts/')[1].split('?')[0];
            return shortsPath.split(/[?#]/)[0]; // Remove query params and hash
        } else if (url.includes('youtu.be/')) {
            // Handle youtu.be URLs
            const path = url.split('youtu.be/')[1].split('?')[0];
            return path.split(/[?#]/)[0];
        } else if (url.includes('youtube.com/')) {
            // Handle regular youtube.com URLs
            const urlObj = new URL(url);
            const videoId = urlObj.searchParams.get('v');
            if (!videoId) {
                throw new Error('Invalid YouTube URL format');
            }
            return videoId;
        }
        throw new Error('Invalid YouTube URL format');
    } catch (error) {
        console.error('Error parsing video ID:', error);
        throw new Error('Invalid YouTube URL format');
    }
}

// Add simple in-memory cache for video info
const videoInfoCache = new Map();

app.post('/download', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'Please provide a YouTube URL' });
        }

        // Get video ID and construct proper URL
        const videoId = getVideoId(url);
        if (!videoId) {
            return res.status(400).json({ error: 'Invalid YouTube URL format' });
        }

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        
        if (!ytdl.validateURL(videoUrl)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        // Get video info with higher timeout
        const info = await ytdl.getInfo(videoUrl, {
            requestOptions: {
                headers: {
                    'Cookie': 'CONSENT=YES+1'
                }
            }
        });
        
        // Process formats - filter for MP4 and specific qualities
        const qualityOrder = ['2160p', '1440p', '1080p', '720p', '480p', '360p'];
        
        // Get video formats
        const availableFormats = info.formats.filter(format => {
            // Must have video
            if (!format.hasVideo) return false;
            
            // Must be MP4 (prefer MP4 over WebM)
            if (format.container !== 'mp4') return false;
            
            // Must have quality label
            if (!format.qualityLabel) return false;
            
            // Must be one of our desired qualities
            return qualityOrder.includes(format.qualityLabel);
        });

        // Get audio-only formats
        const audioFormats = info.formats.filter(format => {
            return !format.hasVideo && format.hasAudio;
        });

        // Process video formats as before
        const formatsByQuality = {};
        availableFormats.forEach(format => {
            const quality = format.qualityLabel;
            if (!formatsByQuality[quality]) {
                formatsByQuality[quality] = [];
            }
            formatsByQuality[quality].push(format);
        });

        // Select best video formats
        const selectedFormats = [];
        qualityOrder.forEach(quality => {
            const formats = formatsByQuality[quality];
            if (formats && formats.length > 0) {
                let bestFormat = formats.find(f => f.container === 'mp4' && f.hasAudio);
                if (!bestFormat) bestFormat = formats.find(f => f.hasAudio);
                if (!bestFormat) {
                    bestFormat = formats.reduce((best, current) => 
                        (!best || current.bitrate > best.bitrate) ? current : best
                    );
                }
                if (bestFormat) {
                    selectedFormats.push(bestFormat);
                }
            }
        });

        // Select best audio format
        const bestAudioFormat = audioFormats.reduce((best, current) => {
            if (!best || current.audioBitrate > best.audioBitrate) {
                return current;
            }
            return best;
        }, null);

        // Get the highest quality thumbnail
        const thumbnail = info.videoDetails.thumbnails.reduce((best, current) => {
            return (!best || current.width > best.width) ? current : best;
        }, null);

        // Format video details with thumbnail
        const videoDetails = {
            title: info.videoDetails.title,
            thumbnail_url: thumbnail ? thumbnail.url : null,
            duration: toHumanTime(info.videoDetails.lengthSeconds),
            formats: selectedFormats.map(format => ({
                itag: format.itag,
                quality: format.qualityLabel,
                container: format.container,
                hasVideo: true,
                hasAudio: format.hasAudio,
                type: 'video'
            }))
        };

        // Add audio format if available
        if (bestAudioFormat) {
            videoDetails.formats.push({
                itag: bestAudioFormat.itag,
                quality: `${bestAudioFormat.audioBitrate}kbps`,
                container: 'mp3',
                hasVideo: false,
                hasAudio: true,
                type: 'audio'
            });
        }

        // In your download route
        const cachedInfo = videoInfoCache.get(videoId);
        if (cachedInfo) {
            return res.json(cachedInfo);
        }

        // After getting video info
        videoInfoCache.set(videoId, videoDetails);

        res.json(videoDetails);

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ 
            error: 'Failed to process video',
            details: error.message
        });
    }
});

app.get('/download/:itag', async (req, res) => {
    try {
        const { url } = req.query;
        const { itag } = req.params;

        if (!url || !itag) {
            return res.status(400).json({ error: 'Missing URL or itag' });
        }

        // Decode URL if it's encoded
        const decodedUrl = decodeURIComponent(url);

        const videoId = getVideoId(decodedUrl);
        if (!videoId) {
            return res.status(400).json({ error: 'Invalid YouTube URL format' });
        }

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        const info = await ytdl.getInfo(videoUrl, {
            requestOptions: {
                headers: {
                    'Cookie': 'CONSENT=YES+1'
                }
            }
        });

        const format = info.formats.find(f => f.itag === parseInt(itag));
        
        if (!format) {
            return res.status(404).json({ error: 'Format not found' });
        }

        // Handle audio-only downloads
        const isAudioOnly = !format.hasVideo && format.hasAudio;

        // For video formats, prefer MP4
        if (!isAudioOnly && format.container === 'webm') {
            const mp4Format = info.formats.find(f => 
                f.hasVideo &&
                f.container === 'mp4' &&
                f.qualityLabel === format.qualityLabel
            );
            if (mp4Format) {
                format = mp4Format;
            }
        }

        // Sanitize filename
        let filename = info.videoDetails.title;
        filename = filename.replace(/[^\x00-\x7F]/g, '');
        filename = filename.replace(/[^a-zA-Z0-9-_. ]/g, '');
        filename = filename.trim().replace(/\.+$/, '');
        
        if (isAudioOnly) {
            filename = `${filename}.mp3`;
            res.setHeader('Content-Type', 'audio/mpeg');
        } else {
            filename = `${filename}.mp4`;
            res.setHeader('Content-Type', 'video/mp4');
        }

        if (filename.length > 200) {
            filename = filename.substring(0, 196) + path.extname(filename);
        }

        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

        const stream = ytdl(videoUrl, {
            format,
            filter: isAudioOnly ? 'audioonly' : 'videoandaudio',
            quality: isAudioOnly ? 'highestaudio' : 'highest',
            requestOptions: {
                headers: {
                    'Cookie': 'CONSENT=YES+1'
                }
            }
        });

        if (isAudioOnly) {
            // Convert to MP3 using FFmpeg
            ffmpeg(stream)
                .toFormat('mp3')
                .audioBitrate(format.audioBitrate || 128)
                .on('error', (err) => {
                    console.error('FFmpeg error:', err);
                    res.status(500).json({ error: 'Audio conversion failed' });
                })
                .pipe(res);
        } else {
            // For video, pipe directly
            stream.pipe(res);
        }

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ 
            error: 'Download failed',
            details: error.message
        });
    }
});

// Helper functions
function toHumanTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s]
        .map(v => v < 10 ? '0' + v : v)
        .filter((v, i) => v !== '00' || i > 0)
        .join(':');
}

function toHumanSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = parseInt(bytes);
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Access from other devices: http://<your-ip-address>:${PORT}`);
});

// Error handling middleware
app.use((req, res, next) => {
    res.status(404).render('404', { 
        title: '404 Not Found - ShortsDownloader.online'
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('500', { 
        title: '500 Server Error - ShortsDownloader.online'
    });
});

// Update your video info route (where you handle the video URL)
app.post('/get-video-info', async (req, res) => {
    try {
        // Your existing video info logic
        const videoInfo = await getVideoInfo(req.body.url);
        res.render('index', {
            title: 'YouTube Shorts Downloader',
            videoData: {
                title: videoInfo.title,
                thumbnail: videoInfo.thumbnail,
                duration: videoInfo.duration
            },
            showVideo: true
        });
    } catch (error) {
        res.render('index', {
            title: 'YouTube Shorts Downloader',
            videoData: {
                title: '',
                thumbnail: '',
                duration: ''
            },
            showVideo: false,
            error: error.message
        });
    }
}); 