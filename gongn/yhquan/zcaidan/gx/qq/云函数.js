/**
 * 抢券活动云函数
 * Node.js 16.13
 *
 * 支持的 action:
 * - queryActivity:  根据优惠券ID查询是否已有抢券活动
 * - createActivity: 根据优惠券ID创建抢券活动
 * - getActivity:    根据活动ID获取抢券活动详情
 * - editActivity:   修改抢券活动（名称、上限、时间、对象、商圈等）
 */

'use strict';

const https = require('https');

// ==================== 配置 ====================

const CONFIG = {
    BASE_URL: 'scm.ysbang.cn',
    SUCCESS_CODE: '40001',
    TOKEN: '',
    PROVIDER_ID_M: '',
    COOKIES: {},
    UA: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    UA_PARAM: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Chrome 120'
};

// ==================== 工具函数 ====================

function buildCookieHeader() {
    if (!CONFIG.COOKIES || Object.keys(CONFIG.COOKIES).length === 0) return '';
    return Object.entries(CONFIG.COOKIES).map(([k, v]) => `${k}=${v}`).join('; ');
}

function makeResponse(success, message, data, statusCode = 200) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ success, message, data })
    };
}

// SCM Promotion 公共参数
function getScmCommonParams(ex = 'CouponActivity') {
    const now = new Date();
    return {
        token: CONFIG.TOKEN,
        platform: 'scm-admin',
        version: '1.0.3',
        ua: CONFIG.UA_PARAM,
        ex: ex,
        lastBuildTime: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    };
}

// 通用HTTPS请求
function request(path, postData, extraHeaders = {}, timeout = 30000) {
    return new Promise((resolve) => {
        const headers = {
            'Content-Type': 'application/json;charset=UTF-8',
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': CONFIG.UA,
            'Referer': 'https://scm.ysbang.cn/web-scm-admin/web/index.html',
            ...extraHeaders
        };

        const cookieHeader = buildCookieHeader();
        if (cookieHeader) headers['Cookie'] = cookieHeader;
        if (postData) headers['Content-Length'] = Buffer.byteLength(postData);

        const req = https.request({
            hostname: CONFIG.BASE_URL,
            port: 443,
            path: path,
            method: 'POST',
            headers: headers
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { resolve({ code: 'ERROR', message: '解析响应失败', raw: data.substring(0, 200) }); }
            });
        });

        req.on('error', (e) => resolve({ code: 'ERROR', message: e.message }));
        req.setTimeout(timeout, () => { req.destroy(); resolve({ code: 'ERROR', message: '请求超时' }); });
        if (postData) req.write(postData);
        req.end();
    });
}

// SCM Promotion 请求（需要 providerIdM header）
function scmRequest(path, bodyObj, ex) {
    const payload = { ...bodyObj, ...getScmCommonParams(ex) };
    return request(path, JSON.stringify(payload), { 'providerIdM': CONFIG.PROVIDER_ID_M });
}

// ==================== 业务功能 ====================

/**
 * 查询优惠券是否已有抢券活动
 */
async function queryActivity(params) {
    const couponTypeId = params.couponTypeId;
    if (!couponTypeId) return { success: false, message: '缺少 couponTypeId' };

    const result = await scmRequest('/scm-promotion/admin/coupon/couponQq', {
        chooseDay: '',
        title: '',
        couponId: String(couponTypeId),
        activityId: '',
        pageNo: 1,
        pageSize: 10
    }, 'CouponActivity');

    if (result.code !== CONFIG.SUCCESS_CODE) {
        return { success: false, message: result.message || '查询活动失败' };
    }

    const results = result.data?.results || [];
    // 查找该优惠券关联的活动（优先未关闭的，fallback到已关闭的）
    const activity = results.find(a =>
        String(a.coupontypeId) === String(couponTypeId) && a.isClose === 0
    ) || results.find(a =>
        String(a.coupontypeId) === String(couponTypeId)
    );

    if (activity) {
        return { success: true, message: '找到已有活动', data: { activityId: activity.id } };
    }
    return { success: true, message: '未找到活动', data: null };
}

