'use client';

import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export default function CustomCursor() {
  // const [isVisible, setIsVisible] = useState(false);
  // const [isHovering, setIsHovering] = useState(false);
  // const [isTouchDevice, setIsTouchDevice] = useState(true);

  // const cursorX = useMotionValue(-100);
  // const cursorY = useMotionValue(-100);

  // const springConfig = { damping: 25, stiffness: 250, mass: 0.5 };
  // const cursorXSpring = useSpring(cursorX, springConfig);
  // const cursorYSpring = useSpring(cursorY, springConfig);

  // useEffect(() => {
  //   // Detect touch devices to disable custom cursor
  //   const checkTouch = () => {
  //     setIsTouchDevice(
  //       'ontouchstart' in window || navigator.maxTouchPoints > 0
  //     );
  //   };
  //   checkTouch();

  //   if (isTouchDevice) return;

  //   // Apply global cursor: none; class to document root
  //   document.documentElement.classList.add('has-custom-cursor');

  //   const moveMouse = (e: MouseEvent) => {
  //     // Align the pointing tip (top-left) of our custom image cursor exactly with the mouse coordinates
  //     cursorX.set(e.clientX);
  //     cursorY.set(e.clientY);
  //     setIsVisible(true);

  //     // Check if mouse is hovering over interactive elements
  //     const target = e.target as HTMLElement | null;
  //     if (target) {
  //       const isInteractive =
  //         target.tagName === 'A' ||
  //         target.tagName === 'BUTTON' ||
  //         target.tagName === 'INPUT' ||
  //         target.tagName === 'TEXTAREA' ||
  //         target.closest('a') !== null ||
  //         target.closest('button') !== null ||
  //         target.closest('[role="button"]') !== null ||
  //         target.classList.contains('cursor-pointer') ||
  //         // Match Clerk elements which are styled with cl- prefix classes
  //         Array.from(target.classList).some(cls => cls.startsWith('cl-')) ||
  //         target.closest('[class*="cl-"]') !== null;
  //       setIsHovering(!!isInteractive);
  //     }
  //   };

  //   const handleMouseLeave = () => {
  //     setIsVisible(false);
  //   };

  //   window.addEventListener('mousemove', moveMouse);
  //   document.addEventListener('mouseleave', handleMouseLeave);

  //   return () => {
  //     document.documentElement.classList.remove('has-custom-cursor');
  //     window.removeEventListener('mousemove', moveMouse);
  //     document.removeEventListener('mouseleave', handleMouseLeave);
  //   };
  // }, [cursorX, cursorY, isTouchDevice]);

  // if (isTouchDevice) return null;

  // return (
  //   <motion.div
  //     className="fixed top-0 left-0 pointer-events-none z-[2147483647] hidden md:block"
  //     style={{
  //       x: cursorXSpring,
  //       y: cursorYSpring,
  //     }}
  //     animate={{
  //       opacity: isVisible ? 1 : 0,
  //       scale: isHovering ? 1.05 : 1,
  //     }}
  //     transition={{
  //       scale: { type: 'spring', stiffness: 450, damping: 25, mass: 0.5 },
  //       opacity: { duration: 0.15 },
  //     }}
  //   >
  //     <img
  //       src={isHovering ? "/icon-hand.png" : "/icon-cursor.png"}
  //       alt="Cursor"
  //       className="w-[26px] h-[26px] object-contain select-none"
  //     />
  //   </motion.div>
  // );
}
