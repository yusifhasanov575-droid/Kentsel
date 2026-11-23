import * as THREE from 'three';
import { BuildingType, CELL_SIZE } from './types';
import { ProceduralTextureSet } from './textures';

export interface BuildingMaterialsRegistry {
  textures: ProceduralTextureSet;
  windowWarm: THREE.MeshStandardMaterial;
  windowCool: THREE.MeshStandardMaterial;
  lampGlow: THREE.MeshStandardMaterial;
  beaconGlow: THREE.MeshStandardMaterial;
  setNightFactor: (night: number, sunset: number) => void;
  getMat: (
    key: string,
    params: THREE.MeshStandardMaterialParameters,
  ) => THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function createBuildingMaterials(
  textures: ProceduralTextureSet,
): BuildingMaterialsRegistry {
  const cache = new Map<string, THREE.MeshStandardMaterial>();

  const windowWarm = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    roughness: 0.22,
    metalness: 0.1,
    emissive: new THREE.Color(0xfbbf24),
    emissiveIntensity: 0.05,
  });

  const windowCool = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    map: textures.glassFacadeMap,
    roughness: 0.14,
    metalness: 0.55,
    emissive: new THREE.Color(0x38bdf8),
    emissiveIntensity: 0.05,
  });

  const lampGlow = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    roughness: 0.2,
    emissive: new THREE.Color(0xfde047),
    emissiveIntensity: 0.15,
  });

  const beaconGlow = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    roughness: 0.2,
    emissive: new THREE.Color(0xef4444),
    emissiveIntensity: 0.6,
  });

  function getMat(
    key: string,
    params: THREE.MeshStandardMaterialParameters,
  ): THREE.MeshStandardMaterial {
    let mat = cache.get(key);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial(params);
      cache.set(key, mat);
    }
    return mat;
  }

  function setNightFactor(night: number, sunset: number) {
    windowWarm.emissiveIntensity = 0.08 + sunset * 0.65 + night * 1.45;
    windowCool.emissiveIntensity = 0.05 + sunset * 0.35 + night * 0.9;
    lampGlow.emissiveIntensity = 0.1 + sunset * 0.9 + night * 1.9;
  }

  return {
    textures,
    windowWarm,
    windowCool,
    lampGlow,
    beaconGlow,
    setNightFactor,
    getMat,
    dispose: () => {
      windowWarm.dispose();
      windowCool.dispose();
      lampGlow.dispose();
      beaconGlow.dispose();
      cache.forEach((m) => m.dispose());
      cache.clear();
    },
  };
}

function shadowAll(group: THREE.Object3D, cast = true, receive = true) {
  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
}

export function createRoadTileMesh(
  mask: number,
  reg: BuildingMaterialsRegistry,
): THREE.Group {
  const group = new THREE.Group();
  const roadTex = reg.textures.roadMaps.get(mask) || reg.textures.roadMaps.get(0)!;
  const roadMat = reg.getMat(`road_${mask}`, {
    map: roadTex,
    roughness: 0.85,
    metalness: 0.05,
  });

  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(CELL_SIZE, 0.06, CELL_SIZE),
    roadMat,
  );
  slab.position.y = 0.03;
  slab.receiveShadow = true;
  slab.castShadow = false;
  group.add(slab);

  // Add a sleek streetlamp on intersections or straight stretches
  const connections =
    ((mask & 1) !== 0 ? 1 : 0) +
    ((mask & 2) !== 0 ? 1 : 0) +
    ((mask & 4) !== 0 ? 1 : 0) +
    ((mask & 8) !== 0 ? 1 : 0);

  if (connections >= 2) {
    const poleMat = reg.getMat('dark_iron', {
      color: 0x334155,
      roughness: 0.35,
      metalness: 0.8,
    });
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.035, 0.58, 6),
      poleMat,
    );
    pole.position.set(-0.74, 0.32, -0.74);
    pole.castShadow = true;
    group.add(pole);

    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.025, 0.025),
      poleMat,
    );
    arm.position.set(-0.66, 0.6, -0.74);
    group.add(arm);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 8),
      reg.lampGlow,
    );
    bulb.position.set(-0.58, 0.58, -0.74);
    group.add(bulb);
  }

  return group;
}

