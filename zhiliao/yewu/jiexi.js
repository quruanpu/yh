// 文件解析模块：图片/视频走 COS；文档/文本/表格走本地解析并入库。
const FileParserModule = {
    config: {
        videoUploadUrl:
            window.ZhiLiaoConfig?.cloudFunction.uploadUrl ||
            'https://1317825751-jtfz816235.ap-guangzhou.tencentscf.com',

        maxTextLength: window.ZhiLiaoConfig?.file.maxTextLength || 10485760,
        maxCsvRows: window.ZhiLiaoConfig?.file.maxCsvRows || 2000,
        maxExcelRows: window.ZhiLiaoConfig?.file.maxExcelRows || 2000,
        maxPdfPages: window.ZhiLiaoConfig?.file.maxPdfPages || 1000,
        maxPdfTextLength: window.ZhiLiaoConfig?.file.maxTextLength || 10485760,
        maxWordTextLength: window.ZhiLiaoConfig?.file.maxTextLength || 10485760,

        supportedFormats: {
            text: [
                'txt', 'md', 'markdown', 'log', 'rtf',
                'js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'sass', 'less', 'html', 'htm', 'vue', 'svelte',
                'py', 'java', 'cpp', 'c', 'h', 'hpp', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'r', 'm', 'mm',
                'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd',
                'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf',
                'sql', 'graphql', 'proto', 'dockerfile', 'makefile', 'gradle', 'cmake'
            ],
            document: ['pdf', 'docx', 'doc'],
            spreadsheet: ['csv', 'xlsx', 'xls'],
            image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'],
            video: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'mpeg', 'mpg']
        }
    },

    init() {
        window.ZhiLiaoLog?.debug?.('文件解析模块初始化：文档走工具读取，视觉走 COS URL');
    },

    loadExternalScript(src, isReady) {
        return new Promise((resolve, reject) => {
            if (typeof isReady === 'function' && isReady()) {
                resolve();
                return;
            }

            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                if (existing.dataset.loaded === '1' || existing.readyState === 'loaded' || existing.readyState === 'complete') {
                    resolve();
                    return;
                }
                existing.addEventListener('load', () => resolve(), { once: true });
                existing.addEventListener('error', () => reject(new Error(`资源加载失败: ${src}`)), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => {
                script.dataset.loaded = '1';
                resolve();
            };
            script.onerror = () => reject(new Error(`资源加载失败: ${src}`));
            document.head.appendChild(script);
        });
    },

    async ensureExcelLib() {
        if (window.AppFramework?.ensureExternalDependency) {
            await window.AppFramework.ensureExternalDependency('xlsx');
            return;
        }

        try {
            await this.loadExternalScript(
                'buju/wb/xlsx/xlsx.full.min.js',
                () => typeof XLSX !== 'undefined'
            );
        } catch (error) {
            await this.loadExternalScript(
                'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
                () => typeof XLSX !== 'undefined'
            );
        }
    },

    async ensurePdfLib() {
        await this.loadExternalScript(
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
            () => typeof pdfjsLib !== 'undefined'
        );
        if (window.pdfjsLib?.GlobalWorkerOptions && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
    },

    async ensureWordLib() {
        await this.loadExternalScript(
            'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
            () => typeof mammoth !== 'undefined'
        );
    },

    getFileExtension(filename) {
        const parts = String(filename || '').split('.');
        return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
    },

    getFileType(extension) {
        for (const [type, extensions] of Object.entries(this.config.supportedFormats)) {
            if (extensions.includes(extension)) {
                return type;
            }
        }
        return 'unknown';
    },

    isSupported(filename) {
        const ext = this.getFileExtension(filename);
        const type = this.getFileType(ext);
        return type !== 'unknown';
    },

    clampText(text, maxChars) {
        const source = typeof text === 'string' ? text : '';
        if (source.length <= maxChars) return source;
        return `${source.slice(0, maxChars)}\n...[内容已截断]`;
    },

    async readTextFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('读取文件失败'));
            reader.readAsText(file);
        });
    },

    async readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = String(e.target.result || '').split(',')[1] || '';
                resolve(base64);
            };
            reader.onerror = () => reject(new Error('读取文件失败'));
            reader.readAsDataURL(file);
        });
    },

    async readFileAsURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('读取文件失败'));
            reader.readAsDataURL(file);
        });
    },

    async parseCSVFile(file) {
        const raw = await this.readTextFile(file);
        const lines = String(raw || '').split(/\r?\n/);
        const normalized = lines.filter((line) => line.trim() !== '');
        const limited = normalized.slice(0, this.config.maxCsvRows);
        const content = limited.join('\n');
        return {
            type: 'spreadsheet',
            extension: 'csv',
            filename: file.name,
            size: file.size,
            totalRows: normalized.length,
            parsedRows: limited.length,
            content: this.clampText(content, this.config.maxTextLength),
            parsedBy: 'CSV'
        };
    },

    async parseTextFile(file) {
        const content = await this.readTextFile(file);
        const normalized = this.clampText(String(content || ''), this.config.maxTextLength);
        return {
            type: 'text',
            extension: this.getFileExtension(file.name),
            filename: file.name,
            size: file.size,
            lines: normalized.split(/\r?\n/).length,
            content: normalized,
            parsedBy: 'Text'
        };
    },

    async parseExcel(file) {
        await this.ensureExcelLib();
        if (typeof XLSX === 'undefined') {
            throw new Error('SheetJS库未加载');
        }

        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetNames = workbook.SheetNames.slice(0, 5);

        const sections = [];
        let totalRows = 0;
        let parsedRows = 0;

        for (let i = 0; i < sheetNames.length; i += 1) {
            const sheetName = sheetNames[i];
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            const limited = rows.slice(0, this.config.maxExcelRows);
            totalRows += rows.length;
            parsedRows += limited.length;

            sections.push(`--- 工作表 ${sheetName} ---`);
            sections.push(limited.map((row) => row.join('\t')).join('\n'));
            sections.push(`（共 ${rows.length} 行，显示 ${limited.length} 行）`);
            sections.push('');
        }

        const content = this.clampText(sections.join('\n'), this.config.maxTextLength);
        return {
            type: 'spreadsheet',
            extension: this.getFileExtension(file.name),
            filename: file.name,
            size: file.size,
            totalSheets: workbook.SheetNames.length,
            parsedSheets: sheetNames.length,
            totalRows,
            parsedRows,
            content,
            parsedBy: 'SheetJS'
        };
    },

    async parsePdfFile(file) {
        await this.ensurePdfLib();
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF.js库未加载');
        }

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const totalPages = Number(pdf.numPages || 0);
        const maxPages = Math.min(totalPages, this.config.maxPdfPages);

        const parts = [];
        let textLength = 0;
        let parsedPages = 0;

        for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const line = textContent.items
                .map((item) => String(item?.str || '').trim())
                .filter(Boolean)
                .join(' ');
            parts.push(line);
            textLength += line.length + 1;
            parsedPages = pageNum;
            if (textLength >= this.config.maxPdfTextLength) {
                break;
            }
        }

        let content = this.clampText(parts.join('\n'), this.config.maxPdfTextLength);
        if (!String(content || '').trim()) {
            content = '[提示] 未从 PDF 中提取到可读文本（可能为扫描件图片）。';
        }
        return {
            type: 'document',
            extension: 'pdf',
            filename: file.name,
            size: file.size,
            totalPages,
            parsedPages,
            content,
            parsedBy: 'PDF.js'
        };
    },

    async parseDocxFile(file) {
        await this.ensureWordLib();
        if (typeof mammoth === 'undefined') {
            throw new Error('Mammoth库未加载');
        }

        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        let content = this.clampText(String(result?.value || ''), this.config.maxWordTextLength);
        if (!String(content || '').trim()) {
            content = '[提示] DOCX 文档未提取到可读文本。';
        }
        return {
            type: 'document',
            extension: 'docx',
            filename: file.name,
            size: file.size,
            content,
            parsedBy: 'Mammoth'
        };
    },

    async parseLegacyDocFile(file) {
        return {
            type: 'document',
            extension: 'doc',
            filename: file.name,
            size: file.size,
            content: '[提示] .doc 为旧版二进制格式，当前仅支持基础占位。建议转为 .docx 或 .pdf 后再上传。',
            parsedBy: 'LegacyPlaceholder'
        };
    },

    async parseDocumentFile(file) {
        const ext = this.getFileExtension(file.name);
        if (ext === 'pdf') return this.parsePdfFile(file);
        if (ext === 'docx') return this.parseDocxFile(file);
        if (ext === 'doc') return this.parseLegacyDocFile(file);
        return this.parseTextFile(file);
    },

    async uploadFileToCOS(file) {
        try {
            window.ZhiLiaoLog?.debug?.('开始上传文件到COS:', file.name, '大小:', file.size);
            const threshold = window.ZhiLiaoConfig?.file.uploadSizeThreshold || 5242880;

            if (file.size > threshold) {
                window.ZhiLiaoLog?.debug?.(`文件较大（>${Math.round(threshold / 1024 / 1024)}MB），使用预签名 URL 上传`);
                return await this.uploadFileWithPresignedUrl(file);
            }

            const thresholdMB = Math.round(threshold / 1024 / 1024);
            window.ZhiLiaoLog?.debug?.(`文件较小（≤${thresholdMB}MB），使用Base64上传`);
            const base64 = await this.readFileAsBase64(file);

            const response = await fetch(this.config.videoUploadUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file: base64,
                    fileName: file.name,
                    fileType: file.type
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `上传失败: HTTP ${response.status}`);
            }

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || '上传失败');
            }

            return {
                url: result.url,
                fileName: result.fileName,
                size: result.size
            };
        } catch (error) {
            console.error('上传文件错误:', error);
            throw new Error(`文件上传失败: ${error.message}`);
        }
    },

    async uploadFileWithPresignedUrl(file) {
        const response = await fetch(this.config.videoUploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'getUploadUrl',
                fileName: file.name,
                fileType: file.type
            })
        });

        if (!response.ok) {
            throw new Error(`获取上传URL失败: HTTP ${response.status}`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || '获取上传URL失败');
        }

        const uploadResponse = await fetch(result.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file
        });

        if (!uploadResponse.ok) {
            throw new Error(`上传到COS失败: HTTP ${uploadResponse.status}`);
        }

        return {
            url: result.publicUrl,
            fileName: result.fileName,
            size: file.size
        };
    },

    async parseImage(file) {
        const uploadResult = await this.uploadFileToCOS(file);
        const previewUrl = await this.readFileAsURL(file);
        return {
            type: 'image',
            extension: this.getFileExtension(file.name),
            filename: file.name,
            size: file.size,
            url: uploadResult.url,
            preview: previewUrl,
            parsedBy: 'Direct'
        };
    },

    async parseVideo(file) {
        const uploadResult = await this.uploadFileToCOS(file);
        const previewUrl = await this.readFileAsURL(file);
        return {
            type: 'video',
            extension: this.getFileExtension(file.name),
            filename: file.name,
            size: file.size,
            url: uploadResult.url,
            preview: previewUrl,
            parsedBy: 'Direct'
        };
    },

    async parseFile(file) {
        if (!file) {
            throw new Error('未提供文件。');
        }

        const ext = this.getFileExtension(file.name);
        const fileType = this.getFileType(ext);
        if (fileType === 'unknown') {
            throw new Error(`不支持的文件格式: ${ext}`);
        }

        if (fileType === 'image') {
            return this.parseImage(file);
        }
        if (fileType === 'video') {
            return this.parseVideo(file);
        }
        if (fileType === 'text') {
            return this.parseTextFile(file);
        }
        if (fileType === 'spreadsheet') {
            if (ext === 'csv') {
                return this.parseCSVFile(file);
            }
            return this.parseExcel(file);
        }
        if (fileType === 'document') {
            return this.parseDocumentFile(file);
        }

        throw new Error('未知的文件类型。');
    }
};

window.FileParserModule = FileParserModule;
FileParserModule.init();


