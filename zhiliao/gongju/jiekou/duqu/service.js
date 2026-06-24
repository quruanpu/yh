/**
 * File Read Service
 * Pure service layer for reading parsed file content from DBModule.
 */
const fileReadConfig = globalThis.ZhiLiaoConfig?.fileRead || {};

const FileReadService = {
    config: {
        defaultChunkLines: Number(fileReadConfig.defaultChunkLines) || 120,
        maxChunkLines: Number(fileReadConfig.maxChunkLines) || 500,
        maxSearchHits: Number(fileReadConfig.maxSearchHits) || 20,
        maxPreviewChars: Number(fileReadConfig.maxPreviewChars) || 240,
        contextLinesForSearch: Number(fileReadConfig.contextLinesForSearch) || 1,
        maxLineCacheEntries: Number(fileReadConfig.maxLineCacheEntries) || 32,
        defaultFullContentChars: Number(fileReadConfig.defaultFullContentChars) || 12000,
        maxFullContentChars: Number(fileReadConfig.maxFullContentChars) || 60000,
        autoFullReadCharsThreshold: Number(fileReadConfig.autoFullReadCharsThreshold) || 20000,
        maxForcedFullReadChars: Number(fileReadConfig.maxForcedFullReadChars) || 50000,
        defaultChunkChars: Number(fileReadConfig.defaultChunkChars) || 6000,
        maxChunkChars: Number(fileReadConfig.maxChunkChars) || 20000,
        defaultSnippetChars: Number(fileReadConfig.defaultSnippetChars) || 320,
        maxSnippetChars: Number(fileReadConfig.maxSnippetChars) || 1500,
        defaultStructureSampleLines: Number(fileReadConfig.defaultStructureSampleLines) || 40,
        maxStructureSampleLines: Number(fileReadConfig.maxStructureSampleLines) || 200,
        resultCacheTtlMs: Number(fileReadConfig.resultCacheTtlMs) || (5 * 60 * 1000),
        maxResultCacheEntries: Number(fileReadConfig.maxResultCacheEntries) || 128
    },

    state: {
        lineCache: new Map(),
        lowerLineCache: new Map(),
        resultCache: new Map()
    },

    toText(value) {
        if (value === undefined || value === null) return '';
        return String(value);
    },

    toInt(value, fallback) {
        const num = Number(value);
        if (!Number.isFinite(num)) return fallback;
        return Math.floor(num);
    },

    clampInt(value, min, max, fallback) {
        const num = this.toInt(value, fallback);
        return Math.max(min, Math.min(max, num));
    },

    normalizeFileId(params = {}) {
        const raw = typeof params === 'object' ? params.file_id : params;
        const fileId = this.toInt(raw, NaN);
        return Number.isFinite(fileId) && fileId > 0 ? fileId : 0;
    },

    normalizeKeyword(params = {}) {
        if (typeof params === 'string') return params.trim();
        return this.toText(params.keyword).trim();
    },

    normalizeNeedle(value) {
        return this.toText(value).toLowerCase();
    },

    normalizeReadMode(value, fallback = 'auto') {
        const mode = this.toText(value).trim().toLowerCase();
        if (mode === 'auto' || mode === 'full' || mode === 'window') return mode;
        return fallback;
    },

    toBoolean(value, fallback = false) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        if (typeof value === 'string') {
            const v = value.trim().toLowerCase();
            if (['1', 'true', 'yes', 'on'].includes(v)) return true;
            if (['0', 'false', 'no', 'off'].includes(v)) return false;
        }
        return fallback;
    },

    estimateTokensByChars(chars) {
        const value = this.toInt(chars, 0);
        if (value <= 0) return 0;
        return Math.ceil(value / 4);
    },

    buildPreview(content, maxChars = this.config.maxPreviewChars) {
        const text = this.toText(content).trim();
        if (!text) return '';
        if (text.length <= maxChars) return text;
        return `${text.slice(0, maxChars)}...`;
    },

    fail(error) {
        return { success: false, error };
    },

    cloneJson(value) {
        if (typeof structuredClone === 'function') {
            try {
                return structuredClone(value);
            } catch {
                // fallback below
            }
        }
        return JSON.parse(JSON.stringify(value));
    },

    ensureDB() {
        const db = window.DBModule || null;
        if (!db) throw new Error('file_db_unavailable');
        return db;
    },

    hasReadableText(file) {
        return !!this.toText(file?.content).trim();
    },

    toFileMeta(file) {
        return {
            id: file.id,
            filename: file.filename,
            type: file.type,
            extension: file.extension,
            size: file.size
        };
    },

    toListItem(file, options = {}) {
        const includePreview = this.toBoolean(options.include_preview, false);
        const maxPreviewChars = this.clampInt(
            options.max_preview_chars,
            20,
            this.config.maxPreviewChars,
            this.config.maxPreviewChars
        );
        return {
            ...this.toFileMeta(file),
            has_content: this.hasReadableText(file),
            preview: includePreview ? this.buildPreview(file.content, maxPreviewChars) : ''
        };
    },

    makeLineCacheKey(file) {
        return `${file.id || 0}:${file.timestamp || 0}:${this.toText(file.content).length}`;
    },

    splitLines(content) {
        return this.toText(content).split(/\r?\n/);
    },

    pruneLineCache() {
        const maxEntries = Math.max(1, this.toInt(this.config.maxLineCacheEntries, 32));
        while (this.state.lineCache.size > maxEntries) {
            const firstKey = this.state.lineCache.keys().next().value;
            this.state.lineCache.delete(firstKey);
            this.state.lowerLineCache.delete(firstKey);
        }
    },

    getLines(file) {
        const key = this.makeLineCacheKey(file);
        if (this.state.lineCache.has(key)) {
            return this.state.lineCache.get(key);
        }
        const lines = this.splitLines(file.content);
        this.state.lineCache.set(key, lines);
        this.pruneLineCache();
        return lines;
    },

    getLowerLines(file, lines = []) {
        const key = this.makeLineCacheKey(file);
        if (this.state.lowerLineCache.has(key)) {
            return this.state.lowerLineCache.get(key);
        }
        const sourceLines = Array.isArray(lines) && lines.length > 0 ? lines : this.getLines(file);
        const lowerLines = sourceLines.map((line) => this.toText(line).toLowerCase());
        this.state.lowerLineCache.set(key, lowerLines);
        this.pruneLineCache();
        return lowerLines;
    },

    pruneResultCache() {
        const maxEntries = Math.max(1, this.toInt(this.config.maxResultCacheEntries, 128));
        const now = Date.now();
        const ttlMs = Math.max(1000, this.toInt(this.config.resultCacheTtlMs, 5 * 60 * 1000));

        for (const [key, item] of this.state.resultCache.entries()) {
            if (!item || (now - item.time) > ttlMs) {
                this.state.resultCache.delete(key);
            }
        }

        while (this.state.resultCache.size > maxEntries) {
            const firstKey = this.state.resultCache.keys().next().value;
            this.state.resultCache.delete(firstKey);
        }
    },

    makeResultCacheKey(op, file, params = {}) {
        const version = this.makeLineCacheKey(file);
        return `${op}:${version}:${JSON.stringify(params)}`;
    },

    getCachedResult(key) {
        this.pruneResultCache();
        const item = this.state.resultCache.get(key);
        if (!item) return null;
        return this.cloneJson(item.value);
    },

    setCachedResult(key, value) {
        this.state.resultCache.set(key, {
            time: Date.now(),
            value: this.cloneJson(value)
        });
        this.pruneResultCache();
    },

    getTextWindow(text, startChar, maxChars) {
        const source = this.toText(text);
        const totalChars = source.length;
        const safeStart = this.clampInt(startChar, 0, Math.max(0, totalChars), 0);
        const safeMax = this.clampInt(
            maxChars,
            1,
            this.config.maxFullContentChars,
            this.config.defaultFullContentChars
        );
        const endChar = Math.min(totalChars, safeStart + safeMax);
        return {
            total_chars: totalChars,
            start_char: safeStart,
            end_char: endChar,
            returned_chars: Math.max(0, endChar - safeStart),
            has_more: endChar < totalChars,
            content: source.slice(safeStart, endChar)
        };
    },

    toKeywordList(keyword) {
        return this.normalizeNeedle(keyword)
            .split(/\s+/)
            .map((item) => item.trim())
            .filter(Boolean);
    },

    scoreTextMatch(text, keywords) {
        if (keywords.length === 0) return 0;
        const source = this.normalizeNeedle(text);
        let score = 0;
        for (let i = 0; i < keywords.length; i += 1) {
            const kw = keywords[i];
            if (!kw) continue;
            if (source === kw) score += 100;
            else if (source.startsWith(kw)) score += 50;
            else if (source.includes(kw)) score += 20;
        }
        return score;
    },

    detectDelimiter(lines = []) {
        const candidates = [',', '\t', ';', '|'];
        let best = { delimiter: '', score: 0, columns: 1 };
        const sample = lines.slice(0, 30);
        for (let i = 0; i < candidates.length; i += 1) {
            const delimiter = candidates[i];
            let score = 0;
            let columns = 1;
            for (let j = 0; j < sample.length; j += 1) {
                const line = this.toText(sample[j]);
                const parts = line.split(delimiter);
                if (parts.length > 1) {
                    score += parts.length;
                    columns = Math.max(columns, parts.length);
                }
            }
            if (score > best.score) {
                best = { delimiter, score, columns };
            }
        }
        if (best.score <= 0) return { delimiter: '', columns: 1 };
        return { delimiter: best.delimiter, columns: best.columns };
    },

    detectLikelyFormat(file, lines = []) {
        const ext = this.normalizeNeedle(file.extension);
        if (['md', 'markdown'].includes(ext)) return 'markdown';
        if (ext === 'json') return 'json';
        if (['csv', 'tsv'].includes(ext)) return ext;
        if (['xlsx', 'xls'].includes(ext)) return 'spreadsheet';
        if (ext === 'pdf') return 'pdf-text';
        if (ext === 'docx') return 'docx-text';
        const firstNonEmpty = lines.find((line) => this.toText(line).trim()) || '';
        const head = firstNonEmpty.trim();
        if (/^#{1,6}\s+/.test(head)) return 'markdown';
        if ((head.startsWith('{') && head.endsWith('}')) || (head.startsWith('[') && head.endsWith(']'))) {
            return 'json-like';
        }
        return file.type || 'text';
    },

    extractMarkdownHeadings(lines = [], maxItems = 20) {
        const out = [];
        for (let i = 0; i < lines.length; i += 1) {
            const text = this.toText(lines[i]);
            const match = text.match(/^(#{1,6})\s+(.+)$/);
            if (!match) continue;
            out.push({
                line_number: i + 1,
                level: match[1].length,
                title: match[2].trim()
            });
            if (out.length >= maxItems) break;
        }
        return out;
    },

    getSampleExcerpt(lines = [], maxLines = 40, maxChars = 3000) {
        const safeLines = this.clampInt(
            maxLines,
            1,
            this.config.maxStructureSampleLines,
            this.config.defaultStructureSampleLines
        );
        const subset = lines.slice(0, safeLines);
        let out = '';
        for (let i = 0; i < subset.length; i += 1) {
            const line = this.toText(subset[i]);
            const lineWithBreak = i === 0 ? line : `\n${line}`;
            if ((out.length + lineWithBreak.length) > maxChars) {
                const remain = Math.max(0, maxChars - out.length);
                out += lineWithBreak.slice(0, remain);
                return { text: out, truncated: true };
            }
            out += lineWithBreak;
        }
        return { text: out, truncated: false };
    },

    async loadSessionFiles() {
        const db = this.ensureDB();
        const sessionId = String(window.ZhiLiaoModule?.state?.sessionId || '').trim();
        if (!sessionId) return { ok: false, error: 'session_id_missing' };
        const files = await db.getSessionFiles(sessionId);
        return { ok: true, sessionId, files };
    },

    async loadFile(fileId) {
        const db = this.ensureDB();
        const file = await db.getFile(fileId);
        if (!file) return { ok: false, error: 'file_not_found' };
        return { ok: true, file };
    },

    async loadTextFile(params = {}) {
        const fileId = this.normalizeFileId(params);
        if (!fileId) return { ok: false, error: 'file_id_invalid' };

        const loaded = await this.loadFile(fileId);
        if (!loaded.ok) return loaded;

        const file = loaded.file;
        if (!this.hasReadableText(file)) {
            return { ok: false, error: 'file_has_no_text_content' };
        }
        const lines = this.getLines(file);
        return { ok: true, file, lines };
    },

    async getFileList(params = {}) {
        const loaded = await this.loadSessionFiles();
        if (!loaded.ok) return this.fail(loaded.error);
        const includePreview = this.toBoolean(params.include_preview, false);
        const maxPreviewChars = this.clampInt(
            params.max_preview_chars,
            20,
            this.config.maxPreviewChars,
            this.config.maxPreviewChars
        );

        return {
            success: true,
            session_id: loaded.sessionId,
            count: loaded.files.length,
            files: loaded.files.map((file) =>
                this.toListItem(file, { include_preview: includePreview, max_preview_chars: maxPreviewChars })
            )
        };
    },

    async getFileContent(params = {}) {
        const loaded = await this.loadTextFile(params);
        if (!loaded.ok) return this.fail(loaded.error);

        const { file, lines } = loaded;
        const text = this.toText(file.content);
        const totalChars = text.length;
        const requestedMode = this.normalizeReadMode(params.read_mode, 'auto');
        const autoThreshold = this.clampInt(
            params.auto_full_threshold_chars,
            1,
            this.config.maxForcedFullReadChars,
            this.config.autoFullReadCharsThreshold
        );
        const forcedFullLimit = this.clampInt(
            params.max_forced_full_chars,
            1,
            this.config.maxForcedFullReadChars,
            this.config.maxForcedFullReadChars
        );

        let appliedMode = requestedMode;
        if (requestedMode === 'auto') {
            appliedMode = totalChars <= autoThreshold ? 'full' : 'window';
        }
        if (requestedMode === 'full' && totalChars > forcedFullLimit) {
            appliedMode = 'window';
        }

        if (appliedMode === 'full') {
            const output = {
                success: true,
                file: {
                    ...this.toFileMeta(file),
                    line_count: lines.length,
                    char_count: totalChars,
                    start_char: 0,
                    end_char: totalChars,
                    returned_chars: totalChars,
                    has_more: false,
                    estimated_tokens: this.estimateTokensByChars(totalChars),
                    read_mode_requested: requestedMode,
                    read_mode_applied: 'full',
                    content: text
                },
                next: null
            };
            return output;
        }

        const maxChars = this.clampInt(
            params.max_chars,
            1,
            this.config.maxFullContentChars,
            this.config.defaultFullContentChars
        );
        const startChar = this.clampInt(params.start_char, 0, Number.MAX_SAFE_INTEGER, 0);
        const windowResult = this.getTextWindow(text, startChar, maxChars);

        return {
            success: true,
            file: {
                ...this.toFileMeta(file),
                line_count: lines.length,
                char_count: windowResult.total_chars,
                start_char: windowResult.start_char,
                end_char: windowResult.end_char,
                returned_chars: windowResult.returned_chars,
                has_more: windowResult.has_more,
                estimated_tokens: this.estimateTokensByChars(windowResult.returned_chars),
                read_mode_requested: requestedMode,
                read_mode_applied: 'window',
                content: windowResult.content
            },
            next: windowResult.has_more ? { start_char: windowResult.end_char } : null,
            note: requestedMode === 'full' && totalChars > forcedFullLimit
                ? `full_read_exceeds_limit_${forcedFullLimit}_fallback_to_window`
                : ''
        };
    },

    async readFileChunk(params = {}) {
        const loaded = await this.loadTextFile(params);
        if (!loaded.ok) return this.fail(loaded.error);

        const { file, lines } = loaded;
        const totalLines = lines.length;
        const startLine = this.clampInt(params.start_line, 1, Math.max(totalLines, 1), 1);
        const lineCharOffset = this.clampInt(params.line_char_offset, 0, Number.MAX_SAFE_INTEGER, 0);
        const maxLines = this.clampInt(
            params.max_lines,
            1,
            this.config.maxChunkLines,
            this.config.defaultChunkLines
        );
        const maxChars = this.clampInt(
            params.max_chars,
            1,
            this.config.maxChunkChars,
            this.config.defaultChunkChars
        );

        const hardEndLine = Math.min(totalLines, startLine + maxLines - 1);
        const startIndex = startLine - 1;
        let endIndex = startIndex - 1;
        let usedChars = 0;
        let truncatedByChars = false;
        const picked = [];
        let appliedLineCharOffset = 0;
        let nextLineCharOffset = 0;

        for (let i = startIndex; i < hardEndLine; i += 1) {
            const fullLine = this.toText(lines[i]);
            let lineOffset = 0;
            if (i === startIndex && lineCharOffset > 0) {
                lineOffset = Math.min(lineCharOffset, fullLine.length);
                appliedLineCharOffset = lineOffset;
            }
            const line = lineOffset > 0 ? fullLine.slice(lineOffset) : fullLine;
            const plusChars = (picked.length > 0 ? 1 : 0) + line.length;

            if (usedChars + plusChars > maxChars) {
                if (picked.length === 0) {
                    const partial = line.slice(0, maxChars);
                    picked.push(partial);
                    usedChars = partial.length;
                    nextLineCharOffset = lineOffset + partial.length;
                    endIndex = i;
                    truncatedByChars = true;
                } else {
                    truncatedByChars = true;
                }
                break;
            }

            picked.push(line);
            usedChars += plusChars;
            endIndex = i;
        }

        if (endIndex < startIndex && totalLines > 0) {
            endIndex = startIndex;
        }
        const endLine = Math.min(totalLines, endIndex + 1);
        const content = picked.join('\n');
        let next = null;

        if (truncatedByChars && endLine === startLine && nextLineCharOffset > 0) {
            const fullLineLength = this.toText(lines[startIndex]).length;
            if (nextLineCharOffset < fullLineLength) {
                next = { start_line: startLine, line_char_offset: nextLineCharOffset };
            } else if (endLine < totalLines) {
                next = { start_line: endLine + 1, line_char_offset: 0 };
            }
        } else if (endLine < totalLines) {
            next = { start_line: endLine + 1, line_char_offset: 0 };
        }

        return {
            success: true,
            file: {
                ...this.toFileMeta(file),
                total_lines: totalLines
            },
            range: {
                start_line: startLine,
                end_line: endLine,
                has_more: endLine < totalLines,
                truncated_by_chars: truncatedByChars,
                line_char_offset_applied: appliedLineCharOffset
            },
            content,
            returned_chars: content.length,
            estimated_tokens: this.estimateTokensByChars(content.length),
            next
        };
    },

    async searchFiles(params = {}) {
        const keyword = this.normalizeKeyword(params);
        if (!keyword) return this.fail('keyword_missing');

        const loaded = await this.loadSessionFiles();
        if (!loaded.ok) return this.fail(loaded.error);

        const keywords = this.toKeywordList(keyword);
        const files = loaded.files
            .map((file) => ({
                file,
                score: this.scoreTextMatch(
                    `${file.filename || ''}\n${file.extension || ''}\n${file.type || ''}`,
                    keywords
                )
            }))
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((item) => item.file);

        return {
            success: true,
            keyword,
            count: files.length,
            files: files.map((file) => this.toListItem(file))
        };
    },

    async searchFileContent(params = {}) {
        const keyword = this.normalizeKeyword(params);
        if (!keyword) return this.fail('keyword_missing');

        const loaded = await this.loadTextFile(params);
        if (!loaded.ok) return this.fail(loaded.error);

        const { file, lines } = loaded;
        const lowerLines = this.getLowerLines(file, lines);
        const needle = this.normalizeNeedle(keyword);
        const maxHits = this.clampInt(params.max_hits, 1, this.config.maxSearchHits, 8);
        const contextLines = this.clampInt(
            params.context_lines,
            0,
            5,
            this.config.contextLinesForSearch
        );
        const startLine = this.clampInt(params.start_line, 1, Math.max(1, lines.length), 1);
        const includeSnippet = this.toBoolean(params.include_snippet, false);
        const snippetChars = this.clampInt(
            params.snippet_chars,
            50,
            this.config.maxSnippetChars,
            this.config.defaultSnippetChars
        );
        const cacheKey = this.makeResultCacheKey('search', file, {
            keyword: needle,
            max_hits: maxHits,
            context_lines: contextLines,
            start_line: startLine,
            include_snippet: includeSnippet,
            snippet_chars: snippetChars
        });
        const cached = this.getCachedResult(cacheKey);
        if (cached) return cached;
        const hits = [];
        let scannedToLine = startLine - 1;
        let nextStartLine = null;

        for (let i = startLine - 1; i < lines.length; i += 1) {
            const lineText = this.toText(lines[i]);
            scannedToLine = i + 1;
            if (!String(lowerLines[i] || '').includes(needle)) continue;

            const start = Math.max(0, i - contextLines);
            const end = Math.min(lines.length - 1, i + contextLines);
            const record = {
                line_number: i + 1,
                text: this.buildPreview(lineText, snippetChars),
                context_start_line: start + 1,
                context_end_line: end + 1
            };
            if (includeSnippet) {
                record.snippet = this.buildPreview(lines.slice(start, end + 1).join('\n'), snippetChars * 3);
            }
            hits.push(record);
            if (hits.length >= maxHits) {
                nextStartLine = i + 2;
                break;
            }
        }
        const hasMore = nextStartLine !== null && nextStartLine <= lines.length;

        const output = {
            success: true,
            file: {
                ...this.toFileMeta(file),
                total_lines: lines.length
            },
            keyword,
            range: {
                start_line: startLine,
                scanned_to_line: scannedToLine,
                has_more: hasMore
            },
            hit_count: hits.length,
            hits,
            next: hasMore ? { start_line: nextStartLine } : null,
            estimated_tokens: this.estimateTokensByChars(
                hits.reduce((sum, item) => sum + this.toText(item.text).length + this.toText(item.snippet).length, 0)
            )
        };
        this.setCachedResult(cacheKey, output);
        return output;
    },

    async describeFileStructure(params = {}) {
        const loaded = await this.loadTextFile(params);
        if (!loaded.ok) return this.fail(loaded.error);

        const { file, lines } = loaded;
        const sampleLines = this.clampInt(
            params.sample_lines,
            1,
            this.config.maxStructureSampleLines,
            this.config.defaultStructureSampleLines
        );
        const cacheKey = this.makeResultCacheKey('describe', file, { sample_lines: sampleLines });
        const cached = this.getCachedResult(cacheKey);
        if (cached) return cached;

        const nonEmptyLines = lines.filter((line) => this.toText(line).trim().length > 0);
        const totalChars = this.toText(file.content).length;
        const avgLineLength = lines.length > 0 ? Math.round(totalChars / lines.length) : 0;
        const maxLineLength = lines.reduce((max, line) => Math.max(max, this.toText(line).length), 0);
        const likelyFormat = this.detectLikelyFormat(file, lines);
        const headings = this.extractMarkdownHeadings(lines, 20);
        const delimiterInfo = this.detectDelimiter(lines);
        const sample = this.getSampleExcerpt(lines, sampleLines, 3000);

        const output = {
            success: true,
            file: {
                ...this.toFileMeta(file),
                total_lines: lines.length,
                non_empty_lines: nonEmptyLines.length,
                total_chars: totalChars,
                avg_line_length: avgLineLength,
                max_line_length: maxLineLength
            },
            parser_metadata: file.metadata || {},
            structure: {
                likely_format: likelyFormat,
                detected_delimiter: delimiterInfo.delimiter || null,
                estimated_columns: delimiterInfo.columns,
                markdown_headings: headings
            },
            sample: {
                lines: sampleLines,
                truncated: sample.truncated,
                content: sample.text
            },
            recommended_calls: {
                search_first: {
                    tool: 'search_file_content',
                    args: { file_id: file.id, keyword: 'your keyword', max_hits: 8, include_snippet: false }
                },
                read_first: {
                    tool: 'read_file_chunk',
                    args: { file_id: file.id, start_line: 1, max_lines: 120, max_chars: 6000 }
                },
                full_when_small: {
                    tool: 'get_file_content',
                    condition: `total_chars <= ${this.config.autoFullReadCharsThreshold}`,
                    args: { file_id: file.id, read_mode: 'auto' }
                }
            },
            estimated_tokens: this.estimateTokensByChars(sample.text.length)
        };
        this.setCachedResult(cacheKey, output);
        return output;
    }
};

window.FileReadService = FileReadService;
