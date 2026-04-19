"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Ensure directories exist - use absolute path from project root
// This ensures videos are stored in backend/videos regardless of where code runs from
const projectRoot = path_1.default.resolve(__dirname, '../..');
const demoVideoDir = path_1.default.join(projectRoot, 'videos', 'demo');
const appealVideoDir = path_1.default.join(projectRoot, 'videos', 'appeal');
[demoVideoDir, appealVideoDir].forEach(dir => {
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created video directory: ${dir}`);
    }
    else {
        console.log(`📁 Video directory exists: ${dir}`);
    }
});
// Configure multer storage - only one video per folder (replace existing)
const demoStorage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, demoVideoDir);
    },
    filename: (req, file, cb) => {
        // Always use same filename so only one video exists
        const ext = path_1.default.extname(file.originalname);
        cb(null, `demo${ext}`);
    }
});
const appealStorage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, appealVideoDir);
    },
    filename: (req, file, cb) => {
        // Always use same filename so only one video exists
        const ext = path_1.default.extname(file.originalname);
        cb(null, `appeal${ext}`);
    }
});
// File filter for videos
const videoFilter = (req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error('Only video files are allowed'));
    }
};
const uploadDemo = (0, multer_1.default)({
    storage: demoStorage,
    fileFilter: videoFilter,
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});
const uploadAppeal = (0, multer_1.default)({
    storage: appealStorage,
    fileFilter: videoFilter,
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});
// Helper function to delete existing video in folder
const deleteExistingVideo = (dir, baseName, skipFileName) => {
    try {
        const files = fs_1.default.readdirSync(dir);
        files.forEach(file => {
            if (file.startsWith(baseName)) {
                if (skipFileName && file === skipFileName) {
                    return; // don't delete the newly uploaded file
                }
                const filePath = path_1.default.join(dir, file);
                fs_1.default.unlinkSync(filePath);
            }
        });
    }
    catch (error) {
        console.error(`Error deleting existing video in ${dir}:`, error);
    }
};
// Upload demo video (admin only)
router.post('/upload/demo', auth_1.authenticateAdmin, uploadDemo.single('video'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No video file provided'
            });
        }
        console.log(`📹 Demo video uploaded: ${req.file.filename} to ${req.file.path}`);
        console.log(`📁 File saved at: ${req.file.path}`);
        console.log(`📊 File size: ${req.file.size} bytes`);
        // Delete old demo videos except the file we just saved
        deleteExistingVideo(demoVideoDir, 'demo', req.file.filename);
        res.json({
            success: true,
            message: 'Demo video uploaded successfully',
            filename: req.file.filename,
            path: `/api/videos/stream/demo`
        });
    }
    catch (error) {
        console.error('Error uploading demo video:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to upload demo video'
        });
    }
});
// Upload appeal video (admin only)
router.post('/upload/appeal', auth_1.authenticateAdmin, uploadAppeal.single('video'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No video file provided'
            });
        }
        console.log(`📹 Appeal video uploaded: ${req.file.filename} to ${req.file.path}`);
        console.log(`📁 File saved at: ${req.file.path}`);
        console.log(`📊 File size: ${req.file.size} bytes`);
        // Delete old appeal videos except the file we just saved
        deleteExistingVideo(appealVideoDir, 'appeal', req.file.filename);
        res.json({
            success: true,
            message: 'Appeal video uploaded successfully',
            filename: req.file.filename,
            path: `/api/videos/stream/appeal`
        });
    }
    catch (error) {
        console.error('Error uploading appeal video:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to upload appeal video'
        });
    }
});
// Stream video by name (public endpoint)
router.get('/stream/:videoName', (req, res) => {
    try {
        const videoName = req.params.videoName;
        // Validate video name (security)
        if (!['demo', 'appeal'].includes(videoName)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid video name. Use "demo" or "appeal"'
            });
        }
        const videoDir = videoName === 'demo' ? demoVideoDir : appealVideoDir;
        const baseFileName = videoName;
        // Find the video file (it might have different extensions)
        let videoPath = null;
        const allowedExts = ['.mp4', '.webm', '.mov', '.avi'];
        for (const ext of allowedExts) {
            const potentialPath = path_1.default.join(videoDir, `${baseFileName}${ext}`);
            if (fs_1.default.existsSync(potentialPath)) {
                videoPath = potentialPath;
                break;
            }
        }
        if (!videoPath) {
            console.log(`❌ Video not found: ${videoName} in ${videoDir}`);
            console.log(`📂 Directory contents:`, fs_1.default.existsSync(videoDir) ? fs_1.default.readdirSync(videoDir) : 'Directory does not exist');
            return res.status(404).json({
                success: false,
                error: 'Video not found',
                searchPath: videoDir,
                searchedExtensions: allowedExts
            });
        }
        console.log(`🎬 Streaming video: ${videoPath}`);
        // Security: Ensure path is within allowed directory
        const resolvedPath = path_1.default.resolve(videoPath);
        const resolvedDir = path_1.default.resolve(videoDir);
        if (!resolvedPath.startsWith(resolvedDir)) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden'
            });
        }
        // Detect content type
        const ext = path_1.default.extname(videoPath).toLowerCase();
        let contentType = 'video/webm';
        if (ext === '.mp4') {
            contentType = 'video/mp4';
        }
        else if (ext === '.webm') {
            contentType = 'video/webm';
        }
        else if (ext === '.mov') {
            contentType = 'video/quicktime';
        }
        else if (ext === '.avi') {
            contentType = 'video/x-msvideo';
        }
        // Get file stats
        const stat = fs_1.default.statSync(videoPath);
        const fileSize = stat.size;
        const range = req.headers.range;
        if (range) {
            // Parse range header for video seeking (206 Partial Content)
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs_1.default.createReadStream(videoPath, { start, end });
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000',
            };
            res.writeHead(206, head);
            file.pipe(res);
        }
        else {
            // Full video stream (200 OK)
            const head = {
                'Content-Length': fileSize,
                'Content-Type': contentType,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=31536000',
            };
            res.writeHead(200, head);
            fs_1.default.createReadStream(videoPath).pipe(res);
        }
    }
    catch (error) {
        console.error('Error streaming video:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to stream video'
        });
    }
});
// Get video info (check if video exists)
router.get('/info/:videoName', (req, res) => {
    try {
        const videoName = req.params.videoName;
        if (!['demo', 'appeal'].includes(videoName)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid video name. Use "demo" or "appeal"'
            });
        }
        const videoDir = videoName === 'demo' ? demoVideoDir : appealVideoDir;
        const baseFileName = videoName;
        const allowedExts = ['.mp4', '.webm', '.mov', '.avi'];
        let videoPath = null;
        let videoExists = false;
        for (const ext of allowedExts) {
            const potentialPath = path_1.default.join(videoDir, `${baseFileName}${ext}`);
            if (fs_1.default.existsSync(potentialPath)) {
                videoPath = potentialPath;
                videoExists = true;
                break;
            }
        }
        if (!videoExists) {
            return res.json({
                success: true,
                exists: false,
                message: 'Video not found'
            });
        }
        const stat = fs_1.default.statSync(videoPath);
        res.json({
            success: true,
            exists: true,
            filename: path_1.default.basename(videoPath),
            size: stat.size,
            created: stat.birthtime,
            streamUrl: `/api/videos/stream/${videoName}`
        });
    }
    catch (error) {
        console.error('Error getting video info:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get video info'
        });
    }
});
exports.default = router;
