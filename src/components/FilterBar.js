'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export default function FilterBar({ filters, onFilterChange, allTags }) {
    const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
    const [tagSearch, setTagSearch] = useState('');
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setTagDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Create portal container for datepicker popups (renders at body level, above all stacking contexts)
    useEffect(() => {
        if (!document.getElementById('datepicker-portal')) {
            const portal = document.createElement('div');
            portal.id = 'datepicker-portal';
            document.body.appendChild(portal);
        }
    }, []);

    const filteredTags = useMemo(() => {
        if (!tagSearch) return allTags;
        return allTags.filter(t => t.toLowerCase().includes(tagSearch.toLowerCase()));
    }, [allTags, tagSearch]);

    const toggleTag = (tag) => {
        const current = filters.tags || [];
        const updated = current.includes(tag)
            ? current.filter(t => t !== tag)
            : [...current, tag];
        onFilterChange({ ...filters, tags: updated });
    };

    const removeTag = (tag) => {
        onFilterChange({
            ...filters,
            tags: (filters.tags || []).filter(t => t !== tag),
        });
    };

    const clearAllFilters = () => {
        onFilterChange({ dateFrom: '', dateTo: '', tags: [], search: '' });
    };

    const hasActiveFilters = filters.dateFrom || filters.dateTo ||
        (filters.tags && filters.tags.length > 0) || filters.search;

    // Convert string dates for DatePicker
    const dateFrom = filters.dateFrom ? new Date(filters.dateFrom + 'T00:00:00') : null;
    const dateTo = filters.dateTo ? new Date(filters.dateTo + 'T00:00:00') : null;

    const formatLocalDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const handleDateFromChange = (date) => {
        const val = date ? formatLocalDate(date) : '';
        onFilterChange({ ...filters, dateFrom: val });
    };

    const handleDateToChange = (date) => {
        const val = date ? formatLocalDate(date) : '';
        onFilterChange({ ...filters, dateTo: val });
    };

    return (
        <div className="animate-fade-in" style={{ position: 'relative', zIndex: 50 }}>
            <div className="filter-bar">
                <div className="filter-group">
                    <label className="filter-label">From</label>
                    <DatePicker
                        selected={dateFrom}
                        onChange={handleDateFromChange}
                        selectsStart
                        startDate={dateFrom}
                        endDate={dateTo}
                        maxDate={dateTo || undefined}
                        dateFormat="yyyy-MM-dd"
                        placeholderText="Start date"
                        className="filter-input"
                        isClearable
                        showMonthDropdown
                        showYearDropdown
                        dropdownMode="select"
                        portalId="datepicker-portal"
                    />
                </div>

                <div className="filter-group">
                    <label className="filter-label">To</label>
                    <DatePicker
                        selected={dateTo}
                        onChange={handleDateToChange}
                        selectsEnd
                        startDate={dateFrom}
                        endDate={dateTo}
                        minDate={dateFrom || undefined}
                        dateFormat="yyyy-MM-dd"
                        placeholderText="End date"
                        className="filter-input"
                        isClearable
                        showMonthDropdown
                        showYearDropdown
                        dropdownMode="select"
                        portalId="datepicker-portal"
                    />
                </div>

                <div className="filter-group tag-select" ref={dropdownRef} style={{ position: 'relative', zIndex: 40 }}>
                    <label className="filter-label">Tags</label>
                    <input
                        className="filter-input"
                        placeholder="Select tags..."
                        value={tagSearch}
                        onChange={(e) => {
                            setTagSearch(e.target.value);
                            if (!tagDropdownOpen) setTagDropdownOpen(true);
                        }}
                        onFocus={() => setTagDropdownOpen(true)}
                    />
                    {tagDropdownOpen && filteredTags.length > 0 && (
                        <div className="tag-select-dropdown">
                            {filteredTags.map(tag => {
                                const isSelected = (filters.tags || []).includes(tag);
                                return (
                                    <div
                                        key={tag}
                                        className={`tag-option ${isSelected ? 'selected' : ''}`}
                                        onClick={() => toggleTag(tag)}
                                    >
                                        <span className="tag-option-check">{isSelected ? '✓' : ''}</span>
                                        #{tag}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="filter-group" style={{ flex: 1, minWidth: '200px' }}>
                    <label className="filter-label">Search</label>
                    <input
                        className="filter-input"
                        placeholder="Search anything..."
                        value={filters.search || ''}
                        onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
                        style={{ width: '100%' }}
                    />
                </div>

                {hasActiveFilters && (
                    <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
                        <label className="filter-label">&nbsp;</label>
                        <button className="btn btn-danger btn-sm" onClick={clearAllFilters}>
                            ✕ Clear All
                        </button>
                    </div>
                )}
            </div>

            {filters.tags && filters.tags.length > 0 && (
                <div className="filter-chips" style={{ marginBottom: '16px' }}>
                    {filters.tags.map(tag => (
                        <span key={tag} className="filter-chip">
                            #{tag}
                            <button onClick={() => removeTag(tag)}>×</button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