/**
 * 查询优惠券的所有抢券活动
 */
async function queryAllActivities(params) {
    const couponTypeId = params.couponTypeId;
    if (!couponTypeId) return { success: false, message: '缺少 couponTypeId' };

    const result = await scmRequest('/scm-promotion/admin/coupon/couponQq', {
        chooseDay: '',
        title: '',
        couponId: String(couponTypeId),
        activityId: '',
        pageNo: 1,
        pageSize: 50
    }, 'CouponActivity');

    if (result.code !== CONFIG.SUCCESS_CODE) {
        return { success: false, message: result.message || '查询活动失败' };
    }

    const results = result.data?.results || [];
    const activities = results
        .filter(a => String(a.coupontypeId) === String(couponTypeId))
        .map(a => ({
            id: a.id,
            eventName: a.eventName || '',
            isClose: a.isClose
        }));

    return { success: true, message: `找到 ${activities.length} 个活动`, data: activities };
}

/**
 * 创建抢券活动
 */
async function createActivity(params) {
    const required = ['eventName', 'couponTypeId', 'couponNum', 'couponAmount'];
    for (const field of required) {
        if (params[field] === undefined) {
            return { success: false, message: `缺少必填参数: ${field}` };
        }
    }

    const result = await scmRequest('/scm-promotion/admin/coupon/addCouponQq', {
        eventName: params.eventName,
        couponTypeId: params.couponTypeId,
        couponNum: params.couponNum,
        couponAmount: params.couponAmount,
        tagBeginTimeDate: params.tagBeginTimeDate,
        tagBeginTimeHms: params.tagBeginTimeHms || '00:00:00',
        beginTimeDate: params.beginTimeDate,
        beginTimeHms: params.beginTimeHms || '00:00:00',
        endTimeDate: params.endTimeDate,
        endTimeHms: params.endTimeHms || '23:59:59',
        isLimitArea: params.isLimitArea || 0,
        storeSubTypes: params.storeSubTypes || [-1],
        selectedAreaIds: params.selectedAreaIds || []
    }, 'SnatchingCouponActivityDetail');

    if (result.code === CONFIG.SUCCESS_CODE) {
        return { success: true, message: result.message || '创建成功', data: result.data };
    }
    return { success: false, message: result.message || '创建活动失败' };
}

/**
 * 获取抢券活动详情
 */
async function getActivity(params) {
    const id = params.id;
    if (!id) return { success: false, message: '缺少活动ID: id' };

    const result = await scmRequest('/scm-promotion/admin/coupon/getCouponQq', {
        id: id
    }, 'EditSnatchingCouponActivityDetail');

    if (result.code !== CONFIG.SUCCESS_CODE) {
        return { success: false, message: result.message || '获取活动详情失败' };
    }

    const info = result.data?.info || {};
    return {
        success: true,
        message: '获取成功',
        data: {
            id: info.id,
            eventName: info.eventName,
            couponTypeId: result.data?.couponTypeId,
            couponNum: result.data?.couponNum,
            couponAmount: result.data?.couponAmount,
            isClose: info.isClose,
            storeSubtypes: info.storeSubtypes,
            isLimitArea: info.isLimitArea,
            beginTimeDate: info.beginTimeDate,
            beginTimeHms: info.beginTimeHms,
            endTimeDate: info.endTimeDate,
            endTimeHms: info.endTimeHms,
            tagBeginTime: info.tagBeginTime
        }
    };
}

/**
 * 修改抢券活动
 */
async function editActivity(params) {
    const id = params.id;
    if (!id) return { success: false, message: '缺少活动ID: id' };

    const result = await scmRequest('/scm-promotion/admin/coupon/editCouponQq', {
        id: id,
        eventName: params.eventName,
        couponTypeId: params.couponTypeId,
        couponNum: params.couponNum,
        couponAmount: params.couponAmount,
        tagBeginTimeDate: params.tagBeginTimeDate,
        tagBeginTimeHms: params.tagBeginTimeHms || '00:00:00',
        beginTimeDate: params.beginTimeDate,
        beginTimeHms: params.beginTimeHms || '00:00:00',
        endTimeDate: params.endTimeDate,
        endTimeHms: params.endTimeHms || '23:59:59',
        isLimitArea: params.isLimitArea || 0,
        storeSubTypes: params.storeSubTypes || [-1],
        selectedAreaIds: params.selectedAreaIds || [],
        deselectedAreaIds: params.deselectedAreaIds || []
    }, 'EditSnatchingCouponActivityDetail');

    if (result.code === CONFIG.SUCCESS_CODE) {
        return { success: true, message: result.message || '修改成功', data: result.data };
    }
    return { success: false, message: result.message || '修改活动失败' };
}

