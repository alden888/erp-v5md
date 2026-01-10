/**
 * V14.2 PRO - 仪表盘模块（修复版）
 * 数据统计、可视化、趋势分析
 * @namespace WorkbenchDashboard
 */
const WorkbenchDashboard = (() => {
    'use strict';

    // 刷新定时器
    let refreshTimer = null;
    let clockTimer = null;

    /**
     * 初始化仪表盘模块
     * @returns {boolean} 是否成功
     */
    function init() {
        try {
            console.log('[Dashboard] 仪表盘模块初始化中...');
            renderDashboard();
            bindEvents();
            console.log('[Dashboard] ✅ 仪表盘模块已初始化');
            return true;
        } catch (error) {
            console.error('[Dashboard] ❌ 初始化失败:', error);
            return false;
        }
    }

    /**
     * 绑定事件监听器
     */
    function bindEvents() {
        try {
            const refreshBtn = document.getElementById('dashboard-refresh');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => refreshDashboard());
            }
        } catch (error) {
            console.warn('[Dashboard] 绑定事件失败:', error);
        }
    }

    /**
     * 更新元素文本
     * @param {string} id - 元素ID
     * @param {string|number} text - 文本内容
     */
    function updateElementText(id, text) {
        try {
            if (!id || typeof id !== 'string') {
                throw new Error('元素ID必须为非空字符串');
            }
            const element = document.getElementById(id);
            if (!element) {
                console.warn(`[Dashboard] 元素未找到：${id}`);
                return;
            }
            const textContent = typeof text === 'string' || typeof text === 'number' ? text.toString() : '';
            element.textContent = textContent;
        } catch (error) {
            console.error('[Dashboard] ❌ 更新元素文本失败:', error);
        }
    }

    /**
     * 统计仪表盘核心数据
     * @returns {Object} 统计数据
     */
    function getDashboardStats() {
        try {
            let orders = [];
            let incomes = [];
            let suppliers = [];
            let expenses = [];

            // 从存储获取数据
            if (window.WorkbenchStorage) {
                orders = WorkbenchStorage.load('orders') || [];
                incomes = WorkbenchStorage.load('incomes') || [];
                suppliers = WorkbenchStorage.load('suppliers') || [];
                expenses = WorkbenchStorage.load('expenses') || [];
            } else {
                // 降级到localStorage
                const ordersKey = window.WorkbenchConfig?.STORAGE_KEYS?.ORDERS || 'v5_erp_orders';
                const incomesKey = window.WorkbenchConfig?.STORAGE_KEYS?.INCOMES || 'v5_erp_incomes';
                const suppliersKey = window.WorkbenchConfig?.STORAGE_KEYS?.SUPPLIERS || 'v5_erp_suppliers';
                const expensesKey = window.WorkbenchConfig?.STORAGE_KEYS?.EXPENSES || 'v5_erp_expenses';
                
                orders = JSON.parse(localStorage.getItem(ordersKey) || '[]');
                incomes = JSON.parse(localStorage.getItem(incomesKey) || '[]');
                suppliers = JSON.parse(localStorage.getItem(suppliersKey) || '[]');
                expenses = JSON.parse(localStorage.getItem(expensesKey) || '[]');
            }

            // 订单统计
            const totalOrders = orders.length;
            const pendingOrders = orders.filter(o => 
                o.kanbanStatus === 'New' || o.kanbanStatus === 'Processing'
            ).length;
            const completedOrders = orders.filter(o => 
                o.kanbanStatus === 'Paid' || o.kanbanStatus === 'Shipped' || o.kanbanStatus === 'Completed'
            ).length;

            // 收入统计
            const totalIncome = incomes.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
            
            // 本月收入
            const now = new Date();
            const monthIncome = incomes
                .filter(item => {
                    const itemDate = new Date(item.createTime || item.date);
                    return itemDate.getMonth() === now.getMonth() && 
                           itemDate.getFullYear() === now.getFullYear();
                })
                .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

            // 本月支出
            const monthExpense = expenses
                .filter(item => {
                    const itemDate = new Date(item.createdAt || item.date);
                    return itemDate.getMonth() === now.getMonth() && 
                           itemDate.getFullYear() === now.getFullYear();
                })
                .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

            // 供应商统计
            const totalSuppliers = suppliers.length;

            return {
                totalOrders,
                pendingOrders,
                completedOrders,
                totalIncome: totalIncome.toFixed(2),
                monthIncome: monthIncome.toFixed(2),
                monthExpense: monthExpense.toFixed(2),
                netProfit: (monthIncome - monthExpense).toFixed(2),
                totalSuppliers
            };
        } catch (error) {
            console.error('[Dashboard] ❌ 统计数据失败:', error);
            return {
                totalOrders: 0,
                pendingOrders: 0,
                completedOrders: 0,
                totalIncome: '0.00',
                monthIncome: '0.00',
                monthExpense: '0.00',
                netProfit: '0.00',
                totalSuppliers: 0
            };
        }
    }

    /**
     * 渲染仪表盘（核心入口）
     */
    function renderDashboard() {
        try {
            const stats = getDashboardStats();

            // 更新核心指标
            updateElementText('dashboard-total-orders', stats.totalOrders);
            updateElementText('dashboard-pending-orders', stats.pendingOrders);
            updateElementText('dashboard-completed-orders', stats.completedOrders);
            updateElementText('dashboard-total-income', `¥${stats.totalIncome}`);
            updateElementText('dashboard-month-income', `¥${stats.monthIncome}`);
            updateElementText('dashboard-total-suppliers', stats.totalSuppliers);

            // 更新净利润（如果有对应元素）
            updateElementText('dashboard-net-profit', `¥${stats.netProfit}`);

            console.log('[Dashboard] ✅ 仪表盘渲染完成');
            console.log('[Dashboard] 统计数据:', stats);
        } catch (error) {
            console.error('[Dashboard] ❌ 渲染仪表盘失败:', error);
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast(`仪表盘渲染失败：${error.message}`, 'error');
            }
        }
    }

    /**
     * 刷新仪表盘数据
     * @param {number} interval - 刷新间隔（毫秒，0为仅刷新一次）
     */
    function refreshDashboard(interval = 0) {
        try {
            renderDashboard();
            
            if (interval > 0) {
                clearInterval(refreshTimer);
                refreshTimer = setInterval(renderDashboard, interval);
                console.log(`[Dashboard] ✅ 已设置自动刷新，间隔${interval}ms`);
            } else {
                console.log('[Dashboard] ✅ 仪表盘已刷新');
            }
        } catch (error) {
            console.error('[Dashboard] ❌ 刷新失败:', error);
        }
    }

    /**
     * 停止自动刷新
     */
    function stopAutoRefresh() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
            console.log('[Dashboard] ✅ 已停止自动刷新');
        }
    }

    /**
     * 启动实时时钟
     */
    function startClock() {
        try {
            const updateClock = () => {
                const now = new Date();
                const timeString = now.toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });
                
                const clockElement = document.getElementById('current-time');
                if (clockElement) {
                    clockElement.textContent = timeString;
                }
            };

            // 立即更新一次
            updateClock();
            
            // 每秒更新
            if (clockTimer) {
                clearInterval(clockTimer);
            }
            clockTimer = setInterval(updateClock, 1000);
            
            console.log('[Dashboard] ✅ 实时时钟已启动');
        } catch (error) {
            console.error('[Dashboard] ❌ 启动时钟失败:', error);
        }
    }

    /**
     * 停止实时时钟
     */
    function stopClock() {
        if (clockTimer) {
            clearInterval(clockTimer);
            clockTimer = null;
            console.log('[Dashboard] ✅ 实时时钟已停止');
        }
    }

    /**
     * 更新同步时间显示
     * @param {Date} syncTime - 同步时间
     */
    function updateLastSyncTime(syncTime = new Date()) {
        try {
            const lastSyncElement = document.getElementById('last-sync');
            if (lastSyncElement) {
                const timeString = syncTime.toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
                lastSyncElement.textContent = `上次同步: ${timeString}`;
            }
        } catch (error) {
            console.error('[Dashboard] ❌ 更新同步时间失败:', error);
        }
    }

    /**
     * 设置目标金额
     * @param {number} target - 目标金额
     */
    function setTarget(target) {
        try {
            if (typeof target !== 'number' || target <= 0) {
                throw new Error('目标金额必须是大于0的数字');
            }
            
            // 保存到设置
            const settings = JSON.parse(localStorage.getItem(
                window.WorkbenchConfig?.STORAGE_KEYS?.SETTINGS || 'v5_erp_settings'
            ) || '{}');
            
            settings.target = target;
            
            localStorage.setItem(
                window.WorkbenchConfig?.STORAGE_KEYS?.SETTINGS || 'v5_erp_settings',
                JSON.stringify(settings)
            );
            
            console.log('[Dashboard] ✅ 目标金额已设置:', target);
            
            // 刷新仪表盘
            renderDashboard();
        } catch (error) {
            console.error('[Dashboard] ❌ 设置目标金额失败:', error);
        }
    }

    /**
     * 设置汇率
     * @param {number} rate - 汇率
     */
    function setExchangeRate(rate) {
        try {
            if (typeof rate !== 'number' || rate <= 0) {
                throw new Error('汇率必须是大于0的数字');
            }
            
            // 保存到设置
            const settings = JSON.parse(localStorage.getItem(
                window.WorkbenchConfig?.STORAGE_KEYS?.SETTINGS || 'v5_erp_settings'
            ) || '{}');
            
            settings.rate = rate;
            
            localStorage.setItem(
                window.WorkbenchConfig?.STORAGE_KEYS?.SETTINGS || 'v5_erp_settings',
                JSON.stringify(settings)
            );
            
            console.log('[Dashboard] ✅ 汇率已设置:', rate);
            
            // 刷新仪表盘
            renderDashboard();
        } catch (error) {
            console.error('[Dashboard] ❌ 设置汇率失败:', error);
        }
    }

    /**
     * 获取当前设置
     * @returns {Object} 设置对象
     */
    function getSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem(
                window.WorkbenchConfig?.STORAGE_KEYS?.SETTINGS || 'v5_erp_settings'
            ) || '{}');
            
            return {
                target: settings.target || 5000000,
                exchangeRate: settings.rate || 7.25,
                firebaseEnabled: settings.firebaseEnabled || false
            };
        } catch (error) {
            console.error('[Dashboard] ❌ 获取设置失败:', error);
            return {
                target: 5000000,
                exchangeRate: 7.25,
                firebaseEnabled: false
            };
        }
    }

    /**
     * 清理定时器（页面卸载时调用）
     */
    function cleanup() {
        stopAutoRefresh();
        stopClock();
        console.log('[Dashboard] ✅ 已清理定时器');
    }

    // 页面卸载时清理
    if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', cleanup);
    }

    // 公共API
    const api = {
        // 初始化
        init,
        
        // 渲染操作
        renderDashboard,
        refreshDashboard,
        stopAutoRefresh,
        
        // 时钟操作
        startClock,
        stopClock,
        
        // 数据统计
        getDashboardStats,
        
        // 设置管理
        setTarget,
        setExchangeRate,
        getSettings,
        
        // 同步时间
        updateLastSyncTime,
        
        // 工具方法
        updateElementText,
        
        // 清理
        cleanup
    };

    return api;
})();

// 挂载到全局
window.WorkbenchDashboard = WorkbenchDashboard;

// 模块导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkbenchDashboard;
} else if (typeof define === 'function' && define.amd) {
    define([], () => WorkbenchDashboard);
}

console.log('[Dashboard] 仪表盘模块已加载（修复版）');
