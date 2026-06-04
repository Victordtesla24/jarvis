export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface HandInteractionData {
  landmarks: Landmark[];
  handedness: 'Left' | 'Right';
  gesture?: string;
  pinchDistance?: number; // Normalized 0-1
  isPinching: boolean;
  expansionFactor: number; // 0 (Fist) to 1 (Open Palm)
  rotationControl: { x: number, y: number }; // -1 to 1 for both axes (Joystick style)
}

export interface HandTrackingState {
  leftHand: HandInteractionData | null;
  rightHand: HandInteractionData | null;
}

export enum RegionName {
  AMERICAS = "AMERICAS SECTOR",
  PACIFIC = "PACIFIC MONITORING ZONE",
  ASIA = "ASIA WAR ZONE",
  EUROPE = "EUROPE DEFENSE ZONE",
  AFRICA = "AFRICA RESOURCE ZONE"
}

export interface PanelPosition {
  x: number;
  y: number;
}
