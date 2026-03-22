# Firebase 安全配置指南

## 1. 启用邮箱/密码认证

1. 打开 [Firebase Console](https://console.firebase.google.com/)
2. 选择项目 `v5merp`
3. 进入 **Authentication** > **Sign-in method**
4. 启用 **Email/Password** 提供商
5. 保存设置

## 2. 创建管理员账户

### 方法 A：通过 Firebase Console（推荐）

1. 进入 **Authentication** > **Users**
2. 点击 **Add user**
3. 输入邮箱和密码（例如：`admin@v5medical.com`）
4. 点击 **Add user**

### 方法 B：通过控制台（临时）

在浏览器控制台运行：

```javascript
// 创建新用户
firebase.auth().createUserWithEmailAndPassword('admin@v5medical.com', 'your-secure-password')
  .then(userCredential => {
    console.log('用户创建成功:', userCredential.user.email);
  })
  .catch(error => {
    console.error('创建失败:', error.message);
  });
```

## 3. 配置 Firestore 安全规则

进入 **Firestore Database** > **Rules**，替换为以下规则：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 验证用户是否已登录
    function isAuthenticated() {
      return request.auth != null && !request.auth.token.isAnonymous;
    }
    
    // 验证用户是否是管理员
    function isAdmin() {
      return isAuthenticated() && 
             request.auth.token.email.matches('admin@v5medical.com');
    }
    
    // 所有集合都需要认证才能访问
    match /orders/{orderId} {
      allow read, write: if isAuthenticated();
    }
    
    match /customers/{customerId} {
      allow read, write: if isAuthenticated();
    }
    
    match /suppliers/{supplierId} {
      allow read, write: if isAuthenticated();
    }
    
    match /expenses/{expenseId} {
      allow read, write: if isAuthenticated();
    }
    
    match /trash/{itemId} {
      allow read, write: if isAuthenticated();
    }
    
    match /todos/{todoId} {
      allow read, write: if isAuthenticated();
    }
    
    match /memos/{memoId} {
      allow read, write: if isAuthenticated();
    }
    
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
  }
}
```

## 4. 可选：创建多个用户账户

如果需要多个员工账户，可以：

1. 在 Firebase Console > Authentication > Users 中添加多个用户
2. 修改安全规则，允许特定域名或邮箱格式的用户访问：

```javascript
function isAuthorizedUser() {
  return isAuthenticated() && 
         request.auth.token.email.matches('.*@v5medical.com');
}
```

## 5. 重置密码

如果忘记密码：

1. 在登录界面点击"忘记密码？"
2. 输入邮箱地址
3. Firebase 会发送重置密码邮件
4. 或通过 Firebase Console > Users > 选择用户 > Reset password

## 6. 安全建议

- 使用强密码（至少12位，包含大小写字母、数字和符号）
- 定期更换密码
- 不要共享账户
- 离职员工及时在 Firebase Console 中删除其账户
- 定期导出数据备份

## 7. 常见问题

### Q: 登录后数据不见了？
A: 检查 Firebase 安全规则是否正确配置，确保 `isAuthenticated()` 函数正常工作。

### Q: 匿名用户可以访问数据吗？
A: 不可以。当前配置要求必须使用邮箱/密码登录才能访问数据。

### Q: 如何禁用某个账户？
A: 在 Firebase Console > Authentication > Users 中找到该用户，点击菜单选择 **Disable account**。
