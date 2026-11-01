export function fitVideo(containerWidth,containerHeight,videoWidth,videoHeight) {
  if(![containerWidth,containerHeight,videoWidth,videoHeight].every(n=>Number.isFinite(n)&&n>0))return null;
  const scale=Math.min(containerWidth/videoWidth,containerHeight/videoHeight);
  const width=videoWidth*scale,height=videoHeight*scale;
  return {width,height,left:(containerWidth-width)/2,top:(containerHeight-height)/2};
}
