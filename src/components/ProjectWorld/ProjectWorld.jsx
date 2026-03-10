import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import './ProjectWorld.css';

const TRIGGER_DIST = 3.2;
const SPEED = 6;

// ─── builders ────────────────────────────────────────────────────────────────

function makeVoxelPlane() {
  const group = new THREE.Group();
  const blue  = new THREE.MeshBasicMaterial({ color: 0x00aaff });
  const dark  = new THREE.MeshBasicMaterial({ color: 0x005588 });
  const white = new THREE.MeshBasicMaterial({ color: 0xddeeff });

  // fuselage
  group.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 0.3), blue)));
  // wings
  const wings = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 2.2), dark);
  wings.position.set(-0.1, 0, 0);
  group.add(wings);
  // tail fin
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.38, 0.08), dark);
  fin.position.set(-0.62, 0.2, 0);
  group.add(fin);
  // tail wings
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.07, 0.75), dark);
  tail.position.set(-0.58, 0, 0);
  group.add(tail);
  // cockpit
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.24), white);
  cockpit.position.set(0.48, 0.1, 0);
  group.add(cockpit);

  return group;
}

function makePortal(hexColor) {
  const group = new THREE.Group();
  const c = new THREE.Color(hexColor);

  // wireframe frame
  const frameEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(3.4, 2.4, 0.1));
  group.add(new THREE.LineSegments(frameEdges, new THREE.LineBasicMaterial({ color: c })));

  // glow panel
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(3.1, 2.1, 0.05),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.07, depthWrite: false })
  );
  group.add(panel);

  // corner squares
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
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true })
  );
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

// ─── component ───────────────────────────────────────────────────────────────

export default function ProjectWorld({ projects, onOpenProject }) {
  const containerRef   = useRef(null);
  const [nearProject, setNearProject] = useState(null);
  const nearRef        = useRef(null);
  const onOpenRef      = useRef(onOpenProject);
  onOpenRef.current    = onOpenProject;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const W = container.offsetWidth;
    const H = container.offsetHeight;

    // renderer
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(W, H);
    renderer.setClearColor(0x050a1a);
    container.appendChild(renderer.domElement);

    // scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050a1a, 0.022);

    // camera
    const camera = new THREE.PerspectiveCamera(65, W / H, 0.1, 200);
    camera.position.set(0, 1.5, 12);

    // stars
    scene.add(makeStars());

    // grid (floor)
    const grid = new THREE.GridHelper(250, 100, 0x0a1a3a, 0x071022);
    grid.position.y = -5;
    scene.add(grid);

    // player
    const planeGroup = makeVoxelPlane();
    scene.add(planeGroup);
    const planePos = new THREE.Vector3(0, 0, 0);
    const planeVel = new THREE.Vector3(0, 0, 0);

    // portals
    const portals = projects.map((proj) => {
      const portal = makePortal(proj.color);
      portal.position.set(proj.x ?? 0, proj.y ?? 0, 0);
      scene.add(portal);

      const label = makeTextSprite(proj.title, proj.color);
      label.position.set(proj.x ?? 0, (proj.y ?? 0) + 1.75, 0.1);
      scene.add(label);

      return { mesh: portal, project: proj };
    });

    // keys
    const keys = {};
    const onKeyDown = (e) => {
      keys[e.code] = true;
      if (e.code === 'Enter' && nearRef.current) {
        onOpenRef.current(nearRef.current);
      }
    };
    const onKeyUp = (e) => { keys[e.code] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);


    // animate
    const clock = new THREE.Clock();
    const startMs = performance.now();
    let animId;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t  = (performance.now() - startMs) * 0.001;

      // input → velocity → position
      const inputX = (keys['ArrowRight'] || keys['KeyD'] ? 1 : 0) - (keys['ArrowLeft'] || keys['KeyA'] ? 1 : 0);
      const inputY = (keys['ArrowUp']    || keys['KeyW'] ? 1 : 0) - (keys['ArrowDown']  || keys['KeyS'] ? 1 : 0);

      planeVel.x += (inputX * SPEED - planeVel.x) * 0.14;
      planeVel.y += (inputY * SPEED - planeVel.y) * 0.14;

      planePos.x += planeVel.x * dt;
      planePos.y  = Math.max(-3, Math.min(5.5, planePos.y + planeVel.y * dt));

      // mesh
      planeGroup.position.copy(planePos);
      planeGroup.rotation.z = -planeVel.x * 0.045;
      planeGroup.rotation.x =  planeVel.y * 0.06;

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

        // glow pulse
        const panel = mesh.children[1];
        if (panel) {
          panel.material.opacity = dist < TRIGGER_DIST
            ? 0.14 + Math.sin(t * 5) * 0.07
            : 0.04 + Math.sin(t * 1.5) * 0.03;
        }
        // gentle sway
        mesh.rotation.y = Math.sin(t * 0.35 + mesh.position.x * 0.4) * 0.06;
      });

      if (nearest?.id !== nearRef.current?.id) {
        nearRef.current = nearest;
        setNearProject(nearest);
      }

      renderer.render(scene, camera);
    };
    animate();

    // resize
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
          управляй самолётом · подлети к порталу · нажми <kbd>ENTER</kbd>
        </p>
      </div>

      <div ref={containerRef} className="pw-canvas">
        {nearProject && (
          <div className="pw-prompt" key={nearProject.id}>
            <span className="pw-prompt-name" style={{ color: nearProject.color }}>
              {nearProject.title}
            </span>
            <span className="pw-prompt-key">[ ENTER ] открыть</span>
          </div>
        )}
        <div className="pw-controls">← → ↑ ↓ &nbsp;/&nbsp; WASD</div>
      </div>
    </section>
  );
}
