// 界面渲染模块
import { TimeUtil, getTime } from '../gongyong/gongju.js';

// 详情数据存储
let detailCounter = 0;
export const detailDataMap = new Map();

// 头像常量
export const AVATAR_SYS = '<div class="avatar avatar-sys">Le</div>';
export const AVATAR_USER = '<div class="avatar avatar-user">👤</div>';

// 渲染消息标签
export const renderMsgTags = tags => tags.length > 0 ?
  `<div class="msg-tags">${tags.map(t => `<span class="msg-tag">${t.name}</span>`).join('')}</div>` : '';

// 渲染消息
export function renderMessage(html, type, options = {}) {
  const { tags = [], images = [], files = [] } = options;

  let extraHtml = '';
  if (images.length) {
    extraHtml += `<div class="msg-images">${images.map(img =>
      `<img src="${img}" class="msg-image" onclick="showImagePreview('${img}')">`
    ).join('')}</div>`;
  }
  if (files.length) {
    extraHtml += files.map(f => `<div class="msg-file">${f}</div>`).join('');
  }

  return `
    ${type === 'sys' ? AVATAR_SYS : AVATAR_USER}
    <div class="msg-content">
      <div class="bubble">${html}</div>
      ${extraHtml}
      ${type === 'user' ? renderMsgTags(tags) : ''}
      <div class="timestamp">${getTime()}</div>
    </div>
  `;
}

// 渲染报告
export function renderReport(name, data, activityInfo = {}) {
  const result = data.result || {};
  const success = result.success || [];
  const failed = result.failed || {};
  const totalFailed = Object.values(failed).reduce((sum, ids) => sum + ids.length, 0);
  const totalIds = success.length + totalFailed;

  const { zongshu = '?', yizengsong = 0, dandian = '?', yaodian_tongji = {} } = activityInfo;

  const detailId = `detail_${++detailCounter}`;
  detailDataMap.set(detailId, { name, data, activityInfo });

  const finishSbid = (data.finish_sbid || '-').toUpperCase();
  const duration = TimeUtil.calcDuration(data.time_start, data.time_finish);

  const renderIdPill = (id, isSuccess) => {
    const count = yaodian_tongji[id] || 0;
    return `<span class="id-pill ${isSuccess ? 'success' : 'fail'}">
      <span class="id-text">${id}</span>
      <span class="id-count">${count}/${dandian}</span>
    </span>`;
  };

  const allIds = [
    ...success.map(id => ({ id, isSuccess: true })),
    ...Object.values(failed).flat().map(id => ({ id, isSuccess: false }))
  ];

  const bodyClass = allIds.length <= 3 ? 'report-body few-items' : 'report-body';

  let idPillsHtml = '';
  if (allIds.length === 0) {
    idPillsHtml = '<span class="no-data">暂无数据</span>';
  } else if (allIds.length <= 6) {
    idPillsHtml = allIds.map(({ id, isSuccess }) => renderIdPill(id, isSuccess)).join('');
  } else {
    idPillsHtml = allIds.slice(0, 5).map(({ id, isSuccess }) => renderIdPill(id, isSuccess)).join('');
    idPillsHtml += `<span class="id-pill more">等共${totalIds}个...</span>`;
  }

  return `
    <div class="audit-report">
      <div class="report-header">
        <span class="report-title">📄 ${name}</span>
        <span class="stat-pill success">✓${success.length}</span>
        <span class="stat-pill fail">✗${totalFailed}</span>
        <button class="detail-btn" onclick="showDetail('${detailId}')">详情</button>
      </div>
      <div class="${bodyClass}">${idPillsHtml}</div>
      <div class="report-footer">
        <span class="footer-item"><span class="footer-label">⏱</span>${duration}</span>
        <span class="footer-item"><span class="footer-label">库存</span>${yizengsong}/${zongshu}</span>
        <span class="footer-item"><span class="footer-label">处理</span>${finishSbid}</span>
      </div>
    </div>
  `;
}

