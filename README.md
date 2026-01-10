# ERP-v5md 工作台状态与Firebase集成说明
## 概述
本文档主要介绍 ERP-v5md 项目中工作台状态管理（`workbench-state.js`）和 Firebase 集成（`workbench-firebase.js`）相关核心函数，以及其在项目中的作用和使用方式。

## 核心文件说明
### 1. workbench-state.js
该文件提供了工作台状态默认值的获取能力，用于统一管理各类业务数据和系统设置的默认值。

#### 核心函数：`getDefaultValue(path)`
- **功能**：根据指定的状态路径，返回对应的默认值；若路径无匹配项，返回 `null`。
- **参数**：
  | 参数名 | 类型   | 说明           |
  |--------|--------|----------------|
  | path   | string | 状态路径（如 `data.orders`、`settings.target`） |
- **返回值**：`*` - 匹配路径的默认值，无匹配则返回 `null`。
- **支持的状态路径及默认值**：

| 状态路径                | 默认值          | 说明                     |
|-------------------------|-----------------|--------------------------|
| `data.orders`           | `[]`            | 订单数据列表             |
| `data.customers`        | `[]`            | 客户数据列表             |
| `data.suppliers`        | `[]`            | 供应商数据列表           |
| `data.expenses`         | `[]`            | 支出数据列表             |
| `data.incomes`          | `[]`            | 收入数据列表             |
| `data.todayActions`     | `[]`            | 今日操作列表             |
| `settings.target`       | `5000000`       | 目标金额（默认500万）|
| `settings.exchangeRate` | `7.25`          | 汇率（默认7.25）|
| `settings.feishuWebhook`| `''`            | 飞书Webhook地址（默认空） |
| `settings.firebaseEnabled` | `false`      | Firebase启用状态（默认关闭） |
| `settings.survivalModeEnabled` | `true`    | 生存模式启用状态（默认开启） |

- **使用示例**：
```javascript
// 获取默认订单列表
const defaultOrders = getDefaultValue('data.orders');
console.log(defaultOrders); // 输出：[]

// 获取默认目标金额
const defaultTarget = getDefaultValue('settings.target');
console.log(defaultTarget); // 输出：5000000

// 获取不存在的路径值
const nonExistValue = getDefaultValue('data.none');
console.log(nonExistValue); // 输出：null
```

### 2. workbench-firebase.js
该文件提供了从存储键名映射 Firebase 集合名称的能力，用于统一管理键名与集合名的对应关系。

#### 核心函数：`getCollectionNameFromKey(key)`
- **功能**：根据传入的存储键名，匹配并返回对应的 Firebase 集合名称；无匹配时返回 `misc`。
- **参数**：
  | 参数名 | 类型   | 说明           |
  |--------|--------|----------------|
  | key    | string | 存储键名（如 `orders`、`settings.target`） |
- **返回值**：`string` - 对应的 Firebase 集合名称。
- **键名与集合名映射规则**：

| 键名包含关键词 | 对应集合名称          | 说明               |
|----------------|-----------------------|--------------------|
| `orders`       | `COLLECTIONS.ORDERS`  | 订单集合           |
| `suppliers`    | `COLLECTIONS.SUPPLIERS` | 供应商集合       |
| `customers`    | `COLLECTIONS.CUSTOMERS` | 客户集合         |
| `expenses`     | `COLLECTIONS.EXPENSES` | 支出集合         |
| `today_actions`| `COLLECTIONS.TODAY_ACTIONS` | 今日操作集合 |
| `settings`     | `COLLECTIONS.SETTINGS` | 系统设置集合     |
| 其他关键词     | `misc`                | 其他杂项数据集合   |

- **使用示例**：
```javascript
// 匹配订单集合
const orderCollection = getCollectionNameFromKey('data.orders');
console.log(orderCollection); // 输出：COLLECTIONS.ORDERS

// 匹配设置集合
const settingsCollection = getCollectionNameFromKey('settings.feishuWebhook');
console.log(settingsCollection); // 输出：COLLECTIONS.SETTINGS

// 匹配今日操作集合
const todayActionsCollection = getCollectionNameFromKey('today_actions_2024');
console.log(todayActionsCollection); // 输出：COLLECTIONS.TODAY_ACTIONS

// 匹配杂项集合
const miscCollection = getCollectionNameFromKey('data.incomes');
console.log(miscCollection); // 输出：misc
```

## 整体使用场景
1. **状态初始化**：在工作台初始化时，通过 `getDefaultValue` 获取各类数据/设置的默认值，保证状态的初始一致性。
2. **Firebase 数据读写**：在读写 Firebase 数据时，通过 `getCollectionNameFromKey` 将业务键名转换为集合名称，统一数据存储路径。
3. **扩展说明**：
   - 新增状态默认值时，需在 `workbench-state.js` 的 `defaults` 对象中补充键值对。
   - 新增 Firebase 集合映射规则时，需在 `workbench-firebase.js` 的 `getCollectionNameFromKey` 函数中补充判断逻辑。

## 注意事项
1. `getDefaultValue` 仅返回预定义的默认值，未定义的路径一律返回 `null`，使用时需做好空值判断。
2. `getCollectionNameFromKey` 基于“键名包含关键词”匹配，需避免键名中包含非预期的关键词导致映射错误。
3. `COLLECTIONS` 为项目中 Firebase 集合名称的常量定义，需确保其已提前声明且值正确。
