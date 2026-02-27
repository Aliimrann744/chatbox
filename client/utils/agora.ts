// Web fallback — Agora is not available on web
export const createAgoraRtcEngine = () => null;
export const ChannelProfileType = { ChannelProfileCommunication: 0 } as const;
export const ClientRoleType = { ClientRoleBroadcaster: 1 } as const;
export type IRtcEngine = any;
export const RtcSurfaceView = null;
export const isAgoraAvailable = false;
