import * as THREE from 'three';

export interface ProceduralTextureSet {
  grassMap: THREE.CanvasTexture;
  waterMap: THREE.CanvasTexture;
  glassFacadeMap: THREE.CanvasTexture;
  roadMaps: Map<number, THREE.CanvasTexture>;
  dispose: () => void;
}

function configureColorTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

function createGrassTexture(anisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Base lush meadow green
  ctx.fillStyle = '#5a8f49';
  ctx.fillRect(0, 0, size, size);

  // Subtle organic turf speckles
  for (let i = 0; i < 650; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin(i * 78.233) * 43758.5453) % 1;
    const px = Math.abs(x) * size;
    const py = Math.abs(y) * size;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(116, 173, 88, 0.25)' : 'rgba(62, 108, 50, 0.2)';
    ctx.fillRect(px, py, 4, 4);
  }

  // Soft architectural plot border along edges (repeats per cell)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);

  return configureColorTexture(canvas, anisotropy, 20, 20);
}

function createWaterTexture(anisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1b6f9c';
  ctx.fillRect(0, 0, size, size);

  // Gentle stylized wave caustics
  ctx.strokeStyle = 'rgba(147, 217, 245, 0.22)';
  ctx.lineWidth = 2;
  for (let y = 16; y < size; y += 32) {
    ctx.beginPath();
    for (let x = 0; x <= size; x += 16) {
      const wave = Math.sin((x / size) * Math.PI * 2 + y * 0.1) * 5;
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }

  return configureColorTexture(canvas, anisotropy, 18, 18);
}

function createGlassFacadeTexture(anisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1e3a5f';
  ctx.fillRect(0, 0, size, size);

  const cols = 4;
  const rows = 8;
  const padX = 8;
  const padY = 6;
  const cellW = size / cols;
  const cellH = size / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellW + padX;
      const y = r * cellH + padY;
      const w = cellW - padX * 2;
      const h = cellH - padY * 2;

      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, '#7dd3fc');
      grad.addColorStop(1, '#2563eb');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);
    }
  }

  return configureColorTexture(canvas, anisotropy, 1, 1);
}

function createRoadTileTexture(mask: number, anisotropy: number): THREE.CanvasTexture {
  // mask bits: N=1 (top, -Z), E=2 (right, +X), S=4 (bottom, +Z), W=8 (left, -X)
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const hasN = (mask & 1) !== 0;
  const hasE = (mask & 2) !== 0;
  const hasS = (mask & 4) !== 0;
  const hasW = (mask & 8) !== 0;

  // Concrete sidewalk base
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, 0, size, size);

  // Subtle sidewalk paving lines
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, size - 4, size - 4);

  const margin = 42; // Sidewalk border thickness
  const roadW = size - margin * 2;

  // Asphalt surface
  ctx.fillStyle = '#334155';
  // Center square
  ctx.fillRect(margin, margin, roadW, roadW);

  if (hasN) ctx.fillRect(margin, 0, roadW, margin + 2);
  if (hasS) ctx.fillRect(margin, size - margin - 2, roadW, margin + 2);
  if (hasW) ctx.fillRect(0, margin, margin + 2, roadW);
  if (hasE) ctx.fillRect(size - margin - 2, margin, margin + 2, roadW);

  // Curbs on non-connected edges
  ctx.fillStyle = '#94a3b8';
  const curb = 6;
  if (!hasN) ctx.fillRect(margin - curb, margin - curb, roadW + curb * 2, curb);
  if (!hasS) ctx.fillRect(margin - curb, size - margin, roadW + curb * 2, curb);
  if (!hasW) ctx.fillRect(margin - curb, margin - curb, curb, roadW + curb * 2);
  if (!hasE) ctx.fillRect(size - margin, margin - curb, curb, roadW + curb * 2);

  // Center dashed lane markings
  const center = size / 2;
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 5;
  ctx.setLineDash([16, 14]);

  const connections = (hasN ? 1 : 0) + (hasE ? 1 : 0) + (hasS ? 1 : 0) + (hasW ? 1 : 0);

  if (connections === 0) {
    // Isolated roundabout pad
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(center, center, 28, 0, Math.PI * 2);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 4;
    ctx.stroke();
  } else {
    if (hasN) {
      ctx.beginPath();
      ctx.moveTo(center, 0);
      ctx.lineTo(center, connections >= 3 ? margin : center);
      ctx.stroke();
    }
    if (hasS) {
      ctx.beginPath();
      ctx.moveTo(center, size);
      ctx.lineTo(center, connections >= 3 ? size - margin : center);
      ctx.stroke();
    }
    if (hasW) {
      ctx.beginPath();
      ctx.moveTo(0, center);
      ctx.lineTo(connections >= 3 ? margin : center, center);
      ctx.stroke();
    }
    if (hasE) {
      ctx.beginPath();
      ctx.moveTo(size, center);
      ctx.lineTo(connections >= 3 ? size - margin : center, center);
      ctx.stroke();
    }
  }

  // Crosswalk stripes at 3-way and 4-way intersections
  if (connections >= 3) {
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
    const stripeCount = 5;
    const stripeGap = roadW / (stripeCount * 2 + 1);
    if (hasN) {
      for (let i = 0; i < stripeCount; i++) {
        ctx.fillRect(margin + stripeGap * (i * 2 + 1), margin - 14, stripeGap, 12);
      }
    }
    if (hasS) {
      for (let i = 0; i < stripeCount; i++) {
        ctx.fillRect(margin + stripeGap * (i * 2 + 1), size - margin + 2, stripeGap, 12);
      }
    }
    if (hasW) {
      for (let i = 0; i < stripeCount; i++) {
        ctx.fillRect(margin - 14, margin + stripeGap * (i * 2 + 1), 12, stripeGap);
      }
    }
    if (hasE) {
      for (let i = 0; i < stripeCount; i++) {
        ctx.fillRect(size - margin + 2, margin + stripeGap * (i * 2 + 1), 12, stripeGap);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const anisotropy = Math.max(1, Math.min(maxAnisotropy, 8));
  const grassMap = createGrassTexture(anisotropy);
  const waterMap = createWaterTexture(anisotropy);
  const glassFacadeMap = createGlassFacadeTexture(anisotropy);

  const roadMaps = new Map<number, THREE.CanvasTexture>();
  for (let mask = 0; mask < 16; mask++) {
    roadMaps.set(mask, createRoadTileTexture(mask, anisotropy));
  }

  return {
    grassMap,
    waterMap,
    glassFacadeMap,
    roadMaps,
    dispose: () => {
      grassMap.dispose();
      waterMap.dispose();
      glassFacadeMap.dispose();
      roadMaps.forEach((t) => t.dispose());
    },
  };
}
