import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, File as FileIcon, Folder, HardDrive, Download, Trash2, Clock, FolderPlus, ChevronRight, ChevronDown, MoreVertical, X, Edit2, Zap } from 'lucide-react';

const API_BASE = `http://${window.location.hostname}:3001`;

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
        className={`flex items-center gap-1.5 cursor-pointer p-1.5 rounded-lg transition-colors group ${
          isSelected ? 'text-blue-400 bg-blue-500/10' : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
        }`}
        onClick={handleSelect}
      >
        <div className="w-5 h-5 flex items-center justify-center rounded hover:bg-neutral-700/50" onClick={handleToggle}>
          {hasChildren ? (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <div className="w-3.5" /> 
          )}
        </div>
        <Folder size={16} className={`${isSelected ? "fill-blue-500/20" : "group-hover:fill-neutral-700"} transition-colors`} />
        <span className="text-sm truncate font-medium">{item.name || 'Root'}</span>
      </div>
      
      {isExpanded && hasChildren && (
        <div className="border-l border-neutral-800 ml-3.5 pl-2 relative">
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
  
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, item: null });
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    const closeMenu = () => setContextMenu({ show: false, x: 0, y: 0, item: null });
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
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

  return (
    <div className="flex h-screen bg-neutral-900 text-neutral-100 font-sans overflow-hidden relative">
      
      {/* MODAL */}
      {showFolderModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 p-6 rounded-2xl shadow-2xl w-96 transform scale-100 transition-all">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-white">New Folder</h2>
              <button onClick={() => setShowFolderModal(false)} className="text-neutral-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateFolder}>
              <input
                autoFocus type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-3 text-neutral-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-6"
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowFolderModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-300 hover:bg-neutral-800 transition-colors">Cancel</button>
                <button type="submit" disabled={!newFolderName.trim()} className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONTEXT MENU */}
      {contextMenu.show && (
        <div 
          className="absolute z-50 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl w-48 py-1 text-sm overflow-hidden"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {contextMenu.item?.isDirectory && (
             <button 
               className="w-full text-left px-4 py-2 hover:bg-blue-500/10 hover:text-blue-400 flex items-center gap-3 transition-colors"
               onClick={() => setCurrentPath(contextMenu.item.path)}
             >
               <Folder size={16} /> Open
             </button>
          )}
          {!contextMenu.item?.isDirectory && (
            <button 
              className="w-full text-left px-4 py-2 hover:bg-blue-500/10 hover:text-blue-400 flex items-center gap-3 transition-colors"
              onClick={() => handleDownload(contextMenu.item.path)}
            >
              <Download size={16} /> Download
            </button>
          )}
          <button className="w-full text-left px-4 py-2 text-neutral-500 flex items-center gap-3 cursor-not-allowed" title="Requires Database">
            <Edit2 size={16} /> Rename
          </button>
          <div className="h-px bg-neutral-700 my-1"></div>
          <button 
            className="w-full text-left px-4 py-2 hover:bg-red-500/10 hover:text-red-400 text-red-500 flex items-center gap-3 transition-colors"
            onClick={() => handleDelete(contextMenu.item.path)}
          >
            <Trash2 size={16} /> Delete
          </button>
        </div>
      )}

      {/* 1. UNIFIED LEFT SIDEBAR */}
      <aside className="w-72 bg-neutral-950 border-r border-neutral-800 flex flex-col flex-shrink-0 hidden lg:flex h-full">
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
        
        {/* Integrated Folder Tree */}
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
      <main className="flex-1 flex flex-col h-full min-w-0 bg-neutral-900">
        <header className="h-16 border-b border-neutral-800 flex items-center justify-between px-8 bg-neutral-900/50 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-400 overflow-x-auto whitespace-nowrap hide-scrollbar">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              const pathToHere = breadcrumbs.slice(1, idx + 1).join('/');
              return (
                <React.Fragment key={idx}>
                  <button onClick={() => setCurrentPath(pathToHere)} className={`hover:text-blue-400 transition-colors ${isLast ? 'text-neutral-100 font-semibold tracking-wide' : ''}`}>
                    {crumb}
                  </button>
                  {!isLast && <ChevronRight size={14} className="text-neutral-600" />}
                </React.Fragment>
              );
            })}
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 text-sm font-medium px-4 py-2 rounded-lg transition-colors border border-blue-500/20">
              <UploadCloud size={16} /> {isUploading ? 'Uploading...' : 'Upload'}
            </button>
            <button onClick={() => setShowFolderModal(true)} className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors border border-neutral-700">
              <FolderPlus size={16} /> New Folder
            </button>
          </div>
        </header>

        <div className={`flex-1 overflow-y-auto p-8 transition-colors ${dragActive ? 'bg-blue-500/5' : ''}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleChange} />

          {/* RECENT FILES (Only shown in Root view) */}
          {currentPath === '' && recentFiles.length > 0 && (
            <div className="mb-10">
              <h2 className="text-sm font-semibold text-neutral-400 mb-4 tracking-wider uppercase flex items-center gap-2">
                 <Zap size={16} className="text-blue-400"/> Recently Added
              </h2>
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
                <div className="divide-y divide-neutral-800">
                  {recentFiles.map((file, idx) => (
                    <div key={`recent-${idx}`} onContextMenu={(e) => handleContextMenu(e, file)} className="grid grid-cols-12 gap-4 p-4 items-center group transition-colors hover:bg-neutral-800/30">
                      <div className="col-span-7 flex items-center gap-3 overflow-hidden">
                        <FileIcon className="text-blue-500 flex-shrink-0" size={20} />
                        <div className="flex flex-col">
                          <span className="truncate text-sm font-medium text-neutral-200 group-hover:text-white transition-colors">{file.name.replace(/^\d+-/, '')}</span>
                          <span className="text-[10px] text-neutral-500 truncate">
                            {file.path.split('/').slice(0, -1).join('/') ? `In: ${file.path.split('/').slice(0, -1).join('/')}` : 'In: Home'}
                          </span>
                        </div>
                      </div>
                      <div className="col-span-3 text-sm text-neutral-500">
                        {new Date(file.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="col-span-2 text-sm text-neutral-500 flex items-center justify-end gap-2">
                        <span className="mr-4">{formatBytes(file.size)}</span>
                        <button onClick={(e) => { e.stopPropagation(); handleContextMenu(e, file); }} className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-neutral-700 rounded-md text-neutral-400 transition-all">
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {foldersList.length > 0 && (
            <div className="mb-10">
              <h2 className="text-sm font-semibold text-neutral-400 mb-4 tracking-wider uppercase">Folders</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {foldersList.map((folder, idx) => (
                  <div key={idx} onContextMenu={(e) => handleContextMenu(e, folder)} onClick={() => setCurrentPath(folder.path)} className="flex items-center justify-between p-4 bg-neutral-950 border border-neutral-800 rounded-xl hover:bg-neutral-800/60 hover:border-neutral-700 cursor-pointer transition-all group">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <Folder className="text-blue-400 fill-blue-500/20 flex-shrink-0" size={24} />
                      <span className="text-sm font-medium text-neutral-200 group-hover:text-white truncate">{folder.name}</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleContextMenu(e, folder); }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-neutral-700 rounded text-neutral-400 transition-all">
                      <MoreVertical size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filesList.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-neutral-400 mb-4 tracking-wider uppercase">Files</h2>
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-neutral-800 bg-neutral-900/50 text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  <div className="col-span-7">Name</div>
                  <div className="col-span-3">Date Modified</div>
                  <div className="col-span-2 text-right pr-8">Size</div>
                </div>
                <div className="divide-y divide-neutral-800">
                  {filesList.map((file, idx) => (
                    <div key={idx} onContextMenu={(e) => handleContextMenu(e, file)} className="grid grid-cols-12 gap-4 p-4 items-center group transition-colors hover:bg-neutral-800/30">
                      <div className="col-span-7 flex items-center gap-3 overflow-hidden">
                        <FileIcon className="text-neutral-500 flex-shrink-0" size={20} />
                        <span className="truncate text-sm font-medium text-neutral-200 group-hover:text-white transition-colors">{file.name.replace(/^\d+-/, '')}</span>
                      </div>
                      <div className="col-span-3 text-sm text-neutral-500">
                        {new Date(file.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="col-span-2 text-sm text-neutral-500 flex items-center justify-end gap-2">
                        <span className="mr-4">{formatBytes(file.size)}</span>
                        <button onClick={(e) => { e.stopPropagation(); handleContextMenu(e, file); }} className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-neutral-700 rounded-md text-neutral-400 transition-all">
                          <MoreVertical size={16} />
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
            <div className="h-full flex flex-col items-center justify-center text-neutral-500 gap-4 mt-20">
              <div className="w-24 h-24 rounded-full bg-neutral-800/50 flex items-center justify-center mb-2">
                <UploadCloud size={40} className="text-neutral-600" />
              </div>
              <p className="text-lg font-medium text-neutral-400">Drag and drop files here</p>
              <p className="text-sm">or click the Upload button above.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}