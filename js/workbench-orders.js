/**
 * V14.3 PRO - 订单看板模块 (V5 Medical 10节点生命周期版)
 * 负责订单管理、看板状态控制、快速添加、项目进度追踪
 * @namespace WorkbenchOrders
 * @version 1.5.0 - 2026-08-29
 */
const WorkbenchOrders = (() => {
    'use strict';

    // ========================== V5 10节点生命周期定义 ==========================
    /** 订单生命周期状态枚举 */
    const KANBAN_STATUS = {
        INQUIRY:     'inquiry',      // 1-新询盘
        QUOTE:       'quote',        // 2-报价中
        PI_SENT:     'pi_sent',      // 3-PI已发
        PREPAID:     'prepaid',      // 4-预付到账
        PRODUCTION:  'production',   // 5-生产中
        QC:          'qc',           // 6-质检
        SHIPPING:    'shipping',     // 7-物流安排
        SHIPPED:     'shipped',      // 8-已发货
        FINAL_PAY:   'final_pay',    // 9-尾款结清
        COMPLETED:   'completed'     // 10-结案归档
    };

    /** 看板列配置 (与HTML ID严格匹配) */
    const KANBAN_COLUMNS = {
        [KANBAN_STATUS.INQUIRY]:    { id: 'kanban-inquiry',    countId: 'count-inquiry',    label: '1-新询盘',   color: 'blue',   icon: 'fa-search' },
        [KANBAN_STATUS.QUOTE]:      { id: 'kanban-quote',      countId: 'count-quote',      label: '2-报价中',   color: 'indigo', icon: 'fa-file-invoice-dollar' },
        [KANBAN_STATUS.PI_SENT]:    { id: 'kanban-pi_sent',    countId: 'count-pi_sent',    label: '3-PI已发',   color: 'amber',  icon: 'fa-file-signature' },
        [KANBAN_STATUS.PREPAID]:    { id: 'kanban-prepaid',    countId: 'count-prepaid',    label: '4-预付到账', color: 'emerald',icon: 'fa-money-bill-wave' },
        [KANBAN_STATUS.PRODUCTION]: { id: 'kanban-production', countId: 'count-production', label: '5-生产中',   color: 'purple', icon: 'fa-industry' },
        [KANBAN_STATUS.QC]:         { id: 'kanban-qc',         countId: 'count-qc',         label: '6-质检',     color: 'orange', icon: 'fa-check-double' },
        [KANBAN_STATUS.SHIPPING]:   { id: 'kanban-shipping',   countId: 'count-shipping',   label: '7-物流安排', color: 'teal',   icon: 'fa-truck-loading' },
        [KANBAN_STATUS.SHIPPED]:    { id: 'kanban-shipped',    countId: 'count-shipped',    label: '8-已发货',   color: 'cyan',   icon: 'fa-shipping-fast' },
        [KANBAN_STATUS.FINAL_PAY]:  { id: 'kanban-final_pay',  countId: 'count-final_pay',  label: '9-尾款结清', color: 'lime',   icon: 'fa-coins' },
        [KANBAN_STATUS.COMPLETED]:  { id: 'kanban-completed',  countId: 'count-completed',  label: '10-结案',    color: 'green',  icon: 'fa-check-circle' }
    };

    /** 状态流转顺序 (左右箭头用) */
    const STATUS_FLOW = Object.values(KANBAN_STATUS);

    /** 卡片边框颜色映射 */
    const STATUS_BORDER_COLORS = {
        inquiry:    'border-l-blue-500',
        quote:      'border-l-indigo-500',
        pi_sent:    'border-l-amber-500',
        prepaid:    'border-l-emerald-500',
        production: 'border-l-purple-500',
        qc:         'border-l-orange-500',
        shipping:   'border-l-teal-500',
        shipped:    'border-l-cyan-500',
        final_pay:  'border-l-lime-500',
        completed:  'border-l-green-500'
    };

    /** 风险等级样式 */
    const RISK_STYLES = {
        'low':    { bg: 'bg-green-100', text: 'text-green-700', label: '🟢 正常' },
        'medium': { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '🟡 预警' },
        'high':   { bg: 'bg-red-100', text: 'text-red-700', label: '🔴 紧急' }
    };

    /** 货币符号 */
    const CURRENCY_SYMBOLS = { 'USD': '$', 'CNY': '¥', 'EUR': '€', 'GBP': '£', 'PHP': '₱', 'TRY': '₺' };

    // ========================== 数据兼容：旧5状态→新10状态 ==========================
    const LEGACY_STATUS_MAP = {
        'inquiry':    'inquiry',
        'pi':         'pi_sent',
        'production': 'production',
        'shipped':    'shipped',
        'paid':       'completed',
        'new':        'inquiry',
        'processing': 'production',
        'completed':  'completed'
    };

    /**
     * 兼容旧数据：将订单状态映射到新的10状态
     * @param {Object} order - 订单对象
     * @returns {Object} 更新后的订单对象
     */
    function migrateOrderStatus(order) {
        if (order && order.status && LEGACY_STATUS_MAP[order.status]) {
            order.status = LEGACY_STATUS_MAP[order.status];
        }
        // 补全新字段默认值
        if (order) {
            order.totalAmount = order.totalAmount || order.amount || 0;
            order.amountReceived = order.amountReceived || 0;
            order.currency = order.currency || 'USD';
            order.riskLevel = order.riskLevel || 'low';
            order.destination = order.destination || '';
            order.responsible = order.responsible || '';
            order.remark = order.remark || '';
            order.milestones = order.milestones || [];
        }
        return order;
    }

    // ========================== 工具函数 ==========================
    function escapeHtml(str) {
        if (!str || typeof str !== 'string') return '';
        if (window.WorkbenchUtils?.escapeHtml) return WorkbenchUtils.escapeHtml(str);
        return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
    }

    function formatDate(d) {
        if (!d) return '-';
        try {
            const date = typeof d === 'string' ? new Date(d) : d;
            if (isNaN(date.getTime())) return '-';
            return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
        } catch { return '-'; }
    }

    function generateId(prefix = 'ORD') {
        return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    }

    /** 计算付款进度百分比 */
    function calcPaymentProgress(total, received) {
        if (!total || total <= 0) return 0;
        return Math.min(100, Math.round((received / total) * 100));
    }

    /** 生成付款进度条HTML */
    function progressBarHTML(total, received) {
        const pct = calcPaymentProgress(total, received);
        const color = pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-300';
        return `
            <div class="flex items-center gap-1.5">
                <div class="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div class="${color} h-full rounded-full transition-all" style="width:${pct}%"></div>
                </div>
                <span class="text-[10px] text-slate-500 font-mono">${pct}%</span>
            </div>
        `;
    }

    // ========================== 卡片渲染 ==========================
    /**
     * 生成增强版订单卡片HTML
     * @param {Object} order - 订单数据
     * @returns {string} HTML
     */
    function renderOrderCard(order) {
        const col = KANBAN_COLUMNS[order.status] || KANBAN_COLUMNS.inquiry;
        const borderColor = STATUS_BORDER_COLORS[order.status] || 'border-l-slate-500';
        const symbol = CURRENCY_SYMBOLS[order.currency] || '$';
        const risk = RISK_STYLES[order.riskLevel] || RISK_STYLES.low;
        const pct = calcPaymentProgress(order.totalAmount, order.amountReceived);
        const currentIdx = STATUS_FLOW.indexOf(order.status);
        const milestoneCount = currentIdx + 1;

        // 10节点进度条 (小圆点)
        const dotsHTML = STATUS_FLOW.map((_, i) => {
            const done = i < milestoneCount;
            const active = i === currentIdx;
            return `<div class="w-1.5 h-1.5 rounded-full ${active ? 'bg-blue-500 ring-2 ring-blue-200' : done ? 'bg-green-400' : 'bg-slate-300'}"></div>`;
        }).join('');

        return `
            <div class="bg-white rounded-lg border border-slate-200 ${borderColor} border-l-4 p-3 shadow-sm hover:shadow-lg transition-all cursor-pointer group"
                 onclick="showEditOrderModal('${order.id}')" data-order-id="${order.id}">
                <!-- 标题行 -->
                <div class="flex justify-between items-start mb-1.5">
                    <span class="font-semibold text-slate-800 text-sm truncate flex-1">${escapeHtml(order.title || order.customer)}</span>
                    ${order.riskLevel !== 'low' ? `<span class="${risk.bg} ${risk.text} text-[10px] px-1.5 py-0.5 rounded-full ml-1 whitespace-nowrap">${risk.label}</span>` : ''}
                </div>

                <!-- 客户 + 订单号 -->
                <div class="text-xs text-slate-500 mb-2">
                    <span>${escapeHtml(order.customer)}</span>
                    ${order.orderNumber ? `<span class="ml-2 font-mono text-slate-400">${escapeHtml(order.orderNumber)}</span>` : ''}
                </div>

                <!-- 金额 + 目的地 -->
                <div class="flex justify-between items-center mb-2">
                    <span class="text-primary font-bold text-sm">${symbol}${(order.totalAmount || 0).toLocaleString()} <span class="text-slate-400 text-[10px] font-normal">${order.currency || 'USD'}</span></span>
                    ${order.destination ? `<span class="text-[10px] text-slate-400"><i class="fas fa-map-marker-alt mr-0.5"></i>${escapeHtml(order.destination)}</span>` : ''}
                </div>

                <!-- 付款进度条 -->
                ${progressBarHTML(order.totalAmount, order.amountReceived)}

                <!-- 10节点进度点 -->
                <div class="flex justify-between items-center gap-0.5 mt-2 mb-1">
                    ${dotsHTML}
                </div>

                <!-- 底部操作栏 -->
                <div class="flex justify-between items-center pt-2 border-t border-slate-100 mt-1">
                    <span class="text-[10px] text-slate-400">${escapeHtml(col.label)}</span>
                    <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        ${order.status !== 'inquiry' ? `<button onclick="event.stopPropagation(); updateOrderStatus('${order.id}', 'prev')" class="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200" title="上一步"><i class="fas fa-chevron-left"></i></button>` : ''}
                        ${order.status !== 'completed' ? `<button onclick="event.stopPropagation(); updateOrderStatus('${order.id}', 'next')" class="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200" title="下一步"><i class="fas fa-chevron-right"></i></button>` : ''}
                        <button onclick="event.stopPropagation(); deleteOrder('${order.id}')" class="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-500 rounded hover:bg-red-100" title="删除"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>

                <!-- 负责人 -->
                ${order.responsible ? `<div class="text-[10px] text-slate-400 mt-1"><i class="fas fa-user-circle mr-0.5"></i>${escapeHtml(order.responsible)}</div>` : ''}
            </div>
        `;
    }

    // ========================== 看板渲染 ==========================
    function renderOrdersKanban() {
        const validOrders = (window.state?.orders || []).filter(o => o && o.id);
        // 兼容旧数据
        validOrders.forEach(migrateOrderStatus);

        const grouped = {};
        STATUS_FLOW.forEach(s => grouped[s] = []);
        validOrders.forEach(order => {
            const s = order.status || 'inquiry';
            if (grouped[s]) grouped[s].push(order);
        });

        STATUS_FLOW.forEach(status => {
            const col = KANBAN_COLUMNS[status];
            const container = document.getElementById(col.id);
            const countEl = document.getElementById(col.countId);
            const list = grouped[status];

            if (countEl) countEl.textContent = list.length;
            if (container) {
                container.innerHTML = list.length === 0
                    ? '<div class="text-center text-slate-400 py-6 text-xs">暂无订单</div>'
                    : list.map(renderOrderCard).join('');
            }
        });
    }

    // ========================== 状态流转 ==========================
    function updateOrderStatus(orderId, direction) {
        const orders = window.state?.orders || [];
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        migrateOrderStatus(order);
        const currentIdx = STATUS_FLOW.indexOf(order.status);
        let newIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
        newIdx = Math.max(0, Math.min(STATUS_FLOW.length - 1, newIdx));

        order.status = STATUS_FLOW[newIdx];
        order.updatedAt = new Date().toISOString();

        if (window.saveData) saveData('orders', state.orders);
        if (window.updateDashboard) updateDashboard();
        renderOrdersKanban();
        if (window.renderOrdersList) renderOrdersList();
        if (window.showToast) showToast(`订单进入: ${KANBAN_COLUMNS[order.status]?.label || order.status}`, 'success');
    }

    // ========================== 初始化 ==========================
    function init() {
        // 兼容旧数据
        const orders = window.state?.orders || [];
        orders.forEach(migrateOrderStatus);
        renderOrdersKanban();
        console.log('[Orders] ✅ 10节点看板已初始化');
        return true;
    }

    // ========================== 公共API ==========================
    return {
        init,
        renderOrdersKanban,
        renderOrderCard,
        updateOrderStatus,
        KANBAN_STATUS: Object.freeze(KANBAN_STATUS),
        KANBAN_COLUMNS: Object.freeze(KANBAN_COLUMNS),
        STATUS_FLOW: Object.freeze(STATUS_FLOW),
        migrateOrderStatus,
        calcPaymentProgress
    };
})();

window.WorkbenchOrders = WorkbenchOrders;
console.log('[Orders] 10节点生命周期模块已加载 (v1.5.0)');
