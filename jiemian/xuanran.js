// 界面渲染模块 - 完全重构版
import { TimeUtil, getTime } from '../gongyong/gongju.js';

let detailCounter = 0;
export const detailDataMap = new Map();

export const AVATAR_SYS = '<div class="avatar avatar-sys">💡</div>';
export const AVATAR_USER = '<div class="avatar avatar-user">🎁</div>';

export const renderMsgTags = tags => tags.length ? `<div class="msg-tags">${tags.map(t => `<span class="msg-tag">${t.name}</span>`).join('')}</div>` : '';

/**
 * 渲染普通消息
 * 注意：结果卡片不再使用此函数包装，而是直接渲染
 */
export function renderMessage(html, type, options = {}) {
  const { tags = [], images = [], files = [] } = options;
  let extra = '';
  if (images.length) extra += `<div class="msg-images">${images.map(img => `<img src="${img}" class="msg-image" onclick="showImagePreview('${img}')">`).join('')}</div>`;
  if (files.length) extra += files.map(f => `<div class="msg-file">${f}</div>`).join('');
  return `${type === 'sys' ? AVATAR_SYS : AVATAR_USER}<div class="msg-content"><div class="bubble">${html}</div>${extra}${type === 'user' ? renderMsgTags(tags) : ''}<div class="timestamp">${getTime()}</div></div>`;
}

/**
 * 渲染结果卡片 - 完全重构版
 * 
 * 设计原则：
 * 1. 不使用 .bubble 包装，直接作为 .msg-content 的子元素
 * 2. 使用 grid 布局，2列显示
 * 3. 没有固定行数，内容自适应
 * 4. 最多显示5个ID + "共N个"
 */
export function renderReport(name, data, activityInfo = {}) {
  const result = data.result || {};
  const success = result.success || [];
  const failed = result.failed || {};
  const totalFailed = Object.values(failed).reduce((sum, ids) => sum + ids.length, 0);
  const { zongshu = '?', yizengsong = 0, dandian = '?', yaodian_tongji = {} } = activityInfo;

  // 存储详情数据
  const detailId = `detail_${++detailCounter}`;
  detailDataMap.set(detailId, { name, data, activityInfo });

  // 合并所有ID（成功在前，失败在后）
  const allIds = [
    ...success.map(id => ({ id, ok: true })),
    ...Object.values(failed).flat().map(id => ({ id, ok: false }))
  ];

  // 渲染单个ID药片
  const renderPill = (id, isSuccess) => {
    const count = yaodian_tongji[id] || 0;
    return `<span class="report-pill ${isSuccess ? 'success' : 'fail'}"><span class="pill-id">${id}</span><span class="pill-count">${count}/${dandian}</span></span>`;
  };

  // 构建内容区域
  // 规则：每行最多2个，最多6个
  // 超过6个时：显示前5个 + "共N个..."
  let bodyContent = '';
  const maxVisible = 6;  // 最多显示6个

  if (allIds.length === 0) {
    bodyContent = '<span class="report-empty">暂无数据</span>';
  } else if (allIds.length <= maxVisible) {
    // 6个及以下：全部显示
    bodyContent = allIds.map(({ id, ok }) => renderPill(id, ok)).join('');
  } else {
    // 超过6个：显示前5个 + "共N个..."
    bodyContent = allIds.slice(0, 5).map(({ id, ok }) => renderPill(id, ok)).join('');
    bodyContent += `<span class="report-pill more">共${allIds.length}个...</span>`;
  }

  // 返回完整卡片HTML（不包含.bubble包装）
  return `<div class="report-card">
<div class="report-header"><span class="report-title">📄 ${name}</span><span class="report-stat success">✓${success.length}</span><span class="report-stat fail">✗${totalFailed}</span><button class="report-btn" onclick="showDetail('${detailId}')">详情</button></div>
<div class="report-body">${bodyContent}</div>
<div class="report-footer"><span>⏱ ${TimeUtil.calcDuration(data.time_start, data.time_finish)}</span><span>库存 ${yizengsong}/${zongshu}</span><span>处理 ${(data.finish_sbid || '-').toUpperCase()}</span></div>
</div>`;
}

/**
 * 渲染详情弹窗内容
 */
export function renderDetailContent(detailId) {
  const detail = detailDataMap.get(detailId);
  if (!detail) return '<p>数据不存在</p>';

  const { data, activityInfo = {} } = detail;
  const result = data.result || {};
  const success = result.success || [];
  const failed = result.failed || {};
  const { zongshu = '?', yizengsong = 0, dandian = '?', yaodian_tongji = {} } = activityInfo;
  const totalFailed = Object.values(failed).reduce((sum, ids) => sum + ids.length, 0);
  const total = success.length + totalFailed;
  const rate = total > 0 ? Math.round((success.length / total) * 100) : 0;

  const pill = (id, ok) => `<span class="detail-pill ${ok ? 'success' : 'fail'}"><span>${id}</span><span class="pill-count">${yaodian_tongji[id] || 0}/${dandian}</span></span>`;

  let html = '';
  if (success.length) {
    html += `<div class="detail-section"><div class="detail-title success">✓ 成功 (${success.length})</div><div class="detail-grid">${success.map(id => pill(id, true)).join('')}</div></div>`;
  }
  if (totalFailed) {
    html += `<div class="detail-section"><div class="detail-title fail">✗ 失败 (${totalFailed})</div>`;
    Object.entries(failed).forEach(([reason, ids]) => {
      html += `<div class="detail-fail-group"><div class="detail-fail-reason">⊘ ${reason} (${ids.length})</div><div class="detail-grid">${ids.map(id => pill(id, false)).join('')}</div></div>`;
    });
    html += '</div>';
  }

  const info = (label, value) => `<div class="detail-info"><div class="detail-info-label">${label}</div><div class="detail-info-value">${value}</div></div>`;
  html += `<div class="detail-section"><div class="detail-title">📊 统计</div><div class="detail-info-grid">
${info('成功率', rate + '%')}${info('耗时', TimeUtil.calcDuration(data.time_start, data.time_finish))}
${info('库存', yizengsong + '/' + zongshu)}${info('限制', dandian + '次/店')}
${info('发起', (data.start_sbid || '-').toUpperCase())}${info('处理', (data.finish_sbid || '-').toUpperCase())}
</div></div>`;
  return html;
}

/**
 * 渲染等待结果提示
 */
export function renderPendingResult(total, done) {
  const remaining = total - done;
  return `<div class="pending-box"><div class="pending-spin"></div><div class="pending-info"><span>正在获取结果${remaining > 1 ? `（剩余${remaining}个）` : ''}...</span><span class="pending-tip">你可以退出稍后查看</span></div></div>`;
}

/**
 * 渲染活动列表
 */
export function renderActivityList(activities, selectedCids = []) {
  if (!activities.length) return '暂无活动';
  return `<div style='margin-bottom:4px'><b>🎁 优惠券活动👇</b></div><div class='activity-list'>${activities.map(({ cid, name, keyword, zongshu, yizengsong, dandian }) => {
    const selected = selectedCids.includes(cid) ? 'selected' : '';
    const remain = Math.max(0, (zongshu || 0) - (yizengsong || 0));
    return `<div class="activity-item ${selected}" data-cid="${cid}" onclick="toggleActivityTag('${name.replace(/'/g, "\\'")}', '${keyword}', '${cid}')"><div class="item-name">${name}</div><div class="item-meta"><span class="stock-num">${remain}</span>/${zongshu || '?'} · 限${dandian || '?'}次</div></div>`;
  }).join('')}</div>`;
}