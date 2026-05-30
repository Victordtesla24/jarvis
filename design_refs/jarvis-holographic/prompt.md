### Role: World-Class Creative Frontend Engineer
- Core Skills: Expert in WebGL (Three.js / @react-three/fiber), computer vision (MediaPipe), cyberpunk UI design
- Tech Stack Specialty: React + TypeScript + Vite, @react-three/postprocessing, @mediapipe/tasks-vision, Tailwind CSS
- Mission: Develop a single-file React application replicating an Iron Man JARVIS-style holographic HUD interactive interface (combining live camera feed, 3D holographic globe, and gesture interaction)

### Detailed Features & Technical Requirements
#### 1. Visuals
- Background: Full-screen live camera feed (keep colors, lower brightness / increase contrast)
- UI Theme: Cyan (#00FFFF) as the primary color, including scanlines, glowing text, dashed borders, animated data streams, pulsing progress bars
- HUD Layout:
  - Top-left: Core system status + randomly scrolling hexadecimal codes
  - Top-right: Large "贾维斯 (J.A.R.V.I.S)" title + current time + system pulse animation
  - Bottom-left: Hand tracking status indicator
  - Right-side floating panel: Draggable "Geographic Intelligence Analysis Panel" (shows the continent currently facing the globe plus fictional scan data)

#### 2. 3D Holographic Globe (Three.js)
- Position: Left side of screen (x = -1.0)
- Material: TextureLoader loads an Earth specular map, AdditiveBlending for additive blending (land glows, oceans are transparent)
- Decorations: Outer rotating wireframe sphere + planetary ring
- State Feedback: Calculate the facing continent in real time based on rotation angle (Americas / Pacific / Asia / Europe / Africa), and report it back to the UI layer

#### 3. Interaction Logic (Core Algorithm)
- Hand Tracking: Dual-hand skeleton recognition via MediaPipe
- Left-half interaction (controls the globe):
  - Rotation: Controlled by left-hand palm X/Y axis movement
  - Zoom: Left-hand thumb-to-index-finger distance detection (spread = zoom in, pinch = zoom out)
- Right-half interaction (controls the floating panel):
  - Drag: When the right hand is in a pinch state (thumb-to-index distance < threshold), the panel follows the right hand's position; releasing stops the drag

#### 4. Code Structure & Optimization
- Performance: Use useRef + requestAnimationFrame for high-frequency computation (MediaPipe loop, 3D rotation) to avoid excessive re-renders
- Skeleton Rendering: A 2D Canvas layer renders cyan-glowing hand skeleton lines in real time
- Interface Language: All text in Chinese
