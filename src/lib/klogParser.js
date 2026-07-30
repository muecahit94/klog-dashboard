/**
 * Klog File Format Parser
 * Parses .klg files according to the klog specification:
 * https://github.com/jotaen/klog/blob/main/Specification.md
 */

/**
 * Parse a klog file content string into structured records.
 * @param {string} content - Raw klog file content
 * @param {string} [fileName] - Optional source file name
 * @returns {Array<Record>} Array of parsed records
 */
export function parseKlog(content, fileName = '') {
    if (!content || !content.trim()) return [];

    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const records = [];
    let currentBlock = [];

    for (const line of lines) {
        if (line.trim() === '') {
            if (currentBlock.length > 0) {
                const record = parseRecord(currentBlock, fileName);
                if (record) records.push(record);
                currentBlock = [];
            }
        } else {
            currentBlock.push(line);
        }
    }

    // Don't forget the last block
    if (currentBlock.length > 0) {
        const record = parseRecord(currentBlock, fileName);
        if (record) records.push(record);
    }

    return records;
}

/**
 * Parse multiple klog file contents.
 * @param {Array<{name: string, content: string}>} files
 * @returns {Array<Record>}
 */
export function parseMultipleKlogFiles(files) {
    const allRecords = [];
    for (const file of files) {
        const records = parseKlog(file.content, file.name);
        allRecords.push(...records);
    }
    // Sort by date
    allRecords.sort((a, b) => a.date.localeCompare(b.date));
    return allRecords;
}

// --- Internal Parsing Functions ---

const DATE_REGEX = /^(\d{4}[-/]\d{2}[-/]\d{2})/;
const SHOULD_TOTAL_REGEX = /\(([+-]?\d+h?\d*m?)!\)/;
const DURATION_REGEX = /^([+-]?\d+h)?(\d+m)?$/;
const TIME_REGEX = /^(<?)(\d{1,2}):(\d{2})(am|pm)?(>?)$/;
const TAG_REGEX = /#([a-zA-Z0-9_\-\u00C0-\u024F\u1E00-\u1EFF\u3000-\u9FFF]+)(?:=(?:"([^"]*?)"|'([^']*?)'|([a-zA-Z0-9_-]+)))?/g;

function isIndented(line) {
    return /^(\t|  )/.test(line);
}

function isDoubleIndented(line) {
    return /^(\t\t|    {2}|  {4})/.test(line);
}

function parseRecord(blockLines, fileName) {
    if (blockLines.length === 0) return null;

    const firstLine = blockLines[0];
    const dateMatch = firstLine.match(DATE_REGEX);
    if (!dateMatch) return null;

    const dateStr = dateMatch[1].replace(/\//g, '-');

    // Parse should-total from first line
    let shouldTotal = null;
    const shouldMatch = firstLine.match(SHOULD_TOTAL_REGEX);
    if (shouldMatch) {
        shouldTotal = parseDurationString(shouldMatch[1]);
    }

    // Collect record summary (non-indented lines after date line)
    const summaryLines = [];
    const entryLines = [];
    let i = 1;

    // Record summary lines: not indented
    while (i < blockLines.length && !isIndented(blockLines[i])) {
        summaryLines.push(blockLines[i]);
        i++;
    }

    // Remaining lines are entries (indented) or entry summaries (double-indented)
    while (i < blockLines.length) {
        if (isIndented(blockLines[i]) && !isDoubleIndented(blockLines[i])) {
            // Start of a new entry
            const entryGroup = [blockLines[i].trim()];
            i++;
            // Collect continuation lines (double-indented or same-level summaries)
            while (i < blockLines.length && isDoubleIndented(blockLines[i])) {
                entryGroup.push(blockLines[i].trim());
                i++;
            }
            entryLines.push(entryGroup);
        } else {
            i++;
        }
    }

    const recordSummary = summaryLines.join(' ').trim();
    const recordTags = extractTags(recordSummary);

    // Parse entries
    const entries = [];
    for (const entryGroup of entryLines) {
        const entry = parseEntry(entryGroup);
        if (entry) {
            // Merge record-level tags into entry
            entry.allTags = [...new Set([...recordTags, ...entry.tags])];
            entries.push(entry);
        }
    }

    // Compute total
    const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);

    return {
        date: dateStr,
        shouldTotal,
        summary: recordSummary,
        tags: recordTags,
        entries,
        totalMinutes,
        totalFormatted: formatMinutes(totalMinutes),
        fileName,
    };
}

