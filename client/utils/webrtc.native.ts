import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  RTCView,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';

export { RTCView, InCallManager, MediaStream };
export const isWebRTCAvailable = true;

export type CallType = 'VOICE' | 'VIDEO';

interface PeerConnectionCallbacks {
  onRemoteStream: (stream: MediaStream) => void;
  onIceCandidate: (candidate: any) => void;
  onConnectionStateChange: (state: string) => void;
}

export function createPeerConnection(
  iceServers: any[],
  callType: CallType,
  callbacks: PeerConnectionCallbacks,
): { pc: RTCPeerConnection; localStreamPromise: Promise<MediaStream> } {
  const pc = new RTCPeerConnection({ iceServers }) as any;

  pc.onicecandidate = (event: any) => {
    if (event.candidate) {
      callbacks.onIceCandidate(event.candidate);
    }
  };

  pc.ontrack = (event: any) => {
    if (event.streams && event.streams[0]) {
      callbacks.onRemoteStream(event.streams[0]);
    }
  };

  // Fallback for older react-native-webrtc versions
  pc.onaddstream = (event: any) => {
    if (event.stream) {
      callbacks.onRemoteStream(event.stream);
    }
  };

  pc.onconnectionstatechange = () => {
    callbacks.onConnectionStateChange(pc.connectionState);
  };

  const localStreamPromise = mediaDevices
    .getUserMedia({
      audio: true,
      video: callType === 'VIDEO' ? { facingMode: 'user' } : false,
    })
    .then((stream: MediaStream) => {
      stream.getTracks().forEach((track: any) => {
        pc.addTrack(track, stream);
      });
      return stream;
    });

  return { pc, localStreamPromise };
}

export async function createOffer(pc: RTCPeerConnection): Promise<any> {
  const offer = await pc.createOffer({});
  await pc.setLocalDescription(offer);
  return offer;
}

export async function handleOffer(
  pc: RTCPeerConnection,
  offer: any,
): Promise<any> {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return answer;
}

export async function handleAnswer(
  pc: RTCPeerConnection,
  answer: any,
): Promise<void> {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

export async function addIceCandidate(
  pc: RTCPeerConnection,
  candidate: any,
): Promise<void> {
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
}

export function closePeerConnection(
  pc: RTCPeerConnection | null,
  localStream: MediaStream | null,
): void {
  if (localStream) {
    localStream.getTracks().forEach((track: any) => track.stop());
  }
  if (pc) {
    pc.close();
  }
}