export function createBuildingMesh(
  type: BuildingType,
  variant: number,
  level: number,
  reg: BuildingMaterialsRegistry,
  roadMask = 0,
): THREE.Group {
  if (type === 'road') {
    return createRoadTileMesh(roadMask, reg);
  }

  const group = new THREE.Group();
  const scaleBoost = level > 1 ? 1.14 : 1;

  const stoneMat = reg.getMat('stone_base', {
    color: 0x94a3b8,
    roughness: 0.9,
    metalness: 0.04,
  });
  const concreteMat = reg.getMat('concrete', {
    color: 0xcbd5e1,
    roughness: 0.82,
    metalness: 0.06,
  });
  const darkMetalMat = reg.getMat('dark_metal', {
    color: 0x334155,
    roughness: 0.32,
    metalness: 0.85,
  });
  const chromeMat = reg.getMat('chrome_steel', {
    color: 0xe2e8f0,
    roughness: 0.22,
    metalness: 0.9,
  });
  const woodMat = reg.getMat('timber', {
    color: 0x7c4a2d,
    roughness: 0.88,
    metalness: 0.02,
  });

  switch (type) {
    case 'house': {
      const wallPalette = [0xf8fafc, 0xfef3c7, 0xf1f5f9];
      const roofPalette = [0xc2410c, 0x334155, 0x0f766e];
      const wallMat = reg.getMat(`house_wall_${variant}`, {
        color: wallPalette[variant % 3],
        roughness: 0.84,
        metalness: 0.03,
      });
      const roofMat = reg.getMat(`house_roof_${variant}`, {
        color: roofPalette[variant % 3],
        roughness: 0.68,
        metalness: 0.08,
      });
      const lawnMat = reg.getMat('yard_lawn', {
        color: 0x65a30d,
        roughness: 0.92,
      });

      // Yard pad
      const yard = new THREE.Mesh(
        new THREE.BoxGeometry(1.78, 0.05, 1.78),
        lawnMat,
      );
      yard.position.y = 0.025;
      group.add(yard);

      // Stone plinth
      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(1.22, 0.14, 1.12),
        stoneMat,
      );
      plinth.position.set(0, 0.12, -0.05);
      group.add(plinth);

      // Main house body
      const bodyH = 0.72 * scaleBoost;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.14, bodyH, 1.04),
        wallMat,
      );
      body.position.set(0, 0.19 + bodyH / 2, -0.05);
      group.add(body);

      // Pitched roof (4-sided pyramid rotated 45deg or prism)
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(0.94, 0.56, 4),
        roofMat,
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.set(0, 0.19 + bodyH + 0.27, -0.05);
      group.add(roof);

      // Chimney
      const chimney = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.36, 0.16),
        stoneMat,
      );
      chimney.position.set(0.32, 0.19 + bodyH + 0.22, -0.25);
      group.add(chimney);

      // Front door & porch canopy
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.42, 0.06),
        woodMat,
      );
      door.position.set(0, 0.4, 0.48);
      group.add(door);

      const porch = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.06, 0.26),
        roofMat,
      );
      porch.position.set(0, 0.65, 0.58);
      group.add(porch);

      // Warm glowing windows
      const winPositions = [
        [-0.36, 0.54, 0.48],
        [0.36, 0.54, 0.48],
        [-0.36, 0.54, -0.58],
        [0.36, 0.54, -0.58],
      ];
      winPositions.forEach(([wx, wy, wz]) => {
        const w = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.24, 0.04),
          reg.windowWarm,
        );
        w.position.set(wx, wy, wz);
        group.add(w);
      });

      // Garden hedge & tiny tree
      const hedgeMat = reg.getMat('hedge', { color: 0x15803d, roughness: 0.9 });
      const hedge = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.16, 0.18),
        hedgeMat,
      );
      hedge.position.set(-0.55, 0.13, 0.62);
      group.add(hedge);

      shadowAll(group);
      break;
    }

    case 'apartment': {
      const facadeColors = [0xe2e8f0, 0xfed7aa, 0xcbd5e1];
      const trimColors = [0xd97706, 0x0284c7, 0x475569];
      const wallMat = reg.getMat(`apt_wall_${variant}`, {
        color: facadeColors[variant % 3],
        roughness: 0.78,
        metalness: 0.06,
      });
      const trimMat = reg.getMat(`apt_trim_${variant}`, {
        color: trimColors[variant % 3],
        roughness: 0.55,
        metalness: 0.2,
      });

      // Base courtyard
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.08, 1.8),
        concreteMat,
      );
      base.position.y = 0.04;
      group.add(base);

      // Ground lobby podium
      const lobby = new THREE.Mesh(
        new THREE.BoxGeometry(1.44, 0.45, 1.36),
        stoneMat,
      );
      lobby.position.y = 0.305;
      group.add(lobby);

      // Main tower block (3 or 4 stories)
      const floors = level > 1 ? 4 : 3;
      const towerH = floors * 0.48;
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(1.34, towerH, 1.26),
        wallMat,
      );
      tower.position.y = 0.53 + towerH / 2;
      group.add(tower);

      // Balconies & window bands per floor
      for (let f = 0; f < floors; f++) {
        const fy = 0.76 + f * 0.48;
        // Front balcony slab
        const balc = new THREE.Mesh(
          new THREE.BoxGeometry(1.42, 0.06, 0.22),
          trimMat,
        );
        balc.position.set(0, fy - 0.14, 0.66);
        group.add(balc);

        // Front & back window strips
        for (const zSign of [-1, 1]) {
          for (const xOff of [-0.38, 0, 0.38]) {
            const win = new THREE.Mesh(
              new THREE.BoxGeometry(0.24, 0.24, 0.04),
              reg.windowWarm,
            );
            win.position.set(xOff, fy, zSign * 0.64);
            group.add(win);
          }
        }
      }

      // Rooftop parapet & water/HVAC unit
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.1, 1.32),
        trimMat,
      );
      roof.position.y = 0.53 + towerH + 0.05;
      group.add(roof);

      const hvac = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.22, 0.45),
        darkMetalMat,
      );
      hvac.position.set(-0.25, 0.53 + towerH + 0.2, -0.15);
      group.add(hvac);

      shadowAll(group);
      break;
    }

    case 'shop': {
      const awningColors = [0x0284c7, 0xdc2626, 0x059669];
      const wallMat = reg.getMat('shop_wall', {
        color: 0xf8fafc,
        roughness: 0.8,
        metalness: 0.05,
      });
      const awningMat = reg.getMat(`shop_awning_${variant}`, {
        color: awningColors[variant % 3],
        roughness: 0.72,
        metalness: 0.05,
      });

      const plaza = new THREE.Mesh(
        new THREE.BoxGeometry(1.82, 0.06, 1.82),
        concreteMat,
      );
      plaza.position.y = 0.03;
      group.add(plaza);

      // Main store volume
      const storeH = 0.9 * scaleBoost;
      const store = new THREE.Mesh(
        new THREE.BoxGeometry(1.42, storeH, 1.15),
        wallMat,
      );
      store.position.set(0, 0.06 + storeH / 2, -0.18);
      group.add(store);

      // Glass storefront
      const glassFront = new THREE.Mesh(
        new THREE.BoxGeometry(1.22, 0.5, 0.06),
        reg.windowWarm,
      );
      glassFront.position.set(0, 0.34, 0.4);
      group.add(glassFront);

      // Slanted colorful awning
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(1.36, 0.08, 0.44),
        awningMat,
      );
      awning.rotation.x = 0.28;
      awning.position.set(0, 0.68, 0.55);
      group.add(awning);

      // Rooftop sign board
      const signFrame = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.26, 0.08),
        darkMetalMat,
      );
      signFrame.position.set(0, 0.06 + storeH + 0.16, 0.25);
      group.add(signFrame);

      const signGlow = new THREE.Mesh(
        new THREE.BoxGeometry(0.96, 0.16, 0.1),
        awningMat,
      );
      signGlow.position.set(0, 0.06 + storeH + 0.16, 0.25);
      group.add(signGlow);

      // Outdoor cafe umbrella & table
      const table = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.04, 10),
        woodMat,
      );
      table.position.set(0.42, 0.25, 0.68);
      group.add(table);

      const umbrella = new THREE.Mesh(
        new THREE.ConeGeometry(0.28, 0.14, 8),
        awningMat,
      );
      umbrella.position.set(0.42, 0.55, 0.68);
      group.add(umbrella);

      shadowAll(group);
      break;
    }

    case 'skyscraper': {
      const steelColors = [0x1e293b, 0x334155, 0x0f172a];
      const frameMat = reg.getMat(`sky_frame_${variant}`, {
        color: steelColors[variant % 3],
        roughness: 0.28,
        metalness: 0.85,
      });

      // Plaza base
      const plaza = new THREE.Mesh(
        new THREE.BoxGeometry(1.86, 0.08, 1.86),
        concreteMat,
      );
      plaza.position.y = 0.04;
      group.add(plaza);

      // Grand podium
      const podium = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.65, 1.6),
        frameMat,
      );
      podium.position.y = 0.405;
      group.add(podium);

      // Mid glass core
      const midH = (level > 1 ? 3.2 : 2.55) + (variant % 2) * 0.4;
      const glassCore = new THREE.Mesh(
        new THREE.BoxGeometry(1.24, midH, 1.24),
        reg.windowCool,
      );
      glassCore.position.y = 0.73 + midH / 2;
      group.add(glassCore);

      // Vertical architectural fins
      for (const sx of [-0.63, 0, 0.63]) {
        for (const sz of [-0.63, 0.63]) {
          const fin = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, midH + 0.12, 0.08),
            chromeMat,
          );
          fin.position.set(sx, 0.73 + midH / 2, sz);
          group.add(fin);
        }
      }

      // Setback crown tier
      const crownH = 0.75;
      const crown = new THREE.Mesh(
        new THREE.BoxGeometry(0.86, crownH, 0.86),
        reg.windowCool,
      );
      crown.position.y = 0.73 + midH + crownH / 2;
      group.add(crown);

      const crownCap = new THREE.Mesh(
        new THREE.BoxGeometry(0.94, 0.1, 0.94),
        frameMat,
      );
      crownCap.position.y = 0.73 + midH + crownH + 0.05;
      group.add(crownCap);

      // Spire & aviation beacon
      const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.07, 0.9, 8),
        chromeMat,
      );
      spire.position.y = 0.73 + midH + crownH + 0.5;
      group.add(spire);

      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 8),
        reg.beaconGlow,
      );
      beacon.position.y = 0.73 + midH + crownH + 0.96;
      group.add(beacon);

      shadowAll(group);
      break;
    }

    case 'factory': {
      const brickMat = reg.getMat('factory_brick', {
        color: 0x9a3412,
        roughness: 0.88,
        metalness: 0.04,
      });
      const corrugatedMat = reg.getMat('factory_steel', {
        color: 0x64748b,
        roughness: 0.45,
        metalness: 0.65,
      });

      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(1.84, 0.07, 1.84),
        concreteMat,
      );
      pad.position.y = 0.035;
      group.add(pad);

      // Main hall
      const hall = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 0.85, 1.1),
        brickMat,
      );
      hall.position.set(-0.1, 0.495, 0.15);
      group.add(hall);

      // Sawtooth roof ridges
      for (let i = -1; i <= 1; i++) {
        const ridge = new THREE.Mesh(
          new THREE.ConeGeometry(0.42, 0.34, 4),
          corrugatedMat,
        );
        ridge.rotation.y = Math.PI / 4;
        ridge.position.set(-0.1 + i * 0.42, 1.09, 0.15);
        group.add(ridge);
      }

      // Storage silo
      const silo = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 1.05, 14),
        chromeMat,
      );
      silo.position.set(0.62, 0.59, -0.45);
      group.add(silo);

      // Twin smokestacks
      const smokeOffsets: [number, number, number][] = [];
      for (const sx of [-0.45, -0.05]) {
        const stack = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.14, 1.45 * scaleBoost, 10),
          darkMetalMat,
        );
        const topY = 0.07 + 1.45 * scaleBoost;
        stack.position.set(sx, 0.07 + (1.45 * scaleBoost) / 2, -0.58);
        group.add(stack);

        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(0.1, 0.025, 6, 12),
          brickMat,
        );
        rim.rotation.x = Math.PI / 2;
        rim.position.set(sx, topY, -0.58);
        group.add(rim);

        smokeOffsets.push([sx, topY + 0.06, -0.58]);
      }

      // Factory windows
      for (const wx of [-0.45, -0.1, 0.25]) {
        const win = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.24, 0.04),
          reg.windowWarm,
        );
        win.position.set(wx, 0.54, 0.71);
        group.add(win);
      }

      group.userData.smokeLocalPositions = smokeOffsets;
      shadowAll(group);
      break;
    }

    case 'park': {
      const grassMat = reg.getMat('park_grass', {
        color: 0x4d9a3e,
        roughness: 0.92,
      });
      const pathMat = reg.getMat('park_path', {
        color: 0xe7e5e4,
        roughness: 0.88,
      });
      const waterMat = reg.getMat('fountain_water', {
        color: 0x38bdf8,
        roughness: 0.1,
        metalness: 0.15,
      });
      const foliageMat = reg.getMat('park_foliage', {
        color: 0x16a34a,
        roughness: 0.85,
      });

      const base = new THREE.Mesh(
        new THREE.BoxGeometry(1.88, 0.06, 1.88),
        grassMat,
      );
      base.position.y = 0.03;
      group.add(base);

      // Cross stone paths
      const pathX = new THREE.Mesh(
        new THREE.BoxGeometry(1.84, 0.02, 0.34),
        pathMat,
      );
      pathX.position.y = 0.07;
      group.add(pathX);

      const pathZ = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.02, 1.84),
        pathMat,
      );
      pathZ.position.y = 0.07;
      group.add(pathZ);

      // Central circular fountain basin
      const basin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.5, 0.16, 16),
        stoneMat,
      );
      basin.position.y = 0.14;
      group.add(basin);

      const pool = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.38, 0.04, 16),
        waterMat,
      );
      pool.position.y = 0.21;
      group.add(pool);

      const jet = new THREE.Mesh(
        new THREE.ConeGeometry(0.11, 0.34, 10),
        waterMat,
      );
      jet.position.y = 0.38;
      group.add(jet);
      group.userData.fountainJet = jet;

      // Corner trees + benches
      const treeSpots: [number, number][] = [
        [-0.58, -0.58],
        [0.58, -0.58],
        [-0.58, 0.58],
        [0.58, 0.58],
      ];
      treeSpots.forEach(([tx, tz], i) => {
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.07, 0.32, 6),
          woodMat,
        );
        trunk.position.set(tx, 0.22, tz);
        group.add(trunk);

        const crown = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.24 + (i % 2) * 0.04, 0),
          foliageMat,
        );
        crown.position.set(tx, 0.48, tz);
        group.add(crown);
      });

      // Park lantern
      const lantern = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 8, 8),
        reg.lampGlow,
      );
      lantern.position.set(0.35, 0.38, 0.35);
      group.add(lantern);

      shadowAll(group);
      break;
    }

    case 'forest': {
      const mossMat = reg.getMat('forest_moss', {
        color: 0x3f7d32,
        roughness: 0.95,
      });
      const pineA = reg.getMat('pine_a', { color: 0x166534, roughness: 0.86 });
      const pineB = reg.getMat('pine_b', { color: 0x15803d, roughness: 0.86 });

      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(1.86, 0.04, 1.86),
        mossMat,
      );
      pad.position.y = 0.02;
      group.add(pad);

      const layout: [number, number, number][] = [
        [-0.44, -0.36, 1.05],
        [0.42, -0.42, 0.9],
        [0.02, 0.05, 1.25],
        [-0.48, 0.48, 0.85],
        [0.46, 0.42, 1.0],
      ];

      layout.forEach(([tx, tz, s], idx) => {
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05 * s, 0.08 * s, 0.35 * s, 6),
          woodMat,
        );
        trunk.position.set(tx, 0.04 + 0.175 * s, tz);
        group.add(trunk);

        const cone1 = new THREE.Mesh(
          new THREE.ConeGeometry(0.3 * s, 0.52 * s, 7),
          idx % 2 === 0 ? pineA : pineB,
        );
        cone1.position.set(tx, 0.04 + 0.52 * s, tz);
        group.add(cone1);

        const cone2 = new THREE.Mesh(
          new THREE.ConeGeometry(0.22 * s, 0.42 * s, 7),
          idx % 2 === 0 ? pineB : pineA,
        );
        cone2.position.set(tx, 0.04 + 0.78 * s, tz);
        group.add(cone2);
      });

      shadowAll(group);
      break;
    }

    case 'wind_turbine': {
      const whiteComposite = reg.getMat('turbine_white', {
        color: 0xf8fafc,
        roughness: 0.3,
        metalness: 0.25,
      });

      // Concrete foundation pad
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.58, 0.14, 12),
        concreteMat,
      );
      pad.position.y = 0.07;
      group.add(pad);

      // Tapered mast
      const mastH = 2.45 * scaleBoost;
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.14, mastH, 12),
        whiteComposite,
      );
      mast.position.y = 0.14 + mastH / 2;
      group.add(mast);

      // Nacelle housing
      const nacelle = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.22, 0.46),
        whiteComposite,
      );
      nacelle.position.set(0, 0.14 + mastH, 0.05);
      group.add(nacelle);

      // Rotor hub + 3 aerodynamic blades
      const rotorPivot = new THREE.Group();
      rotorPivot.position.set(0, 0.14 + mastH, 0.3);

      const hub = new THREE.Mesh(
        new THREE.ConeGeometry(0.09, 0.2, 10),
        chromeMat,
      );
      hub.rotation.x = Math.PI / 2;
      rotorPivot.add(hub);

      for (let i = 0; i < 3; i++) {
        const bladeHolder = new THREE.Group();
        bladeHolder.rotation.z = (i * Math.PI * 2) / 3;
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 1.05, 0.02),
          whiteComposite,
        );
        blade.position.y = 0.54;
        blade.rotation.y = 0.18;
        bladeHolder.add(blade);
        rotorPivot.add(bladeHolder);
      }

      group.add(rotorPivot);
      group.userData.rotorPivot = rotorPivot;

      shadowAll(group);
      break;
    }

    case 'water_tower': {
      const tankBlue = reg.getMat('water_tank_blue', {
        color: 0x3b82f6,
        roughness: 0.38,
        metalness: 0.35,
      });

      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.1, 1.5),
        concreteMat,
      );
      pad.position.y = 0.05;
      group.add(pad);

      // 4 angled steel legs
      const legOffsets = [
        [-0.36, -0.36],
        [0.36, -0.36],
        [-0.36, 0.36],
        [0.36, 0.36],
      ];
      legOffsets.forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.055, 0.065, 1.25, 8),
          darkMetalMat,
        );
        leg.position.set(lx * 0.85, 0.72, lz * 0.85);
        group.add(leg);
      });

      // Central riser pipe
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 1.25, 10),
        chromeMat,
      );
      pipe.position.y = 0.72;
      group.add(pipe);

      // Tank cylinder + band + conical cap
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(0.56, 0.56, 0.72, 16),
        tankBlue,
      );
      tank.position.y = 1.62;
      group.add(tank);

      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.58, 0.58, 0.12, 16),
        chromeMat,
      );
      band.position.y = 1.62;
      group.add(band);

      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(0.6, 0.34, 16),
        concreteMat,
      );
      cap.position.y = 2.15;
      group.add(cap);

      shadowAll(group);
      break;
    }

    case 'school': {
      const brickMat = reg.getMat('school_brick', {
        color: 0xd97706,
        roughness: 0.82,
        metalness: 0.05,
      });
      const roofMat = reg.getMat('school_roof', {
        color: 0x334155,
        roughness: 0.6,
        metalness: 0.15,
      });

      const courtyard = new THREE.Mesh(
        new THREE.BoxGeometry(1.86, 0.06, 1.86),
        concreteMat,
      );
      courtyard.position.y = 0.03;
      group.add(courtyard);

      // Main wing + side wing
      const mainWing = new THREE.Mesh(
        new THREE.BoxGeometry(1.56, 0.85, 0.84),
        brickMat,
      );
      mainWing.position.set(0, 0.485, -0.22);
      group.add(mainWing);

      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(1.64, 0.12, 0.92),
        roofMat,
      );
      roof.position.set(0, 0.97, -0.22);
      group.add(roof);

      // Front entrance portico
      const portico = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.64, 0.42),
        concreteMat,
      );
      portico.position.set(0, 0.38, 0.36);
      group.add(portico);

      // Small bell tower on roof
      const cupola = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.4, 0.32),
        concreteMat,
      );
      cupola.position.set(0, 1.23, -0.22);
      group.add(cupola);

      const spire = new THREE.Mesh(
        new THREE.ConeGeometry(0.24, 0.32, 4),
        roofMat,
      );
      spire.rotation.y = Math.PI / 4;
      spire.position.set(0, 1.58, -0.22);
      group.add(spire);

      // Classroom windows
      for (const wx of [-0.5, -0.18, 0.18, 0.5]) {
        const win = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 0.28, 0.04),
          reg.windowWarm,
        );
        win.position.set(wx, 0.62, 0.21);
        group.add(win);
      }

      shadowAll(group);
      break;
    }

    case 'hospital': {
      const whiteMed = reg.getMat('hosp_white', {
        color: 0xf8fafc,
        roughness: 0.55,
        metalness: 0.1,
      });
      const redCrossMat = reg.getMat('hosp_red', {
        color: 0xef4444,
        roughness: 0.35,
        emissive: new THREE.Color(0xdc2626),
        emissiveIntensity: 0.2,
      });

      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(1.88, 0.07, 1.88),
        concreteMat,
      );
      pad.position.y = 0.035;
      group.add(pad);

      // Main clinical block
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 1.38 * scaleBoost, 1.2),
        whiteMed,
      );
      block.position.set(0, 0.07 + (1.38 * scaleBoost) / 2, -0.1);
      group.add(block);

      // Glass ER canopy
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.1, 0.45),
        redCrossMat,
      );
      canopy.position.set(0, 0.55, 0.62);
      group.add(canopy);

      // Glowing Red Cross emblem on facade & helipad H
      const crossV = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.42, 0.05),
        redCrossMat,
      );
      crossV.position.set(0, 1.05, 0.51);
      group.add(crossV);

      const crossH = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.14, 0.05),
        redCrossMat,
      );
      crossH.position.set(0, 1.05, 0.51);
      group.add(crossH);

      // Multi-floor windows
      for (const wy of [0.8, 1.18]) {
        for (const wx of [-0.46, 0.46]) {
          const win = new THREE.Mesh(
            new THREE.BoxGeometry(0.28, 0.22, 0.04),
            reg.windowCool,
          );
          win.position.set(wx, wy, 0.51);
          group.add(win);
        }
      }

      // Helipad ring on roof
      const heli = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.04, 16),
        darkMetalMat,
      );
      heli.position.set(0, 0.07 + 1.38 * scaleBoost + 0.02, -0.1);
      group.add(heli);

      shadowAll(group);
      break;
    }

    case 'clock_tower': {
      const sandstoneMat = reg.getMat('clock_sandstone', {
        color: 0xe7d3b0,
        roughness: 0.78,
        metalness: 0.05,
      });
      const copperRoofMat = reg.getMat('clock_copper', {
        color: 0x0d9488,
        roughness: 0.42,
        metalness: 0.45,
      });
      const goldTrimMat = reg.getMat('clock_gold', {
        color: 0xf59e0b,
        roughness: 0.22,
        metalness: 0.85,
      });

      // Stepped plaza
      const step1 = new THREE.Mesh(
        new THREE.BoxGeometry(1.88, 0.08, 1.88),
        concreteMat,
      );
      step1.position.y = 0.04;
      group.add(step1);

      const step2 = new THREE.Mesh(
        new THREE.BoxGeometry(1.36, 0.1, 1.36),
        stoneMat,
      );
      step2.position.y = 0.13;
      group.add(step2);

      // Pedestal + Tall Shaft
      const ped = new THREE.Mesh(
        new THREE.BoxGeometry(0.92, 0.55, 0.92),
        sandstoneMat,
      );
      ped.position.y = 0.455;
      group.add(ped);

      const shaft = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 1.65, 0.68),
        sandstoneMat,
      );
      shaft.position.y = 1.555;
      group.add(shaft);

      // Clock dial faces on all 4 sides
      const dialOffsets: [number, number, number, number][] = [
        [0, 2.02, 0.35, 0],
        [0, 2.02, -0.35, Math.PI],
        [0.35, 2.02, 0, Math.PI / 2],
        [-0.35, 2.02, 0, -Math.PI / 2],
      ];
      dialOffsets.forEach(([dx, dy, dz, ry]) => {
        const bezel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.22, 0.04, 16),
          goldTrimMat,
        );
        bezel.rotation.x = Math.PI / 2;
        bezel.rotation.z = ry;
        bezel.position.set(dx, dy, dz);
        group.add(bezel);

        const face = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.18, 0.05, 16),
          reg.windowWarm,
        );
        face.rotation.x = Math.PI / 2;
        face.rotation.z = ry;
        face.position.set(dx, dy, dz);
        group.add(face);
      });

      // Copper spire & finial
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(0.56, 0.9, 4),
        copperRoofMat,
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 2.83;
      group.add(roof);

      const finial = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 10, 10),
        goldTrimMat,
      );
      finial.position.y = 3.32;
      group.add(finial);

      shadowAll(group);
      break;
    }
  }

  return group;
}

export function createVehicleMesh(colorHex: number): THREE.Group {
  const car = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.25,
    metalness: 0.65,
  });
  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.2,
    metalness: 0.2,
  });
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.9,
    metalness: 0.05,
  });
  const headLightMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: new THREE.Color(0xfef08a),
    emissiveIntensity: 0.9,
  });

  // Chassis
  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.1, 0.44),
    bodyMat,
  );
  chassis.position.y = 0.09;
  car.add(chassis);

  // Cabin
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.09, 0.24),
    cabinMat,
  );
  cabin.position.set(0, 0.17, -0.02);
  car.add(cabin);

  // 4 wheels
  const wheelGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelSpots = [
    [-0.12, 0.045, 0.13],
    [0.12, 0.045, 0.13],
    [-0.12, 0.045, -0.13],
    [0.12, 0.045, -0.13],
  ];
  wheelSpots.forEach(([wx, wy, wz]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, wy, wz);
    car.add(w);
  });

  // Headlights
  for (const hx of [-0.07, 0.07]) {
    const hl = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.035, 0.02),
      headLightMat,
    );
    hl.position.set(hx, 0.09, 0.225);
    car.add(hl);
  }

  return car;
}