function parseEntry(lines) {
    const firstLine = lines[0];
    const summaryParts = lines.length > 1 ? lines.slice(1) : [];

    // Try to parse as range: "8:00 - 17:00" or "8:00am - 5:00pm"
    const rangeResult = tryParseRange(firstLine);
    if (rangeResult) {
        const entrySummary = rangeResult.remainingSummary +
            (summaryParts.length ? ' ' + summaryParts.join(' ') : '');
        const tags = extractTags(entrySummary);
        return {
            type: 'range',
            start: rangeResult.start,
            end: rangeResult.end,
            minutes: rangeResult.minutes,
            summary: entrySummary.trim(),
            tags,
            allTags: tags,
            raw: lines.join('\n'),
        };
    }

    // Try to parse as open range: "8:00 - ?"
    const openRangeResult = tryParseOpenRange(firstLine);
    if (openRangeResult) {
        const entrySummary = openRangeResult.remainingSummary +
            (summaryParts.length ? ' ' + summaryParts.join(' ') : '');
        const tags = extractTags(entrySummary);
        return {
            type: 'open-range',
            start: openRangeResult.start,
            minutes: 0,
            summary: entrySummary.trim(),
            tags,
            allTags: tags,
            raw: lines.join('\n'),
        };
    }

    // Try to parse as duration: "2h30m", "-1h", "45m"
    const durationResult = tryParseDuration(firstLine);
    if (durationResult) {
        const entrySummary = durationResult.remainingSummary +
            (summaryParts.length ? ' ' + summaryParts.join(' ') : '');
        const tags = extractTags(entrySummary);
        return {
            type: 'duration',
            minutes: durationResult.minutes,
            summary: entrySummary.trim(),
            tags,
            allTags: tags,
            raw: lines.join('\n'),
        };
    }

    return null;
}

function tryParseRange(line) {
    // Match patterns like "8:00 - 17:00", "<23:00 - 3:00>", "8:00am - 5:00pm"
    const rangeRegex = /^(<?\d{1,2}:\d{2}(?:am|pm)?>?)\s*-\s*(<?\d{1,2}:\d{2}(?:am|pm)?>?)(.*)$/i;
    const match = line.match(rangeRegex);
    if (!match) return null;

    const startMin = parseTimeToMinutes(match[1]);
    const endMin = parseTimeToMinutes(match[2]);
    if (startMin === null || endMin === null) return null;

    let duration = endMin - startMin;
    if (duration < 0) duration += 24 * 60;

    return {
        start: match[1],
        end: match[2],
        minutes: duration,
        remainingSummary: match[3] || '',
    };
}

function tryParseOpenRange(line) {
    const openRegex = /^(<?\d{1,2}:\d{2}(?:am|pm)?>?)\s*-\s*\?+(.*)$/i;
    const match = line.match(openRegex);
    if (!match) return null;

    return {
        start: match[1],
        minutes: 0,
        remainingSummary: match[2] || '',
    };
}

function tryParseDuration(line) {
    // Match patterns like "2h30m", "-1h", "45m", "+2h"
    const durationRegex = /^([+-]?\d+h(?:\d+m)?|[+-]?\d+m)(.*)$/;
    const match = line.match(durationRegex);
    if (!match) return null;

    const minutes = parseDurationString(match[1]);
    if (minutes === null) return null;

    return {
        minutes,
        remainingSummary: match[2] || '',
    };
}

function parseDurationString(str) {
    if (!str) return null;

    const negative = str.startsWith('-');
    const cleaned = str.replace(/^[+-]/, '');

    const hMatch = cleaned.match(/(\d+)h/);
    const mMatch = cleaned.match(/(\d+)m/);

    const hours = hMatch ? parseInt(hMatch[1], 10) : 0;
    const mins = mMatch ? parseInt(mMatch[1], 10) : 0;

    const total = hours * 60 + mins;
    return negative ? -total : total;
}

