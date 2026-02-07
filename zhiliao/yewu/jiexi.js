// 文件解析模块 - 使用现代化解析库
const FileParserModule = {
    // 配置
    config: {
        // 视觉模型配置（用于图片、视频）
        apiKey: window.ZhiLiaoConfig?.api.key || 'b19c0371e3af4b5b83c6682baff9ac30.ruRGrlPzrOZ5YjAp',
        apiBase: window.ZhiLiaoConfig?.api.baseUrl || 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        model: window.ZhiLiaoConfig?.api.model || 'glm-4.6v',

        // 云函数配置（用于视频上传）
        videoUploadUrl: window.ZhiLiaoConfig?.cloudFunction.uploadUrl || 'https://1317825751-jtfz816235.ap-guangzhou.tencentscf.com',

        // 文件解析配置
        maxTextLength: window.ZhiLiaoConfig?.file.maxTextLength || 10485760,
        maxCsvRows: window.ZhiLiaoConfig?.file.maxCsvRows || 50,
        maxExcelRows: window.ZhiLiaoConfig?.file.maxExcelRows || 50,
        maxPdfPages: window.ZhiLiaoConfig?.file.maxPdfPages || 1000,
        maxPdfTextLength: window.ZhiLiaoConfig?.file.maxTextLength || 10485760,
        maxWordTextLength: window.ZhiLiaoConfig?.file.maxTextLength || 10485760,

        // 支持的文件格式
        supportedFormats: {
            text: [
                // 文本文档
                'txt', 'md', 'markdown', 'log', 'rtf',
                // Web前端
                'js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'sass', 'less', 'html', 'htm', 'vue', 'svelte',
                // 编程语言
                'py', 'java', 'cpp', 'c', 'h', 'hpp', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'r', 'm', 'mm',
                // 脚本语言
                'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd',
                // 数据格式
                'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf',
                // 其他
                'sql', 'graphql', 'proto', 'dockerfile', 'makefile', 'gradle', 'cmake'
            ],
            document: ['pdf', 'docx', 'doc'],
            spreadsheet: ['csv', 'xlsx', 'xls'],
            image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'],
            video: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'mpeg', 'mpg']
        }
    },

    // 初始化
    init() {
        console.log('文件解析模块初始化 - 混合实现：URL直传 + 本地解析');
    },

    // 获取文件扩展名
    getFileExtension(filename) {
        const parts = filename.split('.');
        return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
    },

    // 获取文件类型
    getFileType(extension) {
        for (const [type, extensions] of Object.entries(this.config.supportedFormats)) {
            if (extensions.includes(extension)) {
                return type;
            }
        }
        return 'unknown';
    },

    // 检查文件是否支持
    isSupported(filename) {
        const ext = this.getFileExtension(filename);
        const type = this.getFileType(ext);
        return type !== 'unknown';
    },

    // 读取文本文件
    async readTextFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('读取文件失败'));
            reader.readAsText(file);
        });
    },

    // 读取文件为Base64
    async readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = (e) => reject(new Error('读取文件失败'));
            reader.readAsDataURL(file);
        });
    },

    // 读取文件为URL
    async readFileAsURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('读取文件失败'));
            reader.readAsDataURL(file);
        });
    },

    // 解析CSV文件
    async parseCSV(content) {
        const lines = content.split('\n').filter(line => line.trim());
        const maxRows = Math.min(lines.length, this.config.maxCsvRows);
        const rows = lines.slice(0, maxRows);

        return {
            type: 'csv',
            totalRows: lines.length,
            parsedRows: maxRows,
            preview: rows.join('\n'),
            data: rows.map(row => row.split(','))
        };
    },

    // 解析文本文件
    async parseTextFile(file) {
        try {
            const content = await this.readTextFile(file);
            const ext = this.getFileExtension(file.name);

            if (ext === 'csv') {
                return await this.parseCSV(content);
            }

            return {
                type: 'text',
                extension: ext,
                content: content,
                size: file.size,
                lines: content.split('\n').length
            };
        } catch (error) {
            throw new Error(`解析文本文件失败: ${error.message}`);
        }
    },

    // 上传文件到腾讯云COS（通过云函数）- 支持视频、PDF、文档等
    async uploadFileToCOS(file) {
        try {
            console.log('开始上传文件到COS:', file.name, '大小:', file.size);

            // 判断文件大小，大于阈值使用预签名URL直接上传
            const threshold = window.ZhiLiaoConfig?.file.uploadSizeThreshold || 5242880;
            if (file.size > threshold) {
                console.log(`文件较大（>${Math.round(threshold/1024/1024)}MB），使用预签名URL上传`);
                return await this.uploadFileWithPresignedUrl(file);
            }

            const thresholdMB = Math.round((window.ZhiLiaoConfig?.file.uploadSizeThreshold || 5242880)/1024/1024);
            console.log(`文件较小（≤${thresholdMB}MB），使用Base64上传`);

            // 1. 读取文件为Base64
            const base64 = await this.readFileAsBase64(file);

            // 2. 调用云函数上传
            const response = await fetch(this.config.videoUploadUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    file: base64,
                    fileName: file.name,
                    fileType: file.type
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('视频上传失败:', errorData);
                throw new Error(errorData.error || `上传失败: HTTP ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || '上传失败');
            }

            console.log('视频上传成功:', result);

            // 返回COS的公网URL
            return {
                url: result.url,
                fileName: result.fileName,
                size: result.size
            };
        } catch (error) {
            console.error('上传视频错误:', error);
            throw new Error(`视频上传失败: ${error.message}`);
        }
    },

    // 使用预签名URL上传大文件
    async uploadFileWithPresignedUrl(file) {
        try {
            // 1. 获取预签名URL
            console.log('步骤1: 获取预签名URL');
            const response = await fetch(this.config.videoUploadUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
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

            console.log('预签名URL获取成功');

            // 2. 直接上传文件到COS
            console.log('步骤2: 直接上传文件到COS');
            const uploadResponse = await fetch(result.uploadUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': file.type
                },
                body: file
            });

            if (!uploadResponse.ok) {
                throw new Error(`上传到COS失败: HTTP ${uploadResponse.status}`);
            }

            console.log('文件上传成功');

            return {
                url: result.publicUrl,
                fileName: result.fileName,
                size: file.size
            };
        } catch (error) {
            console.error('预签名URL上传错误:', error);
            throw error;
        }
    },

    // 解析图片文件（直接返回Base64，不预解析）
    async parseImage(file) {
        try {
            const base64 = await this.readFileAsBase64(file);
            const dataUrl = `data:${file.type};base64,${base64}`;

            return {
                type: 'image',
                filename: file.name,
                size: file.size,
                url: dataUrl,  // 保存URL供后续使用
                preview: dataUrl,
                parsedBy: 'Direct'
            };
        } catch (error) {
            throw new Error(`解析图片失败: ${error.message}`);
        }
    },

    // 解析视频文件（上传到COS，不预解析）
    async parseVideo(file) {
        try {
            console.log('开始上传视频:', file.name);

            // 1. 上传视频到腾讯云COS
            const uploadResult = await this.uploadFileToCOS(file);
            console.log('视频上传完成，URL:', uploadResult.url);

            // 2. 生成本地预览URL（用于界面显示）
            const previewUrl = await this.readFileAsURL(file);

            return {
                type: 'video',
                filename: file.name,
                size: file.size,
                url: uploadResult.url,  // 保存COS URL供后续使用
                preview: previewUrl,
                parsedBy: 'Direct'
            };
        } catch (error) {
            console.error('视频上传错误:', error);
            throw new Error(`上传视频失败: ${error.message}`);
        }
    },

    // 解析文档文件（上传到COS，不预解析）- 支持PDF、DOCX、TXT等
    async parseDocumentByUrl(file) {
        try {
            console.log('开始上传文档:', file.name);

            // 1. 上传文档到腾讯云COS
            const uploadResult = await this.uploadFileToCOS(file);
            console.log('文档上传完成，URL:', uploadResult.url);

            return {
                type: 'document',
                extension: this.getFileExtension(file.name),
                filename: file.name,
                size: file.size,
                url: uploadResult.url,  // 保存COS URL供后续使用
                parsedBy: 'Direct'
            };
        } catch (error) {
            console.error('文档上传错误:', error);
            throw new Error(`上传文档失败: ${error.message}`);
        }
    },

    // 解析Excel文件（使用SheetJS）
    async parseExcel(file) {
        try {
            if (typeof XLSX === 'undefined') {
                throw new Error('SheetJS库未加载');
            }

            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });

            let result = '';
            const sheetNames = workbook.SheetNames.slice(0, 3); // 最多解析前3个工作表

            for (const sheetName of sheetNames) {
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                const limitedData = jsonData.slice(0, this.config.maxExcelRows);

                result += `\n--- 工作表: ${sheetName} ---\n`;
                result += limitedData.map(row => row.join('\t')).join('\n');
                result += `\n（共${jsonData.length}行，显示前${limitedData.length}行）\n`;
            }

            return {
                type: 'spreadsheet',
                extension: this.getFileExtension(file.name),
                filename: file.name,
                size: file.size,
                totalSheets: workbook.SheetNames.length,
                parsedSheets: sheetNames.length,
                content: result,
                parsedBy: 'SheetJS'
            };
        } catch (error) {
            throw new Error(`Excel解析失败: ${error.message}`);
        }
    },

    // 主解析函数
    async parseFile(file) {
        if (!file) {
            throw new Error('未提供文件');
        }

        if (!this.isSupported(file.name)) {
            throw new Error(`不支持的文件格式: ${this.getFileExtension(file.name)}`);
        }

        try {
            const ext = this.getFileExtension(file.name);
            const fileType = this.getFileType(ext);

            let result;

            switch (fileType) {
                case 'text':
                    result = await this.parseTextFile(file);
                    break;
                case 'image':
                    result = await this.parseImage(file);
                    break;
                case 'video':
                    result = await this.parseVideo(file);
                    break;
                case 'document':
                    // 使用URL方式（GLM-4.6V原生支持）
                    result = await this.parseDocumentByUrl(file);
                    break;
                case 'spreadsheet':
                    if (ext === 'csv') {
                        // CSV文件：本地解析为文本
                        const content = await this.readTextFile(file);
                        result = await this.parseCSV(content);
                    } else {
                        // Excel文件：使用SheetJS解析
                        result = await this.parseExcel(file);
                    }
                    break;
                default:
                    throw new Error('未知的文件类型');
            }

            return result;
        } catch (error) {
            throw error;
        }
    }
};

// 导出模块
window.FileParserModule = FileParserModule;

// 初始化
FileParserModule.init();

