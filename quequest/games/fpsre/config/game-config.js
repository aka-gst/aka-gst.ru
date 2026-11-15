(() => {
  'use strict';
  const QQ = window.QQ;
  QQ.Config = Object.freeze({
    player: Object.freeze({walkSpeed:5.2, runSpeed:7.3, jumpSpeed:6.6, gravity:18, radius:.34, eyeHeight:1.62}),
    physics: Object.freeze({maxDt:.033}),
    weapons: Object.freeze({
      SERVICE_PISTOL:Object.freeze({cooldown:.17,damage:34,objectDamage:22,range:42,magCapacity:12,reserve:36}),
      RAIL:Object.freeze({cooldown:.38,damage:82,objectDamage:68,range:60}),
      ROCKET:Object.freeze({cooldown:.55,speed:12,life:6,damage:90,radius:5.5,impulse:9}),
      SHOCK:Object.freeze({orbCooldown:.35,beamCooldown:.22,orbSpeed:7,orbLife:6,beamDamage:38,objectDamage:32}),
      TRANSLOCATOR:Object.freeze({cooldown:.35,markerSpeed:10,markerLife:12})
    }),
    ballistics:Object.freeze({pistolSpeed:68,pistolLife:1.15,pistolRange:46,gravity:5.2,drag:.035,traceSeconds:2.4}),
    ai:Object.freeze({resourceSpeed:3,decisionInterval:.7,visionRange:18,engageRange:10,memorySeconds:8,hearingMemoryMs:2400}),
    vfx:Object.freeze({maxParticles:900,maxDebris:160}),
    dream:Object.freeze({crumbleSeconds:2.25,tideBaseSpeed:.16,tideCheckpointBonus:.035}),
    director:Object.freeze({warningSeconds:1.5,failureSeconds:1.6,breachSeconds:.8,releaseSeconds:3}),
    logging:Object.freeze({persistMs:1500,flushMs:2200,maxEvents:5000,recoveryTail:800})
  });
})();
