/**
 * Device fingerprint module.
 *
 * Generates a 6-character hardware-oriented fingerprint code.
 */
const ShebeiZhiwenModule = {
    async _sha256Bytes(str) {
        const buf = new TextEncoder().encode(str);
        const hash = await crypto.subtle.digest('SHA-256', buf);
        return new Uint8Array(hash);
    },

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

    _getAudioSampleRate() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const rate = ctx.sampleRate;
            ctx.close();
            return rate;
        } catch (e) {
            return '';
        }
    },

    _collectSignals() {
        const gl = this._getWebGL();
        const gl2 = this._getWebGL2();
        const intl = Intl.DateTimeFormat().resolvedOptions();

        return {
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
            gpu_vertexHighFloat: gl.vertexHighFloat,
            gpu_vertexHighInt: gl.vertexHighInt,
            gpu_fragHighFloat: gl.fragHighFloat,
            gpu_fragHighInt: gl.fragHighInt,
            gpu_combinedTexUnits: gl.combinedTexUnits,
            gpu_vertexTexUnits: gl.vertexTexUnits,
            gpu_texUnits: gl.texUnits,
            gl2_max3dTex: gl2?.max3dTexture ?? '',
            gl2_maxArrayLayers: gl2?.maxArrayTexLayers ?? '',
            gl2_maxDrawBuffers: gl2?.maxDrawBuffers ?? '',
            gl2_maxColorAttach: gl2?.maxColorAttachments ?? '',
            gl2_maxSamples: gl2?.maxSamples ?? '',
            gl2_maxUniformBlock: gl2?.maxUniformBlockSize ?? '',
            gl2_maxElementIdx: gl2?.maxElementIndex ?? '',
            gl2_maxTransformFB: gl2?.maxTransformFeedback ?? '',
            screen_w: screen.width,
            screen_h: screen.height,
            pixel_ratio: window.devicePixelRatio,
            color_depth: screen.colorDepth,
            cpu_cores: navigator.hardwareConcurrency || 0,
            touch_points: navigator.maxTouchPoints,
            language: navigator.language,
            audioSampleRate: this._getAudioSampleRate(),
            intlLocale: intl.locale,
            intlNumbering: intl.numberingSystem || '',
            intlCalendar: intl.calendar || ''
        };
    },

    async getFingerprint() {
        const signals = this._collectSignals();
        const source = Object.values(signals).join('|');
        const bytes = await this._sha256Bytes(source);
        const folded = new Uint8Array(3);

        for (let i = 0; i < 32; i++) {
            folded[i % 3] ^= bytes[i];
        }

        return Array.from(folded)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
    },

    async getFullHash() {
        const signals = this._collectSignals();
        const source = Object.values(signals).join('|');
        const bytes = await this._sha256Bytes(source);
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }
};

window.ShebeiZhiwenModule = ShebeiZhiwenModule;
