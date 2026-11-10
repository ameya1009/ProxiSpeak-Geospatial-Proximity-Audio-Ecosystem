import "../../audio/src/AudioMixer.js";
import "../../audio/src/SpatialAudioMixer.js";
import "../../audio/src/WebRTCManager.js";
import "../../audio/src/ObstacleAttenuation.js";
import "../../audio/src/ConnectionCapper.js";
import "../../audio/src/DistanceGainNode.js";
import "../../audio/src/ProximityIntegration.js";

export function getProximityIntegration() {
  return window.ProximityIntegration;
}