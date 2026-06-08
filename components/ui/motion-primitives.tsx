"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function FadeIn({ children, className }: { children: ReactNode; delay?: number; className?: string }) {
  return <div className={cn("animate-spatial-fade", className)}>{children}</div>;
}
export function SlideUp({ children, className }: { children: ReactNode; delay?: number; className?: string }) {
  return <div className={cn("animate-spatial-rise", className)}>{children}</div>;
}
export function ScaleIn({ children, className }: { children: ReactNode; delay?: number; className?: string }) {
  return <div className={cn("animate-spatial-rise", className)}>{children}</div>;
}
export function StaggerContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("animate-spatial-rise", className)}>{children}</div>;
}
