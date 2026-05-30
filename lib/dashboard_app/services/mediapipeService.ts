import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import localModelUrl from "@/modules/gesture_recognizer.task?url";

export class MediaPipeService {
  private static recognizer: GestureRecognizer | null = null;
  private static initPromise: Promise<GestureRecognizer> | null = null;

  static async initialize() {
    if (this.recognizer) return this.recognizer;
    if (this.initPromise) return this.initPromise;

    console.log("Initializing MediaPipe Vision...");

    this.initPromise = (async () => {
      try {
        let vision;
        // Try loading WASM from jsDelivr (Primary)
        try {
             console.log("Attempting to load WASM from jsDelivr...");
             vision = await FilesetResolver.forVisionTasks(
              "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
            );
        } catch (e) {
            console.warn("jsDelivr load failed, attempting fallback to unpkg...", e);
            // Fallback to unpkg if jsDelivr fails
            vision = await FilesetResolver.forVisionTasks(
                "https://unpkg.com/@mediapipe/tasks-vision@0.10.9/wasm"
            );
        }

        let recognizer: GestureRecognizer;
        try {
          recognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: localModelUrl,
              delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 2,
          });
        } catch (e) {
          console.warn('Local model load failed, falling back to remote CDN...', e);
          recognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
              delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 2,
          });
        }

        console.log("MediaPipe Initialized Successfully");
        this.recognizer = recognizer;
        return recognizer;
      } catch (error) {
        console.error("Failed to initialize MediaPipe:", error);
        this.initPromise = null; // Reset promise on failure to allow retry
        throw error;
      }
    })();

    return this.initPromise;
  }
}
