/**
 * WorkbenchCRM - 客户关系管理模块（生存作战升级版）
 * 基于 v2.0.0，向下兼容
 * 版本: 2.1.0 (Combat)
 * 
 * 数据存储键: v5_erp_customers
 */
const WorkbenchCRM = (function() {
    'use strict';

    const STORAGE_KEY = 'v5_erp_customers';
    const ID_PREFIX = 'CUST';

    const Utils = {
        $(id) { return document.getElementById(id); },

        loadData(key, def = []) {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) return def;
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed : def;
            } catch { return def; }
        },

        saveData(key, data) {
            try {
                localStorage.setItem(key, JSON.stringify(data));
                return true;
            } catch { return false; }
        },

        escapeHtml(str) {
            const d = document.createElement('div');
            d.textContent = str || '';
            return d.innerHTML;
        },

        generateId() {
            return `${ID_PREFIX}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        },

        toast(msg, type = 'info') {
            if (window.Utils?.toast) return window.Utils.toast(msg, type);
            console.log(`[${type}] ${msg}`);
        },

        hoursSince(dateStr) {
            if (!dateStr) return null;
            return Math.floor((Date.now() - new Date(dateStr)) / 36e5);
        },

        formatDate(dateStr) {
            if (!dateStr) return '未知';
            try {
                return new Date(dateStr).toLocaleDateString('zh-CN');
            } catch { return '未知'; }
        }
    };

    let editingId = null;

    function syncToFirebase(data) {
        if (window.FirebaseModule?.syncEnabled) {
            window.FirebaseModule.syncToCloud('customers', data);
        }
    }

    // 规范化客户数据（兼容旧数据）
    function normalizeCustomer(c) {
        return {
            ...c,
            priority: c.priority || 'P2',
            legalEntity: c.legalEntity || 'V5 Medical (CN)',
            currency: c.currency || 'USD',
            nextAction: c.nextAction || '',
            expectedAmount: c.expectedAmount || ''
        };
    }

    return {
        init() {
            const list = Utils.loadData(STORAGE_KEY, []).map(normalizeCustomer);
            Utils.saveData(STORAGE_KEY, list);
            console.log('[WorkbenchCRM] ✅ 初始化完成，已加载', list.length, '个客户');
            return true;
        },

        getAll() {
            return Utils.loadData(STORAGE_KEY, []).map(normalizeCustomer);
        },

        getById(id) {
            return this.getAll().find(c => c.id === id) || null;
        },

        openAddModal() {
            editingId = null;
            this.resetForm();
            const titleEl = Utils.$('crm-modal-title');
            const btnEl = Utils.$('crm-save-btn');
            if (titleEl) titleEl.textContent = '录入作战客户';
            if (btnEl) btnEl.textContent = '保存档案';
            Utils.$('customer-modal')?.classList.remove('hidden');
            Utils.$('crm-name')?.focus();
        },

        openEditModal(id) {
            const c = this.getById(id);
            if (!c) return Utils.toast('客户不存在', 'error');

            editingId = id;
            this.fillForm(c);
            const titleEl = Utils.$('crm-modal-title');
            const btnEl = Utils.$('crm-save-btn');
            if (titleEl) titleEl.textContent = '编辑作战档案';
            if (btnEl) btnEl.textContent = '更新档案';
            Utils.$('customer-modal')?.classList.remove('hidden');
            Utils.$('crm-name')?.focus();
        },

        closeModal() {
            Utils.$('customer-modal')?.classList.add('hidden');
            editingId = null;
        },

        resetForm() {
            // 基础字段
            ['crm-name', 'crm-contact', 'crm-whatsapp', 'crm-address'].forEach(id => {
                const el = Utils.$(id);
                if (el) el.value = '';
            });

            // 作战字段
            ['crm-next', 'crm-amount'].forEach(id => {
                const el = Utils.$(id);
                if (el) el.value = '';
            });

            // 下拉框默认值
            const countryEl = Utils.$('crm-country');
            const priorityEl = Utils.$('crm-priority');
            const entityEl = Utils.$('crm-entity');
            const currencyEl = Utils.$('crm-currency');

            if (countryEl) countryEl.value = 'Other';
            if (priorityEl) priorityEl.value = 'P2';
            if (entityEl) entityEl.value = 'V5 Medical (CN)';
            if (currencyEl) currencyEl.value = 'USD';
        },

        fillForm(c) {
            // 基础字段
            const nameEl = Utils.$('crm-name');
            const contactEl = Utils.$('crm-contact');
            const countryEl = Utils.$('crm-country');
            const whatsappEl = Utils.$('crm-whatsapp');
            const addressEl = Utils.$('crm-address');

            if (nameEl) nameEl.value = c.company || '';
            if (contactEl) contactEl.value = c.contact || '';
            if (countryEl) countryEl.value = c.country || 'Other';
            if (whatsappEl) whatsappEl.value = c.whatsapp || '';
            if (addressEl) addressEl.value = c.address || '';

            // 作战字段
            const priorityEl = Utils.$('crm-priority');
            const entityEl = Utils.$('crm-entity');
            const nextEl = Utils.$('crm-next');
            const amountEl = Utils.$('crm-amount');
            const currencyEl = Utils.$('crm-currency');

            if (priorityEl) priorityEl.value = c.priority || 'P2';
            if (entityEl) entityEl.value = c.legalEntity || 'V5 Medical (CN)';
            if (nextEl) nextEl.value = c.nextAction || '';
            if (amountEl) amountEl.value = c.expectedAmount || '';
            if (currencyEl) currencyEl.value = c.currency || 'USD';
        },

        save() {
            const name = Utils.$('crm-name')?.value?.trim();
            if (!name) return Utils.toast('公司名必填', 'warning');

            const data = {
                company: name,
                contact: Utils.$('crm-contact')?.value?.trim() || '',
                country: Utils.$('crm-country')?.value || 'Other',
                whatsapp: Utils.$('crm-whatsapp')?.value?.trim() || '',
                address: Utils.$('crm-address')?.value?.trim() || '',
                priority: Utils.$('crm-priority')?.value || 'P2',
                legalEntity: Utils.$('crm-entity')?.value || 'V5 Medical (CN)',
                nextAction: Utils.$('crm-next')?.value?.trim() || '',
                expectedAmount: Utils.$('crm-amount')?.value?.trim() || '',
                currency: Utils.$('crm-currency')?.value || 'USD',
                updatedAt: new Date().toISOString()
            };

            let list = this.getAll();

            if (editingId) {
                // 更新现有客户
                list = list.map(c =>
                    c.id === editingId ? { ...c, ...data } : c
                );
                Utils.toast('客户档案已更新', 'success');
            } else {
                // 新增客户
                list.unshift({
                    id: Utils.generateId(),
                    createdAt: new Date().toISOString(),
                    ...data
                });
                Utils.toast('客户档案已保存', 'success');
            }

            Utils.saveData(STORAGE_KEY, list);
            syncToFirebase(list);
            this.closeModal();
            this.render();

            // 刷新仪表盘（如果外部模块已加载）
            if (window.WorkbenchDashboard?.renderDashboard) {
                WorkbenchDashboard.renderDashboard();
            }
        },

        delete(id) {
            if (!confirm('确认删除该客户档案？此操作不可撤销。')) return;
            let list = this.getAll().filter(c => c.id !== id);
            Utils.saveData(STORAGE_KEY, list);
            syncToFirebase(list);
            this.render();
            Utils.toast('客户档案已删除', 'success');

            // 刷新仪表盘
            if (window.WorkbenchDashboard?.renderDashboard) {
                WorkbenchDashboard.renderDashboard();
            }
        },

        render() {
            const el = Utils.$('customer-grid');
            if (!el) return;

            const customers = this.getAll().sort((a, b) => {
                // P0 优先，然后按更新时间降序
                if (a.priority !== b.priority) return a.priority.localeCompare(b.priority);
                return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
            });

            if (!customers.length) {
                el.innerHTML = `
                    <div class="col-span-full text-center text-gray-500 py-12">
                        <i class="fas fa-crosshairs text-4xl mb-4 opacity-30"></i>
                        <p>暂无作战目标</p>
                        <p class="text-sm mt-2 text-gray-600">点击"录入客户"添加第一个目标</p>
                    </div>`;
                return;
            }

            el.innerHTML = customers.map(c => {
                const isP0 = c.priority === 'P0';
                const isP1 = c.priority === 'P1';
                const hours = Utils.hoursSince(c.updatedAt);
                const danger = isP0 && hours !== null && hours > 72;

                // 优先级颜色
                let priorityClass = 'text-gray-500';
                let priorityBg = '';
                if (isP0) {
                    priorityClass = 'text-red-400 font-bold';
                    priorityBg = danger ? 'border-red-600 animate-pulse bg-red-900/10' : 'border-red-500/50';
                } else if (isP1) {
                    priorityClass = 'text-orange-400';
                    priorityBg = 'border-orange-500/30';
                }

                return `
                <div class="glass p-5 rounded-xl hover:border-green-500/30 transition group ${priorityBg}">
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex-1 min-w-0">
                            <h3 class="font-bold text-white truncate">${Utils.escapeHtml(c.company)}</h3>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="text-xs ${priorityClass}">${c.priority}</span>
                                <span class="text-xs text-gray-600">${Utils.escapeHtml(c.country || 'Other')}</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button onclick="WorkbenchCRM.openEditModal('${c.id}')" class="text-gray-500 hover:text-blue-400 p-1" title="编辑">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="WorkbenchCRM.delete('${c.id}')" class="text-gray-500 hover:text-red-500 p-1" title="删除">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>

                    ${c.nextAction ? `
                        <div class="text-xs text-yellow-400 mb-1 flex items-center gap-1">
                            <i class="fas fa-play text-[10px]"></i>
                            <span class="truncate">${Utils.escapeHtml(c.nextAction)}</span>
                        </div>
                    ` : ''}

                    ${c.expectedAmount ? `
                        <div class="text-xs text-green-400 mb-1 flex items-center gap-1">
                            <i class="fas fa-dollar-sign text-[10px]"></i>
                            <span>${Utils.escapeHtml(c.expectedAmount)} ${c.currency || 'USD'}</span>
                        </div>
                    ` : ''}

                    ${c.contact ? `
                        <div class="text-xs text-gray-400 mb-1 flex items-center gap-1">
                            <i class="fas fa-user text-[10px] w-3"></i>
                            <span class="truncate">${Utils.escapeHtml(c.contact)}</span>
                        </div>
                    ` : ''}

                    ${c.whatsapp ? `
                        <div class="text-xs text-gray-400 mb-1 flex items-center gap-1">
                            <i class="fab fa-whatsapp text-[10px] w-3 text-green-500"></i>
                            <span class="truncate">${Utils.escapeHtml(c.whatsapp)}</span>
                        </div>
                    ` : ''}

                    <div class="mt-3 pt-2 border-t border-dark-4/50 flex justify-between items-center text-[10px] text-gray-600">
                        <span><i class="fas fa-clock mr-1"></i>${Utils.formatDate(c.createdAt)}</span>
                        ${hours !== null ? `
                            <span class="${danger ? 'text-red-400 font-bold' : ''}">${hours}h ${danger ? '⚠️' : ''}</span>
                        ` : ''}
                    </div>
                </div>`;
            }).join('');
        },

        // 搜索功能
        search(keyword) {
            if (!keyword?.trim()) return this.getAll();
            const lk = keyword.toLowerCase().trim();
            return this.getAll().filter(c =>
                (c.company || '').toLowerCase().includes(lk) ||
                (c.contact || '').toLowerCase().includes(lk) ||
                (c.country || '').toLowerCase().includes(lk) ||
                (c.nextAction || '').toLowerCase().includes(lk)
            );
        },

        // 获取 P0 客户
        getP0Customers() {
            return this.getAll().filter(c => c.priority === 'P0');
        },

        // 导出数据
        exportData() {
            return this.getAll();
        }
    };
})();

window.WorkbenchCRM = WorkbenchCRM;

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => WorkbenchCRM.init());
} else {
    WorkbenchCRM.init();
}

console.log('[WorkbenchCRM] 已加载 v2.1.0 Combat');
