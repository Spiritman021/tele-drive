/**
 * Converts bytes to a human-readable string (KB, MB, GB, etc.)
 */
export function formatBytes(bytes, decimals = 1) {
  if (bytes === 0 || bytes == null) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  const index = Math.min(i, sizes.length - 1);

  return `${parseFloat((bytes / Math.pow(k, index)).toFixed(decimals))} ${sizes[index]}`;
}

/**
 * Formats a Unix timestamp (seconds) to a relative time string.
 * - Under 60s → 'Just now'
 * - Under 60m → 'X min ago'
 * - Under 24h → 'X hr ago'
 * - Yesterday  → 'Yesterday'
 * - This year  → 'Mar 15'
 * - Older      → 'Mar 15, 2024'
 */
export function formatDate(timestamp) {
  if (!timestamp) return '';

  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr ago`;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date >= yesterday && date < today) return 'Yesterday';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();

  if (date.getFullYear() === now.getFullYear()) {
    return `${month} ${day}`;
  }

  return `${month} ${day}, ${date.getFullYear()}`;
}

/**
 * Returns a lucide icon name string based on the given MIME type.
 */
export function getFileIcon(mimeType) {
  if (!mimeType) return 'File';

  const type = mimeType.toLowerCase();

  if (type.startsWith('image/')) return 'Image';
  if (type.startsWith('video/')) return 'Video';
  if (type.startsWith('audio/')) return 'Music';
  if (type === 'application/pdf') return 'FileText';

  if (
    type === 'application/zip' ||
    type === 'application/x-rar-compressed' ||
    type === 'application/x-7z-compressed' ||
    type === 'application/x-tar' ||
    type === 'application/gzip' ||
    type === 'application/vnd.rar'
  ) {
    return 'Archive';
  }

  if (type.startsWith('text/')) return 'FileCode';

  if (
    type === 'application/vnd.ms-excel' ||
    type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    type === 'application/vnd.oasis.opendocument.spreadsheet'
  ) {
    return 'Sheet';
  }

  if (
    type === 'application/vnd.ms-powerpoint' ||
    type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    type === 'application/vnd.oasis.opendocument.presentation'
  ) {
    return 'Presentation';
  }

  return 'File';
}

/**
 * Returns the file extension without the leading dot.
 */
export function getFileExtension(filename) {
  if (!filename || typeof filename !== 'string') return '';
  const lastDot = filename.lastIndexOf('.');
  if (lastDot < 1) return '';
  return filename.slice(lastDot + 1).toLowerCase();
}

/**
 * Truncates a filename with an ellipsis in the middle if it exceeds maxLength.
 * Preserves the file extension for readability.
 */
export function truncateFileName(name, maxLength = 25) {
  if (!name || name.length <= maxLength) return name || '';

  const ext = getFileExtension(name);
  const extWithDot = ext ? `.${ext}` : '';
  const nameWithoutExt = ext ? name.slice(0, -(extWithDot.length)) : name;

  const availableLength = maxLength - extWithDot.length - 1; // 1 for the ellipsis char
  if (availableLength <= 0) return name.slice(0, maxLength);

  const frontChars = Math.ceil(availableLength / 2);
  const backChars = Math.floor(availableLength / 2);

  return `${nameWithoutExt.slice(0, frontChars)}…${nameWithoutExt.slice(-backChars)}${extWithDot}`;
}

/**
 * Generates a random ID string.
 */
export function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Creates a debounced version of the given function.
 */
export function debounce(fn, delay) {
  let timeoutId;

  function debounced(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  }

  debounced.cancel = () => {
    clearTimeout(timeoutId);
  };

  return debounced;
}

/**
 * Parses a Telegram message caption to extract the cleaned filename and tags.
 * Falls back to document filename if name is empty. Appends extension if missing.
 */
export function parseCaption(caption, fallbackName) {
  if (!caption) {
    return { name: fallbackName, tags: [] };
  }

  // Extract hashtags: e.g. #invoice, #receipt-2026
  const hashtagRegex = /#[\w-]+/g;
  const tags = caption.match(hashtagRegex) || [];

  // Clean the filename by removing the hashtags and extra whitespaces
  let name = caption.replace(hashtagRegex, '').replace(/\s+/g, ' ').trim();
  if (!name) {
    name = fallbackName;
  } else {
    // Check if extension needs to be appended
    const dotIndex = fallbackName.lastIndexOf('.');
    if (dotIndex !== -1) {
      const ext = fallbackName.substring(dotIndex); // e.g. ".pdf"
      if (!name.toLowerCase().endsWith(ext.toLowerCase())) {
        name = name + ext;
      }
    }
  }

  return { name, tags };
}

/**
 * Builds a caption string from file name and tags list.
 */
export function buildCaption(name, tags = []) {
  const hashtagStr = tags
    .map((t) => (t.startsWith('#') ? t : `#${t}`))
    .join(' ');
  return hashtagStr ? `${name} ${hashtagStr}` : name;
}

/**
 * Parses user input into a standardized unique list of #hashtags.
 */
export function parseTagsInput(inputString) {
  if (!inputString) return [];
  // Split by spaces, commas, semicolons
  const parts = inputString.split(/[\s,;]+/);
  const tags = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed) {
      // Ensure it starts with #
      const tag = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
      // Validate: must be a valid hashtag word character/dash
      if (/^#[\w-]+$/.test(tag)) {
        tags.push(tag.toLowerCase()); // Lowercase tags for consistency
      }
    }
  }
  return [...new Set(tags)];
}

