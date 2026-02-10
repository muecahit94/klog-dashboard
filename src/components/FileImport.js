'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { parseKlog, parseMultipleKlogFiles, getDemoData } from '@/lib/klogParser';

export default function FileImport({ onImport, hasData }) {
    const [isDragOver, setIsDragOver] = useState(false);
    const [importStatus, setImportStatus] = useState(null);
    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);

    // React does not support webkitdirectory as a JSX prop — set it via ref
    useEffect(() => {
        if (folderInputRef.current) {
            folderInputRef.current.setAttribute('webkitdirectory', '');
            folderInputRef.current.setAttribute('directory', '');
        }
    }, []);

    const processFiles = useCallback(async (fileList) => {
        const files = [];
        for (const file of fileList) {
            if (file.name.endsWith('.klg') || file.name.endsWith('.txt') || file.name.endsWith('.klog')) {
                try {
                    const content = await file.text();
                    files.push({ name: file.webkitRelativePath || file.name, content });
                } catch (err) {
                    console.error(`Error reading ${file.name}:`, err);
                }
            }
        }

        if (files.length === 0) {
            setImportStatus({ type: 'error', message: 'No .klg or .txt files found' });
            return;
        }

        const records = parseMultipleKlogFiles(files);
        setImportStatus({
            type: 'success',
            message: `Imported ${records.length} records from ${files.length} file${files.length > 1 ? 's' : ''}`,
        });
        onImport(records);
    }, [onImport]);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(false);

        const items = e.dataTransfer.items;
        if (items) {
            const filePromises = [];
            for (const item of items) {
                if (item.kind === 'file') {
                    const entry = item.webkitGetAsEntry?.();
                    if (entry) {
                        filePromises.push(readEntry(entry));
                    } else {
                        const file = item.getAsFile();
                        if (file) filePromises.push(Promise.resolve([file]));
                    }
                }
            }
            Promise.all(filePromises).then((results) => {
                const allFiles = results.flat();
                processFiles(allFiles);
            });
        } else {
            processFiles(e.dataTransfer.files);
        }
    }, [processFiles]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragOver(false);
    }, []);

    const handleFileSelect = useCallback((e) => {
        if (e.target.files?.length) {
            processFiles(e.target.files);
        }
        // Reset the input so the same file/folder can be re-selected
        e.target.value = '';
    }, [processFiles]);

    const handleDemoData = useCallback(() => {
        const content = getDemoData();
        const records = parseKlog(content, 'demo.klg');
        setImportStatus({
            type: 'success',
            message: `Loaded ${records.length} demo records`,
        });
        onImport(records);
    }, [onImport]);

    return (
        <div className="animate-fade-in">
            <div
                className={`file-import-zone ${isDragOver ? 'drag-over' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
            >
                <span className="file-import-icon">📂</span>
                <div className="file-import-title">
                    {hasData ? 'Import more klog files' : 'Drop your klog files here'}
                </div>
                <div className="file-import-subtitle">
                    Supports .klg and .txt files • Drag files or entire folders
                </div>
                <div className="file-import-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
                        📄 Select Files
                    </button>
                    <button className="btn btn-secondary" onClick={() => folderInputRef.current?.click()}>
                        📁 Select Folder
                    </button>
                    {!hasData && (
                        <button className="btn btn-secondary" onClick={handleDemoData}>
                            ✨ Load Demo Data
                        </button>
                    )}
                </div>
                {importStatus && (
                    <div className={`import-status ${importStatus.type === 'error' ? 'text-danger' : ''}`}
                        style={importStatus.type === 'error' ? { color: 'var(--accent-danger)' } : {}}>
                        {importStatus.type === 'success' ? '✓' : '⚠'} {importStatus.message}
                    </div>
                )}
            </div>
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".klg,.txt,.klog"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />
            <input
                ref={folderInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />
        </div>
    );
}

async function readEntry(entry) {
    if (entry.isFile) {
        return new Promise((resolve) => {
            entry.file((file) => resolve([file]), () => resolve([]));
        });
    } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        return new Promise((resolve) => {
            const allFiles = [];
            const readBatch = () => {
                dirReader.readEntries(async (entries) => {
                    if (entries.length === 0) {
                        resolve(allFiles);
                        return;
                    }
                    for (const e of entries) {
                        const files = await readEntry(e);
                        allFiles.push(...files);
                    }
                    readBatch();
                }, () => resolve(allFiles));
            };
            readBatch();
        });
    }
    return [];
}
