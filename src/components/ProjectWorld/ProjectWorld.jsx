import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import './ProjectWorld.css';

const TRIGGER_DIST = 3.2;
const SPEED = 6;

// ─── builders ────────────────────────────────────────────────────────────────

function makeVoxelSpaceship() {
  const group = new THREE.Group();
  const hull    = new THREE.MeshBasicMaterial({ color: 0x0055aa });
  const accent  = new THREE.MeshBasicMaterial({ color: 0x00ccff });
  const wing    = new THREE.MeshBasicMaterial({ color: 0x003366 });
  const cockpit = new THREE.MeshBasicMaterial({ color: 0xaaeeff });

  group.add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 0.52), hull));

  const spine = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.16, 0.28), accent);
  spine.position.set(0.1, 0.19, 0);
  group.add(spine);

  const cpkt = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.28), cockpit);
  cpkt.position.set(0.7, 0.28, 0);
  group.add(cpkt);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.22), accent);
  nose.position.set(1.06, 0, 0);
  group.add(nose);

  [-1, 1].forEach((side) => {
    const w1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.55), wing);
    w1.position.set(0.1, -0.02, side * 0.52);
    w1.rotation.y = side * 0.22;
    group.add(w1);

    const w2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.4), wing);
    w2.position.set(-0.4, -0.02, side * 0.88);
    w2.rotation.y = side * 0.35;
    group.add(w2);

    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.1), accent);
    tip.position.set(-0.65, 0.08, side * 1.1);
    group.add(tip);

    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.17, 0.17), hull);
    pod.position.set(-0.85, 0, side * 0.3);
    group.add(pod);

    const ex = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.13, 0.13),
      new THREE.MeshBasicMaterial({ color: 0xff6600 })
    );
    ex.position.set(-1.12, 0, side * 0.3);
    ex.userData.isEngine = true;
    group.add(ex);
  });

  const exC = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.1, 0.16),
    new THREE.MeshBasicMaterial({ color: 0xff8800 })
  );
  exC.position.set(-1.08, 0, 0);
  exC.userData.isEngine = true;
  group.add(exC);

  return group;
}

function makePortal(hexColor) {
  const group = new THREE.Group();
  const c = new THREE.Color(hexColor);

  const frameEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(3.4, 2.4, 0.1));
  group.add(new THREE.LineSegments(frameEdges, new THREE.LineBasicMaterial({ color: c })));

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(3.1, 2.1, 0.05),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.07, depthWrite: false })
  );
  group.add(panel);

  const cMat = new THREE.MeshBasicMaterial({ color: c });
  const cGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  [[-1.6, -1.1], [1.6, -1.1], [-1.6, 1.1], [1.6, 1.1]].forEach(([x, y]) => {
    const m = new THREE.Mesh(cGeo, cMat);
    m.position.set(x, y, 0);
    group.add(m);
  });

  return group;
}

function makeTextSprite(text, hexColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 80);
  ctx.font = '20px "Press Start 2P", "Courier New", monospace';
  ctx.fillStyle = hexColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 40);

  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(5.5, 0.85, 1);
  return sprite;
}

function makeStars(count = 1200) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * 220;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 70;
    pos[i * 3 + 2] = -18 - Math.random() * 30;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x2255aa, size: 0.18 }));
}

// ─── floating virtual joystick ───────────────────────────────────────────────
// Невидимая зона — при тапе появляется там, где ткнул

