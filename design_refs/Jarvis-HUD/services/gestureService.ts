import { GestureRecognizer, FilesetResolver } from "@mediapipe/tasks-vision";

let gestureRecognizer: GestureRecognizer | null = null;
let runningMode: "VIDEO" | "IMAGE" = "VIDEO";

export const initializeGestureRecognizer = async () => {
  try {
    const filesetResolver = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
    );

    gestureRecognizer = await GestureRecognizer.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
        delegate: "GPU"
      },
      runningMode: runningMode,
      numHands: 1,
      // Increase confidence thresholds to reduce false positives and jitter
      minHandDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      cannedGesturesClassifierOptions: {
        scoreThreshold: 0.5 // Only return gestures with >50% confidence
      }
    });
    console.log("Gesture Recognizer Initialized with High Accuracy Settings");
  } catch (error) {
    console.error("Failed to initialize Gesture Recognizer", error);
  }
};

export const predictGestures = (video: HTMLVideoElement) => {
  if (!gestureRecognizer) return null;
  
  // Ensure the video is ready
  if (video.currentTime > 0 && !video.paused && !video.ended && video.readyState >= 2) {
    const nowInMs = Date.now();
    return gestureRecognizer.recognizeForVideo(video, nowInMs);
  }
  return null;
};