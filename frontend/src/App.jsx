import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, File, Folder, HardDrive, Download, Trash2, Clock } from 'lucide-react';

export default function App() {
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      // Talking to our Node.js backend!
      const response = await fetch('http://localhost:3001/api/files');
      if (response.ok) {
        const data = await response.json();
        setFiles(data);
      }
    } catch (error) {
      console.error("Backend not reached", error);
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0]);
    }
  };

  const handleUpload = async (file) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        fetchFiles(); // Refresh list after upload
      } else {
        alert("Upload failed. Is the backend running?");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Cannot connect to backend. Make sure 'node server.js' is running.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex h-screen bg-neutral-900 text-neutral-100 font-sans">
      <aside className="w-64 bg-neutral-950 border-r border-neutral-800 p-6 flex flex-col gap-8 hidden md:flex">
        <div className="flex items-center gap-3 text-xl font-semibold tracking-tight text-white">
          <HardDrive className="text-blue-500" />
          <span>NovaDrive</span>
        </div>
        
        <nav className="flex flex-col gap-2">
          <button className="flex items-center gap-3 px-4 py-2.5 bg-blue-500/10 text-blue-400 rounded-lg font-medium transition-colors">
            <Folder size={18} />
            My Files
          </button>
          <button className="flex items-center gap-3 px-4 py-2.5 text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 rounded-lg font-medium transition-colors">
            <Clock size={18} />
            Recent
          </button>
          <button className="flex items-center gap-3 px-4 py-2.5 text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200 rounded-lg font-medium transition-colors">
            <Trash2 size={18} />
            Trash
          </button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 border-b border-neutral-800 flex items-center px-8 bg-neutral-900/50 backdrop-blur-sm">
          <h1 className="text-lg font-medium">My Files</h1>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div 
            className={`w-full max-w-4xl mx-auto border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-all duration-200 ease-in-out cursor-pointer mb-10 ${
              dragActive 
                ? 'border-blue-500 bg-blue-500/5' 
                : 'border-neutral-700 bg-neutral-800/20 hover:border-neutral-500 hover:bg-neutral-800/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleChange} />
            <div className={`p-4 rounded-full mb-4 ${dragActive ? 'bg-blue-500/20 text-blue-400' : 'bg-neutral-800 text-neutral-400'}`}>
              <UploadCloud size={32} />
            </div>
            <h3 className="text-lg font-medium text-neutral-200 mb-1">
              {isUploading ? 'Uploading...' : 'Click or drag files to upload'}
            </h3>
            <p className="text-sm text-neutral-500">Files will be saved directly to your local CachyOS storage.</p>
          </div>

          <div className="max-w-4xl mx-auto">
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">Recent Files</h2>
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden">
              <div className="grid grid-cols-12 gap-4 p-4 border-b border-neutral-800 bg-neutral-900/50 text-xs font-medium text-neutral-400 uppercase">
                <div className="col-span-6 md:col-span-7">Name</div>
                <div className="col-span-3 md:col-span-3">Date Added</div>
                <div className="col-span-3 md:col-span-2 text-right">Size</div>
              </div>
              
              <div className="divide-y divide-neutral-800">
                {files.length === 0 ? (
                  <div className="p-8 text-center text-neutral-500 text-sm">No files uploaded yet.</div>
                ) : (
                  files.map((file, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-neutral-800/30 transition-colors group">
                      <div className="col-span-6 md:col-span-7 flex items-center gap-3 overflow-hidden">
                        <File className="text-neutral-500 flex-shrink-0" size={18} />
                        <span className="truncate text-sm text-neutral-200 group-hover:text-white transition-colors">
                          {file.name.replace(/^\d+-/, '')}
                        </span>
                      </div>
                      <div className="col-span-3 md:col-span-3 text-sm text-neutral-500">
                        {new Date(file.date).toLocaleDateString()}
                      </div>
                      <div className="col-span-3 md:col-span-2 text-sm text-neutral-500 text-right">
                        {formatBytes(file.size)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}