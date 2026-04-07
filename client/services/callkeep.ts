// CallKeep is disabled — incompatible with React Native new architecture.
// Incoming call UI is handled by Notifee full-screen notifications instead.

type CallKeepCallbacks = {
  onAnswerCall: (callUUID: string) => void;
  onEndCall: (callUUID: string) => void;
};

export function setCallKeepCallbacks(_cbs: CallKeepCallbacks) {}
export async function setupCallKeep(): Promise<boolean> { return false; }
export function displayIncomingCall(_callId: string, _callerName: string, _hasVideo: boolean) {}
export function endCallKeepCall(_callId: string) {}
export function reportConnectedCall(_callId: string) {}
export const RNCallKeep = null;
