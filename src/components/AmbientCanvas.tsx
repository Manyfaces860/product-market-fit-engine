'use client';

import { useEffect, useRef, useState } from 'react';

interface CanvasNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  color: string;
  glowColor: string;
  coreColor: string;
  satelliteColor: string;
  lineColor: string;
  label: string;
  pulseSpeed: number;
  pulsePhase: number;
  opacity: number;
  variants: { x: number; y: number; angle: number; speed: number; radius: number }[];
}

export default function AmbientCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [clusters, setClusters] = useState<any[]>([]);

  // Fetch clusters to dynamically represent them on the canvas
  useEffect(() => {
    async function fetchClusters() {
      try {
        const res = await fetch('/api/clusters');
        if (res.ok) {
          const data = await res.ok ? await res.json() : [];
          setClusters(data);
        }
      } catch (err) {
        console.error('Failed to fetch clusters for canvas:', err);
      }
    }
    // fetchClusters();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let isReducedMotion = mediaQuery.matches;
    const handleMotionChange = (e: MediaQueryListEvent) => {
      isReducedMotion = e.matches;
    };
    mediaQuery.addEventListener('change', handleMotionChange);

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Warm-to-cool palette representing signal resolve with pre-calculated opacity colors
    // This avoids performing string replacements/allocations inside the 60fps render loop!
    const colors = [
      {
        base: 'rgba(245, 158, 11, 0.45)', // Amber
        glow: 'rgba(245, 158, 11, 0.12)',
        core: 'rgba(245, 158, 11, 0.85)',
        satellite: 'rgba(245, 158, 11, 0.6)',
        line: 'rgba(245, 158, 11, 0.15)',
      },
      {
        base: 'rgba(239, 68, 68, 0.45)',  // Coral/Red
        glow: 'rgba(239, 68, 68, 0.12)',
        core: 'rgba(239, 68, 68, 0.85)',
        satellite: 'rgba(239, 68, 68, 0.6)',
        line: 'rgba(239, 68, 68, 0.15)',
      },
      {
        base: 'rgba(236, 72, 153, 0.45)', // Pink
        glow: 'rgba(236, 72, 153, 0.12)',
        core: 'rgba(236, 72, 153, 0.85)',
        satellite: 'rgba(236, 72, 153, 0.6)',
        line: 'rgba(236, 72, 153, 0.15)',
      },
      {
        base: 'rgba(14, 165, 233, 0.45)', // Light Blue
        glow: 'rgba(14, 165, 233, 0.12)',
        core: 'rgba(14, 165, 233, 0.85)',
        satellite: 'rgba(14, 165, 233, 0.6)',
        line: 'rgba(14, 165, 233, 0.15)',
      },
      {
        base: 'rgba(20, 184, 166, 0.45)', // Teal
        glow: 'rgba(20, 184, 166, 0.12)',
        core: 'rgba(20, 184, 166, 0.85)',
        satellite: 'rgba(20, 184, 166, 0.6)',
        line: 'rgba(20, 184, 166, 0.15)',
      },
    ];

    // Build visual nodes
    const nodes: CanvasNode[] = [];

    if (clusters.length > 0) {
      clusters.forEach((cluster, idx) => {
        // Distribute clusters evenly or cluster around center
        const angle = (idx / clusters.length) * Math.PI * 2;
        const radiusDist = Math.min(width, height) * 0.25 * (0.5 + Math.random() * 0.8);
        const x = width / 2 + Math.cos(angle) * radiusDist;
        const y = height / 2 + Math.sin(angle) * radiusDist;

        // Count scales node size
        const memberCount = cluster.memberCount || 1;
        const baseRadius = Math.min(18, 5 + Math.sqrt(memberCount) * 2.2);

        // Category index maps to color
        const colorPalette = colors[idx % colors.length];

        // Create secondary satellite orbits to represent raw submissions gravitating
        const variantsCount = Math.min(8, memberCount - 1);
        const variants = Array.from({ length: variantsCount }, () => {
          return {
            x: 0,
            y: 0,
            angle: Math.random() * Math.PI * 2,
            speed: (0.01 + Math.random() * 0.02) * (Math.random() > 0.5 ? 1 : -1),
            radius: 1.5 + Math.random() * 2,
          };
        });

        nodes.push({
          id: cluster.id,
          x,
          y,
          vx: (Math.random() - 0.5) * 0.2,
          vy: (Math.random() - 0.5) * 0.2,
          baseRadius,
          radius: baseRadius,
          color: colorPalette.base,
          glowColor: colorPalette.glow,
          coreColor: colorPalette.core,
          satelliteColor: colorPalette.satellite,
          lineColor: colorPalette.line,
          label: cluster.canonicalText || '',
          pulseSpeed: 0.01 + Math.random() * 0.015,
          pulsePhase: Math.random() * Math.PI * 2,
          opacity: 0.15 + Math.random() * 0.2,
          variants,
        });
      });
    } else {
      // Seed with beautiful default drifting nodes when no clusters exist
      const defaultCount = 15;
      for (let i = 0; i < defaultCount; i++) {
        const baseRadius = 4 + Math.random() * 8;
        const x = Math.random() * width;
        const y = Math.random() * height;
        
        const satelliteCount = Math.floor(Math.random() * 4);
        const variants = Array.from({ length: satelliteCount }, () => ({
          x: 0,
          y: 0,
          angle: Math.random() * Math.PI * 2,
          speed: (0.005 + Math.random() * 0.01) * (Math.random() > 0.5 ? 1 : -1),
          radius: 1 + Math.random() * 1.5,
        }));

        const colorPalette = colors[i % colors.length];

        nodes.push({
          id: `seed-${i}`,
          x,
          y,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15,
          baseRadius,
          radius: baseRadius,
          color: colorPalette.base,
          glowColor: colorPalette.glow,
          coreColor: colorPalette.core,
          satelliteColor: colorPalette.satellite,
          lineColor: colorPalette.line,
          label: '',
          pulseSpeed: 0.005 + Math.random() * 0.01,
          pulsePhase: Math.random() * Math.PI * 2,
          opacity: 0.12 + Math.random() * 0.1,
          variants,
        });
      }
    }

    // Animation Loop
    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw connecting lines between nodes that share the same general direction/category
      ctx.lineWidth = 0.5;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Connect nodes if they are within proximity (closer represents gravitate structure)
          if (distance < Math.max(width, height) * 0.18) {
            const alpha = (1 - distance / (Math.max(width, height) * 0.18)) * 0.05;
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // 2. Update and draw nodes
      nodes.forEach((node) => {
        // Drift movement
        if (!isReducedMotion) {
          node.x += node.vx;
          node.y += node.vy;

          // Boundary bounce
          if (node.x < 50 || node.x > width - 50) node.vx *= -1;
          if (node.y < 50 || node.y > height - 50) node.vy *= -1;

          // Pulse sizing
          node.pulsePhase += node.pulseSpeed;
          const pulseCoeff = 1 + Math.sin(node.pulsePhase) * 0.15;
          node.radius = node.baseRadius * pulseCoeff;
        }

        // Radial glow gradient for node
        const glowRadius = node.radius * 3.5;
        const gradient = ctx.createRadialGradient(
          node.x,
          node.y,
          node.radius * 0.1,
          node.x,
          node.y,
          glowRadius
        );
        gradient.addColorStop(0, node.color);
        gradient.addColorStop(0.3, node.glowColor);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Core solid dot
        ctx.fillStyle = node.coreColor;
        ctx.beginPath();
        ctx.arc(node.x, node.y, Math.max(1.5, node.radius * 0.35), 0, Math.PI * 2);
        ctx.fill();

        // Render orbits (satellite nodes)
        node.variants.forEach((v) => {
          if (!isReducedMotion) {
            v.angle += v.speed;
          }
          // Orbit calculation
          const orbitDist = node.radius * 2;
          v.x = node.x + Math.cos(v.angle) * orbitDist;
          v.y = node.y + Math.sin(v.angle) * orbitDist;

          ctx.fillStyle = node.satelliteColor;
          ctx.beginPath();
          ctx.arc(v.x, v.y, v.radius, 0, Math.PI * 2);
          ctx.fill();

          // Connect orbit satellite to main node with super faint lines
          ctx.strokeStyle = node.lineColor;
          ctx.lineWidth = 0.3;
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(v.x, v.y);
          ctx.stroke();
        });
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    // Start animating only if tab is visible
    if (!document.hidden) {
      draw();
    }

    // Page Visibility Listener: Stop drawing loop when tab is in background (saves CPU/Memory & prevents unresponsiveness!)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationFrameId);
      } else {
        cancelAnimationFrame(animationFrameId); // Avoid duplicate queues
        draw();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      mediaQuery.removeEventListener('change', handleMotionChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clusters]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none -z-10 bg-slate-950"
      style={{
        background: 'radial-gradient(circle at 50% 50%, #0c142b 0%, #050814 100%)',
      }}
    />
  );
}
