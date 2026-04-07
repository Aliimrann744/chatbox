import { Platform } from 'react-native';

let RNCallKeep: any = null;

try {
  RNCallKeep = require('react-native-callkeep').default;
} catch (e) {
  console.warn('react-native-callkeep not available:', e);
}

const CALLKEEP_OPTIONS = {
  ios: {
    appName: 'WhatsApp',
    supportsVideo: true,
    maximumCallGroups: 1,
    maximumCallsPerCallGroup: 1,
  },
  android: {
    alertTitle: 'Permissions Required',
    alertDescription: 'This app needs access to display calls on your phone',
    cancelButton: 'Cancel',
    okButton: 'OK',
    selfManaged: true,
    additionalPermissions: [],
    foregroundService: {
      channelId: 'calls',
      channelName: 'Incoming Calls',
      notificationTitle: 'Incoming call',
      notificationIcon: 'ic_notification',
    },
  },
};

// Callbacks that will be set by call-context
type CallKeepCallbacks = {
  onAnswerCall: (callUUID: string) => void;
  onEndCall: (callUUID: string) => void;
};

let callbacks: CallKeepCallbacks | null = null;

export function setCallKeepCallbacks(cbs: CallKeepCallbacks) {
  callbacks = cbs;
}

export async function setupCallKeep(): Promise<boolean> {
  if (!RNCallKeep) return false;

  try {
    await RNCallKeep.setup(CALLKEEP_OPTIONS);
    RNCallKeep.setAvailable(true);

    // Register event listeners
    RNCallKeep.addEventListener('answerCall', ({ callUUID }: { callUUID: string }) => {
      console.log('CallKeep: answerCall', callUUID);
      callbacks?.onAnswerCall(callUUID);
    });

    RNCallKeep.addEventListener('endCall', ({ callUUID }: { callUUID: string }) => {
      console.log('CallKeep: endCall', callUUID);
      callbacks?.onEndCall(callUUID);
    });

    RNCallKeep.addEventListener(
      'didDisplayIncomingCall',
      ({ callUUID, error }: { callUUID: string; error?: string }) => {
        if (error) {
          console.error('CallKeep: didDisplayIncomingCall error:', error);
        } else {
          console.log('CallKeep: displayed incoming call', callUUID);
        }
      },
    );

    console.log('CallKeep setup complete');
    return true;
  } catch (error) {
    console.error('CallKeep setup error:', error);
    return false;
  }
}

export function displayIncomingCall(
  callId: string,
  callerName: string,
  hasVideo: boolean = false,
) {
  if (!RNCallKeep) return;

  try {
    RNCallKeep.displayIncomingCall(
      callId,
      callerName,
      callerName,
      'generic',
      hasVideo,
    );
  } catch (e) {
    console.error('CallKeep: displayIncomingCall error:', e);
  }
}

export function endCallKeepCall(callId: string) {
  if (!RNCallKeep) return;

  try {
    RNCallKeep.endCall(callId);
  } catch (e) {
    console.error('CallKeep: endCall error:', e);
  }
}

export function reportConnectedCall(callId: string) {
  if (!RNCallKeep) return;

  try {
    if (Platform.OS === 'android') {
      RNCallKeep.setCurrentCallActive(callId);
    }
  } catch (e) {
    console.error('CallKeep: reportConnected error:', e);
  }
}

export { RNCallKeep };
