import telegramService from './telegram';
import { Buffer } from 'buffer';
import { parseCaption, buildCaption } from '../utils/helpers';

const filesService = {
  /**
   * Upload a file to a Telegram channel (folder)
   * @param {string|number} channelId - The channel to upload to
   * @param {File} file - Browser File object
   * @param {Function} onProgress - Progress callback (0-100)
   * @returns {Object} - Uploaded file metadata
   */
  async uploadFile(channelId, file, caption = '', onProgress) {
    try {
      const result = await telegramService.sendFile(
        channelId,
        file,
        file.name,
        caption,
        onProgress
      );

      const doc = result.media?.document;
      const { name, tags } = parseCaption(caption, file.name);

      return {
        id: `${result.id}`,
        name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        messageId: result.id,
        channelId: channelId.toString(),
        createdAt: Math.floor(Date.now() / 1000),
        telegramFileId: doc?.id?.toString() || '',
        tags,
        caption,
      };
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  },

  /**
   * List files in a channel (folder)
   * @param {string|number} channelId
   * @param {number} limit
   * @param {number} offsetId
   * @returns {Array} - Array of file metadata objects
   */
  async listFiles(channelId, limit = 100, offsetId = 0) {
    try {
      const client = telegramService.getClient();
      const entity = await client.getEntity(channelId);

      const messages = await client.getMessages(entity, {
        limit,
        offsetId,
      });

      const messageIds = messages.map((m) => m.id);
      const { Api } = await import('telegram');
      const reactionsMap = {};

      if (messageIds.length > 0) {
        try {
          const reactionsResult = await client.invoke(
            new Api.messages.GetMessagesReactions({
              peer: entity,
              id: messageIds,
            })
          );
          if (reactionsResult && reactionsResult.updates) {
            for (const update of reactionsResult.updates) {
              if (update.className === 'UpdateMessageReactions' || update.constructor?.name === 'UpdateMessageReactions') {
                reactionsMap[update.msgId] = update.reactions;
              }
            }
          }
        } catch (error) {
          console.error('Failed to get message reactions:', error);
        }
      }

      const files = [];

      for (const msg of messages) {
        const msgReactions = reactionsMap[msg.id] || msg.reactions;
        // Parse reactions to determine if starred (heart or thumbs up)
        const hasStarReaction = !!(
          msgReactions &&
          msgReactions.results &&
          msgReactions.results.some(
            (r) => r.reaction && (r.reaction.emoticon === '❤️' || r.reaction.emoticon === '❤' || r.reaction.emoticon === '👍')
          )
        );

        // Only include messages with document media
        if (msg.media?.document) {
          const doc = msg.media.document;
          const fileName = doc.attributes?.find(
            (a) => a.className === 'DocumentAttributeFilename'
          )?.fileName || 'Unknown File';
          
          const { name, tags } = parseCaption(msg.message, fileName);
          
          files.push({
            id: `${msg.id}`,
            name,
            mimeType: doc.mimeType || 'application/octet-stream',
            size: Number(doc.size || 0),
            messageId: msg.id,
            channelId: channelId.toString(),
            createdAt: msg.date,
            telegramFileId: doc.id?.toString() || '',
            starred: hasStarReaction ? 1 : 0,
            pinned: msg.pinned ? 1 : 0,
            reactions: msgReactions,
            views: msg.views || 0,
            tags,
            caption: msg.message || '',
          });
        }
        // Also include photos
        else if (msg.media?.photo) {
          const photo = msg.media.photo;
          const sizes = photo.sizes || [];
          const largest = sizes[sizes.length - 1];
          
          const { name, tags } = parseCaption(msg.message, `photo_${msg.id}.jpg`);
          
          files.push({
            id: `${msg.id}`,
            name,
            mimeType: 'image/jpeg',
            size: largest?.size || 0,
            messageId: msg.id,
            channelId: channelId.toString(),
            createdAt: msg.date,
            telegramFileId: photo.id?.toString() || '',
            isPhoto: true,
            starred: hasStarReaction ? 1 : 0,
            pinned: msg.pinned ? 1 : 0,
            reactions: msgReactions,
            views: msg.views || 0,
            tags,
            caption: msg.message || '',
          });
        }
      }

      return files;
    } catch (error) {
      console.error('List files failed:', error);
      throw error;
    }
  },

  /**
   * Download a file from Telegram
   * @param {string|number} channelId
   * @param {number} messageId
   * @param {Function} onProgress - Progress callback (0-100)
   * @returns {Blob} - File blob for download
   */
  async downloadFile(channelId, messageId, onProgress) {
    try {
      const client = telegramService.getClient();
      const entity = await client.getEntity(channelId);

      const messages = await client.getMessages(entity, {
        ids: [messageId],
      });

      if (!messages || messages.length === 0) {
        throw new Error('Message not found');
      }

      const message = messages[0];

      const buffer = await client.downloadMedia(message, {
        progressCallback: (downloaded, total) => {
          if (onProgress && total) {
            onProgress(Math.round((downloaded / total) * 100));
          }
        },
      });

      // Determine mime type
      let mimeType = 'application/octet-stream';
      if (message.media?.document) {
        mimeType = message.media.document.mimeType || mimeType;
      } else if (message.media?.photo) {
        mimeType = 'image/jpeg';
      }

      return new Blob([buffer], { type: mimeType });
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  },

  /**
   * Delete files from a channel
   * @param {string|number} channelId
   * @param {number[]} messageIds
   */
  async deleteFiles(channelId, messageIds) {
    try {
      await telegramService.deleteMessages(channelId, messageIds);
    } catch (error) {
      console.error('Delete failed:', error);
      throw error;
    }
  },

  /**
   * Get a thumbnail/preview for an image file
   * @param {string|number} channelId
   * @param {number} messageId
   * @returns {string|null} - Object URL for the thumbnail
   */
  async getThumbnail(channelId, messageId) {
    try {
      const client = telegramService.getClient();
      const entity = await client.getEntity(channelId);

      const messages = await client.getMessages(entity, {
        ids: [messageId],
      });

      if (!messages || messages.length === 0) return null;

      const message = messages[0];

      // Check if it's a photo or has photo media
      if (message.media?.photo) {
        const buffer = await client.downloadMedia(message, {
          thumb: 0,
        });
        const blob = new Blob([buffer], { type: 'image/jpeg' });
        return URL.createObjectURL(blob);
      }

      const doc = message.media?.document;
      if (!doc) return null;

      // Check if there's a thumb
      const thumb = doc.thumbs?.[0];
      if (!thumb) return null;

      const buffer = await client.downloadMedia(message, {
        thumb: 0,
      });

      const blob = new Blob([buffer], { type: 'image/jpeg' });
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Thumbnail fetch failed:', error);
      return null;
    }
  },

  /**
   * Trigger a browser download for a file
   * @param {Blob} blob
   * @param {string} fileName
   */
  saveBlobAsFile(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * React to the file message on Telegram to sync "starred" status (❤️ for star, empty for unstar)
   * @param {string|number} channelId
   * @param {number} messageId
   * @param {boolean} isStarred
   */
  async toggleStarReaction(channelId, messageId, isStarred) {
    try {
      const client = telegramService.getClient();
      const entity = await client.getEntity(channelId);
      
      const { Api } = await import('telegram');
      
      await client.invoke(
        new Api.messages.SendReaction({
          peer: entity,
          msgId: Number(messageId),
          reaction: isStarred ? [new Api.ReactionEmoji({ emoticon: '❤️' })] : [],
        })
      );
    } catch (error) {
      if (error && error.message && error.message.includes('REACTION_EMPTY')) {
        // Ignored: expected when removing a reaction that was not set on Telegram
        return;
      }
      console.error('Failed to sync star reaction to Telegram:', error);
    }
  },

  /**
   * Pin or unpin a file message on Telegram
   * @param {string|number} channelId
   * @param {number} messageId
   * @param {boolean} isPinned
   */
  async togglePin(channelId, messageId, isPinned) {
    try {
      await telegramService.pinMessage(channelId, Number(messageId), !isPinned);
    } catch (error) {
      console.error('Failed to sync pin reaction to Telegram:', error);
      throw error;
    }
  },

  /**
   * Search files using Telegram server-side search (messages.Search or messages.SearchGlobal)
   * @param {string} query
   * @param {object} options
   * @param {string|number} [options.channelId] - Optional channel/folder ID to restrict search
   * @param {array} [options.folders] - All folders (for global search mapping)
   * @param {string} [options.typeFilter] - UI type filter
   * @param {string} [options.timeFilter] - UI time filter
   * @returns {Promise<Array>}
   */
  async searchFiles(query, { channelId = null, folders = [], typeFilter = 'all', timeFilter = 'all' } = {}) {
    try {
      const client = telegramService.getClient();
      if (!client) return [];

      const { Api } = await import('telegram');
      
      let cleanQuery = query || '';
      let parsedFilter = null;

      // Parse query tokens like type:xxx or ext:xxx
      const typeMatch = cleanQuery.match(/\btype:(\w+)\b/i);
      const extMatch = cleanQuery.match(/\bext:(\w+)\b/i);

      if (typeMatch) {
        const typeVal = typeMatch[1].toLowerCase();
        cleanQuery = cleanQuery.replace(typeMatch[0], '').trim();
        if (['image', 'photo', 'photos'].includes(typeVal)) {
          parsedFilter = new Api.InputMessagesFilterPhotos({});
        } else if (['video', 'videos'].includes(typeVal)) {
          parsedFilter = new Api.InputMessagesFilterVideo({});
        } else if (['audio', 'music', 'voice'].includes(typeVal)) {
          parsedFilter = new Api.InputMessagesFilterMusic({});
        } else if (['document', 'file', 'files', 'pdf'].includes(typeVal)) {
          parsedFilter = new Api.InputMessagesFilterDocument({});
        }
      } else if (extMatch) {
        const extVal = extMatch[1].toLowerCase();
        cleanQuery = cleanQuery.replace(extMatch[0], '').trim();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extVal)) {
          parsedFilter = new Api.InputMessagesFilterPhotos({});
        } else if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(extVal)) {
          parsedFilter = new Api.InputMessagesFilterVideo({});
        } else if (['mp3', 'wav', 'flac', 'm4a', 'ogg'].includes(extVal)) {
          parsedFilter = new Api.InputMessagesFilterMusic({});
        } else {
          parsedFilter = new Api.InputMessagesFilterDocument({});
        }
      }

      let apiFilter = new Api.InputMessagesFilterEmpty();
      if (parsedFilter) {
        apiFilter = parsedFilter;
      } else if (typeFilter && typeFilter !== 'all') {
        if (typeFilter === 'image') apiFilter = new Api.InputMessagesFilterPhotos({});
        else if (typeFilter === 'video') apiFilter = new Api.InputMessagesFilterVideo({});
        else if (typeFilter === 'audio') apiFilter = new Api.InputMessagesFilterMusic({});
        else if (typeFilter === 'pdf') apiFilter = new Api.InputMessagesFilterDocument({});
      } else {
        const queryLower = cleanQuery.toLowerCase();
        if (queryLower.includes('.pdf') || queryLower.includes('.zip') || queryLower.includes('.rar') || queryLower.includes('.docx') || queryLower.includes('.xlsx') || queryLower.includes('.txt') || queryLower.includes('.dmg') || queryLower.includes('.apk')) {
          apiFilter = new Api.InputMessagesFilterDocument({});
        } else if (queryLower.includes('.jpg') || queryLower.includes('.jpeg') || queryLower.includes('.png') || queryLower.includes('.gif') || queryLower.includes('.webp')) {
          apiFilter = new Api.InputMessagesFilterPhotos({});
        } else if (queryLower.includes('.mp4') || queryLower.includes('.mov') || queryLower.includes('.avi') || queryLower.includes('.mkv')) {
          apiFilter = new Api.InputMessagesFilterVideo({});
        } else if (queryLower.includes('.mp3') || queryLower.includes('.wav') || queryLower.includes('.flac') || queryLower.includes('.m4a')) {
          apiFilter = new Api.InputMessagesFilterMusic({});
        }
      }

      let minDate = 0;
      if (timeFilter && timeFilter !== 'all') {
        const nowSec = Math.floor(Date.now() / 1000);
        if (timeFilter === 'today') minDate = nowSec - 24 * 3600;
        else if (timeFilter === 'week') minDate = nowSec - 7 * 24 * 3600;
        else if (timeFilter === 'month') minDate = nowSec - 30 * 24 * 3600;
      }

      let messages = [];

      if (channelId) {
        // Search inside a specific channel/folder
        const entity = await client.getEntity(channelId);
        const searchResult = await client.invoke(
          new Api.messages.Search({
            peer: entity,
            q: cleanQuery,
            filter: apiFilter,
            minDate: minDate || undefined,
            limit: 100,
          })
        );
        messages = searchResult.messages || [];
      } else {
        // Global search across all chats
        const searchResult = await client.invoke(
          new Api.messages.SearchGlobal({
            q: cleanQuery,
            filter: apiFilter,
            minDate: minDate || undefined,
            offsetRate: 0,
            offsetPeer: new Api.InputPeerEmpty(),
            offsetId: 0,
            limit: 150,
          })
        );
        messages = searchResult.messages || [];
      }

      // Map folder IDs
      const folderChannelIds = new Set(folders.map((f) => f.channelId.toString()));
      const folderMap = {};
      folders.forEach((f) => {
        folderMap[f.channelId.toString()] = f;
      });

      const files = [];

      for (const msg of messages) {
        // Resolve channel/chat ID of this message
        let msgChannelId = '';
        if (msg.peerId) {
          if (msg.peerId.channelId) {
            msgChannelId = `-100${msg.peerId.channelId.toString()}`;
          } else if (msg.peerId.chatId) {
            msgChannelId = `-${msg.peerId.chatId.toString()}`;
          } else if (msg.peerId.userId) {
            msgChannelId = msg.peerId.userId.toString();
          }
        }

        // If doing a global search, filter results to only include channels in our folders!
        if (!channelId && (!msgChannelId || !folderChannelIds.has(msgChannelId))) {
          continue;
        }

        const targetChannelId = channelId ? channelId.toString() : msgChannelId;
        const matchingFolder = folderMap[targetChannelId];
        const folderName = matchingFolder ? matchingFolder.name : 'Unknown';

        const msgReactions = msg.reactions;
        const hasStarReaction = !!(
          msgReactions &&
          msgReactions.results &&
          msgReactions.results.some(
            (r) => r.reaction && (r.reaction.emoticon === '❤️' || r.reaction.emoticon === '❤' || r.reaction.emoticon === '👍')
          )
        );

        if (msg.media?.document) {
          const doc = msg.media.document;
          const fileName = doc.attributes?.find(
            (a) => a.className === 'DocumentAttributeFilename'
          )?.fileName || 'Unknown File';

          files.push({
            id: `${msg.id}`,
            name: fileName,
            mimeType: doc.mimeType || 'application/octet-stream',
            size: Number(doc.size || 0),
            messageId: msg.id,
            channelId: targetChannelId,
            folderName: folderName,
            createdAt: msg.date,
            telegramFileId: doc.id?.toString() || '',
            starred: hasStarReaction ? 1 : 0,
            pinned: msg.pinned ? 1 : 0,
            reactions: msgReactions,
            views: msg.views || 0,
          });
        } else if (msg.media?.photo) {
          const photo = msg.media.photo;
          const sizes = photo.sizes || [];
          const largest = sizes[sizes.length - 1];

          files.push({
            id: `${msg.id}`,
            name: `photo_${msg.id}.jpg`,
            mimeType: 'image/jpeg',
            size: largest?.size || 0,
            messageId: msg.id,
            channelId: targetChannelId,
            folderName: folderName,
            createdAt: msg.date,
            telegramFileId: photo.id?.toString() || '',
            isPhoto: true,
            starred: hasStarReaction ? 1 : 0,
            pinned: msg.pinned ? 1 : 0,
            reactions: msgReactions,
            views: msg.views || 0,
          });
        }
      }

      return files;
    } catch (error) {
      console.error('Search files failed:', error);
      throw error;
    }
  },

  /**
   * Rename a file and update tags by editing its caption
   */
  async renameFile(channelId, messageId, newName, tags = []) {
    try {
      const caption = buildCaption(newName, tags);
      await telegramService.editMessage(channelId, Number(messageId), caption);
      return { name: newName, tags, caption };
    } catch (error) {
      console.error('Rename failed:', error);
      throw error;
    }
  },
};

export default filesService;
