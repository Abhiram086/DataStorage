import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, File as FileIcon, Folder, HardDrive, Download, Trash2, 
  Clock, FolderPlus, ChevronRight, ChevronDown, MoreVertical, X, 
  Edit2, Zap, Maximize, Plus, Home 
} from 'lucide-react';

const API_BASE = `http://${window.location.hostname}:3001`;

// --- HELPER: FILE TYPE DETECTION ---
const getFileType = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) return 'video';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (['pdf'].includes(ext)) return 'pdf';
  return 'unknown';
};

// --- SUB-COMPONENT: Recursive Folder Tree ---
const FolderTreeItem = ({ item, currentPath, setCurrentPath }) => {
  const isSelected = currentPath === item.path;
  const isParentOfCurrent = currentPath.startsWith(item.path + '/');
  const [isExpanded, setIsExpanded] = useState(isSelected || isParentOfCurrent);
  const hasChildren = item.children && item.children.length > 0;

  const handleToggle = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleSelect = (e) => {
    e.stopPropagation();
    setCurrentPath(item.path);
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
        <div className="w-6 h-6 lg:w-5 lg:h-5 flex items-center justify-center rounded hover:bg-neutral-700/50" onClick={handleToggle}>
          {hasChildren ? (
            isExpanded ? <ChevronDown size={16} className="lg:w-3.5 lg:h-3.5" /> : <ChevronRight size={16} className="lg:w-3.5 lg:h-3.5" />
          ) : (
            <div className="w-4 lg:w-3.5" /> 
          )}
        </div>
        <Folder size={18} className={`lg:w-4 lg:h-4 ${isSelected ? "fill-blue-500/20" : "group-hover:fill-neutral-700"} transition-colors`} />
        <span className="text-base lg:text-sm truncate font-medium">{item.name || 'Root'}</span>
      </div>
      
      {isExpanded && hasChildren && (
        <div className="border-l border-neutral-800 ml-4 lg:ml-3.5 pl-3 lg:pl-2 relative">
          {item.children.map(child => (
            <FolderTreeItem key={child.path} item={child} currentPath={currentPath} setCurrentPath={setCurrentPath} />
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
  const [currentPath, setCurrentPath] = useState(''); 
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  // UI States
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, item: null });
  const [viewingFile, setViewingFile] = useState(null); 
  
  // Mobile Specific States
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);
  
  const fileInputRef = useRef(null);

  // Close menus when clicking outside
  useEffect(() => {
    const closeMenu = () => setContextMenu({ show: false, x: 0, y: 0, item: null });
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  // ROUTING: Listen for browser Back/Forward buttons
  useEffect(() => {
    const handleHashChange = () => {
      // Get the path from the URL, removing the '#'
      const hashPath = decodeURIComponent(window.location.hash.replace(/^#/, ''));
      setCurrentPath(hashPath);
      // Close media viewer and menus if user presses back
      setViewingFile(null);
      setMobileTreeOpen(false);
      setMobileActionsOpen(false);
    };

    // Initialize state from URL on first load
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Fetch data AND update URL whenever currentPath changes
  useEffect(() => {
    // Update the browser URL so it's saved in history
    const expectedHash = encodeURIComponent(currentPath);
    if (window.location.hash.replace(/^#/, '') !== expectedHash) {
      window.location.hash = expectedHash;
    }

    fetchFiles();
    fetchTree();
    fetchRecent();
  }, [currentPath]);

  const fetchFiles = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/files?path=${encodeURIComponent(currentPath)}`);
      if (response.ok) setFiles(await response.json());
    } catch (error) { console.error("Failed to fetch files", error); }
  };

  const fetchTree = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/tree`);
      if (response.ok) {
        const data = await response.json();
        setTree(data[0]?.children || []);
      }
    } catch (error) { console.error("Failed to fetch tree", error); }
  };

  const fetchRecent = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/recent`);
      if (response.ok) setRecentFiles(await response.json());
    } catch (error) { console.error("Failed to fetch recent files", error); }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/api/folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPath, folderName: newFolderName.trim() })
      });
      if (response.ok) {
        setNewFolderName('');
        setShowFolderModal(false);
        fetchFiles();
        fetchTree();
      } else {
        const data = await response.json();
        alert(data.error);
      }
    } catch (error) { console.error("Failed to create folder", error); }
  };

  const handleDelete = async (targetPath) => {
    if (!window.confirm("Are you sure you want to delete this?")) return;
    try {
      await fetch(`${API_BASE}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath })
      });
      fetchFiles();
      fetchTree();
      fetchRecent();
      if (currentPath === targetPath || currentPath.startsWith(targetPath + '/')) {
        setCurrentPath('');
      }
      if (viewingFile?.path === targetPath) setViewingFile(null); 
    } catch (error) { console.error("Failed to delete", error); }
  };

  const handleDownload = (targetPath) => {
    window.open(`${API_BASE}/api/download?path=${encodeURIComponent(targetPath)}`, '_blank');
  };

  const handleUpload = async (file) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('path', currentPath); 
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      if (response.ok) {
        fetchFiles();
        fetchRecent(); 
      }
    } catch (error) {
      alert("Upload failed. Is backend running?");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
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

  const formatBytes = (bytes) => {
    if (!+bytes) return '';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${sizes[i]}`;
  };

  const foldersList = files.filter(f => f.isDirectory);
  const filesList = files.filter(f => !f.isDirectory);
  const breadcrumbs = ['Home', ...currentPath.split('/').filter(Boolean)];

  // Reusable component for context menu actions
  const ContextMenuActions = ({ item, isMobile }) => {
    const btnClass = `w-full text-left px-4 py-3 lg:py-2 hover:bg-blue-500/10 hover:text-blue-400 flex items-center gap-3 transition-colors ${isMobile ? 'text-base font-medium' : 'text-sm'}`;
    const iconSize = isMobile ? 20 : 16;
    
    return (
      <>
        {item?.isDirectory && (
           <button className={btnClass} onClick={() => setCurrentPath(item.path)}>
             <Folder size={iconSize} /> Open Folder
           </button>
        )}
        {!item?.isDirectory && (
          <>
            <button className={btnClass} onClick={() => setViewingFile(item)}>
              <Maximize size={iconSize} /> View Media
            </button>
            <button className={btnClass} onClick={() => handleDownload(item.path)}>
              <Download size={iconSize} /> Download File
            </button>
          </>
        )}
        <div className="h-px bg-neutral-700/50 my-1"></div>
        <button className={`w-full text-left px-4 py-3 lg:py-2 hover:bg-red-500/10 hover:text-red-400 text-red-500 flex items-center gap-3 transition-colors ${isMobile ? 'text-base font-medium' : 'text-sm'}`} onClick={() => handleDelete(item.path)}>
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
            {getFileType(viewingFile.name) === 'image' && (
              <img src={`${API_BASE}/api/view?path=${encodeURIComponent(viewingFile.path)}`} className="max-w-full max-h-full object-contain drop-shadow-2xl rounded-sm" alt="Preview" />
            )}
            {getFileType(viewingFile.name) === 'video' && (
              <video src={`${API_BASE}/api/view?path=${encodeURIComponent(viewingFile.path)}`} controls autoPlay className="max-w-full max-h-full rounded-lg shadow-2xl outline-none bg-black">
                Your browser does not support HTML video.
              </video>
            )}
            {getFileType(viewingFile.name) === 'pdf' && (
              <iframe src={`${API_BASE}/api/view?path=${encodeURIComponent(viewingFile.path)}`} className="w-full h-full rounded-lg shadow-2xl bg-white" title="PDF Preview" />
            )}
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
        <button onClick={() => setCurrentPath('')} className={`flex flex-col items-center transition-colors ${currentPath === '' ? 'text-blue-400' : 'text-neutral-400 hover:text-white'}`}>
          <Home size={22} />
        </button>
        <button onClick={() => setMobileTreeOpen(true)} className="flex flex-col items-center text-neutral-400 hover:text-white transition-colors">
          <Folder size={22} />
        </button>
        
        {/* Adjusted Floating Action Button (Flush inside dock) */}
        <div className="relative">
          <button onClick={() => setMobileActionsOpen(true)} className="bg-blue-600 p-3 rounded-full shadow-lg shadow-blue-500/30 text-white hover:bg-blue-500 transition-transform active:scale-95">
            <Plus size={24} />
          </button>
        </div>
        
        <button className="flex flex-col items-center text-neutral-400 hover:text-white transition-colors">
          <Clock size={22} />
        </button>
      </div>

      {/* 📱 MOBILE ACTION SHEET (Upload / New Folder) */}
      {mobileActionsOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end" onClick={() => setMobileActionsOpen(false)}>
          <div className="w-full bg-neutral-900 rounded-t-3xl p-6 pb-12 shadow-2xl transform transition-transform" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-neutral-400 text-xs font-bold uppercase tracking-wider">Create New</h3>
              <button onClick={() => setMobileActionsOpen(false)} className="bg-neutral-800 p-2 rounded-full text-neutral-400"><X size={16}/></button>
            </div>
            <div className="flex gap-4">
              <button className="flex-1 bg-neutral-800 hover:bg-neutral-700 transition-colors p-6 rounded-2xl flex flex-col items-center gap-3" onClick={() => {fileInputRef.current?.click(); setMobileActionsOpen(false);}}>
                <UploadCloud size={32} className="text-blue-400" />
                <span className="text-sm font-medium text-white">Upload File</span>
              </button>
              <button className="flex-1 bg-neutral-800 hover:bg-neutral-700 transition-colors p-6 rounded-2xl flex flex-col items-center gap-3" onClick={() => {setShowFolderModal(true); setMobileActionsOpen(false);}}>
                <FolderPlus size={32} className="text-blue-400" />
                <span className="text-sm font-medium text-white">New Folder</span>
              </button>
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
            <div className="px-1">
              {tree.length === 0 ? (
                <div className="text-sm text-neutral-500 mt-4">No folders yet.</div>
              ) : (
                tree.map(node => <FolderTreeItem key={node.path} item={node} currentPath={currentPath} setCurrentPath={(p) => { setCurrentPath(p); setMobileTreeOpen(false); }} />)
              )}
            </div>
          </div>
        </div>
      )}

      {/* NEW FOLDER MODAL */}
      {showFolderModal && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-neutral-900 border border-neutral-700 p-6 rounded-2xl shadow-2xl w-full max-w-sm transform scale-100 transition-all">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-white">New Folder</h2>
              <button onClick={() => setShowFolderModal(false)} className="text-neutral-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateFolder}>
              <input
                autoFocus type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-3 text-neutral-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-6"
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowFolderModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-300 hover:bg-neutral-800 transition-colors">Cancel</button>
                <button type="submit" disabled={!newFolderName.trim()} className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESPONSIVE CONTEXT MENU */}
      {contextMenu.show && (
        <>
          {/* Desktop Dropdown */}
          <div className="hidden lg:block absolute z-[60] bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl w-48 py-1 overflow-hidden" style={{ top: contextMenu.y, left: contextMenu.x }}>
            <ContextMenuActions item={contextMenu.item} isMobile={false} />
          </div>
          
          {/* Mobile Bottom Sheet Menu */}
          <div className="lg:hidden fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex flex-col justify-end" onClick={() => setContextMenu({ show: false, x: 0, y: 0, item: null })}>
            <div className="bg-neutral-900 rounded-t-2xl pb-8 pt-4 px-2" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1.5 bg-neutral-700 rounded-full mx-auto mb-6"></div>
              <div className="px-4 mb-4 flex items-center gap-3">
                {contextMenu.item?.isDirectory ? <Folder className="text-blue-500" size={24}/> : <FileIcon className="text-blue-500" size={24}/>}
                <span className="font-semibold text-white truncate text-lg">{contextMenu.item?.name}</span>
              </div>
              <ContextMenuActions item={contextMenu.item} isMobile={true} />
            </div>
          </div>
        </>
      )}

      {/* 1. DESKTOP LEFT SIDEBAR */}
      <aside className="w-72 bg-neutral-950 border-r border-neutral-800 flex-col flex-shrink-0 hidden lg:flex h-full z-10">
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3 text-xl font-semibold tracking-tight text-white cursor-pointer mb-8" onClick={() => setCurrentPath('')}>
            <HardDrive className="text-blue-500" />
            <span>DataStorage</span>
          </div>
          <nav className="flex flex-col gap-2">
            <button onClick={() => setCurrentPath('')} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors ${currentPath === '' ? 'bg-blue-500/10 text-blue-400' : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'}`}>
              <Folder size={18} /> My Drive
            </button>
            <button className="flex items-center gap-3 px-4 py-2.5 text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 rounded-lg font-medium transition-colors">
              <Clock size={18} /> Recent
            </button>
          </nav>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 pb-6 custom-scrollbar">
          <div className="h-px bg-neutral-800 my-4 mx-2"></div>
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 px-2">Folders</h3>
          <div className="px-1">
            {tree.length === 0 ? (
              <div className="text-xs text-neutral-600 px-2 mt-2">No folders yet.</div>
            ) : (
              tree.map(node => <FolderTreeItem key={node.path} item={node} currentPath={currentPath} setCurrentPath={setCurrentPath} />)
            )}
          </div>
        </div>
      </aside>

      {/* 2. CENTER (Main Content) */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-neutral-900 relative">
        <header className="h-16 border-b border-neutral-800 flex items-center justify-between px-4 lg:px-8 bg-neutral-900/80 backdrop-blur-md flex-shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-1.5 lg:gap-2 text-sm font-medium text-neutral-400 overflow-x-auto whitespace-nowrap hide-scrollbar">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              const pathToHere = breadcrumbs.slice(1, idx + 1).join('/');
              return (
                <React.Fragment key={idx}>
                  <button onClick={() => setCurrentPath(pathToHere)} className={`hover:text-blue-400 transition-colors ${isLast ? 'text-neutral-100 font-semibold tracking-wide' : ''}`}>
                    {crumb}
                  </button>
                  {!isLast && <ChevronRight size={14} className="text-neutral-600 flex-shrink-0" />}
                </React.Fragment>
              );
            })}
          </div>
          
          {/* Desktop Actions (Hidden on Mobile) */}
          <div className="hidden lg:flex items-center gap-3">
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 text-sm font-medium px-4 py-2 rounded-lg transition-colors border border-blue-500/20">
              <UploadCloud size={16} /> {isUploading ? 'Uploading...' : 'Upload'}
            </button>
            <button onClick={() => setShowFolderModal(true)} className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors border border-neutral-700">
              <FolderPlus size={16} /> New Folder
            </button>
          </div>
        </header>

        {/* Scrollable Area (Added bottom padding for mobile dock clearance) */}
        <div className={`flex-1 overflow-y-auto p-4 lg:p-8 pb-32 lg:pb-8 transition-colors ${dragActive ? 'bg-blue-500/5' : ''}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleChange} />

          {/* RECENT FILES */}
          {currentPath === '' && recentFiles.length > 0 && (
            <div className="mb-8 lg:mb-10">
              <h2 className="text-xs lg:text-sm font-semibold text-neutral-400 mb-4 tracking-wider uppercase flex items-center gap-2">
                 <Zap size={16} className="text-blue-400"/> Recently Added
              </h2>
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
                <div className="divide-y divide-neutral-800">
                  {recentFiles.map((file, idx) => (
                    <div key={`recent-${idx}`} onClick={() => setViewingFile(file)} className="flex items-center justify-between p-4 group transition-colors hover:bg-neutral-800/30 cursor-pointer">
                      <div className="flex items-center gap-3 overflow-hidden pr-4">
                        <FileIcon className="text-blue-500 flex-shrink-0" size={24} />
                        <div className="flex flex-col overflow-hidden">
                          <span className="truncate text-sm font-medium text-neutral-200 group-hover:text-white transition-colors">{file.name.replace(/^\d+-/, '')}</span>
                          <span className="text-xs text-neutral-500 truncate mt-0.5">
                            {formatBytes(file.size)} • {file.path.split('/').slice(0, -1).join('/') ? `In: ${file.path.split('/').slice(0, -1).join('/')}` : 'In: Home'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <span className="hidden md:block text-sm text-neutral-500">{new Date(file.date).toLocaleDateString()}</span>
                        <button onClick={(e) => handleContextMenu(e, file)} className="p-2 lg:opacity-0 group-hover:opacity-100 hover:bg-neutral-700 rounded-lg text-neutral-400 transition-all active:bg-neutral-600">
                          <MoreVertical size={20} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* FOLDERS GRID */}
          {foldersList.length > 0 && (
            <div className="mb-8 lg:mb-10">
              <h2 className="text-xs lg:text-sm font-semibold text-neutral-400 mb-4 tracking-wider uppercase">Folders</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
                {foldersList.map((folder, idx) => (
                  <div key={idx} onClick={() => setCurrentPath(folder.path)} className="flex items-center justify-between p-4 bg-neutral-950 border border-neutral-800 rounded-xl hover:bg-neutral-800/60 hover:border-neutral-700 cursor-pointer transition-all group">
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

          {/* FILES LIST */}
          {filesList.length > 0 && (
            <div>
              <h2 className="text-xs lg:text-sm font-semibold text-neutral-400 mb-4 tracking-wider uppercase">Files</h2>
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
                
                {/* Desktop Table Header */}
                <div className="hidden lg:grid grid-cols-12 gap-4 p-4 border-b border-neutral-800 bg-neutral-900/50 text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  <div className="col-span-7">Name</div>
                  <div className="col-span-3">Date Modified</div>
                  <div className="col-span-2 text-right pr-12">Size</div>
                </div>
                
                <div className="divide-y divide-neutral-800">
                  {filesList.map((file, idx) => (
                    <div key={idx} onClick={() => setViewingFile(file)} className="flex lg:grid lg:grid-cols-12 gap-4 p-4 items-center justify-between lg:justify-start group transition-colors hover:bg-neutral-800/30 cursor-pointer">
                      
                      <div className="lg:col-span-7 flex items-center gap-3 overflow-hidden pr-4">
                        <FileIcon className="text-neutral-500 flex-shrink-0" size={24} />
                        <div className="flex flex-col overflow-hidden">
                          <span className="truncate text-sm font-medium text-neutral-200 group-hover:text-white transition-colors">{file.name.replace(/^\d+-/, '')}</span>
                          <span className="text-xs text-neutral-500 lg:hidden mt-0.5">
                            {formatBytes(file.size)} • {new Date(file.date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      
                      <div className="hidden lg:block lg:col-span-3 text-sm text-neutral-500">
                        {new Date(file.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      
                      <div className="lg:col-span-2 text-sm text-neutral-500 flex items-center justify-end gap-2 flex-shrink-0">
                        <span className="hidden lg:inline mr-4">{formatBytes(file.size)}</span>
                        <button onClick={(e) => handleContextMenu(e, file)} className="p-2 lg:p-1.5 lg:opacity-0 group-hover:opacity-100 hover:bg-neutral-700 rounded-lg text-neutral-400 transition-all active:bg-neutral-600">
                          <MoreVertical size={20} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {files.length === 0 && !isUploading && recentFiles.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-neutral-500 gap-4 mt-20 px-4 text-center">
              <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-neutral-800/50 flex items-center justify-center mb-2">
                <UploadCloud size={40} className="text-neutral-600" />
              </div>
              <p className="text-base lg:text-lg font-medium text-neutral-400">Your folder is empty.</p>
              <p className="text-sm">Use the <span className="lg:hidden">`+` button below</span><span className="hidden lg:inline">Upload button above</span> to add files.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}