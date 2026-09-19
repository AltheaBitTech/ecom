'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * The landing hero's 3D illustration: a slowly orbiting stack of store "cards" inside an amber
 * ring, with a drifting particle field — the same store-stack metaphor the hero used as flat divs,
 * but built for real so it holds up as the page's centrepiece.
 *
 * ponytail: vanilla three.js, no @react-three/fiber — one static scene, nothing reactive to graph.
 */

/** A rounded rectangle plate, built by extruding a rounded 2D shape (three has no RoundedBox). */
function plateGeometry(width: number, height: number, radius: number, depth: number) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.045,
    bevelSegments: 4,
    curveSegments: 12,
  });
  geometry.center();
  return geometry;
}

// A fanned deck of three store "cards" — the brand triad, spaced far enough apart to read as
// separate surfaces rather than one slab.
const plates = [
  { color: 0xfffaf3, x: -0.75, y: 1.95, z: -0.9, rotation: -0.15, scale: 0.8, speed: 0.85 },
  { color: 0x1e6b77, x: 0, y: 0, z: 0, rotation: 0.04, scale: 1, speed: 1 },
  { color: 0xe2643c, x: 0.75, y: -1.95, z: 0.9, rotation: 0.18, scale: 0.8, speed: 1.15 },
];

export function HeroScene({ className = '' }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.3, 12.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    const disposables: { dispose(): void }[] = [];
    const track = <T extends { dispose(): void }>(value: T) => {
      disposables.push(value);
      return value;
    };

    scene.add(new THREE.AmbientLight(0xfff1de, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(4, 6, 6);
    scene.add(key);
    const teal = new THREE.PointLight(0x2b7a80, 42, 26);
    teal.position.set(-5, -2, 4);
    scene.add(teal);
    const amber = new THREE.PointLight(0xe8a34c, 34, 24);
    amber.position.set(5, -3, -2);
    scene.add(amber);

    const group = new THREE.Group();
    group.rotation.set(-0.26, -0.5, 0.06);
    scene.add(group);

    const plateGeo = track(plateGeometry(4.0, 2.45, 0.4, 0.22));
    const meshes = plates.map((plate) => {
      const material = track(
        new THREE.MeshPhysicalMaterial({
          color: plate.color,
          roughness: 0.28,
          metalness: 0.05,
          clearcoat: 0.9,
          clearcoatRoughness: 0.25,
        }),
      );
      const mesh = new THREE.Mesh(plateGeo, material);
      mesh.position.set(plate.x, plate.y, plate.z);
      mesh.rotation.z = plate.rotation;
      mesh.scale.setScalar(plate.scale);
      group.add(mesh);
      return { mesh, plate };
    });

    // The ring the stack sits inside — the one piece of pure geometry, in the brand amber.
    const ring = new THREE.Mesh(
      track(new THREE.TorusGeometry(4.1, 0.032, 12, 128)),
      track(new THREE.MeshStandardMaterial({ color: 0xffd9a8, roughness: 0.35, metalness: 0.6 })),
    );
    ring.rotation.set(1.28, 0.1, 0);
    group.add(ring);

    const orb = new THREE.Mesh(
      track(new THREE.IcosahedronGeometry(0.38, 2)),
      track(new THREE.MeshPhysicalMaterial({ color: 0x2b7a80, roughness: 0.15, metalness: 0.2, clearcoat: 1 })),
    );
    group.add(orb);

    const count = 260;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 5 + Math.random() * 4.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions.set(
        [r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta) * 0.6, r * Math.cos(phi)],
        i * 3,
      );
    }
    const dustGeo = track(new THREE.BufferGeometry());
    dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dust = new THREE.Points(
      dustGeo,
      track(new THREE.PointsMaterial({ color: 0xffe9d1, size: 0.05, transparent: true, opacity: 0.75 })),
    );
    scene.add(dust);

    function resize() {
      const { width, height } = container!.getBoundingClientRect();
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
    resize();
    renderer.render(scene, camera); // paint frame zero now — rAF never fires in a hidden tab
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    // Pointer parallax, eased toward the target so the stack glides rather than snaps.
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    function onPointerMove(event: PointerEvent) {
      pointer.tx = (event.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (event.clientY / window.innerHeight - 0.5) * 2;
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    // Only run the loop while the hero is on screen and the tab is visible.
    let onScreen = true;
    const visibility = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; }, { threshold: 0 });
    visibility.observe(container);

    let raf = 0;
    const start = performance.now();
    function tick(now: number) {
      raf = requestAnimationFrame(tick);
      if (!onScreen || document.hidden) return;
      const t = reduceMotion ? 0 : (now - start) / 1000;

      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;

      group.rotation.y = -0.5 + Math.sin(t * 0.18) * 0.22 + pointer.x * 0.3;
      group.rotation.x = -0.26 + Math.cos(t * 0.15) * 0.06 + pointer.y * 0.16;
      meshes.forEach(({ mesh, plate }, i) => {
        mesh.position.y = plate.y + Math.sin(t * 0.7 * plate.speed + i * 1.4) * 0.14;
        mesh.rotation.z = plate.rotation + Math.sin(t * 0.4 + i) * 0.03;
      });
      ring.rotation.z = t * 0.12;
      orb.position.set(Math.cos(t * 0.5) * 4.1, Math.sin(t * 0.5) * 0.5, Math.sin(t * 0.5) * 4.1);
      orb.rotation.y = t * 0.6;
      dust.rotation.y = -t * 0.03;

      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      visibility.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className={className} aria-hidden />;
}
