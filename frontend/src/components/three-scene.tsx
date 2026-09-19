'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * A slow-drifting low-poly wireframe + particle field, in the brand's teal/coral/amber palette
 * (same gradient grammar as the marketing hero). Purely decorative — sits behind the auth form.
 * ponytail: vanilla three.js rather than @react-three/fiber — one scene, no reactive graph needed.
 */
export function ThreeScene({ className = '' }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const icoGeometry = new THREE.IcosahedronGeometry(3.2, 1);
    const icoMaterial = new THREE.MeshBasicMaterial({ color: 0xe8a34c, wireframe: true, transparent: true, opacity: 0.55 });
    const ico = new THREE.Mesh(icoGeometry, icoMaterial);
    group.add(ico);

    const innerMaterial = new THREE.MeshBasicMaterial({ color: 0x2b7a80, wireframe: true, transparent: true, opacity: 0.35 });
    const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 0), innerMaterial);
    group.add(inner);

    const particleCount = 220;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const r = 4.5 + Math.random() * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({ color: 0xffe9d1, size: 0.045, transparent: true, opacity: 0.7 });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    function resize() {
      if (!container) return;
      const { width, height } = container.getBoundingClientRect();
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    let frame = 0;
    let raf = 0;
    function tick() {
      raf = requestAnimationFrame(tick);
      frame += reduceMotion ? 0 : 1;
      group.rotation.y = frame * 0.0018;
      group.rotation.x = Math.sin(frame * 0.0009) * 0.25;
      particles.rotation.y = -frame * 0.0006;
      renderer.render(scene, camera);
    }
    tick();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      icoGeometry.dispose();
      icoMaterial.dispose();
      inner.geometry.dispose();
      innerMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className={className} aria-hidden />;
}
