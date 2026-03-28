/**
 * V14.2 PRO Firebase Connection Module
 * 负责与 Google Cloud Firestore 通信
 * 优化版本 - 2026-01-03 (修复版)
 * @namespace WorkbenchFirebase
 */
const WorkbenchFirebase = (() => {
    'use strict';

    // Firebase配置（已配置的参数）
    const DEFAULT_CONFIG = {
        apiKey: "AIzaSyDBb8AtMjSzjgh1SDmIQNJPHUPxk6tLhQQ",
        authDomain: "v5merp.firebaseapp.com",
        projectId: "v5merp",
        storageBucket: "v5merp.firebasestorage.app",
        messagingSenderId: "393124793142",
        appId: "1:393124793142:web:f669fb0287683970d38197"
    };

    // 集合名称常量（统一管理）
    const COLLECTIONS = {
        ORDERS: 'orders',
        SUPPLIERS: 'suppliers',
        CUSTOMERS: 'customers',
        EXPENSES: 'expenses',
        TODAY_ACTIONS: 'today_actions',
        SETTINGS: 'settings',
        USERS: 'users',
        MISC: 'misc', // 补充显式的misc集合
        HEARTBEAT: '_heartbeat' // 心跳检测集合
    };

    // 模块状态
    const state = {
        isInitialized: false,
        isConnected: false,
        isPersistenceEnabled: false,
        db: null,
        auth: null,
        storage: null,
        functions: null,
        config: null,
        error: null,
        syncCallbacks: [],
        lastSyncTime: null,
        autoSyncEnabled: true,
        syncInProgress: false,
        syncQueue: [], // 新增：同步队列，防止并发冲突
        authUnsubscribe: null, // 新增：认证监听取消函数
        connectedUnsubscribe: null, // 新增：连接监听取消函数
        syncDebounceTimer: null // 新增：同步防抖计时器
    };

    /**
     * 初始化Firebase
     * @param {Object} config - Firebase配置（可选，使用已配置的默认值）
     * @returns {Promise<boolean>} 是否成功
     */
    async function initialize(config = null) {
        try {
            if (state.isInitialized) {
                console.log('[Firebase] 已初始化，返回现有实例');
                return true;
            }

            console.log('[Firebase] 开始初始化...');

            // 验证Firebase SDK是否加载
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK未加载，请确保已包含Firebase脚本');
            }

            // 使用提供的配置或默认配置
            state.config = config || DEFAULT_CONFIG;

            // 防止重复初始化应用
            let app;
            try {
                app = firebase.app(); // 检查是否已有实例
            } catch (e) {
                app = firebase.initializeApp(state.config); // 新建实例
            }
            
            // 初始化服务
            state.db = app.firestore();
            state.auth = app.auth();
            state.storage = app.storage();
            state.functions = app.functions();

            // 启用离线持久化
            await enablePersistence();

            // 设置连接状态监听
            setupConnectionListeners();

            // 初始化认证状态
            await initializeAuthState();

            // 设置自动同步
            setupAutoSync();

            state.isInitialized = true;
            state.isConnected = true;
            state.lastSyncTime = new Date();

            console.log('[Firebase] ✅ 初始化成功');
            console.log('[Firebase] 项目ID:', state.config.projectId);
            
            // 触发连接成功回调
            notifySyncStatus('已连接', true);

            return true;
        } catch (error) {
            state.error = error;
            console.error('[Firebase] ❌ 初始化失败:', error.message);
            notifySyncStatus('连接失败', false);
            return false;
        }
    }

    /**
     * 启用离线持久化
     * @returns {Promise<void>}
     */
    async function enablePersistence() {
        try {
            await state.db.enablePersistence({
                synchronizeTabs: true
            });
            state.isPersistenceEnabled = true;
            console.log('[Firebase] 📱 离线持久化已启用');
        } catch (error) {
            console.warn('[Firebase] 离线持久化启用失败:', error.code);
            state.isPersistenceEnabled = false;
            
            // 完善错误提示和解决方案
            switch (error.code) {
                case 'failed-precondition':
                    console.warn('[Firebase] 提示: 多个标签页打开时离线持久化无法工作，请关闭多余标签页后刷新');
                    break;
                case 'unimplemented':
                    console.warn('[Firebase] 提示: 当前浏览器不支持离线持久化（如Safari私有模式），请切换浏览器或关闭私有模式');
                    break;
                default:
                    console.warn('[Firebase] 提示: 离线功能不可用，将仅在在线时同步数据');
            }
        }
    }

    /**
     * 设置连接状态监听
     */
    function setupConnectionListeners() {
        // 移除旧的监听（防止重复）
        if (state.connectedUnsubscribe) {
            state.connectedUnsubscribe();
        }

        // 使用.info/connected监听网络状态（Firebase官方推荐）
        const connectedRef = state.db.doc('.info/connected');
        state.connectedUnsubscribe = connectedRef.onSnapshot(async (snapshot) => {
            const isConnected = snapshot.data()?.connected === true;
            
            if (isConnected !== state.isConnected) {
                state.isConnected = isConnected;
                if (isConnected) {
                    console.log('[Firebase] 🌐 已连接到网络');
                    notifySyncStatus('已连接', true);
                    // 网络恢复后自动同步队列中的任务
                    processSyncQueue();
                } else {
                    console.log('[Firebase] 📡 网络连接已断开');
                    notifySyncStatus('离线', false);
                }
            }
        });

        // 心跳检测（兜底）
        const checkConnection = async () => {
            if (!state.isInitialized) return;
            
            try {
                await state.db.collection(COLLECTIONS.HEARTBEAT).doc('check').set({ 
                    timestamp: firebase.firestore.FieldValue.serverTimestamp() 
                }, { merge: true }); // 使用merge避免覆盖
            } catch (error) {
                if (state.isConnected) {
                    state.isConnected = false;
                    console.log('[Firebase] 📡 心跳检测失败，确认离线');
                    notifySyncStatus('离线', false);
                }
            }
        };

        // 每30秒检查一次连接状态
        setInterval(checkConnection, 30000);
        
        // 立即执行一次
        checkConnection();
    }

    /**
     * 初始化认证状态
     * @returns {Promise<void>}
     */
    async function initializeAuthState() {
        return new Promise((resolve) => {
            // 移除旧的认证监听
            if (state.authUnsubscribe) {
                state.authUnsubscribe();
            }

            state.authUnsubscribe = state.auth.onAuthStateChanged(async (user) => {
                if (user) {
                    console.log('[Firebase] 👤 用户已登录:', user.email || '匿名用户');
                } else {
                    console.log('[Firebase] 👤 匿名模式（未登录）');
                    // 匿名登录以便使用Firebase服务
                    try {
                        await state.auth.signInAnonymously();
                    } catch (err) {
                        console.warn('[Firebase] 匿名登录失败:', err);
                    }
                }
                resolve();
            });
        });
    }

    /**
     * 设置自动同步（防抖处理）
     */
    function setupAutoSync() {
        if (!state.autoSyncEnabled) {
            console.log('[Firebase] 自动同步已禁用');
            return;
        }

        // 监听localStorage变化并自动同步（防抖）
        const handleStorageChange = (e) => {
            if (!e.key || !e.key.startsWith('workbench_')) return;
            
            console.log('[Firebase] 检测到本地数据变化:', e.key);
            
            // 清除旧的计时器，防抖处理（500ms内多次触发只执行一次）
            clearTimeout(state.syncDebounceTimer);
            state.syncDebounceTimer = setTimeout(() => {
                // 将同步任务加入队列
                addToSyncQueue(() => syncLocalStorageToCloud(e.key));
            }, 500);
        };

        // 先移除旧监听，防止重复
        window.removeEventListener('storage', handleStorageChange);
        window.addEventListener('storage', handleStorageChange);

        console.log('[Firebase] ✅ 自动同步已启用（防抖模式）');
    }

    /**
     * 新增：添加同步任务到队列
     * @param {Function} syncTask - 同步任务函数
     */
    function addToSyncQueue(syncTask) {
        state.syncQueue.push(syncTask);
        // 如果当前没有同步中，立即处理队列
        if (!state.syncInProgress && state.isConnected) {
            processSyncQueue();
        }
    }

    /**
     * 新增：处理同步队列
     */
    async function processSyncQueue() {
        if (state.syncInProgress || !state.isConnected || state.syncQueue.length === 0) {
            return;
        }

        state.syncInProgress = true;
        console.log(`[Firebase] 开始处理同步队列（${state.syncQueue.length} 个任务）`);

        try {
            // 逐个执行队列中的任务
            while (state.syncQueue.length > 0) {
                const task = state.syncQueue.shift();
                await task();
            }
            console.log('[Firebase] ✅ 同步队列处理完成');
        } catch (error) {
            console.error('[Firebase] ❌ 同步队列处理失败:', error);
        } finally {
            state.syncInProgress = false;
            state.lastSyncTime = new Date();
            notifySyncStatus('已同步', true);
        }
    }

    /**
     * 同步本地存储到云端（优化版）
     * @param {string} key - 存储键名
     * @returns {Promise<boolean>}
     */
    async function syncLocalStorageToCloud(key) {
        if (!state.isInitialized || !state.isConnected) {
            console.log('[Firebase] 未初始化/离线，将任务加入同步队列:', key);
            addToSyncQueue(() => syncLocalStorageToCloud(key));
            return false;
        }

        try {
            const value = localStorage.getItem(key);
            
            if (!value) {
                console.log('[Firebase] 键值为空，跳过同步:', key);
                return false;
            }

            // 新增：解析JSON数据（兼容JSON格式的本地存储）
            let parsedValue;
            try {
                parsedValue = JSON.parse(value);
            } catch (e) {
                parsedValue = value; // 非JSON格式直接使用原始值
            }

            // 确定集合名称（优化判断逻辑）
            const collection = getCollectionNameFromKey(key);
            const userId = getCurrentUserId();
            const docId = `${userId}_${key.replace('workbench_', '')}`; // 优化docId格式

            // 保存到云端（添加数据验证）
            const syncData = {
                key: key,
                value: parsedValue, // 存储解析后的值（更易查询）
                rawValue: value, // 保留原始值（兼容旧数据）
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userId: userId
            };

            await save(collection, docId, syncData);

            console.log('[Firebase] ✅ 已同步:', key);
            return true;
        } catch (error) {
            console.error('[Firebase] ❌ 同步失败:', error);
            // 失败任务重新加入队列（最多重试3次）
            const retryCount = (state.syncQueue.find(t => t.toString().includes(key))?.retryCount || 0) + 1;
            if (retryCount <= 3) {
                const retryTask = () => syncLocalStorageToCloud(key);
                retryTask.retryCount = retryCount;
                addToSyncQueue(retryTask);
                console.log(`[Firebase] ⏳ 同步任务将重试（第${retryCount}次）:`, key);
            }
            return false;
        }
    }

    /**
     * 从键名获取集合名称（优化精准度）
     * @param {string} key - 存储键名
     * @returns {string} 集合名称
     */
    function getCollectionNameFromKey(key) {
        const keyLower = key.toLowerCase();
        if (keyLower.includes('orders')) return COLLECTIONS.ORDERS;
        if (keyLower.includes('suppliers')) return COLLECTIONS.SUPPLIERS;
        if (keyLower.includes('customers')) return COLLECTIONS.CUSTOMERS;
        if (keyLower.includes('expenses')) return COLLECTIONS.EXPENSES;
        if (keyLower.includes('today_actions') || keyLower.includes('today')) return COLLECTIONS.TODAY_ACTIONS;
        if (keyLower.includes('settings')) return COLLECTIONS.SETTINGS;
        return COLLECTIONS.MISC; // 使用显式的MISC常量
    }

    /**
     * 获取当前用户ID（匿名或已登录）
     * @returns {string}
     */
    function getCurrentUserId() {
        if (state.auth && state.auth.currentUser) {
            return state.auth.currentUser.uid;
        }
        // 如果没有用户，使用设备ID（优化生成逻辑）
        let deviceId = localStorage.getItem('workbench_device_id');
        if (!deviceId) {
            deviceId = generateId('device');
            localStorage.setItem('workbench_device_id', deviceId);
        }
        return deviceId;
    }

    /**
     * 保存数据到云端
     * @param {string} collection - 集合名称
     * @param {string} docId - 文档ID
     * @param {Object} data - 数据对象
     * @param {boolean} merge - 是否合并数据
     * @returns {Promise<boolean>} 是否成功
     */
    async function save(collection, docId, data, merge = true) {
        try {
            validateInitialization();
            validateCollectionName(collection);
            validateDocumentId(docId);
            validateData(data);

            await state.db.collection(collection).doc(docId).set(data, { merge });
            console.log(`[Firebase] ✅ 已保存 ${collection}/${docId}`);
            return true;
        } catch (error) {
            console.error('[Firebase] ❌ 保存失败:', error.message);
            // 处理权限错误
            if (error.code === 'permission-denied') {
                console.error('[Firebase] 权限错误: 请检查Firestore安全规则是否配置正确');
            }
            return false;
        }
    }

    /**
     * 从云端读取数据
     * @param {string} collection - 集合名称
     * @param {string} docId - 文档ID
     * @returns {Promise<Object|null>} 文档数据
     */
    async function load(collection, docId) {
        try {
            validateInitialization();
            validateCollectionName(collection);
            validateDocumentId(docId);

            const doc = await state.db.collection(collection).doc(docId).get();
            
            if (doc.exists) {
                console.log(`[Firebase] ✅ 已加载 ${collection}/${docId}`);
                return {
                    ...doc.data(),
                    _id: doc.id,
                    _exists: true,
                    _metadata: doc.metadata
                };
            }
            
            console.log(`[Firebase] 文档 ${collection}/${docId} 不存在`);
            return null;
        } catch (error) {
            console.error('[Firebase] ❌ 加载失败:', error.message);
            return null;
        }
    }

    /**
     * 查询集合数据
     * @param {string} collection - 集合名称
     * @param {Array} queries - 查询条件数组
     * @param {Object} options - 查询选项
     * @returns {Promise<Array>} 查询结果
     */
    async function query(collection, queries = [], options = {}) {
        try {
            validateInitialization();
            validateCollectionName(collection);

            let queryRef = state.db.collection(collection);

            // 应用查询条件
            queries.forEach(([field, operator, value]) => {
                queryRef = queryRef.where(field, operator, value);
            });

            // 应用排序
            if (options.orderBy) {
                const { field, direction = 'asc' } = options.orderBy;
                queryRef = queryRef.orderBy(field, direction);
            }

            // 应用限制
            if (options.limit) {
                queryRef = queryRef.limit(options.limit);
            }

            // 应用分页
            if (options.startAfter) {
                queryRef = queryRef.startAfter(options.startAfter);
            }

            const snapshot = await queryRef.get();
            
            const results = [];
            snapshot.forEach(doc => {
                results.push({
                    ...doc.data(),
                    _id: doc.id,
                    _exists: true,
                    _metadata: doc.metadata
                });
            });

            console.log(`[Firebase] 查询 ${collection} 返回 ${results.length} 条结果`);
            return results;
        } catch (error) {
            console.error('[Firebase] ❌ 查询失败:', error.message);
            return [];
        }
    }

    /**
     * 删除文档
     * @param {string} collection - 集合名称
     * @param {string} docId - 文档ID
     * @returns {Promise<boolean>} 是否成功
     */
    async function remove(collection, docId) {
        try {
            validateInitialization();
            validateCollectionName(collection);
            validateDocumentId(docId);

            await state.db.collection(collection).doc(docId).delete();
            console.log(`[Firebase] ✅ 已删除 ${collection}/${docId}`);
            return true;
        } catch (error) {
            console.error('[Firebase] ❌ 删除失败:', error.message);
            return false;
        }
    }

    /**
     * 批量操作
     * @param {Array} operations - 操作数组
     * @returns {Promise<boolean>} 是否成功
     */
    async function batch(operations) {
        try {
            validateInitialization();
            
            if (!Array.isArray(operations) || operations.length === 0) {
                throw new Error('操作数组不能为空');
            }

            const batchWrite = state.db.batch();

            operations.forEach(({ type, collection, docId, data }) => {
                validateCollectionName(collection);
                validateDocumentId(docId);

                const docRef = state.db.collection(collection).doc(docId);

                switch (type) {
                    case 'set':
                        validateData(data);
                        batchWrite.set(docRef, data, { merge: true });
                        break;
                    case 'update':
                        validateData(data);
                        batchWrite.update(docRef, data);
                        break;
                    case 'delete':
                        batchWrite.delete(docRef);
                        break;
                    default:
                        throw new Error(`未知的操作类型: ${type}`);
                }
            });

            await batchWrite.commit();
            console.log(`[Firebase] ✅ 批量操作成功 (${operations.length} 个操作)`);
            return true;
        } catch (error) {
            console.error('[Firebase] ❌ 批量操作失败:', error.message);
            return false;
        }
    }

    /**
     * 上传文件到存储
     * @param {File} file - 文件对象
     * @param {string} path - 存储路径
     * @param {Function} progressCallback - 进度回调
     * @returns {Promise<string>} 下载URL
     */
    async function uploadFile(file, path, progressCallback = null) {
        try {
            validateInitialization();
            
            if (!file || !(file instanceof File)) {
                throw new Error('必须提供有效的文件对象');
            }

            if (!path || typeof path !== 'string') {
                throw new Error('存储路径不能为空');
            }

            const storageRef = state.storage.ref(path);
            const uploadTask = storageRef.put(file);

            return new Promise((resolve, reject) => {
                uploadTask.on(
                    'state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        console.log(`[Firebase] 上传进度: ${progress.toFixed(1)}%`);
                        
                        if (progressCallback && typeof progressCallback === 'function') {
                            progressCallback(progress);
                        }
                    },
                    (error) => {
                        console.error('[Firebase] ❌ 文件上传失败:', error.message);
                        reject(error);
                    },
                    async () => {
                        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                        console.log('[Firebase] ✅ 文件上传成功:', path);
                        resolve(downloadURL);
                    }
                );
            });
        } catch (error) {
            console.error('[Firebase] ❌ 文件上传失败:', error.message);
            throw error;
        }
    }

    /**
     * 删除存储中的文件
     * @param {string} path - 存储路径
     * @returns {Promise<boolean>} 是否成功
     */
    async function deleteFile(path) {
        try {
            validateInitialization();
            
            if (!path || typeof path !== 'string') {
                throw new Error('存储路径不能为空');
            }

            const storageRef = state.storage.ref(path);
            await storageRef.delete();
            console.log(`[Firebase] ✅ 文件已删除: ${path}`);
            return true;
        } catch (error) {
            console.error('[Firebase] ❌ 文件删除失败:', error.message);
            return false;
        }
    }

    /**
     * 用户登录
     * @param {string} email - 邮箱
     * @param {string} password - 密码
     * @returns {Promise<Object>} 用户信息
     */
    async function login(email, password) {
        try {
            validateInitialization();
            
            if (!email || !password) {
                throw new Error('邮箱和密码不能为空');
            }

            const userCredential = await state.auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            console.log('[Firebase] ✅ 用户登录成功:', user.email);
            
            // 登录后触发全量同步
            addToSyncQueue(syncAllLocalData);
            
            return {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                emailVerified: user.emailVerified
            };
        } catch (error) {
            console.error('[Firebase] ❌ 登录失败:', error.message);
            // 细化登录错误提示
            switch (error.code) {
                case 'user-not-found':
                    throw new Error('该邮箱未注册，请先注册');
                case 'wrong-password':
                    throw new Error('密码错误，请重新输入');
                case 'user-disabled':
                    throw new Error('该账号已被禁用，请联系管理员');
                default:
                    throw error;
            }
        }
    }

    /**
     * 用户注册
     * @param {string} email - 邮箱
     * @param {string} password - 密码
     * @param {string} displayName - 显示名称
     * @returns {Promise<Object>} 用户信息
     */
    async function register(email, password, displayName = '') {
        try {
            validateInitialization();
            
            if (!email || !password) {
                throw new Error('邮箱和密码不能为空');
            }

            // 密码强度验证
            if (password.length < 6) {
                throw new Error('密码长度不能少于6位');
            }

            const userCredential = await state.auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // 设置显示名称
            if (displayName) {
                await user.updateProfile({ displayName });
            }

            console.log('[Firebase] ✅ 用户注册成功:', user.email);
            return {
                uid: user.uid,
                email: user.email,
                displayName: displayName || user.displayName,
                photoURL: user.photoURL,
                emailVerified: user.emailVerified
            };
        } catch (error) {
            console.error('[Firebase] ❌ 注册失败:', error.message);
            // 细化注册错误提示
            switch (error.code) {
                case 'email-already-in-use':
                    throw new Error('该邮箱已被注册，请直接登录');
                case 'invalid-email':
                    throw new Error('邮箱格式不正确，请检查');
                case 'operation-not-allowed':
                    throw new Error('注册功能暂未开放，请联系管理员');
                case 'weak-password':
                    throw new Error('密码强度不足，请使用更复杂的密码');
                default:
                    throw error;
            }
        }
    }

    /**
     * 用户登出
     * @returns {Promise<boolean>} 是否成功
     */
    async function logout() {
        try {
            validateInitialization();
            
            // 登出前取消所有监听
            if (state.authUnsubscribe) {
                state.authUnsubscribe();
            }
            if (state.connectedUnsubscribe) {
                state.connectedUnsubscribe();
            }

            await state.auth.signOut();
            console.log('[Firebase] ✅ 用户已登出');
            return true;
        } catch (error) {
            console.error('[Firebase] ❌ 登出失败:', error.message);
            return false;
        }
    }

    /**
     * 获取当前用户
     * @returns {Object|null} 用户信息
     */
    function getCurrentUser() {
        try {
            validateInitialization();
            
            const user = state.auth.currentUser;
            if (!user) return null;

            return {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                emailVerified: user.emailVerified,
                isAnonymous: user.isAnonymous
            };
        } catch (error) {
            console.error('[Firebase] ❌ 获取用户失败:', error.message);
            return null;
        }
    }

    /**
     * 调用云函数
     * @param {string} functionName - 函数名称
     * @param {Object} data - 函数参数
     * @returns {Promise<any>} 函数返回值
     */
    async function callFunction(functionName, data = {}) {
        try {
            validateInitialization();
            
            if (!functionName || typeof functionName !== 'string') {
                throw new Error('函数名称不能为空');
            }

            const callable = state.functions.httpsCallable(functionName);
            const result = await callable(data);
            
            console.log(`[Firebase] ✅ 云函数 ${functionName} 调用成功`);
            return result.data;
        } catch (error) {
            console.error('[Firebase] ❌ 云函数调用失败:', error.message);
            throw error;
        }
    }

    /**
     * 同步今日三件事到云端
     * @param {Array} actions - 今日行动数组
     * @returns {Promise<boolean>}
     */
    async function syncTodayActions(actions) {
        try {
            validateInitialization();
            
            if (!Array.isArray(actions)) {
                throw new Error('今日行动必须是数组');
            }

            // 数据清洗：过滤空值
            const cleanActions = actions.filter(action => action && typeof action === 'object');

            const userId = getCurrentUserId();
            const docId = `${userId}_today`;

            await save(COLLECTIONS.TODAY_ACTIONS, docId, {
                actions: cleanActions,
                date: new Date().toISOString().split('T')[0],
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userId: userId
            });

            console.log('[Firebase] ✅ 今日行动已同步');
            return true;
        } catch (error) {
            console.error('[Firebase] ❌ 今日行动同步失败:', error);
            return false;
        }
    }

    /**
     * 同步订单数据
     * @param {Array} orders - 订单数组
     * @returns {Promise<boolean>}
     */
    async function syncOrders(orders) {
        try {
            validateInitialization();
            
            if (!Array.isArray(orders)) {
                throw new Error('订单数据必须是数组');
            }

            // 数据清洗
            const cleanOrders = orders.filter(order => order && typeof order === 'object');

            const userId = getCurrentUserId();
            const docId = `${userId}_orders`;

            await save(COLLECTIONS.ORDERS, docId, {
                orders: cleanOrders,
                count: cleanOrders.length,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userId: userId
            });

            console.log(`[Firebase] ✅ 已同步 ${cleanOrders.length} 个订单`);
            return true;
        } catch (error) {
            console.error('[Firebase] ❌ 订单同步失败:', error);
            return false;
        }
    }

    /**
     * 同步供应商数据
     * @param {Array} suppliers - 供应商数组
     * @returns {Promise<boolean>}
     */
    async function syncSuppliers(suppliers) {
        try {
            validateInitialization();
            
            if (!Array.isArray(suppliers)) {
                throw new Error('供应商数据必须是数组');
            }

            // 数据清洗
            const cleanSuppliers = suppliers.filter(supplier => supplier && typeof supplier === 'object');

            const userId = getCurrentUserId();
            const docId = `${userId}_suppliers`;

            await save(COLLECTIONS.SUPPLIERS, docId, {
                suppliers: cleanSuppliers,
                count: cleanSuppliers.length,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userId: userId
            });

            console.log(`[Firebase] ✅ 已同步 ${cleanSuppliers.length} 个供应商`);
            return true;
        } catch (error) {
            console.error('[Firebase] ❌ 供应商同步失败:', error);
            return false;
        }
    }

    /**
     * 同步客户数据
     * @param {Array} customers - 客户数组
     * @returns {Promise<boolean>}
     */
    async function syncCustomers(customers) {
        try {
            validateInitialization();
            
            if (!Array.isArray(customers)) {
                throw new Error('客户数据必须是数组');
            }

            // 数据清洗
            const cleanCustomers = customers.filter(customer => customer && typeof customer === 'object');

            const userId = getCurrentUserId();
            const docId = `${userId}_customers`;

            await save(COLLECTIONS.CUSTOMERS, docId, {
                customers: cleanCustomers,
                count: cleanCustomers.length,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userId: userId
            });

            console.log(`[Firebase] ✅ 已同步 ${cleanCustomers.length} 个客户`);
            return true;
        } catch (error) {
            console.error('[Firebase] ❌ 客户同步失败:', error);
            return false;
        }
    }

    /**
     * 同步收支记录数据
     * @param {Array} expenses - 收支记录数组
     * @returns {Promise<boolean>}
     */
    async function syncExpenses(expenses) {
        try {
            validateInitialization();
            
            if (!Array.isArray(expenses)) {
                throw new Error('收支记录数据必须是数组');
            }

            // 数据清洗
            const cleanExpenses = expenses.filter(expense => expense && typeof expense === 'object');

            const userId = getCurrentUserId();
            const docId = `${userId}_expenses`;

            await save(COLLECTIONS.EXPENSES, docId, {
                expenses: cleanExpenses,
                count: cleanExpenses.length,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userId: userId
            });

            console.log(`[Firebase] ✅ 已同步 ${cleanExpenses.length} 条收支记录`);
            return true;
        } catch (error) {
            console.error('[Firebase] ❌ 收支记录同步失败:', error);
            return false;
        }
    }

    /**
     * 同步所有本地数据到云端（优化并发处理）
     * @returns {Promise<Object>} 同步结果
     */
    async function syncAllLocalData() {
        console.log('[Firebase] 开始全量同步本地数据...');
        
        const results = {
            success: [],
            failed: [],
            total: 0
        };

        try {
            validateInitialization();

            // 获取所有workbench_开头的localStorage键
            const keys = Object.keys(localStorage).filter(k => k.startsWith('workbench_'));
            results.total = keys.length;

            console.log(`[Firebase] 找到 ${keys.length} 个本地数据项`);

            // 批量加入队列，避免并发过高
            keys.forEach(key => {
                addToSyncQueue(() => syncLocalStorageToCloud(key).then(success => {
                    if (success) {
                        results.success.push(key);
                    } else {
                        results.failed.push(key);
                    }
                }));
            });

            // 等待队列处理完成
            await processSyncQueue();

            console.log('[Firebase] ✅ 全量同步完成');
            console.log(`[Firebase] 成功: ${results.success.length}, 失败: ${results.failed.length}`);
            
            return results;
        } catch (error) {
            console.error('[Firebase] ❌ 全量同步失败:', error);
            return results;
        }
    }

    /**
     * 从云端恢复数据到本地（优化数据一致性）
     * @param {boolean} overwrite - 是否覆盖本地已有数据（默认false）
     * @returns {Promise<Object>} 恢复结果
     */
    async function restoreFromCloud(overwrite = false) {
        console.log('[Firebase] 开始从云端恢复数据...');
        
        const results = {
            success: [],
            failed: [],
            skipped: [], // 跳过的项（本地有新数据）
            total: 0
        };

        try {
            validateInitialization();
            
            const userId = getCurrentUserId();
            console.log('[Firebase] 当前用户ID:', userId);

            // 查询所有用户数据
            const collections = Object.values(COLLECTIONS);
            
            for (const collection of collections) {
                try {
                    console.log(`[Firebase] 查询集合: ${collection}`);
                    const docs = await query(collection, [['userId', '==', userId]]);
                    console.log(`[Firebase] 集合 ${collection} 返回 ${docs.length} 条文档`);
                    results.total += docs.length;

                    for (const doc of docs) {
                        // 处理格式1: syncLocalStorageToCloud 存储的数据（包含 key 和 rawValue）
                        if (doc.key && doc.rawValue) {
                            const localValue = localStorage.getItem(doc.key);
                            if (!overwrite && localValue) {
                                results.skipped.push(doc.key);
                                console.log(`[Firebase] ⏭️ 跳过恢复（本地已有数据）: ${doc.key}`);
                                continue;
                            }

                            localStorage.setItem(doc.key, doc.rawValue);
                            results.success.push(doc.key);
                            console.log(`[Firebase] ✅ 已恢复: ${doc.key}`);
                        }
                        // 处理格式2: syncOrders/syncSuppliers/syncCustomers/syncExpenses 存储的数据
                        else if (doc.orders && Array.isArray(doc.orders)) {
                            const key = 'workbench_orders';
                            const localValue = localStorage.getItem(key);
                            if (!overwrite && localValue) {
                                results.skipped.push(key);
                                console.log(`[Firebase] ⏭️ 跳过恢复（本地已有数据）: ${key}`);
                                continue;
                            }
                            localStorage.setItem(key, JSON.stringify(doc.orders));
                            results.success.push(key);
                            console.log(`[Firebase] ✅ 已恢复订单数据: ${doc.orders.length} 条`);
                        }
                        else if (doc.suppliers && Array.isArray(doc.suppliers)) {
                            const key = 'workbench_suppliers';
                            const localValue = localStorage.getItem(key);
                            if (!overwrite && localValue) {
                                results.skipped.push(key);
                                console.log(`[Firebase] ⏭️ 跳过恢复（本地已有数据）: ${key}`);
                                continue;
                            }
                            localStorage.setItem(key, JSON.stringify(doc.suppliers));
                            results.success.push(key);
                            console.log(`[Firebase] ✅ 已恢复供应商数据: ${doc.suppliers.length} 条`);
                        }
                        else if (doc.customers && Array.isArray(doc.customers)) {
                            const key = 'workbench_customers';
                            const localValue = localStorage.getItem(key);
                            if (!overwrite && localValue) {
                                results.skipped.push(key);
                                console.log(`[Firebase] ⏭️ 跳过恢复（本地已有数据）: ${key}`);
                                continue;
                            }
                            localStorage.setItem(key, JSON.stringify(doc.customers));
                            results.success.push(key);
                            console.log(`[Firebase] ✅ 已恢复客户数据: ${doc.customers.length} 条`);
                        }
                        else if (doc.expenses && Array.isArray(doc.expenses)) {
                            const key = 'workbench_expenses';
                            const localValue = localStorage.getItem(key);
                            if (!overwrite && localValue) {
                                results.skipped.push(key);
                                console.log(`[Firebase] ⏭️ 跳过恢复（本地已有数据）: ${key}`);
                                continue;
                            }
                            localStorage.setItem(key, JSON.stringify(doc.expenses));
                            results.success.push(key);
                            console.log(`[Firebase] ✅ 已恢复收支记录: ${doc.expenses.length} 条`);
                        }
                        else if (doc.actions && Array.isArray(doc.actions)) {
                            const key = 'workbench_today_actions';
                            const localValue = localStorage.getItem(key);
                            if (!overwrite && localValue) {
                                results.skipped.push(key);
                                console.log(`[Firebase] ⏭️ 跳过恢复（本地已有数据）: ${key}`);
                                continue;
                            }
                            localStorage.setItem(key, JSON.stringify(doc.actions));
                            results.success.push(key);
                            console.log(`[Firebase] ✅ 已恢复今日行动: ${doc.actions.length} 条`);
                        }
                        else {
                            console.log(`[Firebase] ⚠️ 无法识别的数据格式:`, Object.keys(doc));
                        }
                    }
                } catch (error) {
                    console.error(`[Firebase] 恢复集合 ${collection} 失败:`, error);
                    results.failed.push(collection);
                }
            }

            console.log('[Firebase] ✅ 数据恢复完成');
            console.log(`[Firebase] 成功: ${results.success.length}, 失败: ${results.failed.length}, 跳过: ${results.skipped.length}`);
            
            return results;
        } catch (error) {
            console.error('[Firebase] ❌ 数据恢复失败:', error);
            return results;
        }
    }

    /**
     * 注册同步状态回调
     * @param {Function} callback - 回调函数
     */
    function onSyncStatusChange(callback) {
        if (typeof callback === 'function') {
            // 去重：避免重复注册相同回调
            const exists = state.syncCallbacks.some(cb => cb.toString() === callback.toString());
            if (!exists) {
                state.syncCallbacks.push(callback);
            }
        }
    }

    /**
     * 移除同步状态回调
     * @param {Function} callback - 回调函数
     */
    function offSyncStatusChange(callback) {
        if (typeof callback === 'function') {
            state.syncCallbacks = state.syncCallbacks.filter(cb => cb.toString() !== callback.toString());
        }
    }

    /**
     * 通知同步状态变化
     * @param {string} status - 状态文本
     * @param {boolean} isConnected - 是否连接
     */
    function notifySyncStatus(status, isConnected) {
        state.syncCallbacks.forEach(callback => {
            try {
                callback({
                    status,
                    isConnected,
                    lastSyncTime: state.lastSyncTime,
                    queueLength: state.syncQueue.length
                });
            } catch (error) {
                console.error('[Firebase] 状态回调执行失败:', error);
            }
        });

        // 更新app的同步状态（如果存在）
        if (typeof app !== 'undefined' && app.updateSyncStatus) {
            app.updateSyncStatus(status, isConnected);
        }
    }

    /**
     * 验证初始化状态
     * @throws {Error} 未初始化时抛出错误
     */
    function validateInitialization() {
        if (!state.isInitialized || !state.db) {
            throw new Error('Firebase尚未初始化，请先调用initialize()');
        }
    }

    /**
     * 验证集合名称
     * @param {string} collection - 集合名称
     * @throws {Error} 无效集合名称时抛出错误
     */
    function validateCollectionName(collection) {
        if (!collection || typeof collection !== 'string' || collection.trim() === '') {
            throw new Error('集合名称不能为空');
        }
    }

    /**
     * 验证文档ID
     * @param {string} docId - 文档ID
     * @throws {Error} 无效文档ID时抛出错误
     */
    function validateDocumentId(docId) {
        if (!docId || typeof docId !== 'string' || docId.trim() === '') {
            throw new Error('文档ID不能为空');
        }
    }

    /**
     * 验证数据对象
     * @param {Object} data - 数据对象
     * @throws {Error} 无效数据时抛出错误
     */
    function validateData(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('数据必须是有效的对象');
        }
    }

    /**
     * 获取模块状态
     * @returns {Object} 状态信息
     */
    function getStatus() {
        return {
            isInitialized: state.isInitialized,
            isConnected: state.isConnected,
            isPersistenceEnabled: state.isPersistenceEnabled,
            hasAuth: !!state.auth,
            hasStorage: !!state.storage,
            hasFunctions: !!state.functions,
            autoSyncEnabled: state.autoSyncEnabled,
            syncInProgress: state.syncInProgress,
            syncQueueLength: state.syncQueue.length, // 新增：队列长度
            lastSyncTime: state.lastSyncTime,
            currentUser: getCurrentUser(),
            error: state.error ? {
                message: state.error.message,
                code: state.error.code
            } : null
        };
    }

    /**
     * 生成唯一ID
     * @param {string} prefix - 前缀
     * @returns {string} 唯一ID
     */
    function generateId(prefix = 'doc') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 检查Firebase是否可用
     * @returns {boolean}
     */
    function isAvailable() {
        return typeof firebase !== 'undefined';
    }

    /**
     * 检查是否已初始化
     * @returns {boolean}
     */
    function isInitialized() {
        return state.isInitialized;
    }

    /**
     * 新增：设置自动同步开关
     * @param {boolean} enabled - 是否启用
     */
    function setAutoSyncEnabled(enabled) {
        state.autoSyncEnabled = !!enabled;
        if (enabled) {
            setupAutoSync();
            console.log('[Firebase] 自动同步已启用');
        } else {
            console.log('[Firebase] 自动同步已禁用');
        }
    }

    /**
     * 新增：清理同步队列
     */
    function clearSyncQueue() {
        state.syncQueue = [];
        console.log('[Firebase] 同步队列已清空');
    }

    /**
     * 模块初始化方法（供index.html的loader调用）
     * @returns {boolean}
     */
    function init() {
        console.log('[Firebase] 模块已加载，等待手动初始化');
        // 不自动初始化，等待用户在设置中启用
        return true;
    }

    /**
     * 新增：销毁模块（清理资源）
     */
    async function destroy() {
        try {
            // 取消所有监听
            if (state.authUnsubscribe) state.authUnsubscribe();
            if (state.connectedUnsubscribe) state.connectedUnsubscribe();
            
            // 清空队列
            clearSyncQueue();
            
            // 登出用户
            await logout();
            
            // 重置状态
            Object.assign(state, {
                isInitialized: false,
                isConnected: false,
                isPersistenceEnabled: false,
                db: null,
                auth: null,
                storage: null,
                functions: null,
                error: null,
                syncCallbacks: [],
                lastSyncTime: null,
                syncInProgress: false
            });

            console.log('[Firebase] 模块已销毁');
            return true;
        } catch (error) {
            console.error('[Firebase] 模块销毁失败:', error);
            return false;
        }
    }

    // 公共API
    const api = {
        // 模块管理
        init,
        initialize,
        destroy, // 新增
        isAvailable,
        isInitialized,
        getStatus,
        
        // 核心数据操作
        save,
        load,
        query,
        remove,
        batch,
        
        // 文件存储
        uploadFile,
        deleteFile,
        
        // 认证
        login,
        register,
        logout,
        getCurrentUser,
        
        // 云函数
        callFunction,
        
        // 业务数据同步
        syncTodayActions,
        syncOrders,
        syncSuppliers,
        syncCustomers,
        syncExpenses,
        syncAllLocalData,
        restoreFromCloud,
        
        // 状态管理
        onSyncStatusChange,
        offSyncStatusChange, // 新增
        setAutoSyncEnabled, // 新增
        clearSyncQueue, // 新增
        
        // 工具方法
        generateId,
        
        // 常量
        DEFAULT_CONFIG,
        COLLECTIONS
    };

    return api;
})();

// 挂载到全局
window.WorkbenchFirebase = WorkbenchFirebase;

// 兼容旧版API
window.V5Firebase = {
    initialize: WorkbenchFirebase.initialize,
    save: WorkbenchFirebase.save,
    load: WorkbenchFirebase.load,
    query: WorkbenchFirebase.query
};

console.log('[Firebase] 模块已加载，版本: V14.2 Enhanced (Fixed)');
