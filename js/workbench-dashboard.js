/**
 * V14.7 SURVIVAL - 仪表盘模块（生存优先级版）
 * 在 V14.6 基础上升级，不破坏原功能
 * 版本: 14.7.0
 */
const WorkbenchDashboard = (() => {
    'use strict';

    let refreshTimer = null;
    let clockTimer = null;
    let globalClockTimer = null;

    const GLOBAL_TIME_ZONES = [
        { city: 'Kunshan',  label: '🇨🇳 Base',   tz: 'Asia/Shanghai',    offset: 8 },
        { city: 'Manila',   label: '🇵🇭 Mikki',  tz: 'Asia/Manila',      offset: 8 },
        { city: 'Istanbul', label: '🇹🇷 Turhan', tz: 'Europe/Istanbul',  offset: 3 },
        { city: 'Dubai',    label: '🇦🇪 Gulf',   tz: 'Asia/Dubai',       offset: 4 },
        { city: 'London',   label: '🇬🇧 Amazon', tz: 'Europe/London',    offset: 0 },
        { city: 'New York', label: '🇺🇸 Market', tz: 'America/New_York', offset: -5 }
    ];

    /* ================= 生存级新增：CRM 数据 ================= */

    function loadCustomers() {
        try {
            return JSON.parse(localStorage.getItem('v5_erp_customers') || '[]');
        } catch {
            return [];
        }
    }

    function getP0Stats() {
        const customers = loadCustomers();
        const now = Date.now();

        const p0 = customers.filter(c => c.priority === 'P0');

        const expected = p0.reduce((sum, c) => {
            const v = Number(c.expectedAmount);
            return sum + (isNaN(v) ? 0 : v);
        }, 0);

        const overdue = p0.filter(c => {
            if (!c.updatedAt) return true;
            return (now - new Date(c.updatedAt).getTime()) > 72 * 3600000;
        });

        return {
            p0Count: p0.length,
            p0ExpectedAmount: expected,
            p0OverdueCount: overdue.length,
            p0List: p0
        };
    }

    /* ================= 原有统计 + 生存叠加 ================= */

    function getDashboardStats() {
        let orders = [], incomes = [], suppliers = [], expenses = [];

        try {
            orders = JSON.parse(localStorage.getItem('v5_erp_orders') || '[]');
            incomes = JSON.parse(localStorage.getItem('v5_erp_incomes') || '[]');
            suppliers = JSON.parse(localStorage.getItem('v5_erp_suppliers') || '[]');
            expenses = JSON.parse(localStorage.getItem('v5_erp_expenses') || '[]');
        } catch {}

        const now = new Date();

        const totalIncome = incomes.reduce((s, i) => s + (Number(i.amount) || 0), 0);

        const monthIncome = incomes.filter(i => {
            const d = new Date(i.createTime || i.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).reduce((s, i) => s + (Number(i.amount) || 0), 0);

        const monthExpense = expenses.filter(e => {
            const d = new Date(e.createdAt || e.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).reduce((s, e) => s + (Number(e.amount) || 0), 0);

        let hoursSinceIncome = 0;
        if (incomes.length) {
            const sorted = [...incomes].sort((a, b) =>
                new Date(b.createTime || b.date) - new Date(a.createTime || a.date)
            );
            const last = sorted[0];
            hoursSinceIncome = Math.floor((now - new Date(last.createTime || last.date)) / 36e5);
        }

        return {
            totalIncome,
            monthIncome,
            monthExpense,
            netProfit: monthIncome - monthExpense,
            totalOrders: orders.length,
            totalSuppliers: suppliers.length,
            hoursSinceIncome,
            ...getP0Stats()
        };
    }

    /* ================= 渲染 ================= */

    function renderDashboard() {
        const s = getDashboardStats();

        update('dashboard-total-income', `¥${s.totalIncome.toFixed(2)}`);
        update('dashboard-month-income', `¥${s.monthIncome.toFixed(2)}`);
        update('dashboard-net-profit', `¥${s.netProfit.toFixed(2)}`);
        update('hours-since-income', s.hoursSinceIncome);

        // 🔴 生存指标（新增）
        update('kpi-p0-count', s.p0Count);
        update('kpi-p0-amount', `¥${s.p0ExpectedAmount.toFixed(2)}`);
        update('kpi-p0-overdue', s.p0OverdueCount);

        console.log('[Dashboard] 生存态势已刷新');
    }

    function update(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    /* ================= 全球时钟升级（P0 联动）================= */

    function startGlobalClock() {
        const container = document.getElementById('global-clock-grid');
        if (!container) return;

        const updateClock = () => {
            const now = new Date();
            const { p0List } = getP0Stats();

            // 更新本地时间参考
            const localRef = document.getElementById('local-time-ref');
            if (localRef) {
                localRef.textContent = `Local: ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
            }

            container.innerHTML = GLOBAL_TIME_ZONES.map(tz => {
                let hour;
                let timeStr;

                try {
                    timeStr = new Intl.DateTimeFormat('en-GB', {
                        timeZone: tz.tz,
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    }).format(now);
                    hour = parseInt(timeStr.split(':')[0]);
                } catch {
                    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
                    const d = new Date(utc + tz.offset * 3600000);
                    hour = d.getHours();
                    timeStr = `${String(hour).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                }

                const open = hour >= 9 && hour < 18;
                const lunch = hour === 12;
                const sleeping = hour >= 22 || hour < 7;

                // 检查该地区是否有 P0 客户
                const hasP0 = p0List.some(c => {
                    const country = (c.country || '').toLowerCase();
                    const city = tz.city.toLowerCase();
                    // 简单匹配逻辑
                    if (city === 'kunshan' && country === 'china') return true;
                    if (city === 'manila' && country === 'philippines') return true;
                    if (city === 'istanbul' && country === 'turkey') return true;
                    if (city === 'dubai' && (country.includes('uae') || country.includes('gulf'))) return true;
                    if (city === 'london' && country === 'uk') return true;
                    if (city === 'new york' && country === 'usa') return true;
                    return false;
                });

                const danger = open && hasP0;

                // 样式逻辑
                let statusClass, dotClass, statusText;
                if (danger) {
                    statusClass = 'border-red-600 bg-red-900/30 animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.3)]';
                    dotClass = 'bg-red-500 animate-pulse';
                    statusText = 'P0 ACTIVE';
                } else if (open) {
                    if (lunch) {
                        statusClass = 'border-yellow-500/50 bg-yellow-900/20';
                        dotClass = 'bg-yellow-500';
                        statusText = 'LUNCH';
                    } else {
                        statusClass = 'border-green-500/50 bg-green-900/20 shadow-[0_0_15px_rgba(34,197,94,0.15)]';
                        dotClass = 'bg-green-500 animate-pulse';
                        statusText = 'OPEN';
                    }
                } else if (sleeping) {
                    statusClass = 'border-blue-900/50 bg-blue-900/10 opacity-60';
                    dotClass = 'bg-blue-400';
                    statusText = 'ZZZ';
                } else {
                    statusClass = 'border-gray-600/30 bg-dark-3/50 opacity-70';
                    dotClass = 'bg-gray-500';
                    statusText = 'OFF';
                }

                return `
                    <div class="rounded-lg p-3 text-center transition-all duration-300 border ${statusClass} hover:scale-105 cursor-default">
                        <div class="text-[10px] text-gray-400 uppercase tracking-wider mb-1 font-medium">${tz.label}</div>
                        <div class="text-2xl font-mono font-bold text-white tracking-tight leading-none">${timeStr}</div>
                        <div class="mt-2 flex items-center justify-center gap-1.5">
                            <div class="w-2 h-2 rounded-full ${dotClass}"></div>
                            <span class="text-[9px] font-bold ${danger ? 'text-red-400' : 'text-gray-500'} uppercase">${statusText}</span>
                        </div>
                    </div>
                `;
            }).join('');
        };

        updateClock();
        if (globalClockTimer) clearInterval(globalClockTimer);
        globalClockTimer = setInterval(updateClock, 60000);
        console.log('[Dashboard] ✅ V14.7 全球时钟已启动（P0 联动）');
    }

    /* ================= 生命周期 ================= */

    function init() {
        renderDashboard();
        startGlobalClock();
        startClock();
        console.log('[Dashboard] ✅ V14.7 生存仪表盘已启动');
    }

    function startClock() {
        const el = document.getElementById('current-time');
        if (!el) return;

        const tick = () => {
            el.textContent = new Date().toLocaleTimeString('zh-CN', {
                hour12: false
            });
        };
        tick();
        if (clockTimer) clearInterval(clockTimer);
        clockTimer = setInterval(tick, 1000);
    }

    return {
        init,
        renderDashboard,
        startGlobalClock,
        getDashboardStats,
        getP0Stats
    };
})();

window.WorkbenchDashboard = WorkbenchDashboard;
console.log('[Dashboard] 已加载 V14.7 Survival');
