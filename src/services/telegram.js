import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Buffer } from 'buffer';
import bigInt from 'big-integer';


const SESSION_KEY = 'teledrive_session';

class TelegramService {
  constructor() {
    this.client = null;
  }

  /**
   * Returns the singleton TelegramClient instance.
   */
  getClient() {
    return this.client;
  }

  /**
   * Creates and connects the TelegramClient using a StringSession
   * restored from localStorage.
   * @param {number|string} apiId - Telegram API ID
   * @param {string} apiHash - Telegram API Hash
   */
  async init(apiId, apiHash) {
    try {
      const savedSession = localStorage.getItem(SESSION_KEY) || '';
      const session = new StringSession(savedSession);

      this.client = new TelegramClient(session, Number(apiId), apiHash, {
        connectionRetries: 5,
      });

      await this.client.connect();
    } catch (error) {
      console.error('[TelegramService] init failed:', error);
      throw error;
    }
  }

  /**
   * Sends an authentication code to the given phone number.
   * @param {string} phoneNumber
   * @returns {Promise<string>} phoneCodeHash
   */
  async sendCode(phoneNumber) {
    try {
      const result = await this.client.sendCode(
        {
          apiId: this.client.apiId,
          apiHash: this.client.apiHash,
        },
        phoneNumber
      );
      return result.phoneCodeHash;
    } catch (error) {
      console.error('[TelegramService] sendCode failed:', error);
      throw error;
    }
  }

  /**
   * Signs in with phone number, code hash, and the code the user received.
   * Saves the session string to localStorage on success.
   * @param {string} phoneNumber
   * @param {string} phoneCodeHash
   * @param {string} code
   * @returns {Promise<object>} The signed-in user
   */
  async signIn(phoneNumber, phoneCodeHash, code) {
    try {
      const result = await this.client.invoke(
        new Api.auth.SignIn({
          phoneNumber,
          phoneCodeHash,
          phoneCode: code,
        })
      );

      const sessionString = this.client.session.save();
      localStorage.setItem(SESSION_KEY, sessionString);

      return result;
    } catch (error) {
      console.error('[TelegramService] signIn failed:', error);
      throw error;
    }
  }

  /**
   * Signs in using a 2FA password.
   * Saves the session string to localStorage on success.
   * @param {string} password
   * @returns {Promise<object>} The signed-in user
   */
  async signInWith2FA(password) {
    try {
      const result = await this.client.signInWithPassword(
        {
          apiId: this.client.apiId,
          apiHash: this.client.apiHash,
        },
        {
          password: () => password,
        }
      );

      const sessionString = this.client.session.save();
      localStorage.setItem(SESSION_KEY, sessionString);

      return result;
    } catch (error) {
      console.error('[TelegramService] signInWith2FA failed:', error);
      throw error;
    }
  }

  /**
   * Checks whether the client is connected and authorized.
   * @returns {Promise<boolean>}
   */
  async isLoggedIn() {
    try {
      if (!this.client || !this.client.connected) {
        return false;
      }
      const authorized = await this.client.isUserAuthorized();
      return authorized;
    } catch (error) {
      console.error('[TelegramService] isLoggedIn check failed:', error);
      return false;
    }
  }

  /**
   * Gets the currently authenticated user's info.
   * @returns {Promise<object>}
   */
  async getMe() {
    try {
      const me = await this.client.getMe();
      return me;
    } catch (error) {
      console.error('[TelegramService] getMe failed:', error);
      throw error;
    }
  }

  /**
   * Logs out the current user and clears the session from localStorage.
   */
  async logout() {
    try {
      await this.client.invoke(new Api.auth.LogOut());
      localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      console.error('[TelegramService] logout failed:', error);
      localStorage.removeItem(SESSION_KEY);
      throw error;
    }
  }

  /**
   * Creates a private channel (not a megagroup, not a broadcast).
   * @param {string} title
   * @param {string} about
   * @returns {Promise<object>} The channel entity with its ID
   */
  async createChannel(title, about) {
    try {
      const result = await this.client.invoke(
        new Api.channels.CreateChannel({
          title,
          about,
          megagroup: false,
        })
      );

      const channel = result.chats[0];
      return channel;
    } catch (error) {
      console.error('[TelegramService] createChannel failed:', error);
      throw error;
    }
  }

  /**
   * Deletes a channel by its ID.
   * @param {string|number} channelId
   */
  async deleteChannel(channelId) {
    try {
      const channel = await this.client.getEntity(channelId);
      await this.client.invoke(
        new Api.channels.DeleteChannel({
          channel,
        })
      );
    } catch (error) {
      console.error('[TelegramService] deleteChannel failed:', error);
      throw error;
    }
  }

