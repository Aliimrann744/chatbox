import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ComponentProps } from 'react';

export const MAPPING: Record<string, ComponentProps<typeof MaterialIcons>['name']> = {
  // Navigation icons
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',

  // Chat app icons
  'message.fill': 'chat',
  'phone.fill': 'phone',
  'gear': 'settings',
  'person.fill': 'person',
  'person.circle.fill': 'account-circle',
  'plus': 'add',
  'magnifyingglass': 'search',
  'camera.fill': 'camera-alt',
  'mic.fill': 'mic',
  'paperclip': 'attach-file',
  'ellipsis.vertical': 'more-vert',
  'arrow.left': 'arrow-back',
  'person.2.fill': 'group',
  'person.badge.plus': 'person-add',
  'building.2.fill': 'business',
  'checkmark': 'check',
  'checkmark.double': 'done-all',
  'xmark': 'close',
  'play.fill': 'play-arrow',
  'pause.fill': 'pause',
  'photo': 'photo',
  'doc.fill': 'description',
  'location.fill': 'location-on',
  'video.fill': 'videocam',
  'phone.arrow.up.right': 'phone-callback',
  'phone.arrow.down.left': 'phone-in-talk',
  'phone.fill.arrow.up.right': 'call-made',
  'phone.fill.arrow.down.left': 'call-received',

  // Updates & UI icons
  'circle.dashed': 'motion-photos-on',
  'envelope.fill': 'email',
  'speaker.slash.fill': 'volume-off',
  'pin.fill': 'push-pin',
  'xmark.circle.fill': 'cancel',
  'checkmark.circle.fill': 'check-circle',
  'checkmark.circle': 'check-circle-outline',
  'person.2': 'group',
  'message': 'chat-bubble-outline',
  'video': 'videocam',

  // Call control icons
  'phone.down.fill': 'call-end',
  'mic.slash.fill': 'mic-off',
  'speaker.wave.3.fill': 'volume-up',
  'speaker.fill': 'volume-down',
  'video.slash.fill': 'videocam-off',
  'camera.rotate.fill': 'flip-camera-ios',
  'exclamationmark.circle': 'error-outline',
};
