import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BuildingMaterialsRegistry,
  createBuildingMaterials,
  createBuildingMesh,
  createVehicleMesh,
} from '../game/buildings';
import { getRoadNeighbors, inBounds } from '../game/simulation';
import { createProceduralTextures, ProceduralTextureSet } from '../game/textures';
import {
  BUILDING_CATALOG,
  BuildingType,
  CELL_SIZE,
  CityGrid,
  GRID_SIZE,
  PlacedBuilding,
  SimSpeed,
  TimeOfDay,
  ToolId,
} from '../game/types';

export interface CityViewportHandle {
  resetCamera: () => void;
  zoomBy: (factor: number) => void;
  captureScreenshot: () => string | null;
}

interface CityViewportProps {
  grid: CityGrid;
  activeTool: ToolId;
  rotation: number;
  timeOfDay: TimeOfDay;
  simSpeed: SimSpeed;
  selectedCell: { gx: number; gz: number } | null;
  canAffordTool: (tool: ToolId) => boolean;
  onPlaceOrAct: (gx: number, gz: number) => void;
  onSelectCell: (cell: { gx: number; gz: number } | null) => void;
  viewportRef: React.RefObject<CityViewportHandle | null>;
}

const HALF_BOARD = (GRID_SIZE * CELL_SIZE) / 2; // 20

function gridToWorld(gx: number, gz: number): [number, number] {
  const x = (gx - GRID_SIZE / 2 + 0.5) * CELL_SIZE;
  const z = (gz - GRID_SIZE / 2 + 0.5) * CELL_SIZE;
  return [x, z];
}

function worldToGrid(wx: number, wz: number): { gx: number; gz: number } | null {
  const gx = Math.floor(wx / CELL_SIZE + GRID_SIZE / 2);
  const gz = Math.floor(wz / CELL_SIZE + GRID_SIZE / 2);
  if (!inBounds(gx, gz)) return null;
  return { gx, gz };
}

interface VehicleAgent {
  mesh: THREE.Group;
  gx: number;
  gz: number;
  fromDir: number; // 0=N,1=E,2=S,3=W (dir we came from)
  targetGx: number;
  targetGz: number;
  dir: number; // current heading 0=N(-Z),1=E(+X),2=S(+Z),3=W(-X)
  progress: number;
  speed: number;
  yaw: number;
}

interface SmokeParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
}

interface BurstParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
}

const DIR_DELTAS: [number, number][] = [
  [0, -1], // N
  [1, 0],  // E
  [0, 1],  // S
  [-1, 0], // W
];

const DIR_YAWS = [Math.PI, Math.PI / 2, 0, -Math.PI / 2];

const LIGHTING_PRESETS: Record<
  TimeOfDay,
  {
    sky: number;
    sunColor: number;
    sunIntensity: number;
    sunPos: [number, number, number];
    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
    nightFactor: number;
    sunsetFactor: number;
  }
> = {
  day: {
    sky: 0xbae6fd,
    sunColor: 0xfff7ed,
    sunIntensity: 2.1,
    sunPos: [26, 36, 22],
    hemiSky: 0x93c5fd,
    hemiGround: 0x365314,
    hemiIntensity: 0.75,
    nightFactor: 0,
    sunsetFactor: 0,
  },
  sunset: {
    sky: 0xfdba74,
    sunColor: 0xfb923c,
    sunIntensity: 1.75,
    sunPos: [-32, 14, 24],
    hemiSky: 0xfed7aa,
    hemiGround: 0x3b2f2f,
    hemiIntensity: 0.65,
    nightFactor: 0.25,
    sunsetFactor: 1,
  },
  night: {
    sky: 0x0f172a,
    sunColor: 0x93c5fd,
    sunIntensity: 0.55,
    sunPos: [-20, 28, -18],
    hemiSky: 0x1e293b,
    hemiGround: 0x0f172a,
    hemiIntensity: 0.45,
    nightFactor: 1,
    sunsetFactor: 0,
  },
};

