"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";

export interface NavItem {
  label: ReactNode;
  href: string;
}

interface NavHeaderProps {
  items?: NavItem[];
  className?: string;
}

interface CursorPosition {
  left: number;
  width: number;
  opacity: number;
}

const DEFAULT_ITEMS: NavItem[] = [
  { label: "Anasayfa", href: "#top" },
  { label: "Özellikler", href: "#ozellikler" },
  { label: "Nasıl Çalışır", href: "#nasil-calisir" },
];

export default function NavHeader({ items = DEFAULT_ITEMS, className = "" }: NavHeaderProps) {
  const [position, setPosition] = useState<CursorPosition>({
    left: 0,
    width: 0,
    opacity: 0,
  });
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <ul
      className={
        "relative mx-auto flex w-fit rounded-full border border-[var(--accent)]/15 " +
        "bg-[var(--bg-card)] p-1 shadow-sm shadow-black/5 " +
        className
      }
      onMouseLeave={() => {
        setPosition((pv) => ({ ...pv, opacity: 0 }));
        setHoveredIdx(null);
      }}
    >
      {items.map((item, i) => (
        <Tab
          key={i}
          index={i}
          href={item.href}
          isHovered={hoveredIdx === i}
          setPosition={setPosition}
          setHovered={setHoveredIdx}
        >
          {item.label}
        </Tab>
      ))}

      <Cursor position={position} />
    </ul>
  );
}

interface TabProps {
  children: ReactNode;
  href: string;
  index: number;
  isHovered: boolean;
  setPosition: (pos: CursorPosition) => void;
  setHovered: (i: number | null) => void;
}

function Tab({ children, href, index, isHovered, setPosition, setHovered }: TabProps) {
  const ref = useRef<HTMLLIElement>(null);

  return (
    <li
      ref={ref}
      onMouseEnter={() => {
        if (!ref.current) return;
        const { width } = ref.current.getBoundingClientRect();
        setPosition({
          width,
          opacity: 1,
          left: ref.current.offsetLeft,
        });
        setHovered(index);
      }}
      className="relative z-10 block"
    >
      <a
        href={href}
        className={
          "block cursor-pointer px-3 py-1.5 text-xs font-semibold uppercase tracking-wide " +
          "md:px-5 md:py-2.5 md:text-sm transition-colors duration-200 " +
          (isHovered ? "text-[var(--accent-fg)]" : "text-[var(--accent)]")
        }
      >
        {children}
      </a>
    </li>
  );
}

function Cursor({ position }: { position: CursorPosition }) {
  return (
    <motion.li
      animate={{ left: position.left, width: position.width, opacity: position.opacity }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className="absolute z-0 h-7 rounded-full bg-[var(--accent-solid)] md:h-10"
    />
  );
}