// 渲染详情内容
export function renderDetailContent(detailId) {
  const detail = detailDataMap.get(detailId);
  if (!detail) return '<p>数据不存在</p>';

  const { name, data, activityInfo = {} } = detail;
  const result = data.result || {};
  const success = result.success || [];
  const failed = result.failed || {};
  const { zongshu = '?', yizengsong = 0, dandian = '?', yaodian_tongji = {} } = activityInfo;

  const totalFailed = Object.values(failed).reduce((sum, ids) => sum + ids.length, 0);
  const total = success.length + totalFailed;
  const rate = total > 0 ? Math.round((success.length / total) * 100) : 0;
  const duration = TimeUtil.calcDuration(data.time_start, data.time_finish);

  const successHtml = success.length > 0 ? `
    <div class="detail-section">
      <div class="detail-section-title success">✓ 成功 (${success.length})</div>
      <div class="detail-id-grid">
        ${success.map(id => `<span class="detail-id-pill success"><span>${id}</span><span class="pill-count">${yaodian_tongji[id] || 0}/${dandian}</span></span>`).join('')}
      </div>
    </div>
  ` : '';

  let failHtml = '';
  if (totalFailed > 0) {
    failHtml = `<div class="detail-section"><div class="detail-section-title fail">✗ 失败 (${totalFailed})</div>`;
    Object.entries(failed).forEach(([reason, ids]) => {
      failHtml += `<div class="fail-group"><div class="fail-reason">⊘ ${reason} (${ids.length})</div>
        <div class="detail-id-grid">${ids.map(id => `<span class="detail-id-pill fail"><span>${id}</span><span class="pill-count">${yaodian_tongji[id] || 0}/${dandian}</span></span>`).join('')}</div></div>`;
    });
    failHtml += '</div>';
  }

  return successHtml + failHtml + `
    <div class="detail-section">
      <div class="detail-section-title">📊 统计</div>
      <div class="detail-info-grid">
        <div class="detail-info-item"><div class="detail-info-label">成功率</div><div class="detail-info-value">${rate}%</div></div>
        <div class="detail-info-item"><div class="detail-info-label">耗时</div><div class="detail-info-value">${duration}</div></div>
        <div class="detail-info-item"><div class="detail-info-label">库存</div><div class="detail-info-value">${yizengsong}/${zongshu}</div></div>
        <div class="detail-info-item"><div class="detail-info-label">限制</div><div class="detail-info-value">${dandian}次/店</div></div>
        <div class="detail-info-item"><div class="detail-info-label">发起</div><div class="detail-info-value">${(data.start_sbid || '-').toUpperCase()}</div></div>
        <div class="detail-info-item"><div class="detail-info-label">处理</div><div class="detail-info-value">${(data.finish_sbid || '-').toUpperCase()}</div></div>
      </div>
    </div>
  `;
}

// 渲染等待结果提示
export function renderPendingResult(total, done) {
  const remaining = total - done;
  return `
    <div class="pending-result">
      <div class="pending-spinner"></div>
      <div class="pending-text">
        <span>正在获取结果${remaining > 1 ? `（剩余${remaining}个）` : ''}...</span>
        <span class="pending-hint">你可以退出稍后查看</span>
      </div>
    </div>
  `;
}

// 渲染活动列表
export function renderActivityList(activities, selectedCids = []) {
  if (activities.length === 0) return '暂无活动';

  let html = "<div style='margin-bottom:6px'><b>🎁 优惠券活动：</b></div><div class='activity-grid'>";
  activities.forEach(({ cid, name, keyword, zongshu, yizengsong, dandian }) => {
    const selected = selectedCids.includes(cid) ? 'selected' : '';
    const remain = Math.max(0, (zongshu || 0) - (yizengsong || 0));
    html += `<div class="activity-card ${selected}" onclick="addActivityTag('${name}', '${keyword}', '${cid}')">
      <div class="card-title">${name}</div>
      <div class="card-info">
        <span class="stock-info"><span class="remain">${remain}</span>/<span class="total">${zongshu || '?'}</span></span>
        <span class="limit-tag">限${dandian || '?'}次</span>
      </div>
    </div>`;
  });
  return html + '</div>';
}
