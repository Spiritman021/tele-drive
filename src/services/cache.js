import Dexie from 'dexie';

const db = new Dexie('TeleDriveCache');

db.version(3).stores({
  folders: 'id, name, channelId, createdAt, color',
  files: 'id, name, mimeType, size, messageId, channelId, folderId, createdAt, starred, pinned',
});

const cacheService = {
  async syncFolders(folders) {
    await db.folders.clear();
    if (folders.length > 0) {
      await db.folders.bulkPut(folders);
    }
  },

  async getFolders() {
    return db.folders.toArray();
  },

  async cacheFiles(folderId, files) {
    // Keep the starred status when reloading files from Telegram!
    // Since Telegram itself doesn't store the starred status, we retrieve existing starred status from cache.
    const starredFiles = await db.files.where('folderId').equals(folderId).filter(f => f.starred === 1).toArray();
    const starredIds = new Set(starredFiles.map(f => f.id));

    await db.files.where('folderId').equals(folderId).delete();
    if (files.length > 0) {
      const filesWithStarred = files.map(file => ({
        ...file,
        folderId,
        starred: file.starred || (starredIds.has(file.id) ? 1 : 0),
        pinned: file.pinned || 0
      }));
      await db.files.bulkPut(filesWithStarred);
    }
  },

  async getFiles(folderId) {
    return db.files.where('folderId').equals(folderId).toArray();
  },

  async addFile(file) {
    await db.files.put({
      ...file,
      starred: file.starred || 0,
      pinned: file.pinned || 0
    });
  },

  async removeFile(fileId) {
    await db.files.delete(fileId);
  },

  async toggleStar(fileId, starred) {
    const file = await db.files.get(fileId);
    if (file) {
      file.starred = starred ? 1 : 0;
      await db.files.put(file);
      return file;
    }
    return null;
  },

  async togglePin(fileId, pinned) {
    const file = await db.files.get(fileId);
    if (file) {
      file.pinned = pinned ? 1 : 0;
      await db.files.put(file);
      return file;
    }
    return null;
  },

  async getFile(fileId) {
    return db.files.get(fileId);
  },

  async getStarredFiles() {
    return db.files.where('starred').equals(1).toArray();
  },

  async getRecentFiles(limit = 20) {
    return db.files.orderBy('createdAt').reverse().limit(limit).toArray();
  },

  async clear() {
    await db.folders.clear();
    await db.files.clear();
  },

  async getAllTags() {
    const allFiles = await db.files.toArray();
    const tagsSet = new Set();
    for (const f of allFiles) {
      if (f.tags && Array.isArray(f.tags)) {
        for (const t of f.tags) {
          tagsSet.add(t);
        }
      }
    }
    return Array.from(tagsSet).sort();
  },

  async getFilesByTag(tag) {
    const allFiles = await db.files.toArray();
    return allFiles.filter((f) => f.tags && f.tags.includes(tag));
  },
};

export default cacheService;

