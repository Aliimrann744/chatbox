// Web fallback — react-native-webrtc is not available on web

export const RTCView = null;
export const InCallManager = {
  start: () => {},
  stop: () => {},
  setSpeakerphoneOn: () => {},
};
export const MediaStream = null;
export const isWebRTCAvailable = false;

export type CallType = 'VOICE' | 'VIDEO';

export function createPeerConnection(): any {
  console.warn('WebRTC is not available on web');
  return { pc: null, localStreamPromise: Promise.resolve(null) };
}

export async function createOffer(): Promise<any> {
  return null;
}

export async function handleOffer(): Promise<any> {
  return null;
}

export async function handleAnswer(): Promise<void> {}

export async function addIceCandidate(): Promise<void> {}

export function closePeerConnection(): void {}
