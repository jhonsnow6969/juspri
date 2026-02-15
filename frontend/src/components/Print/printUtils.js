// ---- File helpers ----

export function getFileExt(filename) {
  if (!filename || !filename.includes('.')) return '';
  return filename.split('.').pop().toLowerCase();
}

export function getFileIcon(filename) {
  const ext = getFileExt(filename);

  const icons = {
    pdf: '📄',
    doc: '📝',
    docx: '📝',
    txt: '📃',
    md: '📃',
    png: '🖼️',
    jpg: '🖼️',
    jpeg: '🖼️',
    rtf: '📝',
    odt: '📝',
  };

  return icons[ext] || '📎';
}

// ---- File validation ----

export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
];

export const ALLOWED_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'txt',
  'png',
  'jpg',
  'jpeg',
  'rtf',
  'odt',
  'md',
];

export const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3001';