export const CityViewport: React.FC<CityViewportProps> = ({
  grid,
  activeTool,
  rotation,
  timeOfDay,
  simSpeed,
  selectedCell,
  canAffordTool,
  onPlaceOrAct,
  onSelectCell,
  viewportRef,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);

  // Keep fresh props in refs so WebGL scene never tears down on React state changes
  const propsRef = useRef({
    grid,
    activeTool,
    rotation,
    timeOfDay,
    simSpeed,
    selectedCell,
    canAffordTool,
    onPlaceOrAct,
    onSelectCell,
  });
  propsRef.current = {
    grid,
    activeTool,
    rotation,
    timeOfDay,
    simSpeed,
    selectedCell,
    canAffordTool,
    onPlaceOrAct,
    onSelectCell,
  };

  const sceneRefs = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    buildingsGroup: THREE.Group;
    buildingMeshes: Map<string, { mesh: THREE.Group; key: string; spawnTime: number }>;
    materials: BuildingMaterialsRegistry;
    rebuildGhost: () => void;
    syncGridMeshes: () => void;
    spawnBurst: (wx: number, wz: number, colorHex: number) => void;
  } | null>(null);

  useImperativeHandle(viewportRef, () => ({
    resetCamera: () => {
      const refs = sceneRefs.current;
      if (!refs) return;
      refs.camera.position.set(28, 25, 28);
      refs.controls.target.set(0, 0, 0);
      refs.controls.update();
    },
    zoomBy: (factor: number) => {
      const refs = sceneRefs.current;
      if (!refs) return;
      const offset = refs.camera.position.clone().sub(refs.controls.target);
      offset.multiplyScalar(factor);
      const len = offset.length();
      if (len >= 12 && len <= 75) {
        refs.camera.position.copy(refs.controls.target).add(offset);
        refs.controls.update();
      }
    },
    captureScreenshot: () => {
      const refs = sceneRefs.current;
      if (!refs) return null;
      refs.renderer.render(refs.scene, refs.camera);
      return refs.renderer.domElement.toDataURL('image/png');
    },
  }));

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software WebGL detection (SwiftShader / llvmpipe / WARP)
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    const initialPreset = LIGHTING_PRESETS[propsRef.current.timeOfDay];
    const skyColor = new THREE.Color(initialPreset.sky);
    scene.background = skyColor;
    scene.fog = new THREE.FogExp2(initialPreset.sky, 0.0085);

    // Studio PMREM environment map for metallic & glass reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.5, 280);
    camera.position.set(28, 25, 28);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2.25;
    controls.minPolarAngle = 0.22;
    controls.minDistance = 12;
    controls.maxDistance = 72;
    controls.screenSpacePanning = false;
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    controls.target.set(0, 0, 0);

    // 3-Point Outdoor Lighting Rig
    const hemiLight = new THREE.HemisphereLight(
      initialPreset.hemiSky,
      initialPreset.hemiGround,
      initialPreset.hemiIntensity,
    );
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(
      initialPreset.sunColor,
      initialPreset.sunIntensity,
    );
    sunLight.position.set(...initialPreset.sunPos);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 4;
    sunLight.shadow.camera.far = 95;
    const d = 26;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.35);
    rimLight.position.set(-22, 16, -24);
    scene.add(rimLight);

    // Procedural Textures & Building Materials
    const textures: ProceduralTextureSet = createProceduralTextures(
      renderer.capabilities.getMaxAnisotropy(),
    );
    const materials = createBuildingMaterials(textures);

    // Island Base & Natural Bay Surroundings
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // Top lush green turf (40x40 buildable area + 2 unit beach rim)
    const grassMat = new THREE.MeshStandardMaterial({
      map: textures.grassMap,
      roughness: 0.92,
      metalness: 0.02,
    });
    const islandTop = new THREE.Mesh(
      new THREE.BoxGeometry(HALF_BOARD * 2, 0.6, HALF_BOARD * 2),
      grassMat,
    );
    islandTop.position.y = -0.3;
    islandTop.receiveShadow = true;
    worldGroup.add(islandTop);

    // Sandy coastal rim & earth cliff skirt
    const sandMat = new THREE.MeshStandardMaterial({
      color: 0xe7d3a7,
      roughness: 0.9,
    });
    const sandRim = new THREE.Mesh(
      new THREE.BoxGeometry(HALF_BOARD * 2 + 2.4, 0.55, HALF_BOARD * 2 + 2.4),
      sandMat,
    );
    sandRim.position.y = -0.58;
    sandRim.receiveShadow = true;
    worldGroup.add(sandRim);

    const cliffMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.95,
    });
    const cliffSkirt = new THREE.Mesh(
      new THREE.BoxGeometry(HALF_BOARD * 2 + 4.2, 2.2, HALF_BOARD * 2 + 4.2),
      cliffMat,
    );
    cliffSkirt.position.y = -1.95;
    worldGroup.add(cliffSkirt);

    // Expansive Ocean Plane
    const waterMat = new THREE.MeshStandardMaterial({
      map: textures.waterMap,
      color: 0x2589bd,
      roughness: 0.18,
      metalness: 0.25,
    });
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), waterMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.78;
    ocean.receiveShadow = true;
    worldGroup.add(ocean);

    // Distant perimeter islands / coastal outcrops so horizon feels alive
    const distantRocksGroup = new THREE.Group();
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.92,
      flatShading: true,
    });
    const pineCanopyMat = new THREE.MeshStandardMaterial({
      color: 0x166534,
      roughness: 0.88,
      flatShading: true,
    });

    const isletCoords: [number, number, number][] = [
      [-34, -26, 4.5],
      [36, -24, 5.2],
      [-36, 30, 4.8],
      [34, 32, 4.0],
      [0, -42, 6.5],
      [-46, 2, 5.8],
      [48, -4, 6.0],
    ];
    isletCoords.forEach(([ix, iz, scale], idx) => {
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(ix, -0.5, iz);
      rock.scale.set(scale * 1.4, scale * 0.65, scale * 1.1);
      rock.rotation.y = idx * 0.9;
      distantRocksGroup.add(rock);

      const hill = new THREE.Mesh(
        new THREE.ConeGeometry(scale * 0.85, scale * 1.1, 6),
        pineCanopyMat,
      );
      hill.position.set(ix, scale * 0.25, iz);
      distantRocksGroup.add(hill);
    });
    worldGroup.add(distantRocksGroup);

    // Stylized drifting clouds
    const clouds: { group: THREE.Group; speed: number }[] = [];
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      transparent: true,
      opacity: 0.86,
    });
    const puffGeo = new THREE.DodecahedronGeometry(1, 1);
    for (let i = 0; i < 8; i++) {
      const cg = new THREE.Group();
      for (let p = 0; p < 3; p++) {
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set((p - 1) * 1.4, p === 1 ? 0.35 : 0, (p % 2) * 0.4);
        puff.scale.set(1.5 + (p === 1 ? 0.5 : 0), 0.75, 1.1);
        cg.add(puff);
      }
      cg.position.set(
        (Math.random() - 0.5) * 90,
        17 + Math.random() * 6,
        (Math.random() - 0.5) * 90,
      );
      scene.add(cg);
      clouds.push({ group: cg, speed: 0.45 + Math.random() * 0.4 });
    }

    // Subtle Grid Lines overlay (very clean, faint architectural ticks)
    const gridHelper = new THREE.GridHelper(
      HALF_BOARD * 2,
      GRID_SIZE,
      0xffffff,
      0xffffff,
    );
    gridHelper.position.y = 0.015;
    const gridMat = gridHelper.material as THREE.Material;
    gridMat.transparent = true;
    gridMat.opacity = 0.14;
    scene.add(gridHelper);

    // Invisible Ground Raycast Plane
    const rayPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF_BOARD * 2, HALF_BOARD * 2),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    rayPlane.rotation.x = -Math.PI / 2;
    rayPlane.position.y = 0;
    scene.add(rayPlane);

    // Selection & Hover Ring Indicators
    const hoverTileMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(CELL_SIZE - 0.08, CELL_SIZE - 0.08),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    hoverTileMesh.rotation.x = -Math.PI / 2;
    hoverTileMesh.position.y = 0.03;
    hoverTileMesh.visible = false;
    scene.add(hoverTileMesh);

    const selectedRing = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 0.98, 4),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    selectedRing.rotation.x = -Math.PI / 2;
    selectedRing.rotation.z = Math.PI / 4;
    selectedRing.position.y = 0.08;
    selectedRing.visible = false;
    scene.add(selectedRing);

    // Ghost Preview Container
    const ghostGroup = new THREE.Group();
    ghostGroup.visible = false;
    scene.add(ghostGroup);

    const ghostValidMat = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const ghostInvalidMat = new THREE.MeshStandardMaterial({
      color: 0xf87171,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });

    let currentGhostSignature = '';
    const rebuildGhost = () => {
      const { activeTool: tool, rotation: rot } = propsRef.current;
      const sig = `${tool}_${rot}`;
      if (sig === currentGhostSignature) return;
      currentGhostSignature = sig;

      while (ghostGroup.children.length > 0) {
        ghostGroup.remove(ghostGroup.children[0]);
      }

      if (tool === 'inspect' || tool === 'demolish') {
        return;
      }

      const preview = createBuildingMesh(
        tool as BuildingType,
        0,
        1,
        materials,
        tool === 'road' ? 5 : 0,
      );
      preview.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          const m = c as THREE.Mesh;
          m.material = ghostValidMat;
          m.castShadow = false;
          m.receiveShadow = false;
        }
      });
      preview.rotation.y = (rot * Math.PI) / 2;
      ghostGroup.add(preview);
    };

    // Buildings Container & Sync
    const buildingsGroup = new THREE.Group();
    scene.add(buildingsGroup);
    const buildingMeshes = new Map<
      string,
      { mesh: THREE.Group; key: string; spawnTime: number }
    >();

    // Vehicles & Particles
    const vehiclesGroup = new THREE.Group();
    scene.add(vehiclesGroup);
    const vehicles: VehicleAgent[] = [];
    const carPalette = [0xef4444, 0x3b82f6, 0xf59e0b, 0x10b981, 0xf8fafc, 0x8b5cf6];

    const particlesGroup = new THREE.Group();
    scene.add(particlesGroup);
    const smokeParticles: SmokeParticle[] = [];
    const burstParticles: BurstParticle[] = [];
    const smokeGeo = new THREE.DodecahedronGeometry(0.14, 0);
    const smokeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.95,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const burstGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);

    function spawnBurst(wx: number, wz: number, colorHex: number) {
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.9,
      });
      for (let i = 0; i < 10; i++) {
        const m = new THREE.Mesh(burstGeo, mat);
        m.position.set(wx, 0.35, wz);
        particlesGroup.add(m);
        const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
        const speed = 1.4 + Math.random() * 2.2;
        burstParticles.push({
          mesh: m,
          vx: Math.cos(angle) * speed,
          vy: 2.2 + Math.random() * 2.4,
          vz: Math.sin(angle) * speed,
          age: 0,
          maxAge: 0.55 + Math.random() * 0.2,
        });
      }
    }

    const syncGridMeshes = () => {
      const { grid: currentGrid } = propsRef.current;
      const seenIds = new Set<string>();
      const roadCells: { gx: number; gz: number }[] = [];

      for (let gz = 0; gz < GRID_SIZE; gz++) {
        for (let gx = 0; gx < GRID_SIZE; gx++) {
          const cell = currentGrid[gz][gx];
          if (!cell) continue;

          let roadMask = 0;
          if (cell.type === 'road') {
            roadMask = getRoadNeighbors(currentGrid, gx, gz).mask;
            roadCells.push({ gx, gz });
          }

          const cellKey = `${cell.id}_${cell.type}_${cell.rotation}_${cell.level}_${roadMask}`;
          seenIds.add(cell.id);

          const existing = buildingMeshes.get(cell.id);
          if (existing && existing.key === cellKey) {
            continue;
          }

          if (existing) {
            buildingsGroup.remove(existing.mesh);
            buildingMeshes.delete(cell.id);
          }

          const mesh = createBuildingMesh(
            cell.type,
            cell.variant,
            cell.level,
            materials,
            roadMask,
          );
          const [wx, wz] = gridToWorld(gx, gz);
          mesh.position.set(wx, 0, wz);
          mesh.rotation.y = cell.type === 'road' ? 0 : (cell.rotation * Math.PI) / 2;

          // Pop-in animation for newly placed structures
          const isNew = cell.placedAt > 0 && Date.now() - cell.placedAt < 1000;
          if (isNew) {
            mesh.scale.set(0.2, 0.2, 0.2);
          }

          buildingsGroup.add(mesh);
          buildingMeshes.set(cell.id, {
            mesh,
            key: cellKey,
            spawnTime: isNew ? performance.now() : 0,
          });
        }
      }

      // Remove demolished meshes
      for (const [id, entry] of buildingMeshes.entries()) {
        if (!seenIds.has(id)) {
          buildingsGroup.remove(entry.mesh);
          buildingMeshes.delete(id);
        }
      }

      // Maintain dynamic traffic vehicle pool proportional to road count
      const desiredCars = Math.min(18, Math.floor(roadCells.length / 3));
      while (vehicles.length > desiredCars) {
        const v = vehicles.pop()!;
        vehiclesGroup.remove(v.mesh);
      }
      while (vehicles.length < desiredCars && roadCells.length >= 2) {
        const start = roadCells[Math.floor(Math.random() * roadCells.length)];
        const carMesh = createVehicleMesh(
          carPalette[vehicles.length % carPalette.length],
        );
        const [wx, wz] = gridToWorld(start.gx, start.gz);
        carMesh.position.set(wx, 0.06, wz);
        vehiclesGroup.add(carMesh);
        vehicles.push({
          mesh: carMesh,
          gx: start.gx,
          gz: start.gz,
          fromDir: -1,
          targetGx: start.gx,
          targetGz: start.gz,
          dir: 0,
          progress: 1,
          speed: 1.4 + Math.random() * 0.7,
          yaw: 0,
        });
      }
    };

    sceneRefs.current = {
      renderer,
      scene,
      camera,
      controls,
      buildingsGroup,
      buildingMeshes,
      materials,
      rebuildGhost,
      syncGridMeshes,
      spawnBurst,
    };

    // Initial build
    syncGridMeshes();
    rebuildGhost();

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting & Pointer Interaction
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hoveredCell: { gx: number; gz: number } | null = null;
    let pointerDownPos = { x: 0, y: 0 };
    let isDraggingPaint = false;
    let lastPaintedKey = '';

    const updatePointerAndRaycast = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(rayPlane);
      if (hits.length > 0) {
        const pt = hits[0].point;
        hoveredCell = worldToGrid(pt.x, pt.z);
      } else {
        hoveredCell = null;
      }
    };

    const isDraggableTool = (tool: ToolId) =>
      tool === 'road' || tool === 'forest' || tool === 'demolish';

    const activePointers = new Set<number>();
    let multiTouchActive = false;

    const onPointerDown = (e: PointerEvent) => {
      activePointers.add(e.pointerId);
      if (activePointers.size >= 2) {
        multiTouchActive = true;
        if (isDraggingPaint) {
          isDraggingPaint = false;
          lastPaintedKey = '';
          controls.enabled = true;
        }
        return;
      }

      if (e.pointerType === 'mouse' && e.button !== 0) return;
      multiTouchActive = false;
      pointerDownPos = { x: e.clientX, y: e.clientY };
      updatePointerAndRaycast(e.clientX, e.clientY);

      const { activeTool: tool } = propsRef.current;
      if (isDraggableTool(tool) && hoveredCell) {
        controls.enabled = false;
        isDraggingPaint = true;
        lastPaintedKey = `${hoveredCell.gx},${hoveredCell.gz}`;
        propsRef.current.onPlaceOrAct(hoveredCell.gx, hoveredCell.gz);
      }
    };

    let lastHoverTime = 0;
    const onPointerMove = (e: PointerEvent) => {
      if (multiTouchActive || activePointers.size >= 2) return;
      const now = performance.now();
      if (!isDraggingPaint && now - lastHoverTime < 24) return;
      lastHoverTime = now;

      updatePointerAndRaycast(e.clientX, e.clientY);

      if (isDraggingPaint && hoveredCell) {
        const key = `${hoveredCell.gx},${hoveredCell.gz}`;
        if (key !== lastPaintedKey) {
          lastPaintedKey = key;
          propsRef.current.onPlaceOrAct(hoveredCell.gx, hoveredCell.gz);
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      if (isDraggingPaint) {
        isDraggingPaint = false;
        lastPaintedKey = '';
        controls.enabled = true;
        if (activePointers.size === 0) multiTouchActive = false;
        return;
      }

      if (multiTouchActive) {
        if (activePointers.size === 0) multiTouchActive = false;
        return;
      }

      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      const tapThreshold = e.pointerType === 'touch' ? 12 : 6;
      if (Math.hypot(dx, dy) < tapThreshold) {
        updatePointerAndRaycast(e.clientX, e.clientY);
        if (hoveredCell) {
          if (propsRef.current.activeTool === 'inspect') {
            propsRef.current.onSelectCell(hoveredCell);
          } else {
            propsRef.current.onPlaceOrAct(hoveredCell.gx, hoveredCell.gz);
          }
        } else if (propsRef.current.activeTool === 'inspect') {
          propsRef.current.onSelectCell(null);
        }
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      if (isDraggingPaint) {
        isDraggingPaint = false;
        lastPaintedKey = '';
        controls.enabled = true;
      }
      if (activePointers.size === 0) multiTouchActive = false;
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

    // Keyboard WASD / Arrow camera pan
    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      keys[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Resize handling
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Reusable temp vectors outside render loop (Zero GC)
    const _fwd = new THREE.Vector3();
    const _right = new THREE.Vector3();
    const _targetSky = new THREE.Color();
    const _targetSun = new THREE.Color();
    const _targetHemiSky = new THREE.Color();
    const _targetHemiGround = new THREE.Color();
    const _sunTargetPos = new THREE.Vector3();
    const _worldSmokePos = new THREE.Vector3();

    let currentNightFactor = initialPreset.nightFactor;
    let currentSunsetFactor = initialPreset.sunsetFactor;
    let smokeTimer = 0;

    // Software WebGL loop pacing via afterDraw
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const clock = new THREE.Clock();

    function tick() {
      if (disposed) return;

      const rawDt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.elapsedTime;
      const {
        grid: currentGrid,
        activeTool: tool,
        timeOfDay: tod,
        simSpeed: speed,
        selectedCell: selCell,
        canAffordTool: canAfford,
      } = propsRef.current;

      const simDt = rawDt * (speed === 0 ? 0 : speed === 2 ? 1.85 : 1.0);

      // 1. Camera WASD / Arrow panning
      const panSpeed = 18 * rawDt;
      camera.getWorldDirection(_fwd);
      _fwd.y = 0;
      if (_fwd.lengthSq() > 0.001) _fwd.normalize();
      _right.set(-_fwd.z, 0, _fwd.x);

      let panX = 0;
      let panZ = 0;
      if (keys['KeyW'] || keys['ArrowUp']) {
        panX += _fwd.x * panSpeed;
        panZ += _fwd.z * panSpeed;
      }
      if (keys['KeyS'] || keys['ArrowDown']) {
        panX -= _fwd.x * panSpeed;
        panZ -= _fwd.z * panSpeed;
      }
      if (keys['KeyD'] || keys['ArrowRight']) {
        panX += _right.x * panSpeed;
        panZ += _right.z * panSpeed;
      }
      if (keys['KeyA'] || keys['ArrowLeft']) {
        panX -= _right.x * panSpeed;
        panZ -= _right.z * panSpeed;
      }
      if (panX !== 0 || panZ !== 0) {
        const nextX = THREE.MathUtils.clamp(controls.target.x + panX, -22, 22);
        const nextZ = THREE.MathUtils.clamp(controls.target.z + panZ, -22, 22);
        const dx = nextX - controls.target.x;
        const dz = nextZ - controls.target.z;
        controls.target.x = nextX;
        controls.target.z = nextZ;
        camera.position.x += dx;
        camera.position.z += dz;
      }

      controls.update();

      // 2. Smooth Day / Sunset / Night Lighting Interpolation
      const preset = LIGHTING_PRESETS[tod];
      const dampLambda = 3.2;
      const alpha = 1 - Math.exp(-dampLambda * rawDt);

      _targetSky.setHex(preset.sky);
      (scene.background as THREE.Color).lerp(_targetSky, alpha);
      if (scene.fog) {
        (scene.fog as THREE.FogExp2).color.lerp(_targetSky, alpha);
      }

      _targetSun.setHex(preset.sunColor);
      sunLight.color.lerp(_targetSun, alpha);
      sunLight.intensity = THREE.MathUtils.lerp(
        sunLight.intensity,
        preset.sunIntensity,
        alpha,
      );
      _sunTargetPos.set(...preset.sunPos);
      sunLight.position.lerp(_sunTargetPos, alpha);

      _targetHemiSky.setHex(preset.hemiSky);
      _targetHemiGround.setHex(preset.hemiGround);
      hemiLight.color.lerp(_targetHemiSky, alpha);
      hemiLight.groundColor.lerp(_targetHemiGround, alpha);
      hemiLight.intensity = THREE.MathUtils.lerp(
        hemiLight.intensity,
        preset.hemiIntensity,
        alpha,
      );

      currentNightFactor = THREE.MathUtils.lerp(
        currentNightFactor,
        preset.nightFactor,
        alpha,
      );
      currentSunsetFactor = THREE.MathUtils.lerp(
        currentSunsetFactor,
        preset.sunsetFactor,
        alpha,
      );
      materials.setNightFactor(currentNightFactor, currentSunsetFactor);

      // 3. Ocean shimmer & Clouds drift
      textures.waterMap.offset.x = (elapsed * 0.015) % 1;
      textures.waterMap.offset.y = (elapsed * 0.008) % 1;

      for (const c of clouds) {
        c.group.position.x += c.speed * rawDt;
        if (c.group.position.x > 55) c.group.position.x = -55;
      }

      // 4. Hover Ghost & Selection Indicator
      if (hoveredCell) {
        const [wx, wz] = gridToWorld(hoveredCell.gx, hoveredCell.gz);
        hoverTileMesh.visible = true;
        hoverTileMesh.position.set(wx, 0.03, wz);

        const existing = currentGrid[hoveredCell.gz][hoveredCell.gx];
        const hoverMat = hoverTileMesh.material as THREE.MeshBasicMaterial;

        if (tool === 'demolish') {
          hoverMat.color.setHex(existing ? 0xef4444 : 0x94a3b8);
          ghostGroup.visible = false;
        } else if (tool === 'inspect') {
          hoverMat.color.setHex(0x38bdf8);
          ghostGroup.visible = false;
        } else {
          const valid = !existing && canAfford(tool);
          hoverMat.color.setHex(valid ? 0x34d399 : 0xef4444);
          rebuildGhost();
          ghostGroup.visible = true;
          ghostGroup.position.set(wx, 0, wz);
          const targetMat = valid ? ghostValidMat : ghostInvalidMat;
          ghostGroup.traverse((c) => {
            if ((c as THREE.Mesh).isMesh) {
              (c as THREE.Mesh).material = targetMat;
            }
          });
        }
      } else {
        hoverTileMesh.visible = false;
        ghostGroup.visible = false;
      }

      if (selCell && currentGrid[selCell.gz]?.[selCell.gx]) {
        const [sx, sz] = gridToWorld(selCell.gx, selCell.gz);
        selectedRing.visible = true;
        selectedRing.position.set(sx, 0.08, sz);
        const pulse = 1 + Math.sin(elapsed * 4) * 0.04;
        selectedRing.scale.set(pulse, pulse, 1);
      } else {
        selectedRing.visible = false;
      }

      // 5. Building Animations (Pop-in, Wind Turbines, Fountains, Factory Smoke)
      const nowPerf = performance.now();
      smokeTimer += simDt;
      const emitSmokeNow = smokeTimer >= 0.38;
      if (emitSmokeNow) smokeTimer = 0;

      for (const entry of buildingMeshes.values()) {
        const m = entry.mesh;
        if (entry.spawnTime > 0) {
          const t = Math.min(1, (nowPerf - entry.spawnTime) / 280);
          // Spring overshoot curve
          const s =
            t >= 1
              ? 1
              : 1 - Math.pow(1 - t, 3) * Math.cos(t * Math.PI * 1.4);
          m.scale.setScalar(Math.max(0.2, s));
          if (t >= 1) {
            m.scale.set(1, 1, 1);
            entry.spawnTime = 0;
          }
        }

        if (simDt > 0) {
          const rotor = m.userData.rotorPivot as THREE.Object3D | undefined;
          if (rotor) {
            rotor.rotation.z -= simDt * 2.4;
          }

          const jet = m.userData.fountainJet as THREE.Object3D | undefined;
          if (jet) {
            const s = 0.85 + Math.sin(elapsed * 5.2 + m.position.x) * 0.2;
            jet.scale.set(1, s, 1);
          }

          const smokeOffsets = m.userData.smokeLocalPositions as
            | [number, number, number][]
            | undefined;
          if (emitSmokeNow && smokeOffsets && smokeParticles.length < 36) {
            const pick = smokeOffsets[Math.floor(Math.random() * smokeOffsets.length)];
            _worldSmokePos.set(pick[0], pick[1], pick[2]).applyMatrix4(m.matrixWorld);
            const puff = new THREE.Mesh(smokeGeo, smokeMat);
            puff.position.copy(_worldSmokePos);
            puff.scale.setScalar(0.5);
            particlesGroup.add(puff);
            smokeParticles.push({
              mesh: puff,
              vx: (Math.random() - 0.3) * 0.28,
              vy: 0.75 + Math.random() * 0.25,
              vz: (Math.random() - 0.5) * 0.2,
              age: 0,
              maxAge: 2.1,
            });
          }
        }
      }

      // 6. Update Smoke & Burst Particles
      for (let i = smokeParticles.length - 1; i >= 0; i--) {
        const p = smokeParticles[i];
        p.age += simDt > 0 ? simDt : rawDt * 0.2;
        if (p.age >= p.maxAge) {
          particlesGroup.remove(p.mesh);
          smokeParticles.splice(i, 1);
          continue;
        }
        const t = p.age / p.maxAge;
        const step = simDt > 0 ? simDt : rawDt * 0.2;
        p.mesh.position.x += p.vx * step;
        p.mesh.position.y += p.vy * step;
        p.mesh.position.z += p.vz * step;
        const sc = 0.5 + t * 1.4;
        p.mesh.scale.setScalar(sc);
      }

      for (let i = burstParticles.length - 1; i >= 0; i--) {
        const p = burstParticles[i];
        p.age += rawDt;
        if (p.age >= p.maxAge) {
          particlesGroup.remove(p.mesh);
          burstParticles.splice(i, 1);
          continue;
        }
        p.vy -= 9.8 * rawDt;
        p.mesh.position.x += p.vx * rawDt;
        p.mesh.position.y = Math.max(0.05, p.mesh.position.y + p.vy * rawDt);
        p.mesh.position.z += p.vz * rawDt;
        p.mesh.rotation.x += rawDt * 5;
        p.mesh.rotation.y += rawDt * 4;
        const scale = 1 - p.age / p.maxAge;
        p.mesh.scale.setScalar(Math.max(0.05, scale));
      }

      // 7. Update Live Vehicle Traffic along Road Network
      if (simDt > 0) {
        for (const car of vehicles) {
          car.progress += simDt * car.speed;
          if (car.progress >= 1) {
            car.gx = car.targetGx;
            car.gz = car.targetGz;
            car.progress = 0;

            // If road was demolished under car, relocate to any valid road
            if (currentGrid[car.gz]?.[car.gx]?.type !== 'road') {
              let found = false;
              for (let z = 0; z < GRID_SIZE && !found; z++) {
                for (let x = 0; x < GRID_SIZE && !found; x++) {
                  if (currentGrid[z][x]?.type === 'road') {
                    car.gx = x;
                    car.gz = z;
                    car.targetGx = x;
                    car.targetGz = z;
                    found = true;
                  }
                }
              }
            }

            // Find connected road neighbors
            const options: number[] = [];
            for (let dIdx = 0; dIdx < 4; dIdx++) {
              const [dx, dz] = DIR_DELTAS[dIdx];
              const nx = car.gx + dx;
              const nz = car.gz + dz;
              if (inBounds(nx, nz) && currentGrid[nz][nx]?.type === 'road') {
                options.push(dIdx);
              }
            }

            if (options.length > 0) {
              const reverseDir = (car.dir + 2) % 4;
              const nonReverse = options.filter((dIdx) => dIdx !== reverseDir);
              const pool = nonReverse.length > 0 ? nonReverse : options;
              const chosen = pool[Math.floor(Math.random() * pool.length)];
              car.dir = chosen;
              car.targetGx = car.gx + DIR_DELTAS[chosen][0];
              car.targetGz = car.gz + DIR_DELTAS[chosen][1];
            } else {
              car.targetGx = car.gx;
              car.targetGz = car.gz;
            }
          }

          const [sx, sz] = gridToWorld(car.gx, car.gz);
          const [tx, tz] = gridToWorld(car.targetGx, car.targetGz);
          const lx = THREE.MathUtils.lerp(sx, tx, car.progress);
          const lz = THREE.MathUtils.lerp(sz, tz, car.progress);

          // Right-hand lane offset perpendicular to heading
          const [dx, dz] = DIR_DELTAS[car.dir];
          const laneRightX = -dz * 0.22;
          const laneRightZ = dx * 0.22;

          car.mesh.position.set(lx + laneRightX, 0.06, lz + laneRightZ);
          const targetYaw = DIR_YAWS[car.dir];
          // Shortest angular lerp
          let diff = targetYaw - car.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          car.yaw += diff * Math.min(1, simDt * 12);
          car.mesh.rotation.y = car.yaw;
        }
      }

      // Beacon blink
      materials.beaconGlow.emissiveIntensity =
        0.5 + Math.max(0, Math.sin(elapsed * 4.5)) * 1.4;

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);

      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', handleResize);

      controls.dispose();
      materials.dispose();
      textures.dispose();
      envRT.dispose();
      renderer.dispose();

      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      sceneRefs.current = null;
    };
  }, []);

  // Sync grid changes without recreating WebGL scene
  const prevGridRef = useRef<CityGrid | null>(null);
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;

    // Detect newly placed or removed cell for burst particles
    const prev = prevGridRef.current;
    if (prev) {
      for (let gz = 0; gz < GRID_SIZE; gz++) {
        for (let gx = 0; gx < GRID_SIZE; gx++) {
          const oldCell = prev[gz][gx];
          const newCell = grid[gz][gx];
          if (!oldCell && newCell) {
            const [wx, wz] = gridToWorld(gx, gz);
            const hex = parseInt(
              BUILDING_CATALOG[newCell.type].accentColor.replace('#', ''),
              16,
            );
            refs.spawnBurst(wx, wz, hex);
          } else if (oldCell && !newCell) {
            const [wx, wz] = gridToWorld(gx, gz);
            refs.spawnBurst(wx, wz, 0xf87171);
          }
        }
      }
    }
    prevGridRef.current = grid;
    refs.syncGridMeshes();
  }, [grid]);

  useEffect(() => {
    sceneRefs.current?.rebuildGhost();
  }, [activeTool, rotation]);

  const cursorStyle =
    activeTool === 'demolish'
      ? 'crosshair'
      : activeTool === 'inspect'
        ? 'pointer'
        : 'cell';

  return (
    <div className="relative w-full h-full touch-none">
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full touch-none"
        style={{ cursor: cursorStyle }}
      />
      {contextLost && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/90 text-slate-200 p-6">
          <div className="max-w-sm text-center space-y-2">
            <h2 className="font-display text-lg font-bold">
              3D Grafik Bağlantısı Duraklatıldı
            </h2>
            <p className="text-sm text-slate-400">
              Tarayıcı WebGL bağlamı yeniden başlatılıyor. Lütfen bekleyin veya sayfayı yenileyin.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
