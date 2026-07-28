import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  WebGLRenderer,
  type Material,
  type Object3D,
} from 'three';
import {
  coverUvTransform,
  defaultSlotSceneState,
  easeCartridgeInsertion,
  interpolateRigidTransform,
  type CartridgeTextureOptions,
  type RigidTransform,
  type SlotSceneController,
  type SlotSceneState,
} from './index';

export interface ThreeSlotSceneOptions {
  pixelRatioCap?: number;
  reducedMotion?: boolean;
  lowPower?: boolean;
}

const INSERTED_TRANSFORM: RigidTransform = {
  position: { x: 0, y: -0.18, z: 0.62 },
  rotation: { x: -0.02, y: 0.02, z: 0 },
  scale: 1,
};

const EJECTED_TRANSFORM: RigidTransform = {
  position: { x: 3.45, y: 3.15, z: 2.45 },
  rotation: { x: -0.24, y: 0.28, z: -0.42 },
  scale: 0.82,
};

const LABEL_WIDTH = 1.12;
const LABEL_HEIGHT = 1.25;
const STAGE_ROTATION = { x: -0.055, y: -0.1, z: 0 };

function cloneTransform(transform: RigidTransform): RigidTransform {
  return {
    position: { ...transform.position },
    rotation: { ...transform.rotation },
    scale: transform.scale,
  };
}

function cloneState(state: SlotSceneState): SlotSceneState {
  return {
    ...state,
    transform: cloneTransform(state.transform),
    texture: { ...state.texture },
  };
}

function imageDimensions(texture: Texture): { width: number; height: number } {
  const image = texture.image as
    | { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number }
    | undefined;
  return {
    width: Number(image?.naturalWidth ?? image?.width ?? 1),
    height: Number(image?.naturalHeight ?? image?.height ?? 1),
  };
}

function disposeMaterial(material: Material): void {
  const candidate = material as Material & {
    map?: Texture | null;
    emissiveMap?: Texture | null;
    alphaMap?: Texture | null;
  };
  candidate.map?.dispose();
  candidate.emissiveMap?.dispose();
  candidate.alphaMap?.dispose();
  material.dispose();
}

