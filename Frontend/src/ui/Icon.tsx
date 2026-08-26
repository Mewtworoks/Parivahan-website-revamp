import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

/** Small inline-SVG icon set used throughout the site. */
export const Icon = {
  sliders: (p?: IconProps) => (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}><path d="M3 6h9M15 6h2M3 14h2M8 14h9" /><circle cx="13.4" cy="6" r="1.9" /><circle cx="6.4" cy="14" r="1.9" /></svg>
  ),
  check: (p?: IconProps) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 8.5l3.2 3.2L13 5" /></svg>
  ),
  right: (p?: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" /></svg>
  ),
  left: (p?: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M13 8H4M7.5 4.5L4 8l3.5 3.5" /></svg>
  ),
  down: (p?: IconProps) => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 6l4 4 4-4" /></svg>
  ),
  up: (p?: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 10l4-4 4 4" /></svg>
  ),
  x: (p?: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M4 4l8 8M12 4l-8 8" /></svg>
  ),
  dot: (p?: IconProps) => (
    <svg width="8" height="8" viewBox="0 0 8 8" {...p}><circle cx="4" cy="4" r="3" fill="currentColor" /></svg>
  ),
  clock: (p?: IconProps) => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...p}><circle cx="8" cy="8" r="6.2" /><path d="M8 4.6V8l2.4 1.6" /></svg>
  ),
  pin: (p?: IconProps) => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M8 14.2s4.6-4.1 4.6-7.4A4.6 4.6 0 0 0 3.4 6.8c0 3.3 4.6 7.4 4.6 7.4z" /><circle cx="8" cy="6.7" r="1.7" /></svg>
  ),
  doc: (p?: IconProps) => (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" {...p}><path d="M5 2.6h6l4 4v10.8H5z" /><path d="M11 2.6v4h4" /></svg>
  ),
  card: (p?: IconProps) => (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" {...p}><rect x="2.6" y="4.6" width="16.8" height="12.8" rx="2.4" /><path d="M2.6 9h16.8" /></svg>
  ),
  wheel: (p?: IconProps) => (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}><circle cx="11" cy="11" r="8.2" /><circle cx="11" cy="11" r="2.9" /><path d="M11 2.8v5.3M3.4 15.2l4.9-2.7M18.6 15.2l-4.9-2.7" /></svg>
  ),
  bang: (p?: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" {...p}><circle cx="8" cy="8" r="6.3" /><path d="M8 4.8v4M8 11.1v.1" /></svg>
  ),
  speaker: (p?: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M8.6 2.8L5 5.6H2.6v4.8H5l3.6 2.8z" /><path d="M11.4 5.8a3 3 0 0 1 0 4.4M13.3 3.9a5.6 5.6 0 0 1 0 8.2" /></svg>
  ),
  speakerOff: (p?: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M8.6 2.8L5 5.6H2.6v4.8H5l3.6 2.8z" /><path d="M11 6.4l3 3M14 6.4l-3 3" /></svg>
  ),
  play: (p?: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" {...p}><path d="M5 3.4l7 4.6-7 4.6z" /></svg>
  ),
  search: (p?: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}><circle cx="7" cy="7" r="4.4" /><path d="M10.4 10.4L14 14" /></svg>
  ),
  phone: (p?: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" {...p}><path d="M3 3.4h3l1.2 3-1.6 1.2a7.4 7.4 0 0 0 3.8 3.8l1.2-1.6 3 1.2v3c-5.2.5-11-5.3-10.6-10.6z" /></svg>
  ),
  sun: (p?: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...p}><circle cx="8" cy="8" r="3.4" /><path d="M8 1.4v1.8M8 12.8v1.8M1.4 8h1.8M12.8 8h1.8M3.5 3.5l1.3 1.3M11.2 11.2l1.3 1.3M3.5 12.5l1.3-1.3M11.2 4.8l1.3-1.3" /></svg>
  ),
  moon: (p?: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M13.8 9.6A6 6 0 1 1 6.4 2.2a6.8 6.8 0 0 0 7.4 7.4z" /></svg>
  ),
};
