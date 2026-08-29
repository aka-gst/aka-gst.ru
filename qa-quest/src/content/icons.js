/*
 * Иконки шагов. Файл собран из icons/*.svg скриптом tools/build-icons.mjs —
 * править надо исходные SVG и пересобирать, иначе правка потеряется.
 */

export const stepIcons = {
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
