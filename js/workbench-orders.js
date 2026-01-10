/**
 * V14.2 PRO - 订单看板模块
 * 负责订单管理、看板状态控制、快速添加等功能
 * 优化版本 - 2026-01-03
 * @namespace WorkbenchOrders
 */
const WorkbenchOrders = (() => {
    'use strict';

    // 看板状态定义
    const KANBAN_STATUS = {
        NEW: 'New',
        PROCESSING: 'Processing',
        PAID: 'Paid',
        SHIPPED: 'Shipped',
        COMPLETED: 'Completed'
    };

    // 订单状态颜色映射
    const STATUS_COLORS = {
        [KANBAN_STATUS.NEW]: 'bg-blue-600',
        [KANBAN_STATUS.PROCESSING]: 'bg-yellow-600',
        [KANBAN_STATUS.PAID]: 'bg-green-600',
        [KANBAN_STATUS.SHIPPED]: 'bg-purple-600',
        [KANBAN_STATUS.COMPLETED]: 'bg-gray-600'
    };

    // 模块状态
    const state = {
        orders: [],
        currentEditingOrder: null,
        isInitialized: false,
        modalElement: null
    };

    /**
     * 初始化订单模块（供loader调用）
     * @returns {boolean} 是否成功
     */
    function init() {
        try {
            console.log('[Orders] 订单模块初始化中...');

            // 加载订单数据
            loadOrders();

            // 绑定事件
            bindEvents();

            // 渲染看板
            renderKanban();

            state.isInitialized = true;
            
            console.log('[Orders] ✅ 订单模块已初始化');
            console.log('[Orders] 订单数量:', state.orders.length);
            
            return true;
        } catch (error) {
            console.error('[Orders] ❌ 初始化失败:', error);
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast('订单模块初始化失败', 'error');
            }
            return false;
        }
    }

    /**
     * 从存储加载订单数据
     */
    function loadOrders() {
        try {
            // 优先使用WorkbenchStorage
            if (window.WorkbenchStorage) {
                state.orders = WorkbenchStorage.load('orders') || [];
            } else {
                // 降级到localStorage（自动加workbench_前缀）
                const ordersJson = localStorage.getItem('workbench_orders');
                state.orders = ordersJson ? JSON.parse(ordersJson) : [];
            }
            
            console.log(`[Orders] ✅ 已加载 ${state.orders.length} 条订单`);
        } catch (error) {
            console.error('[Orders] ❌ 加载订单数据失败:', error);
            state.orders = [];
        }
    }

    /**
     * 保存订单数据
     * @returns {boolean} 是否成功
     */
    function saveOrders() {
        try {
            // 优先使用WorkbenchStorage
            if (window.WorkbenchStorage) {
                WorkbenchStorage.save('orders', state.orders);
            } else {
                // 降级到localStorage
                localStorage.setItem('workbench_orders', JSON.stringify(state.orders));
            }
            
            // 同步到WorkbenchState（如果可用）
            if (window.WorkbenchState) {
                WorkbenchState.set('data.orders', state.orders);
            }
            
            // 同步到Firebase（如果启用）
            if (window.WorkbenchFirebase && WorkbenchFirebase.isInitialized && WorkbenchFirebase.isInitialized()) {
                WorkbenchFirebase.syncOrders(state.orders).catch(err => {
                    console.warn('[Orders] Firebase同步失败:', err);
                });
            }
            
            console.log(`[Orders] ✅ 已保存 ${state.orders.length} 条订单`);
            return true;
        } catch (error) {
            console.error('[Orders] ❌ 保存订单数据失败:', error);
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast('订单数据保存失败', 'error');
            }
            return false;
        }
    }

    /**
     * 绑定事件监听器
     */
    function bindEvents() {
        // 快速添加按钮
        const quickAddBtn = document.getElementById('kanban-quick-add');
        if (quickAddBtn) {
            quickAddBtn.addEventListener('click', () => openQuickAddModal());
        }
    }

    /**
     * 渲染看板
     */
    function renderKanban() {
        try {
            // 按状态分组订单
            const groupedOrders = {};
            Object.values(KANBAN_STATUS).forEach(status => {
                groupedOrders[status] = state.orders.filter(order => order.kanbanStatus === status);
            });

            // 渲染各个列
            Object.entries(groupedOrders).forEach(([status, orders]) => {
                renderKanbanColumn(status, orders);
            });

            console.log('[Orders] ✅ 看板渲染完成');
        } catch (error) {
            console.error('[Orders] ❌ 渲染看板失败:', error);
        }
    }

    /**
     * 渲染看板列
     * @param {string} status - 状态
     * @param {Array} orders - 订单列表
     */
    function renderKanbanColumn(status, orders) {
        const columnId = `kanban-column-${status.toLowerCase()}`;
        const column = document.getElementById(columnId);

        if (!column) {
            console.warn(`[Orders] 看板列未找到: ${columnId}`);
            return;
        }

        // 生成订单卡片HTML
        const cardsHtml = orders.map(order => generateOrderCard(order)).join('');

        // 更新列内容
        const cardsContainer = column.querySelector('.kanban-cards') || column;
        cardsContainer.innerHTML = cardsHtml || '<div class="text-gray-500 text-center py-8 text-sm">暂无订单</div>';
    }

    /**
     * 生成订单卡片HTML
     * @param {Object} order - 订单数据
     * @returns {string} HTML字符串
     */
    function generateOrderCard(order) {
        const statusColor = STATUS_COLORS[order.kanbanStatus] || 'bg-gray-600';
        const amount = parseFloat(order.amount) || 0;
        const currency = order.currency || 'USD';

        return `
            <div class="bg-gray-800 rounded-lg p-4 mb-3 border-l-4 ${statusColor} cursor-pointer hover:bg-gray-750 transition-colors"
                 data-order-id="${order.id}"
                 onclick="WorkbenchOrders.openOrderDetail('${order.id}')">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-medium text-white truncate flex-1">${escapeHtml(order.customerName || '未命名客户')}</h4>
                    <span class="text-xs ${statusColor} text-white px-2 py-1 rounded ml-2">${order.kanbanStatus}</span>
                </div>
                <p class="text-sm text-gray-400 mb-2">订单号: ${order.orderNumber || order.id}</p>
                <div class="flex justify-between items-center">
                    <span class="text-green-400 font-bold">${currency} ${amount.toFixed(2)}</span>
                    <span class="text-xs text-gray-500">${formatDate(order.createTime)}</span>
                </div>
            </div>
        `;
    }

    /**
     * 打开快速添加模态框
     */
    function openQuickAddModal() {
        try {
            // 使用WorkbenchModal（如果可用）
            if (window.WorkbenchModal) {
                WorkbenchModal.open({
                    title: '快速添加订单',
                    content: generateQuickAddForm(),
                    size: 'lg',
                    buttons: [
                        {
                            text: '取消',
                            className: 'bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded',
                            onClick: (modal) => WorkbenchModal.close(modal)
                        },
                        {
                            text: '保存',
                            className: 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded',
                            onClick: () => handleQuickAdd()
                        }
                    ]
                });
            } else {
                // 降级使用自定义模态框
                const modal = createModal({
                    title: '快速添加订单',
                    content: generateQuickAddForm(),
                    buttons: [
                        {
                            text: '取消',
                            className: 'bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded',
                            onClick: () => closeModal()
                        },
                        {
                            text: '保存',
                            className: 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded',
                            onClick: () => handleQuickAdd()
                        }
                    ]
                });
                state.modalElement = modal;
            }
            
            console.log('[Orders] 快速添加模态框已打开');
        } catch (error) {
            console.error('[Orders] ❌ 打开快速添加模态框失败:', error);
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast('打开添加订单窗口失败', 'error');
            }
        }
    }

    /**
     * 生成快速添加表单HTML
     * @returns {string} HTML字符串
     */
    function generateQuickAddForm() {
        // 获取货币列表（从WorkbenchConfig或默认）
        const currencies = window.WorkbenchConfig ? 
            Object.keys(WorkbenchConfig.CURRENCY.LIST) : 
            ['USD', 'EUR', 'GBP', 'CNY'];

        return `
            <form id="quick-add-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">客户名称 *</label>
                    <input type="text" id="order-customer-name" required
                           class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                           placeholder="请输入客户名称">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">订单号</label>
                    <input type="text" id="order-number"
                           class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                           placeholder="自动生成或手动输入">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">金额 *</label>
                        <input type="number" id="order-amount" required step="0.01" min="0"
                               class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                               placeholder="0.00">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">货币</label>
                        <select id="order-currency"
                                class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                            ${currencies.map(curr => `<option value="${curr}">${curr}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">订单状态</label>
                    <select id="order-status"
                            class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        ${Object.entries(KANBAN_STATUS).map(([key, value]) => 
                            `<option value="${value}">${value}</option>`
                        ).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">备注</label>
                    <textarea id="order-remark" rows="3"
                              class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="订单备注信息（可选）"></textarea>
                </div>
            </form>
        `;
    }

    /**
     * 处理快速添加提交
     */
    function handleQuickAdd() {
        try {
            // 获取表单数据
            const formData = {
                customerName: document.getElementById('order-customer-name')?.value?.trim(),
                orderNumber: document.getElementById('order-number')?.value?.trim(),
                amount: parseFloat(document.getElementById('order-amount')?.value) || 0,
                currency: document.getElementById('order-currency')?.value || 'USD',
                kanbanStatus: document.getElementById('order-status')?.value || KANBAN_STATUS.NEW,
                remark: document.getElementById('order-remark')?.value?.trim() || ''
            };

            // 验证必填项
            if (!formData.customerName) {
                if (window.WorkbenchUtils) {
                    WorkbenchUtils.toast('请输入客户名称', 'warning');
                }
                return;
            }

            if (formData.amount <= 0) {
                if (window.WorkbenchUtils) {
                    WorkbenchUtils.toast('请输入有效的订单金额', 'warning');
                }
                return;
            }

            // 生成订单ID和订单号
            const orderId = window.WorkbenchUtils ? 
                WorkbenchUtils.generateId('order') : 
                `order_${Date.now()}`;
            const orderNumber = formData.orderNumber || `ORD-${Date.now().toString().slice(-8)}`;

            // 创建订单对象
            const newOrder = {
                id: orderId,
                orderNumber: orderNumber,
                customerName: formData.customerName,
                amount: formData.amount,
                currency: formData.currency,
                kanbanStatus: formData.kanbanStatus,
                remark: formData.remark,
                createTime: new Date().toISOString(),
                updateTime: new Date().toISOString()
            };

            // 添加到订单列表
            state.orders.push(newOrder);

            // 保存数据
            saveOrders();

            // 刷新看板
            renderKanban();

            // 关闭模态框
            if (window.WorkbenchModal) {
                WorkbenchModal.close();
            } else {
                closeModal();
            }

            // 成功提示
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast('订单添加成功', 'success');
            }

            console.log('[Orders] ✅ 订单添加成功:', newOrder);
        } catch (error) {
            console.error('[Orders] ❌ 添加订单失败:', error);
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast('添加订单失败，请重试', 'error');
            }
        }
    }

    /**
     * 打开订单详情
     * @param {string} orderId - 订单ID
     */
    function openOrderDetail(orderId) {
        try {
            const order = state.orders.find(o => o.id === orderId);
            if (!order) {
                console.warn('[Orders] 订单不存在:', orderId);
                return;
            }

            state.currentEditingOrder = order;

            // TODO: 实现订单详情模态框
            console.log('[Orders] 打开订单详情:', order);
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast('订单详情功能开发中', 'info');
            }
        } catch (error) {
            console.error('[Orders] ❌ 打开订单详情失败:', error);
        }
    }

    /**
     * 创建模态框（降级方案）
     * @param {Object} options - 模态框选项
     * @returns {HTMLElement} 模态框元素
     */
    function createModal(options) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] animate-fade-in';
        
        modal.innerHTML = `
            <div class="bg-gray-900 rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold text-white">${escapeHtml(options.title || '订单操作')}</h3>
                    <button class="text-gray-400 hover:text-white text-2xl leading-none" onclick="WorkbenchOrders.closeModal()">&times;</button>
                </div>
                <div class="modal-content">
                    ${options.content || ''}
                </div>
                <div class="flex justify-end gap-3 mt-6">
                    ${options.buttons?.map(btn => `
                        <button class="${btn.className}">${escapeHtml(btn.text)}</button>
                    `).join('') || ''}
                </div>
            </div>
        `;

        // 绑定按钮事件
        if (options.buttons) {
            const buttons = modal.querySelectorAll('button');
            const closeButton = buttons[0]; // 关闭按钮
            buttons.forEach((btn, index) => {
                if (index === 0) return; // 跳过关闭按钮
                const btnConfig = options.buttons[index - 1];
                if (btnConfig && btnConfig.onClick) {
                    btn.addEventListener('click', btnConfig.onClick);
                }
            });
        }

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        document.body.appendChild(modal);
        return modal;
    }

    /**
     * 关闭模态框（降级方案）
     */
    function closeModal() {
        if (state.modalElement) {
            state.modalElement.remove();
            state.modalElement = null;
        }
    }

    /**
     * HTML转义
     * @param {string} str - 字符串
     * @returns {string} 转义后的字符串
     */
    function escapeHtml(str) {
        if (!str) return '';
        if (window.WorkbenchUtils && WorkbenchUtils.escapeHtml) {
            return WorkbenchUtils.escapeHtml(str);
        }
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * 格式化日期
     * @param {string} dateStr - 日期字符串
     * @returns {string} 格式化后的日期
     */
    function formatDate(dateStr) {
        if (!dateStr) return '未知';
        if (window.WorkbenchUtils && WorkbenchUtils.formatDate) {
            return WorkbenchUtils.formatDate(dateStr, 'YYYY-MM-DD');
        }
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('zh-CN');
        } catch {
            return '未知';
        }
    }

    /**
     * 获取所有订单
     * @returns {Array} 订单列表
     */
    function getAllOrders() {
        return [...state.orders];
    }

    /**
     * 按状态获取订单
     * @param {string} status - 状态
     * @returns {Array} 订单列表
     */
    function getOrdersByStatus(status) {
        return state.orders.filter(order => order.kanbanStatus === status);
    }

    /**
     * 删除订单
     * @param {string} orderId - 订单ID
     * @returns {boolean} 是否成功
     */
    function deleteOrder(orderId) {
        try {
            const index = state.orders.findIndex(o => o.id === orderId);
            if (index === -1) {
                console.warn('[Orders] 订单不存在:', orderId);
                return false;
            }

            state.orders.splice(index, 1);
            saveOrders();
            renderKanban();

            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast('订单已删除', 'success');
            }

            console.log('[Orders] ✅ 订单已删除:', orderId);
            return true;
        } catch (error) {
            console.error('[Orders] ❌ 删除订单失败:', error);
            return false;
        }
    }

    // 公共API
    const api = {
        // 初始化
        init,
        
        // 订单操作
        openQuickAddModal,
        openOrderDetail,
        getAllOrders,
        getOrdersByStatus,
        deleteOrder,
        
        // 看板操作
        renderKanban,
        
        // 模态框操作
        closeModal,
        
        // 常量
        KANBAN_STATUS,
        STATUS_COLORS
    };

    return api;
})();

// 挂载到全局
window.WorkbenchOrders = WorkbenchOrders;

// 模块导出（支持CommonJS和ES模块）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkbenchOrders;
} else if (typeof define === 'function' && define.amd) {
    define([], () => WorkbenchOrders);
}

console.log('[Orders] 订单模块已加载');