  /**
   * Fetches all channels and groups the user is a member of.
   * @returns {Promise<Array>} List of drive channel objects
   */
  async getChannels() {
    try {
      if (!this.client) return [];
      const dialogs = await this.client.getDialogs({});
      
      // Keep only channels and groups
      const channelDialogs = dialogs.filter((d) => d.isChannel || d.isGroup);
      
      return channelDialogs.map((d) => {
        const entity = d.entity;
        
        // In channels, only creator or admins can post (write)
        let canPost = true;
        if (d.isChannel && entity?.broadcast) {
          canPost = !!(entity.creator || entity.adminRights);
        }
        
        return {
          id: d.id.toString(),
          title: d.title,
          entity: entity,
          canPost,
        };
      });
    } catch (error) {
      console.error('[TelegramService] getChannels failed:', error);
      throw error;
    }
  }

  /**
   * Gets detailed info about a channel.
   * @param {string|number} channelId
   * @returns {Promise<object>} Channel details
   */
  async getChannelInfo(channelId) {
    try {
      const channel = await this.client.getEntity(channelId);
      const result = await this.client.invoke(
        new Api.channels.GetFullChannel({
          channel,
        })
      );
      return result;
    } catch (error) {
      console.error('[TelegramService] getChannelInfo failed:', error);
      throw error;
    }
  }

  /**
   * Sends a file as a document to a channel.
   * Converts browser File object to Buffer for GramJS compatibility.
   * @param {string|number} channelId
   * @param {File} file - Browser File object
   * @param {string} fileName
   * @param {function} onProgress - Progress callback (0-100)
   * @returns {Promise<object>} The sent message
   */
  async sendFile(channelId, file, fileName, caption = '', onProgress) {
    try {
      const channel = await this._resolveEntity(channelId);
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // GramJS requires a CustomFile wrapping the buffer
      const { CustomFile, uploadFile } = await import('telegram/client/uploads');
      const customFile = new CustomFile(
        fileName || file.name,
        buffer.length,
        '',      // no file path (browser)
        buffer   // in-memory buffer
      );

      // Directly upload the file using uploadFile to bypass the GramJS browser bug for files > 20MB.
      // Setting maxBufferSize larger than buffer.length forces GramJS to use the memory buffer.
      const fileHandle = await uploadFile(this.client, {
        file: customFile,
        workers: 1,
        onProgress: onProgress
          ? (progress) => {
              onProgress(Math.round(progress * 100));
            }
          : undefined,
        maxBufferSize: buffer.length + 1024,
      });

      const result = await this.client.sendFile(channel, {
        file: fileHandle,
        forceDocument: true,
        caption: caption,
        workers: 1,
      });

      return result;

    } catch (error) {
      console.error('[TelegramService] sendFile failed:', error);
      throw error;
    }
  }

  /**
   * Gets messages from a channel (for listing uploaded files).
   * @param {object|string|number} channelOrId - Channel entity or ID
   * @param {number} limit - Max number of messages to return
   * @param {number} offsetId - Message ID offset for pagination
   * @returns {Promise<object[]>} Array of messages
   */
  async getMessages(channelOrId, limit = 100, offsetId = 0) {
    try {
      const channel = typeof channelOrId === 'object'
        ? channelOrId
        : await this.client.getEntity(channelOrId);
      const messages = await this.client.getMessages(channel, {
        limit,
        offsetId: offsetId || undefined,
      });
      return messages;
    } catch (error) {
      console.error('[TelegramService] getMessages failed:', error);
      throw error;
    }
  }

  /**
   * Downloads media from a message.
   * @param {object} message - The message containing media
   * @param {function} onProgress - Progress callback (0-100)
   * @returns {Promise<Buffer>} The downloaded file as a Buffer
   */
  async downloadMedia(message, onProgress) {
    try {
      const buffer = await this.client.downloadMedia(message, {
        workers: 8,
        progressCallback: onProgress
          ? (downloaded, total) => {
              const percent = total ? Math.round((downloaded / total) * 100) : 0;
              onProgress(percent);
            }
          : undefined,
      });
      return buffer;
    } catch (error) {
      console.error('[TelegramService] downloadMedia failed:', error);
      throw error;
    }
  }

  /**
   * Helper to resolve entity - accepts entity object or ID
   */
  async _resolveEntity(channelOrId) {
    if (typeof channelOrId === 'object' && channelOrId !== null) {
      return channelOrId;
    }
    return await this.client.getEntity(channelOrId);
  }

  /**
   * Deletes messages from a channel.
   * @param {object|string|number} channelOrId
   * @param {number[]} messageIds - Array of message IDs to delete
   */
  async deleteMessages(channelOrId, messageIds) {
    try {
      const channel = await this._resolveEntity(channelOrId);
      await this.client.invoke(
        new Api.channels.DeleteMessages({
          channel,
          id: messageIds,
        })
      );
    } catch (error) {
      console.error('[TelegramService] deleteMessages failed:', error);
      throw error;
    }
  }

