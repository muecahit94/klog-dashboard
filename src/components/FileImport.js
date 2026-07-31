'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { parseKlogWithDiagnostics, parseMultipleKlogFilesWithDiagnostics, getDemoData } from '@/lib/klogParser';

export default function FileImport({ onImport, hasData }) {
    const [isDragOver, setIsDragOver] = useState(false);
    const [importStatus, setImportStatus] = useState(null);
    const [parseWarnings, setParseWarnings] = useState([]);
    const fileInputRef = useRef(null);

    // State for tracking last modified times of auto-imported files
    const [knownFiles, setKnownFiles] = useState({});

    // Poll for updates from /api/files
    useEffect(() => {
        let isMounted = true;

        const checkUpdates = async () => {
            try {
                const res = await fetch('/api/files', { cache: 'no-store' });
                if (!res.ok) return;

                const data = await res.json();

                // Show API errors to user
                if (data.error) {
                    setImportStatus({ type: 'error', message: `Folder watch error: ${data.error}` });
                    return;
                }

                const fileList = data.files || [];
                if (!Array.isArray(fileList) || fileList.length === 0) return;

                // Determine which files need updating
                const filesToFetch = [];
                const newKnownFiles = { ...knownFiles };
                let hasChanges = false;

                for (const fileInfo of fileList) {
                    const { path, name, mtime } = fileInfo;

                    // If file is new or modified since last check
                    if (!knownFiles[name] || knownFiles[name] < mtime) {
                        filesToFetch.push({ path, name, mtime });
                        newKnownFiles[name] = mtime;
                        hasChanges = true;
                    }
                }

                if (filesToFetch.length > 0) {
                    const loadedFiles = [];
                    for (const f of filesToFetch) {
                        try {
                            const fileRes = await fetch(f.path, { cache: 'no-store' });
                            if (!fileRes.ok) continue;
                            const content = await fileRes.text();
                            loadedFiles.push({ name: f.name, content });
                        } catch (err) {
                            console.error(`Failed to load file ${f.path}:`, err);
                        }
                    }

                    if (loadedFiles.length > 0) {
                        const { records, warnings } = parseMultipleKlogFilesWithDiagnostics(loadedFiles);
                        setParseWarnings(warnings);
                        onImport(records, { replaceFiles: loadedFiles.map(f => f.name) });

                        setImportStatus({
                            type: 'success',
                            message: `Watching ${data.dataDir || 'folder'} — ${records.length} records from ${loadedFiles.length} file${loadedFiles.length > 1 ? 's' : ''}`,
                        });
                    }
                }

                if (hasChanges && isMounted) {
                    setKnownFiles(newKnownFiles);
                }

            } catch (err) {
                console.debug('Polling error:', err);
            }
        };

        // Check immediately and then every 3 seconds
        checkUpdates();
        const interval = setInterval(checkUpdates, 3000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [onImport, knownFiles]);

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

        const { records, warnings } = parseMultipleKlogFilesWithDiagnostics(files);
        setParseWarnings(warnings);

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
            // Convert to array immediately because e.target.value = '' might clear the FileList
            const files = Array.from(e.target.files);
            processFiles(files);
        }
        // Reset the input so the same file/folder can be re-selected
        e.target.value = '';
    }, [processFiles]);

    const handleDemoData = useCallback(() => {
        const content = getDemoData();
        const { records } = parseKlogWithDiagnostics(content, 'demo.klg');
        setParseWarnings([]);
        setImportStatus({
            type: 'success',
            message: `Loaded ${records.length} demo records`,
        });
        onImport(records);
    }, [onImport]);

    // Compact mode when data is already loaded
    if (hasData) {
        return (
            <div className="animate-fade-in">
                <div
                    className={`file-import-compact ${isDragOver ? 'drag-over' : ''}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                >
                    <div className="file-import-compact-left">
                        {importStatus && (
                            <span className={importStatus.type === 'error' ? 'text-danger' : ''}>
                                {importStatus.type === 'success' ? '✓' : '⚠'} {importStatus.message}
                            </span>
                        )}
                        {!importStatus && <span>📂 Drop files to import more</span>}
                    </div>
                    <button className="btn btn-sm" onClick={() => fileInputRef.current?.click()}>
                        + Add Files
                    </button>
                </div>
                <ParseWarnings warnings={parseWarnings} onDismiss={() => setParseWarnings([])} />
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".klg,.txt,.klog"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                />
            </div>
        );
    }

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
                    Drop your klog files here
                </div>
                <div className="file-import-subtitle">
                    Supports .klg and .txt files • Drag files or entire folders
                </div>
                <div className="file-import-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
                        📄 Select Files
                    </button>
                    <button className="btn btn-secondary" onClick={handleDemoData}>
                        ✨ Load Demo Data
                    </button>
                </div>
                {importStatus && (
                    <div className={`import-status ${importStatus.type === 'error' ? 'text-danger' : ''}`}
                        style={importStatus.type === 'error' ? { color: 'var(--accent-danger)' } : {}}>
                        {importStatus.type === 'success' ? '✓' : '⚠'} {importStatus.message}
                    </div>
                )}
            </div>
            <ParseWarnings warnings={parseWarnings} onDismiss={() => setParseWarnings([])} />
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".klg,.txt,.klog"
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

function ParseWarnings({ warnings, onDismiss }) {
    if (!warnings || warnings.length === 0) return null;
    const shown = warnings.slice(0, 50);
    return (
        <div
            className="animate-fade-in"
            style={{
                marginTop: '10px',
                background: 'var(--bg-card)',
                border: '1px solid var(--accent-warning)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ color: 'var(--accent-warning)', fontWeight: 600, fontSize: '13px' }}>
                    ⚠ {warnings.length} line{warnings.length > 1 ? 's' : ''} could not be parsed
                </span>
                <button className="btn btn-secondary btn-sm" onClick={onDismiss}>Dismiss</button>
            </div>
            <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', maxHeight: '150px', overflowY: 'auto' }}>
                {shown.map((w, i) => (
                    <li key={i} style={{ fontSize: '12px', padding: '2px 0', fontFamily: 'monospace' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{w.file ? `${w.file}:` : ''}{w.line}</span>{' '}
                        <span style={{ color: 'var(--text-secondary)' }}>{w.message} —</span>{' '}
                        <span style={{ color: 'var(--text-primary)' }}>{w.text || '(empty line)'}</span>
                    </li>
                ))}
                {warnings.length > shown.length && (
                    <li style={{ fontSize: '12px', color: 'var(--text-muted)', paddingTop: '4px' }}>
                        …and {warnings.length - shown.length} more
                    </li>
                )}
            </ul>
        </div>
    );
}