function Joystick({ onChange }) {
  const areaRef  = useRef(null);
  const baseEl   = useRef(null);
  const knobEl   = useRef(null);
  const stateRef = useRef({ active: false, id: null, ox: 0, oy: 0 });
  const RADIUS   = 48; // px, половина базы

  const move = useCallback((tx, ty) => {
    const s = stateRef.current;
    const dx = tx - s.ox;
    const dy = ty - s.oy;
    const dist  = Math.hypot(dx, dy);
    const clamp = Math.min(dist, RADIUS);
    const angle = Math.atan2(dy, dx);
    const kx    = Math.cos(angle) * clamp;
    const ky    = Math.sin(angle) * clamp;

    knobEl.current.style.transform = `translate(${kx}px, ${ky}px)`;
    onChange(kx / RADIUS, ky / RADIUS);
  }, [onChange]);

  const onTouchStart = useCallback((e) => {
    e.preventDefault();
    if (stateRef.current.active) return;
    const touch = e.changedTouches[0];
    const area  = areaRef.current.getBoundingClientRect();

    // origin = точка касания относительно области
    const ox = touch.clientX - area.left;
    const oy = touch.clientY - area.top;
    stateRef.current = { active: true, id: touch.identifier, ox: touch.clientX, oy: touch.clientY };

    // показываем базу там где ткнули
    baseEl.current.style.left    = `${ox - RADIUS}px`;
    baseEl.current.style.top     = `${oy - RADIUS}px`;
    baseEl.current.style.opacity = '1';
    knobEl.current.style.transform = 'translate(0,0)';
  }, []);

  const onTouchMove = useCallback((e) => {
    e.preventDefault();
    const s = stateRef.current;
    if (!s.active) return;
    const touch = [...e.changedTouches].find(t => t.identifier === s.id);
    if (touch) move(touch.clientX, touch.clientY);
  }, [move]);

  const onTouchEnd = useCallback((e) => {
    e.preventDefault();
    stateRef.current.active = false;
    baseEl.current.style.opacity = '0';
    knobEl.current.style.transform = 'translate(0,0)';
    onChange(0, 0);
  }, [onChange]);

  return (
    <div
      ref={areaRef}
      className="joystick-area"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* база — скрыта пока не тапнули */}
      <div ref={baseEl} className="joystick-base">
        <div ref={knobEl} className="joystick-knob" />
      </div>
    </div>
  );
}

// ─── component ───────────────────────────────────────────────────────────────

