// 文件分析模块 - 处理文件解析时的加载状态显示
const FenxModule = {
    // 状态
    state: {
        timerInterval: null
    },

    // 开始计时
    startTiming(timerId) {
        if (window.UtilsModule) {
            window.UtilsModule.Timer.start(timerId);
        }
    },

    // 获取分析时长（秒）
    getAnalysisDuration(timerId) {
        if (window.UtilsModule) {
            return window.UtilsModule.Timer.getDuration(timerId);
        }
        return 0;
    },

    // 停止计时
    stopTiming(timerId) {
        let duration = 0;
        if (window.UtilsModule) {
            duration = window.UtilsModule.Timer.stop(timerId);
        }
        if (this.state.timerInterval) {
            clearInterval(this.state.timerInterval);
            this.state.timerInterval = null;
        }
        return duration;
    },

    // 创建多文件上传中的 HTML（带进度和动态计时）
    createMultiFileUploadingHTML(uploadId, fileCount) {
        return `
            <div class="thinking-block">
                <div class="thinking-header">
                    <div class="thinking-header-icon">
                        <div class="spinner"></div>
                    </div>
                    <div class="thinking-header-text">
                        <span id="${uploadId}-progress">正在上传文件（0/${fileCount}）</span>
                        <span id="${uploadId}-timer" style="color: #999; margin-left: 4px;">0秒</span>
                    </div>
                </div>
                <div id="${uploadId}-files" style="margin-top: 8px; font-size: 13px; color: #666;"></div>
            </div>
        `;
    },

    // 创建单文件上传中的 HTML（带动态计时）
    createUploadingHTML(uploadId) {
        return `
            <div class="thinking-block">
                <div class="thinking-header">
                    <div class="thinking-header-icon">
                        <div class="spinner"></div>
                    </div>
                    <div class="thinking-header-text">
                        <span>正在上传文件</span>
                        <span id="${uploadId}-timer" style="color: #999; margin-left: 4px;">0秒</span>
                    </div>
                </div>
            </div>
        `;
    },

    // 创建分析中的 HTML（带动态计时）
    createAnalyzingHTML(analysisId) {
        return `
            <div class="thinking-block">
                <div class="thinking-header">
                    <div class="thinking-header-icon">
                        <div class="spinner"></div>
                    </div>
                    <div class="thinking-header-text">
                        <span>正在分析文件</span>
                        <span id="${analysisId}-timer" style="color: #999; margin-left: 4px;">0秒</span>
                    </div>
                </div>
            </div>
        `;
    },

    // 启动动态计时器
    startTimer(analysisId) {
        const timerElement = document.getElementById(`${analysisId}-timer`);
        if (!timerElement) return;

        this.state.timerInterval = setInterval(() => {
            const duration = this.getAnalysisDuration(analysisId);
            timerElement.textContent = `${duration}秒`;
        }, 1000);
    },

    // 更新多文件上传进度
    updateFileProgress(uploadId, current, total) {
        const progressElement = document.getElementById(`${uploadId}-progress`);
        if (progressElement) {
            progressElement.textContent = `正在上传文件（${current}/${total}）`;
        }
    },

    // 更新文件状态列表
    updateFileStatus(uploadId, fileName, status, message = '') {
        const filesContainer = document.getElementById(`${uploadId}-files`);
        if (!filesContainer) return;

        const fileId = `${uploadId}-file-${fileName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        let fileElement = document.getElementById(fileId);

        if (!fileElement) {
            fileElement = document.createElement('div');
            fileElement.id = fileId;
            fileElement.style.cssText = 'padding: 4px 0; display: flex; align-items: center; gap: 6px;';
            filesContainer.appendChild(fileElement);
        }

        let icon, color, text;
        if (status === 'uploading') {
            icon = '⏳';
            color = '#666';
            text = `${fileName} - 上传中...`;
        } else if (status === 'success') {
            icon = '✓';
            color = '#10b981';
            text = `${fileName} - 已完成`;
        } else if (status === 'error') {
            icon = '✗';
            color = '#ef4444';
            text = `${fileName} - 失败${message ? ': ' + message : ''}`;
        }

        fileElement.innerHTML = `<span style="color: ${color};">${icon}</span> <span style="color: ${color};">${text}</span>`;
    },

    // 清除分析状态
    clearAnalysis() {
        this.stopTiming();
    }
};

// 导出模块
window.FenxModule = FenxModule;
