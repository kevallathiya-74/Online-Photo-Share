# ImageShare - Real-time Image Sharing Application

A production-grade, real-time image sharing web application with **memory-only storage**. No databases, no file system, no cloud storage - images exist only in server RAM and are automatically cleaned up.

## 🎯 Features

- **Real-time Sharing**: Images appear instantly on all connected devices
- **Memory-Only Storage**: Zero persistence - all data lives in server RAM
- **PWA Support**: Install as an app on mobile/desktop
- **Share Target API**: Share images directly from your phone's gallery
- **QR Code Sharing**: Easily share sessions via QR code
- **Auto-Cleanup**: Sessions expire after 1 hour with immediate memory cleanup
- **Binary Transfer**: Direct binary transfer (no Base64 overhead)
- **Responsive Design**: Works on mobile, tablet, and desktop

## 🏗️ Architecture

### Project Structure

```
image-share/
├── server/                     # Backend (Node.js + Express + Socket.IO)
│   ├── index.js               # Server entry point
│   ├── config/
│   │   └── constants.js       # Configuration constants
│   ├── storage/
│   │   └── memory-store.js    # In-memory storage manager
│   ├── services/
│   │   ├── session-service.js # Session lifecycle management
│   │   ├── image-service.js   # Image processing & storage
│   │   └── cleanup-service.js # TTL & memory cleanup
│   ├── socket/
│   │   └── socket-handler.js  # WebSocket event handlers
│   └── utils/
│       └── security.js        # Cryptographic utilities
│
├── client/                     # Frontend (React + Vite)
│   ├── index.html
│   ├── public/
│   │   ├── manifest.json      # PWA manifest with share_target
│   │   ├── sw.js              # Service worker
│   │   └── icons/             # PWA icons
│   └── src/
│       ├── main.jsx           # App entry point
│       ├── App.jsx            # Main application
│       ├── components/
│       │   ├── ui/            # shadcn/ui components
│       │   ├── session/       # Session components
│       │   └── image/         # Image components
│       ├── context/           # React contexts
│       ├── utils/             # Utility functions
│       └── styles/            # Global styles
│
├── scripts/                    # Build scripts
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

### Session Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                     SESSION LIFECYCLE                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. CREATE SESSION                                           │
│     └── Generate cryptographically secure 64-char hex ID     │
│     └── Set TTL: 1 hour from creation                        │
│     └── Store in Map<sessionId, Session>                     │
│                                                              │
│  2. JOIN SESSION                                             │
│     └── Validate session exists and not expired              │
│     └── Add socket to session room                           │
│     └── Broadcast member count update                        │
│                                                              │
│  3. UPLOAD IMAGE                                             │
│     └── Validate session, size (≤5MB), MIME type             │
│     └── Store as Buffer in session.images Map                │
│     └── Broadcast image metadata to all members              │
│                                                              │
│  4. REQUEST IMAGE                                            │
│     └── Validate session membership                          │
│     └── Send binary data directly via WebSocket              │
│                                                              │
│  5. CLEANUP                                                  │
│     └── Periodic check every 5 minutes                       │
│     └── Delete expired sessions immediately                  │
│     └── Free Buffer memory                                   │
│     └── Memory pressure handling                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Memory Management

```
┌─────────────────────────────────────────────────────────────┐
│                   MEMORY STRUCTURE                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  MemoryStore                                                 │
│  ├── sessions: Map<sessionId, Session>                       │
│  │   └── Session                                             │
│  │       ├── id: string                                      │
│  │       ├── createdAt: timestamp                            │
│  │       ├── expiresAt: timestamp                            │
│  │       ├── images: Map<imageId, ImageData>                 │
│  │       │   └── ImageData                                   │
│  │       │       ├── id: string                              │
│  │       │       ├── buffer: Buffer (RAW BINARY)             │
│  │       │       ├── mimeType: string                        │
│  │       │       ├── filename: string                        │
│  │       │       ├── size: number                            │
│  │       │       └── uploadedAt: timestamp                   │
│  │       └── members: Set<socketId>                          │
│  │                                                           │
│  ├── socketToSession: Map<socketId, sessionId>               │
│  └── totalMemoryUsage: number (bytes)                        │
│                                                              │
│  Limits:                                                     │
│  ├── Max total memory: 500MB                                 │
│  ├── Max image size: 5MB                                     │
│  ├── Max images per session: 50                              │
│  └── Session TTL: 1 hour                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Security Measures