export default function ProjectWorld({ projects, onOpenProject }) {
  const containerRef = useRef(null);
  const [nearProject, setNearProject] = useState(null);
  const nearRef      = useRef(null);
  const onOpenRef    = useRef(onOpenProject);
  onOpenRef.current  = onOpenProject;

  const touchInputRef = useRef({ x: 0, y: 0 });
  const handleJoystick = useCallback((x, y) => {
    touchInputRef.current = { x, y: -y };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const W = container.offsetWidth;
    const H = container.offsetHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(W, H);
    renderer.setClearColor(0x050a1a);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050a1a, 0.022);

    const camera = new THREE.PerspectiveCamera(65, W / H, 0.1, 200);
    camera.position.set(0, 1.5, 12);

    scene.add(makeStars());

    const grid = new THREE.GridHelper(250, 100, 0x0a1a3a, 0x071022);
    grid.position.y = -5;
    scene.add(grid);

    const shipGroup = makeVoxelSpaceship();
    scene.add(shipGroup);
    const planePos = new THREE.Vector3(0, 0, 0);
    const planeVel = new THREE.Vector3(0, 0, 0);
    let   shipYaw  = 0; // текущий угол разворота (Y)

    const portals = projects.map((proj) => {
      const portal = makePortal(proj.color);
      portal.position.set(proj.x ?? 0, proj.y ?? 0, 0);
      scene.add(portal);

      const label = makeTextSprite(proj.title, proj.color);
      label.position.set(proj.x ?? 0, (proj.y ?? 0) + 1.75, 0.1);
      scene.add(label);

      return { mesh: portal, project: proj };
    });

    const keys = {};
    const onKeyDown = (e) => {
      keys[e.code] = true;
      if (e.code === 'Enter' && nearRef.current) onOpenRef.current(nearRef.current);
    };
    const onKeyUp = (e) => { keys[e.code] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);

    const clock   = new THREE.Clock();
    const startMs = performance.now();
    let animId;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t  = (performance.now() - startMs) * 0.001;

      // input
      const kx = (keys['ArrowRight'] || keys['KeyD'] ? 1 : 0) - (keys['ArrowLeft'] || keys['KeyA'] ? 1 : 0);
      const ky = (keys['ArrowUp']    || keys['KeyW'] ? 1 : 0) - (keys['ArrowDown']  || keys['KeyS'] ? 1 : 0);
      const inputX = Math.max(-1, Math.min(1, kx + touchInputRef.current.x));
      const inputY = Math.max(-1, Math.min(1, ky + touchInputRef.current.y));

      planeVel.x += (inputX * SPEED - planeVel.x) * 0.14;
      planeVel.y += (inputY * SPEED - planeVel.y) * 0.14;

      planePos.x += planeVel.x * dt;
      planePos.y  = Math.max(-3, Math.min(5.5, planePos.y + planeVel.y * dt));

      // ── разворот: Y-ось следует за направлением движения ──
      if (Math.abs(planeVel.x) > 0.4) {
        const targetYaw = planeVel.x > 0 ? 0 : Math.PI;
        let diff = targetYaw - shipYaw;
        // кратчайший путь вокруг круга
        if (diff >  Math.PI) diff -= Math.PI * 2;
        if (diff < -Math.PI) diff += Math.PI * 2;
        shipYaw += diff * 0.09;
      }

      shipGroup.position.copy(planePos);
      shipGroup.rotation.y = shipYaw;
      // крен при наборе скорости
      shipGroup.rotation.z = -Math.sin(shipYaw) * planeVel.x * 0.05;
      // тангаж по вертикали
      shipGroup.rotation.x =  planeVel.y * 0.06;

      // engine glow
      const thrust = Math.abs(planeVel.x) + Math.abs(planeVel.y);
      shipGroup.children.forEach((child) => {
        if (child.userData.isEngine) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 12);
          child.material.color.setRGB(
            thrust > 0.5 ? 1 : 0.7 + pulse * 0.3,
            0.3 + pulse * 0.3,
            0
          );
        }
      });

      // camera follow
      camera.position.x += (planePos.x - camera.position.x) * 0.04;
      camera.position.y += (planePos.y + 1.2 - camera.position.y) * 0.04;
      camera.lookAt(planePos.x, planePos.y, 0);

      // portals
      let nearest = null;
      let nearestDist = TRIGGER_DIST;
      portals.forEach(({ mesh, project }) => {
        const dist = planePos.distanceTo(mesh.position);
        if (dist < nearestDist) { nearestDist = dist; nearest = project; }

        const panel = mesh.children[1];
        if (panel) {
          panel.material.opacity = dist < TRIGGER_DIST
            ? 0.14 + Math.sin(t * 5) * 0.07
            : 0.04 + Math.sin(t * 1.5) * 0.03;
        }
        mesh.rotation.y = Math.sin(t * 0.35 + mesh.position.x * 0.4) * 0.06;
      });

      if (nearest?.id !== nearRef.current?.id) {
        nearRef.current = nearest;
        setNearProject(nearest);
      }

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const nw = container.offsetWidth;
      const nh = container.offsetHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
      window.removeEventListener('resize',  onResize);
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [projects]);

  return (
    <section id="projects" className="pw-section">
      <div className="pw-header">
        <span className="pw-tag">[ PROJECTS ]</span>
        <h2 className="pw-title">ПОЛЁТ К ПРОЕКТАМ</h2>
        <p className="pw-desc">
          подлети к порталу и нажми <kbd>ENTER</kbd>
        </p>
      </div>

      <div ref={containerRef} className="pw-canvas">
        {nearProject && (
          <div className="pw-prompt" key={nearProject.id}>
            <span className="pw-prompt-name" style={{ color: nearProject.color }}>
              {nearProject.title}
            </span>
            <button
              className="pw-open-btn"
              style={{ borderColor: nearProject.color, color: nearProject.color }}
              onTouchStart={(e) => { e.stopPropagation(); onOpenProject(nearProject); }}
              onClick={() => onOpenProject(nearProject)}
            >
              [ ОТКРЫТЬ ]
            </button>
          </div>
        )}

        <div className="pw-joystick-wrap">
          <Joystick onChange={handleJoystick} />
        </div>

        <div className="pw-controls">← → ↑ ↓ / WASD</div>
      </div>
    </section>
  );
}
