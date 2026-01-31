# ImageShare - Architectural Documentation

## Overview

This document provides detailed architectural explanations for the ImageShare real-time image sharing application.

## Core Design Principles

### 1. Memory-Only Constraint

The application strictly adheres to the memory-only constraint:

```
Process Memory (RAM)
└── Node.js Heap
    └── MemoryStore Instance (Singleton)
        ├── sessions: Map<string, Session>
        ├── socketToSession: Map<string, string>
        └── totalMemoryUsage: number
```

**Why this matters:**
- No data survives server restart (by design)
- Horizontal scaling requires session affinity
- Memory is the only limiting resource
- Cleanup is deterministic and immediate

### 2. Session Model

Sessions are the core organizational unit:

```javascript
Session = {
  id: string,           // 64-char hex (32 bytes entropy)
  createdAt: number,    // Unix timestamp
  expiresAt: number,    // createdAt + 1 hour
  images: Map,          // Image storage
  members: Set          // Connected socket IDs
}
```

**Session ID Generation:**
```javascript
crypto.randomBytes(32).toString('hex')
// Produces: "a1b2c3d4e5f6..." (64 chars)
// Entropy: 256 bits
// Collision probability: negligible
```

### 3. Image Storage

Images are stored as raw binary buffers:

```javascript
ImageData = {
  id: string,           // 32-char hex
  buffer: Buffer,       // RAW BINARY DATA
  mimeType: string,     // Validated MIME type
  filename: string,     // Sanitized filename
  size: number,         // Buffer byte length
  uploadedAt: number,   // Timestamp
  uploadedBy: string    // Socket ID
}
```

**Why Buffer instead of Base64:**
- Base64 increases size by ~33%
- Socket.IO supports binary natively
- Avoids encoding/decoding overhead
- Direct memory representation

### 4. Real-time Communication

WebSocket-only communication via Socket.IO:

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Client A  │◄───────►│   Server    │◄───────►│   Client B  │
│  (Uploader) │  Binary │  Socket.IO  │  Binary │ (Receiver)  │
└─────────────┘         └─────────────┘         └─────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   MemoryStore   │
                    │   (RAM only)    │
                    └─────────────────┘
```

**Event Flow - Image Upload:**
1. Client A uploads binary via `image:upload`
2. Server validates and stores in MemoryStore
3. Server broadcasts `image:added` to session room
4. All clients receive metadata
5. Clients request full image via `image:request`

### 5. Cleanup Strategy

Three-tier cleanup approach:

**Tier 1: Periodic Cleanup (Every 5 minutes)**
```javascript
setInterval(() => {
  const expired = getExpiredSessions();
  expired.forEach(id => deleteSession(id));
}, 5 * 60 * 1000);
```

**Tier 2: Memory Pressure Response**
```javascript
if (memoryUsage > 95%) {
  // Force delete oldest sessions
  forceCleanupOldestSessions(5);
}
```

**Tier 3: Socket Disconnect**
```javascript
socket.on('disconnect', () => {
  removeMemberFromSession(socketId);
  // Session persists for other members
});
```

## Security Architecture

### Session Security

```
┌─────────────────────────────────────────────────────┐
│                 SECURITY LAYERS                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. Cryptographic Session ID                         │
│     └── 256-bit random, unpredictable               │
│                                                      │
│  2. Session Validation                               │
│     └── Every operation checks session exists        │
│     └── Expired sessions fail validation            │
│                                                      │
│  3. Socket-Session Binding                           │
│     └── Tracks which socket belongs to which session│
│     └── Prevents cross-session access               │
│                                                      │
│  4. No URL Exposure                                  │
│     └── Images only via authenticated WebSocket     │
│     └── No direct HTTP access to image data         │
│                                                      │
│  5. Input Validation                                 │
│     └── Size limits (5MB)                           │
│     └── MIME type validation                        │
│     └── Filename sanitization                       │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### MIME Type Validation

```javascript
// Magic byte detection
function detectMimeType(buffer) {
  const header = buffer.slice(0, 12);
  
  // JPEG: FF D8 FF
  if (header[0] === 0xFF && header[1] === 0xD8) 
    return 'image/jpeg';
    
  // PNG: 89 50 4E 47
  if (header[0] === 0x89 && header[1] === 0x50)
    return 'image/png';
    
  // ... other formats
}
```

## PWA & Share Target

### Manifest Configuration

```json
{
  "share_target": {
    "action": "/api/share-target",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "files": [{
        "name": "images",
        "accept": ["image/*"]
      }]
    }
  }
}
```

### Share Target Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Gallery   │────►│ Share Sheet │────►│  ImageShare │
│             │     │             │     │   (PWA)     │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   Server    │
                                        │  (Memory)   │
                                        └─────────────┘
```

**Process:**
1. User shares image from gallery
2. OS shows share sheet with ImageShare
3. User taps ImageShare icon
4. Service worker intercepts POST
5. Image sent to server via WebSocket
6. All session members receive image

## Scaling Considerations

### Single Server Limitations

Since all data is in-memory:
- Memory is the ceiling (500MB default)
- Single server = single point of truth
- Horizontal scaling requires session affinity

### Horizontal Scaling Options

**Option 1: Sticky Sessions (Load Balancer)**
```
Client ──► LB ──► Server A (has session)
                  Server B
                  Server C
```

**Option 2: Session Replication (Not recommended)**
Would require Redis/cache - violates constraints

**Recommended Approach:**
- Vertical scaling (more RAM)
- Multiple independent instances with different domains
- Session affinity at load balancer level

## Error Handling

### Client-Side Errors

```javascript
try {
  await uploadImage(file);
} catch (err) {
  // Handle: "Session not found"
  // Handle: "Image too large"
  // Handle: "Invalid format"
}
```

### Server-Side Errors

```javascript
// All operations return { success, error? }
if (!session) {
  return { success: false, error: 'Session not found' };
}
```

### Connection Recovery

```javascript
socket.on('disconnect', () => {
  // Attempt reconnection
  socket.connect();
});

socket.on('reconnect', () => {
  // Re-join session if stored locally
  if (storedSessionId) {
    joinSession(storedSessionId);
  }
});
```

## Performance Optimizations

### Binary Transfer
- No Base64 encoding
- Direct buffer transmission
- ~33% bandwidth savings

### Lazy Loading
- Thumbnails load on demand
- Full images only when requested
- Memory-efficient grid rendering

### Memory Tracking
```javascript
// Real-time memory tracking
totalMemoryUsage += image.buffer.length;
// On delete:
totalMemoryUsage -= image.buffer.length;
```

## Testing Considerations

### Memory Leak Detection
```javascript
// Monitor process.memoryUsage()
setInterval(() => {
  const { heapUsed } = process.memoryUsage();
  console.log(`Heap: ${heapUsed / 1024 / 1024}MB`);
}, 60000);
```

### Session Cleanup Verification
```javascript
// Verify sessions are cleaned up
const beforeCleanup = memoryStore.sessions.size;
cleanupService.runCleanup();
const afterCleanup = memoryStore.sessions.size;
assert(afterCleanup <= beforeCleanup);
```

## Conclusion

This architecture provides:
- **Strict compliance** with memory-only constraints
- **Real-time performance** via WebSockets
- **Security** through cryptographic IDs and validation
- **Automatic cleanup** preventing memory leaks
- **PWA experience** with native share integration

The design prioritizes simplicity and correctness over features, ensuring the core constraints are never violated.
