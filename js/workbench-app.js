/**
 * V14.2 PRO - 主应用入口
 * 负责初始化所有模块和协调应用流程
 */
const app = {
system: {
version: '14.2.0',
isReady: false,
survivalModeEnabled: true,
loadedModules: [],
errors: []
},

survival: {
initCheck() {
if (!app.system.survivalModeEnabled) {
console.log('[Survival] 生存模式已禁用');
return;
}
try {
const actions = localStorage.getItem('v5_erp_today_actions');
const unlockTime = localStorage.getItem('v5_erp_unlock_time');
if (!actions || !unlockTime) {
document.getElementById('iron-curtain').classList.remove('hidden');
console.log('[Survival] 需要设置今日三件事');
} else {
const now = Date.now();
const unlock = parseInt(unlockTime);
if (now > unlock) {
document.getElementById('iron-curtain').classList.remove('hidden');
localStorage.removeItem('v5_erp_today_actions');
localStorage.removeItem('v5_erp_unlock_time');
console.log('[Survival] 今日行动已过期');
} else {
this.showTodayActions();
console.log('[Survival] 今日行动有效');
}
}
} catch (error) {
console.error('[Survival] 检查失败:', error);
app.system.survivalModeEnabled = false;
if (window.WorkbenchUtils) {
WorkbenchUtils.toast('生存模式检查失败', 'warning');
}
}
},

checkInputs() {
const action1 = document.getElementById('action-1')?.value.trim();
const action2 = document.getElementById('action-2')?.value.trim();
const action3 = document.getElementById('action-3')?.value.trim();
const btn = document.getElementById('battle-start-btn');
if (action1 && action2 && action3) {
btn.disabled = false;
} else {
btn.disabled = true;
}
},

startBattle() {
const actions = [
document.getElementById('action-1')?.value.trim(),
document.getElementById('action-2')?.value.trim(),
document.getElementById('action-3')?.value.trim()
];
try {
localStorage.setItem('v5_erp_today_actions', JSON.stringify(actions));
localStorage.setItem('v5_erp_unlock_time', (Date.now() + 24 * 60 * 60 * 1000).toString());
document.getElementById('iron-curtain').classList.add('hidden');
this.showTodayActions();
if (window.WorkbenchUtils) {
WorkbenchUtils.toast('战斗开始！今日必胜！', 'success');
}
} catch (error) {
console.error('[Survival] 保存失败:', error);
if (window.WorkbenchUtils) {
WorkbenchUtils.toast('保存失败', 'error');
}
}
},

emergencyOverride() {
if (confirm('确定要使用紧急进入吗？（仅10分钟有效）')) {
try {
localStorage.setItem('v5_erp_today_actions', JSON.stringify(['紧急任务', '临时工作', '快速处理']));
const emergencyExpiry = Date.now() + 10 * 60 * 1000;
localStorage.setItem('v5_erp_unlock_time', emergencyExpiry.toString());
document.getElementById('iron-curtain').classList.add('hidden');
const warning = document.getElementById('emergency-mode-warning');
warning.classList.remove('hidden');
this.startEmergencyTimer(emergencyExpiry);
if (window.WorkbenchUtils) {
WorkbenchUtils.toast('紧急模式已激活', 'warning');
}
} catch (error) {
console.error('[Survival] 紧急模式失败:', error);
}
}
},

startEmergencyTimer(expiry) {
const timer = document.getElementById('emergency-timer');
const interval = setInterval(() => {
const remaining = Math.max(0, Math.floor((expiry - Date.now()) / 60000));
if (timer) timer.textContent = remaining;
if (remaining <= 0) {
clearInterval(interval);
localStorage.removeItem('v5_erp_today_actions');
localStorage.removeItem('v5_erp_unlock_time');
location.reload();
}
}, 1000);
},

showTodayActions() {
try {
const actionsStr = localStorage.getItem('v5_erp_today_actions');
if (!actionsStr) return;
const actions = JSON.parse(actionsStr);
const banner = document.getElementById('today-actions-banner');
const list = document.getElementById('today-actions-list');
if (list) {
list.innerHTML = actions.map((action, i) => `
<div class="flex items-center gap-2 text-white/90">
<span class="text-yellow-400 font-bold">${i + 1}.</span>
<span>${action}</span>
</div>
`).join('');
}
if (banner) banner.classList.remove('hidden');
} catch (error) {
console.error('[Survival] 显示今日行动失败:', error);
}
}
},

switchTab(tabId) {
// 移除所有活动标签
document.querySelectorAll('.tab-content').forEach(tab => {
tab.classList.remove('active');
});

// 重置所有导航按钮
document.querySelectorAll('.nav-tab').forEach(tab => {
tab.classList.remove('text-white', 'font-bold');
tab.classList.add('text-gray-300');
});

// 激活目标标签
const targetTab = document.getElementById(`tab-${tabId}`);
if (targetTab) {
targetTab.classList.add('active');
}

// 高亮当前导航
const activeTab = Array.from(document.querySelectorAll('.nav-tab')).find(tab => {
return tab.onclick && tab.onclick.toString().includes(`switchTab('${tabId}')`);
});
if (activeTab) {
activeTab.classList.remove('text-gray-300');
activeTab.classList.add('text-white', 'font-bold');
}

// 渲染对应模块
if (tabId === 'dashboard' && window.WorkbenchDashboard?.renderDashboard) {
WorkbenchDashboard.renderDashboard();
} else if (tabId === 'kanban' && window.WorkbenchOrders?.renderKanban) {
WorkbenchOrders.renderKanban();
} else if (tabId === 'crm' && window.WorkbenchCRM?.renderCustomers) {
WorkbenchCRM.renderCustomers();
} else if (tabId === 'suppliers' && window.WorkbenchSuppliers?.render) {
WorkbenchSuppliers.render();
} else if (tabId === 'expenses' && window.WorkbenchExpenses?.render) {
WorkbenchExpenses.render();
}
},

clearTodayActions: async () => {
const confirmed = window.WorkbenchModal ?
await WorkbenchModal.confirm('确定要清除今日行动并重新登录吗？', {
title: '清除确认',
confirmText: '确认清除',
cancelText: '取消'
}) :
confirm('确定要清除今日行动并重新登录吗？');

if (confirmed) {
localStorage.removeItem('v5_erp_today_actions');
localStorage.removeItem('v5_erp_unlock_time');
location.reload();
}
},

openSettings: () => {
if (!window.WorkbenchModal) {
alert('模态框模块未加载');
return;
}

const settings = JSON.parse(localStorage.getItem('v5_erp_settings') || '{}');
WorkbenchModal.open({
title: '系统设置',
size: 'lg',
content: `
<form id="settings-form" class="space-y-4">
<div>
<label class="block text-sm font-medium text-gray-300 mb-2">目标金额（人民币）</label>
<input type="number" id="settings-target" value="${settings.target || ''}"
class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
</div>
<div>
<label class="block text-sm font-medium text-gray-300 mb-2">美元汇率</label>
<input type="number" id="settings-rate" value="${settings.rate || ''}" step="0.0001"
class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
</div>
<div>
<label class="block text-sm font-medium text-gray-300 mb-2">
<input type="checkbox" id="settings-survival" ${app.system.survivalModeEnabled ? 'checked' : ''} class="mr-2">
启用生存模式（每日任务）
</label>
</div>
</form>
`,
buttons: [
{
text: '取消',
className: 'bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded',
onClick: (modal) => WorkbenchModal.close(modal)
},
{
text: '保存',
className: 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded',
onClick: (modal) => {
app.saveSettings();
WorkbenchModal.close(modal);
}
}
]
});
},

saveSettings: () => {
const settings = {
target: document.getElementById('settings-target')?.value,
rate: document.getElementById('settings-rate')?.value
};
const survivalEnabled = document.getElementById('settings-survival')?.checked;
app.system.survivalModeEnabled = survivalEnabled;
localStorage.setItem('v5_erp_settings', JSON.stringify(settings));
if (window.WorkbenchUtils) {
WorkbenchUtils.toast('设置已保存', 'success');
}
},

logout: async () => {
const confirmed = window.WorkbenchModal ?
await WorkbenchModal.confirm('确定要退出系统吗？', {
title: '退出确认',
confirmText: '确认退出',
cancelText: '取消'
}) :
confirm('确定要退出系统吗？');

if (confirmed) {
localStorage.removeItem('v5_erp_today_actions');
localStorage.removeItem('v5_erp_unlock_time');
location.reload();
}
},

kanban: {
openQuickAdd: () => {
if (window.WorkbenchOrders?.openQuickAddModal) {
WorkbenchOrders.openQuickAddModal();
} else {
if (window.WorkbenchUtils) {
WorkbenchUtils.toast('订单模块尚未加载完成', 'warning');
}
}
}
},

crm: {
openCustomerModal: () => {
if (window.WorkbenchCRM?.openCustomerModal) {
WorkbenchCRM.openCustomerModal();
} else {
if (window.WorkbenchUtils) {
WorkbenchUtils.toast('CRM模块开发中', 'info');
}
}
}
},

expenses: {
openAddModal: () => {
if (window.WorkbenchExpenses?.openExpenseModal) {
WorkbenchExpenses.openExpenseModal();
} else {
if (window.WorkbenchUtils) {
WorkbenchUtils.toast('支出模块尚未加载完成', 'warning');
}
}
}
},

suppliers: {
openAddModal: () => {
if (window.WorkbenchSuppliers?.openAddModal) {
WorkbenchSuppliers.openAddModal();
} else {
if (window.WorkbenchUtils) {
WorkbenchUtils.toast('供应商模块开发中', 'info');
}
}
}
},

init: () => {
console.log('[V14.2 PRO] 应用初始化开始...');

// 检查模块加载
if (!window.checkModulesLoaded || !checkModulesLoaded()) {
console.error('[App] 模块加载不完整，初始化失败');
return;
}

// 初始化各模块
const modules = [
'WorkbenchConfig',
'WorkbenchUtils',
'WorkbenchModal',
'WorkbenchState',
'WorkbenchStorage',
'WorkbenchAuth',
'WorkbenchDashboard',
'WorkbenchOrders',
'WorkbenchSuppliers',
'WorkbenchFinance',
'WorkbenchExpenses',
'WorkbenchCRM'
];

modules.forEach(moduleName => {
try {
const module = window[moduleName];
if (module && module.init) {
const result = module.init();
if (result !== false) {
app.system.loadedModules.push(moduleName);
console.log(`✅ ${moduleName} 初始化成功`);
} else {
console.warn(`⚠️ ${moduleName} 初始化失败`);
app.system.errors.push(`${moduleName} 初始化返回 false`);
}
}
} catch (error) {
console.error(`❌ ${moduleName} 初始化异常:`, error);
app.system.errors.push(`${moduleName}: ${error.message}`);
}
});

// 生存模式检查
app.survival.initCheck();

// 切换到仪表盘
app.switchTab('dashboard');

// 启动时钟
if (window.WorkbenchDashboard?.startClock) {
WorkbenchDashboard.startClock();
}

// 标记系统就绪
app.system.isReady = true;

console.log('[V14.2 PRO] 应用初始化完成！');
console.log('[V14.2 PRO] 已加载模块:', app.system.loadedModules);

if (app.system.errors.length > 0) {
console.warn('[V14.2 PRO] ⚠️ 初始化过程中有错误:', app.system.errors);
}

if (window.WorkbenchUtils) {
WorkbenchUtils.toast('系统已就绪，祝您工作顺利！', 'success');
}
},

updateSyncStatus: (text, isConnected) => {
const syncStatus = document.getElementById('sync-status');
const lastSync = document.getElementById('last-sync');
if (syncStatus) {
const icon = syncStatus.querySelector('i');
const span = syncStatus.querySelector('span');
if (isConnected) {
icon?.classList.remove('fa-cloud', 'text-gray-400');
icon?.classList.add('fa-cloud-upload-alt', 'text-green-400');
if (span) {
span.textContent = text;
span.classList.remove('text-gray-400');
span.classList.add('text-green-400');
}
} else {
icon?.classList.remove('fa-cloud-upload-alt', 'text-green-400');
icon?.classList.add('fa-cloud', 'text-gray-400');
if (span) {
span.textContent = text;
span.classList.remove('text-green-400');
span.classList.add('text-gray-400');
}
}
}
if (lastSync && isConnected) lastSync.textContent = '刚刚';
}
};

// DOMContentLoaded 事件监听
document.addEventListener('DOMContentLoaded', async function() {
console.log('[V14.2 PRO] DOM加载完成，开始系统初始化...');

try {
// 延迟以确保所有脚本加载完成
await new Promise(resolve => setTimeout(resolve, 500));

// 更新进度
const progressEl = document.getElementById('loading-progress');
if (progressEl) progressEl.textContent = '100% 完成';

// 隐藏加载界面
setTimeout(() => {
const loadingEl = document.getElementById('system-loading');
if (loadingEl) loadingEl.style.display = 'none';

// 初始化应用
app.init();
}, 500);

} catch (error) {
console.error('[V14.2 PRO] ❌ 初始化失败:', error);
const errorDiv = document.getElementById('loading-error');
if (errorDiv) {
errorDiv.classList.remove('hidden');
errorDiv.innerHTML = `
<strong>系统初始化失败</strong><br>
错误: ${error.message}<br>
<button onclick="location.reload()" class="mt-2 px-4 py-2 bg-red-600 rounded hover:bg-red-700">
重新加载
</button>
`;
}
}
});

// 挂载到全局
window.app = app;
console.log('[App] 主应用脚本已加载');