function parseTimeToMinutes(timeStr) {
    const cleaned = timeStr.replace(/^<|>$/g, '');
    const match = cleaned.match(/^(\d{1,2}):(\d{2})(am|pm)?$/i);
    if (!match) return null;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3]?.toLowerCase();

    if (ampm === 'pm' && hours !== 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;

    // Handle shifted times
    const shiftedPrev = timeStr.startsWith('<');
    const shiftedNext = timeStr.endsWith('>');

    let totalMinutes = hours * 60 + minutes;
    if (shiftedPrev) totalMinutes -= 24 * 60;
    if (shiftedNext) totalMinutes += 24 * 60;

    return totalMinutes;
}

function extractTags(text) {
    if (!text) return [];
    const tags = [];
    let match;
    const regex = new RegExp(TAG_REGEX.source, TAG_REGEX.flags);
    while ((match = regex.exec(text)) !== null) {
        const name = match[1].toLowerCase();
        const value = match[2] || match[3] || match[4] || null;
        tags.push({ name, value, full: value ? `${name}=${value}` : name });
    }
    return tags;
}

export function formatMinutes(minutes) {
    const negative = minutes < 0;
    const abs = Math.abs(minutes);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    const sign = negative ? '-' : '';
    if (h === 0) return `${sign}${m}m`;
    if (m === 0) return `${sign}${h}h`;
    return `${sign}${h}h${m}m`;
}

export function minutesToDecimalHours(minutes) {
    return Math.round((minutes / 60) * 100) / 100;
}

// --- Aggregation Helpers ---

export function aggregateByDate(records) {
    const map = {};
    for (const r of records) {
        if (!map[r.date]) map[r.date] = 0;
        map[r.date] += r.totalMinutes;
    }
    return Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, minutes]) => ({ date, minutes, hours: minutesToDecimalHours(minutes) }));
}

export function aggregateByWeek(records) {
    const map = {};
    for (const r of records) {
        const d = new Date(r.date);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay() + 1); // Monday
        const key = weekStart.toISOString().slice(0, 10);
        if (!map[key]) map[key] = 0;
        map[key] += r.totalMinutes;
    }
    return Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([week, minutes]) => ({ week, minutes, hours: minutesToDecimalHours(minutes) }));
}

export function aggregateByMonth(records) {
    const map = {};
    for (const r of records) {
        const key = r.date.slice(0, 7); // YYYY-MM
        if (!map[key]) map[key] = 0;
        map[key] += r.totalMinutes;
    }
    return Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, minutes]) => ({ month, minutes, hours: minutesToDecimalHours(minutes) }));
}

/**
 * Aggregate the running (cumulative) time balance per day.
 * Daily balance = actual worked minutes - "should" minutes for that day.
 * The "should" value uses a record's own should-total when present,
 * otherwise falls back to the configured daily target.
 * @param {Array} records
 * @param {number} targetMinutes - Fallback daily target in minutes
 * @returns {Array<{date: string, actualMinutes: number, shouldMinutes: number, dailyMinutes: number, dailyHours: number, cumulativeMinutes: number, cumulativeHours: number}>}
 */
export function aggregateCumulativeBalance(records, targetMinutes = 480) {
    const byDate = {};
    for (const r of records) {
        if (!byDate[r.date]) byDate[r.date] = { actual: 0, should: 0, hasShould: false };
        byDate[r.date].actual += r.totalMinutes;
        if (r.shouldTotal !== null && r.shouldTotal !== undefined) {
            byDate[r.date].should += r.shouldTotal;
            byDate[r.date].hasShould = true;
        }
    }

    let cumulative = 0;
    return Object.keys(byDate)
        .sort((a, b) => a.localeCompare(b))
        .map(date => {
            const d = byDate[date];
            const should = d.hasShould ? d.should : targetMinutes;
            const daily = d.actual - should;
            cumulative += daily;
            return {
                date,
                actualMinutes: d.actual,
                shouldMinutes: should,
                dailyMinutes: daily,
                dailyHours: minutesToDecimalHours(daily),
                cumulativeMinutes: cumulative,
                cumulativeHours: minutesToDecimalHours(cumulative),
            };
        });
}

