(() => {
  'use strict';
  const QQ=window.QQ,{rgb}=QQ.Math3D;
  QQ.Materials={
    concrete:{id:0,tile:0,tileScale:.72,texStrength:.68,color:rgb('#5e6b70'),hard:.82,particle:'dust',rough:.92,metal:.02,emissive:0,normalStrength:.78},
    metal:{id:1,tile:1,tileScale:.82,texStrength:.72,color:rgb('#65737a'),hard:.93,particle:'spark',rough:.46,metal:.78,emissive:0,normalStrength:.38},
    glass:{id:2,tile:2,tileScale:.45,texStrength:.28,color:rgb('#72dce8'),hard:.12,particle:'glass',rough:.12,metal:.02,emissive:.04,normalStrength:.08},
    wood:{id:3,tile:3,tileScale:.7,texStrength:.82,color:rgb('#8b633e'),hard:.32,particle:'chip',rough:.78,metal:.01,emissive:0,normalStrength:.72},
    energy:{id:4,tile:4,tileScale:.9,texStrength:.35,color:rgb('#9a77ff'),hard:1,particle:'arc',rough:.16,metal:.08,emissive:1,normalStrength:.05},
    paintedMetal:{id:5,tile:5,tileScale:.55,texStrength:.76,color:rgb('#32434a'),hard:.9,particle:'spark',rough:.58,metal:.62,emissive:0,normalStrength:.48},
    rubber:{id:6,tile:6,tileScale:.8,texStrength:.48,color:rgb('#151d20'),hard:.6,particle:'dust',rough:.96,metal:0,emissive:0,normalStrength:.58},
    hazard:{id:7,tile:7,tileScale:.42,texStrength:.9,color:rgb('#c99b2d'),hard:.86,particle:'spark',rough:.55,metal:.5,emissive:.02,normalStrength:.32},
    screen:{id:8,tile:8,tileScale:.75,texStrength:.52,color:rgb('#5ddff3'),hard:.25,particle:'glass',rough:.1,metal:.03,emissive:1,normalStrength:.06},
    portal:{id:9,tile:9,tileScale:.8,texStrength:.35,color:rgb('#79e8ff'),hard:1,particle:'arc',rough:.05,metal:.08,emissive:1.35,normalStrength:.03}
  };
})();
