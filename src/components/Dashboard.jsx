import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Header from './Header';
import FolderView from './FolderView';
import FileGrid from './FileGrid';
import UploadZone from './UploadZone';
import FilePreview from './FilePreview';
import ShareModal from './ShareModal';
import metadataService from '../services/metadata';
import filesService from '../services/files';
import cacheService from '../services/cache';
import {
  Loader2,
  LayoutGrid,
  List,
  ChevronRight,
  FolderClosed,
  Clock,
  Star,
  Trash2,
  Users,
  Monitor,
  AlertCircle,
  HardDrive,
  FolderPlus,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  CheckCircle2,
  Upload,
  Hash
} from 'lucide-react';
import { formatBytes, truncateFileName, parseTagsInput, buildCaption } from '../utils/helpers';

export default function Dashboard() {
  const { user } = useAuth();
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [previewWithDetails, setPreviewWithDetails] = useState(false);
  const [error, setError] = useState(null);

  // Switcher state
  const [drives, setDrives] = useState([]);
  const [activeDrive, setActiveDrive] = useState(null);

  // Redesign state
  const [activeTab, setActiveTab] = useState('my-drive'); // 'home' | 'my-drive' | 'computers' | 'shared' | 'recent' | 'starred' | 'spam' | 'trash' | 'storage'
  const [storageUsed, setStorageUsed] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Auto collapse sidebar on mobile
  useEffect(() => {
    const checkScreenSize = () => {
      if (window.innerWidth <= 768) {
        setIsSidebarCollapsed(true);
      } else {
        setIsSidebarCollapsed(false);
      }
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const creatingRef = useRef(false);

  // Share modal state
  const [shareItem, setShareItem] = useState(null);
  const [shareType, setShareType] = useState('folder'); // 'folder' | 'file'

  const handleShareFolder = (folder) => {
    setShareItem(folder);
    setShareType('folder');
  };

  const handleShareFile = (file) => {
    setShareItem(file);
    setShareType('file');
  };

  // Filters state
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'image' | 'video' | 'audio' | 'pdf'
  const [timeFilter, setTimeFilter] = useState('all'); // 'all' | 'today' | 'week' | 'month'

  // File Transfers (Uploads & Downloads) State
  const [transfers, setTransfers] = useState([]);

  // Tag & Rename State
  const [tags, setTags] = useState([]);
  const [uploadFilesQueue, setUploadFilesQueue] = useState([]);
  const [uploadTags, setUploadTags] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [renameFile, setRenameFile] = useState(null);
  const [renameFileName, setRenameFileName] = useState('');
  const [renameFileTags, setRenameFileTags] = useState('');
  const [renamingFile, setRenamingFile] = useState(false);
  const [showTransfers, setShowTransfers] = useState(false);
  const [transfersMinimized, setTransfersMinimized] = useState(false);
  const fileInputRef = useRef(null);

  // Switch drive helper
  const handleSwitchDrive = async (drive) => {
    setLoadingFiles(true);
    try {
      setActiveDrive(drive);
      localStorage.setItem('teledrive_active_drive_id', drive.id);
      setCurrentFolder(null); // Clear selected folder context
      setFiles([]);
      
      const folderList = await metadataService.init(drive.entity, drive.canPost);
      const uniqueFolders = [];
      const seenIds = new Set();
      for (const f of folderList) {
        if (!seenIds.has(f.id)) {
          seenIds.add(f.id);
          uniqueFolders.push(f);
        }
      }
      setFolders(uniqueFolders);
      await cacheService.syncFolders(uniqueFolders);
      
      // Update storage and files list
      await updateStorageMetric(uniqueFolders);
    } catch (err) {
      console.error('Failed to switch drive:', err);
      setError('Failed to switch drive content.');
    } finally {
      setLoadingFiles(false);
    }
  };

  // Initialize folders and calculate storage on load
  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Ensure Telegram client is initialized
      const client = (await import('../services/telegram')).default;
      if (!client.getClient()) {
        const config = JSON.parse(localStorage.getItem('teledrive_api_config') || '{}');
        if (config.apiId && config.apiHash) {
          await client.init(config.apiId, config.apiHash);
        }
      }

      // Fetch drives
      const personalDrive = { id: 'personal', title: 'My Drive', entity: null, canPost: true };
      let fetchedChannels = [];
      try {
        fetchedChannels = await client.getChannels();
      } catch (chErr) {
        console.warn('Failed to fetch Telegram channels:', chErr);
      }
      const allDrives = [personalDrive, ...fetchedChannels];
      setDrives(allDrives);

      const storedDriveId = localStorage.getItem('teledrive_active_drive_id');
      const active = allDrives.find((d) => d.id === storedDriveId) || personalDrive;
      setActiveDrive(active);

      const folderList = await metadataService.init(active.entity, active.canPost);
      // Filter out any duplicate folders by ID to clean up already duplicated data
      const uniqueFolders = [];
      const seenIds = new Set();
      for (const f of folderList) {
        if (!seenIds.has(f.id)) {
          seenIds.add(f.id);
          uniqueFolders.push(f);
        }
      }
      setFolders(uniqueFolders);
      await cacheService.syncFolders(uniqueFolders);

      // Refresh storage metric
      await updateStorageMetric(uniqueFolders);

      // Refresh tags
      const allTags = await cacheService.getAllTags();
      setTags(allTags);
      
      // Parse initial URL slug
      await parseHash(uniqueFolders);
    } catch (err) {
      console.error('Failed to init dashboard:', err);
      setError('Failed to load TeleDrive folders. Please check your credentials or refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const isReadOnly = activeDrive ? !activeDrive.canPost : false;
    if (isReadOnly) return;

    if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
      dragCounterRef.current++;
      setIsDragOverCanvas(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      setIsDragOverCanvas(false);
      dragCounterRef.current = 0;
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragOverCanvas(false);
    dragCounterRef.current = 0;

    const isReadOnly = activeDrive ? !activeDrive.canPost : false;
    if (isReadOnly) return;

    if (!currentFolder) {
      alert('Please open a folder under My Drive to upload files.');
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleUploadFiles(files);
    }
  };

  const pendingFileIdRef = useRef(null);

  // Sync state to URL hash
  useEffect(() => {
    if (loading) return;

    let hash = '';
    if (previewFile) {
      if (currentFolder) {
        hash = `#/folder/${currentFolder.id}/file/${previewFile.id}`;
      } else {
        hash = `#/tab/${encodeURIComponent(activeTab)}/file/${previewFile.id}`;
      }
    } else if (currentFolder) {
      hash = `#/folder/${currentFolder.id}`;
    } else {
      hash = `#/tab/${encodeURIComponent(activeTab)}`;
    }

    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
  }, [activeTab, currentFolder, previewFile, loading]);

  // Sync URL hash to state
  const parseHash = async (folderList = folders) => {
    const hash = window.location.hash;
    if (!hash) {
      setActiveTab('my-drive');
      setCurrentFolder(null);
      setPreviewFile(null);
      return;
    }

    const parts = hash.split('/');
    let tab = 'my-drive';
    let folder = null;
    let fileId = null;

    if (parts[1] === 'folder') {
      const folderId = parts[2];
      tab = 'my-drive';
      if (folderId && folderList.length > 0) {
        folder = folderList.find((f) => f.id === folderId) || null;
      }
    } else if (parts[1] === 'tab') {
      tab = decodeURIComponent(parts[2] || 'my-drive');
    }

    const fileIndex = parts.indexOf('file');
    if (fileIndex !== -1 && parts[fileIndex + 1]) {
      fileId = parts[fileIndex + 1];
    }

    setActiveTab(tab);
    setCurrentFolder(folder);

    if (fileId) {
      pendingFileIdRef.current = fileId;
    } else {
      setPreviewFile(null);
      pendingFileIdRef.current = null;
    }
  };

  // Listen to hash change
  useEffect(() => {
    if (loading) return;
    parseHash();

    const handleHashChange = () => {
      parseHash();
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [folders, loading]);

  // Sync storage metric
  const updateStorageMetric = async (foldersList = folders) => {
    try {
      const recentFiles = await cacheService.getRecentFiles(10000);
      const activeFolderIds = new Set(foldersList.map((f) => f.id));
      const activeFiles = recentFiles.filter((f) => activeFolderIds.has(f.folderId));
      const total = activeFiles.reduce((acc, f) => acc + (f.size || 0), 0);
      setStorageUsed(total);
    } catch (err) {
      console.error('Failed to update storage metric:', err);
    }
  };

  // Load files based on activeTab and currentFolder
  useEffect(() => {
    const loadTabFiles = async () => {
      setLoadingFiles(true);
      try {
        let loadedFiles = [];
        const activeFolderIds = new Set(folders.map((f) => f.id));

        if (currentFolder) {
          // Inside a folder (My Drive or Shared Drive folder)
          // Try local cache first
          const cachedFiles = await cacheService.getFiles(currentFolder.id);
          if (cachedFiles.length > 0) {
            setFiles(cachedFiles);
            loadedFiles = cachedFiles;
          }

          // Fetch fresh from Telegram
          const freshFiles = await filesService.listFiles(currentFolder.channelId);
          setFiles(freshFiles);
          loadedFiles = freshFiles;
          await cacheService.cacheFiles(currentFolder.id, freshFiles);
        } else if (activeTab === 'recent') {
          // Recent tab
          const recent = await cacheService.getRecentFiles(50);
          const filteredRecent = recent.filter((f) => activeFolderIds.has(f.folderId));
          setFiles(filteredRecent);
          loadedFiles = filteredRecent;
        } else if (activeTab === 'starred') {
          // Starred tab
          const starred = await cacheService.getStarredFiles();
          const filteredStarred = starred.filter((f) => activeFolderIds.has(f.folderId));
          setFiles(filteredStarred);
          loadedFiles = filteredStarred;
        } else if (activeTab === 'storage') {
          // Storage tab (sorted by size descending)
          const dbFiles = await cacheService.getRecentFiles(1000);
          const filteredDbFiles = dbFiles.filter((f) => activeFolderIds.has(f.folderId));
          const sorted = [...filteredDbFiles].sort((a, b) => (b.size || 0) - (a.size || 0));
          setFiles(sorted);
          loadedFiles = sorted;
        } else if (activeTab === 'home') {
          // Home tab (shows folders and most recent 10 files)
          const recent = await cacheService.getRecentFiles(10);
          const filteredRecent = recent.filter((f) => activeFolderIds.has(f.folderId));
          setFiles(filteredRecent);
          loadedFiles = filteredRecent;
        } else if (activeTab.startsWith('tag-')) {
          // Tag tab
          const tagName = activeTab.replace('tag-', '');
          const tagFiles = await cacheService.getFilesByTag(tagName);
          const filteredTagFiles = tagFiles.filter((f) => activeFolderIds.has(f.folderId));
          setFiles(filteredTagFiles);
          loadedFiles = filteredTagFiles;
        } else {
          // Other placeholder tabs
          setFiles([]);
        }

        // Auto-preview file if pending file ID exists
        if (pendingFileIdRef.current) {
          const fileToPreview = loadedFiles.find((f) => f.id === pendingFileIdRef.current);
          if (fileToPreview) {
            setPreviewFile(fileToPreview);
            pendingFileIdRef.current = null;
          } else {
            // Check cache service directly
            const cachedFile = await cacheService.getFile(pendingFileIdRef.current);
            if (cachedFile && activeFolderIds.has(cachedFile.folderId)) {
              setPreviewFile(cachedFile);
              pendingFileIdRef.current = null;
            }
          }
        }

        await updateStorageMetric(folders);
        const allTags = await cacheService.getAllTags();
        setTags(allTags);
      } catch (err) {
        console.error('Failed to load tab files:', err);
      } finally {
        setLoadingFiles(false);
      }
    };

    loadTabFiles();
  }, [currentFolder, activeTab, activeDrive, folders]);

  // Debounce search query to avoid spamming Telegram API
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Execute server-side search via Telegram API when query or filters change
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedSearchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await filesService.searchFiles(debouncedSearchQuery, {
          channelId: currentFolder ? currentFolder.channelId : null,
          folders: folders,
          typeFilter: typeFilter,
          timeFilter: timeFilter,
        });
        setSearchResults(results);
      } catch (err) {
        console.error('[Dashboard] Telegram Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedSearchQuery, currentFolder, folders, typeFilter, timeFilter]);

  const handleCreateFolder = async (e) => {
    if (e) e.preventDefault();
    if (activeDrive && !activeDrive.canPost) {
      alert('Permission denied: cannot create folders in this read-only drive.');
      return;
    }
    if (!newFolderName.trim() || creatingFolder || creatingRef.current) return;

    try {
      creatingRef.current = true;
      setCreatingFolder(true);
      const newFolder = await metadataService.createFolder(newFolderName.trim());
      
      setFolders((prev) => {
        if (prev.some(f => f.id === newFolder.id)) return prev;
        const updated = [...prev, newFolder];
        cacheService.syncFolders(updated);
        return updated;
      });
      
      setNewFolderName('');
      setShowCreateFolderModal(false);
      
      // Navigate to My Drive and open the folder automatically!
      setActiveTab('my-drive');
      setCurrentFolder(newFolder);
    } catch (err) {
      console.error('Failed to create folder:', err);
      alert('Failed to create folder. Please try again.');
    } finally {
      creatingRef.current = false;
      setCreatingFolder(false);
    }
  };

  const handleDeleteFolder = async (folderId) => {
    if (activeDrive && !activeDrive.canPost) {
      alert('Permission denied: cannot delete folders in this read-only drive.');
      return;
    }
    try {
      await metadataService.deleteFolder(folderId);
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      if (currentFolder?.id === folderId) {
        setCurrentFolder(null);
      }
      await updateStorageMetric();
    } catch (err) {
      console.error('Failed to delete folder:', err);
      throw err;
    }
  };

  const handleRenameFolder = async (folderId, newName) => {
    if (activeDrive && !activeDrive.canPost) {
      alert('Permission denied: cannot rename folders in this read-only drive.');
      return;
    }
    try {
      await metadataService.renameFolder(folderId, newName);
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, name: newName } : f))
      );
      if (currentFolder?.id === folderId) {
        setCurrentFolder((prev) => ({ ...prev, name: newName }));
      }
    } catch (err) {
      console.error('Failed to rename folder:', err);
      throw err;
    }
  };

  const handleOpenFolder = (folder) => {
    setActiveTab('my-drive');
    setCurrentFolder(folder);
  };

  const handleGoBack = () => {
    setCurrentFolder(null);
    setFiles([]);
  };

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    setCurrentFolder(null); // Clear folder context when switching navigation tabs
    setFiles([]);
    setTypeFilter('all');
    setTimeFilter('all');
  };

  const handleConfirmUpload = (e) => {
    if (e) e.preventDefault();
    const parsedTags = parseTagsInput(uploadTags);
    setShowUploadModal(false);
    handleStartUpload(uploadFilesQueue, parsedTags);
    setUploadFilesQueue([]);
  };

  const handleUploadFiles = (filesList) => {
    if (activeDrive && !activeDrive.canPost) {
      alert('Permission denied: cannot upload files to this read-only drive.');
      return;
    }
    if (!currentFolder) return;
    setUploadFilesQueue(Array.from(filesList));
    setUploadTags('');
    setShowUploadModal(true);
  };

  const handleStartUpload = async (filesList, tagsList = []) => {
    if (activeDrive && !activeDrive.canPost) {
      alert('Permission denied: cannot upload files to this read-only drive.');
      return;
    }
    if (!currentFolder) return;
    
    setShowTransfers(true);
    setTransfersMinimized(false);

    // Build the space separated tags caption e.g. "#invoice #receipt"
    const captionStr = buildCaption('', tagsList).trim();

    const newTransfers = Array.from(filesList).map((file) => ({
      id: `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'pending',
      type: 'upload',
      file,
      folderId: currentFolder.id,
      channelId: currentFolder.channelId,
      caption: captionStr ? `${file.name} ${captionStr}` : '',
    }));

    setTransfers((prev) => [...prev, ...newTransfers]);

    for (const transfer of newTransfers) {
      try {
        setTransfers((prev) =>
          prev.map((t) =>
            t.id === transfer.id ? { ...t, status: 'uploading' } : t
          )
        );

        const result = await filesService.uploadFile(
          transfer.channelId,
          transfer.file,
          transfer.caption || '',
          (progress) => {
            setTransfers((prev) => {
              if (!prev.some(t => t.id === transfer.id)) return prev;
              return prev.map((t) =>
                t.id === transfer.id ? { ...t, progress } : t
              );
            });
          }
        );

        await cacheService.addFile({ ...result, folderId: transfer.folderId });

        setTransfers((prev) => {
          if (!prev.some(t => t.id === transfer.id)) return prev;
          return prev.map((t) =>
            t.id === transfer.id ? { ...t, status: 'done', progress: 100 } : t
          );
        });

        // Add file to active files list if user is still inside the target folder
        setCurrentFolder((current) => {
          if (current && current.id === transfer.folderId) {
            setFiles((prev) => {
              // Avoid duplicates
              if (prev.some(f => f.id === result.id)) return prev;
              return [result, ...prev];
            });
          }
          return current;
        });

        await updateStorageMetric();
        const allTags = await cacheService.getAllTags();
        setTags(allTags);
      } catch (error) {
        console.error('Upload failed:', error);
        setTransfers((prev) => {
          if (!prev.some(t => t.id === transfer.id)) return prev;
          return prev.map((t) =>
            t.id === transfer.id
              ? { ...t, status: 'error', error: error.message || 'Upload failed' }
              : t
          );
        });
      }
    }
  };

  const handleDeleteFile = async (file) => {
    if (activeDrive && !activeDrive.canPost) {
      alert('Permission denied: cannot delete files from this read-only drive.');
      return;
    }
    try {
      await filesService.deleteFiles(file.channelId, [file.messageId]);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      await cacheService.removeFile(file.id);
      await updateStorageMetric();
      const allTags = await cacheService.getAllTags();
      setTags(allTags);
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  };

  const handleRenameFileClick = (file) => {
    if (activeDrive && !activeDrive.canPost) {
      alert('Permission denied: cannot rename files on this read-only drive.');
      return;
    }
    setRenameFile(file);
    setRenameFileName(file.name);
    setRenameFileTags((file.tags || []).join(' '));
  };

  const handleSaveRenameFile = async (e) => {
    if (e) e.preventDefault();
    if (!renameFile || !renameFileName.trim() || renamingFile) return;

    try {
      setRenamingFile(true);
      const parsedTags = parseTagsInput(renameFileTags);
      
      const result = await filesService.renameFile(
        renameFile.channelId,
        renameFile.messageId,
        renameFileName.trim(),
        parsedTags
      );

      const updatedFile = {
        ...renameFile,
        name: result.name,
        tags: result.tags,
        caption: result.caption,
      };

      await cacheService.addFile(updatedFile);

      setFiles((prev) =>
        prev.map((f) => (f.id === renameFile.id ? updatedFile : f))
      );

      // Also update search results if active
      setSearchResults((prev) =>
        prev.map((f) => (f.id === renameFile.id ? updatedFile : f))
      );

      const allTags = await cacheService.getAllTags();
      setTags(allTags);
      setRenameFile(null);
    } catch (err) {
      console.error('Failed to rename file:', err);
      alert('Failed to rename file. Please try again.');
    } finally {
      setRenamingFile(false);
    }
  };

  const handleDownloadFile = async (file) => {
    setShowTransfers(true);
    setTransfersMinimized(false);

    const transferId = `download-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newTransfer = {
      id: transferId,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'downloading',
      type: 'download',
    };

    setTransfers((prev) => [...prev, newTransfer]);

    try {
      const blob = await filesService.downloadFile(
        file.channelId,
        file.messageId,
        (progress) => {
          setTransfers((prev) => {
            if (!prev.some(t => t.id === transferId)) return prev;
            return prev.map((t) =>
              t.id === transferId ? { ...t, progress } : t
            );
          });
        }
      );

      filesService.saveBlobAsFile(blob, file.name);

      setTransfers((prev) => {
        if (!prev.some(t => t.id === transferId)) return prev;
        return prev.map((t) =>
          t.id === transferId ? { ...t, status: 'done', progress: 100 } : t
        );
      });
    } catch (err) {
      console.error('Download failed:', err);
      setTransfers((prev) => {
        if (!prev.some(t => t.id === transferId)) return prev;
        return prev.map((t) =>
          t.id === transferId ? { ...t, status: 'error', error: err.message || 'Download failed' } : t
        );
      });
    }
  };

  const handlePreviewFile = (file, showDetails = false) => {
    setPreviewWithDetails(showDetails);
    setPreviewFile(file);
  };

  const handleToggleStar = async (file, isStarred) => {
    try {
      await cacheService.toggleStar(file.id, isStarred);
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, starred: isStarred ? 1 : 0 } : f))
      );
      // Sync the reaction to Telegram
      await filesService.toggleStarReaction(file.channelId, file.messageId, isStarred);
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  };

  const handleTogglePin = async (file, isPinned) => {
    if (activeDrive && !activeDrive.canPost) {
      alert('Permission denied: cannot pin files in this read-only drive.');
      return;
    }
    try {
      // Optimistic update in state
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, pinned: isPinned ? 1 : 0 } : f))
      );
      await cacheService.togglePin(file.id, isPinned);
      await filesService.togglePin(file.channelId, file.messageId, isPinned);
    } catch (err) {
      console.error('Failed to toggle pin:', err);
      // Revert state if failed
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, pinned: file.pinned } : f))
      );
      alert('Failed to pin/unpin file. Please try again.');
    }
  };

  const handleUploadFileClick = () => {
    if (activeDrive && !activeDrive.canPost) {
      alert('Permission denied: cannot upload files to this read-only drive.');
      return;
    }
    if (!currentFolder) {
      alert('Please select or create a folder first before uploading files.');
    } else {
      fileInputRef.current?.click();
    }
  };

  // Filter logic: text search + file type + time
  const getFilteredFiles = () => {
    let result = files;

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((f) => f.name.toLowerCase().includes(query));
    }

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter((f) => {
        const mime = f.mimeType?.toLowerCase() || '';
        if (typeFilter === 'image') return mime.startsWith('image/');
        if (typeFilter === 'video') return mime.startsWith('video/');
        if (typeFilter === 'audio') return mime.startsWith('audio/');
        if (typeFilter === 'pdf') return mime.includes('pdf');
        return true;
      });
    }

    // Time filter
    if (timeFilter !== 'all') {
      const nowSec = Date.now() / 1000;
      result = result.filter((f) => {
        const ageSec = nowSec - f.createdAt;
        if (timeFilter === 'today') return ageSec <= 24 * 3600;
        if (timeFilter === 'week') return ageSec <= 7 * 24 * 3600;
        if (timeFilter === 'month') return ageSec <= 30 * 24 * 3600;
        return true;
      });
    }

    return result;
  };

  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPageTitle = () => {
    if (activeTab === 'home') return 'Home';
    if (activeTab === 'computers') return 'Computers';
    if (activeTab === 'shared') return 'Shared with me';
    if (activeTab === 'recent') return 'Recent';
    if (activeTab === 'starred') return 'Starred';
    if (activeTab === 'spam') return 'Spam';
    if (activeTab === 'trash') return 'Trash';
    if (activeTab === 'storage') return 'Storage';
    if (activeTab.startsWith('tag-')) {
      return `Tag: ${activeTab.replace('tag-', '')}`;
    }

    // My Drive
    if (!currentFolder) {
      return 'My Drive';
    }

    // Breadcrumbs inside folder
    return (
      <div className="gd-breadcrumbs">
        <span className="gd-breadcrumb-link" onClick={handleGoBack}>
          My Drive
        </span>
        <ChevronRight size={14} className="gd-breadcrumb-sep" />
        <span className="gd-breadcrumb-current">
          {currentFolder.name}
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <Loader2 size={40} className="spin" />
        <p>Connecting to TeleDrive...</p>
      </div>
    );
  }

  return (
    <div
      className={`gd-layout-wrapper ${isSidebarCollapsed ? 'gd-sidebar-collapsed' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 1. Top Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        user={user}
        drives={drives}
        activeDrive={activeDrive}
        onSwitchDrive={handleSwitchDrive}
        onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <div className={`gd-layout-body ${isSidebarCollapsed ? 'gd-sidebar-collapsed' : ''}`}>
        {/* Sidebar mobile backdrop */}
        <div
          className={`gd-sidebar-backdrop ${!isSidebarCollapsed ? 'visible' : ''}`}
          onClick={() => setIsSidebarCollapsed(true)}
        />

        {/* 2. Left Sidebar */}
        <Sidebar
          folders={folders}
          currentFolder={currentFolder}
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          onSelectFolder={handleOpenFolder}
          onGoHome={handleGoBack}
          onCreateFolderClick={() => setShowCreateFolderModal(true)}
          onUploadFileClick={handleUploadFileClick}
          storageUsed={storageUsed}
          readOnly={activeDrive ? !activeDrive.canPost : false}
          tags={tags}
          isSidebarCollapsed={isSidebarCollapsed}
        />

        {/* 3. Main Content Canvas */}
        <main className="gd-main-canvas-container">
          <div className="gd-content-canvas">
            {error && (
              <div className="dashboard-error">
                <p>{error}</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => window.location.reload()}
                >
                  Refresh
                </button>
              </div>
            )}

            {/* Canvas Header Row (Title & View Toggles) */}
            <div className="gd-canvas-header">
              <div className="gd-canvas-title-wrapper">{getPageTitle()}</div>
              
              {/* Actions & Grid/List View Toggles */}
              <div className="gd-canvas-actions">
                <div className="gd-view-toggle">
                  <button
                    className={`gd-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => setViewMode('grid')}
                    title="Grid view"
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    className={`gd-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                    onClick={() => setViewMode('list')}
                    title="List view"
                  >
                    <List size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Filter Buttons Row (Google Drive Pills) */}
            {(activeTab === 'my-drive' || activeTab === 'recent' || activeTab === 'starred' || activeTab === 'storage' || activeTab === 'home') && (
              <div className="gd-filter-row">
                {/* File Type Filter */}
                <select
                  className={`gd-filter-pill ${typeFilter !== 'all' ? 'active' : ''}`}
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="all">Type</option>
                  <option value="image">Images</option>
                  <option value="video">Videos</option>
                  <option value="audio">Audio</option>
                  <option value="pdf">PDFs</option>
                </select>

                {/* Date Modified Filter */}
                <select
                  className={`gd-filter-pill ${timeFilter !== 'all' ? 'active' : ''}`}
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                >
                  <option value="all">People</option>
                </select>

                <select
                  className={`gd-filter-pill ${timeFilter !== 'all' ? 'active' : ''}`}
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                >
                  <option value="all">Modified</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 days</option>
                  <option value="month">Last 30 days</option>
                </select>
              </div>
            )}

            {/* Dynamic Views based on activeTab */}
            <div className="gd-canvas-scroll-content">
              {searchQuery.trim() ? (
                <div className="gd-search-results-view">
                  <h3 className="gd-search-results-title" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '16px', paddingLeft: '4px' }}>
                    Search results for "{searchQuery}"
                  </h3>
                  <FileGrid
                    files={searchResults}
                    loading={isSearching}
                    viewMode={viewMode}
                    isGlobalSearch={!currentFolder}
                    onPreview={handlePreviewFile}
                    onDownload={handleDownloadFile}
                    onDelete={handleDeleteFile}
                    onToggleStar={handleToggleStar}
                    onTogglePin={handleTogglePin}
                    onShareFile={handleShareFile}
                    readOnly={activeDrive ? !activeDrive.canPost : false}
                    onRename={handleRenameFileClick}
                    onSelectTag={(tag) => handleSelectTab('tag-' + tag)}
                  />
                </div>
              ) : (
                <>
                  {/* HOME TAB */}
                  {activeTab === 'home' && (
                <div className="gd-home-view">
                  {/* Folders Section */}
                  {folders.length > 0 && (
                    <div className="gd-home-section">
                      <h3 className="gd-home-section-title">Suggested folders</h3>
                      <FolderView
                        folders={filteredFolders.slice(0, 4)}
                        onOpenFolder={handleOpenFolder}
                        onCreateFolder={handleCreateFolder}
                        onDeleteFolder={handleDeleteFolder}
                        onRenameFolder={handleRenameFolder}
                        onShareFolder={handleShareFolder}
                        viewMode={viewMode}
                        hideHeader={true}
                        readOnly={activeDrive ? !activeDrive.canPost : false}
                      />
                    </div>
                  )}

                  {/* Files Section */}
                  <div className="gd-home-section" style={{ marginTop: '24px' }}>
                    <h3 className="gd-home-section-title">Recent files</h3>
                    <FileGrid
                      files={getFilteredFiles()}
                      loading={loadingFiles}
                      viewMode={viewMode}
                      onPreview={handlePreviewFile}
                      onDownload={handleDownloadFile}
                      onDelete={handleDeleteFile}
                      onToggleStar={handleToggleStar}
                      onTogglePin={handleTogglePin}
                      onShareFile={handleShareFile}
                      readOnly={activeDrive ? !activeDrive.canPost : false}
                      onRename={handleRenameFileClick}
                      onSelectTag={(tag) => handleSelectTab('tag-' + tag)}
                    />
                  </div>
                </div>
              )}

              {/* MY DRIVE TAB */}
              {activeTab === 'my-drive' && (
                <>
                  {!currentFolder ? (
                    <FolderView
                      folders={filteredFolders}
                      onOpenFolder={handleOpenFolder}
                      onCreateFolder={handleCreateFolder}
                      onDeleteFolder={handleDeleteFolder}
                      onRenameFolder={handleRenameFolder}
                      onShareFolder={handleShareFolder}
                      viewMode={viewMode}
                      readOnly={activeDrive ? !activeDrive.canPost : false}
                    />
                  ) : (
                    <>
                      {activeDrive && !activeDrive.canPost ? (
                        <div className="gd-readonly-banner">
                          <AlertCircle size={18} />
                          <span>This drive is read-only. You cannot upload files or create folders here.</span>
                        </div>
                      ) : (
                        <UploadZone
                          onUploadFiles={handleUploadFiles}
                        />
                      )}
                      <FileGrid
                        files={getFilteredFiles()}
                        loading={loadingFiles}
                        viewMode={viewMode}
                        onPreview={handlePreviewFile}
                        onDownload={handleDownloadFile}
                        onDelete={handleDeleteFile}
                        onToggleStar={handleToggleStar}
                        onTogglePin={handleTogglePin}
                        onShareFile={handleShareFile}
                        readOnly={activeDrive ? !activeDrive.canPost : false}
                        onRename={handleRenameFileClick}
                        onSelectTag={(tag) => handleSelectTab('tag-' + tag)}
                      />
                    </>
                  )}
                </>
              )}

              {/* COMPUTERS TAB */}
              {activeTab === 'computers' && (
                <div className="gd-empty-state">
                  <div className="gd-empty-icon-wrapper">
                    <Monitor size={48} />
                  </div>
                  <h3>No computers syncing</h3>
                  <p>Sync folder content with computers using a local client.</p>
                </div>
              )}

              {/* SHARED TAB */}
              {activeTab === 'shared' && (
                <div className="gd-empty-state">
                  <div className="gd-empty-icon-wrapper">
                    <Users size={48} />
                  </div>
                  <h3>No shared files</h3>
                  <p>Files that other TeleDrive users share with you will appear here.</p>
                </div>
              )}

              {/* RECENT TAB */}
              {activeTab === 'recent' && (
                <FileGrid
                  files={getFilteredFiles()}
                  loading={loadingFiles}
                  viewMode={viewMode}
                  onPreview={handlePreviewFile}
                  onDownload={handleDownloadFile}
                  onDelete={handleDeleteFile}
                  onToggleStar={handleToggleStar}
                  onTogglePin={handleTogglePin}
                  onShareFile={handleShareFile}
                  readOnly={activeDrive ? !activeDrive.canPost : false}
                  onRename={handleRenameFileClick}
                  onSelectTag={(tag) => handleSelectTab('tag-' + tag)}
                />
              )}

              {/* STARRED TAB */}
              {activeTab === 'starred' && (
                <FileGrid
                  files={getFilteredFiles()}
                  loading={loadingFiles}
                  viewMode={viewMode}
                  onPreview={handlePreviewFile}
                  onDownload={handleDownloadFile}
                  onDelete={handleDeleteFile}
                  onToggleStar={handleToggleStar}
                  onTogglePin={handleTogglePin}
                  onShareFile={handleShareFile}
                  readOnly={activeDrive ? !activeDrive.canPost : false}
                  onRename={handleRenameFileClick}
                  onSelectTag={(tag) => handleSelectTab('tag-' + tag)}
                />
              )}

              {/* SPAM TAB */}
              {activeTab === 'spam' && (
                <div className="gd-empty-state">
                  <div className="gd-empty-icon-wrapper">
                    <AlertCircle size={48} />
                  </div>
                  <h3>Your spam folder is clean!</h3>
                  <p>Spam files or suspicious content will be kept here.</p>
                </div>
              )}

              {/* TRASH TAB */}
              {activeTab === 'trash' && (
                <div className="gd-empty-state">
                  <div className="gd-empty-icon-wrapper">
                    <Trash2 size={48} />
                  </div>
                  <h3>Trash is empty</h3>
                  <p>Deleted files and folders will appear here until they are permanently removed.</p>
                </div>
              )}

              {/* STORAGE TAB */}
              {activeTab === 'storage' && (
                <FileGrid
                  files={getFilteredFiles()}
                  loading={loadingFiles}
                  viewMode={viewMode}
                  onPreview={handlePreviewFile}
                  onDownload={handleDownloadFile}
                  onDelete={handleDeleteFile}
                  onToggleStar={handleToggleStar}
                  onTogglePin={handleTogglePin}
                  onShareFile={handleShareFile}
                  readOnly={activeDrive ? !activeDrive.canPost : false}
                  onRename={handleRenameFileClick}
                  onSelectTag={(tag) => handleSelectTab('tag-' + tag)}
                />
              )}

              {/* TAG TAB */}
              {activeTab.startsWith('tag-') && (
                <FileGrid
                  files={getFilteredFiles()}
                  loading={loadingFiles}
                  viewMode={viewMode}
                  onPreview={handlePreviewFile}
                  onDownload={handleDownloadFile}
                  onDelete={handleDeleteFile}
                  onToggleStar={handleToggleStar}
                  onTogglePin={handleTogglePin}
                  onShareFile={handleShareFile}
                  readOnly={activeDrive ? !activeDrive.canPost : false}
                  onRename={handleRenameFileClick}
                  onSelectTag={(tag) => handleSelectTab('tag-' + tag)}
                />
              )}
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* 4. Global File Preview Modal */}
      {previewFile && (
        <FilePreview
          file={previewFile}
          channelId={previewFile.channelId}
          folders={folders}
          initialShowDetails={previewWithDetails}
          onClose={() => setPreviewFile(null)}
          onShare={handleShareFile}
        />
      )}

      {/* 4a. Global Share Modal */}
      <ShareModal
        isOpen={!!shareItem}
        onClose={() => setShareItem(null)}
        item={shareItem}
        type={shareType}
      />

      {/* 5. Create Folder Modal (Global) */}
      {showCreateFolderModal && (
        <div className="modal-overlay" onClick={() => setShowCreateFolderModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Folder</h3>
            </div>
            <form onSubmit={handleCreateFolder}>
              <div className="modal-body">
                <p className="modal-description">
                  A private Telegram channel will be created to store your files in the cloud.
                </p>
                <div className="input-group">
                  <FolderClosed size={18} className="input-icon" />
                  <input
                    className="input"
                    placeholder="Folder name"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    autoFocus
                    maxLength={50}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowCreateFolderModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!newFolderName.trim() || creatingFolder}
                >
                  {creatingFolder ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <FolderPlus size={16} />
                      <span>Create</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Upload Files Modal */}
      {showUploadModal && uploadFilesQueue.length > 0 && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Upload {uploadFilesQueue.length} {uploadFilesQueue.length === 1 ? 'file' : 'files'}</h3>
            </div>
            <form onSubmit={handleConfirmUpload}>
              <div className="modal-body">
                <p className="modal-description">
                  Assign hashtags to help organize your uploads. Press enter to upload directly.
                </p>
                
                <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', marginBottom: '16px', backgroundColor: 'var(--bg-hover)' }}>
                  {uploadFilesQueue.map((file, idx) => (
                    <div key={idx} style={{ fontSize: '12px', padding: '4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                      📄 {file.name}
                    </div>
                  ))}
                </div>

                <div className="input-group">
                  <Hash size={18} className="input-icon" />
                  <input
                    className="input"
                    placeholder="Tags (e.g. #invoice #receipt)"
                    value={uploadTags}
                    onChange={(e) => setUploadTags(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename File Modal */}
      {renameFile && (
        <div className="modal-overlay" onClick={() => setRenameFile(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Rename File & Tags</h3>
            </div>
            <form onSubmit={handleSaveRenameFile}>
              <div className="modal-body">
                <div className="input-group" style={{ marginBottom: '16px' }}>
                  <FileText size={18} className="input-icon" />
                  <input
                    className="input"
                    placeholder="File name"
                    value={renameFileName}
                    onChange={(e) => setRenameFileName(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <div className="input-group">
                  <Hash size={18} className="input-icon" />
                  <input
                    className="input"
                    placeholder="Tags (e.g. #invoice #receipt)"
                    value={renameFileTags}
                    onChange={(e) => setRenameFileTags(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setRenameFile(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={renamingFile}>
                  {renamingFile ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global hidden input for file upload */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleUploadFiles(e.target.files);
          }
          e.target.value = '';
        }}
        style={{ display: 'none' }}
      />

      {/* Floating Transfers progress panel */}
      {showTransfers && transfers.length > 0 && (() => {
        const activeUploadsCount = transfers.filter((t) => t.type === 'upload' && (t.status === 'uploading' || t.status === 'pending')).length;
        const activeDownloadsCount = transfers.filter((t) => t.type === 'download' && (t.status === 'downloading' || t.status === 'pending')).length;
        
        const doneUploadsCount = transfers.filter((t) => t.type === 'upload' && t.status === 'done').length;
        const doneDownloadsCount = transfers.filter((t) => t.type === 'download' && t.status === 'done').length;
        
        const activeTotal = activeUploadsCount + activeDownloadsCount;
        const doneTotal = doneUploadsCount + doneDownloadsCount;

        const getPanelTitleText = () => {
          if (activeTotal > 0) {
            if (activeUploadsCount > 0 && activeDownloadsCount > 0) {
              return `Transferring ${activeTotal} items`;
            } else if (activeUploadsCount > 0) {
              return `Uploading ${activeUploadsCount} item${activeUploadsCount > 1 ? 's' : ''}`;
            } else {
              return `Downloading ${activeDownloadsCount} item${activeDownloadsCount > 1 ? 's' : ''}`;
            }
          } else {
            if (doneUploadsCount > 0 && doneDownloadsCount > 0) {
              return `${doneTotal} transfers complete`;
            } else if (doneUploadsCount > 0) {
              return `${doneUploadsCount} upload${doneUploadsCount > 1 ? 's' : ''} complete`;
            } else if (doneDownloadsCount > 0) {
              return `${doneDownloadsCount} download${doneDownloadsCount > 1 ? 's' : ''} complete`;
            } else {
              return 'Transfers complete';
            }
          }
        };

        return (
          <div className="upload-panel">
            <div className="upload-panel-header">
              <span className="upload-panel-title">{getPanelTitleText()}</span>
              <div className="upload-panel-actions">
                <button
                  onClick={() => setTransfersMinimized(!transfersMinimized)}
                  title={transfersMinimized ? 'Expand' : 'Minimize'}
                >
                  {transfersMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <button
                  onClick={() => {
                    if (activeTotal > 0) {
                      if (window.confirm('Active transfers are in progress. Are you sure you want to close?')) {
                        setShowTransfers(false);
                      }
                    } else {
                      setShowTransfers(false);
                    }
                  }}
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {!transfersMinimized && (
              <div className="upload-panel-list">
                {transfers.map((transfer) => {
                  const radius = 9;
                  const circumference = 2 * Math.PI * radius;
                  const strokeDashoffset = circumference - (transfer.progress / 100) * circumference;

                  return (
                    <div key={transfer.id} className="upload-item">
                      <div className="upload-item-left">
                        <div className="upload-item-icon">
                          <FileText size={18} />
                        </div>

                        <div className="upload-item-info">
                          <span className="upload-item-name" title={transfer.name}>
                            {truncateFileName(transfer.name, 32)}
                          </span>
                          <span className={`upload-item-status-text ${transfer.status === 'error' ? 'error' : ''}`}>
                            {transfer.status === 'pending' && 'Starting upload...'}
                            {transfer.status === 'uploading' && `Uploading... ${Math.round(transfer.progress)}%`}
                            {transfer.status === 'downloading' && `Downloading... ${Math.round(transfer.progress)}%`}
                            {transfer.status === 'done' && (transfer.type === 'upload' ? 'Upload complete' : 'Download complete')}
                            {transfer.status === 'error' && (transfer.error || 'Transfer failed')}
                          </span>
                        </div>
                      </div>

                      <div className="upload-item-right">
                        {(transfer.status === 'pending' || transfer.status === 'uploading' || transfer.status === 'downloading') && (
                          <div className="upload-item-progress-circle-container" title="Cancel transfer">
                            <svg width="24" height="24" viewBox="0 0 24 24" className="upload-progress-circle">
                              <circle
                                className="upload-progress-circle-bg"
                                cx="12"
                                cy="12"
                                r={radius}
                                fill="none"
                                stroke="rgba(255, 255, 255, 0.15)"
                                strokeWidth="2"
                              />
                              <circle
                                className="upload-progress-circle-fill"
                                cx="12"
                                cy="12"
                                r={radius}
                                fill="none"
                                stroke="#8ab4f8"
                                strokeWidth="2"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                transform="rotate(-90 12 12)"
                              />
                            </svg>
                            <button
                              className="upload-item-cancel-overlay-btn"
                              onClick={() => removeTransfer(transfer.id)}
                            >
                              <X size={10} />
                            </button>
                          </div>
                        )}

                        {transfer.status === 'done' && (
                          <CheckCircle2 size={20} className="upload-item-success-icon" />
                        )}

                        {transfer.status === 'error' && (
                          <AlertCircle size={20} className="upload-item-error-icon" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {isDragOverCanvas && (
        <div className="canvas-drag-overlay">
          <div className="canvas-drag-overlay-card">
            <Upload size={48} className="canvas-drag-bounce-icon" style={{ color: 'var(--accent)' }} />
            <h3>{currentFolder ? `Upload to "${currentFolder.name}"` : 'Open a folder first'}</h3>
            <p>{currentFolder ? 'Drop your files here to start uploading' : 'Please open a folder inside My Drive to drop files'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
