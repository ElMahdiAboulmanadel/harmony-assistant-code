import {
  AnimationClip,
  NumberKeyframeTrack,
} from 'three';

var fps = 60

function modifiedKey(key) {

  if (["eyeLookDownLeft", "eyeLookDownRight", "eyeLookInLeft", "eyeLookInRight", "eyeLookOutLeft", "eyeLookOutRight", "eyeLookUpLeft", "eyeLookUpRight"].includes(key)) {
    return key
  }

  if (key.endsWith("Right")) {
    return key.replace("Right", "_R");
  }
  if (key.endsWith("Left")) {
    return key.replace("Left", "_L");
  }
  return key;
}

function createAnimation(recordedData, morphTargetDictionary, bodyPart) {

  if (recordedData.length !== 0) {
    let animation = []
    for (let i = 0; i < Object.keys(morphTargetDictionary).length; i++) {
      animation.push([])
    }
    let time = []
    let finishedFrames = 0
    recordedData.forEach((d, i) => {
      Object.entries(d.blendshapes).forEach(([key, value]) => {
        if (!(modifiedKey(key) in morphTargetDictionary)) { return };
        if (key === 'mouthShrugUpper') {
          value += 0.4;
        }
        animation[morphTargetDictionary[modifiedKey(key)]].push(value)
      });
      time.push(finishedFrames / fps)
      finishedFrames++
    })
    let tracks = []
    //create morph animation
    Object.entries(recordedData[0].blendshapes).forEach(([key, value]) => {

      if (!(modifiedKey(key) in morphTargetDictionary)) { return };

      let i = morphTargetDictionary[modifiedKey(key)]
      let track = new NumberKeyframeTrack(`${bodyPart}.morphTargetInfluences[${i}]`, time, animation[i])
      tracks.push(track)
    });

    const clip = new AnimationClip('animation', -1, tracks);
    return clip
  }
  return null
}

export default createAnimation;