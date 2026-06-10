import telegramService from './telegram';

const FOLDER_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f97316', '#ef4444'];

const METADATA_CHANNEL_TITLE = '__TeleDrive__';

const metadataService = {
  _channel: null,
  _pinnedMessageId: null,
  _folders: [],
  _canPost: true,

  /**
   * Initializes the metadata channel and loads folders list.
   * @param {object} customChannelEntity - Optional Telegram channel to act as Shared Drive.
   * @param {boolean} canPost - If the user has posting permissions.
   */
  async init(customChannelEntity = null, canPost = true) {
    const client = telegramService.getClient();
    this._pinnedMessageId = null;
    this._folders = [];

    if (customChannelEntity) {
      this._channel = customChannelEntity;
      this._canPost = canPost;
    } else {
      // Search for default metadata channel '__TeleDrive__'
      let dialogs = [];
      try {
        dialogs = await client.getDialogs({});
      } catch (err) {
        console.warn('Failed to get dialogs:', err.message);
      }

      let metaDialog = dialogs.find(
        (d) => d.isChannel && d.title === METADATA_CHANNEL_TITLE
      );

      if (metaDialog) {
        this._channel = metaDialog.entity;
      } else {
        // Create the default metadata channel
        const result = await telegramService.createChannel(
          METADATA_CHANNEL_TITLE,
          'TeleDrive metadata storage'
        );
        this._channel = result;
      }
      this._canPost = true;
    }

    // Load folders metadata from channel
    try {
      const channelEntity = this._channel;
      const messages = await telegramService.getMessages(channelEntity, 20, 0);

      // Find the metadata message (contains JSON with version field)
      let metaMessage = null;
      for (const msg of messages) {
        if (msg.message) {
          try {
            const parsed = JSON.parse(msg.message);
            if (parsed.version) {
              metaMessage = msg;
              this._folders = parsed.folders || [];
              break;
            }
          } catch {}
        }
      }

      if (metaMessage) {
        this._pinnedMessageId = metaMessage.id;
      } else {
        // Create initial metadata message if we have write permission
        if (this._canPost) {
          const initialData = JSON.stringify(
            { version: 1, folders: [] },
            null,
            2
          );
          const sent = await telegramService.sendMessage(channelEntity, initialData);
          this._pinnedMessageId = sent.id;
          try {
            await telegramService.pinMessage(channelEntity, sent.id, false);
          } catch (pinErr) {
            console.warn('Failed to pin initial metadata message:', pinErr);
          }
        }
        this._folders = [];
      }
    } catch (err) {
      console.error('Failed to load metadata:', err);
      // Try to create initial metadata message if missing and we have permissions
      if (this._canPost) {
        try {
          const initialData = JSON.stringify({ version: 1, folders: [] }, null, 2);
          const sent = await telegramService.sendMessage(this._channel, initialData);
          this._pinnedMessageId = sent.id;
          try {
            await telegramService.pinMessage(this._channel, sent.id, false);
          } catch (pinErr) {
            console.warn('Failed to pin metadata:', pinErr);
          }
        } catch (sendErr) {
          console.error('Failed to create initial metadata:', sendErr);
        }
      }
      this._folders = [];
    }

    return this._folders;
  },

  getFolders() {
    return [...this._folders];
  },

  async addFolder(name, channelId, color) {
    if (!this._canPost) {
      throw new Error('Permission denied: cannot modify read-only drive folders.');
    }

    const folder = {
      id: `folder_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name,
      channelId: String(channelId),
      createdAt: Math.floor(Date.now() / 1000),
      color: color || FOLDER_COLORS[this._folders.length % FOLDER_COLORS.length],
    };

    this._folders.push(folder);
    await this._saveMetadata();
    return folder;
  },

  async removeFolder(folderId) {
    if (!this._canPost) {
      throw new Error('Permission denied: cannot modify read-only drive folders.');
    }
    this._folders = this._folders.filter((f) => f.id !== folderId);
    await this._saveMetadata();
  },

  async renameFolder(folderId, newName) {
    if (!this._canPost) {
      throw new Error('Permission denied: cannot modify read-only drive folders.');
    }
    const folder = this._folders.find((f) => f.id === folderId);
    if (folder) {
      folder.name = newName;
      await this._saveMetadata();
    }
    return folder || null;
  },

  async _saveMetadata() {
    if (!this._canPost) {
      throw new Error('Permission denied: cannot write folders metadata to this read-only drive.');
    }
    const data = JSON.stringify(
      { version: 1, folders: this._folders },
      null,
      2
    );

    try {
      if (this._pinnedMessageId) {
        await telegramService.editMessage(this._channel, this._pinnedMessageId, data);
      } else {
        const sent = await telegramService.sendMessage(this._channel, data);
        this._pinnedMessageId = sent.id;
        try {
          await telegramService.pinMessage(this._channel, sent.id, false);
        } catch (pinErr) {
          console.warn('Failed to pin metadata message:', pinErr);
        }
      }
    } catch (err) {
      console.error('Failed to save metadata:', err);
      throw err;
    }
  },

  async createFolder(name) {
    if (!this._canPost) {
      throw new Error('Permission denied: cannot create folders in this read-only drive.');
    }
    const color = FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)];

    // Create a dedicated Telegram channel for this folder
    const channel = await telegramService.createChannel(
      name,
      `TeleDrive folder: ${name}`
    );

    const channelId = `-100${channel.id}`;
    const folder = await this.addFolder(name, channelId, color);
    return folder;
  },

  async deleteFolder(folderId) {
    if (!this._canPost) {
      throw new Error('Permission denied: cannot delete folders in this read-only drive.');
    }
    const folder = this._folders.find((f) => f.id === folderId);
    if (!folder) return;

    // Delete the Telegram channel
    try {
      await telegramService.deleteChannel(folder.channelId);
    } catch (err) {
      console.error('Failed to delete Telegram channel:', err);
    }

    await this.removeFolder(folderId);
  },
};

export default metadataService;
