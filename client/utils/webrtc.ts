// Web fallback — react-native-webrtc is not available on web

export const RTCView = null;
export const InCallManager = {
  start: (_opts?: any) => {},
  stop: () => {},
  setSpeakerphoneOn: (_on: boolean) => {},
  setForceSpeakerphoneOn: (_on: boolean) => {},
};
export const MediaStream = null;
export const isWebRTCAvailable = false;

export type CallType = 'VOICE' | 'VIDEO';

interface PeerConnectionCallbacks {
  onRemoteStream: (stream: any) => void;
  onIceCandidate: (candidate: any) => void;
  onConnectionStateChange: (state: string) => void;
}

export function createPeerConnection(
  _iceServers: any[],
  _callType: CallType,
  _callbacks: PeerConnectionCallbacks,
): { pc: any; localStreamPromise: Promise<any> } {
  console.warn('WebRTC is not available on web');
  return { pc: null, localStreamPromise: Promise.resolve(null) };
}

export async function createOffer(_pc: any): Promise<any> {
  return null;
}

export async function handleOffer(_pc: any, _offer: any): Promise<any> {
  return null;
}

export async function handleAnswer(_pc: any, _answer: any): Promise<void> {}

export async function addIceCandidate(_pc: any, _candidate: any): Promise<void> {}

export function closePeerConnection(_pc: any, _localStream: any): void {}
