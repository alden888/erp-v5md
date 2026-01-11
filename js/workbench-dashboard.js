/**
 * V14.6 PRO - 仪表盘模块（全球时钟升级版）
 * 数据统计、可视化、趋势分析、全球商机时钟
 * @namespace WorkbenchDashboard
 */
const WorkbenchDashboard = (() => {
    'use strict';

    // 定时器
    let refreshTimer = null;
    let clockTimer = null;
    let globalClockTimer = null;

    // 🌍 全球商机时钟配置 - 可自定义
    const GLOBAL_TIME_ZONES = [
        { city: 'Kunshan',   label: '🇨🇳 Base',    tz: 'Asia/Shanghai',      offset: 8 },
        { city: 'Manila',    label: '🇵🇭 Mikki',   tz: 'Asia/Manila',        offset: 8 },
        { city: 'Istanbul',  label: '🇹🇷 Turhan',  tz: 'Europe/Istanbul',    offset: 3 },
        { city: 'Dubai',     label: '🇦🇪 Gulf',    tz: 'Asia/Dubai',         offset: 4 },
        { city: 'London',    label: '🇬🇧 Amazon',  tz: 'Europe/London',      offset: 0 },
        { city: 'New York',  label: '🇺🇸 Market',  tz: 'America/New_York',   offset: -5 }
    ];

    // 🔥 励志金句
    const MOTIVATIONAL_QUOTES = [
        "Every 'No' brings you closer to a 'Yes'. 每一次拒绝都让你离成交更近",
        "Quality is the best business plan. 质量是最好的商业计划",
        "Don't wait for opportunity. Create it. 不要等待机会，去创造它",
        "今天多打一个电话，明天多一个订单！",
        "Speed is the new currency of business. 速度是新的商业货币",
        "500万不是梦，是必须拿下的山头！",
        "Great things never come from comfort zones. 伟大成就从不源于舒适区",
        "Your network is your net worth. 你的人脉就是你的净资产",
        "成交之前的每一次拒绝，都是在积累运气。",
        "Action is the foundational key to all success. 行动是所有成功的基石",
        "The fortune is in the follow-up. 财富在跟进中",
        "今日事今日毕，明日订单滚滚来！"
    ];

    /**
     * 初始化仪表盘模块
     */
    function init() {
        try {
            console.log('[Dashboard] 仪表盘模块初始化中...');
            renderDashboard();
            bindEvents();
            startGlobalClock();
            startClock();
            showDailyQuote();
            console.log('[Dashboard] ✅ 仪表盘模块已初始化（含全球时钟）');
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
     */
    function updateElementText(id, text) {
        try {
            const element = document.getElementById(id);
            if (!element) return;
            element.textContent = typeof text === 'string' || typeof text === 'number' ? text.toString() : '';
        } catch (error) {
            console.error('[Dashboard] ❌ 更新元素文本失败:', error);
        }
    }

    /**
     * 统计仪表盘核心数据
     */
    function getDashboardStats() {
        try {
            let orders = [], incomes = [], suppliers = [], expenses = [];

            // 从存储获取数据
            if (window.WorkbenchStorage) {
                orders = WorkbenchStorage.load('orders') || [];
                incomes = WorkbenchStorage.load('incomes') || [];
                suppliers = WorkbenchStorage.load('suppliers') || [];
                expenses = WorkbenchStorage.load('expenses') || [];
            } else {
                const ordersKey = window.WorkbenchConfig?.STORAGE_KEYS?.ORDERS || 'v5_erp_orders';
                const incomesKey = window.WorkbenchConfig?.STORAGE_KEYS?.INCOMES || 'v5_erp_incomes';
                const suppliersKey = window.WorkbenchConfig?.STORAGE_KEYS?.SUPPLIERS || 'v5_erp_suppliers';
                const expensesKey = window.WorkbenchConfig?.STORAGE_KEYS?.EXPENSES || 'v5_erp_expenses';
                
                orders = JSON.parse(localStorage.getItem(ordersKey) || '[]');
                incomes = JSON.parse(localStorage.getItem(incomesKey) || '[]');
                suppliers = JSON.parse(localStorage.getItem(suppliersKey) || '[]');
                expenses = JSON.parse(localStorage.getItem(expensesKey) || '[]');
            }

            const totalOrders = orders.length;
            const pendingOrders = orders.filter(o => 
                ['inquiry', 'pi', 'production', 'New', 'Processing'].includes(o.kanbanStatus)
            ).length;
            const completedOrders = orders.filter(o => 
                ['paid', 'shipped', 'Paid', 'Shipped', 'Completed'].includes(o.kanbanStatus)
            ).length;

            const totalIncome = incomes.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
            
            const now = new Date();
            const monthIncome = incomes
                .filter(item => {
                    const itemDate = new Date(item.createTime || item.date);
                    return itemDate.getMonth() === now.getMonth() && 
                           itemDate.getFullYear() === now.getFullYear();
                })
                .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

            const monthExpense = expenses
                .filter(item => {
                    const itemDate = new Date(item.createdAt || item.date);
                    return itemDate.getMonth() === now.getMonth() && 
                           itemDate.getFullYear() === now.getFullYear();
                })
                .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

            // 计算距上次进账的小时数
            let hoursSinceIncome = 0;
            if (incomes.length > 0) {
                const sortedIncomes = [...incomes].sort((a, b) => 
                    new Date(b.createTime || b.date) - new Date(a.createTime || a.date)
                );
                const lastIncomeDate = new Date(sortedIncomes[0].createTime || sortedIncomes[0].date);
                hoursSinceIncome = Math.floor((now - lastIncomeDate) / (1000 * 60 * 60));
            }

            return {
                totalOrders,
                pendingOrders,
                completedOrders,
                totalIncome: totalIncome.toFixed(2),
                monthIncome: monthIncome.toFixed(2),
                monthExpense: monthExpense.toFixed(2),
                netProfit: (monthIncome - monthExpense).toFixed(2),
                totalSuppliers: suppliers.length,
                hoursSinceIncome
            };
        } catch (error) {
            console.error('[Dashboard] ❌ 统计数据失败:', error);
            return {
                totalOrders: 0, pendingOrders: 0, completedOrders: 0,
                totalIncome: '0.00', monthIncome: '0.00', monthExpense: '0.00',
                netProfit: '0.00', totalSuppliers: 0, hoursSinceIncome: 0
            };
        }
    }

    /**
     * 渲染仪表盘
     */
    function renderDashboard() {
        try {
            const stats = getDashboardStats();

            updateElementText('dashboard-total-orders', `订单: ${stats.totalOrders}`);
            updateElementText('dashboard-pending-orders', `待处理: ${stats.pendingOrders}`);
            updateElementText('dashboard-completed-orders', `已完成: ${stats.completedOrders}`);
            updateElementText('dashboard-total-income', `¥${stats.totalIncome}`);
            updateElementText('dashboard-month-income', `¥${stats.monthIncome}`);
            updateElementText('dashboard-total-suppliers', stats.totalSuppliers);
            updateElementText('dashboard-net-profit', `¥${stats.netProfit}`);
            updateElementText('hours-since-income', stats.hoursSinceIncome);

            // 更新KPI卡片
            updateElementText('kpi-revenue', `¥${stats.monthIncome}`);
            updateElementText('kpi-gross', `¥${stats.totalIncome}`);
            updateElementText('kpi-net', `¥${stats.netProfit}`);

            console.log('[Dashboard] ✅ 仪表盘渲染完成');
        } catch (error) {
            console.error('[Dashboard] ❌ 渲染仪表盘失败:', error);
        }
    }

    /**
     * 🌍 启动全球商机时钟
     */
    function startGlobalClock() {
        const container = document.getElementById('global-clock-grid');
        if (!container) {
            console.warn('[Dashboard] 全球时钟容器未找到');
            return;
        }

        const updateGlobalClock = () => {
            const now = new Date();
            
            // 更新本地时间参考
            const localRef = document.getElementById('local-time-ref');
            if (localRef) {
                localRef.textContent = `Local: ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
            }

            container.innerHTML = GLOBAL_TIME_ZONES.map(tz => {
                let timeString, hour;
                
                // 尝试使用 Intl API (更精确)
                try {
                    const options = { timeZone: tz.tz, hour: 'numeric', minute: '2-digit', hour12: false };
                    timeString = new Intl.DateTimeFormat('en-GB', options).format(now);
                    hour = parseInt(timeString.split(':')[0]);
                } catch (e) {
                    // 降级到偏移量计算
                    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                    const cityTime = new Date(utc + (3600000 * tz.offset));
                    hour = cityTime.getHours();
                    const minute = cityTime.getMinutes().toString().padStart(2, '0');
                    timeString = `${hour}:${minute}`;
                }

                // 状态判断
                let statusClass, dotClass, statusText;
                
                if (hour >= 9 && hour < 18) {
                    if (hour === 12) {
                        // 午餐时间
                        statusClass = 'border-yellow-500/50 bg-yellow-900/20';
                        dotClass = 'bg-yellow-500';
                        statusText = 'LUNCH';
                    } else {
                        // 工作时间 (OPEN)
                        statusClass = 'border-green-500/50 bg-green-900/20 shadow-[0_0_15px_rgba(34,197,94,0.15)]';
                        dotClass = 'bg-green-500 animate-pulse';
                        statusText = 'OPEN';
                    }
                } else if (hour >= 22 || hour < 7) {
                    // 睡眠时间
                    statusClass = 'border-blue-900/50 bg-blue-900/10 opacity-60';
                    dotClass = 'bg-blue-400';
                    statusText = 'ZZZ';
                } else {
                    // 下班/休息
                    statusClass = 'border-gray-600/30 bg-dark-3/50 opacity-70';
                    dotClass = 'bg-gray-500';
                    statusText = 'OFF';
                }

                return `
                    <div class="rounded-lg p-3 text-center transition-all duration-300 border ${statusClass} hover:scale-105 cursor-default">
                        <div class="text-[10px] text-gray-400 uppercase tracking-wider mb-1 font-medium">${tz.label}</div>
                        <div class="text-2xl font-mono font-bold text-white tracking-tight leading-none">${timeString}</div>
                        <div class="mt-2 flex items-center justify-center gap-1.5">
                            <div class="w-2 h-2 rounded-full ${dotClass}"></div>
                            <span class="text-[9px] font-bold text-gray-500 uppercase">${statusText}</span>
                        </div>
                    </div>
                `;
            }).join('');
        };

        // 立即更新一次
        updateGlobalClock();

        // 每分钟更新
        if (globalClockTimer) clearInterval(globalClockTimer);
        globalClockTimer = setInterval(updateGlobalClock, 60000);

        console.log('[Dashboard] ✅ 全球商机时钟已启动');
    }

    /**
     * 停止全球时钟
     */
    function stopGlobalClock() {
        if (globalClockTimer) {
            clearInterval(globalClockTimer);
            globalClockTimer = null;
            console.log('[Dashboard] 全球时钟已停止');
        }
    }

    /**
     * 刷新仪表盘
     */
    function refreshDashboard(interval = 0) {
        try {
            renderDashboard();
            
            if (interval > 0) {
                clearInterval(refreshTimer);
                refreshTimer = setInterval(renderDashboard, interval);
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
        }
    }

    /**
     * 启动本地实时时钟
     */
    function startClock() {
        try {
            const updateClock = () => {
                const now = new Date();
                const timeString = now.toLocaleTimeString('zh-CN', {
                    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
                });
                
                const clockElement = document.getElementById('current-time');
                if (clockElement) clockElement.textContent = timeString;
            };

            updateClock();
            if (clockTimer) clearInterval(clockTimer);
            clockTimer = setInterval(updateClock, 1000);
        } catch (error) {
            console.error('[Dashboard] ❌ 启动时钟失败:', error);
        }
    }

    /**
     * 停止本地时钟
     */
    function stopClock() {
        if (clockTimer) {
            clearInterval(clockTimer);
            clockTimer = null;
        }
    }

    /**
     * 🔥 显示每日励志金句
     */
    function showDailyQuote() {
        const quoteEl = document.getElementById('daily-quote');
        if (quoteEl) {
            const randomQuote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
            quoteEl.textContent = randomQuote;
        }
    }

    /**
     * 更新同步时间
     */
    function updateLastSyncTime(syncTime = new Date()) {
        const lastSyncElement = document.getElementById('last-sync');
        if (lastSyncElement) {
            const timeString = syncTime.toLocaleTimeString('zh-CN', {
                hour: '2-digit', minute: '2-digit', hour12: false
            });
            lastSyncElement.textContent = `上次同步: ${timeString}`;
        }
    }

    /**
     * 获取设置
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
            return { target: 5000000, exchangeRate: 7.25, firebaseEnabled: false };
        }
    }

    /**
     * 设置目标
     */
    function setTarget(target) {
        if (typeof target !== 'number' || target <= 0) return;
        
        const settingsKey = window.WorkbenchConfig?.STORAGE_KEYS?.SETTINGS || 'v5_erp_settings';
        const settings = JSON.parse(localStorage.getItem(settingsKey) || '{}');
        settings.target = target;
        localStorage.setItem(settingsKey, JSON.stringify(settings));
        
        renderDashboard();
    }

    /**
     * 设置汇率
     */
    function setExchangeRate(rate) {
        if (typeof rate !== 'number' || rate <= 0) return;
        
        const settingsKey = window.WorkbenchConfig?.STORAGE_KEYS?.SETTINGS || 'v5_erp_settings';
        const settings = JSON.parse(localStorage.getItem(settingsKey) || '{}');
        settings.rate = rate;
        localStorage.setItem(settingsKey, JSON.stringify(settings));
        
        renderDashboard();
    }

    /**
     * 清理
     */
    function cleanup() {
        stopAutoRefresh();
        stopClock();
        stopGlobalClock();
    }

    // 页面卸载时清理
    if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', cleanup);
    }

    // 公共API
    return {
        init,
        renderDashboard,
        refreshDashboard,
        stopAutoRefresh,
        startClock,
        stopClock,
        startGlobalClock,
        stopGlobalClock,
        getDashboardStats,
        setTarget,
        setExchangeRate,
        getSettings,
        updateLastSyncTime,
        showDailyQuote,
        updateElementText,
        cleanup,
        // 暴露配置供外部修改
        timeZones: GLOBAL_TIME_ZONES,
        quotes: MOTIVATIONAL_QUOTES
    };
})();

// 挂载到全局
window.WorkbenchDashboard = WorkbenchDashboard;

console.log('[Dashboard] 仪表盘模块已加载（V14.6 全球时钟版）');
