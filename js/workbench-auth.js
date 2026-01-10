/**
 * V14.2 PRO - 认证模块
 * 用户认证 + 权限管理 + 会话控制
 * 优化版本 - 2026-01-03
 * @namespace WorkbenchAuth
 */
const WorkbenchAuth = (() => {
    'use strict';

    // 配置常量（统一workbench_前缀）
    const CONFIG = {
        STORAGE_KEY: 'workbench_auth_session',
        TOKEN_KEY: 'workbench_auth_token',
        SESSION_EXPIRY: 24 * 60 * 60 * 1000, // 24小时会话过期
        MAX_RETRY: 3,
        DEFAULT_ROLE: 'user'
    };

    // 权限定义
    const PERMISSIONS = {
        ADMIN: ['dashboard', 'orders', 'customers', 'suppliers', 'finance', 'settings', 'reports'],
        MANAGER: ['dashboard', 'orders', 'customers', 'suppliers', 'finance'],
        USER: ['dashboard', 'orders', 'customers']
    };

    // 状态管理
    const state = {
        isAuthenticated: false,
        currentUser: null,
        sessionExpiry: null,
        isInitializing: false,
        sessionTimer: null
    };

    /**
     * 初始化认证模块（供loader调用）
     * @returns {boolean} 是否成功
     */
    function init() {
        if (state.isInitializing) {
            console.warn('[Auth] 认证模块正在初始化...');
            return false;
        }
        
        state.isInitializing = true;
        
        try {
            console.log('[Auth] 认证模块初始化中...');
            
            // 检查本地存储的会话
            checkStoredSession();
            
            console.log('[Auth] ✅ 认证模块已初始化');
            console.log('[Auth] 认证状态:', state.isAuthenticated ? '已登录' : '未登录');
            if (state.currentUser) {
                console.log('[Auth] 当前用户:', state.currentUser.username);
            }
            
            return true;
        } catch (error) {
            console.error('[Auth] ❌ 初始化失败:', error);
            return false;
        } finally {
            state.isInitializing = false;
        }
    }

    /**
     * 检查存储的会话
     * @returns {boolean} 是否有有效的会话
     */
    function checkStoredSession() {
        try {
            // 使用WorkbenchStorage模块读取
            const sessionData = WorkbenchStorage ? 
                WorkbenchStorage.load(CONFIG.STORAGE_KEY) : 
                JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || 'null');

            if (sessionData && sessionData.user && sessionData.expiry) {
                const now = Date.now();
                if (now < sessionData.expiry) {
                    // 会话有效
                    state.isAuthenticated = true;
                    state.currentUser = sessionData.user;
                    state.sessionExpiry = sessionData.expiry;
                    
                    console.log('[Auth] 会话已恢复:', state.currentUser.username);
                    
                    // 启动会话超时检查
                    startSessionTimer();
                    return true;
                } else {
                    // 会话过期
                    console.log('[Auth] 会话已过期');
                    logout('会话已过期');
                }
            }
            
            return false;
        } catch (error) {
            console.error('[Auth] ❌ 检查会话失败:', error);
            logout('会话验证失败');
            return false;
        }
    }

    /**
     * 用户名密码登录
     * @param {string} username - 用户名
     * @param {string} password - 密码
     * @returns {Promise<Object>} 登录结果
     */
    async function login(username, password) {
        try {
            // 参数验证
            if (!username || !password) {
                throw new Error('用户名和密码不能为空');
            }

            console.log('[Auth] 尝试登录:', username);

            // 模拟后端验证
            const user = await validateCredentials(username, password);
            
            if (user) {
                // 创建会话
                await createSession(user);
                
                console.log('[Auth] ✅ 登录成功:', user.username);
                
                return {
                    success: true,
                    user: user,
                    message: '登录成功'
                };
            }
            
            throw new Error('用户名或密码错误');
        } catch (error) {
            console.error('[Auth] ❌ 登录失败:', error);
            return {
                success: false,
                message: error.message || '登录失败，请重试'
            };
        }
    }

    /**
     * 验证凭据（模拟后端）
     * @param {string} username - 用户名
     * @param {string} password - 密码
     * @returns {Promise<Object|null>} 用户信息
     */
    async function validateCredentials(username, password) {
        // 模拟数据（实际项目中应替换为API调用）
        const mockUsers = [
            {
                id: 'admin1',
                username: 'admin',
                password: 'admin123',
                name: '系统管理员',
                email: 'admin@example.com',
                role: 'ADMIN',
                permissions: PERMISSIONS.ADMIN
            },
            {
                id: 'manager1',
                username: 'manager',
                password: 'manager123',
                name: '部门经理',
                email: 'manager@example.com',
                role: 'MANAGER',
                permissions: PERMISSIONS.MANAGER
            },
            {
                id: 'user1',
                username: 'user',
                password: 'user123',
                name: '普通用户',
                email: 'user@example.com',
                role: 'USER',
                permissions: PERMISSIONS.USER
            }
        ];

        // 简单的凭据验证
        const user = mockUsers.find(u => 
            u.username === username && u.password === password
        );

        if (user) {
            // 移除密码信息
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        }

        return null;
    }

    /**
     * 创建会话
     * @param {Object} user - 用户信息
     * @returns {Promise<boolean>} 是否成功
     */
    async function createSession(user) {
        try {
            const expiry = Date.now() + CONFIG.SESSION_EXPIRY;
            
            // 保存会话信息
            const sessionData = {
                user: user,
                expiry: expiry,
                createdAt: new Date().toISOString()
            };

            // 使用WorkbenchStorage模块保存
            if (WorkbenchStorage) {
                WorkbenchStorage.save(CONFIG.STORAGE_KEY, sessionData);
            } else {
                localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(sessionData));
            }

            // 更新状态
            state.isAuthenticated = true;
            state.currentUser = user;
            state.sessionExpiry = expiry;

            // 启动会话计时器
            startSessionTimer();

            // 显示登录成功消息
            if (WorkbenchUtils) {
                WorkbenchUtils.toast(`欢迎回来，${user.name}！`, 'success');
            }

            console.log('[Auth] ✅ 会话已创建');
            return true;
        } catch (error) {
            console.error('[Auth] ❌ 创建会话失败:', error);
            throw error;
        }
    }

    /**
     * 登出系统
     * @param {string} reason - 登出原因
     * @returns {boolean} 是否成功
     */
    function logout(reason = '用户主动登出') {
        try {
            console.log('[Auth] 登出系统:', reason);

            // 清除会话信息
            if (WorkbenchStorage) {
                WorkbenchStorage.remove(CONFIG.STORAGE_KEY);
            } else {
                localStorage.removeItem(CONFIG.STORAGE_KEY);
            }

            // 清除状态
            state.isAuthenticated = false;
            state.currentUser = null;
            state.sessionExpiry = null;

            // 清除会话计时器
            clearSessionTimer();

            // 显示登出消息
            if (WorkbenchUtils && reason !== '会话验证失败') {
                WorkbenchUtils.toast(reason === '用户主动登出' ? '已安全登出系统' : reason, 'info');
            }

            console.log('[Auth] ✅ 已登出');
            return true;
        } catch (error) {
            console.error('[Auth] ❌ 登出失败:', error);
            return false;
        }
    }

    /**
     * 启动会话计时器
     */
    function startSessionTimer() {
        clearSessionTimer();
        
        if (state.sessionExpiry) {
            const timeRemaining = state.sessionExpiry - Date.now();
            
            if (timeRemaining > 0) {
                state.sessionTimer = setTimeout(() => {
                    logout('会话超时');
                }, timeRemaining);
                
                console.log('[Auth] 会话计时器已启动，剩余时间:', Math.floor(timeRemaining / 1000 / 60), '分钟');
            }
        }
    }

    /**
     * 清除会话计时器
     */
    function clearSessionTimer() {
        if (state.sessionTimer) {
            clearTimeout(state.sessionTimer);
            state.sessionTimer = null;
        }
    }

    /**
     * 检查是否已认证
     * @returns {boolean} 是否已认证
     */
    function isAuthenticated() {
        return state.isAuthenticated;
    }

    /**
     * 获取当前用户
     * @returns {Object|null} 当前用户信息
     */
    function getCurrentUser() {
        return state.currentUser ? { ...state.currentUser } : null;
    }

    /**
     * 检查权限
     * @param {string} permission - 权限名称
     * @returns {boolean} 是否有权限
     */
    function hasPermission(permission) {
        if (!state.isAuthenticated || !state.currentUser) {
            return false;
        }

        const userPermissions = state.currentUser.permissions || 
            PERMISSIONS[state.currentUser.role] || 
            PERMISSIONS[CONFIG.DEFAULT_ROLE];

        return userPermissions.includes(permission);
    }

    /**
     * 检查角色
     * @param {string} role - 角色名称
     * @returns {boolean} 是否是该角色
     */
    function hasRole(role) {
        if (!state.isAuthenticated || !state.currentUser) {
            return false;
        }

        return state.currentUser.role === role;
    }

    /**
     * 刷新会话
     * @returns {boolean} 是否成功
     */
    function refreshSession() {
        if (!state.isAuthenticated || !state.currentUser) {
            return false;
        }

        try {
            // 延长会话时间
            const newExpiry = Date.now() + CONFIG.SESSION_EXPIRY;
            state.sessionExpiry = newExpiry;

            // 更新存储的会话
            const sessionData = {
                user: state.currentUser,
                expiry: newExpiry,
                createdAt: new Date().toISOString()
            };

            if (WorkbenchStorage) {
                WorkbenchStorage.save(CONFIG.STORAGE_KEY, sessionData);
            } else {
                localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(sessionData));
            }

            // 重启计时器
            startSessionTimer();

            console.log('[Auth] ✅ 会话已刷新');
            return true;
        } catch (error) {
            console.error('[Auth] ❌ 刷新会话失败:', error);
            return false;
        }
    }

    /**
     * 获取会话状态
     * @returns {Object} 会话状态
     */
    function getSessionStatus() {
        return {
            isAuthenticated: state.isAuthenticated,
            user: state.currentUser,
            expiry: state.sessionExpiry,
            timeRemaining: state.sessionExpiry ? Math.max(0, state.sessionExpiry - Date.now()) : 0,
            timeRemainingMinutes: state.sessionExpiry ? Math.floor(Math.max(0, state.sessionExpiry - Date.now()) / 1000 / 60) : 0
        };
    }

    /**
     * 权限守卫 - 路由保护
     * @param {string} permission - 需要的权限
     * @returns {boolean} 是否允许访问
     */
    function authGuard(permission) {
        if (!isAuthenticated()) {
            if (WorkbenchUtils) {
                WorkbenchUtils.toast('请先登录系统', 'warning');
            }
            return false;
        }

        if (permission && !hasPermission(permission)) {
            if (WorkbenchUtils) {
                WorkbenchUtils.toast('您没有访问该功能的权限', 'error');
            }
            return false;
        }

        return true;
    }

    /**
     * 匿名登录（用于测试或无需认证的场景）
     * @returns {Promise<Object>} 登录结果
     */
    async function anonymousLogin() {
        try {
            const anonymousUser = {
                id: 'anonymous',
                username: 'anonymous',
                name: '访客',
                email: '',
                role: 'USER',
                permissions: PERMISSIONS.USER,
                isAnonymous: true
            };

            await createSession(anonymousUser);

            console.log('[Auth] ✅ 匿名登录成功');

            return {
                success: true,
                user: anonymousUser,
                message: '已以访客身份登录'
            };
        } catch (error) {
            console.error('[Auth] ❌ 匿名登录失败:', error);
            return {
                success: false,
                message: '匿名登录失败'
            };
        }
    }

    // 公共API
    const api = {
        // 初始化
        init,
        
        // 认证操作
        login,
        logout,
        anonymousLogin,
        refreshSession,
        
        // 状态检查
        isAuthenticated,
        getCurrentUser,
        getSessionStatus,
        
        // 权限控制
        hasPermission,
        hasRole,
        authGuard,
        
        // 常量
        PERMISSIONS,
        CONFIG
    };

    return api;
})();

// 挂载到全局
window.WorkbenchAuth = WorkbenchAuth;

// 模块导出（支持CommonJS和ES模块）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkbenchAuth;
} else if (typeof define === 'function' && define.amd) {
    define([], () => WorkbenchAuth);
}

console.log('[Auth] 认证模块已加载');
