// Physical Magic Remote CH rocker captured on the development TV: PageUp 33,
// PageDown 34. Also accept standard ChannelUp/Down codes from other inputs.
const codes={33:'ChannelUp',34:'ChannelDown',427:'ChannelUp',428:'ChannelDown',415:'MediaPlay',19:'MediaPause',179:'MediaPlayPause',417:'MediaFastForward',412:'MediaRewind'};
const names={ChannelUp:'ChannelUp',ChannelDown:'ChannelDown',PageUp:'ChannelUp',PageDown:'ChannelDown'};
export function normalizedRemoteKey(event){return codes[event.keyCode] || names[event.key] || null;}