/**
 * 禁用或启用抢券活动
 */
async function disableActivity(params) {
    const id = params.id;
    if (!id) return { success: false, message: '缺少活动ID: id' };

    const result = await scmRequest('/scm-promotion/admin/coupon/closeReceiveCouponActivity', {
        id: id,
        isClose: params.isClose !== undefined ? params.isClose : 1,
        type: 9,
        storeSubTypes: params.storeSubTypes || [-1]
    }, 'CouponActivity');

    if (result.code === CONFIG.SUCCESS_CODE) {
        return { success: true, message: result.message || '操作成功', data: result.data };
    }
    return { success: false, message: result.message || '禁用/启用活动失败' };
}

/**
 * 获取区域树数据（省/市/区/县/镇）
 */
async function getAreaTree(params) {
    const parent = params.parent || '#';
    const result = await scmRequest('/scm-promotion/admin/coupon/getCouponActivityAreaTreeData', {
        parent: parent,
        id: params.id || undefined,
        includeAreaIds: params.includeAreaIds || []
    }, 'EditSnatchingCouponActivityDetail');

    if (result.code === CONFIG.SUCCESS_CODE) {
        return { success: true, message: '获取成功', data: result.data };
    }
    return { success: false, message: result.message || '获取区域数据失败' };
}

/**
 * 删除抢券活动
 */
async function deleteActivity(params) {
    const id = params.id;
    if (!id) return { success: false, message: '缺少活动ID: id' };

    const result = await scmRequest('/scm-promotion/admin/coupon/delReceiveCouponActivity', {
        id: id
    }, 'CouponActivity');

    if (result.code === CONFIG.SUCCESS_CODE) {
        return { success: true, message: result.message || '删除成功', data: result.data };
    }
    return { success: false, message: result.message || '删除活动失败' };
}

// ==================== 云函数入口 ====================

exports.main_handler = async (event, context) => {
    try {
        // 解析请求参数
        let params = {};
        if (event.body) {
            try {
                params = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
            } catch (e) {
                params = event.queryString || {};
            }
        } else {
            params = event.queryString || event;
        }

        // 获取认证信息
        if (params.credentials && typeof params.credentials === 'object') {
            const creds = params.credentials;
            if (creds.token) CONFIG.TOKEN = creds.token;
            if (creds.provider_id_m) CONFIG.PROVIDER_ID_M = creds.provider_id_m;
            if (creds.cookies && typeof creds.cookies === 'object') {
                CONFIG.COOKIES = creds.cookies;
            }
        }

        if (!CONFIG.TOKEN) {
            return makeResponse(false, '缺少认证信息：token 必填', null, 400);
        }

        const action = params.action || '';

        let result;
        switch (action) {
            case 'queryActivity':
                result = await queryActivity(params);
                break;
            case 'queryAllActivities':
                result = await queryAllActivities(params);
                break;
            case 'createActivity':
                result = await createActivity(params);
                break;
            case 'getActivity':
                result = await getActivity(params);
                break;
            case 'editActivity':
                result = await editActivity(params);
                break;
            case 'disableActivity':
                result = await disableActivity(params);
                break;
            case 'deleteActivity':
                result = await deleteActivity(params);
                break;
            case 'getAreaTree':
                result = await getAreaTree(params);
                break;
            default:
                return makeResponse(false, `未知的 action: ${action}`, null, 400);
        }
        return makeResponse(result.success, result.message, result.data || null);
    } catch (error) {
        console.error('Error:', error);
        return makeResponse(false, error.message || '执行失败', null, 500);
    }
};
