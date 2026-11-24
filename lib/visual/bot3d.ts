import {
  AmbientLight,
  CircleGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PointLight,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";

export type BotMood = "idle" | "listening" | "thinking" | "talking";

/** The Mospho mascot as a live 3D bot: glossy orange body, two black eyes that follow the pointer. */
export function createBot(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.05, 5.2);

  scene.add(new AmbientLight(0xffe6d6, 1.1));
  const key = new DirectionalLight(0xffffff, 2.6);
  key.position.set(-2.5, 3, 4);
  scene.add(key);
  const rim = new PointLight(0xff9a5c, 14, 12);
  rim.position.set(2.6, -1.2, -1.5);
  scene.add(rim);

  const bot = new Group();
  scene.add(bot);
  const body = new Mesh(
    new SphereGeometry(1, 64, 48),
    new MeshPhysicalMaterial({
      color: new Color("#ff7a1f"),
      roughness: 0.32,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      sheen: 0.6,
      sheenColor: new Color("#ffc08a"),
    }),
  );
  bot.add(body);

  const eyeGeo = new SphereGeometry(0.24, 32, 24);
  const eyeMat = new MeshPhysicalMaterial({
    color: 0x070707,
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
  });
  const glintMat = new MeshBasicMaterial({ color: 0xffffff });
  const eyes = [-0.36, 0.36].map((x) => {
    const pivot = new Group();
    const eye = new Mesh(eyeGeo, eyeMat);
    eye.scale.set(1, 1.08, 0.62);
    const glint = new Mesh(new CircleGeometry(0.06, 20), glintMat);
    glint.position.set(0.07, 0.09, 0.16);
    eye.add(glint);
    pivot.add(eye);
    pivot.position.set(x, 0.22, 0.86);
    bot.add(pivot);
    return eye;
  });

  const shadow = new Mesh(
    new CircleGeometry(0.8, 32),
    new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.18;
  scene.add(shadow);

  let mood: BotMood = "idle";
  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  let blink = 0,
    nextBlink = 2,
    time = 0,
    last = 0,
    raf = 0,
    running = true,
    hop = 0;

  const resize = () => {
    const w = canvas.clientWidth || 1,
      h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  const onPointer = (e: PointerEvent) => {
    const box = canvas.getBoundingClientRect();
    const cx = box.left + box.width / 2,
      cy = box.top + box.height / 2;
    look.tx = Math.max(-1, Math.min(1, (e.clientX - cx) / 500));
    look.ty = Math.max(-1, Math.min(1, (e.clientY - cy) / 400));
  };
  addEventListener("pointermove", onPointer, { passive: true });
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const frame = (now: number) => {
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    time += dt;
    const k = 1 - Math.exp(-dt * 7);
    if (mood === "thinking") {
      look.tx = Math.sin(time * 1.6) * 0.6;
      look.ty = -0.5;
    }
    look.x += (look.tx - look.x) * k;
    look.y += (look.ty - look.y) * k;

    nextBlink -= dt;
    if (nextBlink <= 0) {
      blink = 1;
      nextBlink = 2.2 + Math.random() * 3;
    }
    blink = Math.max(0, blink - dt * 7);
    const lid = blink > 0 ? Math.abs(Math.cos(blink * Math.PI)) : 1;

    const talk = mood === "talking" ? Math.abs(Math.sin(time * 13)) : 0;
    hop = Math.max(0, hop - dt * 2.4);
    const bob = still ? 0 : Math.sin(time * 2.1) * 0.05 + Math.sin(hop * Math.PI) * 0.25;
    bot.position.y = bob;
    const squash = 1 + talk * 0.05 - Math.sin(hop * Math.PI) * 0.04;
    body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    bot.rotation.y = look.x * 0.45;
    bot.rotation.x = look.y * 0.3;
    bot.rotation.z = mood === "listening" ? Math.sin(time * 3) * 0.06 : look.x * -0.06;
    for (const eye of eyes) {
      eye.position.set(look.x * 0.06, -look.y * 0.05, 0);
      eye.scale.y = 1.08 * Math.max(0.08, lid) * (mood === "thinking" ? 0.85 : 1);
    }
    shadow.scale.setScalar(1 - bob * 0.6);
    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    setMood(next: BotMood) {
      if (next !== mood && (next === "talking" || next === "listening")) hop = 1;
      mood = next;
    },
    hop() {
      hop = 1;
    },
    pause(off: boolean) {
      if (off && running) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!off && !running) {
        running = true;
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    },
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      removeEventListener("pointermove", onPointer);
      renderer.dispose();
    },
  };
}
