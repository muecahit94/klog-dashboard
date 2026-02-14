import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DEFAULT_DATA_DIR = path.join(process.cwd(), 'data');

export async function GET(request, { params }) {
    const dataDir = process.env.KLOG_DATA_DIR || DEFAULT_DATA_DIR;
    const { name } = await params;
    const filePath = path.join(dataDir, name);

    // Prevent path traversal
    const resolved = path.resolve(filePath);
    const resolvedDir = path.resolve(dataDir);
    if (!resolved.startsWith(resolvedDir + path.sep) && resolved !== resolvedDir) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return new NextResponse(content, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    } catch {
        return new NextResponse('Not Found', { status: 404 });
    }
}

export const dynamic = 'force-dynamic';
