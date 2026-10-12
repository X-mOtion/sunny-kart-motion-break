export const CONFIG = {
  laps: 3, racers: 6, checkpoints: 24, hz: 60,
  car: { topSpeed: 40, nitroSpeed: 54, miniSpeed: 46, acceleration: 12.4, brake: 26, radius: .95,
    driftMinSpeed: 10, driftMinTime: .45, nitroDuration: 3, miniDuration: .5, chargeRate: 30, respawnPenalty: 3 },
  drift: { normalGrip: 10, slidingGrip: 1.55, initialYawGain: 1.15, yawGainPerSecond: .3, growthSeconds: 2 },
  casual: { topSpeed: 34, nitroSpeed: 44, miniSpeed: 37, cornerAcceleration: 11.5, cityCornerAcceleration: 8,
    laneRange: 2.6, laneSmoothing: 2.8, actionLaneSmoothing: 7, actionSteerResponse: 20, actionYawResponse: 16,
    slidingGrip: 3.8, recoverySeconds: 1.1, recoverySpeed: 9,
    turnDuration: 1.1, turnStrength: .65, shrugBurstDuration: .6 },
  camera: { normalFov: 60, nitroFov: 72, miniFov: 65, followDistance: 7.5, followHeight: 4.4, smoothing: 7, anticipation: .22 },
  effects: { particles: 104, lowParticles: 48, skidMarks: 480, smokeRate: 30, jetRate: 36,
    feedbackSeconds: 1.15, signalSeconds: 1.6, signalPeriod: .48,
    overtakeMargin: 3, overtakeCooldown: 8, boostPulseSeconds: .38 },
  ai: {
    lookAheadBase: 5, lookAheadSpeedFactor: .35, steeringGain: 2.35, recoverySeconds: 5,
    casual: { cruiseBase: .88, cruisePerCar: .02, cruiseVariation: .03, paceGain: .05 },
    easy: { pace: .84, driftCurve: .04, driftHold: .8, nitroCurve: .004, nitroSpeed: 32 },
    normal: { pace: .94, driftCurve: .027, driftHold: 1.05, nitroCurve: .008, nitroSpeed: 27 },
    hard: { pace: 1, driftCurve: .025, driftHold: 1.15, nitroCurve: .01, nitroSpeed: 25 },
  },
  pose: { confidence: .6, faceConfidence: .45, smoothMs: 80, headSmoothMs: 25, shoulderSmoothMs: 30,
    frameIntervalMs: 32, faceGraceMs: 200, lossMs: 500,
    autoFitMs: 400, laneTiltEnter: 5.5, laneTiltRelease: 3.3, laneHoldMs: 30,
    laneDominance: 1.45, turnDominance: 1.65,
    shoulderTurnEnter: 6.5, shoulderTurnRelease: 3, shoulderTurnHoldMs: 30, gestureRearmMs: 120,
    shrugLift: .035, shrugClose: .025, shrugRelease: .018, shrugSmoothMs: 25,
    shrugHoldMs: 30, shrugRearmMs: 120, shrugCooldownMs: 240,
    nodDown: .12, nodRelease: .045, nodHoldMs: 70, nodMaxMs: 1300, nodCooldownMs: 950 },
  colors: ['#ffd139', '#ff6561', '#5d9df2', '#ad86ee', '#43cbb2', '#ff9d53'],
  names: ['You', 'Orange Soda', 'Blueberry Bolt', 'Violet Night', 'Mint Breeze', 'Sunset Rider'],
} as const;
export type ControlMode = 'keyboard' | 'touch' | 'pose';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Quality = 'auto' | 'high' | 'low';
// actionControl omitted = retain the current mode; false explicitly selects continuous keyboard/touch input.
export interface InputFrame { steer: number; throttle: number; brake: number; drift: boolean; boost: boolean; resume?: boolean; actionControl?: boolean; directionAction?: -1|0|1; turnAction?: -1|0|1 }
export const emptyInput = (): InputFrame => ({steer: 0, throttle: 0, brake: 0, drift: false, boost: false});
export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const wrapAngle = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));
export const mod = (x: number, n: number) => ((x % n) + n) % n;
export function formatTime(t: number) {
  if (!Number.isFinite(t)) return '—';
  return `${Math.floor(t / 60).toString().padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`;
}
