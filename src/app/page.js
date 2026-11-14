'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import './globals.css';
import FileImport from '@/components/FileImport';
import FilterBar from '@/components/FilterBar';
import SummaryCards from '@/components/SummaryCards';
import Charts from '@/components/Charts';
import BillableSplit from '@/components/BillableSplit';
import LeaveBalance from '@/components/LeaveBalance';
import Heatmap from '@/components/Heatmap';
import EntriesTable from '@/components/EntriesTable';
import {
    filterRecords,
    getAllTags,
    excludeTagsFromRecords,
    getExcludedRecords,
    minutesToDecimalHours,
    formatMinutes,
    DEFAULT_WORKING_DAYS,
    parseWorkingDays,
    calculateEffectiveVacationAllowance,
    isValidIsoDate,
} from '@/lib/klogParser';

import pkg from '../../package.json';

const STORAGE_KEY = 'klog-dashboard-records';
const THEME_KEY = 'klog-dashboard-theme';
const EXCLUDE_KEY = 'klog-dashboard-excluded-tags';
const EXCLUDE_DEACTIVATED_KEY = 'klog-dashboard-excluded-tags-deactivated';
const SHOW_EXCLUDED_KEY = 'klog-dashboard-show-excluded';
const BILLABLE_KEY = 'klog-dashboard-billable-tags';
const BILLABLE_TARGET_KEY = 'klog-dashboard-billable-target';
const DAILY_TARGET_KEY = 'klog-dashboard-daily-target';
const WORKING_DAYS_KEY = 'klog-dashboard-working-days';
const VACATION_ALLOWANCE_KEY = 'klog-dashboard-vacation-allowance';
const VACATION_TAGS_KEY = 'klog-dashboard-vacation-tags';
const VACATION_START_DATE_KEY = 'klog-dashboard-vacation-start-date';
const SHOW_VACATION_KEY = 'klog-dashboard-show-vacation';
// Snapshots of the last env-provided value applied, so a changed docker/env
// variable overrides a stale localStorage value while user edits still persist.
const EXCLUDE_ENV_KEY = 'klog-dashboard-excluded-tags-env';
const BILLABLE_ENV_KEY = 'klog-dashboard-billable-tags-env';
const BILLABLE_TARGET_ENV_KEY = 'klog-dashboard-billable-target-env';
const DAILY_TARGET_ENV_KEY = 'klog-dashboard-daily-target-env';
const WORKING_DAYS_ENV_KEY = 'klog-dashboard-working-days-env';
const VACATION_ALLOWANCE_ENV_KEY = 'klog-dashboard-vacation-allowance-env';
const VACATION_TAGS_ENV_KEY = 'klog-dashboard-vacation-tags-env';
const VACATION_START_DATE_ENV_KEY = 'klog-dashboard-vacation-start-date-env';

const WEEKDAY_BUTTONS = [
    { day: 1, label: 'Mon' },
    { day: 2, label: 'Tue' },
    { day: 3, label: 'Wed' },
    { day: 4, label: 'Thu' },
    { day: 5, label: 'Fri' },
    { day: 6, label: 'Sat' },
    { day: 0, label: 'Sun' },
];