/**
 * Aggregate the running (cumulative) BILLABLE balance per day.
 * Daily balance = billable worked minutes - billable target minutes for that day.
 * The billable target per day = total worked minutes that day x billablePercent%,
 * i.e. the target is derived from the percentage of the time actually worked.
 * Billability is decided per entry from its full tag set (entry + record).
 * @param {Array} records
 * @param {Array<string>} billableTags
 * @param {number} billablePercent - Billable target percentage (0-100)
 * @returns {Array<{date: string, actualMinutes: number, shouldMinutes: number, dailyMinutes: number, dailyHours: number, cumulativeMinutes: number, cumulativeHours: number}>}
 */
export function aggregateCumulativeBillableBalance(records, billableTags = [], billablePercent = 0) {
    const billable = new Set(
        (billableTags || []).map(t => String(t).replace(/^#/, '').toLowerCase()).filter(Boolean)
    );
    const isBillable = (tags) => (tags || []).some(t => {
        const name = typeof t === 'string' ? t : t.name;
        return billable.has(String(name || '').toLowerCase());
    });

    const byDate = {};
    for (const r of records) {
        if (!byDate[r.date]) byDate[r.date] = { billable: 0, total: 0 };
        if (r.entries.length === 0) {
            byDate[r.date].total += r.totalMinutes;
            if (isBillable(r.tags)) byDate[r.date].billable += r.totalMinutes;
        } else {
            for (const e of r.entries) {
                byDate[r.date].total += e.minutes;
                const tags = (e.allTags && e.allTags.length)
                    ? e.allTags
                    : [...(e.tags || []), ...(r.tags || [])];
                if (isBillable(tags)) byDate[r.date].billable += e.minutes;
            }
        }
    }

    const ratio = Math.min(Math.max(Number(billablePercent) || 0, 0), 100) / 100;
    let cumulative = 0;
    return Object.keys(byDate)
        .sort((a, b) => a.localeCompare(b))
        .map(date => {
            const d = byDate[date];
            const billableTarget = d.total * ratio;
            const daily = d.billable - billableTarget;
            cumulative += daily;
            return {
                date,
                actualMinutes: d.billable,
                shouldMinutes: billableTarget,
                dailyMinutes: daily,
                dailyHours: minutesToDecimalHours(daily),
                cumulativeMinutes: cumulative,
                cumulativeHours: minutesToDecimalHours(cumulative),
            };
        });
}

/**
 * Split total tracked time into billable vs non-billable based on tag names.
 * An entry is billable when any of its tags (entry-level or inherited
 * record-level) matches a configured billable tag. Records without entries
 * are classified by their record-level tags.
 * Tag matching is by name, case-insensitive, and a leading '#' is ignored.
 * @param {Array} records
 * @param {Array<string>} billableTags
 * @returns {{billableMinutes:number, nonBillableMinutes:number, totalMinutes:number, billablePercent:number, billableHours:number, nonBillableHours:number}}
 */
export function aggregateBillable(records, billableTags = []) {
    const billable = new Set(
        (billableTags || []).map(t => String(t).replace(/^#/, '').toLowerCase()).filter(Boolean)
    );

    const isBillable = (tags) => (tags || []).some(t => {
        const name = typeof t === 'string' ? t : t.name;
        return billable.has(String(name || '').toLowerCase());
    });

    let billableMinutes = 0;
    let nonBillableMinutes = 0;

    for (const r of records) {
        if (r.entries.length === 0) {
            if (isBillable(r.tags)) billableMinutes += r.totalMinutes;
            else nonBillableMinutes += r.totalMinutes;
            continue;
        }
        for (const e of r.entries) {
            const tags = (e.allTags && e.allTags.length)
                ? e.allTags
                : [...(e.tags || []), ...(r.tags || [])];
            if (isBillable(tags)) billableMinutes += e.minutes;
            else nonBillableMinutes += e.minutes;
        }
    }

    const totalMinutes = billableMinutes + nonBillableMinutes;
    const billablePercent = totalMinutes > 0 ? (billableMinutes / totalMinutes) * 100 : 0;

    return {
        billableMinutes,
        nonBillableMinutes,
        totalMinutes,
        billablePercent,
        billableHours: minutesToDecimalHours(billableMinutes),
        nonBillableHours: minutesToDecimalHours(nonBillableMinutes),
    };
}

/**
 * Break down billable time by tag, showing each tag's share of the total
 * billable minutes. Only billable entries (those carrying a billable tag) are
 * counted. Each billable entry is attributed to its first-level tag (the first
 * hashtag on the entry, e.g. the client), so the split groups by first-level
 * tag only — second-level tags are ignored.
 * @param {Array} records
 * @param {Array<string>} billableTags
 * @returns {Array<{tag:string, minutes:number, hours:number, percent:number}>} sorted by minutes desc
 */
export function aggregateBillableByTag(records, billableTags = []) {
    const billable = new Set(
        (billableTags || []).map(t => String(t).replace(/^#/, '').toLowerCase()).filter(Boolean)
    );

    const isBillable = (tags) => (tags || []).some(t => {
        const name = typeof t === 'string' ? t : t.name;
        return billable.has(String(name || '').toLowerCase());
    });

    // Attribute to the entry's first-level tag (first hashtag). Second-level and
    // later tags are ignored on purpose.
    const attributionTag = (tags) => {
        const first = (tags || [])[0];
        if (!first) return '(untagged)';
        return typeof first === 'string' ? first : first.full;
    };

    const map = {};
    let billableMinutes = 0;

    // billTags: full tag set used to decide billability (entry + record)
    // primaryTags: tag set whose FIRST tag is the attribution (entry tags take
    // precedence over record tags, like getPrimaryTag)
    const add = (billTags, primaryTags, minutes) => {
        if (minutes <= 0 || !isBillable(billTags)) return;
        const tag = attributionTag(primaryTags);
        map[tag] = (map[tag] || 0) + minutes;
        billableMinutes += minutes;
    };

    for (const r of records) {
        if (r.entries.length === 0) {
            add(r.tags, r.tags, r.totalMinutes);
            continue;
        }
        for (const e of r.entries) {
            const billTags = (e.allTags && e.allTags.length)
                ? e.allTags
                : [...(e.tags || []), ...(r.tags || [])];
            const primaryTags = (e.tags && e.tags.length) ? e.tags : (r.tags || []);
            add(billTags, primaryTags, e.minutes);
        }
    }

    return Object.entries(map)
        .sort(([, a], [, b]) => b - a)
        .map(([tag, minutes]) => ({
            tag,
            minutes,
            hours: minutesToDecimalHours(minutes),
            percent: billableMinutes > 0 ? (minutes / billableMinutes) * 100 : 0,
        }));
}

/**
 * Aggregate billable vs non-billable minutes per time period (day/week/month).
 * Billability is decided per entry from its full tag set (entry + record).
 * @param {Array} records
 * @param {Array<string>} billableTags
 * @param {'daily'|'weekly'|'monthly'} period
 * @returns {Array<{key:string, billableMinutes:number, nonBillableMinutes:number, billableHours:number, nonBillableHours:number}>} sorted by key asc
 */
export function aggregateBillableByPeriod(records, billableTags = [], period = 'daily') {
    const billable = new Set(
        (billableTags || []).map(t => String(t).replace(/^#/, '').toLowerCase()).filter(Boolean)
    );

    const isBillable = (tags) => (tags || []).some(t => {
        const name = typeof t === 'string' ? t : t.name;
        return billable.has(String(name || '').toLowerCase());
    });

    const keyFn = (r) => {
        if (period === 'monthly') return r.date.slice(0, 7);
        if (period === 'weekly') {
            const d = new Date(r.date);
            const weekStart = new Date(d);
            weekStart.setDate(d.getDate() - d.getDay() + 1); // Monday
            return weekStart.toISOString().slice(0, 10);
        }
        return r.date;
    };

    const map = {};
    for (const r of records) {
        const key = keyFn(r);
        if (!map[key]) map[key] = { billable: 0, nonBillable: 0 };
        if (r.entries.length === 0) {
            if (isBillable(r.tags)) map[key].billable += r.totalMinutes;
            else map[key].nonBillable += r.totalMinutes;
            continue;
        }
        for (const e of r.entries) {
            const tags = (e.allTags && e.allTags.length)
                ? e.allTags
                : [...(e.tags || []), ...(r.tags || [])];
            if (isBillable(tags)) map[key].billable += e.minutes;
            else map[key].nonBillable += e.minutes;
        }
    }

    return Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => ({
            key,
            billableMinutes: v.billable,
            nonBillableMinutes: v.nonBillable,
            billableHours: minutesToDecimalHours(v.billable),
            nonBillableHours: minutesToDecimalHours(v.nonBillable),
        }));
}

export function aggregateByTag(records) {
    const map = {};
    for (const r of records) {
        if (r.entries.length === 0) {
            const tag = getPrimaryTag([], r.tags);
            if (!map[tag]) map[tag] = 0;
            map[tag] += r.totalMinutes;
            continue;
        }

        for (const entry of r.entries) {
            const tag = getPrimaryTag(entry.tags, r.tags);
            if (!map[tag]) map[tag] = 0;
            map[tag] += entry.minutes;
        }
    }
    return Object.entries(map)
        .sort(([, a], [, b]) => b - a)
        .map(([tag, minutes]) => ({ tag, minutes, hours: minutesToDecimalHours(minutes) }));
}

/**
 * Aggregate time by primary tag (first hashtag) with the remaining hashtags
 * grouped as children underneath it. Child minutes always sum to the parent's
 * minutes, so the breakdown shows how each primary tag splits across its
 * secondary tags. Entries with only a primary tag are grouped under '(direct)'.
 * @param {Array} records
 * @returns {Array<{tag: string, minutes: number, hours: number, children: Array<{tag: string, minutes: number, hours: number}>}>}
 */
export function aggregateByTagGrouped(records) {
    // primaryTag -> { minutes, children: { childTag -> minutes } }
    const map = {};

    const add = (tags, minutes) => {
        const names = tags.map(t => (typeof t === 'string' ? t : t.full));
        const primary = names[0] || '(untagged)';
        if (!map[primary]) map[primary] = { minutes: 0, children: {} };
        map[primary].minutes += minutes;

        const secondary = names.slice(1);
        if (secondary.length === 0) {
            map[primary].children['(direct)'] = (map[primary].children['(direct)'] || 0) + minutes;
        } else {
            const per = minutes / secondary.length;
            for (const child of secondary) {
                map[primary].children[child] = (map[primary].children[child] || 0) + per;
            }
        }
    };

    for (const r of records) {
        if (r.entries.length === 0) {
            add(r.tags, r.totalMinutes);
            continue;
        }
        for (const entry of r.entries) {
            const tags = entry.tags.length > 0 ? entry.tags : r.tags;
            add(tags, entry.minutes);
        }
    }

    return Object.entries(map)
        .map(([tag, data]) => ({
            tag,
            minutes: data.minutes,
            hours: minutesToDecimalHours(data.minutes),
            children: Object.entries(data.children)
                .sort(([, a], [, b]) => b - a)
                .map(([childTag, minutes]) => ({
                    tag: childTag,
                    minutes,
                    hours: minutesToDecimalHours(minutes),
                })),
        }))
        .sort((a, b) => b.minutes - a.minutes);
}

/**
 * Helper: aggregate records by a period key with per-tag breakdowns.
 * @param {Array} records
 * @param {Function} keyFn - (record) => periodKey string
 * @returns {Array<{key: string, tagBreakdown: Object<string, number>, subBreakdown: Object<string, Object<string, number>>}>}
 */
function aggregateByPeriodWithTags(records, keyFn) {
    // Map: periodKey -> { tagName -> totalMinutes }
    const map = {};
    // Map: periodKey -> primaryTag -> { subTag -> totalMinutes }
    const subMap = {};
    for (const r of records) {
        const key = keyFn(r);
        if (!map[key]) map[key] = {};
        if (!subMap[key]) subMap[key] = {};
        for (const entry of r.entries) {
            const tags = entry.tags.length > 0 ? entry.tags : r.tags;
            const tag = getPrimaryTag(entry.tags, r.tags);
            if (!map[key][tag]) map[key][tag] = 0;
            map[key][tag] += entry.minutes;

            // Track second/third/... hashtags grouped under the primary tag
            if (!subMap[key][tag]) subMap[key][tag] = {};
            const secondary = tags.slice(1).map(t => (typeof t === 'string' ? t : t.full));
            if (secondary.length > 0) {
                const per = entry.minutes / secondary.length;
                for (const child of secondary) {
                    subMap[key][tag][child] = (subMap[key][tag][child] || 0) + per;
                }
            }
        }
    }
    return Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, tagBreakdown]) => ({ key, tagBreakdown, subBreakdown: subMap[key] || {} }));
}

function getPrimaryTag(entryTags = [], recordTags = []) {
    const tags = entryTags.length > 0 ? entryTags : recordTags;
    const firstTag = tags[0];

    if (!firstTag) return '(untagged)';
    return typeof firstTag === 'string' ? firstTag : firstTag.full;
}

export function aggregateByDateWithTags(records) {
    return aggregateByPeriodWithTags(records, r => r.date);
}

export function aggregateByWeekWithTags(records) {
    return aggregateByPeriodWithTags(records, r => {
        const d = new Date(r.date);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay() + 1);
        return weekStart.toISOString().slice(0, 10);
    });
}

export function aggregateByMonthWithTags(records) {
    return aggregateByPeriodWithTags(records, r => r.date.slice(0, 7));
}

export function getAllTags(records) {
    const tagSet = new Set();
    for (const r of records) {
        r.tags.forEach(t => tagSet.add(t.full));
        r.entries.forEach(e => e.tags.forEach(t => tagSet.add(t.full)));
    }
    return [...tagSet].sort();
}

/**
 * Remove time tagged with any of the excluded tag names from all calculations.
 * - Entries carrying an excluded tag are dropped.
 * - A whole day is dropped when its record-level (date line) tags are excluded,
 *   or when no entries remain after filtering — so excluded days (e.g. vacation)
 *   do not count toward the balance's "should" total.
 * Tag matching is by name, case-insensitive, and a leading '#' is ignored.
 * @param {Array} records
 * @param {Array<string>} excludedTags
 * @returns {Array} filtered records with recomputed totals
 */
export function excludeTagsFromRecords(records, excludedTags = []) {
    if (!excludedTags || excludedTags.length === 0) return records;

    const excluded = new Set(
        excludedTags.map(t => String(t).replace(/^#/, '').toLowerCase()).filter(Boolean)
    );
    if (excluded.size === 0) return records;

    const hasExcluded = (tags) => (tags || []).some(t => {
        const name = typeof t === 'string' ? t : t.name;
        return excluded.has(String(name || '').toLowerCase());
    });

    const result = [];
    for (const r of records) {
        // Drop the entire day if the record-level tags are excluded
        if (hasExcluded(r.tags)) continue;

        const entries = r.entries.filter(e => !hasExcluded(e.allTags || e.tags));
        if (entries.length === 0) continue;

        const totalMinutes = entries.reduce((sum, e) => sum + e.minutes, 0);
        result.push({
            ...r,
            entries,
            totalMinutes,
            totalFormatted: formatMinutes(totalMinutes),
        });
    }
    return result;
}

export function filterRecords(records, filters) {
    const hasTagFilter = filters.tags && filters.tags.length > 0;
    const hasSearchFilter = filters.search && filters.search.trim();
    const searchLower = hasSearchFilter ? filters.search.toLowerCase() : '';

    return records
        .filter(r => {
            // Date range filter (record-level — applies to whole day)
            if (filters.dateFrom && r.date < filters.dateFrom) return false;
            if (filters.dateTo && r.date > filters.dateTo) return false;
            return true;
        })
        .map(r => {
            // If no tag/search filters, keep entire record
            if (!hasTagFilter && !hasSearchFilter) return r;

            // Filter individual entries
            const filteredEntries = r.entries.filter(e => {
                // Tag filter: entry must have at least one matching tag
                if (hasTagFilter) {
                    const entryTags = new Set();
                    (e.tags || []).forEach(t => entryTags.add(typeof t === 'string' ? t : t.full));
                    // Also include record-level tags
                    (r.tags || []).forEach(t => entryTags.add(typeof t === 'string' ? t : t.full));
                    const hasMatch = filters.tags.some(ft => entryTags.has(ft));
                    if (!hasMatch) return false;
                }

                // Search filter: entry text must contain search string
                if (hasSearchFilter) {
                    const entryText = [
                        r.date,
                        e.summary || '',
                        e.raw || '',
                        r.fileName || '',
                    ].join(' ').toLowerCase();
                    if (!entryText.includes(searchLower)) return false;
                }

                return true;
            });

            if (filteredEntries.length === 0) return null;

            // Recalculate total minutes for the filtered record
            const newTotalMinutes = filteredEntries.reduce((sum, e) => sum + e.minutes, 0);

            // Return a shallow copy of the record with matched entries and updated total
            return { ...r, entries: filteredEntries, totalMinutes: newTotalMinutes };
        })
        .filter(Boolean);
}

// --- Demo Data ---

export function getDemoData() {
    return `2024-01-15
Project Alpha kickoff meeting
    8:00 - 9:30 Sprint planning #project-alpha #meeting
    9:45 - 12:00 Backend API development #project-alpha #coding
    -30m Lunch break
    13:00 - 17:00 Frontend implementation #project-alpha #coding

2024-01-16
    8:30 - 10:00 Code review #project-alpha #review
    10:15 - 12:30 Database optimization #project-beta #coding
    13:30 - 15:00 Documentation #project-alpha #docs
    15:15 - 17:30 Bug fixing #project-beta #bugfix

2024-01-17
Working from home
    9:00 - 11:00 Feature development #project-alpha #coding #home-office
    11:15 - 12:00 Team standup #meeting
    13:00 - 16:30 API integration #project-beta #coding
    16:45 - 17:30 Testing #project-beta #testing

2024-01-18
    8:00 - 10:30 Architecture review #project-gamma #review #meeting
    10:45 - 12:00 Prototyping #project-gamma #coding
    13:00 - 14:30 Mentoring session #mentoring
    14:45 - 17:00 Sprint work #project-alpha #coding

2024-01-19
Short day
    9:00 - 12:00 Final testing #project-alpha #testing
    13:00 - 14:30 Release preparation #project-alpha #ops

2024-01-22
New sprint start
    8:00 - 9:00 Sprint retrospective #meeting
    9:15 - 12:00 New feature design #project-beta #design
    13:00 - 15:30 Implementation #project-beta #coding
    15:45 - 17:00 Code review #project-alpha #review

2024-01-23
    8:30 - 11:00 Microservice development #project-gamma #coding
    11:15 - 12:00 Standup + sync #meeting
    13:00 - 16:00 Integration testing #project-gamma #testing
    16:15 - 17:30 Documentation update #project-gamma #docs

2024-01-24
Conference day
    9:00 - 12:00 Tech conference #learning #conference
    13:00 - 15:00 Workshop: Kubernetes #learning #workshop
    15:30 - 17:00 Apply learnings #project-beta #coding

2024-01-25
    8:00 - 10:00 Performance optimization #project-alpha #coding
    10:15 - 12:00 Security audit #project-beta #security
    13:00 - 15:30 Deployment pipeline #ops #devops
    15:45 - 17:00 Team planning #meeting

2024-01-26
Half day
    9:00 - 12:00 Bug triage and fixes #project-alpha #bugfix
    12:30 - 13:30 Knowledge sharing session #meeting #mentoring

2024-01-29
    8:00 - 10:30 API v2 design #project-beta #design
    10:45 - 12:00 Stakeholder meeting #meeting
    13:00 - 16:00 Implementation #project-beta #coding
    16:15 - 17:30 PR reviews #review

2024-01-30
    8:30 - 11:00 Data migration scripts #project-gamma #coding #data
    11:15 - 12:00 Architecture discussion #meeting
    13:00 - 15:00 Testing data migration #project-gamma #testing
    15:15 - 17:00 Monitoring setup #project-gamma #ops

2024-01-31
Month end wrap-up
    8:00 - 9:30 Monthly review meeting #meeting
    9:45 - 12:00 Sprint deliverables #project-alpha #coding
    13:00 - 15:00 Documentation finalization #docs
    15:15 - 17:00 Tech debt reduction #project-beta #coding #tech-debt

2024-02-01
    8:00 - 10:00 New month planning #meeting #planning
    10:15 - 12:00 Feature flag system #project-alpha #coding
    13:00 - 15:30 CI/CD improvements #devops #ops
    15:45 - 17:00 Code review #review

2024-02-02
    9:00 - 11:30 Cloud infrastructure #ops #devops
    12:00 - 13:00 Team lunch #social
    13:30 - 16:00 Project gamma milestone #project-gamma #coding
    16:15 - 17:00 Retrospective notes #docs
`;
}
