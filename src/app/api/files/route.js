import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DEFAULT_DATA_DIR = path.join(process.cwd(), 'public', 'data');

export async function GET() {
    const dataDir = process.env.KLOG_DATA_DIR || DEFAULT_DATA_DIR;

    try {
        if (!fs.existsSync(dataDir)) {
            return NextResponse.json({ files: [], error: `Directory not found: ${dataDir}` });
        }

        const entries = fs.readdirSync(dataDir);
        const files = entries
            .filter(f => /\.(klg|txt|klog)$/.test(f))
            .map(name => {
                const filePath = path.join(dataDir, name);
                const stats = fs.statSync(filePath);
                return {
                    name,
                    path: `/api/files/${encodeURIComponent(name)}`,
                    mtime: Math.floor(stats.mtimeMs / 1000),
                };
            });

        return NextResponse.json({ files, dataDir });
    } catch (err) {
        console.error('[api/files] Error:', err.message);
        return NextResponse.json({ files: [], error: err.message });
    }
}

export const dynamic = 'force-dynamic';