export default function Home() {
    const [records, setRecords] = useState([]);
    const [filters, setFilters] = useState({
        dateFrom: '',
        dateTo: '',
        tags: [],
        search: '',
    });
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [config, setConfig] = useState(null);
    const [theme, setTheme] = useState('dark');
    const [excludedTags, setExcludedTags] = useState([]);
    const [deactivatedExcludedTags, setDeactivatedExcludedTags] = useState([]);
    const [showExcluded, setShowExcluded] = useState(true);
    const [excludeLoaded, setExcludeLoaded] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [excludeInput, setExcludeInput] = useState('');
    const [billableTags, setBillableTags] = useState([]);
    const [billableLoaded, setBillableLoaded] = useState(false);
    const [billableInput, setBillableInput] = useState('');
    const [billableTarget, setBillableTarget] = useState(0);
    const [billableTargetLoaded, setBillableTargetLoaded] = useState(false);
    const [dailyTargetHours, setDailyTargetHours] = useState(8.0);
    const [dailyTargetInput, setDailyTargetInput] = useState('8');
    const [workingDays, setWorkingDays] = useState(DEFAULT_WORKING_DAYS);
    const [scheduleLoaded, setScheduleLoaded] = useState(false);
    const [vacationAllowance, setVacationAllowance] = useState(0);
    const [vacationTags, setVacationTags] = useState(['vacation']);
    const [vacationStartDate, setVacationStartDate] = useState('');
    const [showVacation, setShowVacation] = useState(false);
    const [vacationInput, setVacationInput] = useState('');
    const [vacationLoaded, setVacationLoaded] = useState(false);
    // Cross-dashboard drill-down: {kind:'dateRange',from,to,label} | {kind:'tag',value,label}
    const [highlight, setHighlight] = useState(null);

    // Load persisted theme and apply it to the document root
    useEffect(() => {
        let saved = null;
        try {
            saved = localStorage.getItem(THEME_KEY);
        } catch (e) {
            // ignore
        }
        const initial = saved === 'light' || saved === 'dark' ? saved : 'dark';
        setTheme(initial);
        document.documentElement.setAttribute('data-theme', initial);
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme((prev) => {
            const next = prev === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            try {
                localStorage.setItem(THEME_KEY, next);
            } catch (e) {
                // ignore
            }
            return next;
        });
    }, []);

    // Load persisted excluded tags, deactivated tags, and showExcluded on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem(EXCLUDE_KEY);
            if (raw !== null) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) setExcludedTags(parsed);
            }
        } catch (e) {
            // ignore
        }
        try {
            const rawDeact = localStorage.getItem(EXCLUDE_DEACTIVATED_KEY);
            if (rawDeact !== null) {
                const parsed = JSON.parse(rawDeact);
                if (Array.isArray(parsed)) setDeactivatedExcludedTags(parsed);
            }
        } catch (e) {
            // ignore
        }
        try {
            const rawShow = localStorage.getItem(SHOW_EXCLUDED_KEY);
            if (rawShow !== null) {
                setShowExcluded(rawShow === 'true');
            }
        } catch (e) {
            // ignore
        }
        setExcludeLoaded(true);
    }, []);

    // Load persisted billable tags on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem(BILLABLE_KEY);
            if (raw !== null) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) setBillableTags(parsed);
            }
        } catch (e) {
            // ignore
        }
        setBillableLoaded(true);
    }, []);

    // Apply the env default (KLOG_EXCLUDED_TAGS) whenever it changes, overriding
    // any stale localStorage value. A snapshot of the last applied env value is
    // kept so the user's own edits persist between env changes.
    useEffect(() => {
        if (!excludeLoaded || !config) return;
        const envTags = Array.isArray(config.excludedTags) ? config.excludedTags : [];
        const envSnap = JSON.stringify(envTags);
        let storedSnap = null;
        try {
            storedSnap = localStorage.getItem(EXCLUDE_ENV_KEY);
        } catch (e) {
            // ignore
        }
        if (storedSnap !== envSnap) {
            setExcludedTags(envTags);
            try {
                localStorage.setItem(EXCLUDE_KEY, envSnap);
                localStorage.setItem(EXCLUDE_ENV_KEY, envSnap);
            } catch (e) {
                // ignore
            }
        }
    }, [config, excludeLoaded]);

    const persistExcluded = useCallback((next) => {
        try {
            localStorage.setItem(EXCLUDE_KEY, JSON.stringify(next));
        } catch (e) {
            // ignore
        }
    }, []);

    const activeExcludedTags = useMemo(() => {
        const deactSet = new Set(deactivatedExcludedTags.map(t => String(t).toLowerCase()));
        return excludedTags.filter(t => !deactSet.has(t.toLowerCase()));
    }, [excludedTags, deactivatedExcludedTags]);

    const toggleExcludedTagActive = useCallback((raw) => {
        const name = String(raw || '').trim().replace(/^#/, '').toLowerCase();
        if (!name) return;
        setDeactivatedExcludedTags(prev => {
            const isDeact = prev.includes(name);
            const next = isDeact ? prev.filter(t => t !== name) : [...prev, name];
            try {
                localStorage.setItem(EXCLUDE_DEACTIVATED_KEY, JSON.stringify(next));
            } catch (e) {
                // ignore
            }
            return next;
        });
    }, []);

    const toggleShowExcluded = useCallback(() => {
        setShowExcluded(prev => {
            const next = !prev;
            try {
                localStorage.setItem(SHOW_EXCLUDED_KEY, String(next));
            } catch (e) {
                // ignore
            }
            return next;
        });
    }, []);

    const addExcludedTag = useCallback((raw) => {
        const name = String(raw || '').trim().replace(/^#/, '').toLowerCase();
        if (!name) return;
        setExcludedTags(prev => {
            if (prev.includes(name)) return prev;
            const next = [...prev, name];
            persistExcluded(next);
            return next;
        });
        setDeactivatedExcludedTags(prev => {
            if (!prev.includes(name)) return prev;
            const next = prev.filter(t => t !== name);
            try {
                localStorage.setItem(EXCLUDE_DEACTIVATED_KEY, JSON.stringify(next));
            } catch (e) {
                // ignore
            }
            return next;
        });
        setExcludeInput('');
    }, [persistExcluded]);

    const removeExcludedTag = useCallback((name) => {
        setExcludedTags(prev => {
            const next = prev.filter(t => t !== name);
            persistExcluded(next);
            return next;
        });
        setDeactivatedExcludedTags(prev => {
            if (!prev.includes(name)) return prev;
            const next = prev.filter(t => t !== name);
            try {
                localStorage.setItem(EXCLUDE_DEACTIVATED_KEY, JSON.stringify(next));
            } catch (e) {
                // ignore
            }
            return next;
        });
    }, [persistExcluded]);

    // Apply the env default (KLOG_BILLABLE_TAGS) whenever it changes, overriding
    // any stale localStorage value; user edits persist between env changes.
    useEffect(() => {
        if (!billableLoaded || !config) return;
        const envTags = Array.isArray(config.billableTags) ? config.billableTags : [];
        const envSnap = JSON.stringify(envTags);
        let storedSnap = null;
        try {
            storedSnap = localStorage.getItem(BILLABLE_ENV_KEY);
        } catch (e) {
            // ignore
        }
        if (storedSnap !== envSnap) {
            setBillableTags(envTags);
            try {
                localStorage.setItem(BILLABLE_KEY, envSnap);
                localStorage.setItem(BILLABLE_ENV_KEY, envSnap);
            } catch (e) {
                // ignore
            }
        }
    }, [config, billableLoaded]);

    const persistBillable = useCallback((next) => {
        try {
            localStorage.setItem(BILLABLE_KEY, JSON.stringify(next));
        } catch (e) {
            // ignore
        }
    }, []);

    const addBillableTag = useCallback((raw) => {
        const name = String(raw || '').trim().replace(/^#/, '').toLowerCase();
        if (!name) return;
        setBillableTags(prev => {
            if (prev.includes(name)) return prev;
            const next = [...prev, name];
            persistBillable(next);
            return next;
        });
        setBillableInput('');
    }, [persistBillable]);

    const removeBillableTag = useCallback((name) => {
        setBillableTags(prev => {
            const next = prev.filter(t => t !== name);
            persistBillable(next);
            return next;
        });
    }, [persistBillable]);

    // Load persisted billable target on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem(BILLABLE_TARGET_KEY);
            if (raw !== null) {
                const parsed = parseFloat(raw);
                if (!isNaN(parsed)) setBillableTarget(Math.min(Math.max(parsed, 0), 100));
            }
        } catch (e) {
            // ignore
        }
        setBillableTargetLoaded(true);
    }, []);

    // Seed billable target from env-provided config default only if the user never set their own
    useEffect(() => {
        if (!billableTargetLoaded || !config) return;
        const envVal = Math.min(Math.max(Number(config.billableTargetPercent) || 0, 0), 100);
        const envSnap = String(envVal);
        let storedSnap = null;
        try {
            storedSnap = localStorage.getItem(BILLABLE_TARGET_ENV_KEY);
        } catch (e) {
            // ignore
        }
        if (storedSnap !== envSnap) {
            setBillableTarget(envVal);
            try {
                localStorage.setItem(BILLABLE_TARGET_KEY, envSnap);
                localStorage.setItem(BILLABLE_TARGET_ENV_KEY, envSnap);
            } catch (e) {
                // ignore
            }
        }
    }, [config, billableTargetLoaded]);

    const updateBillableTarget = useCallback((raw) => {
        const num = parseFloat(raw);
        const val = isNaN(num) ? 0 : Math.min(Math.max(num, 0), 100);
        setBillableTarget(val);
        try {
            localStorage.setItem(BILLABLE_TARGET_KEY, String(val));
        } catch (e) {
            // ignore
        }
    }, []);

    // Load persisted daily target and working days on mount
    useEffect(() => {
        try {
            const rawTarget = localStorage.getItem(DAILY_TARGET_KEY);
            if (rawTarget !== null) {
                const parsed = parseFloat(rawTarget);
                if (!isNaN(parsed) && parsed >= 0) {
                    const clamped = Math.min(parsed, 24);
                    setDailyTargetHours(clamped);
                    setDailyTargetInput(String(clamped));
                }
            }
        } catch (e) {
            // ignore
        }
        try {
            const rawDays = localStorage.getItem(WORKING_DAYS_KEY);
            if (rawDays !== null) {
                const parsed = parseWorkingDays(JSON.parse(rawDays));
                if (parsed !== null) setWorkingDays(parsed);
            }
        } catch (e) {
            // ignore
        }
        setScheduleLoaded(true);
    }, []);

    // Seed daily target & working days from env defaults when env config changes
    useEffect(() => {
        if (!scheduleLoaded || !config) return;

        const envTargetRaw = Number(config.dailyTargetHours);
        const envTarget = Number.isFinite(envTargetRaw) ? Math.min(Math.max(envTargetRaw, 0), 24) : 8.0;
        const targetSnap = String(envTarget);
        try {
            if (localStorage.getItem(DAILY_TARGET_ENV_KEY) !== targetSnap) {
                setDailyTargetHours(envTarget);
                setDailyTargetInput(targetSnap);
                localStorage.setItem(DAILY_TARGET_KEY, targetSnap);
                localStorage.setItem(DAILY_TARGET_ENV_KEY, targetSnap);
            }
        } catch (e) {
            // ignore
        }

        const envDays = parseWorkingDays(config.workingDays) ?? DEFAULT_WORKING_DAYS;
        const daysSnap = JSON.stringify(envDays);
        try {
            if (localStorage.getItem(WORKING_DAYS_ENV_KEY) !== daysSnap) {
                setWorkingDays(envDays);
                localStorage.setItem(WORKING_DAYS_KEY, daysSnap);
                localStorage.setItem(WORKING_DAYS_ENV_KEY, daysSnap);
            }
        } catch (e) {
            // ignore
        }
    }, [config, scheduleLoaded]);

    const handleDailyTargetChange = useCallback((raw) => {
        setDailyTargetInput(raw);
        if (raw.trim() === '') return;
        const num = parseFloat(raw);
        if (isNaN(num) || num < 0) return;
        const clamped = Math.min(num, 24);
        setDailyTargetHours(clamped);
        try {
            localStorage.setItem(DAILY_TARGET_KEY, String(clamped));
        } catch (e) {
            // ignore
        }
    }, []);

    const handleDailyTargetBlur = useCallback(() => {
        setDailyTargetInput(String(dailyTargetHours));
    }, [dailyTargetHours]);

    const toggleWorkingDay = useCallback((day) => {
        setWorkingDays(prev => {
            const exists = prev.includes(day);
            const next = exists
                ? prev.filter(d => d !== day)
                : [...prev, day].sort((a, b) => a - b);
            try {
                localStorage.setItem(WORKING_DAYS_KEY, JSON.stringify(next));
            } catch (e) {
                // ignore
            }
            return next;
        });
    }, []);

    // Load persisted vacation allowance & vacation tags on mount
    useEffect(() => {
        try {
            const rawAllowance = localStorage.getItem(VACATION_ALLOWANCE_KEY);
            if (rawAllowance !== null) {
                const parsed = parseFloat(rawAllowance);
                if (!isNaN(parsed) && parsed >= 0) {
                    setVacationAllowance(Math.min(parsed, 366));
                }
            }
        } catch (e) {
            // ignore
        }
        try {
            const rawVacTags = localStorage.getItem(VACATION_TAGS_KEY);
            if (rawVacTags !== null) {
                const parsed = JSON.parse(rawVacTags);
                if (Array.isArray(parsed)) setVacationTags(parsed);
            }
        } catch (e) {
            // ignore
        }
        try {
            const rawStartDate = localStorage.getItem(VACATION_START_DATE_KEY);
            if (rawStartDate && isValidIsoDate(rawStartDate)) {
                setVacationStartDate(rawStartDate);
            }
        } catch (e) {
            // ignore
        }
        try {
            const savedShowVac = localStorage.getItem(SHOW_VACATION_KEY);
            setShowVacation(savedShowVac === 'true');
        } catch (e) {
            // ignore
        }
        setVacationLoaded(true);
    }, []);

    // Seed vacation allowance, tags & start date from env defaults when env config changes
    useEffect(() => {
        if (!vacationLoaded || !config) return;

        const envAllowanceRaw = Number(config.vacationAllowanceDays);
        const envAllowance = Number.isFinite(envAllowanceRaw)
            ? Math.min(Math.max(envAllowanceRaw, 0), 366)
            : 0;
        const allowanceSnap = String(envAllowance);
        try {
            if (localStorage.getItem(VACATION_ALLOWANCE_ENV_KEY) !== allowanceSnap) {
                setVacationAllowance(envAllowance);
                localStorage.setItem(VACATION_ALLOWANCE_KEY, allowanceSnap);
                localStorage.setItem(VACATION_ALLOWANCE_ENV_KEY, allowanceSnap);
            }
        } catch (e) {
            // ignore
        }

        const envTags = Array.isArray(config.vacationTags) && config.vacationTags.length > 0
            ? config.vacationTags
            : ['vacation'];
        const tagsSnap = JSON.stringify(envTags);
        try {
            if (localStorage.getItem(VACATION_TAGS_ENV_KEY) !== tagsSnap) {
                setVacationTags(envTags);
                localStorage.setItem(VACATION_TAGS_KEY, tagsSnap);
                localStorage.setItem(VACATION_TAGS_ENV_KEY, tagsSnap);
            }
        } catch (e) {
            // ignore
        }

        const envStart = isValidIsoDate(config.vacationStartDate) ? config.vacationStartDate : '';
        try {
            if (localStorage.getItem(VACATION_START_DATE_ENV_KEY) !== envStart) {
                setVacationStartDate(envStart);
                localStorage.setItem(VACATION_START_DATE_KEY, envStart);
                localStorage.setItem(VACATION_START_DATE_ENV_KEY, envStart);
            }
        } catch (e) {
            // ignore
        }
    }, [config, vacationLoaded]);

    const toggleShowVacation = useCallback(() => {
        setShowVacation(prev => {
            const next = !prev;
            try {
                localStorage.setItem(SHOW_VACATION_KEY, String(next));
            } catch (e) {
                // ignore
            }
            return next;
        });
    }, []);

    const updateVacationStartDate = useCallback((raw) => {
        const val = isValidIsoDate(raw) ? raw : '';
        setVacationStartDate(val);
        try {
            localStorage.setItem(VACATION_START_DATE_KEY, val);
        } catch (e) {
            // ignore
        }
    }, []);

    const updateVacationAllowance = useCallback((raw) => {
        const num = parseFloat(raw);
        const val = isNaN(num) ? 0 : Math.min(Math.max(num, 0), 366);
        setVacationAllowance(val);
        try {
            localStorage.setItem(VACATION_ALLOWANCE_KEY, String(val));
        } catch (e) {
            // ignore
        }
    }, []);

    const persistVacationTags = useCallback((next) => {
        try {
            localStorage.setItem(VACATION_TAGS_KEY, JSON.stringify(next));
        } catch (e) {
            // ignore
        }
    }, []);

    const addVacationTag = useCallback((raw) => {
        const name = String(raw || '').trim().replace(/^#/, '').toLowerCase();
        if (!name) return;
        setVacationTags(prev => {
            if (prev.includes(name)) return prev;
            const next = [...prev, name];
            persistVacationTags(next);
            return next;
        });
        setVacationInput('');
    }, [persistVacationTags]);

    const removeVacationTag = useCallback((name) => {
        setVacationTags(prev => {
            const next = prev.filter(t => t !== name);
            persistVacationTags(next);
            return next;
        });
    }, [persistVacationTags]);

    // Fetch config on mount
    useEffect(() => {
        fetch('/api/config')
            .then(res => res.json())
            .then(data => setConfig(data))
            .catch(err => console.error('Failed to load config:', err));
    }, []);

    // Load from localStorage on mount + set default date filter to current month
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setRecords(parsed);
                }
            }
        } catch (e) {
            // ignore
        }

        // Default to current month
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        setFilters((prev) => ({ ...prev, dateFrom: fmt(monthStart), dateTo: fmt(monthEnd) }));
    }, []);

    // Persist to localStorage
    useEffect(() => {
        if (records.length > 0) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
            } catch (e) {
                // ignore quota errors
            }
        }
    }, [records]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
                e.preventDefault();
                document.querySelector('input[type="file"]')?.click();
            }
            if (e.key === 'Escape') {
                setFilters({ dateFrom: '', dateTo: '', tags: [], search: '' });
                setHighlight(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleImport = useCallback((newRecords, opts = {}) => {
        setRecords((prev) => {
            let next = [...prev];

            // If specific files are being updated, remove their old records first
            if (opts.replaceFiles && opts.replaceFiles.length > 0) {
                const filesToRemove = new Set(opts.replaceFiles);
                next = next.filter(r => !filesToRemove.has(r.fileName));
            }

            // Merge and deduplicate by date + summary + filename
            const existingKeys = new Set(next.map(r => `${r.date}|${r.summary}|${r.fileName}`));
            const unique = newRecords.filter(r => !existingKeys.has(`${r.date}|${r.summary}|${r.fileName}`));
            const merged = [...next, ...unique].sort((a, b) => a.date.localeCompare(b.date));
            return merged;
        });
    }, []);

    const handleClear = useCallback(() => {
        setRecords([]);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    // Excluded tags that are active are removed from regular balance calculations
    const activeRecords = useMemo(
        () => excludeTagsFromRecords(records, activeExcludedTags),
        [records, activeExcludedTags],
    );
    const excludedRecords = useMemo(
        () => getExcludedRecords(records, activeExcludedTags),
        [records, activeExcludedTags],
    );
    const allTags = useMemo(() => getAllTags(records), [records]);
    const filteredRecords = useMemo(() => filterRecords(activeRecords, filters), [activeRecords, filters]);
    const filteredExcludedRecords = useMemo(() => filterRecords(excludedRecords, filters), [excludedRecords, filters]);

    const tableRecords = useMemo(() => {
        if (!showExcluded || filteredExcludedRecords.length === 0) return filteredRecords;
        const map = new Map();
        for (const r of filteredRecords) {
            map.set(`${r.date}|${r.summary}|${r.fileName}`, { ...r, entries: [...r.entries] });
        }
        for (const r of filteredExcludedRecords) {
            const key = `${r.date}|${r.summary}|${r.fileName}`;
            if (map.has(key)) {
                const existing = map.get(key);
                existing.entries = [...existing.entries, ...r.entries];
                existing.totalMinutes += r.totalMinutes;
            } else {
                map.set(key, { ...r, entries: [...r.entries] });
            }
        }
        return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    }, [filteredRecords, filteredExcludedRecords, showExcluded]);

    const handleTagClick = useCallback((tag) => {
        const tagName = typeof tag === 'object' ? tag.full : tag;
        setFilters(prev => {
            const current = prev.tags || [];
            if (current.includes(tagName)) return prev;
            return { ...prev, tags: [...current, tagName] };
        });
    }, []);

    // Clicking a chart bar, heatmap cell or billable segment highlights the
    // matching rows in the entries table instead of narrowing the whole dashboard.
    const handleHighlight = useCallback((next) => {
        setHighlight(next);
        if (typeof document !== 'undefined') {
            requestAnimationFrame(() => {
                document.getElementById('all-entries')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
    }, []);

    const clearHighlight = useCallback(() => setHighlight(null), []);

    const applyHighlightAsFilter = useCallback(() => {
        if (!highlight) return;
        if (highlight.kind === 'dateRange') {
            setFilters(prev => ({ ...prev, dateFrom: highlight.from, dateTo: highlight.to }));
        } else if (highlight.kind === 'tag') {
            setFilters(prev => {
                const current = prev.tags || [];
                if (current.includes(highlight.value)) return prev;
                return { ...prev, tags: [...current, highlight.value] };
            });
        }
        setHighlight(null);
    }, [highlight]);

    const handleExportCSV = useCallback(() => {
        const headers = ['Date', 'Type', 'Duration (min)', 'Duration', 'Hours', 'Summary', 'Tags', 'Excluded', 'File'];
        const rows = [];
        for (const r of tableRecords) {
            for (const e of r.entries) {
                const tags = (e.allTags || e.tags).map(t => '#' + (typeof t === 'string' ? t : t.full)).join(', ');
                rows.push([
                    r.date,
                    e.type,
                    e.minutes,
                    formatMinutes(e.minutes),
                    minutesToDecimalHours(e.minutes).toFixed(2),
                    `"${(e.summary || '').replace(/"/g, '""')}"`,
                    `"${tags}"`,
                    e.isExcluded || r.isExcluded ? 'Yes' : 'No',
                    `"${r.fileName || ''}"`,
                ].join(','));
            }
        }
        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `klog-export-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setShowExportMenu(false);
    }, [tableRecords]);

    const handleExportJSON = useCallback(() => {
        const json = JSON.stringify(tableRecords, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `klog-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setShowExportMenu(false);
    }, [tableRecords]);

    const hasData = records.length > 0;

    return (
        <main className="app-container">
            {/* Header */}
            <header className="app-header">
                <div className="app-logo">
                    <div className="app-logo-icon">⏰</div>
                    <div>
                        <h1>klog Dashboard</h1>
                        <span>Visual Time Tracking Analytics</span>
                    </div>
                </div>
                <div className="header-actions">
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setShowSettings(true)}
                        title="Settings"
                        aria-label="Open settings"
                    >
                        ⚙️ Settings{excludedTags.length ? ` (${activeExcludedTags.length}/${excludedTags.length})` : ''}
                    </button>
                    {hasData && (
                        <>
                            <div className="export-dropdown">
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setShowExportMenu(!showExportMenu)}
                                >
                                    📥 Export
                                </button>
                                {showExportMenu && (
                                    <div className="export-menu">
                                        <button className="export-option" onClick={handleExportCSV}>
                                            📊 Export as CSV
                                        </button>
                                        <button className="export-option" onClick={handleExportJSON}>
                                            📋 Export as JSON
                                        </button>
                                    </div>
                                )}
                            </div>
                            <button className="btn btn-danger btn-sm" onClick={handleClear}>
                                🗑️ Clear Data
                            </button>
                        </>
                    )}
                    <span className="kbd" title="Import files">⌘O</span>
                    <span className="kbd" title="Clear filters">Esc</span>
                </div>
            </header>

            {/* File Import */}
            <FileImport onImport={handleImport} hasData={hasData} />

            {/* Dashboard Content */}
            {hasData ? (
                <div style={{ marginTop: '24px' }}>
                    {/* Filters */}
                    <FilterBar
                        filters={filters}
                        onFilterChange={setFilters}
                        allTags={allTags}
                    />

                    {/* Summary Stats */}
                    <SummaryCards
                        records={filteredRecords}
                        excludedRecords={filteredExcludedRecords}
                        showExcluded={showExcluded}
                        config={config}
                        dailyTargetHours={dailyTargetHours}
                        workingDays={workingDays}
                        billableTags={billableTags}
                    />

                    {/* Billable vs Non-billable split */}
                    <BillableSplit records={filteredRecords} billableTags={billableTags} billableTarget={billableTarget} onHighlight={handleHighlight} />

                    {/* Charts */}
                    <Charts
                        records={filteredRecords}
                        excludedRecords={filteredExcludedRecords}
                        config={config}
                        dailyTargetHours={dailyTargetHours}
                        workingDays={workingDays}
                        billableTags={billableTags}
                        billableTarget={billableTarget}
                        excludedTags={activeExcludedTags}
                        showExcluded={showExcluded}
                        onHighlight={handleHighlight}
                    />

                    {/* Heatmap */}
                    <Heatmap records={filteredRecords} billableTags={billableTags} onHighlight={handleHighlight} />

                    {/* Vacation & Leave Allowance */}
                    <LeaveBalance
                        records={records}
                        visible={showVacation}
                        vacationAllowance={vacationAllowance}
                        vacationTags={vacationTags}
                        startDate={vacationStartDate}
                        excludedTags={activeExcludedTags}
                        dailyTargetHours={dailyTargetHours}
                        preferredYear={(filters.dateFrom || filters.dateTo || '').slice(0, 4)}
                        onHighlight={handleHighlight}
                    />

                    {/* Entries Table */}
                    <EntriesTable
                        records={tableRecords}
                        onTagClick={handleTagClick}
                        highlight={highlight}
                        onClearHighlight={clearHighlight}
                        onApplyHighlightFilter={applyHighlightAsFilter}
                        excludedTags={activeExcludedTags}
                    />
                </div>
            ) : (
                <div className="empty-state">
                    <span className="empty-state-icon">📊</span>
                    <h2>Welcome to klog Dashboard</h2>
                    <p>
                        Import your klog time tracking files to visualize your bookings
                        with interactive charts, filters, and detailed breakdowns.
                    </p>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <span className="kbd">⌘O to import</span>
                        <span className="kbd">.klg files</span>
                        <span className="kbd">drag & drop</span>
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer style={{
                textAlign: 'center',
                padding: '32px 0 16px',
                color: 'var(--text-muted)',
                fontSize: '12px',
                borderTop: '1px solid var(--border-color)',
                marginTop: '48px',
            }}>
                klog Dashboard • v{pkg.version} • Built for{' '}
                <a href="https://github.com/jotaen/klog" target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
                    klog
                </a>
                {' '}time tracking format • <a href="https://github.com/muecahit94/klog-dashboard" target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>
                    GitHub
                </a>
            </footer>

            {/* Settings Modal */}
            {showSettings && (
                <div
                    onClick={() => setShowSettings(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1000,
                        background: 'rgba(0, 0, 0, 0.55)',
                        backdropFilter: 'blur(2px)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        padding: '80px 16px 16px',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: '460px',
                            maxHeight: 'calc(100vh - 96px)',
                            overflowY: 'auto',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow-lg)',
                            padding: '20px',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                            <h2 style={{ fontSize: '18px', color: 'var(--text-primary)' }}>⚙️ Settings</h2>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setShowSettings(false)}
                                aria-label="Close settings"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Appearance */}
                        <section style={{ marginBottom: '22px' }}>
                            <h3 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Appearance
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Theme</span>
                                <button className="btn btn-secondary btn-sm" onClick={toggleTheme}>
                                    {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
                                </button>
                            </div>
                        </section>

                        {/* Work schedule & daily target */}
                        <section style={{ marginBottom: '22px' }}>
                            <h3 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Work Schedule & Target
                            </h3>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.5 }}>
                                Fallback daily target when a day doesn&apos;t specify <code>(Xh!)</code>.
                                Entries on non-working days have a 0h target. Saved automatically.
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
                                <input
                                    className="filter-input"
                                    type="number"
                                    min="0"
                                    max="24"
                                    step="0.1"
                                    aria-label="Daily target hours"
                                    value={dailyTargetInput}
                                    onChange={(e) => handleDailyTargetChange(e.target.value)}
                                    onBlur={handleDailyTargetBlur}
                                    style={{ width: '96px' }}
                                />
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>h / day</span>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                                    {(dailyTargetHours * workingDays.length).toFixed(1)}h / week
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {WEEKDAY_BUTTONS.map(({ day, label }) => {
                                    const active = workingDays.includes(day);
                                    return (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => toggleWorkingDay(day)}
                                            aria-pressed={active}
                                            className={`btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
                                            style={{
                                                flex: '1 1 0',
                                                minWidth: '48px',
                                                justifyContent: 'center',
                                                padding: '6px 4px',
                                                opacity: active ? 1 : 0.65,
                                            }}
                                            title={active ? `${label}: working day (click to mark off)` : `${label}: non-working day (0h target)`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Excluded tags */}
                        <section>
                            <h3 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Excluded Tags
                            </h3>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.5 }}>
                                Removed from regular balance calculations (e.g. vacation, sickleave, holiday).
                                Click any tag to activate or deactivate it.
                            </div>
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                                <input
                                    className="filter-input"
                                    placeholder="e.g. vacation, sickleave, holiday"
                                    value={excludeInput}
                                    onChange={(e) => setExcludeInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addExcludedTag(excludeInput);
                                        }
                                    }}
                                    style={{ flex: 1, minWidth: 0 }}
                                />
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => addExcludedTag(excludeInput)}
                                >
                                    Add
                                </button>
                            </div>
                            <div className="filter-chips" style={{ marginBottom: excludedTags.length > 0 ? '12px' : 0 }}>
                                {excludedTags.length === 0 ? (
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        No excluded tags
                                    </span>
                                ) : (
                                    excludedTags.map(tag => {
                                        const isActive = activeExcludedTags.includes(tag);
                                        return (
                                            <span
                                                key={tag}
                                                className={`filter-chip ${isActive ? 'filter-chip-excluded' : 'filter-chip-deactivated'}`}
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => toggleExcludedTagActive(tag)}
                                                title={isActive ? `Click to deactivate #${tag}` : `Click to activate #${tag}`}
                                            >
                                                <span>{isActive ? '✓' : '⊘'}</span>
                                                #{tag}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeExcludedTag(tag);
                                                    }}
                                                    title={`Remove #${tag}`}
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        );
                                    })
                                )}
                            </div>

                            {excludedTags.length > 0 && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 12px',
                                    background: 'var(--bg-glass)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-sm)',
                                }}>
                                    <div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>
                                            Show in Charts
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                            Display active excluded tags in amber in charts
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className={`btn btn-sm ${showExcluded ? 'btn-warning' : 'btn-secondary'}`}
                                        onClick={toggleShowExcluded}
                                        style={{ fontSize: '11px', padding: '4px 10px' }}
                                    >
                                        {showExcluded ? '👁️ Shown' : '👁️‍🗨️ Hidden'}
                                    </button>
                                </div>
                            )}
                        </section>

                        {/* Billable tags */}
                        <section style={{ marginTop: '22px' }}>
                            <h3 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Billable Tags
                            </h3>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.5 }}>
                                Time tagged with any of these counts as billable in the
                                Billable vs Non-billable split (e.g. billable, client). Saved automatically.
                            </div>
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                                <input
                                    className="filter-input"
                                    placeholder="e.g. billable, client"
                                    value={billableInput}
                                    onChange={(e) => setBillableInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addBillableTag(billableInput);
                                        }
                                    }}
                                    style={{ flex: 1, minWidth: 0 }}
                                />
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => addBillableTag(billableInput)}
                                >
                                    Add
                                </button>
                            </div>
                            <div className="filter-chips" style={{ marginBottom: 0 }}>
                                {billableTags.length === 0 ? (
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        No billable tags
                                    </span>
                                ) : (
                                    billableTags.map(tag => (
                                        <span key={tag} className="filter-chip">
                                            #{tag}
                                            <button onClick={() => removeBillableTag(tag)}>×</button>
                                        </span>
                                    ))
                                )}
                            </div>
                        </section>

                        {/* Billable goal */}
                        <section style={{ marginTop: '22px' }}>
                            <h3 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Billable Goal
                            </h3>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.5 }}>
                                Target billable percentage. Shown as a marker on the split bar
                                with over/under status. Set to 0 to disable. Saved automatically.
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                    className="filter-input"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    placeholder="0"
                                    value={billableTarget || ''}
                                    onChange={(e) => updateBillableTarget(e.target.value)}
                                    style={{ width: '110px' }}
                                />
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>% billable</span>
                            </div>
                        </section>

                        {/* Vacation & Leave Allowance */}
                        <section style={{ marginTop: '22px' }}>
                            <h3 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Vacation & Leave Allowance
                            </h3>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.5 }}>
                                Annual vacation allowance in days (0 disables it).
                                Optional start date prorates your first year&apos;s allowance and counts leave from that date onward.
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                background: 'var(--bg-glass)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                marginBottom: '10px',
                            }}>
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>
                                        Vacation Chart
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        {showVacation
                                            ? (vacationAllowance > 0
                                                ? 'Active on dashboard below the heatmap'
                                                : 'Active — set an annual allowance > 0 below to display')
                                            : 'Disabled by default — activate to show on dashboard'}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className={`btn btn-sm ${showVacation ? 'btn-warning' : 'btn-secondary'}`}
                                    onClick={toggleShowVacation}
                                    aria-pressed={showVacation}
                                    style={{ fontSize: '11px', padding: '4px 10px' }}
                                >
                                    {showVacation ? '👁️ Active' : '👁️‍🗨️ Disabled'}
                                </button>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                                <input
                                    className="filter-input"
                                    type="number"
                                    min="0"
                                    max="366"
                                    step="0.5"
                                    placeholder="0"
                                    aria-label="Annual vacation allowance in days"
                                    value={vacationAllowance || ''}
                                    onChange={(e) => updateVacationAllowance(e.target.value)}
                                    style={{ width: '110px' }}
                                />
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>days / year</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                                <label
                                    htmlFor="vacation-start-date"
                                    style={{ fontSize: '12px', color: 'var(--text-secondary)', minWidth: '82px' }}
                                >
                                    Start date
                                </label>
                                <input
                                    id="vacation-start-date"
                                    className="filter-input"
                                    type="date"
                                    aria-label="Company start date"
                                    value={vacationStartDate}
                                    onChange={(e) => updateVacationStartDate(e.target.value)}
                                    style={{ flex: '1 1 150px', minWidth: 0 }}
                                />
                                {vacationStartDate && (
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => updateVacationStartDate('')}
                                        title="Clear start date"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            {vacationAllowance > 0 && (() => {
                                const currentYear = String(new Date().getFullYear());
                                const {
                                    effectiveAllowance,
                                    yearAllowance,
                                    isBeforeStart,
                                    effectiveAsOfMonth,
                                } = calculateEffectiveVacationAllowance(
                                    vacationAllowance,
                                    vacationStartDate,
                                    currentYear,
                                );
                                return (
                                    <div style={{ fontSize: '12px', color: 'var(--accent-warning)', marginBottom: '10px' }}>
                                        {isBeforeStart
                                            ? `Through ${effectiveAsOfMonth}: 0d (starts ${vacationStartDate})`
                                            : `Through ${effectiveAsOfMonth}: ${effectiveAllowance}d accrued` +
                                              (yearAllowance !== vacationAllowance
                                                  ? ` (${yearAllowance}d full ${currentYear} of ${vacationAllowance}d/yr)`
                                                  : ` of ${vacationAllowance}d/yr`)}
                                    </div>
                                );
                            })()}
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                                <input
                                    className="filter-input"
                                    placeholder="Vacation tags (e.g. vacation, pto)"
                                    value={vacationInput}
                                    onChange={(e) => setVacationInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addVacationTag(vacationInput);
                                        }
                                    }}
                                    style={{ flex: 1, minWidth: 0 }}
                                />
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => addVacationTag(vacationInput)}
                                >
                                    Add
                                </button>
                            </div>
                            <div className="filter-chips" style={{ marginBottom: 0 }}>
                                {vacationTags.length === 0 ? (
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        No vacation tags
                                    </span>
                                ) : (
                                    vacationTags.map(tag => (
                                        <span key={tag} className="filter-chip filter-chip-excluded">
                                            #{tag}
                                            <button onClick={() => removeVacationTag(tag)}>×</button>
                                        </span>
                                    ))
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            )}
        </main>
    );
}
