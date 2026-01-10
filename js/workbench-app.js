/**
 * V14.2 PRO - 主应用入口
 * 负责初始化所有模块和协调应用流程
 * 修复点：DOM空值检查、定时器清理、类型转换、错误处理、逻辑优化
 */
const app = {
  system: {
    version: '14.2.0',
    isReady: false,
    survivalModeEnabled: true,
    loadedModules: [],
    errors: [],
    emergencyTimer: null // 新增：存储紧急模式定时器，防止内存泄漏
  },

  survival: {
    initCheck() {
      if (!app.system.survivalModeEnabled) {
        console.log('[Survival] 生存模式已禁用');
        return;
      }
      try {
        const ironCurtainEl = document.getElementById('iron-curtain');
        if (!ironCurtainEl) {
          console.warn('[Survival] 未找到 iron-curtain 元素');
          return;
        }

        const actions = localStorage.getItem('v5_erp_today_actions');
        const unlockTime = localStorage.getItem('v5_erp_unlock_time');
        
        // 修复：处理 unlockTime 非数字的情况
        const unlockTimeNum = unlockTime ? parseInt(unlockTime, 10) : NaN;

        if (!actions || !unlockTime || isNaN(unlockTimeNum)) {
          ironCurtainEl.classList.remove('hidden');
          console.log('[Survival] 需要设置今日三件事');
        } else {
          const now = Date.now();
          if (now > unlockTimeNum) {
            ironCurtainEl.classList.remove('hidden');
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
      // 修复：空值保护 + 解构简化
      const action1 = document.getElementById('action-1')?.value.trim() || '';
      const action2 = document.getElementById('action-2')?.value.trim() || '';
      const action3 = document.getElementById('action-3')?.value.trim() || '';
      const btn = document.getElementById('battle-start-btn');
      
      if (btn) { // 修复：检查按钮是否存在
        btn.disabled = !(action1 && action2 && action3);
      }
    },

    startBattle() {
      const action1 = document.getElementById('action-1')?.value.trim() || '';
      const action2 = document.getElementById('action-2')?.value.trim() || '';
      const action3 = document.getElementById('action-3')?.value.trim() || '';
      
      // 前置校验：防止空值提交
      if (!action1 || !action2 || !action3) {
        window.WorkbenchUtils?.toast('请填写完整的今日三件事', 'warning');
        return;
      }

      const actions = [action1, action2, action3];
      try {
        localStorage.setItem('v5_erp_today_actions', JSON.stringify(actions));
        localStorage.setItem('v5_erp_unlock_time', (Date.now() + 24 * 60 * 60 * 1000).toString());
        
        const ironCurtainEl = document.getElementById('iron-curtain');
        if (ironCurtainEl) ironCurtainEl.classList.add('hidden');
        
        this.showTodayActions();
        window.WorkbenchUtils?.toast('战斗开始！今日必胜！', 'success');
      } catch (error) {
        console.error('[Survival] 保存失败:', error);
        window.WorkbenchUtils?.toast('保存失败', 'error');
      }
    },

    emergencyOverride() {
      if (!confirm('确定要使用紧急进入吗？（仅10分钟有效）')) return;

      try {
        // 修复：先清理旧的紧急定时器，防止内存泄漏
        if (app.system.emergencyTimer) {
          clearInterval(app.system.emergencyTimer);
          app.system.emergencyTimer = null;
        }

        localStorage.setItem('v5_erp_today_actions', JSON.stringify(['紧急任务', '临时工作', '快速处理']));
        const emergencyExpiry = Date.now() + 10 * 60 * 1000;
        localStorage.setItem('v5_erp_unlock_time', emergencyExpiry.toString());
        
        const ironCurtainEl = document.getElementById('iron-curtain');
        if (ironCurtainEl) ironCurtainEl.classList.add('hidden');
        
        const warningEl = document.getElementById('emergency-mode-warning');
        if (warningEl) warningEl.classList.remove('hidden');
        
        this.startEmergencyTimer(emergencyExpiry);
        window.WorkbenchUtils?.toast('紧急模式已激活', 'warning');
      } catch (error) {
        console.error('[Survival] 紧急模式失败:', error);
        window.WorkbenchUtils?.toast('紧急模式激活失败', 'error');
      }
    },

    startEmergencyTimer(expiry) {
      const timerEl = document.getElementById('emergency-timer');
      // 清除旧定时器
      if (app.system.emergencyTimer) clearInterval(app.system.emergencyTimer);

      // 修复：定时器存储到全局，便于清理
      app.system.emergencyTimer = setInterval(() => {
        const remaining = Math.max(0, Math.floor((expiry - Date.now()) / 60000));
        if (timerEl) timerEl.textContent = remaining;
        
        if (remaining <= 0) {
          clearInterval(app.system.emergencyTimer);
          app.system.emergencyTimer = null; // 重置定时器引用
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

        // 修复：JSON.parse 异常保护
        let actions = [];
        try {
          actions = JSON.parse(actionsStr);
        } catch (parseError) {
          console.error('[Survival] 解析今日行动失败:', parseError);
          localStorage.removeItem('v5_erp_today_actions');
          return;
        }

        // 修复：空值检查 + 数组类型校验
        if (!Array.isArray(actions) || actions.length === 0) return;
        
        const bannerEl = document.getElementById('today-actions-banner');
        const listEl = document.getElementById('today-actions-list');
        
        if (listEl) {
          listEl.innerHTML = actions.map((action, i) => `
            <div class="flex items-center gap-2 text-white/90">
              <span class="text-yellow-400 font-bold">${i + 1}.</span>
              <span>${action || '未命名任务'}</span> <!-- 修复：空任务名称兜底 -->
            </div>
          `).join('');
        }
        if (bannerEl) bannerEl.classList.remove('hidden');
      } catch (error) {
        console.error('[Survival] 显示今日行动失败:', error);
      }
    }
  },

  switchTab(tabId) {
    // 修复：DOM 操作前先检查元素是否存在
    const tabContents = document.querySelectorAll('.tab-content');
    if (tabContents.length) {
      tabContents.forEach(tab => tab.classList.remove('active'));
    }

    const navTabs = document.querySelectorAll('.nav-tab');
    if (navTabs.length) {
      navTabs.forEach(tab => {
        tab.classList.remove('text-white', 'font-bold');
        tab.classList.add('text-gray-300');
      });
    }

    // 激活目标标签
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) {
      targetTab.classList.add('active');
    }

    // 修复：导航高亮逻辑（替换不可靠的 onclick 字符串判断）
    // 推荐：给导航标签添加 data-tab-id 属性，例如 <button class="nav-tab" data-tab-id="dashboard">
    const activeNavTab = document.querySelector(`.nav-tab[data-tab-id="${tabId}"]`);
    if (activeNavTab) {
      activeNavTab.classList.remove('text-gray-300');
      activeNavTab.classList.add('text-white', 'font-bold');
    }

    // 渲染对应模块（修复：空值保护）
    if (tabId === 'dashboard' && window.WorkbenchDashboard?.renderDashboard) {
      window.WorkbenchDashboard.renderDashboard();
    } else if (tabId === 'kanban' && window.WorkbenchOrders?.renderKanban) {
      window.WorkbenchOrders.renderKanban();
    } else if (tabId === 'crm' && window.WorkbenchCRM?.renderCustomers) {
      window.WorkbenchCRM.renderCustomers();
    } else if (tabId === 'suppliers' && window.WorkbenchSuppliers?.render) {
      window.WorkbenchSuppliers.render();
    } else if (tabId === 'expenses' && window.WorkbenchExpenses?.render) {
      window.WorkbenchExpenses.render();
    }
  },

  clearTodayActions: async () => {
    let confirmed = false;
    // 修复：统一异步/同步确认逻辑，避免混用
    if (window.WorkbenchModal?.confirm) {
      confirmed = await window.WorkbenchModal.confirm('确定要清除今日行动并重新登录吗？', {
        title: '清除确认',
        confirmText: '确认清除',
        cancelText: '取消'
      });
    } else {
      confirmed = confirm('确定要清除今日行动并重新登录吗？');
    }

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

    // 修复：设置默认值 + JSON.parse 异常保护
    let settings = {};
    try {
      settings = JSON.parse(localStorage.getItem('v5_erp_settings') || '{}');
    } catch (e) {
      console.error('[Settings] 解析设置失败:', e);
      settings = { target: '', rate: '' };
    }

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
    // 修复：数值类型转换 + 空值处理
    const targetInput = document.getElementById('settings-target');
    const rateInput = document.getElementById('settings-survival');
    const survivalInput = document.getElementById('settings-survival');

    const settings = {
      target: targetInput ? Number(targetInput.value) || 0 : 0,
      rate: rateInput ? Number(rateInput.value) || 0 : 0
    };
    
    app.system.survivalModeEnabled = survivalInput?.checked || false;
    
    try {
      localStorage.setItem('v5_erp_settings', JSON.stringify(settings));
      window.WorkbenchUtils?.toast('设置已保存', 'success');
    } catch (e) {
      console.error('[Settings] 保存设置失败:', e);
      window.WorkbenchUtils?.toast('设置保存失败', 'error');
    }
  },

  logout: async () => {
    let confirmed = false;
    // 修复：统一异步/同步确认逻辑
    if (window.WorkbenchModal?.confirm) {
      confirmed = await window.WorkbenchModal.confirm('确定要退出系统吗？', {
        title: '退出确认',
        confirmText: '确认退出',
        cancelText: '取消'
      });
    } else {
      confirmed = confirm('确定要退出系统吗？');
    }

    if (confirmed) {
      localStorage.removeItem('v5_erp_today_actions');
      localStorage.removeItem('v5_erp_unlock_time');
      location.reload();
    }
  },

  kanban: {
    openQuickAdd: () => {
      if (window.WorkbenchOrders?.openQuickAddModal) {
        window.WorkbenchOrders.openQuickAddModal();
      } else {
        window.WorkbenchUtils?.toast('订单模块尚未加载完成', 'warning');
      }
    }
  },

  crm: {
    openCustomerModal: () => {
      if (window.WorkbenchCRM?.openCustomerModal) {
        window.WorkbenchCRM.openCustomerModal();
      } else {
        window.WorkbenchUtils?.toast('CRM模块开发中', 'info');
      }
    }
  },

  expenses: {
    openAddModal: () => {
      if (window.WorkbenchExpenses?.openExpenseModal) {
        window.WorkbenchExpenses.openExpenseModal();
      } else {
        window.WorkbenchUtils?.toast('支出模块尚未加载完成', 'warning');
      }
    }
  },

  suppliers: {
    openAddModal: () => {
      if (window.WorkbenchSuppliers?.openAddModal) {
        window.WorkbenchSuppliers.openAddModal();
      } else {
        window.WorkbenchUtils?.toast('供应商模块开发中', 'info');
      }
    }
  },

  init: () => {
    // 防止重复初始化
    if (app.system.isReady) {
      console.log('[V14.2 PRO] 应用已初始化，跳过重复执行');
      return;
    }

    console.log('[V14.2 PRO] 应用初始化开始...');

    // 修复：检查模块加载函数是否存在
    if (window.checkModulesLoaded && !window.checkModulesLoaded()) {
      console.error('[App] 模块加载不完整，初始化失败');
      app.system.errors.push('模块加载不完整');
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
        if (module && typeof module.init === 'function') {
          const result = module.init();
          if (result !== false) {
            app.system.loadedModules.push(moduleName);
            console.log(`✅ ${moduleName} 初始化成功`);
          } else {
            console.warn(`⚠️ ${moduleName} 初始化失败`);
            app.system.errors.push(`${moduleName} 初始化返回 false`);
          }
        } else {
          console.warn(`⚠️ ${moduleName} 不存在或无 init 方法`);
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
      window.WorkbenchDashboard.startClock();
    }

    // 标记系统就绪
    app.system.isReady = true;

    console.log('[V14.2 PRO] 应用初始化完成！');
    console.log('[V14.2 PRO] 已加载模块:', app.system.loadedModules);

    if (app.system.errors.length > 0) {
      console.warn('[V14.2 PRO] ⚠️ 初始化过程中有错误:', app.system.errors);
    }

    window.WorkbenchUtils?.toast('系统已就绪，祝您工作顺利！', 'success');
  },

  updateSyncStatus: (text, isConnected) => {
    const syncStatusEl = document.getElementById('sync-status');
    const lastSyncEl = document.getElementById('last-sync');
    
    // 修复：空值检查
    if (!syncStatusEl) return;

    const iconEl = syncStatusEl.querySelector('i');
    const spanEl = syncStatusEl.querySelector('span');

    if (isConnected) {
      iconEl?.classList.remove('fa-cloud', 'text-gray-400');
      iconEl?.classList.add('fa-cloud-upload-alt', 'text-green-400');
      if (spanEl) {
        spanEl.textContent = text;
        spanEl.classList.remove('text-gray-400');
        spanEl.classList.add('text-green-400');
      }
      if (lastSyncEl) lastSyncEl.textContent = '刚刚';
    } else {
      iconEl?.classList.remove('fa-cloud-upload-alt', 'text-green-400');
      iconEl?.classList.add('fa-cloud', 'text-gray-400');
      if (spanEl) {
        spanEl.textContent = text;
        spanEl.classList.remove('text-green-400');
        spanEl.classList.add('text-gray-400');
      }
    }
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

// 修复：页面卸载时清理定时器，防止内存泄漏
window.addEventListener('beforeunload', () => {
  if (app.system.emergencyTimer) {
    clearInterval(app.system.emergencyTimer);
  }
});

// 挂载到全局
window.app = app;
console.log('[App] 主应用脚本已加载');
