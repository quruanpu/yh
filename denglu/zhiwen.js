/**
 * 设备指纹模块 - 基于硬件级信号的跨浏览器设备识别
 *
 * 采集37个设备级信号（GPU参数、屏幕、系统等），
 * 通过SHA-256计算生成6位十六进制指纹码。
 */
const ZhiwenModule = {

    // ========== SHA-256（返回原始字节） ==========
    async _sha256Bytes(str) {
        const buf = new TextEncoder().encode(str);
        const hash = await crypto.subtle.digest('SHA-256', buf);
        return new Uint8Array(hash);
    },

    // ========== WebGL 硬件信息 ==========
    _getWebGL() {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return {};
        const ext = gl.getExtension('WEBGL_debug_renderer_info');

        function prec(shaderType, precisionType) {
            const p = gl.getShaderPrecisionFormat(shaderType, precisionType);
            return p ? `${p.rangeMin},${p.rangeMax},${p.precision}` : '';
        }

        return {
            vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : '',
            renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '',
            maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
            maxViewport: gl.getParameter(gl.MAX_VIEWPORT_DIMS)?.join('x'),
            maxRenderbuffer: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
            maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
            maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS),
            maxFragUniforms: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
            maxVertexUniforms: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
            aliasedLineRange: gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE)?.join('-'),
            aliasedPointRange: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)?.join('-'),
            maxAnisotropy: (() => {
                const e = gl.getExtension('EXT_texture_filter_anisotropic');
                return e ? gl.getParameter(e.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : '';
            })(),
            vertexHighFloat: prec(gl.VERTEX_SHADER, gl.HIGH_FLOAT),
            vertexHighInt: prec(gl.VERTEX_SHADER, gl.HIGH_INT),
            fragHighFloat: prec(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT),
            fragHighInt: prec(gl.FRAGMENT_SHADER, gl.HIGH_INT),
            combinedTexUnits: gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
            vertexTexUnits: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
            texUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)
        };
    },

    // ========== WebGL2 额外硬件参数 ==========
    _getWebGL2() {
        const canvas = document.createElement('canvas');
        const gl2 = canvas.getContext('webgl2');
        if (!gl2) return null;
        return {
            max3dTexture: gl2.getParameter(gl2.MAX_3D_TEXTURE_SIZE),
            maxArrayTexLayers: gl2.getParameter(gl2.MAX_ARRAY_TEXTURE_LAYERS),
            maxDrawBuffers: gl2.getParameter(gl2.MAX_DRAW_BUFFERS),
            maxColorAttachments: gl2.getParameter(gl2.MAX_COLOR_ATTACHMENTS),
            maxSamples: gl2.getParameter(gl2.MAX_SAMPLES),
            maxUniformBlockSize: gl2.getParameter(gl2.MAX_UNIFORM_BLOCK_SIZE),
            maxElementIndex: gl2.getParameter(gl2.MAX_ELEMENT_INDEX),
            maxTransformFeedback: gl2.getParameter(gl2.MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS)
        };
    },

    // ========== 音频硬件采样率 ==========
    _getAudioSampleRate() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const rate = ctx.sampleRate;
            ctx.close();
            return rate;
        } catch (e) { return ''; }
    },

    // ========== 采集37个核心信号 ==========
    _collectSignals() {
        const gl = this._getWebGL();
        const gl2 = this._getWebGL2();
        const intl = Intl.DateTimeFormat().resolvedOptions();

        return {
            // GPU基础参数 (12)
            gpu_renderer: gl.renderer || '',
            gpu_vendor: gl.vendor || '',
            gpu_maxTexture: gl.maxTextureSize,
            gpu_maxViewport: gl.maxViewport,
            gpu_maxRenderbuffer: gl.maxRenderbuffer,
            gpu_maxAnisotropy: gl.maxAnisotropy,
            gpu_maxVertexAttribs: gl.maxVertexAttribs,
            gpu_maxVaryingVectors: gl.maxVaryingVectors,
            gpu_maxFragUniforms: gl.maxFragUniforms,
            gpu_maxVertexUniforms: gl.maxVertexUniforms,
            gpu_aliasedLine: gl.aliasedLineRange,
            gpu_aliasedPoint: gl.aliasedPointRange,
            // GPU Shader精度 (4)
            gpu_vertexHighFloat: gl.vertexHighFloat,
            gpu_vertexHighInt: gl.vertexHighInt,
            gpu_fragHighFloat: gl.fragHighFloat,
            gpu_fragHighInt: gl.fragHighInt,
            // GPU纹理单元 (3)
            gpu_combinedTexUnits: gl.combinedTexUnits,
            gpu_vertexTexUnits: gl.vertexTexUnits,
            gpu_texUnits: gl.texUnits,
            // WebGL2额外参数 (8)
            gl2_max3dTex: gl2?.max3dTexture ?? '',
            gl2_maxArrayLayers: gl2?.maxArrayTexLayers ?? '',
            gl2_maxDrawBuffers: gl2?.maxDrawBuffers ?? '',
            gl2_maxColorAttach: gl2?.maxColorAttachments ?? '',
            gl2_maxSamples: gl2?.maxSamples ?? '',
            gl2_maxUniformBlock: gl2?.maxUniformBlockSize ?? '',
            gl2_maxElementIdx: gl2?.maxElementIndex ?? '',
            gl2_maxTransformFB: gl2?.maxTransformFeedback ?? '',
            // 屏幕+硬件 (5)
            screen_w: screen.width,
            screen_h: screen.height,
            pixel_ratio: window.devicePixelRatio,
            color_depth: screen.colorDepth,
            cpu_cores: navigator.hardwareConcurrency || 0,
            touch_points: navigator.maxTouchPoints,
            // 系统级信号 (5)
            language: navigator.language,
            audioSampleRate: this._getAudioSampleRate(),
            intlLocale: intl.locale,
            intlNumbering: intl.numberingSystem || '',
            intlCalendar: intl.calendar || ''
        };
    },

    /**
     * 生成6位设备指纹码
     * 算法：SHA-256产生32字节 → XOR折叠压缩为3字节 → 6位大写十六进制
     * 每个输出字节 = 所有位置 i%3 相同的输入字节异或，32字节全部参与运算
     * @returns {Promise<string>} 6位大写十六进制指纹码，如 "A3F2B1"
     */
    async getFingerprint() {
        const signals = this._collectSignals();
        const source = Object.values(signals).join('|');
        const bytes = await this._sha256Bytes(source); // 32字节

        // XOR折叠：32字节 → 3字节（每个输出字节由10~11个输入字节异或而成）
        const folded = new Uint8Array(3);
        for (let i = 0; i < 32; i++) {
            folded[i % 3] ^= bytes[i];
        }

        return Array.from(folded).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    },

    /**
     * 获取完整SHA-256哈希（调试用）
     * @returns {Promise<string>} 64位十六进制哈希
     */
    async getFullHash() {
        const signals = this._collectSignals();
        const source = Object.values(signals).join('|');
        const bytes = await this._sha256Bytes(source);
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }
};

window.ZhiwenModule = ZhiwenModule;