  /**
   * Pins or unpins a message in a channel.
   * @param {object|string|number} channelOrId
   * @param {number} messageId
   * @param {boolean} unpin
   */
  async pinMessage(channelOrId, messageId, unpin = false) {
    try {
      const channel = await this._resolveEntity(channelOrId);
      await this.client.invoke(
        new Api.messages.UpdatePinnedMessage({
          peer: channel,
          id: messageId,
          unpin: unpin,
        })
      );
    } catch (error) {
      console.error('[TelegramService] pinMessage failed:', error);
      throw error;
    }
  }

  /**
   * Sends a text message to a channel (useful for metadata).
   * @param {object|string|number} channelOrId
   * @param {string} text
   * @returns {Promise<object>} The sent message
   */
  async sendMessage(channelOrId, text) {
    try {
      const channel = await this._resolveEntity(channelOrId);
      const result = await this.client.sendMessage(channel, {
        message: text,
      });
      return result;
    } catch (error) {
      console.error('[TelegramService] sendMessage failed:', error);
      throw error;
    }
  }

  /**
   * Edits a text message in a channel.
   * @param {object|string|number} channelOrId
   * @param {number} messageId
   * @param {string} text
   * @returns {Promise<object>} The edited message
   */
  async editMessage(channelOrId, messageId, text) {
    try {
      const channel = await this._resolveEntity(channelOrId);
      const result = await this.client.invoke(
        new Api.messages.EditMessage({
          peer: channel,
          id: messageId,
          message: text,
        })
      );
      return result;
    } catch (error) {
      console.error('[TelegramService] editMessage failed:', error);
      throw error;
    }
  }

  /**
   * Generates a Telegram invite link for a channel.
   * @param {string|number} channelId
   * @returns {Promise<string>} The invite link
   */
  async generateInviteLink(channelId) {
    try {
      const channel = await this._resolveEntity(channelId);
      const result = await this.client.invoke(
        new Api.messages.ExportChatInvite({
          peer: channel,
        })
      );
      return result.link;
    } catch (error) {
      console.error('[TelegramService] generateInviteLink failed:', error);
      throw error;
    }
  }

  /**
   * Invites a user by username to a channel.
   * @param {string|number} channelId
   * @param {string} username
   * @returns {Promise<object>} The invite result and the user object
   */
  async inviteUserToChannel(channelId, username) {
    try {
      const channel = await this._resolveEntity(channelId);
      const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
      const user = await this.client.getEntity(cleanUsername);
      
      const result = await this.client.invoke(
        new Api.channels.InviteToChannel({
          channel,
          users: [user],
        })
      );
      return { result, user };
    } catch (error) {
      console.error('[TelegramService] inviteUserToChannel failed:', error);
      throw error;
    }
  }

  /**
   * Downloads a specific byte range of a message's media document from Telegram.
   * @param {string|number} channelId
   * @param {string|number} messageId
   * @param {number} start
   * @param {number} end
   * @returns {Promise<ArrayBuffer>} The downloaded range as a clean ArrayBuffer
   */
  async downloadRange(channelId, messageId, start, end) {
    try {
      if (!this.client) {
        throw new Error('Telegram client not initialized');
      }
      const channel = await this._resolveEntity(channelId);
      const messages = await this.client.getMessages(channel, {
        ids: [Number(messageId)],
      });

      if (!messages || messages.length === 0) {
        throw new Error('Message not found');
      }

      const message = messages[0];
      const doc = message.media?.document;
      if (!doc) {
        throw new Error('Message does not contain document media');
      }

      const fileLocation = new Api.InputDocumentFileLocation({
        id: doc.id,
        accessHash: doc.accessHash,
        fileReference: doc.fileReference,
        thumbSize: '',
      });

      const startOffset = bigInt(start);
      const rangeLength = end - start + 1;

      // iterDownload yields chunks. We choose a size at least 64KB, aligned to 4096 bytes.
      const requestSize = Math.max(64 * 1024, rangeLength);
      const alignedRequestSize = Math.ceil(requestSize / 4096) * 4096;

      let bytes = Buffer.alloc(0);
      for await (const chunk of this.client.iterDownload({
        file: fileLocation,
        offset: startOffset,
        dcId: doc.dcId,
        requestSize: alignedRequestSize,
      })) {
        bytes = Buffer.concat([bytes, chunk]);
        if (bytes.length >= rangeLength) {
          break;
        }
      }

      // Slice the exact bytes requested and return a clean, non-pooled ArrayBuffer
      const finalBytes = bytes.slice(0, rangeLength);
      const cleanUint8 = new Uint8Array(finalBytes.length);
      cleanUint8.set(finalBytes);
      return cleanUint8.buffer;
    } catch (error) {
      console.error('[TelegramService] downloadRange failed:', error);
      throw error;
    }
  }
}

const telegramService = new TelegramService();
export default telegramService;
