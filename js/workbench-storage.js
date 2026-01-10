/**
 * V14.2 PRO - 存储模块
 * 统一管理本地存储，包含键名验证、数据CRUD、异常处理
 * 优化版本 - 2026-01-03
 * @namespace WorkbenchStorage
 */
const WorkbenchStorage = (() => {
    'use strict';

    // 配置常量
    const CONFIG = {
        PREFIX: 'workbench_',
        MAX_KEY_LENGTH: 100,
        EXPIRY_SUFFIX: '_expiry'
    };

    // 错误类型
    const ERROR_TYPE = {
        INVALID_KEY: 'INVALID_KEY',
        KEY_TOO_LONG: 'KEY_TOO_LONG',
        STORAGE_FULL: 'STORAGE_FULL',
        EXPIRED: 'EXPIRED',
        SERIALIZE_ERROR: 'SERIALIZE_ERROR',
        DESERIALIZE_ERROR: 'DESERIALIZE_ERROR'
    };

    /**
     * 初始化存储模块（供loader调用）
     * @returns {boolean} 是否成功
     */
    function init() {
        try {
            console.log('[Storage] 存储模块初始化中...');
            console.log('[Storage] 存储前缀:', CONFIG.PREFIX);
            console.log('[Storage] 最大键长度:', CONFIG.MAX_KEY_LENGTH);
            
            // 检查localStorage可用性
            if (!isLocalStorageAvailable()) {
                console.warn('[Storage] ⚠️ localStorage不可用');
                return false;
            }
            
            // 清理过期数据
            cleanExpiredData();
            
            console.log('[Storage] ✅ 存储模块已初始化');
            return true;
        } catch (error) {
            console.error('[Storage] ❌ 初始化失败:', error);
            return false;
        }
    }

    /**
     * 检查localStorage是否可用
     * @returns {boolean} 是否可用
     */
    function isLocalStorageAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 创建存储错误对象
     * @param {string} type - 错误类型
     * @param {string} message - 错误信息
     * @returns {Error} 错误对象
     */
    function createStorageError(type, message) {
        const error = new Error(message);
        error.type = type;
        return error;
    }

    /**
     * 验证存储键合法性
     * @param {string} key - 键名
     * @returns {string} 验证后的键名（带前缀）
     * @throws {Error} 无效键名错误
     */
    function validateKey(key) {
        // 基础类型校验
        if (!key || typeof key !== 'string') {
            throw createStorageError(ERROR_TYPE.INVALID_KEY, '无效的存储键名：必须为非空字符串');
        }

        // 特殊字符/空格校验
        const trimmedKey = key.trim();
        if (trimmedKey.length === 0) {
            throw createStorageError(ERROR_TYPE.INVALID_KEY, '无效的存储键名：不能仅包含空格');
        }

        const illegalChars = /[\\/:*?"<>|]/;
        if (illegalChars.test(trimmedKey)) {
            throw createStorageError(ERROR_TYPE.INVALID_KEY, '无效的存储键名：包含非法字符（\\/:*?"<>|）');
        }

        // 自动添加前缀
        const finalKey = trimmedKey.startsWith(CONFIG.PREFIX) 
            ? trimmedKey 
            : `${CONFIG.PREFIX}${trimmedKey}`;
        
        // 长度校验
        if (finalKey.length > CONFIG.MAX_KEY_LENGTH) {
            throw createStorageError(ERROR_TYPE.KEY_TOO_LONG, `键名过长（最大${CONFIG.MAX_KEY_LENGTH}字符）`);
        }

        return finalKey;
    }

    /**
     * 安全验证存储键（不抛出异常）
     * @param {string} key - 键名
     * @returns {string|null} 验证后的键名（失败返回null）
     */
    function safeValidateKey(key) {
        try {
            return validateKey(key);
        } catch (error) {
            console.error('[Storage] 键名验证失败:', error);
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast(`存储键验证失败：${error.message}`, 'error');
            }
            return null;
        }
    }

    /**
     * 保存数据（支持过期时间）
     * @param {string} key - 键名
     * @param {*} value - 存储值
     * @param {number} expiryMinutes - 过期时间（分钟，0为永不过期）
     * @returns {boolean} 是否成功
     */
    function save(key, value, expiryMinutes = 0) {
        try {
            const finalKey = validateKey(key);
            if (!finalKey) return false;

            // 序列化值
            let serializedValue;
            try {
                serializedValue = JSON.stringify(value);
            } catch (error) {
                throw createStorageError(ERROR_TYPE.SERIALIZE_ERROR, `值序列化失败：${error.message}`);
            }

            // 存储值
            localStorage.setItem(finalKey, serializedValue);

            // 存储过期时间（如果设置）
            if (expiryMinutes > 0) {
                const expiryTime = Date.now() + (expiryMinutes * 60 * 1000);
                localStorage.setItem(`${finalKey}${CONFIG.EXPIRY_SUFFIX}`, expiryTime.toString());
            } else {
                // 清除已存在的过期时间
                localStorage.removeItem(`${finalKey}${CONFIG.EXPIRY_SUFFIX}`);
            }

            console.log(`[Storage] ✅ 数据已存储: ${finalKey}`);
            return true;
        } catch (error) {
            // 处理存储满的情况
            if (error.name === 'QuotaExceededError') {
                error.type = ERROR_TYPE.STORAGE_FULL;
                error.message = '本地存储已满，无法存储数据';
            }
            console.error('[Storage] ❌ 保存失败:', error);
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast(`存储失败：${error.message}`, 'error');
            }
            return false;
        }
    }

    /**
     * 读取数据
     * @param {string} key - 键名
     * @returns {*|null} 存储值（过期/不存在返回null）
     */
    function load(key) {
        try {
            const finalKey = validateKey(key);
            if (!finalKey) return null;

            // 检查过期时间
            const expiryKey = `${finalKey}${CONFIG.EXPIRY_SUFFIX}`;
            const expiryTimeStr = localStorage.getItem(expiryKey);
            if (expiryTimeStr) {
                const expiryTime = Number(expiryTimeStr);
                if (Date.now() > expiryTime) {
                    // 已过期，删除数据
                    remove(key);
                    console.log(`[Storage] 数据已过期: ${finalKey}`);
                    return null;
                }
            }

            // 获取并反序列化值
            const serializedValue = localStorage.getItem(finalKey);
            if (serializedValue === null) return null;

            try {
                return JSON.parse(serializedValue);
            } catch (error) {
                throw createStorageError(ERROR_TYPE.DESERIALIZE_ERROR, `值反序列化失败：${error.message}`);
            }
        } catch (error) {
            if (error.type !== ERROR_TYPE.EXPIRED) {
                console.error('[Storage] ❌ 读取失败:', error);
                if (window.WorkbenchUtils) {
                    WorkbenchUtils.toast(`读取存储失败：${error.message}`, 'error');
                }
            }
            return null;
        }
    }

    /**
     * 删除数据
     * @param {string} key - 键名
     * @returns {boolean} 是否成功
     */
    function remove(key) {
        try {
            const finalKey = validateKey(key);
            if (!finalKey) return false;

            // 删除值和过期时间
            localStorage.removeItem(finalKey);
            localStorage.removeItem(`${finalKey}${CONFIG.EXPIRY_SUFFIX}`);

            console.log(`[Storage] ✅ 数据已删除: ${finalKey}`);
            return true;
        } catch (error) {
            console.error('[Storage] ❌ 删除失败:', error);
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast(`删除存储失败：${error.message}`, 'error');
            }
            return false;
        }
    }

    /**
     * 清空所有workbench前缀的存储
     * @returns {number} 清除的数量
     */
    function clear() {
        try {
            const keys = Object.keys(localStorage);
            let count = 0;
            
            keys.forEach(key => {
                if (key.startsWith(CONFIG.PREFIX)) {
                    localStorage.removeItem(key);
                    count++;
                }
            });
            
            console.log(`[Storage] ✅ 已清空 ${count} 个存储项`);
            return count;
        } catch (error) {
            console.error('[Storage] ❌ 清空失败:', error);
            if (window.WorkbenchUtils) {
                WorkbenchUtils.toast(`清空存储失败：${error.message}`, 'error');
            }
            return 0;
        }
    }

    /**
     * 清理过期数据
     * @returns {number} 清理的数量
     */
    function cleanExpiredData() {
        try {
            const keys = Object.keys(localStorage);
            let count = 0;
            
            keys.forEach(key => {
                if (key.startsWith(CONFIG.PREFIX) && key.endsWith(CONFIG.EXPIRY_SUFFIX)) {
                    const expiryTime = Number(localStorage.getItem(key));
                    if (Date.now() > expiryTime) {
                        // 移除过期的数据
                        const dataKey = key.replace(CONFIG.EXPIRY_SUFFIX, '');
                        localStorage.removeItem(dataKey);
                        localStorage.removeItem(key);
                        count++;
                    }
                }
            });
            
            if (count > 0) {
                console.log(`[Storage] ✅ 已清理 ${count} 个过期项`);
            }
            return count;
        } catch (error) {
            console.error('[Storage] ❌ 清理过期数据失败:', error);
            return 0;
        }
    }

    /**
     * 获取所有workbench键名
     * @returns {Array<string>} 键名数组
     */
    function keys() {
        try {
            const allKeys = Object.keys(localStorage);
            return allKeys.filter(key => 
                key.startsWith(CONFIG.PREFIX) && 
                !key.endsWith(CONFIG.EXPIRY_SUFFIX)
            );
        } catch (error) {
            console.error('[Storage] ❌ 获取键名失败:', error);
            return [];
        }
    }

    /**
     * 检查键是否存在
     * @param {string} key - 键名
     * @returns {boolean} 是否存在
     */
    function has(key) {
        try {
            const finalKey = validateKey(key);
            if (!finalKey) return false;
            
            return localStorage.getItem(finalKey) !== null;
        } catch (error) {
            return false;
        }
    }

    /**
     * 获取存储占用大小（字节）
     * @returns {Object} 大小信息
     */
    function getSize() {
        try {
            let total = 0;
            let workbenchSize = 0;
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                const itemSize = key.length + (value ? value.length : 0);
                
                total += itemSize;
                
                if (key.startsWith(CONFIG.PREFIX)) {
                    workbenchSize += itemSize;
                }
            }
            
            return {
                total: total,
                workbench: workbenchSize,
                totalKB: (total / 1024).toFixed(2),
                workbenchKB: (workbenchSize / 1024).toFixed(2)
            };
        } catch (error) {
            console.error('[Storage] ❌ 获取大小失败:', error);
            return { total: 0, workbench: 0, totalKB: '0', workbenchKB: '0' };
        }
    }

    /**
     * 获取存储统计信息
     * @returns {Object} 统计信息
     */
    function getStats() {
        const size = getSize();
        const allKeys = keys();
        
        return {
            count: allKeys.length,
            size: size,
            prefix: CONFIG.PREFIX,
            available: isLocalStorageAvailable()
        };
    }

    /**
     * 批量保存
     * @param {Object} data - 键值对对象
     * @returns {Object} 结果统计
     */
    function batchSave(data) {
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        try {
            Object.entries(data).forEach(([key, value]) => {
                if (save(key, value)) {
                    results.success++;
                } else {
                    results.failed++;
                    results.errors.push(`${key}: 保存失败`);
                }
            });
            
            console.log(`[Storage] 批量保存完成: 成功${results.success}, 失败${results.failed}`);
        } catch (error) {
            console.error('[Storage] ❌ 批量保存失败:', error);
        }

        return results;
    }

    /**
     * 批量读取
     * @param {Array<string>} keyList - 键名数组
     * @returns {Object} 键值对对象
     */
    function batchLoad(keyList) {
        const results = {};

        try {
            keyList.forEach(key => {
                const value = load(key);
                if (value !== null) {
                    results[key] = value;
                }
            });
            
            console.log(`[Storage] 批量读取完成: ${Object.keys(results).length}/${keyList.length}`);
        } catch (error) {
            console.error('[Storage] ❌ 批量读取失败:', error);
        }

        return results;
    }

    /**
     * 获取配置
     * @returns {Object} 配置对象
     */
    function getConfig() {
        return { ...CONFIG };
    }

    // 公共API
    const api = {
        // 初始化
        init,
        
        // 基础操作
        save,
        load,
        remove,
        clear,
        
        // 键管理
        validateKey,
        safeValidateKey,
        keys,
        has,
        
        // 批量操作
        batchSave,
        batchLoad,
        
        // 工具方法
        cleanExpiredData,
        getSize,
        getStats,
        getConfig,
        isLocalStorageAvailable,
        
        // 常量
        CONFIG,
        ERROR_TYPE
    };

    return api;
})();

// 挂载到全局
window.WorkbenchStorage = WorkbenchStorage;

// 模块导出（支持CommonJS和ES模块）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkbenchStorage;
} else if (typeof define === 'function' && define.amd) {
    define([], () => WorkbenchStorage);
}

console.log('[Storage] 存储模块已加载');
