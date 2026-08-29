/*
 * Иконки шагов. Файл собран из icons/*.svg скриптом tools/build-icons.mjs —
 * править надо исходные SVG и пересобирать, иначе правка потеряется.
 */

export const stepIcons = {
  'gar-bool': '<path d="M4 16h16"/> <path d="M8 16V9M16 16V9"/> <path d="M12 16V5"/> <path d="M9.5 6.5L12 4l2.5 2.5"/>',
  'gar-dict': '<path d="M5 4h11l3 3v13H5z"/> <path d="M16 4v3h3"/> <path d="M8 11h8M8 14h8M8 17h5"/>',
  'gar-errors': '<path d="M3 12h4l2-4 3 8 2-4h2"/> <path d="M20 6l-2 4h3l-2 4"/>',
  'gar-for': '<circle cx="12" cy="12" r="7"/> <circle cx="12" cy="12" r="2.5"/> <path d="M12 5v2M12 17v2M5 12h2M17 12h2"/>',
  'gar-func': '<path d="M17 3a4 4 0 0 0-4 6L5 17l2 2 8-8a4 4 0 0 0 6-4l-3 3-3-1-1-3z"/>',
  'gar-if': '<path d="M12 21v-6"/> <path d="M12 15L6 9V4"/> <path d="M12 15l6-6V4"/> <circle cx="6" cy="3.5" r="1.2"/> <circle cx="18" cy="3.5" r="1.2"/>',
  'gar-list': '<path d="M4 19V7"/> <path d="M4 19h16"/> <path d="M6 16l4-4 4 2 5-7"/> <circle cx="10" cy="12" r="1"/> <circle cx="14" cy="14" r="1"/>',
  'gar-lock': '<rect x="5" y="10" width="14" height="10" rx="2"/> <path d="M8 10V7a4 4 0 0 1 8 0v3"/> <circle cx="12" cy="15" r="1.4"/> <path d="M12 16.4V18"/>',
  'gar-logic': '<rect x="3" y="6" width="7" height="12" rx="2"/> <rect x="14" y="6" width="7" height="12" rx="2"/> <path d="M6.5 9v3"/> <path d="M17.5 15v-3"/>',
  'gar-numbers': '<circle cx="12" cy="12" r="8"/> <path d="M12 12l4-3"/> <path d="M12 4v1.5M20 12h-1.5M12 20v-1.5M4 12h1.5"/>',
  'gar-print': '<rect x="3" y="5" width="18" height="12" rx="2"/> <path d="M8 20h8"/> <path d="M7 10l2 2-2 2"/> <path d="M12 14h4"/>',
  'gar-project': '<path d="M3 15a9 9 0 0 1 18 0"/> <path d="M3 15h18"/> <path d="M12 15l4-5"/> <path d="M6.5 12.5h.01M9 9.5h.01M15 9.5h.01"/> <path d="M8 19h8"/>',
  'gar-strings': '<path d="M4 6h16v5H4z"/> <path d="M4 11c2 3 3 4 3 7"/> <path d="M20 11c-2 3-3 4-3 7"/> <path d="M7 8.5h10"/>',
  'gar-types': '<path d="M4 8h6a4 4 0 0 1 0 8H4"/> <path d="M20 8h-3v8h3"/> <path d="M17 12h2"/>',
  'gar-vars': '<path d="M4 10l6-6 9 9-6 6z"/> <circle cx="8.5" cy="8.5" r="1.2"/> <path d="M3 14v5h5"/>',
  'gar-while': '<path d="M4 6h5v5H4z"/> <path d="M9 8.5h6"/> <path d="M15 8.5v6"/> <path d="M13.5 14.5h3l-1.5 4z"/> <path d="M13.5 20h3"/>',
  'py-bool': '<path d="M12 20V10"/> <path d="M12 10L7 5"/> <path d="M12 10l5-5"/> <path d="M5.5 4.5l3 3M8.5 4.5l-3 3"/> <path d="M15.5 6l1.5 1.5 3-3"/>',
  'py-dict': '<rect x="4" y="5" width="16" height="14" rx="2"/> <path d="M8 9h3M13 9h3"/> <path d="M8 13h3M13 13h3"/> <path d="M8 17h3M13 17h3"/>',
  'py-errors': '<path d="M3 12h5l2-4 3 8 2-4h2"/> <path d="M19 8v4"/> <path d="M19 16h.01"/>',
  'py-for': '<path d="M18 8a7 7 0 1 0 1 7"/> <path d="M18 4v4h-4"/>',
  'py-func': '<path d="M5 16l7-7"/> <path d="M12 9l3-3 4 4-3 3"/> <path d="M5 16l-1 4 4-1 3-3-3-3z"/>',
  'py-ice': '<path d="M12 3l7 3v5c0 4.5-2.8 7.6-7 10-4.2-2.4-7-5.5-7-10V6z"/> <path d="M13 6l-2 5 3 2-3 5"/>',
  'py-if': '<path d="M6 5v14"/> <path d="M18 5v14"/> <path d="M6 11h10"/> <path d="M16 11l2-2M16 11l2 2"/>',
  'py-list': '<path d="M5 7l1.5 1.5L9 6"/> <path d="M11 7h8"/> <path d="M5 12l1.5 1.5L9 11"/> <path d="M11 12h8"/> <path d="M5 17l1.5 1.5L9 16"/> <path d="M11 17h8"/>',
  'py-logic': '<rect x="4" y="4" width="16" height="16" rx="4"/> <rect x="8" y="8" width="8" height="8" rx="2"/>',
  'py-numbers': '<rect x="4" y="6" width="16" height="12" rx="2"/> <path d="M8 9v6M12 9v6M16 9v6"/> <path d="M6 12h12"/>',
  'py-print': '<path d="M4 5h16v14H4z"/> <path d="M7 9l2 2-2 2"/> <path d="M11 14h4"/>',
  'py-project': '<rect x="4" y="5" width="16" height="14" rx="2"/> <circle cx="8" cy="9" r="1"/> <circle cx="12" cy="9" r="1"/> <circle cx="16" cy="9" r="1"/> <path d="M7 15h3M14 13v4M17 12v5"/>',
  'py-strings': '<path d="M4 7c4-2 12-2 16 0v10c-4 2-12 2-16 0z"/> <path d="M7 10h10M7 13h7"/>',
  'py-types': '<rect x="5" y="4" width="14" height="16" rx="2"/> <circle cx="9" cy="9" r="1.5"/> <path d="M12 8h4M8 14h8M8 17h5"/>',
  'py-vars': '<path d="M5 7h14l-1 12H6L5 7z"/> <path d="M8 7V5h8v2"/> <path d="M9 11h6"/> <path d="M10 14h4"/>',
  'py-while': '<path d="M7 4h10M7 20h10"/> <path d="M8 4c0 4 3 5 4 8-1 3-4 4-4 8"/> <path d="M16 4c0 4-3 5-4 8 1 3 4 4 4 8"/>',
};

export const stepIcon = (id) => stepIcons[id] || null;