1. **Cryptographic Session IDs**: 32 bytes of random data (64 hex chars)
2. **Session Validation**: Every operation validates session existence
3. **Cross-Session Prevention**: Socket-to-session mapping enforced
4. **No URL Exposure**: Images served only via WebSocket
5. **Size Limits**: 5MB per image, 50 images per session
6. **MIME Validation**: Magic bytes detection for image types
7. **Filename Sanitization**: Path traversal prevention

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone/navigate to project
cd image-share

# Install dependencies
npm install

# Generate PWA icons (optional, requires sharp)
npm install sharp --save-dev
node scripts/generate-icons.js
```

### Development

```bash
# Run both server and client in development mode
npm run dev

# Or run separately:
npm run dev:server  # Backend on http://localhost:3001
npm run dev:client  # Frontend on http://localhost:5173
```

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## 📱 PWA Installation

### Mobile (Android/iOS)
1. Open the app in Chrome/Safari
2. Tap "Add to Home Screen" or install prompt
3. The app will now appear in your app drawer
4. Share images from gallery → ImageShare appears in share sheet

### Desktop (Chrome)
1. Open the app in Chrome
2. Click install icon in address bar
3. App installs as standalone window

## 🔌 WebSocket Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `session:create` | - | Create new session |
| `session:join` | `{ sessionId }` | Join existing session |
| `session:leave` | - | Leave current session |
| `image:upload` | `{ buffer, mimeType, filename }` | Upload image (binary) |
| `image:request` | `{ imageId }` | Request image data |
| `image:delete` | `{ imageId }` | Delete an image |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `session:created` | `{ sessionId, expiresAt }` | Session created |
| `session:joined` | `{ id, images[], memberCount }` | Joined session |
| `session:expired` | `{ reason }` | Session expired |
| `image:added` | `{ image: metadata }` | New image available |
| `image:deleted` | `{ imageId }` | Image was deleted |
| `image:data` | `{ buffer, mimeType, ... }` | Image binary data |
| `member:joined` | `{ memberCount }` | Member count updated |
| `member:left` | `{ memberCount }` | Member count updated |

## 🛡️ Constraints Compliance

| Constraint | Implementation |
|------------|----------------|
| ❌ No database | ✅ Uses `Map` in process memory only |
| ❌ No filesystem | ✅ No `fs` operations, no temp files |
| ❌ No cloud storage | ✅ Pure in-memory storage |
| ❌ No Redis/cache | ✅ Native JavaScript structures only |
| ✅ RAM only | ✅ All data in `MemoryStore` class |
| ✅ Auto-cleanup | ✅ TTL + periodic cleanup service |
| ✅ Binary transfer | ✅ `Buffer` via Socket.IO |

## 📊 Performance Considerations

- **Memory Limit**: 500MB total (configurable)
- **Cleanup Interval**: Every 5 minutes
- **Session TTL**: 1 hour
- **WebSocket Buffer**: 5MB + 1KB for metadata
- **Concurrent Sessions**: Limited by memory only

## 🔧 Configuration

Edit `server/config/constants.js` to customize:

```javascript
export const SESSION_CONFIG = {
  TTL_MS: 60 * 60 * 1000,        // Session lifetime
  MAX_IMAGES_PER_SESSION: 50,    // Images per session
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000  // Cleanup frequency
};

export const IMAGE_CONFIG = {
  MAX_SIZE_BYTES: 5 * 1024 * 1024,  // Max image size
  ALLOWED_TYPES: [...]              // Allowed MIME types
};

export const MEMORY_CONFIG = {
  MAX_TOTAL_BYTES: 500 * 1024 * 1024,  // Total memory limit
  WARNING_THRESHOLD: 0.8,               // 80% warning
  CRITICAL_THRESHOLD: 0.95              // 95% force cleanup
};
```

## 📄 License

MIT License - feel free to use in your projects.
