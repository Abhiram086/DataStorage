import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, File as FileIcon, Folder, HardDrive, Download, Trash2, 
  Clock, FolderPlus, ChevronRight, ChevronDown, MoreVertical, X, 
  Zap, Maximize, Plus, Home, Search, LayoutGrid, List, RefreshCw
} from 'lucide-react';

const API_BASE = `http://${window.location.hostname}:3001`;

// --- HELPER: FILE TYPE DETECTION ---
const getFileType = (filename) => {
  if(!filename) return 'unknown';
  const ext = filename.split('.').pop().toLowerCase();
  if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) return 'video';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (['pdf'].includes(ext)) return 'pdf';
  return 'unknown';
};

const formatBytes = (bytes) => {
  if (!+bytes) return '';
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${sizes[i]}`;
};

// --- SUB-COMPONENT: Recursive Folder Tree ---
const FolderTreeItem = ({ item, currentPath, navigateTo }) => {
  const isSelected = currentPath === item.path;
  const isParentOfCurrent = currentPath.startsWith(item.path + '/');
  const [isExpanded, setIsExpanded] = useState(isSelected || isParentOfCurrent);
  const hasChildren = item.children && item.children.length > 0;

  const handleSelect = (e) => {
    e.stopPropagation();
    navigateTo('drive', item.path);
    if (!isExpanded) setIsExpanded(true);
  };

  return (
    <div className="mt-1 select-none">
      <div 
        className={`flex items-center gap-1.5 cursor-pointer p-2 lg:p-1.5 rounded-lg transition-colors group ${
          isSelected ? 'text-blue-400 bg-blue-500/10' : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
        }`}
        onClick={handleSelect}
      >
        <div className="w-6 h-6 lg:w-5 lg:h-5 flex items-center justify-center rounded hover:bg-neutral-700/50" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>
          {hasChildren ? (isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : <div className="w-4" />}
        </div>
        <Folder size={18} className={`${isSelected ? "fill-blue-500/20" : "group-hover:fill-neutral-700"} transition-colors`} />
        <span className="text-sm truncate font-medium">{item.name || 'Root'}</span>
      </div>
      {isExpanded && hasChildren && (
        <div className="border-l border-neutral-800 ml-4 pl-3 relative">
          {item.children.map(child => (
            <FolderTreeItem key={child.path} item={child} currentPath={currentPath} navigateTo={navigateTo} />
          ))}
        </div>
      )}
    </div>
  );
};


// --- MAIN APPLICATION ---
export default function App() {
  const [files, setFiles] = useState([]);
  const [tree, setTree] = useState([]);
  const [recentFiles, setRecentFiles] = useState([]);
  const [trashFiles, setTrashFiles] = useState([]);
  
  // Navigation & View State
  const [currentView, setCurrentView] = useState('drive'); 
  const [currentPath, setCurrentPath] = useState(''); 
  const [displayMode, setDisplayMode] = useState('grid'); 
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // UI State
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, item: null });
  const [viewingFile, setViewingFile] = useState(null); 
  
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);
  
  const fileInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Close menus
  useEffect(() => {
    const closeMenu = (e) => { setContextMenu({ show: false, x: 0, y: 0, item: null }); };
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  // ROUTING: Listen for browser Back/Forward buttons
  useEffect(() => {
    const handleHashChange = () => {
      const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''));
      if (hash === '/recent') { setCurrentView('recent'); setCurrentPath(''); }
      else if (hash === '/trash') { setCurrentView('trash'); setCurrentPath(''); }
      else { setCurrentView('drive'); setCurrentPath(hash); }
      
      setViewingFile(null); setMobileTreeOpen(false); setMobileActionsOpen(false); setSearchQuery('');
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (view, path = '') => {
    setSearchQuery(''); // Clear search when navigating manually
    if (view === 'recent') window.location.hash = '/recent';
    else if (view === 'trash') window.location.hash = '/trash';
    else window.location.hash = path;
  };

  useEffect(() => {
    if (currentView === 'drive') fetchFiles();
    if (currentView === 'trash') fetchTrash();
    fetchTree();
    fetchRecent();
  }, [currentPath, currentView]);

  // --- API FETCHERS ---
  const fetchFiles = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/files?path=${encodeURIComponent(currentPath)}`);
      if (response.ok) setFiles(await response.json());
    } catch (error) { console.error("Error", error); }
  };

  const fetchTree = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/tree`);
      if (response.ok) setTree((await response.json())[0]?.children || []);
    } catch (error) { console.error("Error", error); }
  };

  const fetchRecent = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/recent`);
      if (response.ok) setRecentFiles(await response.json());
    } catch (error) { console.error("Error", error); }
  };

  const fetchTrash = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/trash`);
      if (response.ok) setTrashFiles(await response.json());
    } catch (error) { console.error("Error", error); }
  };

  // --- ACTIONS ---
  const handleSearch = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (!val.trim()) { setSearchResults([]); return; }
    
    if(searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(val)}`);
        setSearchResults(await res.json());
      } catch (err) { console.error(err); }
    }, 300);
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/folder`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPath, folderName: newFolderName.trim() })
      });
      if (res.ok) { setNewFolderName(''); setShowFolderModal(false); fetchFiles(); fetchTree(); }
      else alert((await res.json()).error);
    } catch (error) { console.error(error); }
  };

  const handleDelete = async (targetPath) => {
    if (!window.confirm("Move to trash?")) return;
    try {
      await fetch(`${API_BASE}/api/delete`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath })
      });
      fetchFiles(); fetchTree(); fetchRecent();
      if (searchQuery) {
          // Re-trigger search to remove deleted item
          const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(searchQuery)}`);
          setSearchResults(await res.json());
      }
      if (viewingFile?.path === targetPath) setViewingFile(null); 
    } catch (error) { console.error("Failed to delete", error); }
  };

  const handleRestore = async (targetPath) => {
    try {
      await fetch(`${API_BASE}/api/restore`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath })
      });
      fetchTrash(); fetchTree();
    } catch (error) { console.error("Failed to restore", error); }
  };

  const handleEmptyTrash = async () => {
    if (!window.confirm("WARNING: This will permanently delete all files in the trash. This cannot be undone. Proceed?")) return;
    try {
      await fetch(`${API_BASE}/api/empty-trash`, { method: 'DELETE' });
      fetchTrash();
    } catch (error) { console.error("Failed to empty trash", error); }
  };

  const handleDownload = (targetPath) => window.open(`${API_BASE}/api/download?path=${encodeURIComponent(targetPath)}`, '_blank');

  const handleUpload = async (file) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('path', currentPath); formData.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData });
      if (res.ok) { fetchFiles(); fetchRecent(); }
    } catch (error) { alert("Upload failed."); } 
    finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleContextMenu = (e, item) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ show: true, x: e.pageX, y: e.pageY, item: item });
  };

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]);
  };
  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) handleUpload(e.target.files[0]);
  };

  const foldersList = files.filter(f => f.isDirectory);
  const filesList = files.filter(f => !f.isDirectory);
  const breadcrumbs = ['Home', ...currentPath.split('/').filter(Boolean)];

  // REUSABLE FILE TILE/ROW COMPONENT (Includes Search Location Logic & HTML5 Video Thumbnails)
  const FileItem = ({ file, showLocation = false }) => {
    const isSearchMode = showLocation || searchQuery.trim() !== '';
    const clickAction = () => {
      if (currentView === 'trash') return;
      if (file.isDirectory) navigateTo('drive', file.path);
      else setViewingFile(file);
    };

    if (displayMode === 'grid' && currentView !== 'trash' && !isSearchMode) {
      return (
        <div onClick={clickAction} onContextMenu={(e) => handleContextMenu(e, file)} className="relative aspect-square bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden hover:border-neutral-600 transition-all cursor-pointer group">
          {getFileType(file.name) === 'image' ? (
            <img src={`${API_BASE}/api/thumbnail?path=${encodeURIComponent(file.path)}`} className="w-full h-full object-cover" alt={file.name} loading="lazy" />
          ) : getFileType(file.name) === 'video' ? (
            // Native HTML5 Video Thumbnail Hack (Extracts frame at 0.1 seconds)
            <video src={`${API_BASE}/api/view?path=${encodeURIComponent(file.path)}#t=0.1`} className="w-full h-full object-cover bg-black" preload="metadata" muted playsInline />
          ) : file.isDirectory ? (
            <div className="w-full h-full flex items-center justify-center bg-neutral-900"><Folder className="text-blue-500/50" size={48} /></div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-900"><FileIcon className="text-neutral-600" size={48} /></div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-8 pointer-events-none">
            <p className="text-xs font-medium text-white truncate">{file.name.replace(/^\d+-/, '')}</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); handleContextMenu(e, file); }} className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreVertical size={16} />
          </button>
        </div>
      );
    }

    // List Mode (Used automatically for Trash and Search results)
    return (
      <div onClick={clickAction} onContextMenu={(e) => handleContextMenu(e, file)} className="flex lg:grid lg:grid-cols-12 gap-4 p-4 items-center justify-between lg:justify-start group transition-colors hover:bg-neutral-800/30 cursor-pointer border-b border-neutral-800/50 last:border-0">
        <div className="lg:col-span-7 flex items-center gap-3 overflow-hidden pr-4">
          {file.isDirectory ? <Folder className="text-blue-500 flex-shrink-0" size={24} /> : <FileIcon className={currentView === 'trash' ? "text-red-500/50" : "text-neutral-500 flex-shrink-0"} size={24} />}
          <div className="flex flex-col overflow-hidden">
            <span className={`truncate text-sm font-medium transition-colors ${currentView === 'trash' ? 'text-neutral-500 line-through' : 'text-neutral-200 group-hover:text-white'}`}>{file.name.replace(/^\d+-/, '')}</span>
            <span className="text-xs text-neutral-500 truncate mt-0.5">
              {isSearchMode && `In: ${file.folderPath || 'Home'} • `}
              {!file.isDirectory && `${formatBytes(file.size)} • `}
              {new Date(file.date).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="hidden lg:block lg:col-span-3 text-sm text-neutral-500">
          {isSearchMode ? `In: ${file.folderPath || 'Home'}` : new Date(file.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        <div className="lg:col-span-2 text-sm text-neutral-500 flex items-center justify-end gap-2 flex-shrink-0">
          {!file.isDirectory && <span className="hidden lg:inline mr-4">{formatBytes(file.size)}</span>}
          <button onClick={(e) => { e.stopPropagation(); handleContextMenu(e, file); }} className="p-2 lg:p-1.5 lg:opacity-0 group-hover:opacity-100 hover:bg-neutral-700 rounded-lg text-neutral-400 transition-all active:bg-neutral-600">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>
    );
  };

  const ContextMenuActions = ({ item, isMobile }) => {
    const btnClass = `w-full text-left px-4 py-3 lg:py-2 hover:bg-blue-500/10 hover:text-blue-400 flex items-center gap-3 transition-colors ${isMobile ? 'text-base font-medium' : 'text-sm'}`;
    const iconSize = isMobile ? 20 : 16;
    
    if (currentView === 'trash') {
      return (
        <button className={btnClass} onClick={() => { handleRestore(item.path); setContextMenu({show:false}); }}>
          <RefreshCw size={iconSize} className="text-green-500"/> <span className="text-green-500">Restore</span>
        </button>
      );
    }

    return (
      <>
        {item?.isDirectory && (
           <button className={btnClass} onClick={() => { navigateTo('drive', item.path); setContextMenu({show:false}); }}>
             <Folder size={iconSize} /> Open Folder
           </button>
        )}
        {!item?.isDirectory && (
          <>
            <button className={btnClass} onClick={() => { setViewingFile(item); setContextMenu({show:false}); }}>
              <Maximize size={iconSize} /> View Media
            </button>
            <button className={btnClass} onClick={() => { handleDownload(item.path); setContextMenu({show:false}); }}>
              <Download size={iconSize} /> Download File
            </button>
          </>
        )}
        <div className="h-px bg-neutral-700/50 my-1"></div>
        <button className={`w-full text-left px-4 py-3 lg:py-2 hover:bg-red-500/10 hover:text-red-400 text-red-500 flex items-center gap-3 transition-colors ${isMobile ? 'text-base font-medium' : 'text-sm'}`} onClick={() => { handleDelete(item.path); setContextMenu({show:false}); }}>
          <Trash2 size={iconSize} /> Delete
        </button>
      </>
    );
  };

  return (
    <div className="flex h-screen bg-neutral-900 text-neutral-100 font-sans overflow-hidden relative">
      
      {/* 🎬 FILE VIEWER OVERLAY */}
      {viewingFile && (
        <div className="absolute inset-0 z-[80] bg-black/95 flex flex-col backdrop-blur-md">
          <div className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-neutral-800/50 flex-shrink-0 bg-neutral-950/50">
            <div className="flex items-center gap-3 overflow-hidden pr-4">
              <FileIcon className="text-blue-500 flex-shrink-0" size={20} />
              <span className="font-medium truncate text-sm lg:text-base">{viewingFile.name}</span>
            </div>
            <div className="flex items-center gap-2 lg:gap-4 flex-shrink-0">
              <button onClick={() => handleDownload(viewingFile.path)} className="text-neutral-400 hover:text-white flex items-center gap-2 text-sm bg-neutral-800 px-3 py-1.5 rounded-lg transition-colors">
                <Download size={16} /> <span className="hidden lg:inline">Download</span>
              </button>
              <div className="w-px h-6 bg-neutral-800 hidden lg:block"></div>
              <button onClick={() => setViewingFile(null)} className="text-neutral-400 hover:text-red-400 bg-neutral-900 hover:bg-red-500/10 p-2 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 lg:p-6 overflow-hidden">
            {getFileType(viewingFile.name) === 'image' && <img src={`${API_BASE}/api/view?path=${encodeURIComponent(viewingFile.path)}`} className="max-w-full max-h-full object-contain drop-shadow-2xl rounded-sm" alt="Preview" />}
            {getFileType(viewingFile.name) === 'video' && <video src={`${API_BASE}/api/view?path=${encodeURIComponent(viewingFile.path)}`} controls autoPlay className="max-w-full max-h-full rounded-lg shadow-2xl outline-none bg-black" />}
            {getFileType(viewingFile.name) === 'pdf' && <iframe src={`${API_BASE}/api/view?path=${encodeURIComponent(viewingFile.path)}`} className="w-full h-full rounded-lg shadow-2xl bg-white" title="PDF Preview" />}
            {getFileType(viewingFile.name) === 'unknown' && (
              <div className="flex flex-col items-center gap-4 text-neutral-500 text-center">
                <Maximize size={48} className="text-neutral-700" />
                <p>Preview not available for this file type.</p>
                <button onClick={() => handleDownload(viewingFile.path)} className="mt-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium">Download to view</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 📱 MOBILE FLOATING DOCK */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[45] bg-neutral-900/70 backdrop-blur-xl border border-neutral-700/50 px-6 py-3 rounded-full shadow-2xl flex items-center gap-8 w-max">
        <button onClick={() => navigateTo('drive', '')} className={`flex flex-col items-center transition-colors ${currentView === 'drive' && currentPath === '' && !searchQuery ? 'text-blue-400' : 'text-neutral-400 hover:text-white'}`}><Home size={22} /></button>
        <button onClick={() => setMobileTreeOpen(true)} className="flex flex-col items-center text-neutral-400 hover:text-white transition-colors"><Folder size={22} /></button>
        <div className="relative">
          <button onClick={() => setMobileActionsOpen(true)} className="bg-blue-600 p-3 rounded-full shadow-lg shadow-blue-500/30 text-white hover:bg-blue-500 transition-transform active:scale-95"><Plus size={24} /></button>
        </div>
        <button onClick={() => navigateTo('recent')} className={`flex flex-col items-center transition-colors ${currentView === 'recent' && !searchQuery ? 'text-blue-400' : 'text-neutral-400 hover:text-white'}`}><Clock size={22} /></button>
      </div>

      {/* 📱 MOBILE ACTION SHEET */}
      {mobileActionsOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end" onClick={() => setMobileActionsOpen(false)}>
          <div className="w-full bg-neutral-900 rounded-t-3xl p-6 pb-12 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-neutral-400 text-xs font-bold uppercase tracking-wider">Create New</h3>
              <button onClick={() => setMobileActionsOpen(false)} className="bg-neutral-800 p-2 rounded-full text-neutral-400"><X size={16}/></button>
            </div>
            <div className="flex gap-4">
              <button className="flex-1 bg-neutral-800 hover:bg-neutral-700 p-6 rounded-2xl flex flex-col items-center gap-3" onClick={() => {fileInputRef.current?.click(); setMobileActionsOpen(false);}}><UploadCloud size={32} className="text-blue-400" /><span className="text-sm font-medium text-white">Upload File</span></button>
              <button className="flex-1 bg-neutral-800 hover:bg-neutral-700 p-6 rounded-2xl flex flex-col items-center gap-3" onClick={() => {setShowFolderModal(true); setMobileActionsOpen(false);}}><FolderPlus size={32} className="text-blue-400" /><span className="text-sm font-medium text-white">New Folder</span></button>
            </div>
          </div>
        </div>
      )}

      {/* 📱 MOBILE TREE DRAWER */}
      {mobileTreeOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-start" onClick={() => setMobileTreeOpen(false)}>
          <div className="w-4/5 max-w-sm h-full bg-neutral-950 border-r border-neutral-800 p-6 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <span className="text-xl font-bold text-white flex items-center gap-2"><HardDrive className="text-blue-500" size={24}/> My Drive</span>
              <button onClick={() => setMobileTreeOpen(false)} className="text-neutral-400 p-2"><X size={20}/></button>
            </div>
            <button onClick={() => { navigateTo('trash'); setMobileTreeOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-lg font-medium transition-colors mb-4 border border-red-500/20"><Trash2 size={18} /> Trash Bin</button>
            <div className="h-px bg-neutral-800 my-4 mx-2"></div>
            <div className="px-1">
              {tree.length === 0 ? <div className="text-sm text-neutral-500 mt-4">No folders yet.</div> : tree.map(node => <FolderTreeItem key={node.path} item={node} currentPath={currentPath} navigateTo={(v,p) => { navigateTo(v,p); setMobileTreeOpen(false); }} />)}
            </div>
          </div>
        </div>
      )}

      {/* NEW FOLDER MODAL */}
      {showFolderModal && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-neutral-900 border border-neutral-700 p-6 rounded-2xl shadow-2xl w-full max-w-sm">
            <form onSubmit={handleCreateFolder}>
              <input autoFocus type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Folder name" className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-3 text-neutral-200 focus:outline-none focus:border-blue-500 mb-6" />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowFolderModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-300 hover:bg-neutral-800">Cancel</button>
                <button type="submit" disabled={!newFolderName.trim()} className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white disabled:opacity-50">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESPONSIVE CONTEXT MENU */}
      {contextMenu.show && (
        <>
          <div className="hidden lg:block absolute z-[60] bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl w-48 py-1 overflow-hidden" style={{ top: contextMenu.y, left: contextMenu.x }}>
            <ContextMenuActions item={contextMenu.item} isMobile={false} />
          </div>
          <div className="lg:hidden fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex flex-col justify-end" onClick={() => setContextMenu({ show: false, x: 0, y: 0, item: null })}>
            <div className="bg-neutral-900 rounded-t-2xl pb-8 pt-4 px-2" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1.5 bg-neutral-700 rounded-full mx-auto mb-6"></div>
              <ContextMenuActions item={contextMenu.item} isMobile={true} />
            </div>
          </div>
        </>
      )}

      {/* 1. DESKTOP LEFT SIDEBAR */}
      <aside className="w-72 bg-neutral-950 border-r border-neutral-800 flex-col flex-shrink-0 hidden lg:flex h-full z-10">
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3 text-xl font-semibold tracking-tight text-white cursor-pointer mb-8" onClick={() => navigateTo('drive', '')}>
            <HardDrive className="text-blue-500" /> <span>DataStorage</span>
          </div>
          <nav className="flex flex-col gap-2">
            <button onClick={() => navigateTo('drive', '')} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors ${currentView === 'drive' && currentPath === '' && !searchQuery ? 'bg-blue-500/10 text-blue-400' : 'text-neutral-400 hover:bg-neutral-800/50'}`}><Folder size={18} /> My Drive</button>
            <button onClick={() => navigateTo('recent')} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors ${currentView === 'recent' && !searchQuery ? 'bg-blue-500/10 text-blue-400' : 'text-neutral-400 hover:bg-neutral-800/50'}`}><Clock size={18} /> Recent</button>
            <button onClick={() => navigateTo('trash')} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors ${currentView === 'trash' && !searchQuery ? 'bg-red-500/10 text-red-400' : 'text-neutral-400 hover:bg-neutral-800/50'}`}><Trash2 size={18} /> Trash</button>
          </nav>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6 custom-scrollbar">
          <div className="h-px bg-neutral-800 my-4 mx-2"></div>
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 px-2">Folders</h3>
          <div className="px-1">{tree.map(node => <FolderTreeItem key={node.path} item={node} currentPath={currentPath} navigateTo={navigateTo} />)}</div>
        </div>
      </aside>

      {/* 2. CENTER (Main Content) */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-neutral-900 relative">
        <header className="h-16 border-b border-neutral-800 flex items-center justify-between px-4 lg:px-8 bg-neutral-900/80 backdrop-blur-md flex-shrink-0 sticky top-0 z-[30]">
          {/* Breadcrumbs or Title */}
          <div className="flex items-center gap-1.5 lg:gap-2 text-sm font-medium text-neutral-400 overflow-x-auto whitespace-nowrap hide-scrollbar flex-1">
            {searchQuery.trim() !== '' && <span className="text-white text-base lg:text-lg font-bold">Search</span>}
            {!searchQuery && currentView === 'recent' && <span className="text-white text-base lg:text-lg font-bold">Recent Uploads</span>}
            {!searchQuery && currentView === 'trash' && <span className="text-red-400 text-base lg:text-lg font-bold">Trash Bin</span>}
            {!searchQuery && currentView === 'drive' && breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              const pathToHere = breadcrumbs.slice(1, idx + 1).join('/');
              return (
                <React.Fragment key={idx}>
                  <button onClick={() => navigateTo('drive', pathToHere)} className={`hover:text-blue-400 ${isLast ? 'text-neutral-100 font-semibold' : ''}`}>{crumb}</button>
                  {!isLast && <ChevronRight size={14} className="text-neutral-600 flex-shrink-0" />}
                </React.Fragment>
              );
            })}
          </div>
          
          {/* Header Actions (Search, Grid Toggle, Upload) */}
          <div className="flex items-center gap-3 ml-4">
            {/* INLINE SEARCH BAR */}
            <div className="relative">
              <div className="flex items-center bg-neutral-800/50 border border-neutral-700 rounded-lg px-3 py-1.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                <Search size={16} className="text-neutral-500 mr-2" />
                <input 
                  type="text" placeholder="Search files..." value={searchQuery} onChange={handleSearch} 
                  className="bg-transparent border-none focus:outline-none text-sm text-white w-24 lg:w-48 transition-all placeholder-neutral-500" 
                />
                {searchQuery && <button onClick={() => setSearchQuery('')} className="ml-2 text-neutral-400 hover:text-white"><X size={14}/></button>}
              </div>
            </div>

            {/* Grid/List Toggle */}
            <button onClick={() => setDisplayMode(displayMode === 'list' ? 'grid' : 'list')} className="p-2 text-neutral-400 hover:text-white bg-neutral-800/50 rounded-lg border border-neutral-700 hidden lg:block">
              {displayMode === 'list' ? <LayoutGrid size={16} /> : <List size={16} />}
            </button>

            {!searchQuery && currentView === 'drive' && (
              <div className="hidden lg:flex items-center gap-3">
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 text-sm font-medium px-4 py-2 rounded-lg border border-blue-500/20"><UploadCloud size={16} /> Upload</button>
                <button onClick={() => setShowFolderModal(true)} className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-sm font-medium px-4 py-2 rounded-lg border border-neutral-700"><FolderPlus size={16} /> New Folder</button>
              </div>
            )}
            
            {!searchQuery && currentView === 'trash' && trashFiles.length > 0 && (
              <button onClick={handleEmptyTrash} className="flex items-center gap-2 bg-red-600/10 text-red-400 hover:bg-red-600/20 text-sm font-medium px-4 py-2 rounded-lg border border-red-500/20"><Trash2 size={16} /> Empty Trash</button>
            )}
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className={`flex-1 overflow-y-auto p-4 lg:p-8 pb-32 lg:pb-8 transition-colors ${dragActive ? 'bg-blue-500/5' : ''}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleChange} />

          {/* VIEW: LIVE SEARCH RESULTS */}
          {searchQuery.trim() !== '' && (
            <div>
              <h2 className="text-xs lg:text-sm font-semibold text-neutral-400 mb-4 tracking-wider uppercase">Searching across all folders...</h2>
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
                <div className="divide-y divide-neutral-800">
                  {searchResults.length === 0 ? (
                    <div className="p-12 text-center text-neutral-500">No matching files or folders found for "{searchQuery}".</div>
                  ) : (
                    searchResults.map((file, idx) => <FileItem key={idx} file={file} showLocation={true} />)
                  )}
                </div>
              </div>
            </div>
          )}

          {/* VIEW: RECENT PAGE */}
          {!searchQuery && currentView === 'recent' && (
            <div>
              {recentFiles.length === 0 ? (
                <div className="p-8 text-center text-neutral-500 bg-neutral-950 border border-neutral-800 rounded-xl shadow-sm">No recent activity.</div>
              ) : displayMode === 'grid' ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 lg:gap-4">
                  {recentFiles.map((file, idx) => <FileItem key={idx} file={file} />)}
                </div>
              ) : (
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
                  <div className="divide-y divide-neutral-800">
                    {recentFiles.map((file, idx) => <FileItem key={idx} file={file} />)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW: TRASH PAGE */}
          {!searchQuery && currentView === 'trash' && (
            <div>
              {trashFiles.length === 0 ? (
                <div className="p-8 text-center text-neutral-500 bg-neutral-950 border border-neutral-800 rounded-xl shadow-sm">Trash is empty.</div>
              ) : displayMode === 'grid' ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 lg:gap-4">
                  {trashFiles.map((file, idx) => <FileItem key={idx} file={file} />)}
                </div>
              ) : (
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
                  <div className="divide-y divide-neutral-800">
                    {trashFiles.map((file, idx) => <FileItem key={idx} file={file} />)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW: DRIVE */}
          {!searchQuery && currentView === 'drive' && (
            <>
              {/* Limited Recent Files on Root */}
              {currentPath === '' && recentFiles.length > 0 && (
                <div className="mb-10 lg:mb-12">
                  <h2 className="text-xs lg:text-sm font-semibold text-neutral-400 mb-4 tracking-wider uppercase flex items-center gap-2">
                    <Zap size={16} className="text-blue-400" /> Recent
                  </h2>
                  
                  {displayMode === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
                      {recentFiles.slice(0, 4).map((file, idx) => (
                        <FileItem key={idx} file={file} />
                      ))}
                    </div>
                  ) : (
                    <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
                      <div className="divide-y divide-neutral-800">
                        {recentFiles.slice(0, 4).map((file, idx) => (
                          <FileItem key={idx} file={file} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SEPARATE FLOATING BUTTON */}
                  {recentFiles.length > 4 && (
                    <div className="mt-6 flex justify-center">
                      <button 
                        onClick={() => navigateTo('recent')} 
                        className="px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/50 rounded-full text-sm font-medium text-blue-400 transition-all shadow-lg active:scale-95"
                      >
                        View all recent uploads
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* FOLDERS GRID (Increased columns) */}
              {foldersList.length > 0 && (
                <div className="mb-8 lg:mb-10">
                  <h2 className="text-xs lg:text-sm font-semibold text-neutral-400 mb-4 tracking-wider uppercase">Folders</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 lg:gap-4">
                    {foldersList.map((folder, idx) => (
                      <div key={idx} onClick={() => navigateTo('drive', folder.path)} className="flex items-center justify-between p-4 bg-neutral-950 border border-neutral-800 rounded-xl hover:bg-neutral-800/60 hover:border-neutral-700 cursor-pointer transition-all group">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <Folder className="text-blue-400 fill-blue-500/20 flex-shrink-0" size={24} />
                          <span className="text-sm font-medium text-neutral-200 group-hover:text-white truncate">{folder.name}</span>
                        </div>
                        <button onClick={(e) => handleContextMenu(e, folder)} className="p-2 lg:p-1 lg:opacity-0 group-hover:opacity-100 hover:bg-neutral-700 rounded-lg text-neutral-400 transition-all">
                          <MoreVertical size={20} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FILES GRID/LIST (Increased columns) */}
              {filesList.length > 0 && (
                <div>
                  <h2 className="text-xs lg:text-sm font-semibold text-neutral-400 mb-4 tracking-wider uppercase">Files</h2>
                  {displayMode === 'grid' ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 lg:gap-4">
                      {filesList.map((file, idx) => <FileItem key={idx} file={file} />)}
                    </div>
                  ) : (
                    <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
                      <div className="hidden lg:grid grid-cols-12 gap-4 p-4 border-b border-neutral-800 bg-neutral-900/50 text-xs font-medium text-neutral-400 uppercase tracking-wider">
                        <div className="col-span-7">Name</div>
                        <div className="col-span-3">Date Modified</div>
                        <div className="col-span-2 text-right pr-12">Size</div>
                      </div>
                      <div className="divide-y divide-neutral-800">
                        {filesList.map((file, idx) => <FileItem key={idx} file={file} />)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Empty State */}
              {files.length === 0 && !isUploading && recentFiles.length === 0 && currentPath !== '' && (
                <div className="h-full flex flex-col items-center justify-center text-neutral-500 gap-4 mt-20 px-4 text-center">
                  <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-neutral-800/50 flex items-center justify-center mb-2">
                    <UploadCloud size={40} className="text-neutral-600" />
                  </div>
                  <p className="text-base lg:text-lg font-medium text-neutral-400">Your folder is empty.</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}