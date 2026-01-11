/**
 * WorkbenchCRM - 客户关系管理模块（生存作战升级版）
 * 基于 v2.0.0，向下兼容
 * 版本: 2.1.0 (Combat)
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
        }
    };

    let editingId = null;

    function syncToFirebase(data) {
        if (window.FirebaseModule?.syncEnabled) {
            window.FirebaseModule.syncToCloud('customers', data);
        }
    }

    function normalizeCustomer(c) {
        return {
            ...c,
            priority: c.priority || 'P2',
            legalEntity: c.legalEntity || 'V5 Medical (CN)',
            currency: c.currency || 'USD'
        };
    }

    return {
        init() {
            const list = Utils.loadData(STORAGE_KEY, []).map(normalizeCustomer);
            Utils.saveData(STORAGE_KEY, list);
            console.log('[WorkbenchCRM] 初始化完成', list.length);
            this.render();
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
            Utils.$('crm-modal-title').textContent = '录入作战客户';
            Utils.$('crm-save-btn').textContent = '保存';
            Utils.$('customer-modal')?.classList.remove('hidden');
        },

        openEditModal(id) {
            const c = this.getById(id);
            if (!c) return Utils.toast('客户不存在', 'error');

            editingId = id;
            this.fillForm(c);
            Utils.$('crm-modal-title').textContent = '编辑作战档案';
            Utils.$('crm-save-btn').textContent = '更新';
            Utils.$('customer-modal')?.classList.remove('hidden');
        },

        closeModal() {
            Utils.$('customer-modal')?.classList.add('hidden');
            editingId = null;
        },

        resetForm() {
            [
                'crm-name','crm-contact','crm-whatsapp','crm-address',
                'crm-next','crm-amount'
            ].forEach(id => Utils.$(id) && (Utils.$(id).value = ''));

            Utils.$('crm-country').value = 'Other';
            Utils.$('crm-priority').value = 'P2';
            Utils.$('crm-entity').value = 'V5 Medical (CN)';
            Utils.$('crm-currency').value = 'USD';
        },

        fillForm(c) {
            Utils.$('crm-name').value = c.company || '';
            Utils.$('crm-contact').value = c.contact || '';
            Utils.$('crm-country').value = c.country || 'Other';
            Utils.$('crm-whatsapp').value = c.whatsapp || '';
            Utils.$('crm-address').value = c.address || '';
            Utils.$('crm-priority').value = c.priority;
            Utils.$('crm-entity').value = c.legalEntity;
            Utils.$('crm-next').value = c.nextAction || '';
            Utils.$('crm-amount').value = c.expectedAmount || '';
            Utils.$('crm-currency').value = c.currency;
        },

        save() {
            const name = Utils.$('crm-name').value.trim();
            if (!name) return Utils.toast('公司名必填', 'warning');

            const data = {
                company: name,
                contact: Utils.$('crm-contact').value.trim(),
                country: Utils.$('crm-country').value,
                whatsapp: Utils.$('crm-whatsapp').value.trim(),
                address: Utils.$('crm-address').value.trim(),
                priority: Utils.$('crm-priority').value,
                legalEntity: Utils.$('crm-entity').value,
                nextAction: Utils.$('crm-next').value.trim(),
                expectedAmount: Utils.$('crm-amount').value.trim(),
                currency: Utils.$('crm-currency').value,
                updatedAt: new Date().toISOString()
            };

            let list = this.getAll();

            if (editingId) {
                list = list.map(c =>
                    c.id === editingId ? { ...c, ...data } : c
                );
            } else {
                list.unshift({
                    id: Utils.generateId(),
                    createdAt: new Date().toISOString(),
                    ...data
                });
            }

            Utils.saveData(STORAGE_KEY, list);
            syncToFirebase(list);
            this.closeModal();
            this.render();
            Utils.toast('客户档案已保存', 'success');
        },

        delete(id) {
            if (!confirm('确认删除该客户？')) return;
            let list = this.getAll().filter(c => c.id !== id);
            Utils.saveData(STORAGE_KEY, list);
            syncToFirebase(list);
            this.render();
        },

        render() {
            const el = Utils.$('customer-grid');
            if (!el) return;

            const customers = this.getAll().sort((a, b) => {
                if (a.priority !== b.priority) return a.priority.localeCompare(b.priority);
                return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
            });

            if (!customers.length) {
                el.innerHTML = `<div class="col-span-full text-center text-gray-500 py-12">
                    暂无作战目标
                </div>`;
                return;
            }

            el.innerHTML = customers.map(c => {
                const isP0 = c.priority === 'P0';
                const hours = Utils.hoursSince(c.updatedAt);
                const danger = isP0 && hours > 72;

                return `
                <div class="glass p-5 rounded-xl border ${danger ? 'border-red-600 animate-pulse' : ''}">
                    <div class="flex justify-between mb-2">
                        <h3 class="font-bold text-white">${Utils.escapeHtml(c.company)}</h3>
                        <span class="text-xs ${isP0 ? 'text-red-400' : 'text-gray-500'}">${c.priority}</span>
                    </div>

                    ${c.nextAction ? `<div class="text-xs text-yellow-400">▶ ${Utils.escapeHtml(c.nextAction)}</div>` : ''}
                    ${c.expectedAmount ? `<div class="text-xs text-green-400">💰 ${c.expectedAmount} ${c.currency}</div>` : ''}

                    <div class="text-[10px] text-gray-500 mt-2">
                        ${hours !== null ? `${hours}h 未更新` : ''}
                    </div>

                    <div class="mt-2 flex gap-2">
                        <button onclick="WorkbenchCRM.openEditModal('${c.id}')">✏️</button>
                        <button onclick="WorkbenchCRM.delete('${c.id}')">🗑</button>
                    </div>
                </div>`;
            }).join('');
        }
    };
})();

window.WorkbenchCRM = WorkbenchCRM;

document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', () => WorkbenchCRM.init())
    : WorkbenchCRM.init();

console.log('[WorkbenchCRM] 已加载 v2.1.0 Combat');
