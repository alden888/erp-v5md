/**
 * V14.2 PRO Firebase Connection Module
 * 负责与 Google Cloud Firestore 通信
 * 优化版本 - 2026-01-03
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
        USERS: 'users'
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
        syncInProgress: false
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

            // 初始化Firebase应用
            const app = firebase.initializeApp(state.config);
            
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
            
            // 根据错误类型提供解决方案
            if (error.code === 'failed-precondition') {
                console.warn('[Firebase] 提示: 多个标签页打开时，离线持久化可能无法正常工作');
            } else if (error.code === 'unimplemented') {
                console.warn('[Firebase] 提示: 当前浏览器不支持离线持久化');
            }
        }
    }

    /**
     * 设置连接状态监听
     */
    function setupConnectionListeners() {
        // 使用.info/connected监听网络状态（如果可用）
        const connectedRef = state.db.collection('.info').doc('connected');
        
        // 简单的心跳检测
        const checkConnection = async () => {
            try {
                await state.db.collection('_heartbeat').doc('check').set({ 
                    timestamp: firebase.firestore.FieldValue.serverTimestamp() 
                });
                if (!state.isConnected) {
                    state.isConnected = true;
                    console.log('[Firebase] 🌐 已连接到网络');
                    notifySyncStatus('已连接', true);
                }
            } catch (error) {
                if (state.isConnected) {
                    state.isConnected = false;
                    console.log('[Firebase] 📡 网络连接已断开');
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
            state.auth.onAuthStateChanged((user) => {
                if (user) {
                    console.log('[Firebase] 👤 用户已登录:', user.email);
                } else {
                    console.log('[Firebase] 👤 匿名模式（未登录）');
                    // 匿名登录以便使用Firebase服务
                    state.auth.signInAnonymously().catch(err => {
                        console.warn('[Firebase] 匿名登录失败:', err);
                    });
                }
                resolve();
            });
        });
    }

    /**
     * 设置自动同步
     */
    function setupAutoSync() {
        if (!state.autoSyncEnabled) {
            console.log('[Firebase] 自动同步已禁用');
            return;
        }

        // 监听localStorage变化并自动同步
        window.addEventListener('storage', (e) => {
            if (!e.key || !e.key.startsWith('workbench_')) return;
            
            console.log('[Firebase] 检测到本地数据变化:', e.key);
            
            // 延迟同步，避免频繁触发
            setTimeout(() => {
                syncLocalStorageToCloud(e.key);
            }, 1000);
        });

        console.log('[Firebase] ✅ 自动同步已启用');
    }

    /**
     * 同步本地存储到云端
     * @param {string} key - 存储键名
     * @returns {Promise<boolean>}
     */
    async function syncLocalStorageToCloud(key) {
        if (!state.isInitialized || !state.isConnected || state.syncInProgress) {
            return false;
        }

        try {
            state.syncInProgress = true;
            const value = localStorage.getItem(key);
            
            if (!value) {
                console.log('[Firebase] 键值为空，跳过同步:', key);
                return false;
            }

            // 确定集合名称
            const collection = getCollectionNameFromKey(key);
            const userId = getCurrentUserId();
            const docId = `${userId}_${key}`;

            // 保存到云端
            await save(collection, docId, {
                key: key,
                value: value,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userId: userId
            });

            console.log('[Firebase] ✅ 已同步:', key);
            state.lastSyncTime = new Date();
            notifySyncStatus('已同步', true);
            
            return true;
        } catch (error) {
            console.error('[Firebase] ❌ 同步失败:', error);
            return false;
        } finally {
            state.syncInProgress = false;
        }
    }

    /**
     * 从键名获取集合名称
     * @param {string} key - 存储键名
     * @returns {string} 集合名称
     */
    function getCollectionNameFromKey(key) {
        if (key.includes('orders')) return COLLECTIONS.ORDERS;
        if (key.includes('suppliers')) return COLLECTIONS.SUPPLIERS;
        if (key.includes('customers')) return COLLECTIONS.CUSTOMERS;
        if (key.includes('expenses')) return COLLECTIONS.EXPENSES;
        if (key.includes('today_actions')) return COLLECTIONS.TODAY_ACTIONS;
        if (key.includes('settings')) return COLLECTIONS.SETTINGS;
        return 'misc'; // 其他数据
    }

    /**
     * 获取当前用户ID（匿名或已登录）
     * @returns {string}
     */
    function getCurrentUserId() {
        if (state.auth && state.auth.currentUser) {
            return state.auth.currentUser.uid;
        }
        // 如果没有用户，使用设备ID
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
            syncAllLocalData();
            
            return {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                emailVerified: user.emailVerified
            };
        } catch (error) {
            console.error('[Firebase] ❌ 登录失败:', error.message);
            throw error;
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
            throw error;
        }
    }

    /**
     * 用户登出
     * @returns {Promise<boolean>} 是否成功
     */
    async function logout() {
        try {
            validateInitialization();
            
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

            const userId = getCurrentUserId();
            const docId = `${userId}_today`;

            await save(COLLECTIONS.TODAY_ACTIONS, docId, {
                actions: actions,
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

            const userId = getCurrentUserId();
            const docId = `${userId}_orders`;

            await save(COLLECTIONS.ORDERS, docId, {
                orders: orders,
                count: orders.length,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userId: userId
            });

            console.log(`[Firebase] ✅ 已同步 ${orders.length} 个订单`);
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

            const userId = getCurrentUserId();
            const docId = `${userId}_suppliers`;

            await save(COLLECTIONS.SUPPLIERS, docId, {
                suppliers: suppliers,
                count: suppliers.length,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userId: userId
            });

            console.log(`[Firebase] ✅ 已同步 ${suppliers.length} 个供应商`);
            return true;
        } catch (error) {
            console.error('[Firebase] ❌ 供应商同步失败:', error);
            return false;
        }
    }

    /**
     * 同步所有本地数据到云端
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

            for (const key of keys) {
                try {
                    const success = await syncLocalStorageToCloud(key);
                    if (success) {
                        results.success.push(key);
                    } else {
                        results.failed.push(key);
                    }
                } catch (error) {
                    console.error(`[Firebase] 同步失败: ${key}`, error);
                    results.failed.push(key);
                }
            }

            console.log('[Firebase] ✅ 全量同步完成');
            console.log(`[Firebase] 成功: ${results.success.length}, 失败: ${results.failed.length}`);
            
            return results;
        } catch (error) {
            console.error('[Firebase] ❌ 全量同步失败:', error);
            return results;
        }
    }

    /**
     * 从云端恢复数据到本地
     * @returns {Promise<Object>} 恢复结果
     */
    async function restoreFromCloud() {
        console.log('[Firebase] 开始从云端恢复数据...');
        
        const results = {
            success: [],
            failed: [],
            total: 0
        };

        try {
            validateInitialization();
            
            const userId = getCurrentUserId();

            // 查询所有用户数据
            const collections = Object.values(COLLECTIONS);
            
            for (const collection of collections) {
                try {
                    const docs = await query(collection, [['userId', '==', userId]]);
                    results.total += docs.length;

                    for (const doc of docs) {
                        if (doc.key && doc.value) {
                            localStorage.setItem(doc.key, doc.value);
                            results.success.push(doc.key);
                            console.log(`[Firebase] ✅ 已恢复: ${doc.key}`);
                        }
                    }
                } catch (error) {
                    console.error(`[Firebase] 恢复集合 ${collection} 失败:`, error);
                    results.failed.push(collection);
                }
            }

            console.log('[Firebase] ✅ 数据恢复完成');
            console.log(`[Firebase] 成功: ${results.success.length}, 失败: ${results.failed.length}`);
            
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
            state.syncCallbacks.push(callback);
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
                callback(status, isConnected);
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
     * 模块初始化方法（供index.html的loader调用）
     * @returns {boolean}
     */
    function init() {
        console.log('[Firebase] 模块已加载，等待手动初始化');
        // 不自动初始化，等待用户在设置中启用
        return true;
    }

    // 公共API
    const api = {
        // 模块管理
        init,
        initialize,
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
        syncAllLocalData,
        restoreFromCloud,
        
        // 状态管理
        onSyncStatusChange,
        
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

console.log('[Firebase] 模块已加载，版本: V14.2 Enhanced');