export function supportsWebGL2(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export class ThreeSlotSceneController implements SlotSceneController {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(34, 1, 0.1, 50);
  private readonly stage = new Group();
  private readonly cartridge = new Group();
  private readonly labelMaterial = new MeshStandardMaterial({
    color: 0xd6b640,
    roughness: 0.82,
    metalness: 0.02,
    side: DoubleSide,
  });
  private readonly textureLoader = new TextureLoader();
  private readonly pixelRatioCap: number;
  private readonly lowPower: boolean;
  private renderer: WebGLRenderer | null = null;
  private target: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private coverTexture: Texture | null = null;
  private animationFrame: number | null = null;
  private animationResolve: (() => void) | null = null;
  private transitionVersion = 0;
  private mounted = false;
  private destroyed = false;
  private state: SlotSceneState;

  constructor(options: ThreeSlotSceneOptions = {}) {
    this.pixelRatioCap = Math.max(1, options.pixelRatioCap ?? 1.5);
    this.lowPower = options.lowPower ?? true;
    this.state = cloneState(defaultSlotSceneState);
    this.state.reducedMotion =
      options.reducedMotion ??
      (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.textureLoader.setCrossOrigin('anonymous');
    this.buildScene();
  }

  getState(): SlotSceneState {
    return cloneState(this.state);
  }

  private buildScene(): void {
    this.scene.background = null;
    this.camera.position.set(0, 0.35, 7.3);
    this.camera.lookAt(0, 0, 0);

    const ambient = new AmbientLight(0xdde7e5, 1.65);
    const key = new DirectionalLight(0xfff0c2, 2.2);
    key.position.set(-3.5, 5, 5);
    const rim = new DirectionalLight(0x6dd6b1, 0.85);
    rim.position.set(4, 1, 3);
    this.scene.add(ambient, key, rim);

    this.stage.rotation.set(STAGE_ROTATION.x, STAGE_ROTATION.y, STAGE_ROTATION.z);
    this.scene.add(this.stage);

    const chassisMaterial = new MeshStandardMaterial({
      color: new Color(0x273034),
      roughness: 0.86,
      metalness: 0.05,
      flatShading: true,
    });
    const chassis = new Mesh(new BoxGeometry(4.15, 2.65, 0.86, 2, 2, 2), chassisMaterial);
    chassis.position.set(0, -0.34, -0.12);
    this.stage.add(chassis);

    const insetMaterial = new MeshStandardMaterial({
      color: new Color(0x111719),
      roughness: 0.94,
      metalness: 0,
      flatShading: true,
    });
    const inset = new Mesh(new BoxGeometry(3.45, 2.12, 0.2, 2, 2, 1), insetMaterial);
    inset.position.set(0, -0.15, 0.42);
    this.stage.add(inset);

    const slotMaterial = new MeshStandardMaterial({
      color: new Color(0x020303),
      roughness: 1,
      metalness: 0,
      flatShading: true,
    });
    const slot = new Mesh(new BoxGeometry(1.92, 0.22, 0.34, 2, 1, 1), slotMaterial);
    slot.position.set(0, -1.18, 0.52);
    this.stage.add(slot);

    const accentMaterial = new MeshStandardMaterial({
      color: new Color(0x687477),
      roughness: 0.78,
      metalness: 0.08,
      flatShading: true,
    });
    const accent = new Mesh(new BoxGeometry(3.24, 0.1, 0.14, 2, 1, 1), accentMaterial);
    accent.position.set(0, 1.02, 0.47);
    this.stage.add(accent);

    const cartridgeMaterial = new MeshStandardMaterial({
      color: new Color(0x353f42),
      roughness: 0.88,
      metalness: 0.03,
      flatShading: true,
    });
    const body = new Mesh(new BoxGeometry(1.55, 1.9, 0.24, 3, 3, 1), cartridgeMaterial);
    body.position.y = 0.08;
    this.cartridge.add(body);

    const label = new Mesh(
      new PlaneGeometry(LABEL_WIDTH, LABEL_HEIGHT, 1, 1),
      this.labelMaterial,
    );
    label.position.set(0, 0.12, 0.126);
    this.cartridge.add(label);

    const contactMaterial = new MeshStandardMaterial({ color: new Color(0xc8a34a), roughness: 0.48, metalness: 0.32 });
    const contact = new Mesh(new BoxGeometry(0.92, 0.18, 0.255, 6, 1, 1), contactMaterial);
    contact.position.set(0, -0.94, 0.01);
    this.cartridge.add(contact);

    const topRidge = new Mesh(new BoxGeometry(0.72, 0.08, 0.27, 2, 1, 1), insetMaterial);
    topRidge.position.set(-0.22, 1.03, 0.01);
    this.cartridge.add(topRidge);

    this.cartridge.visible = false;
    this.applyTransform(EJECTED_TRANSFORM);
    this.stage.add(this.cartridge);
  }

  async mount(target: HTMLElement): Promise<void> {
    if (this.destroyed) throw new Error('The Three.js slot scene has already been destroyed.');
    if (this.mounted) {
      if (this.target !== target) {
        throw new Error('The Three.js slot scene is already mounted elsewhere.');
      }
      return;
    }
    if (!supportsWebGL2()) throw new Error('WebGL 2 is unavailable.');

    const renderer = new WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: this.lowPower ? 'low-power' : 'high-performance',
      preserveDrawingBuffer: false,
    });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, this.pixelRatioCap));
    renderer.domElement.className = 'save-slot-three-canvas';
    renderer.domElement.setAttribute('aria-hidden', 'true');

    this.renderer = renderer;
    this.target = target;
    this.target.replaceChildren(renderer.domElement);
    this.target.dataset.renderer = 'three';
    this.mounted = true;
    this.applyTextureOptions();

    this.resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      this.resize(entry.contentRect.width, entry.contentRect.height);
    });
    this.resizeObserver.observe(target);
    const bounds = target.getBoundingClientRect();
    this.resize(bounds.width, bounds.height);
  }

  async insert(releaseId: string, coverUrl: string): Promise<void> {
    this.assertMounted();
    const transitionVersion = ++this.transitionVersion;
    this.cancelAnimation();
    this.cartridge.visible = true;
    this.state.insertedReleaseId = releaseId;
    this.state.coverUrl = coverUrl;

    this.setCoverTexture(this.createPlaceholderTexture(releaseId));
    const textureTask = coverUrl
      ? this.loadCoverTexture(coverUrl)
          .then((texture) => {
            if (
              transitionVersion !== this.transitionVersion ||
              this.state.insertedReleaseId !== releaseId ||
              this.destroyed
            ) {
              texture.dispose();
              return;
            }
            this.setCoverTexture(texture);
          })
          .catch(() => undefined)
      : Promise.resolve();

    if (transitionVersion !== this.transitionVersion || this.destroyed) return;
    const start = this.state.reducedMotion ? INSERTED_TRANSFORM : EJECTED_TRANSFORM;
    this.applyTransform(start);
    void textureTask;
    await this.animate(start, INSERTED_TRANSFORM, this.state.reducedMotion ? 0 : 920, true);
    if (transitionVersion !== this.transitionVersion || this.destroyed) return;
    this.state.transform = cloneTransform(INSERTED_TRANSFORM);
  }

  async eject(): Promise<void> {
    if (!this.mounted || this.destroyed) return;
    const transitionVersion = ++this.transitionVersion;
    this.cancelAnimation();
    const start = cloneTransform(this.state.transform);
    await this.animate(start, EJECTED_TRANSFORM, this.state.reducedMotion ? 0 : 330, false);
    if (transitionVersion !== this.transitionVersion || this.destroyed) return;
    this.cartridge.visible = false;
    this.state.insertedReleaseId = null;
    this.state.coverUrl = null;
    this.state.transform = cloneTransform(EJECTED_TRANSFORM);
    this.render();
  }

  resize(width: number, height: number): void {
    if (!this.renderer || width <= 0 || height <= 0) return;
    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));
    this.camera.aspect = safeWidth / safeHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(safeWidth, safeHeight, false);
    this.render();
  }

  setTextureOptions(options: Partial<CartridgeTextureOptions>): void {
    this.state.texture = { ...this.state.texture, ...options };
    this.applyTextureOptions();
    this.render();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.transitionVersion += 1;
    this.cancelAnimation();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (this.labelMaterial.map === this.coverTexture) this.labelMaterial.map = null;
    this.coverTexture?.dispose();
    this.coverTexture = null;

    const geometries = new Set<{ dispose(): void }>();
    const materials = new Set<Material>();
    this.scene.traverse((object: Object3D) => {
      if (!(object instanceof Mesh)) return;
      geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of objectMaterials) materials.add(material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) disposeMaterial(material);

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement.remove();
    }
    if (this.target) {
      delete this.target.dataset.renderer;
      delete this.target.dataset.pixelated;
      delete this.target.dataset.dither;
      delete this.target.dataset.crt;
    }
    this.renderer = null;
    this.target = null;
    this.mounted = false;
  }

  private assertMounted(): void {
    if (!this.mounted || !this.renderer || this.destroyed) {
      throw new Error('Mount the Three.js slot scene before using it.');
    }
  }

  private applyTransform(transform: RigidTransform): void {
    this.cartridge.position.set(transform.position.x, transform.position.y, transform.position.z);
    this.cartridge.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
    this.cartridge.scale.setScalar(transform.scale);
    this.state.transform = cloneTransform(transform);
    this.render();
  }

  private animate(
    start: RigidTransform,
    end: RigidTransform,
    duration: number,
    insertion: boolean,
  ): Promise<void> {
    if (duration <= 0 || typeof requestAnimationFrame === 'undefined') {
      this.applyTransform(end);
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.animationResolve = resolve;
      const startedAt = performance.now();
      const frame = (now: number) => {
        const linear = Math.min(1, Math.max(0, (now - startedAt) / duration));
        const eased = insertion
          ? easeCartridgeInsertion(linear)
          : 1 - Math.pow(1 - linear, 3);
        const transform = interpolateRigidTransform(start, end, Math.min(1, eased));
        if (insertion) {
          const arc = Math.sin(Math.min(1, linear) * Math.PI);
          transform.position.z += arc * 1.05;
          transform.position.y += arc * 0.28;
          if (eased > 1) transform.position.y -= (eased - 1) * 0.28;
          const impactPhase = Math.max(0, (linear - 0.72) / 0.28);
          const impact = Math.sin(impactPhase * Math.PI) * (1 - impactPhase) * 0.1;
          this.stage.position.y = -impact;
          this.stage.rotation.set(STAGE_ROTATION.x + impact * 0.12, STAGE_ROTATION.y, impact * 0.08);
        }
        this.applyTransform(transform);
        if (linear < 1 && !this.destroyed) {
          this.animationFrame = requestAnimationFrame(frame);
          return;
        }
        this.animationFrame = null;
        this.animationResolve = null;
        this.stage.position.set(0, 0, 0);
        this.stage.rotation.set(STAGE_ROTATION.x, STAGE_ROTATION.y, STAGE_ROTATION.z);
        this.applyTransform(end);
        resolve();
      };
      this.animationFrame = requestAnimationFrame(frame);
    });
  }

  private cancelAnimation(): void {
    if (this.animationFrame != null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animationFrame);
    }
    this.animationFrame = null;
    this.stage.position.set(0, 0, 0);
    this.stage.rotation.set(STAGE_ROTATION.x, STAGE_ROTATION.y, STAGE_ROTATION.z);
    this.animationResolve?.();
    this.animationResolve = null;
  }

  private async loadCoverTexture(url: string): Promise<Texture> {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(url, resolve, undefined, reject);
    });
  }

  private setCoverTexture(texture: Texture): void {
    if (this.coverTexture && this.coverTexture !== texture) this.coverTexture.dispose();
    const dimensions = imageDimensions(texture);
    const uv = coverUvTransform(dimensions.width, dimensions.height, LABEL_WIDTH, LABEL_HEIGHT);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.repeat.set(uv.repeatX, uv.repeatY);
    texture.offset.set(uv.offsetX, uv.offsetY);
    this.coverTexture = texture;
    this.labelMaterial.map = texture;
    this.labelMaterial.color.set(0xffffff);
    this.applyTextureOptions();
    this.labelMaterial.needsUpdate = true;
    this.render();
  }

  private createPlaceholderTexture(seed: string): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 168;
    const context = canvas.getContext('2d');
    if (!context) return new Texture();
    context.imageSmoothingEnabled = false;
    context.fillStyle = '#d8b63c';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#171402';
    context.fillRect(8, 8, canvas.width - 16, canvas.height - 16);
    context.fillStyle = '#d8b63c';
    context.font = 'bold 20px monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const initials =
      seed
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .slice(-2)
        .map((part) => part[0]?.toLocaleUpperCase() ?? '')
        .join('') || 'SS';
    context.fillText(initials, canvas.width / 2, canvas.height / 2);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }

  private applyTextureOptions(): void {
    const texture = this.coverTexture;
    if (texture) {
      texture.magFilter = this.state.texture.pixelated ? NearestFilter : LinearFilter;
      texture.minFilter = this.state.texture.pixelated ? NearestFilter : LinearFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
    }
    if (!this.target || !this.renderer) return;
    this.target.dataset.pixelated = String(this.state.texture.pixelated);
    this.target.dataset.dither = String(this.state.texture.dither);
    this.target.dataset.crt = String(this.state.texture.crt);
    this.renderer.domElement.style.imageRendering = this.state.texture.pixelated
      ? 'pixelated'
      : 'auto';
  }

  private render(): void {
    this.renderer?.render(this.scene, this.camera);
  }
}
