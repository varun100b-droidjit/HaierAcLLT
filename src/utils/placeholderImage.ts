import placeholderJpg from '../assets/images/picture_not_available.jpg';

/**
 * Pure vector SVG data-URI of the "Picture Not Available" placeholder.
 * Matches the user's uploaded graphic:
 * - Clean white background
 * - Dark slate camera icon
 * - Red prohibition symbol (slashed circle) in bottom-right corner
 * - Bold text: "Picture Not Available"
 * - Subtle horizontal divider line
 */
export const PICTURE_NOT_AVAILABLE_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="100%" height="100%">
  <rect width="800" height="600" fill="#ffffff"/>
  <g transform="translate(0, -10)">
    <!-- Camera Body -->
    <path d="M 285 190 L 315 150 L 485 150 L 515 190 L 565 190 C 585 190 600 205 600 225 L 600 375 C 600 395 585 410 565 410 L 235 410 C 215 410 200 395 200 375 L 200 225 C 200 205 215 190 235 190 Z" fill="#334155" />
    <!-- Camera Lens Outer Ring -->
    <circle cx="400" cy="295" r="85" fill="#ffffff"/>
    <!-- Camera Lens Inner -->
    <circle cx="400" cy="295" r="62" fill="#334155"/>
    
    <!-- Red Prohibition Symbol (Over bottom-right corner of camera) -->
    <g transform="translate(525, 345)">
      <!-- Red Circle -->
      <circle cx="0" cy="0" r="70" fill="none" stroke="#dc2626" stroke-width="22"/>
      <!-- Red Diagonal Slash -->
      <line x1="-48" y1="-48" x2="48" y2="48" stroke="#dc2626" stroke-width="22" stroke-linecap="round"/>
    </g>
  </g>

  <!-- Text: Picture Not Available -->
  <text x="400" y="475" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="44" font-weight="800" fill="#1e293b" letter-spacing="-0.5">
    Picture Not Available
  </text>

  <!-- Horizontal Accent Line -->
  <line x1="260" y1="520" x2="540" y2="520" stroke="#64748b" stroke-width="6" stroke-linecap="round"/>
</svg>
`)}`;

/**
 * High-resolution SVG and canvas image data exported for web preview, reports, and downloads.
 * Uses self-contained data URIs so it never fails with 404, network drops, or bundling path issues.
 */
export const PICTURE_NOT_AVAILABLE_IMAGE = PICTURE_NOT_AVAILABLE_SVG;

let cachedJpegDataUrl: string | null = null;

/**
 * Generates a clean, synchronous JPEG Data URL (data:image/jpeg;base64,...)
 * matching the user's "Picture Not Available" image.
 * This is 100% compatible with Word DOCX generators, Canvas, PDF, and <img> tags.
 */
export function getPictureNotAvailableDataUrlSync(): string {
  if (cachedJpegDataUrl) return cachedJpegDataUrl;
  if (typeof document === 'undefined') return PICTURE_NOT_AVAILABLE_SVG;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 450;
    const ctx = canvas.getContext('2d');
    if (!ctx) return PICTURE_NOT_AVAILABLE_SVG;

    // Clean white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 600, 450);

    // Camera Body
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    const bx = 160, by = 130, bw = 280, bh = 175, r = 22;
    ctx.moveTo(250, 95);
    ctx.lineTo(350, 95);
    ctx.lineTo(380, 130);
    ctx.lineTo(bx + bw - r, 130);
    ctx.quadraticCurveTo(bx + bw, 130, bx + bw, 130 + r);
    ctx.lineTo(bx + bw, by + bh - r);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
    ctx.lineTo(bx + r, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
    ctx.lineTo(bx, by + r);
    ctx.quadraticCurveTo(bx, 130, bx + r, 130);
    ctx.lineTo(220, 130);
    ctx.closePath();
    ctx.fill();

    // Camera Lens outer ring
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(300, 218, 62, 0, Math.PI * 2);
    ctx.fill();

    // Camera Lens inner
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(300, 218, 46, 0, Math.PI * 2);
    ctx.fill();

    // Red Prohibition Circle & Slash (at lower right of camera)
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(395, 260, 52, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(395 - 36, 260 - 36);
    ctx.lineTo(395 + 36, 260 + 36);
    ctx.stroke();

    // "Picture Not Available" text
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Picture Not Available', 300, 355);

    // Subtle horizontal divider bar
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(210, 395);
    ctx.lineTo(390, 395);
    ctx.stroke();

    cachedJpegDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    return cachedJpegDataUrl;
  } catch (err) {
    console.warn('Canvas placeholder render error:', err);
    return PICTURE_NOT_AVAILABLE_SVG;
  }
}

/**
 * Checks if a given photo URL is empty, missing, or a placeholder
 */
export function isPhotoMissing(url?: string | null): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  return (
    trimmed === '' ||
    trimmed === 'NA' ||
    trimmed === 'N/A' ||
    trimmed === 'null' ||
    trimmed === 'undefined' ||
    trimmed.includes('picture_not_available') ||
    trimmed.includes('stored_in_idb') ||
    trimmed.includes('/src/assets/images/') ||
    trimmed.startsWith('data:image/svg+xml')
  );
}

/**
 * Returns the photo URL if available; otherwise returns the Picture Not Available placeholder.
 */
export function getPhotoOrPlaceholder(url?: string | null): string {
  if (isPhotoMissing(url)) {
    return PICTURE_NOT_AVAILABLE_IMAGE;
  }
  return url!.trim();
}

/**
 * Returns a data-URL suitable for Word report generation: real photo if present,
 * otherwise synchronous JPEG Data URL of "Picture Not Available".
 */
export function getPhotoDataUrlOrPlaceholder(url?: string | null): string {
  if (isPhotoMissing(url)) {
    return getPictureNotAvailableDataUrlSync();
  }
  return url!.trim();
}
