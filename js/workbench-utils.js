// ============================================
// V14.2 PRO - UTILITIES MODULE (ENHANCED)
// 通用工具函数封装 + 性能优化 + 功能增强 + 空值保护
// 优化版本 - 2026-01-03
// ============================================

/**
 * 工具类命名空间，提供通用工具函数
 * @namespace WorkbenchUtils
 */
const WorkbenchUtils = (() => {
    'use strict';

    // 私有配置
    const config = {
        defaultToastDuration: 3000,
        animationDuration: 300,
        dateFormats: {
            short: 'YYYY-MM-DD',
            long: 'YYYY-MM-DD HH:mm:ss',
            time: 'HH:mm:ss',
            month: 'YYYY-MM'
        },
        storagePrefix: 'workbench_' // 统一存储前缀
    };

    // 私有工具函数
    const privateUtils = {
        /**
         * 检查是否为DOM元素
         * @param {*} element - 要检查的元素
         * @returns {boolean} 是否为DOM元素
         */
        isElement(element) {
            return element instanceof HTMLElement;
        },

        /**
         * 安全的JSON解析
         * @param {string} jsonString - JSON字符串
         * @param {*} defaultValue - 默认值
         * @returns {*} 解析结果
         */
        safeJsonParse(jsonString, defaultValue = {}) {
            try {
                return JSON.parse(jsonString);
            } catch (error) {
                console.warn('[Utils] JSON解析失败:', error);
                return defaultValue;
            }
        },

        /**
         * 安全的JSON字符串化
         * @param {*} data - 数据
         * @param {*} defaultValue - 默认值
         * @returns {string} JSON字符串
         */
        safeJsonStringify(data, defaultValue = '{}') {
            try {
                return JSON.stringify(data, null, 2);
            } catch (error) {
                console.warn('[Utils] JSON字符串化失败:', error);
                return defaultValue;
            }
        }
    };

    // 公共API
    const api = {
        /**
         * 初始化工具模块（供loader调用）
         * @returns {boolean} 是否成功
         */
        init() {
            try {
                this._initAnimations();
                this._initToastContainer();
                console.log('[Utils] ✅ 工具模块已初始化');
                console.log('[Utils] 存储前缀:', config.storagePrefix);
                return true;
            } catch (error) {
                console.error('[Utils] ❌ 初始化失败:', error);
                return false;
            }
        },

        /**
         * 初始化动画样式
         * @private
         */
        _initAnimations() {
            if (!document.getElementById('utils-animations')) {
                const style = document.createElement('style');
                style.id = 'utils-animations';
                style.textContent = `
                    @keyframes slideIn {
                        from { opacity: 0; transform: translateX(400px); }
                        to { opacity: 1; transform: translateX(0); }
                    }
                    
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    
                    @keyframes pulse {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.7; }
                    }
                    
                    .animate-slide-in { animation: slideIn ${config.animationDuration}ms ease-out; }
                    .animate-fade-in { animation: fadeIn ${config.animationDuration}ms ease-out; }
                    .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
                    
                    /* Toast响应式适配 */
                    @media (max-width: 768px) {
                        #toast-container { left: 4px; right: 4px; bottom: 4px; }
                        #toast-container > div { min-width: unset; width: 100%; max-width: unset; }
                    }
                `;
                document.head.appendChild(style);
            }
        },

        /**
         * 初始化Toast容器
         * @private
         */
        _initToastContainer() {
            if (!document.getElementById('toast-container')) {
                const container = document.createElement('div');
                container.id = 'toast-container';
                container.className = 'fixed bottom-4 right-4 z-[9999] space-y-2';
                document.body.appendChild(container);
            }
        },

        /**
         * 显示Toast通知
         * @param {string} message - 提示信息
         * @param {string} type - 类型: success/error/warning/info
         * @param {number} duration - 显示时长(ms)
         * @returns {HTMLElement} Toast元素
         */
        toast(message, type = 'info', duration = config.defaultToastDuration) {
            // 参数验证
            if (!message || message.trim() === '') {
                console.warn('[Utils] Toast消息不能为空');
                return null;
            }

            const container = document.getElementById('toast-container');
            if (!container) {
                console.warn('[Utils] Toast容器未初始化');
                return null;
            }

            // 定义配置
            const toastConfig = {
                icons: {
                    success: '✅',
                    error: '❌',
                    warning: '⚠️',
                    info: 'ℹ️'
                },
                colors: {
                    success: 'bg-green-600 border-green-500',
                    error: 'bg-red-600 border-red-500',
                    warning: 'bg-yellow-600 border-yellow-500',
                    info: 'bg-blue-600 border-blue-500'
                }
            };

            // 创建Toast元素
            const toast = document.createElement('div');
            toast.className = `${toastConfig.colors[type] || toastConfig.colors.info} border-2 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 min-w-[300px] max-w-[400px] animate-slide-in`;
            
            // 处理消息内容
            const safeMessage = this.escapeHtml(message)
                .replace(/\n/g, '<br>')
                .replace(/\[b\](.*?)\[\/b\]/g, '<strong>$1</strong>')
                .replace(/\[i\](.*?)\[\/i\]/g, '<em>$1</em>');

            toast.innerHTML = `
                <span class="text-2xl flex-shrink-0">${toastConfig.icons[type] || toastConfig.icons.info}</span>
                <span class="flex-1 font-medium">${safeMessage}</span>
                <button class="text-white/70 hover:text-white transition flex-shrink-0" aria-label="关闭">
                    <i class="fas fa-times"></i>
                </button>
            `;

            // 添加关闭事件
            const closeBtn = toast.querySelector('button');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this._removeToast(toast));
            }

            // 添加到容器
            container.appendChild(toast);

            // 自动移除
            setTimeout(() => this._removeToast(toast), duration);

            return toast;
        },

        /**
         * 移除Toast元素
         * @private
         * @param {HTMLElement} toast - Toast元素
         */
        _removeToast(toast) {
            if (!privateUtils.isElement(toast)) return;

            toast.style.opacity = '0';
            toast.style.transform = 'translateX(400px)';
            
            setTimeout(() => {
                try {
                    toast.remove();
                } catch (error) {
                    console.warn('[Utils] Toast移除失败:', error);
                }
            }, config.animationDuration);
        },

        /**
         * 格式化数字（千分位）
         * @param {number|string} num - 数字
         * @param {number} decimals - 小数位数
         * @returns {string} 格式化后的数字
         */
        formatNumber(num, decimals = 0) {
            const number = this.parseNumber(num);
            if (isNaN(number)) return '0';

            return number.toLocaleString('zh-CN', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            });
        },

        /**
         * 解析数字
         * @param {*} value - 要解析的值
         * @returns {number} 数字
         */
        parseNumber(value) {
            if (typeof value === 'number') return value;
            if (typeof value === 'string') {
                return parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
            }
            return 0;
        },

        /**
         * 生成唯一ID
         * @param {string} prefix - 前缀
         * @param {number} length - 随机部分长度
         * @returns {string} 唯一ID
         */
        generateId(prefix = 'id', length = 8) {
            const timestamp = Date.now().toString(36);
            const random = Math.random().toString(36).substring(2, 2 + length);
            return `${prefix}_${timestamp}_${random}`;
        },

        /**
         * 格式化日期
         * @param {Date|string|number} date - 日期
         * @param {string} format - 格式
         * @returns {string} 格式化后的日期
         */
        formatDate(date, format = 'YYYY-MM-DD') {
            try {
                const d = new Date(date);
                if (isNaN(d.getTime())) return '';

                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                const seconds = String(d.getSeconds()).padStart(2, '0');

                return format
                    .replace('YYYY', year)
                    .replace('MM', month)
                    .replace('DD', day)
                    .replace('HH', hours)
                    .replace('mm', minutes)
                    .replace('ss', seconds);
            } catch (error) {
                console.error('[Utils] 日期格式化失败:', error);
                return '';
            }
        },

        /**
         * 格式化货币
         * @param {number} amount - 金额
         * @param {string} currency - 货币代码
         * @param {number} decimals - 小数位数
         * @returns {string} 格式化后的货币
         */
        formatCurrency(amount, currency = 'CNY', decimals = 2) {
            const symbols = {
                'USD': '$',
                'EUR': '€',
                'GBP': '£',
                'CNY': '¥',
                'JPY': '¥',
                'PHP': '₱',
                'TRY': '₺'
            };

            const symbol = symbols[currency] || currency;
            const formatted = this.formatNumber(amount, decimals);

            return `${symbol}${formatted}`;
        },

        /**
         * 转义HTML特殊字符
         * @param {string} text - 文本
         * @returns {string} 转义后的文本
         */
        escapeHtml(text) {
            if (typeof text !== 'string') return '';

            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        // ============================================
        // 新增：空值保护工具函数
        // ============================================
        /**
         * 安全获取DOM元素（返回null时不报错）
         * @param {string} id - DOM元素ID
         * @returns {HTMLElement|null} DOM元素或null
         */
        safeGetElement(id) {
            if (!id || typeof id !== 'string') {
                console.warn('[Utils] 无效的DOM元素ID:', id);
                return null;
            }
            return document.getElementById(id) || null;
        },

        /**
         * 安全判断数组（确保返回有效数组，避免forEach/length报错）
         * @param {*} data - 待校验的数据
         * @returns {Array} 有效数组（空数组或原数组）
         */
        safeArray(data) {
            return Array.isArray(data) ? data : [];
        },

        /**
         * 安全更新DOM文本（元素不存在时不报错）
         * @param {string} id - DOM元素ID
         * @param {string} text - 要设置的文本
         */
        safeUpdateText(id, text) {
            const el = this.safeGetElement(id);
            if (el) {
                el.textContent = text || '';
            }
        },

        /**
         * 安全过滤数组（避免filter调用在null/undefined上）
         * @param {*} data - 待过滤的数据
         * @param {Function} callback - 过滤回调函数
         * @returns {Array} 过滤后的数组
         */
        safeFilter(data, callback) {
            const arr = this.safeArray(data);
            return typeof callback === 'function' ? arr.filter(callback) : [];
        },

        /**
         * 安全遍历数组（避免forEach调用在null/undefined上）
         * @param {*} data - 待遍历的数据
         * @param {Function} callback - 遍历回调函数
         */
        safeForEach(data, callback) {
            const arr = this.safeArray(data);
            if (typeof callback === 'function') {
                arr.forEach(callback);
            } else {
                console.warn('[Utils] 无效的forEach回调函数');
            }
        },
        // ============================================
        // 空值保护工具函数 结束
        // ============================================

        /**
         * 防抖函数
         * @param {Function} func - 函数
         * @param {number} wait - 等待时间(ms)
         * @returns {Function} 防抖后的函数
         */
        debounce(func, wait = 300) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        /**
         * 节流函数
         * @param {Function} func - 函数
         * @param {number} limit - 时间限制(ms)
         * @returns {Function} 节流后的函数
         */
        throttle(func, limit = 300) {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },

        /**
         * 深度克隆对象
         * @param {*} obj - 对象
         * @returns {*} 克隆后的对象
         */
        deepClone(obj) {
            if (obj === null || typeof obj !== 'object') return obj;
            
            try {
                return JSON.parse(JSON.stringify(obj));
            } catch (error) {
                console.error('[Utils] 深度克隆失败:', error);
                return obj;
            }
        },

        /**
         * 合并对象
         * @param {Object} target - 目标对象
         * @param {...Object} sources - 源对象
         * @returns {Object} 合并后的对象
         */
        merge(target, ...sources) {
            if (!target || typeof target !== 'object') {
                return target;
            }

            for (const source of sources) {
                if (source && typeof source === 'object') {
                    Object.assign(target, source);
                }
            }

            return target;
        },

        /**
         * 延迟执行
         * @param {number} ms - 延迟时间(ms)
         * @returns {Promise} Promise对象
         */
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        /**
         * 重试函数
         * @param {Function} fn - 函数
         * @param {number} retries - 重试次数
         * @param {number} delay - 延迟时间(ms)
         * @returns {Promise} Promise对象
         */
        async retry(fn, retries = 3, delay = 1000) {
            try {
                return await fn();
            } catch (error) {
                if (retries <= 0) {
                    throw error;
                }
                console.warn(`[Utils] 重试中... 剩余${retries}次`);
                await this.sleep(delay);
                return this.retry(fn, retries - 1, delay);
            }
        },

        /**
         * 金额转大写（中文）
         * @param {number} amount - 金额
         * @param {string} currency - 货币类型
         * @returns {string} 大写金额
         */
        amountToChinese(amount, currency = 'CNY') {
            const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
            const positions = ['', '拾', '佰', '仟', '萬', '拾', '佰', '仟', '亿'];
            const decimals = ['角', '分'];

            if (amount === 0) return currency === 'USD' ? 'ZERO US DOLLARS ONLY' : '零元整';

            let [integer, decimal] = amount.toString().split('.');
            let result = '';

            // 处理整数部分
            for (let i = 0; i < integer.length; i++) {
                const digit = parseInt(integer[i]);
                const position = integer.length - i - 1;
                
                if (digit !== 0) {
                    result += digits[digit] + positions[position];
                } else if (result.slice(-1) !== '零') {
                    result += '零';
                }
            }

            // 移除末尾的零
            result = result.replace(/零+$/, '');

            // 处理小数部分
            if (decimal) {
                decimal = decimal.substring(0, 2).padEnd(2, '0');
                for (let i = 0; i < decimal.length; i++) {
                    const digit = parseInt(decimal[i]);
                    if (digit !== 0) {
                        result += digits[digit] + decimals[i];
                    }
                }
            }

            // 添加单位
            if (currency === 'USD') {
                return `SAY TOTAL US DOLLARS ${result.toUpperCase()} ONLY`;
            } else {
                return result + (decimal ? '' : '整');
            }
        },

        /**
         * 格式化文件大小
         * @param {number} bytes - 字节数
         * @param {number} decimals - 小数位数
         * @returns {string} 格式化后的大小
         */
        formatFileSize(bytes, decimals = 2) {
            if (bytes === 0) return '0 Bytes';

            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));

            return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
        },

        /**
         * 验证邮箱
         * @param {string} email - 邮箱
         * @returns {boolean} 是否有效
         */
        isValidEmail(email) {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(String(email).toLowerCase());
        },

        /**
         * 验证手机号
         * @param {string} phone - 手机号
         * @param {string} country - 国家代码
         * @returns {boolean} 是否有效
         */
        isValidPhone(phone, country = 'CN') {
            const patterns = {
                CN: /^1[3-9]\d{9}$/,
                US: /^[2-9]\d{9}$/,
                UK: /^[1-9]\d{9,10}$/,
                JP: /^[0-9]{10,11}$/
            };

            const pattern = patterns[country] || patterns.CN;
            return pattern.test(phone.replace(/\D/g, ''));
        },

        /**
         * 格式化手机号
         * @param {string} phone - 手机号
         * @param {string} country - 国家代码
         * @returns {string} 格式化后的手机号
         */
        formatPhone(phone, country = 'CN') {
            if (!phone) return '';
            
            const cleaned = phone.replace(/\D/g, '');
            
            const formats = {
                CN: (num) => num.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3'),
                US: (num) => num.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3'),
                UK: (num) => num.replace(/(\d{5})(\d{6})/, '$1 $2'),
                JP: (num) => num.length === 10 
                    ? num.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3') 
                    : num.replace(/(\d{4})(\d{3})(\d{4})/, '$1-$2-$3')
            };
            
            const format = formats[country] || formats.CN;
            return format(cleaned);
        },

        /**
         * 计算两个日期之间的天数
         * @param {Date|string} date1 - 日期1
         * @param {Date|string} date2 - 日期2
         * @returns {number} 天数差
         */
        daysBetween(date1, date2) {
            try {
                const d1 = new Date(date1);
                const d2 = new Date(date2);
                
                if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
                
                const timeDiff = Math.abs(d2.getTime() - d1.getTime());
                return Math.ceil(timeDiff / (1000 * 3600 * 24));
            } catch (error) {
                console.error('[Utils] 计算日期差失败:', error);
                return 0;
            }
        },

        /**
         * 生成随机颜色
         * @param {boolean} opacity - 是否包含透明度
         * @returns {string} 颜色值
         */
        randomColor(opacity = false) {
            const r = Math.floor(Math.random() * 256);
            const g = Math.floor(Math.random() * 256);
            const b = Math.floor(Math.random() * 256);
            
            if (opacity) {
                const a = (Math.random() * 0.5 + 0.5).toFixed(2);
                return `rgba(${r}, ${g}, ${b}, ${a})`;
            }
            
            return `rgb(${r}, ${g}, ${b})`;
        },

        /**
         * 存储数据到本地存储（使用统一前缀）
         * @param {string} key - 键名
         * @param {*} value - 值
         * @param {number} expiration - 过期时间(秒)
         * @returns {boolean} 是否成功
         */
        setLocalStorage(key, value, expiration = null) {
            try {
                // 自动添加前缀（如果没有）
                const storageKey = key.startsWith(config.storagePrefix) 
                    ? key 
                    : config.storagePrefix + key;

                const item = {
                    value: value,
                    timestamp: Date.now()
                };
                
                if (expiration) {
                    item.expiration = Date.now() + expiration * 1000;
                }
                
                localStorage.setItem(storageKey, JSON.stringify(item));
                return true;
            } catch (error) {
                console.error('[Utils] 设置本地存储失败:', error);
                return false;
            }
        },

        /**
         * 从本地存储获取数据（使用统一前缀）
         * @param {string} key - 键名
         * @returns {*} 存储的值
         */
        getLocalStorage(key) {
            try {
                // 自动添加前缀（如果没有）
                const storageKey = key.startsWith(config.storagePrefix) 
                    ? key 
                    : config.storagePrefix + key;

                const itemStr = localStorage.getItem(storageKey);
                if (!itemStr) return null;
                
                const item = JSON.parse(itemStr);
                
                // 检查过期时间
                if (item.expiration && Date.now() > item.expiration) {
                    localStorage.removeItem(storageKey);
                    return null;
                }
                
                return item.value;
            } catch (error) {
                console.error('[Utils] 获取本地存储失败:', error);
                return null;
            }
        },

        /**
         * 删除本地存储
         * @param {string} key - 键名
         * @returns {boolean} 是否成功
         */
        removeLocalStorage(key) {
            try {
                // 自动添加前缀（如果没有）
                const storageKey = key.startsWith(config.storagePrefix) 
                    ? key 
                    : config.storagePrefix + key;

                localStorage.removeItem(storageKey);
                return true;
            } catch (error) {
                console.error('[Utils] 删除本地存储失败:', error);
                return false;
            }
        },

        /**
         * 显示加载指示器
         * @param {string} targetId - 目标容器ID
         * @param {string} message - 加载消息
         * @returns {HTMLElement} 加载元素
         */
        showLoading(targetId = 'loading-container', message = '加载中...') {
            let container = this.safeGetElement(targetId); // 替换为安全获取DOM
            
            if (!container) {
                container = document.createElement('div');
                container.id = targetId;
                container.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]';
                document.body.appendChild(container);
            }
            
            container.innerHTML = `
                <div class="bg-dark border border-gray-700 rounded-xl p-8 text-center animate-fade-in">
                    <div class="animate-spin text-4xl mb-4">⟳</div>
                    <div class="text-xl font-bold text-white mb-2">${this.escapeHtml(message)}</div>
                    <div class="text-sm text-gray-400">请稍候...</div>
                </div>
            `;
            
            container.style.display = 'flex';
            return container;
        },

        /**
         * 隐藏加载指示器
         * @param {string} targetId - 目标容器ID
         */
        hideLoading(targetId = 'loading-container') {
            const container = this.safeGetElement(targetId); // 替换为安全获取DOM
            if (container) {
                container.style.display = 'none';
            }
        },

        /**
         * 显示确认对话框
         * @param {string} message - 消息
         * @param {string} title - 标题
         * @param {Object} options - 选项
         * @returns {Promise<boolean>} 是否确认
         */
        confirmDialog(message, title = '确认操作', options = {}) {
            return new Promise((resolve) => {
                const defaultOptions = {
                    confirmText: '确认',
                    cancelText: '取消',
                    confirmColor: 'bg-red-600 hover:bg-red-700',
                    cancelColor: 'bg-gray-600 hover:bg-gray-700'
                };

                const dialogOptions = { ...defaultOptions, ...options };
                const dialogId = `confirm-dialog-${Date.now()}`;

                // 创建对话框
                const dialog = document.createElement('div');
                dialog.id = dialogId;
                dialog.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] animate-fade-in';
                dialog.innerHTML = `
                    <div class="bg-dark border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4">
                        <div class="text-xl font-bold text-white mb-4">${this.escapeHtml(title)}</div>
                        <div class="text-gray-300 mb-6">${this.escapeHtml(message)}</div>
                        <div class="flex gap-3">
                            <button id="confirm-btn" class="${dialogOptions.confirmColor} text-white px-6 py-2 rounded font-bold transition-colors">
                                ${this.escapeHtml(dialogOptions.confirmText)}
                            </button>
                            <button id="cancel-btn" class="${dialogOptions.cancelColor} text-white px-6 py-2 rounded font-bold transition-colors">
                                ${this.escapeHtml(dialogOptions.cancelText)}
                            </button>
                        </div>
                    </div>
                `;

                document.body.appendChild(dialog);

                // 添加事件监听
                const confirmBtn = dialog.querySelector('#confirm-btn');
                const cancelBtn = dialog.querySelector('#cancel-btn');

                const cleanup = () => {
                    if (dialog.parentNode) {
                        dialog.parentNode.removeChild(dialog);
                    }
                };

                confirmBtn.addEventListener('click', () => {
                    cleanup();
                    resolve(true);
                });

                cancelBtn.addEventListener('click', () => {
                    cleanup();
                    resolve(false);
                });

                // 点击背景关闭
                dialog.addEventListener('click', (e) => {
                    if (e.target === dialog) {
                        cleanup();
                        resolve(false);
                    }
                });
            });
        },

        /**
         * 获取存储前缀
         * @returns {string} 存储前缀
         */
        getStoragePrefix() {
            return config.storagePrefix;
        }
    };

    return api;
})();

// 挂载到全局
window.WorkbenchUtils = WorkbenchUtils;

// 模块导出（支持CommonJS和ES模块）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkbenchUtils;
} else if (typeof define === 'function' && define.amd) {
    define([], () => WorkbenchUtils);
}

console.log('[Utils] 工具模块已加载（含空值保护增强）');
