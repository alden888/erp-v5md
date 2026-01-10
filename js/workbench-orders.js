/**
 * V14.2 PRO - 订单看板模块
 * 负责订单管理、看板状态控制、快速添加等功能
 * 优化版本 - 2026-01-03
 * @namespace WorkbenchOrders
 * @author 开发团队
 * @version 1.4.2
 */
const WorkbenchOrders = (() => {
    'use strict';

    // ========================== 常量定义（集中管理）==========================
    /** 看板状态枚举 */
    const KANBAN_STATUS = {
        NEW: 'New',
        PROCESSING: 'Processing',
        PAID: 'Paid',
        SHIPPED: 'Shipped',
        COMPLETED: 'Completed'
    };

    /** 看板列ID映射（与HTML ID严格匹配） */
    const KANBAN_COLUMNS = {
        [KANBAN_STATUS.NEW]: 'kanban-column-new',
        [KANBAN_STATUS.PROCESSING]: 'kanban-column-processing',
        [KANBAN_STATUS.PAID]: 'kanban-column-paid',
        [KANBAN_STATUS.SHIPPED]: 'kanban-column-shipped',
        [KANBAN_STATUS.COMPLETED]: 'kanban-column-completed'
    };

    /** 订单状态颜色映射（Tailwind CSS类） */
    const STATUS_COLORS = {
        [KANBAN_STATUS.NEW]: 'bg-blue-600',
        [KANBAN_STATUS.PROCESSING]: 'bg-yellow-600',
        [KANBAN_STATUS.PAID]: 'bg-green-600',
        [KANBAN_STATUS.SHIPPED]: 'bg-purple-600',
        [KANBAN_STATUS.COMPLETED]: 'bg-gray-600'
    };

    /** 默认配置 */
    const DEFAULT_CONFIG = {
        defaultCurrency: 'USD',
        emptyColumnText: '暂无订单',
        toastDuration: 3000,
        firebaseSyncRetryTimes: 2
    };

    // ========================== 模块状态管理 ==========================
    const state = {
        orders: [],
        currentEditingOrder: null,
        isInitialized: false,
        modalElement: null,
        eventListeners: [] // 存储事件监听器，用于销毁时清理
    };

    // ========================== 工具函数（通用） ==========================
    /**
     * 通用错误处理函数
     * @param {Error} error - 错误对象
     * @param {string} message - 自定义错误提示
     * @param {string} type - toast类型 (error/warning/info)
     */
    function handleError(error, message, type = 'error') {
        console.error(`[Orders] ❌ ${message}:`, error);
        if (window.WorkbenchUtils && WorkbenchUtils.toast) {
            WorkbenchUtils.toast(message, type, DEFAULT_CONFIG.toastDuration);
        }
    }

    /**
     * HTML转义（防止XSS）
     * @param {string} str - 需要转义的字符串
     * @returns {string} 转义后的字符串
     */
    function escapeHtml(str) {
        if (!str || typeof str !== 'string') return '';
        
        // 优先使用全局工具函数
        if (window.WorkbenchUtils && WorkbenchUtils.escapeHtml) {
            return WorkbenchUtils.escapeHtml(str);
        }

        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return str.replace(/[&<>"']/g, char => escapeMap[char]);
    }

    /**
     * 日期格式化
     * @param {string|Date} dateInput - 日期字符串/Date对象
     * @param {string} format - 格式 (默认: YYYY-MM-DD)
     * @returns {string} 格式化后的日期
     */
    function formatDate(dateInput, format = 'YYYY-MM-DD') {
        if (!dateInput) return '未知';

        // 优先使用全局工具函数
        if (window.WorkbenchUtils && WorkbenchUtils.formatDate) {
            return WorkbenchUtils.formatDate(dateInput, format);
        }

        try {
            const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
            if (isNaN(date.getTime())) return '未知';

            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            
            return format.replace('YYYY', year).replace('MM', month).replace('DD', day);
        } catch (error) {
            handleError(error, '日期格式化失败', 'warning');
            return '未知';
        }
    }

    /**
     * 生成唯一ID
     * @param {string} prefix - ID前缀
     * @returns {string} 唯一ID
     */
    function generateUniqueId(prefix = 'order') {
        if (window.WorkbenchUtils && WorkbenchUtils.generateId) {
            return WorkbenchUtils.generateId(prefix);
        }
        return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }

    // ========================== 核心业务逻辑 ==========================
    /**
     * 初始化订单模块（供loader调用）
     * @returns {boolean} 是否成功初始化
     */
    function init() {
        try {
            console.log('[Orders] 订单模块初始化中...');

            // 防止重复初始化
            if (state.isInitialized) {
                console.warn('[Orders] 订单模块已初始化，跳过重复执行');
                return true;
            }

            // 加载订单数据
            loadOrders();

            // 绑定事件（使用事件委托优化）
            bindEvents();

            // 渲染看板
            renderKanban();

            state.isInitialized = true;
            
            console.log('[Orders] ✅ 订单模块已初始化');
            console.log('[Orders] 订单数量:', state.orders.length);
            
            return true;
        } catch (error) {
            handleError(error, '初始化失败');
            return false;
        }
    }

    /**
     * 从存储加载订单数据（支持多存储方案降级）
     */
    function loadOrders() {
        try {
            let orders = [];

            // 优先级: WorkbenchStorage > localStorage > 空数组
            if (window.WorkbenchStorage) {
                orders = WorkbenchStorage.load('orders') || [];
            } else {
                const ordersJson = localStorage.getItem('workbench_orders');
                orders = ordersJson ? JSON.parse(ordersJson) : [];
            }

            // 数据校验：确保订单结构合法
            state.orders = validateOrdersData(orders);
            
            console.log(`[Orders] ✅ 已加载 ${state.orders.length} 条订单`);
        } catch (error) {
            handleError(error, '加载订单数据失败');
            state.orders = [];
        }
    }

    /**
     * 订单数据校验（防止脏数据）
     * @param {Array} orders - 待校验的订单数组
     * @returns {Array} 校验后的订单数组
     */
    function validateOrdersData(orders) {
        if (!Array.isArray(orders)) return [];

        return orders.filter(order => {
            // 基础校验
            if (!order || typeof order !== 'object' || !order.id) return false;

            // 补全必要字段
            order.kanbanStatus = Object.values(KANBAN_STATUS).includes(order.kanbanStatus) 
                ? order.kanbanStatus 
                : KANBAN_STATUS.NEW;
            
            order.amount = typeof order.amount === 'number' && order.amount >= 0 
                ? order.amount 
                : 0;
            
            order.currency = order.currency || DEFAULT_CONFIG.defaultCurrency;
            order.createTime = order.createTime || new Date().toISOString();
            order.updateTime = new Date().toISOString();

            return true;
        });
    }

    /**
     * 保存订单数据（支持多存储方案+云端同步）
     * @returns {Promise<boolean>} 是否保存成功
     */
    async function saveOrders() {
        try {
            // 1. 本地存储（优先WorkbenchStorage）
            if (window.WorkbenchStorage) {
                WorkbenchStorage.save('orders', state.orders);
            } else {
                localStorage.setItem('workbench_orders', JSON.stringify(state.orders));
            }
            
            // 2. 同步到全局状态
            if (window.WorkbenchState) {
                WorkbenchState.set('data.orders', state.orders);
            }
            
            // 3. 同步到Firebase（带重试机制）
            if (window.WorkbenchFirebase && WorkbenchFirebase.isInitialized?.()) {
                await syncToFirebaseWithRetry(state.orders, DEFAULT_CONFIG.firebaseSyncRetryTimes);
            }
            
            console.log(`[Orders] ✅ 已保存 ${state.orders.length} 条订单`);
            return true;
        } catch (error) {
            handleError(error, '保存订单数据失败');
            return false;
        }
    }

    /**
     * Firebase同步（带重试机制）
     * @param {Array} orders - 订单数组
     * @param {number} retryTimes - 重试次数
     * @returns {Promise<void>}
     */
    async function syncToFirebaseWithRetry(orders, retryTimes) {
        let retryCount = 0;
        while (retryCount < retryTimes) {
            try {
                await WorkbenchFirebase.syncOrders(orders);
                console.log('[Orders] ✅ Firebase同步成功');
                return;
            } catch (error) {
                retryCount++;
                console.warn(`[Orders] Firebase同步失败（重试${retryCount}/${retryTimes}）:`, error);
                if (retryCount >= retryTimes) {
                    handleError(error, 'Firebase同步失败（已达最大重试次数）', 'warning');
                }
                // 重试间隔（指数退避）
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
            }
        }
    }

    /**
     * 绑定事件监听器（支持事件委托，减少内存占用）
     */
    function bindEvents() {
        // 事件委托：统一绑定到document，减少监听器数量
        const kanbanContainer = document.getElementById('kanban-container') || document.body;
        
        // 快速添加按钮点击
        const quickAddHandler = (e) => {
            if (e.target.closest('#kanban-quick-add')) {
                openQuickAddModal();
            }
        };

        // 订单卡片点击（查看详情）
        const orderCardHandler = (e) => {
            const orderCard = e.target.closest('[data-order-id]');
            if (orderCard) {
                const orderId = orderCard.dataset.orderId;
                openOrderDetail(orderId);
            }
        };

        kanbanContainer.addEventListener('click', quickAddHandler);
        kanbanContainer.addEventListener('click', orderCardHandler);

        // 存储监听器，用于后续清理
        state.eventListeners.push({
            element: kanbanContainer,
            event: 'click',
            handler: quickAddHandler
        });
        state.eventListeners.push({
            element: kanbanContainer,
            event: 'click',
            handler: orderCardHandler
        });

        console.log('[Orders] ✅ 事件监听器绑定完成');
    }

    /**
     * 渲染整个看板
     */
    function renderKanban() {
        try {
            // 按状态分组订单（优化：使用reduce提升性能）
            const groupedOrders = Object.values(KANBAN_STATUS).reduce((acc, status) => {
                acc[status] = state.orders.filter(order => order.kanbanStatus === status);
                return acc;
            }, {});

            // 渲染每个列
            Object.entries(groupedOrders).forEach(([status, orders]) => {
                renderKanbanColumn(status, orders);
            });

            console.log('[Orders] ✅ 看板渲染完成');
        } catch (error) {
            handleError(error, '渲染看板失败');
        }
    }

    /**
     * 渲染单个看板列
     * @param {string} status - 订单状态
     * @param {Array} orders - 该状态下的订单列表
     */
    function renderKanbanColumn(status, orders) {
        // 使用预定义的列ID映射，避免硬编码
        const columnId = KANBAN_COLUMNS[status];
        if (!columnId) {
            console.warn(`[Orders] 未找到状态${status}对应的看板列ID配置`);
            return;
        }

        const column = document.getElementById(columnId);
        if (!column) {
            console.warn(`[Orders] 看板列元素未找到: ${columnId}`);
            return;
        }

        // 找到卡片容器（优先使用.kanban-cards，否则使用列本身）
        const cardsContainer = column.querySelector('.kanban-cards') || column;
        
        // 生成卡片HTML
        const cardsHtml = orders.length > 0 
            ? orders.map(order => generateOrderCard(order)).join('')
            : `<div class="text-gray-500 text-center py-8 text-sm">${DEFAULT_CONFIG.emptyColumnText}</div>`;

        // 优化：使用requestAnimationFrame避免布局抖动
        requestAnimationFrame(() => {
            cardsContainer.innerHTML = cardsHtml;
        });
    }

    /**
     * 生成订单卡片HTML
     * @param {Object} order - 订单数据对象
     * @returns {string} 卡片HTML字符串
     */
    function generateOrderCard(order) {
        if (!order || !order.id) return '';

        const statusColor = STATUS_COLORS[order.kanbanStatus] || 'bg-gray-600';
        const amount = parseFloat(order.amount) || 0;
        const currency = order.currency || DEFAULT_CONFIG.defaultCurrency;

        // 使用模板字符串优化：拆分结构提升可读性
        return `
            <div class="bg-gray-800 rounded-lg p-4 mb-3 border-l-4 ${statusColor} 
                        cursor-pointer hover:bg-gray-750 transition-colors"
                 data-order-id="${escapeHtml(order.id)}">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-medium text-white truncate flex-1">
                        ${escapeHtml(order.customerName || '未命名客户')}
                    </h4>
                    <span class="text-xs ${statusColor} text-white px-2 py-1 rounded ml-2">
                        ${escapeHtml(order.kanbanStatus)}
                    </span>
                </div>
                <p class="text-sm text-gray-400 mb-2">
                    订单号: ${escapeHtml(order.orderNumber || order.id)}
                </p>
                <div class="flex justify-between items-center">
                    <span class="text-green-400 font-bold">
                        ${escapeHtml(currency)} ${amount.toFixed(2)}
                    </span>
                    <span class="text-xs text-gray-500">
                        ${formatDate(order.createTime)}
                    </span>
                </div>
            </div>
        `;
    }

    /**
     * 打开快速添加订单模态框
     */
    function openQuickAddModal() {
        try {
            // 关闭已有模态框（防止重复打开）
            if (state.modalElement) closeModal();

            // 优先使用全局模态框组件
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
                            onClick: handleQuickAdd
                        }
                    ]
                });
            } else {
                // 降级方案：自定义模态框
                state.modalElement = createModal({
                    title: '快速添加订单',
                    content: generateQuickAddForm(),
                    buttons: [
                        {
                            text: '取消',
                            className: 'bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded',
                            onClick: closeModal
                        },
                        {
                            text: '保存',
                            className: 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded',
                            onClick: handleQuickAdd
                        }
                    ]
                });
            }
            
            console.log('[Orders] ✅ 快速添加模态框已打开');
        } catch (error) {
            handleError(error, '打开快速添加模态框失败');
        }
    }

    /**
     * 生成快速添加订单表单HTML
     * @returns {string} 表单HTML字符串
     */
    function generateQuickAddForm() {
        // 获取货币列表（从全局配置或默认）
        const currencies = window.WorkbenchConfig?.CURRENCY?.LIST 
            ? Object.keys(WorkbenchConfig.CURRENCY.LIST) 
            : ['USD', 'EUR', 'GBP', 'CNY'];

        // 生成状态下拉选项
        const statusOptions = Object.entries(KANBAN_STATUS)
            .map(([key, value]) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
            .join('');

        // 生成货币下拉选项
        const currencyOptions = currencies
            .map(curr => `<option value="${escapeHtml(curr)}">${escapeHtml(curr)}</option>`)
            .join('');

        return `
            <form id="quick-add-form" class="space-y-4" novalidate>
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">客户名称 *</label>
                    <input type="text" id="order-customer-name" required
                           class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white 
                                  focus:outline-none focus:ring-2 focus:ring-blue-500"
                           placeholder="请输入客户名称" autocomplete="off">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">订单号</label>
                    <input type="text" id="order-number"
                           class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white 
                                  focus:outline-none focus:ring-2 focus:ring-blue-500"
                           placeholder="自动生成或手动输入" autocomplete="off">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">金额 *</label>
                        <input type="number" id="order-amount" required step="0.01" min="0.01"
                               class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white 
                                      focus:outline-none focus:ring-2 focus:ring-blue-500"
                               placeholder="0.00" autocomplete="off">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">货币</label>
                        <select id="order-currency"
                                class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white 
                                       focus:outline-none focus:ring-2 focus:ring-blue-500">
                            ${currencyOptions}
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">订单状态</label>
                    <select id="order-status"
                            class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white 
                                   focus:outline-none focus:ring-2 focus:ring-blue-500">
                        ${statusOptions}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">备注</label>
                    <textarea id="order-remark" rows="3"
                              class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white 
                                     focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="订单备注信息（可选）" autocomplete="off"></textarea>
                </div>
            </form>
        `;
    }

    /**
     * 处理快速添加订单的表单提交
     */
    function handleQuickAdd() {
        try {
            // 获取表单元素（增加空值保护）
            const customerNameInput = document.getElementById('order-customer-name');
            const orderNumberInput = document.getElementById('order-number');
            const amountInput = document.getElementById('order-amount');
            const currencyInput = document.getElementById('order-currency');
            const statusInput = document.getElementById('order-status');
            const remarkInput = document.getElementById('order-remark');

            // 表单验证（原生HTML5验证）
            const form = document.getElementById('quick-add-form');
            if (form && !form.checkValidity()) {
                form.reportValidity();
                return;
            }

            // 收集表单数据（增加空值处理）
            const formData = {
                customerName: customerNameInput?.value?.trim() || '',
                orderNumber: orderNumberInput?.value?.trim() || '',
                amount: parseFloat(amountInput?.value) || 0,
                currency: currencyInput?.value || DEFAULT_CONFIG.defaultCurrency,
                kanbanStatus: statusInput?.value || KANBAN_STATUS.NEW,
                remark: remarkInput?.value?.trim() || ''
            };

            // 业务规则验证
            if (!formData.customerName) {
                handleError(new Error('客户名称为空'), '请输入客户名称', 'warning');
                customerNameInput?.focus();
                return;
            }

            if (formData.amount <= 0) {
                handleError(new Error('金额无效'), '请输入有效的订单金额（大于0）', 'warning');
                amountInput?.focus();
                return;
            }

            // 生成订单ID和订单号
            const orderId = generateUniqueId('order');
            const orderNumber = formData.orderNumber || `ORD-${Date.now().toString().slice(-8)}`;

            // 创建新订单对象
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

            // 添加到订单列表并保存
            state.orders.push(newOrder);
            saveOrders().then(() => {
                // 刷新看板
                renderKanban();

                // 关闭模态框
                if (window.WorkbenchModal) {
                    WorkbenchModal.close();
                } else {
                    closeModal();
                }

                // 成功提示
                if (window.WorkbenchUtils && WorkbenchUtils.toast) {
                    WorkbenchUtils.toast('订单添加成功', 'success', DEFAULT_CONFIG.toastDuration);
                }

                console.log('[Orders] ✅ 订单添加成功:', newOrder);
            });

        } catch (error) {
            handleError(error, '添加订单失败，请重试');
        }
    }

    /**
     * 打开订单详情
     * @param {string} orderId - 订单ID
     */
    function openOrderDetail(orderId) {
        try {
            if (!orderId) {
                handleError(new Error('订单ID为空'), '订单ID无效', 'warning');
                return;
            }

            const order = state.orders.find(o => o.id === orderId);
            if (!order) {
                handleError(new Error(`订单ID: ${orderId} 不存在`), '订单不存在', 'warning');
                return;
            }

            state.currentEditingOrder = order;

            // TODO: 实现订单详情模态框（可扩展）
            console.log('[Orders] 打开订单详情:', order);
            if (window.WorkbenchUtils && WorkbenchUtils.toast) {
                WorkbenchUtils.toast('订单详情功能开发中', 'info', DEFAULT_CONFIG.toastDuration);
            }
        } catch (error) {
            handleError(error, '打开订单详情失败');
        }
    }

    /**
     * 创建自定义模态框（降级方案）
     * @param {Object} options - 模态框配置
     * @returns {HTMLElement} 模态框元素
     */
    function createModal(options) {
        // 创建模态框外层容器
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] animate-fade-in';
        
        // 模态框内容
        modal.innerHTML = `
            <div class="bg-gray-900 rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 transform transition-all">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold text-white">${escapeHtml(options.title || '订单操作')}</h3>
                    <button class="text-gray-400 hover:text-white text-2xl leading-none focus:outline-none" 
                            id="modal-close-btn">&times;</button>
                </div>
                <div class="modal-content">
                    ${options.content || ''}
                </div>
                <div class="flex justify-end gap-3 mt-6">
                    ${options.buttons?.map(btn => `
                        <button class="${escapeHtml(btn.className)} focus:outline-none">
                            ${escapeHtml(btn.text)}
                        </button>
                    `).join('') || ''}
                </div>
            </div>
        `;

        // 绑定按钮事件
        const buttons = modal.querySelectorAll('button');
        buttons.forEach((btn, index) => {
            if (btn.id === 'modal-close-btn') {
                btn.addEventListener('click', closeModal);
                return;
            }

            const btnConfig = options.buttons?.[index];
            if (btnConfig && typeof btnConfig.onClick === 'function') {
                btn.addEventListener('click', btnConfig.onClick);
            }
        });

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // 阻止模态框内点击事件冒泡
        const modalContent = modal.querySelector('.bg-gray-900');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => e.stopPropagation());
        }

        // 添加到页面
        document.body.appendChild(modal);
        // 防止页面滚动
        document.body.style.overflow = 'hidden';

        return modal;
    }

    /**
     * 关闭自定义模态框
     */
    function closeModal() {
        if (state.modalElement) {
            // 恢复页面滚动
            document.body.style.overflow = '';
            // 移除模态框
            state.modalElement.remove();
            state.modalElement = null;
        }
    }

    /**
     * 删除订单
     * @param {string} orderId - 订单ID
     * @returns {boolean} 是否删除成功
     */
    function deleteOrder(orderId) {
        try {
            if (!orderId) {
                handleError(new Error('订单ID为空'), '订单ID无效', 'warning');
                return false;
            }

            const index = state.orders.findIndex(o => o.id === orderId);
            if (index === -1) {
                handleError(new Error(`订单ID: ${orderId} 不存在`), '订单不存在', 'warning');
                return false;
            }

            // 删除订单
            state.orders.splice(index, 1);
            // 保存并刷新
            saveOrders().then(() => {
                renderKanban();
                if (window.WorkbenchUtils && WorkbenchUtils.toast) {
                    WorkbenchUtils.toast('订单已删除', 'success', DEFAULT_CONFIG.toastDuration);
                }
            });

            console.log('[Orders] ✅ 订单已删除:', orderId);
            return true;
        } catch (error) {
            handleError(error, '删除订单失败');
            return false;
        }
    }

    /**
     * 销毁模块（清理资源）
     */
    function destroy() {
        try {
            // 清理事件监听器
            state.eventListeners.forEach(({ element, event, handler }) => {
                element.removeEventListener(event, handler);
            });
            state.eventListeners = [];

            // 关闭模态框
            closeModal();

            // 重置状态
            state.isInitialized = false;
            state.currentEditingOrder = null;

            console.log('[Orders] ✅ 模块已销毁，资源已清理');
        } catch (error) {
            handleError(error, '销毁模块失败');
        }
    }

    // ========================== 公共API暴露 ==========================
    const api = {
        // 核心方法
        init,
        destroy,
        
        // 订单操作
        openQuickAddModal,
        openOrderDetail,
        getAllOrders: () => [...state.orders], // 返回副本，防止外部修改
        getOrdersByStatus: (status) => state.orders.filter(order => order.kanbanStatus === status),
        deleteOrder,
        
        // 看板操作
        renderKanban,
        saveOrders,
        
        // 模态框操作
        closeModal,
        
        // 常量（只读）
        KANBAN_STATUS: Object.freeze({ ...KANBAN_STATUS }),
        STATUS_COLORS: Object.freeze({ ...STATUS_COLORS }),
        KANBAN_COLUMNS: Object.freeze({ ...KANBAN_COLUMNS })
    };

    return api;
})();

// 挂载到全局
window.WorkbenchOrders = WorkbenchOrders;

// 模块导出（支持CommonJS/ES模块）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkbenchOrders;
} else if (typeof define === 'function' && define.amd) {
    define([], () => WorkbenchOrders);
}

// 自动初始化（如果配置了自动初始化）
if (window.WorkbenchConfig?.autoInit?.orders) {
    document.addEventListener('DOMContentLoaded', () => {
        WorkbenchOrders.init();
    });
}

console.log('[Orders] 订单模块已加载（优化版）');
